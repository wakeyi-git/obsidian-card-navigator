import { App, TFile, setIcon } from 'obsidian';
import { CardNavigatorSettings, MatrixGrid, MatrixCell, Matrix2DSettings } from '../types';
import { DebugLogger } from '../utils/DebugLogger';
import { DragDropHandler } from '../utils/DragDropHandler';

/**
 * 파일 오픈 콜백 타입
 */
type FileOpenCallback = (file: TFile) => void;

/**
 * 속성 변경 콜백 타입
 */
type PropertyChangeCallback = (
    file: TFile,
    primaryPropertyName: string,
    primaryValue: string,
    secondaryPropertyName: string,
    secondaryValue: string
) => Promise<void>;

/**
 * 셀 토글 콜백 타입
 */
type CellToggleCallback = (cellId: string, collapsed: boolean) => void;

/**
 * 카드 생성 콜백 타입
 * CardFactory.createCard를 사용하여 카드를 생성합니다
 */
type CreateCardCallback = (
    file: TFile,
    container: HTMLElement,
    activeFile: TFile | null,
    onFileOpen: FileOpenCallback
) => Promise<HTMLElement>;

/**
 * 2D 매트릭스 레이아웃 렌더러
 *
 * @remarks
 * 아이젠하워 매트릭스와 같은 2D 그리드 레이아웃을 렌더링합니다.
 * - 미분류 섹션 (상단)
 * - N×M 그리드 (CSS Grid 기반)
 * - 드래그 앤 드롭 속성 변경 지원
 */
export class MatrixRenderer {
    private app: App;
    private container: HTMLElement;
    private getSettings: () => CardNavigatorSettings;
    private createCard: CreateCardCallback;
    private dragDropHandler: DragDropHandler;
    private logger: DebugLogger;
    private onFileOpen: FileOpenCallback;
    private onPropertyChange: PropertyChangeCallback;
    private onCellToggle: CellToggleCallback;

    constructor(
        app: App,
        container: HTMLElement,
        getSettings: () => CardNavigatorSettings,
        createCard: CreateCardCallback,
        dragDropHandler: DragDropHandler,
        onFileOpen: FileOpenCallback,
        onPropertyChange: PropertyChangeCallback,
        onCellToggle: CellToggleCallback
    ) {
        this.app = app;
        this.container = container;
        this.getSettings = getSettings;
        this.createCard = createCard;
        this.dragDropHandler = dragDropHandler;
        this.onFileOpen = onFileOpen;
        this.onPropertyChange = onPropertyChange;
        this.onCellToggle = onCellToggle;
        this.logger = new DebugLogger(getSettings);
    }

    /**
     * 매트릭스 그리드를 렌더링합니다
     *
     * @param grid - MatrixGrid 데이터
     */
    async render(grid: MatrixGrid): Promise<void> {
        const settings = this.getSettings();
        const matrixSettings = settings.grouping.matrix2D;

        // 컨테이너 초기화
        this.container.empty();
        this.container.addClass('matrix-view');

        this.logger.debug('Grouping', 'Rendering matrix view', {
            totalFiles: grid.totalFileCount,
            unclassifiedCount: grid.unclassifiedFiles.length,
            gridSize: `${grid.primaryLabels.length}x${grid.secondaryLabels.length}`
        });

        // 매트릭스 전체 컨테이너
        const matrixContainer = this.container.createEl('div', {
            cls: 'matrix-container'
        });

        // 1. 미분류 섹션 렌더링 (상단)
        if (matrixSettings.showUnclassifiedSection && grid.unclassifiedFiles.length > 0) {
            await this.renderUnclassifiedSection(matrixContainer, grid, matrixSettings);
        }

        // 2. 매트릭스 그리드 렌더링
        await this.renderMatrixGrid(matrixContainer, grid, matrixSettings);
    }

    /**
     * 미분류 섹션을 렌더링합니다
     */
    private async renderUnclassifiedSection(
        container: HTMLElement,
        grid: MatrixGrid,
        settings: Matrix2DSettings
    ): Promise<void> {
        const unclassifiedSection = container.createEl('div', {
            cls: 'matrix-unclassified-section'
        });

        // 헤더
        const header = unclassifiedSection.createEl('div', {
            cls: 'matrix-unclassified-header'
        });

        const titleContainer = header.createEl('div', {
            cls: 'matrix-unclassified-title-container'
        });

        const iconEl = titleContainer.createEl('span', {
            cls: 'matrix-unclassified-icon'
        });
        setIcon(iconEl, 'inbox');

        titleContainer.createEl('span', {
            cls: 'matrix-unclassified-title',
            text: settings.unclassifiedSectionTitle
        });

        titleContainer.createEl('span', {
            cls: 'matrix-unclassified-count',
            text: `(${grid.unclassifiedFiles.length})`
        });

        // 카드 컨테이너
        const cardsContainer = unclassifiedSection.createEl('div', {
            cls: 'matrix-unclassified-cards'
        });

        // 카드 최소 너비 CSS 변수 설정
        cardsContainer.style.setProperty('--matrix-card-min-width', `${settings.cardMinWidth}px`);

        // ⚡ 성능 최적화: 병렬 카드 렌더링
        if (grid.unclassifiedFiles.length > 0) {
            await Promise.all(grid.unclassifiedFiles.map(file => this.renderFileCard(cardsContainer, file)));
        }
    }

    /**
     * 매트릭스 그리드를 렌더링합니다
     */
    private async renderMatrixGrid(
        container: HTMLElement,
        grid: MatrixGrid,
        settings: Matrix2DSettings
    ): Promise<void> {
        const gridContainer = container.createEl('div', {
            cls: 'matrix-grid-container'
        });

        // CSS Grid 설정
        // --matrix-primary-count: X축(primary) 값 개수 (CSS Grid repeat에서 사용)
        gridContainer.style.setProperty('--matrix-primary-count', grid.primaryLabels.length.toString());
        gridContainer.style.setProperty('--matrix-cell-min-width', `${settings.cellMinWidth}px`);
        gridContainer.style.setProperty('--matrix-cell-min-height', `${settings.cellMinHeight}px`);
        gridContainer.style.setProperty('--matrix-card-min-width', `${settings.cardMinWidth}px`);

        // 그리드 (테이블 형태)
        const gridEl = gridContainer.createEl('div', {
            cls: 'matrix-grid'
        });

        // 첫 행: 빈 코너 + X축 레이블들
        this.renderHeaderRow(gridEl, grid);

        // 나머지 행: Y축 레이블 + 셀들
        for (let y = 0; y < grid.secondaryLabels.length; y++) {
            await this.renderDataRow(gridEl, grid, y, settings);
        }
    }

    /**
     * 헤더 행(X축 레이블)을 렌더링합니다
     */
    private renderHeaderRow(gridEl: HTMLElement, grid: MatrixGrid): void {
        // 빈 코너 셀
        gridEl.createEl('div', {
            cls: 'matrix-corner-cell'
        });

        // X축 레이블들
        for (const label of grid.primaryLabels) {
            const labelEl = gridEl.createEl('div', {
                cls: 'matrix-header-cell matrix-x-label',
                text: label
            });
            labelEl.setAttribute('data-primary-value', label);
        }
    }

    /**
     * 데이터 행(Y축 레이블 + 셀들)을 렌더링합니다
     */
    private async renderDataRow(
        gridEl: HTMLElement,
        grid: MatrixGrid,
        rowIndex: number,
        settings: Matrix2DSettings
    ): Promise<void> {
        const secondaryLabel = grid.secondaryLabels[rowIndex];

        // Y축 레이블
        const rowLabelEl = gridEl.createEl('div', {
            cls: 'matrix-row-label matrix-y-label',
            text: secondaryLabel
        });
        rowLabelEl.setAttribute('data-secondary-value', secondaryLabel);

        // 셀들
        for (let x = 0; x < grid.primaryLabels.length; x++) {
            const cell = grid.cells[rowIndex][x];
            await this.renderCell(gridEl, cell, grid, settings);
        }
    }

    /**
     * 개별 셀을 렌더링합니다
     */
    private async renderCell(
        gridEl: HTMLElement,
        cell: MatrixCell,
        grid: MatrixGrid,
        settings: Matrix2DSettings
    ): Promise<void> {
        const cellEl = gridEl.createEl('div', {
            cls: 'matrix-cell'
        });

        cellEl.setAttribute('data-cell-id', cell.id);
        cellEl.setAttribute('data-primary-value', cell.primaryValue);
        cellEl.setAttribute('data-secondary-value', cell.secondaryValue);

        if (cell.collapsed) {
            cellEl.addClass('is-collapsed');
        }

        // 셀 헤더
        const cellHeader = cellEl.createEl('div', {
            cls: 'matrix-cell-header'
        });

        // 토글 아이콘
        const toggleIcon = cellHeader.createEl('span', {
            cls: 'matrix-cell-toggle'
        });
        setIcon(toggleIcon, cell.collapsed ? 'chevron-right' : 'chevron-down');

        // 파일 개수
        cellHeader.createEl('span', {
            cls: 'matrix-cell-count',
            text: `${cell.fileCount}`
        });

        // 토글 클릭 핸들러
        cellHeader.addEventListener('click', () => {
            cell.collapsed = !cell.collapsed;
            cellEl.toggleClass('is-collapsed', cell.collapsed);
            setIcon(toggleIcon, cell.collapsed ? 'chevron-right' : 'chevron-down');
            this.onCellToggle(cell.id, cell.collapsed);
        });

        // 카드 컨테이너
        const cardsContainer = cellEl.createEl('div', {
            cls: 'matrix-cell-cards'
        });

        // ⚡ 성능 최적화: 접힌 셀은 카드 렌더링 건너뜀, 펼쳐진 셀은 병렬 렌더링
        if (!cell.collapsed && cell.files.length > 0) {
            await Promise.all(cell.files.map(file => this.renderFileCard(cardsContainer, file)));
        }

        // 드롭 타겟 설정 (드래그 앤 드롭 속성 변경용)
        if (settings.enableDragDropPropertyChange) {
            this.setupCellDropTarget(cellEl, cell, grid);
        }
    }

    /**
     * 파일 카드를 렌더링합니다
     */
    private async renderFileCard(
        container: HTMLElement,
        file: TFile
    ): Promise<void> {
        // ⭐ 현재 활성 파일 가져오기 (active 클래스 적용을 위해)
        const activeFile = this.app.workspace.getActiveFile();

        // CardFactory.createCard 콜백 사용
        const cardEl = await this.createCard(
            file,
            container,
            activeFile,
            this.onFileOpen
        );

        // 드래그 가능 설정
        this.dragDropHandler.setupDraggable(cardEl, file);
    }

    /**
     * 셀을 드롭 타겟으로 설정합니다
     */
    private setupCellDropTarget(
        cellEl: HTMLElement,
        cell: MatrixCell,
        grid: MatrixGrid
    ): void {
        cellEl.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
            cellEl.addClass('matrix-cell-drop-target');
        });

        cellEl.addEventListener('dragleave', () => {
            cellEl.removeClass('matrix-cell-drop-target');
        });

        cellEl.addEventListener('drop', async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            cellEl.removeClass('matrix-cell-drop-target');

            if (!e.dataTransfer) return;

            // text/x-file-path MIME 타입에서 파일 경로 가져오기
            const filePathData = e.dataTransfer.getData('text/x-file-path');
            if (!filePathData) {
                this.logger.debug('Grouping', 'No file path data in drop event');
                return;
            }

            // JSON 파싱 (다중 파일 지원)
            let draggedFilePaths: string[];
            try {
                draggedFilePaths = JSON.parse(filePathData);
                if (!Array.isArray(draggedFilePaths)) {
                    draggedFilePaths = [filePathData];
                }
            } catch {
                draggedFilePaths = [filePathData];
            }

            this.logger.debug('Grouping', 'Matrix cell drop', {
                cellId: cell.id,
                droppedFiles: draggedFilePaths.length,
                targetPrimary: cell.primaryValue,
                targetSecondary: cell.secondaryValue
            });

            // 각 파일에 대해 속성 변경
            for (const filePath of draggedFilePaths) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    await this.onPropertyChange(
                        file,
                        grid.primaryPropertyName,
                        cell.primaryValue,
                        grid.secondaryPropertyName,
                        cell.secondaryValue
                    );
                }
            }
        });
    }

    /**
     * 컨테이너를 정리합니다
     */
    clear(): void {
        this.container.empty();
        this.container.removeClass('matrix-view');
    }
}

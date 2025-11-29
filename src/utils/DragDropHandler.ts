import { App, TFile, MarkdownView } from 'obsidian';
import { DebugLogger } from './DebugLogger';
import { CardNavigatorSettings, DragDropFullContentOptions } from '../types';
import { t } from '../i18n';

/**
 * 드래그 상태 인터페이스
 *
 * 드래그 진행 여부를 확인할 수 있는 인터페이스입니다.
 */
interface DragState {
    isDragging(): boolean;
}

/**
 * SelectionManager 인터페이스
 *
 * 다중 선택 관리를 위한 최소한의 인터페이스입니다.
 */
interface ISelectionManager {
    getSelectedFiles(): TFile[];
    isSelected(file: TFile): boolean;
}

/**
 * 드래그앤드롭 핸들러
 *
 * 카드를 드래그하여 편집기에 링크를 삽입하거나,
 * 다른 카드로 드래그하여 양방향 링크를 생성할 수 있습니다.
 * 다중 선택된 카드들도 함께 드래그할 수 있습니다.
 */
export class DragDropHandler {
    private app: App;
    private logger: DebugLogger;
    private getSettings: () => CardNavigatorSettings;
    private selectionManager?: ISelectionManager;
    // 드래그 시 사용할 파일 내용을 캠싱
    private cachedDragContent: Map<string, string> = new Map();

    constructor(app: App, getSettings?: () => CardNavigatorSettings, selectionManager?: ISelectionManager) {
        this.app = app;
        // ✅ 함수를 저장하여 항상 최신 settings를 참조
        this.getSettings = getSettings || (() => ({ debug: { enabled: false, categories: {} } } as CardNavigatorSettings));
        this.logger = new DebugLogger(this.getSettings);
        this.selectionManager = selectionManager;
    }

    /**
     * 파일에 해당하는 카드 요소를 찾습니다
     */
    private findCardElement(file: TFile): HTMLElement | null {
        const cards = document.querySelectorAll('.card-item');
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i] as HTMLElement;
            if (card.dataset.filePath === file.path) {
                return card;
            }
        }
        return null;
    }

    /**
     * 드래그 가능 설정
     *
     * 카드를 드래그 가능하게 설정하고 드래그 이벤트를 바인딩합니다.
     *
     * @param cardEl - 카드 HTML 요소
     * @param file - 연결된 파일
     * @returns 드래그 상태를 확인할 수 있는 객체
     */
    setupDraggable(cardEl: HTMLElement, file: TFile): DragState {
        cardEl.draggable = true;
        cardEl.setAttribute('data-file-path', file.path);

        let dragging = false;
        let dragEndTimeout: NodeJS.Timeout | null = null;

        // mousedown 이벤트에서 파일 내용을 미리 로드하여 캠싱
        cardEl.addEventListener('mousedown', async () => {
            const settings = this.getSettings();
            if (settings.dragDrop.contentType === 'full-content') {
                // 다중 선택된 파일들 확인
                const filesToCache = this.selectionManager?.isSelected(file)
                    ? this.selectionManager.getSelectedFiles()
                    : [file];

                // ⚡ 성능 최적화: 병렬로 모든 파일 내용을 미리 로드하여 캠싱
                await Promise.all(filesToCache.map(async (f) => {
                    const content = await this.getFileContentForDrag(f, settings.dragDrop.fullContentOptions);
                    this.cachedDragContent.set(f.path, content);
                }));

                // 요약 로그만 출력 (개별 파일 로그 제거)
                if (filesToCache.length > 0) {
                    this.logger.debug('DragDrop', t().dragDrop.contentCached, {
                        fileCount: filesToCache.length
                    });
                }
            }
        });

        cardEl.addEventListener('dragstart', (e: DragEvent) => {
            if (!e.dataTransfer) return;

            dragging = true;

            if (dragEndTimeout) {
                clearTimeout(dragEndTimeout);
                dragEndTimeout = null;
            }

            // 다중 선택된 파일들 확인
            const selectedFiles = this.selectionManager?.isSelected(file)
                ? this.selectionManager.getSelectedFiles()
                : [file];

            this.logger.debug('DragDrop', t().dragDrop.dragStart, {
                file: file.basename,
                selectedCount: selectedFiles.length
            });

            // 설정에 따라 드래그 데이터 결정
            const settings = this.getSettings();
            let dragContent: string;

            if (settings.dragDrop.contentType === 'link') {
                // 링크 형식 - 다중 파일인 경우 모든 링크 포함
                dragContent = selectedFiles.map(f => `[[${f.basename}]]`).join('\n');
                this.logger.debug('DragDrop', t().dragDrop.dragContentLink, {
                    content: dragContent,
                    fileCount: selectedFiles.length
                });
            } else {
                // 파일 전체 내용 (캠싱된 내용 사용)
                // 다중 파일인 경우 각 파일의 내용을 구분자로 연결
                const contents = selectedFiles.map(f =>
                    this.cachedDragContent.get(f.path) || `[[${f.basename}]]`
                );
                dragContent = contents.join('\n\n---\n\n');

                this.logger.debug('DragDrop', t().dragDrop.dragContentFile, {
                    length: dragContent.length,
                    fileCount: selectedFiles.length
                });

                // 사용 후 캠시 삭제
                selectedFiles.forEach(f => this.cachedDragContent.delete(f.path));
            }

            e.dataTransfer.setData('text/plain', dragContent);
            // 다중 파일인 경우 모든 파일 경로를 JSON으로 저장
            // 'text/x-file-path'를 사용하여 표준 MIME 타입 형식 준수
            e.dataTransfer.setData('text/x-file-path', JSON.stringify(selectedFiles.map(f => f.path)));
            e.dataTransfer.effectAllowed = 'copyMove';

            cardEl.addClass('dragging');

            // 다중 선택된 다른 카드들도 dragging 클래스 추가
            if (selectedFiles.length > 1) {
                selectedFiles.forEach(f => {
                    if (f !== file) {
                        const otherCard = this.findCardElement(f);
                        if (otherCard) {
                            otherCard.addClass('dragging');
                        }
                    }
                });
            }
        });

        cardEl.addEventListener('dragend', () => {
            cardEl.removeClass('dragging');

            // 다중 선택된 다른 카드들도 dragging 클래스 제거
            if (this.selectionManager?.isSelected(file)) {
                const selectedFiles = this.selectionManager.getSelectedFiles();
                selectedFiles.forEach(f => {
                    if (f !== file) {
                        const otherCard = this.findCardElement(f);
                        if (otherCard) {
                            otherCard.removeClass('dragging');
                        }
                    }
                });
            }

            dragEndTimeout = setTimeout(() => {
                dragging = false;
                dragEndTimeout = null;
                this.logger.debug('DragDrop', t().dragDrop.dragEnd);
            }, 100);
		});

        // 다른 카드 위로 드래그 시
        this.setupDropTarget(cardEl, file);

        // 드래그 상태를 확인할 수 있는 객체 반환
        return {
            isDragging: () => dragging
        };
    }

    /**
     * 드롭 타겟 설정
     * 
     * 카드를 드롭 타겟으로 설정하여 다른 카드를 드롭하면
     * 양방향 링크를 생성합니다.
     * 
     * @param cardEl - 카드 HTML 요소
     * @param targetFile - 이 카드의 파일
     */
    private setupDropTarget(cardEl: HTMLElement, targetFile: TFile): void {
        cardEl.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'link';
            }
            cardEl.addClass('drop-target');
        });

        cardEl.addEventListener('dragleave', () => {
            cardEl.removeClass('drop-target');
        });

        cardEl.addEventListener('drop', async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            cardEl.removeClass('drop-target');

            if (!e.dataTransfer) return;

            // text/x-file-path MIME 타입에서 파일 경로 가져오기
            const filePathData = e.dataTransfer.getData('text/x-file-path');
            if (!filePathData) return;

            // JSON 파싱 시도 (다중 파일)
            let draggedFilePaths: string[];
            try {
                draggedFilePaths = JSON.parse(filePathData);
                if (!Array.isArray(draggedFilePaths)) {
                    draggedFilePaths = [filePathData];
                }
            } catch {
                // JSON이 아니면 단일 파일 경로
                draggedFilePaths = [filePathData];
            }

            // 드롭 대상과 동일한 파일 제외
            draggedFilePaths = draggedFilePaths.filter(path => path !== targetFile.path);
            if (draggedFilePaths.length === 0) return;

            this.logger.debug('DragDrop', t().dragDrop.cardDropped, {
                fileCount: draggedFilePaths.length,
                to: targetFile.basename
            });

            // 모든 드래그된 파일에 대해 양방향 링크 생성
            for (const draggedFilePath of draggedFilePaths) {
                const draggedFile = this.app.vault.getAbstractFileByPath(draggedFilePath);
                if (draggedFile instanceof TFile) {
                    await this.createBidirectionalLink(draggedFile, targetFile);
                }
            }
        });
    }

    /**
     * 양방향 링크 생성
     * 
     * 두 파일에 서로의 링크를 추가합니다.
     * 
     * @param sourceFile - 드래그한 파일
     * @param targetFile - 드롭한 파일
     */
    private async createBidirectionalLink(sourceFile: TFile, targetFile: TFile): Promise<void> {
        try {
            const sourceContent = await this.app.vault.read(sourceFile);
            const targetLink = `\n[[${targetFile.basename}]]`;
            
            if (!sourceContent.includes(`[[${targetFile.basename}]]`)) {
                await this.app.vault.modify(sourceFile, sourceContent + targetLink);
            }

            const targetContent = await this.app.vault.read(targetFile);
            const sourceLink = `\n[[${sourceFile.basename}]]`;
            
            if (!targetContent.includes(`[[${sourceFile.basename}]]`)) {
                await this.app.vault.modify(targetFile, targetContent + sourceLink);
            }

            this.logger.debug('DragDrop', t().dragDrop.bidirectionalLinkCreated, {
                source: sourceFile.basename,
                target: targetFile.basename
            });
        } catch (error) {
            this.logger.error('DragDrop', t().dragDrop.bidirectionalLinkFailed, error);
        }
    }

    /**
     * 편집기 드롭 존 설정
     * 
     * Obsidian이 기본적으로 편집기 드래그앤드롭을 지원하므로
     * 현재는 추가 설정이 필요하지 않습니다.
     */
    setupEditorDropZone(): void {
        this.logger.debug('DragDrop', t().dragDrop.editorDropZoneSetup);
    }

    /**
     * 커서 위치에 텍스트 삽입
     * 
     * @param text - 삽입할 텍스트
     */
    private insertAtCursor(text: string): void {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        const editor = view.editor;
        const cursor = editor.getCursor();
        editor.replaceRange(text, cursor);
    }

    /**
     * 파일 내용 복사
     * 
     * @param file - 복사할 파일
     * @returns 파일 내용
     */
    private async copyFileContent(file: TFile): Promise<string> {
        try {
            const content = await this.app.vault.read(file);
            return content;
        } catch (error) {
            this.logger.error('DragDrop', t().dragDrop.fileCopyFailed, error);
            return '';
        }
    }

    /**
     * 드래그 시 사용할 파일 내용을 가져옵니다
     * 
     * 설정에 따라 프론트매터 포함 여부 및 최대 길이를 처리합니다.
     * 
     * @param file - 파일
     * @param options - 파일 내용 옵션
     * @returns 처리된 파일 내용
     */
    private async getFileContentForDrag(file: TFile, options: DragDropFullContentOptions): Promise<string> {
        try {
            let content = await this.app.vault.read(file);

            // 프론트매터 제거 (옵션에 따라)
            if (!options.includeFrontmatter) {
                // 프론트매터 패턴: ---로 시작해서 ---로 끝나는 부분
                const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
                content = content.replace(frontmatterRegex, '').trim();
            }

            // 최대 길이 제한 (옵션에 따라)
            if (options.enableLengthLimit && content.length > options.maxLength) {
                content = content.substring(0, options.maxLength);
                // 마지막에 생략 표시
                content += '\n\n...';
            }

            return content;
        } catch (error) {
            this.logger.error('DragDrop', t().dragDrop.fileContentFetchFailed, error);
            return '';
        }
    }

    // =========================================================================
    // Matrix Property Update (2D Matrix Grouping)
    // =========================================================================

    /**
     * 파일의 프론트매터 속성을 업데이트합니다
     *
     * @remarks
     * 2D 매트릭스 그룹화에서 드래그 앤 드롭으로 셀을 변경할 때 사용합니다.
     * Obsidian의 processFrontMatter API를 사용하여 안전하게 업데이트합니다.
     *
     * @param file - 대상 파일
     * @param propertyName - 속성 이름
     * @param propertyValue - 새 속성 값
     */
    async updateFileProperty(file: TFile, propertyName: string, propertyValue: string): Promise<void> {
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter[propertyName] = propertyValue;
            });

            this.logger.debug('DragDrop', 'Property updated', {
                file: file.basename,
                property: propertyName,
                value: propertyValue
            });
        } catch (error) {
            this.logger.error('DragDrop', 'Failed to update property', error);
            throw error;
        }
    }

    /**
     * 파일의 여러 프론트매터 속성을 한 번에 업데이트합니다
     *
     * @remarks
     * 2D 매트릭스 그룹화에서 두 속성(예: urgency, importance)을 동시에 변경할 때 사용합니다.
     *
     * @param file - 대상 파일
     * @param properties - 업데이트할 속성들 { propertyName: propertyValue }
     */
    async updateFileProperties(file: TFile, properties: Record<string, string>): Promise<void> {
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                for (const [name, value] of Object.entries(properties)) {
                    frontmatter[name] = value;
                }
            });

            this.logger.debug('DragDrop', 'Properties updated', {
                file: file.basename,
                properties
            });
        } catch (error) {
            this.logger.error('DragDrop', 'Failed to update properties', error);
            throw error;
        }
    }
}

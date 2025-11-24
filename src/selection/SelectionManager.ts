import { App, Notice, TFile, setIcon } from 'obsidian';
import { DebugLogger } from '../utils/DebugLogger';
import { CardNavigatorSettings } from '../types';
import { TextInputModal } from '../ui/modals/TextInputModal';
import { FolderSuggestModal } from '../ui/FolderSuggestModal';
import { t } from '../i18n';

/**
 * 다중 선택 및 일괄 작업 관리자
 *
 * 파일 카드의 다중 선택과 선택된 파일들에 대한 일괄 작업을 제공합니다.
 *
 * ⭐ Section 8.3: 성능 최적화
 * - 카드 요소 캐싱으로 DOM 쿼리 최소화
 * - 선택 상태 추적으로 불필요한 UI 업데이트 방지
 * - 선택 바 재사용으로 DOM 생성/제거 최소화
 *
 * @example
 * ```typescript
 * const selectionManager = new SelectionManager(app, settings);
 *
 * selectionManager.setAllFiles(files);
 * selectionManager.toggleSelection(file, mouseEvent);
 * const selected = selectionManager.getSelectedFiles();
 * ```
 */
export class SelectionManager {
    private app: App;
    private selected: Set<TFile>;
    private allFiles: TFile[];
    private lastSelectedIndex: number;
    private logger: DebugLogger;
    private getSettings: () => CardNavigatorSettings;
    private onRefresh?: () => Promise<void>;

	/** ⭐ Section 8.3: 파일 경로 → 카드 요소 매핑 캐시 */
	private cardElementCache: Map<string, HTMLElement> = new Map();

	/** ⭐ Section 8.3: 마지막 선택 상태 (변경 감지용) */
	private lastSelectionState: Set<string> = new Set();

	/** ⭐ Section 8.3: 선택 바 요소 재사용 */
	private selectionBarElement: HTMLElement | null = null;

    constructor(app: App, getSettings: () => CardNavigatorSettings, onRefresh?: () => Promise<void>) {
        this.app = app;
        this.selected = new Set();
        this.allFiles = [];
        this.lastSelectedIndex = -1;
        this.getSettings = getSettings;
        this.onRefresh = onRefresh;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(getSettings);
    }

    /**
     * 범위 선택을 위한 전체 파일 목록을 설정합니다
     *
     * @param files - 표시되는 모든 파일의 배열
	 *
	 * ⭐ Section 8.3: 카드 요소 캐시 구축
	 * - 파일 목록이 변경되면 캐시 초기화
     */
    setAllFiles(files: TFile[]): void {
        this.allFiles = files;

		// ⭐ Section 8.3: 캐시 무효화
		this.cardElementCache.clear();
    }

    /**
     * 파일의 선택 상태를 토글합니다
     * 
     * @param file - 선택/해제할 파일
     * @param event - 마우스 이벤트 (Ctrl, Shift 키 감지용)
     * 
     * ⭐ 버그 수정 (2025-11-20):
     * Shift 키를 누른 상태에서의 첫 번째 클릭이 범위 선택의 시작점이 되도록 수정
     * 
     * 동작:
     * - 일반 클릭: 단일 선택, 범위 선택 시작점 초기화
     * - Ctrl/Cmd + 클릭: 개별 토글, 시작점 업데이트
     * - Shift + 클릭 (시작점 없음): 현재 클릭을 시작점으로 설정
     * - Shift + 클릭 (시작점 있음): 시작점부터 현재까지 범위 선택
     */
    toggleSelection(file: TFile, event: MouseEvent): void {
        const fileIndex = this.allFiles.indexOf(file);

        if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd 클릭: 개별 토글 (기존 선택 유지)
            if (this.selected.has(file)) {
                this.selected.delete(file);
            } else {
                this.selected.add(file);
            }
            // Ctrl/Cmd 클릭도 시작점으로 설정 (표준 동작)
            this.lastSelectedIndex = fileIndex;
        } else if (event.shiftKey) {
            // Shift 클릭
            if (this.lastSelectedIndex === -1) {
                // Shift 첫 클릭: 현재 카드를 시작점으로 설정
                this.selected.clear();
                this.selected.add(file);
                this.lastSelectedIndex = fileIndex;
            } else {
                // Shift 범위 선택: 시작점부터 현재까지
                // Shift만 누른 경우: 기존 선택 제거 후 범위 선택 (표준 동작)
                // Ctrl+Shift: 기존 선택 유지하고 범위 추가 (확장 선택)
                if (!event.ctrlKey && !event.metaKey) {
                    this.selected.clear();
                }
                this.selectRange(fileIndex);
                // lastSelectedIndex는 마지막 범위 선택의 끝 지점으로 업데이트
                this.lastSelectedIndex = fileIndex;
            }
        } else {
        // 일반 클릭: 단일 선택, 범위 선택 시작점 설정
        this.selected.clear();
        this.selected.add(file);
        // ⭐ 수정: 일반 클릭도 범위 선택의 시작점이 됨
        this.lastSelectedIndex = fileIndex;
        }

        this.updateUI();
    }

    /**
     * 범위 선택을 수행합니다
     */
    private selectRange(endIndex: number): void {
        // 음수 인덱스 방지
        const start = Math.max(0, Math.min(this.lastSelectedIndex, endIndex));
        const end = Math.max(this.lastSelectedIndex, endIndex);

        for (let i = start; i <= end; i++) {
            if (i >= 0 && i < this.allFiles.length) {
                this.selected.add(this.allFiles[i]);
            }
        }
    }

    /**
     * 모든 파일을 선택합니다
     */
    selectAll(): void {
        this.selected.clear();
        this.allFiles.forEach(file => this.selected.add(file));
        this.updateUI();
        new Notice(t().selection.filesSelected(this.selected.size));
    }

    /**
     * 모든 선택을 해제합니다
     * 
     * ⭐ 버그 수정 (2025-11-20):
     * 선택 해제 시 범위 선택 시작점도 함께 초기화
     */
    clearSelection(): void {
        this.selected.clear();
        this.lastSelectedIndex = -1;  // 범위 선택 시작점 초기화
        this.updateUI();
    }

    /**
     * UI를 업데이트합니다
     *
     * @remarks
     * 외부에서 선택 상태 복원이 필요할 때 사용합니다.
     * 예: 렌더링 후 선택된 카드의 스타일을 다시 적용
     *
     * ⭐ Section 8.3: 상태 기반 UI 업데이트 최적화
     * - 변경된 카드만 업데이트 (added/removed)
     * - querySelectorAll 호출 최소화
     */
    public updateUI(): void {
        // ⭐ Section 8.3: 현재 선택 상태를 Set으로 변환
        const currentSelection = new Set<string>(
            Array.from(this.selected).map(f => f.path)
        );

        // ⭐ Section 8.3: 캐시가 비어있으면 전체 업데이트 (초기 상태 또는 캐시 무효화 후)
        if (this.cardElementCache.size === 0) {
            // 전체 카드 업데이트 (기존 방식)
            document.querySelectorAll('.card-item').forEach(card => {
                const cardEl = card as HTMLElement;
                const filePath = cardEl.dataset.filePath;
                if (filePath) {
                    // 캐시에 저장
                    this.cardElementCache.set(filePath, cardEl);
                    // 선택 상태 적용
                    if (currentSelection.has(filePath)) {
                        cardEl.addClass('selected');
                    } else {
                        cardEl.removeClass('selected');
                    }
                }
            });
            this.lastSelectionState = currentSelection;
            this.updateSelectionInfo();
            return;
        }

        // ⭐ Section 8.3: 변경 사항 계산
        const added = new Set<string>();
        const removed = new Set<string>();

        // 새로 선택된 파일 찾기
        currentSelection.forEach(path => {
            if (!this.lastSelectionState.has(path)) {
                added.add(path);
            }
        });

        // 선택 해제된 파일 찾기
        this.lastSelectionState.forEach(path => {
            if (!currentSelection.has(path)) {
                removed.add(path);
            }
        });

        // ⭐ Section 8.3: 변경된 카드만 업데이트
        if (added.size > 0 || removed.size > 0) {
            // 추가된 선택 적용
            added.forEach(path => {
                const cached = this.cardElementCache.get(path);
                if (cached && cached.isConnected) {
                    cached.addClass('selected');
                }
            });

            // 제거된 선택 적용
            removed.forEach(path => {
                const cached = this.cardElementCache.get(path);
                if (cached && cached.isConnected) {
                    cached.removeClass('selected');
                }
            });

            // ⭐ Section 8.3: 선택 상태 갱신
            this.lastSelectionState = currentSelection;
        }

        this.updateSelectionInfo();
    }

    /**
     * 파일에 해당하는 카드 요소를 찾습니다
	 *
	 * ⭐ Section 8.3: DOM 쿼리 캐싱 적용
	 * - 한 번 찾은 카드 요소를 캐시에 저장
	 * - querySelectorAll 호출 최소화
     */
    private findCardElement(file: TFile): HTMLElement | null {
		// ⭐ Section 8.3: 캐시 확인
		const cached = this.cardElementCache.get(file.path);
		if (cached && cached.isConnected) {
			// DOM에 연결되어 있는 경우에만 반환
			return cached;
		}

		// 캐시 미스: DOM 쿼리 수행
        const cards = document.querySelectorAll('.card-item');
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i] as HTMLElement;
            if (card.dataset.filePath === file.path) {
				// ⭐ Section 8.3: 캐싱
				this.cardElementCache.set(file.path, card);
                return card;
            }
        }
        return null;
    }

    /**
     * 선택 정보 표시를 업데이트합니다
     *
     * ⭐ Section 8.3: 선택 바 재사용 최적화
     * - 기존 요소를 재사용하여 DOM 생성/제거 최소화
     * - 선택 개수만 업데이트
     */
    private updateSelectionInfo(): void {
        if (this.selected.size > 0) {
            const container = document.querySelector('.card-navigator-container');
            if (!container) return;

            // ⭐ Section 8.3: 기존 선택 바 재사용
            if (!this.selectionBarElement || !this.selectionBarElement.isConnected) {
                // 선택 바가 없거나 DOM에서 제거된 경우 새로 생성
                this.selectionBarElement = container.createDiv('selection-bar');

                // 선택 개수 표시 요소 생성
                this.selectionBarElement.createEl('span', {
                    cls: 'selection-count'
                });

                // 일괄 작업 버튼 생성
                this.createBatchActionButtons(this.selectionBarElement);
            }

            // ⭐ Section 8.3: 선택 개수만 업데이트
            const countEl = this.selectionBarElement.querySelector('.selection-count');
            if (countEl) {
                countEl.textContent = t().selection.selectedFiles(this.selected.size);
            }
        } else {
            // ⭐ Section 8.3: 선택이 없으면 선택 바 제거
            if (this.selectionBarElement && this.selectionBarElement.isConnected) {
                this.selectionBarElement.remove();
                this.selectionBarElement = null;
            }
        }
    }

    /**
     * 일괄 작업 버튼들을 생성합니다 (클리커블 아이콘)
     *
     * ⭐ 버그 수정 (2025-11-20):
     * native prompt 대신 Obsidian Modal 사용
     *
     * ⭐ UI 개선 (2025-11-22):
     * 버튼을 클리커블 아이콘으로 변경하여 공간 절약
     */
    private createBatchActionButtons(container: HTMLElement): void {
        const buttonContainer = container.createDiv({ cls: 'batch-actions'});

        // Pin action
        const pinBtn = buttonContainer.createEl('div', {
            cls: 'clickable-icon batch-action-icon',
            attr: {
                'aria-label': t().selection.pin
            }
        });
        setIcon(pinBtn, 'pin');
        pinBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', 'Pin button clicked');
            this.batchPin();
        });

        // Star action
        const starBtn = buttonContainer.createEl('div', {
            cls: 'clickable-icon batch-action-icon',
            attr: {
                'aria-label': t().selection.star
            }
        });
        setIcon(starBtn, 'star');
        starBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', 'Star button clicked');
            this.batchStar();
        });

        // Add tag action
        const addTagBtn = buttonContainer.createEl('div', {
            cls: 'clickable-icon batch-action-icon',
            attr: {
                'aria-label': t().selection.addTag
            }
        });
        setIcon(addTagBtn, 'tag');
        addTagBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', t().selection.addTagButtonClicked);
            this.batchAddTag();
        });

        // Move action
        const moveBtn = buttonContainer.createEl('div', {
            cls: 'clickable-icon batch-action-icon',
            attr: {
                'aria-label': t().selection.move
            }
        });
        setIcon(moveBtn, 'folder-input');
        moveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', t().selection.moveButtonClicked);
            this.batchMove();
        });

        // Delete action
        const deleteBtn = buttonContainer.createEl('div', {
            cls: 'clickable-icon batch-action-icon batch-action-danger',
            attr: {
                'aria-label': t().selection.delete
            }
        });
        setIcon(deleteBtn, 'trash');
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', t().selection.deleteButtonClicked);
            this.batchDelete();
        });

        // Clear selection action
        const clearBtn = buttonContainer.createEl('div', {
            cls: 'clickable-icon batch-action-icon',
            attr: {
                'aria-label': t().selection.clearSelection
            }
        });
        setIcon(clearBtn, 'x');
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', t().selection.clearSelectionButtonClicked);
            this.clearSelection();
        });
    }

    /**
     * 선택된 모든 파일에 태그를 일괄 추가합니다
     * 
     * ⭐ 버그 수정 (2025-11-20):
     * native prompt 대신 TextInputModal 사용
     */
    private async batchAddTag(): Promise<void> {
        this.logger.debug('Selection', t().selection.batchAddTagCalled, {
            selectedCount: this.selected.size
        });

        const modal = new TextInputModal(
            this.app,
            t().selection.addTagModalTitle,
            t().selection.addTagModalPlaceholder,
            '',
            async (tag) => {
                this.logger.debug('Selection', t().selection.tagInputReceived, { tag });

                const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                let successCount = 0;

                for (const file of this.selected) {
                    try {
                        await this.addTagToFile(file, cleanTag);
                        successCount++;
                    } catch (error) {
                        this.logger.error('Selection', t().selection.tagAddFailed(file.path), error);
                    }
                }

                new Notice(t().selection.tagAdded(successCount, cleanTag));
                this.clearSelection();
            }
        );

        modal.open();
    }

    /**
     * 파일의 프론트매터에 태그를 추가합니다
     * 
     * ⭐ 버그 수정 (2025-11-20):
     * Obsidian의 processFrontMatter API를 사용하여 안전하게 태그 추가
     * 다양한 YAML 형식을 잘못 처리하던 기존 문제 해결
     * 
     * @param file - 태그를 추가할 파일
     * @param tag - 추가할 태그 (경로 형태 가능: folder/subfolder/tag)
     */
    private async addTagToFile(file: TFile, tag: string): Promise<void> {
        this.logger.debug('Selection', t().selection.tagAddStart(file.path), { tag });

        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            // 태그 필드가 없으면 생성
            if (!frontmatter.tags) {
                frontmatter.tags = [];
            }

            // 태그가 문자열이면 배열로 변환
            if (typeof frontmatter.tags === 'string') {
                // 쉼표나 공백으로 구분된 문자열 처리
                const tagString = frontmatter.tags.trim();
                if (tagString) {
                    // 쉼표로 분리하고 각 태그의 공백 제거
                    frontmatter.tags = tagString.split(/[,\s]+/).filter((t: string) => t.length > 0);
                } else {
                    frontmatter.tags = [];
                }
            }

            // 태그가 배열이 아니면 배열로 변환
            if (!Array.isArray(frontmatter.tags)) {
                frontmatter.tags = [frontmatter.tags];
            }

            // 태그 정규화 (앞의 # 제거, 공백 제거)
            const normalizedTag = tag.replace(/^#+/, '').trim();

            // 중복 확인 (대소문자 구분 없이)
            const existingTag = frontmatter.tags.find(
                (t: string) => t.toLowerCase() === normalizedTag.toLowerCase()
            );

            if (!existingTag) {
                frontmatter.tags.push(normalizedTag);
                this.logger.debug('Selection', t().selection.tagAddSuccess(normalizedTag));
            } else {
                this.logger.debug('Selection', t().selection.tagAlreadyExists(normalizedTag));
            }
        });
    }

    /**
     * 선택된 모든 파일을 일괄 이동합니다
     * 
     * ⭐ 버그 수정 (2025-11-20):
     * native prompt 대신 FolderSuggestModal 사용
     */
    private async batchMove(): Promise<void> {
        this.logger.debug('Selection', t().selection.batchMoveCalled, {
            selectedCount: this.selected.size
        });

        const modal = new FolderSuggestModal(
            this.app,
            async (folder) => {
                if (!folder) {
                    this.logger.debug('Selection', t().selection.folderSelectionCancelled);
                    return;
                }

                this.logger.debug('Selection', t().selection.folderSelected, { folderPath: folder.path });

                let successCount = 0;
                const folderPath = folder.path === '/' ? '' : folder.path;

                for (const file of this.selected) {
                    try {
                        const newPath = folderPath ? `${folderPath}/${file.name}` : file.name;
                        await this.app.fileManager.renameFile(file, newPath);
                        successCount++;
                    } catch (error) {
                        this.logger.error('Selection', t().selection.moveFileFailed(file.path), error);
                    }
                }

                const displayPath = folder.path === '/' ? t().selection.root : folder.path;
                new Notice(t().selection.filesMoved(successCount, displayPath));
                this.clearSelection();
            }
        );

        modal.open();
    }

    /**
     * 선택된 모든 파일을 일괄 삭제합니다
     */
    private async batchDelete(): Promise<void> {
        const confirmed = confirm(t().selection.deleteConfirm(this.selected.size));
        if (!confirmed) return;

        let successCount = 0;

        for (const file of this.selected) {
            try {
                await this.app.vault.delete(file);
                successCount++;
            } catch (error) {
                this.logger.error('Selection', t().selection.deleteFileFailed(file.path), error);
            }
        }

        new Notice(t().selection.filesDeleted(successCount));
        this.clearSelection();
    }

    /**
     * 선택된 모든 파일을 일괄 핀 설정/해제합니다
     */
    private async batchPin(): Promise<void> {
        const settings = this.getSettings();
        const pinnedFiles = settings.pinnedFiles || [];

        // 선택된 파일 중 핀되지 않은 파일이 하나라도 있으면 핀 추가, 모두 핀되어 있으면 핀 제거
        const allPinned = Array.from(this.selected).every(file => pinnedFiles.includes(file.path));

        let successCount = 0;

        if (allPinned) {
            // 모두 핀되어 있으면 핀 제거
            for (const file of this.selected) {
                const index = pinnedFiles.indexOf(file.path);
                if (index > -1) {
                    pinnedFiles.splice(index, 1);
                    successCount++;
                }
            }
            new Notice(t().selection.filesUnpinned(successCount));
        } else {
            // 하나라도 핀되지 않았으면 모두 핀 추가
            for (const file of this.selected) {
                if (!pinnedFiles.includes(file.path)) {
                    pinnedFiles.push(file.path);
                    successCount++;
                }
            }
            new Notice(t().selection.filesPinned(successCount));
        }

        settings.pinnedFiles = pinnedFiles;

        // Save settings and refresh view
        if (this.onRefresh) {
            await this.onRefresh();
        }

        this.clearSelection();
    }

    /**
     * 선택된 모든 파일을 일괄 즐겨찾기 추가/제거합니다
     */
    private async batchStar(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bookmarks = (this.app as any).internalPlugins?.plugins?.bookmarks;
        if (!bookmarks?.instance) {
            new Notice(t().selection.bookmarksNotAvailable);
            return;
        }

        const bookmarkPlugin = bookmarks.instance;

        // 선택된 파일 중 즐겨찾기되지 않은 파일이 하나라도 있으면 추가, 모두 즐겨찾기되어 있으면 제거
        const selectedFiles = Array.from(this.selected);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allStarred = selectedFiles.every(file =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            bookmarkPlugin.items?.some((item: any) =>
                item.type === 'file' && item.path === file.path
            )
        );

        let successCount = 0;

        if (allStarred) {
            // 모두 즐겨찾기되어 있으면 제거
            for (const file of selectedFiles) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existingBookmark = bookmarkPlugin.items?.find((item: any) =>
                    item.type === 'file' && item.path === file.path
                );
                if (existingBookmark) {
                    bookmarkPlugin.removeItem(existingBookmark);
                    successCount++;
                }
            }
            new Notice(t().selection.filesUnstarred(successCount));
        } else {
            // 하나라도 즐겨찾기되지 않았으면 모두 추가
            for (const file of selectedFiles) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existingBookmark = bookmarkPlugin.items?.find((item: any) =>
                    item.type === 'file' && item.path === file.path
                );
                if (!existingBookmark) {
                    bookmarkPlugin.addItem({
                        type: 'file',
                        path: file.path,
                        title: file.basename
                    });
                    successCount++;
                }
            }
            new Notice(t().selection.filesStarred(successCount));
        }

        this.clearSelection();
    }

    /**
     * 선택된 파일 목록을 반환합니다
     *
     * @returns 선택된 파일들의 배열
     */
    getSelectedFiles(): TFile[] {
        return Array.from(this.selected);
    }

    /**
     * 파일이 선택되었는지 확인합니다
     * 
     * @param file - 확인할 파일
     * @returns 선택 여부
     */
    isSelected(file: TFile): boolean {
        return this.selected.has(file);
    }

    /**
     * 선택된 파일 수를 반환합니다
     *
     * @returns 선택된 파일의 개수
     */
    getSelectionCount(): number {
        return this.selected.size;
    }

    /**
     * 카드 요소 캐시를 빌드합니다
     *
     * @remarks
     * ⭐ Section 8.3: 카드 렌더링 후 캐시 구축
     * - ViewRenderer에서 카드를 렌더링한 후 호출
     * - 모든 카드 요소를 한 번에 캐싱
     */
    buildCardCache(): void {
        this.cardElementCache.clear();

        const cards = document.querySelectorAll('.card-item');
        cards.forEach(card => {
            const cardEl = card as HTMLElement;
            const filePath = cardEl.dataset.filePath;
            if (filePath) {
                this.cardElementCache.set(filePath, cardEl);
            }
        });
    }
}

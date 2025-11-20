import { App, Notice, TFile } from 'obsidian';
import { DebugLogger } from '../utils/DebugLogger';
import { CardNavigatorSettings } from '../types';
import { TextInputModal } from '../ui/modals/TextInputModal';
import { FolderSuggestModal } from '../ui/FolderSuggestModal';

/**
 * 다중 선택 및 일괄 작업 관리자
 * 
 * 파일 카드의 다중 선택과 선택된 파일들에 대한 일괄 작업을 제공합니다.
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

    constructor(app: App, getSettings: () => CardNavigatorSettings) {
        this.app = app;
        this.selected = new Set();
        this.allFiles = [];
        this.lastSelectedIndex = -1;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(getSettings);
    }

    /**
     * 범위 선택을 위한 전체 파일 목록을 설정합니다
     * 
     * @param files - 표시되는 모든 파일의 배열
     */
    setAllFiles(files: TFile[]): void {
        this.allFiles = files;
    }

    /**
     * 파일의 선택 상태를 토글합니다
     * 
     * @param file - 선택/해제할 파일
     * @param event - 마우스 이벤트 (Ctrl, Shift 키 감지용)
     * 
     * ⭐ 버그 수정 (2024-11-20):
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
        new Notice(`${this.selected.size}개 파일 선택됨`);
    }

    /**
     * 모든 선택을 해제합니다
     * 
     * ⭐ 버그 수정 (2024-11-20):
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
     */
    public updateUI(): void {
        document.querySelectorAll('.card-item').forEach(card => {
            card.removeClass('selected');
        });

        this.selected.forEach(file => {
            const cardEl = this.findCardElement(file);
            if (cardEl) {
                cardEl.addClass('selected');
            }
        });

        this.updateSelectionInfo();
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
     * 선택 정보 표시를 업데이트합니다
     */
    private updateSelectionInfo(): void {
        const existingBar = document.querySelector('.selection-bar');
        existingBar?.remove();

        if (this.selected.size > 0) {
            const container = document.querySelector('.card-navigator-container');
            if (container) {
                const selectionBar = container.createDiv('selection-bar');
                
                selectionBar.createEl('span', {
                    text: `선택됨: ${this.selected.size}개 파일`,
                    cls: 'selection-count'
                });

                this.createBatchActionButtons(selectionBar);
            }
        }
    }

    /**
     * 일괄 작업 버튼들을 생성합니다
     * 
     * ⭐ 버그 수정 (2024-11-20):
     * native prompt 대신 Obsidian Modal 사용
     */
    private createBatchActionButtons(container: HTMLElement): void {
        const buttonContainer = container.createDiv({ cls: 'batch-actions'});

        const addTagBtn = buttonContainer.createEl('button', {
            text: '태그 추가',
            cls: 'batch-action-btn'
        });
        addTagBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', '태그 추가 버튼 클릭됨');
            this.batchAddTag();
        });

        const moveBtn = buttonContainer.createEl('button', {
            text: '이동',
            cls: 'batch-action-btn'
        });
        moveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', '이동 버튼 클릭됨');
            this.batchMove();
        });

        const deleteBtn = buttonContainer.createEl('button', {
            text: '삭제',
            cls: 'batch-action-btn batch-action-danger'
        });
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', '삭제 버튼 클릭됨');
            this.batchDelete();
        });

        const clearBtn = buttonContainer.createEl('button', {
            text: '선택 해제',
            cls: 'batch-action-btn'
        });
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.logger.debug('Selection', '선택 해제 버튼 클릭됨');
            this.clearSelection();
        });
    }

    /**
     * 선택된 모든 파일에 태그를 일괄 추가합니다
     * 
     * ⭐ 버그 수정 (2024-11-20):
     * native prompt 대신 TextInputModal 사용
     */
    private async batchAddTag(): Promise<void> {
        this.logger.debug('Selection', 'batchAddTag 호출됨', {
            selectedCount: this.selected.size
        });

        const modal = new TextInputModal(
            this.app,
            '태그 추가',
            '추가할 태그를 입력하세요 (# 없이)',
            '',
            async (tag) => {
                this.logger.debug('Selection', '태그 입력됨', { tag });
                
                const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                let successCount = 0;

                for (const file of this.selected) {
                    try {
                        await this.addTagToFile(file, cleanTag);
                        successCount++;
                    } catch (error) {
                        this.logger.error('Selection', `태그 추가 실패: ${file.path}`, error);
                    }
                }

                new Notice(`${successCount}개 파일에 #${cleanTag} 태그 추가됨`);
                this.clearSelection();
            }
        );
        
        modal.open();
    }

    /**
     * 파일의 프론트매터에 태그를 추가합니다
     * 
     * ⭐ 버그 수정 (2024-11-20):
     * Obsidian의 processFrontMatter API를 사용하여 안전하게 태그 추가
     * 다양한 YAML 형식을 잘못 처리하던 기존 문제 해결
     * 
     * @param file - 태그를 추가할 파일
     * @param tag - 추가할 태그 (경로 형태 가능: folder/subfolder/tag)
     */
    private async addTagToFile(file: TFile, tag: string): Promise<void> {
        this.logger.debug('Selection', `태그 추가 시작: ${file.path}`, { tag });

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
                this.logger.debug('Selection', `태그 추가 성공: ${normalizedTag}`);
            } else {
                this.logger.debug('Selection', `태그 이미 존재: ${normalizedTag}`);
            }
        });
    }

    /**
     * 선택된 모든 파일을 일괄 이동합니다
     * 
     * ⭐ 버그 수정 (2024-11-20):
     * native prompt 대신 FolderSuggestModal 사용
     */
    private async batchMove(): Promise<void> {
        this.logger.debug('Selection', 'batchMove 호출됨', {
            selectedCount: this.selected.size
        });

        const modal = new FolderSuggestModal(
            this.app,
            async (folder) => {
                if (!folder) {
                    this.logger.debug('Selection', '폴더 선택 취소됨');
                    return;
                }

                this.logger.debug('Selection', '폴더 선택됨', { folderPath: folder.path });
                
                let successCount = 0;
                const folderPath = folder.path === '/' ? '' : folder.path;

                for (const file of this.selected) {
                    try {
                        const newPath = folderPath ? `${folderPath}/${file.name}` : file.name;
                        await this.app.fileManager.renameFile(file, newPath);
                        successCount++;
                    } catch (error) {
                        this.logger.error('Selection', `파일 이동 실패: ${file.path}`, error);
                    }
                }

                const displayPath = folder.path === '/' ? '루트' : folder.path;
                new Notice(`${successCount}개 파일이 ${displayPath}로 이동됨`);
                this.clearSelection();
            }
        );
        
        modal.open();
    }

    /**
     * 선택된 모든 파일을 일괄 삭제합니다
     */
    private async batchDelete(): Promise<void> {
        const confirmed = confirm(
            `${this.selected.size}개 파일을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
        );
        if (!confirmed) return;

        let successCount = 0;

        for (const file of this.selected) {
            try {
                await this.app.vault.delete(file);
                successCount++;
            } catch (error) {
                this.logger.error('Selection', `파일 삭제 실패: ${file.path}`, error);
            }
        }

        new Notice(`${successCount}개 파일 삭제됨`);
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
}

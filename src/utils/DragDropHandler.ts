import { App, TFile, MarkdownView } from 'obsidian';
import { DebugLogger } from './DebugLogger';
import { CardNavigatorSettings, DragDropFullContentOptions } from '../types';

/**
 * 드래그 상태 인터페이스
 * 
 * 드래그 진행 여부를 확인할 수 있는 인터페이스입니다.
 */
interface DragState {
    isDragging(): boolean;
}

/**
 * 드래그앤드롭 핸들러
 * 
 * 카드를 드래그하여 편집기에 링크를 삽입하거나,
 * 다른 카드로 드래그하여 양방향 링크를 생성할 수 있습니다.
 */
export class DragDropHandler {
    private app: App;
    private logger: DebugLogger;
    private getSettings: () => CardNavigatorSettings;
    // 드래그 시 사용할 파일 내용을 캠싱
    private cachedDragContent: Map<string, string> = new Map();

    constructor(app: App, getSettings?: () => CardNavigatorSettings) {
        this.app = app;
        // ✅ 함수를 저장하여 항상 최신 settings를 참조
        this.getSettings = getSettings || (() => ({ debug: { enabled: false, categories: {} } } as CardNavigatorSettings));
        this.logger = new DebugLogger(this.getSettings);
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
                // 파일 내용을 미리 로드하여 캠싱
                const content = await this.getFileContentForDrag(file, settings.dragDrop.fullContentOptions);
                this.cachedDragContent.set(file.path, content);
                this.logger.debug('DragDrop', '파일 내용 캠싱 완료', { 
                    file: file.basename,
                    length: content.length 
                });
            }
        });

        cardEl.addEventListener('dragstart', (e: DragEvent) => {
            if (!e.dataTransfer) return;

            dragging = true;
            
            if (dragEndTimeout) {
                clearTimeout(dragEndTimeout);
                dragEndTimeout = null;
            }

            this.logger.debug('DragDrop', '드래그 시작', { file: file.basename });

            // 설정에 따라 드래그 데이터 결정
            const settings = this.getSettings();
            let dragContent: string;

            if (settings.dragDrop.contentType === 'link') {
                // 링크 형식
                dragContent = `[[${file.basename}]]`;
                this.logger.debug('DragDrop', '드래그 내용: 링크', { content: dragContent });
            } else {
                // 파일 전체 내용 (캠싱된 내용 사용)
                dragContent = this.cachedDragContent.get(file.path) || `[[${file.basename}]]`;
                this.logger.debug('DragDrop', '드래그 내용: 파일 내용', { 
                    length: dragContent.length,
                    cached: this.cachedDragContent.has(file.path)
                });
                // 사용 후 캠시 삭제
                this.cachedDragContent.delete(file.path);
            }

            e.dataTransfer.setData('text/plain', dragContent);
            e.dataTransfer.setData('file-path', file.path);
            e.dataTransfer.effectAllowed = 'copyLink';
            
            cardEl.addClass('dragging');
        });

        cardEl.addEventListener('dragend', () => {
            cardEl.removeClass('dragging');
            
            dragEndTimeout = setTimeout(() => {
                dragging = false;
                dragEndTimeout = null;
                this.logger.debug('DragDrop', '드래그 종료 (지연 100ms)');
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

            const draggedFilePath = e.dataTransfer.getData('file-path');
            if (!draggedFilePath || draggedFilePath === targetFile.path) return;

            const draggedFile = this.app.vault.getAbstractFileByPath(draggedFilePath);
            if (!(draggedFile instanceof TFile)) return;

            this.logger.debug('DragDrop', '카드 간 드롭', {
                from: draggedFile.basename,
                to: targetFile.basename
            });

            await this.createBidirectionalLink(draggedFile, targetFile);
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

            this.logger.debug('DragDrop', '양방향 링크 생성', {
                source: sourceFile.basename,
                target: targetFile.basename
            });
        } catch (error) {
            this.logger.error('DragDrop', '양방향 링크 생성 실패', error);
        }
    }

    /**
     * 편집기 드롭 존 설정
     * 
     * Obsidian이 기본적으로 편집기 드래그앤드롭을 지원하므로
     * 현재는 추가 설정이 필요하지 않습니다.
     */
    setupEditorDropZone(): void {
        this.logger.debug('DragDrop', '편집기 드롭 존 설정됨');
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
            this.logger.error('DragDrop', '파일 내용 복사 실패', error);
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
            this.logger.error('DragDrop', '파일 내용 가져오기 실패', error);
            return '';
        }
    }
}

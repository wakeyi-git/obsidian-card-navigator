import { App, TFile, Notice } from 'obsidian';
import { DebugLogger } from '../utils/DebugLogger';
import { CardNavigatorSettings } from '../types';
import { t } from '../i18n';

/**
 * 인라인 편집기
 * 
 * 카드의 헤더/바디/풋터를 더블클릭하여:
 * 1. 인라인 편집 모드 진입
 * 2. Enter: 저장
 * 3. Escape: 취소
 */
export class InlineEditor {
    private app: App;
    private activeEditor: HTMLTextAreaElement | null = null;
    private originalElement: HTMLElement | null = null;
    private logger: DebugLogger;

    constructor(app: App, getSettings: () => CardNavigatorSettings) {
        this.app = app;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(getSettings);
    }

    /**
     * 카드의 섹션들을 편집 가능하게 설정
     * @param cardEl - 카드 HTML 요소
     * @param file - 연결된 파일
     */
    enable(cardEl: HTMLElement, file: TFile): void {
        const sections = ['header', 'body', 'footer'];

        sections.forEach(sectionType => {
            const el = cardEl.querySelector(`.card-${sectionType}`) as HTMLElement;
            if (!el) return;

            // 더블클릭 이벤트
            el.addEventListener('dblclick', (e: MouseEvent) => {
                e.stopPropagation();
                this.startEditing(el, file, sectionType);
            });

            // 편집 가능 표시 (호버 시)
            el.style.cursor = 'text';
            el.title = t().inlineEditor.doubleClickToEdit;
        });
    }

    /**
     * 편집 모드 시작
     * @param el - 편집할 HTML 요소
     * @param file - 대상 파일
     * @param section - 섹션 타입 (header/body/footer)
     */
    private async startEditing(el: HTMLElement, file: TFile, section: string): Promise<void> {
        // 이미 편집 중이면 중단
        if (this.activeEditor) return;

        const originalText = el.textContent || '';
        this.originalElement = el;

        // 텍스트 영역 생성
        const textarea = document.createElement('textarea');
        textarea.value = originalText;
        textarea.className = 'card-inline-editor';
        
        // 스타일 복사
        const computedStyle = window.getComputedStyle(el);
        textarea.style.width = el.offsetWidth + 'px';
        textarea.style.minHeight = el.offsetHeight + 'px';
        textarea.style.fontSize = computedStyle.fontSize;
        textarea.style.fontFamily = computedStyle.fontFamily;
        textarea.style.padding = computedStyle.padding;
        textarea.style.border = '2px solid var(--interactive-accent)';
        textarea.style.borderRadius = '4px';
        textarea.style.background = 'var(--background-secondary)';
        textarea.style.color = 'var(--text-normal)';
        textarea.style.resize = 'vertical';

        // 요소 교체
        el.style.display = 'none';
        el.parentElement?.insertBefore(textarea, el);
        
        this.activeEditor = textarea;
        textarea.focus();
        textarea.select();

        // 키보드 이벤트
        textarea.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                await this.save(file, section, textarea.value);
                this.endEditing(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.endEditing(false);
            }
        });

        // 포커스 잃을 때 저장
        textarea.addEventListener('blur', async () => {
            // 약간의 지연을 두어 다른 이벤트 처리
            setTimeout(async () => {
                if (this.activeEditor === textarea) {
                    await this.save(file, section, textarea.value);
                    this.endEditing(true);
                }
            }, 200);
        });
    }

    /**
     * 편집 내용 저장
     * @param file - 대상 파일
     * @param section - 섹션 타입
     * @param newValue - 새 값
     */
    private async save(file: TFile, section: string, newValue: string): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            let newContent = content;

            // 섹션별로 다른 저장 로직
            switch (section) {
                case 'header':
                    // 첫 번째 헤더를 변경
                    newContent = this.updateFirstHeader(content, newValue);
                    break;
                
                case 'body':
                    // 본문 전체를 변경 (위험할 수 있으므로 주의)
                    // 실제로는 첫 문단만 변경하는 것이 더 안전
                    newContent = this.updateFirstParagraph(content, newValue);
                    break;
                
                case 'footer':
                    // 태그나 메타데이터 변경
                    newContent = this.updateFooter(content, newValue);
                    break;
            }

            // 내용이 변경되었으면 저장
            if (newContent !== content) {
                await this.app.vault.modify(file, newContent);
                new Notice(t().inlineEditor.sectionSaved(section));
            }
        } catch (error) {
            this.logger.error('Card', 'Save failed', error);
            new Notice(t().notices.inlineEditor.saveFailed);
        }
    }

    /**
     * 첫 번째 헤더 업데이트
     * @param content - 원본 내용
     * @param newHeader - 새 헤더
     */
    private updateFirstHeader(content: string, newHeader: string): string {
        const lines = content.split('\n');
        const headerIndex = lines.findIndex(line => line.match(/^#+\s/));
        
        if (headerIndex !== -1) {
            // 기존 헤더 레벨 유지
            const level = lines[headerIndex].match(/^#+/)?.[0] || '#';
            lines[headerIndex] = `${level} ${newHeader}`;
        } else {
            // 헤더가 없으면 맨 앞에 추가
            lines.unshift(`# ${newHeader}`);
        }
        
        return lines.join('\n');
    }

    /**
     * 첫 문단 업데이트
     * @param content - 원본 내용
     * @param newParagraph - 새 문단
     */
    private updateFirstParagraph(content: string, newParagraph: string): string {
        const lines = content.split('\n');
        
        // 첫 번째 헤더 이후부터 찾기
        let startIndex = 0;
        let endIndex = 0;
        let foundStart = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 헤더를 지나침
            if (line.match(/^#+\s/) && !foundStart) {
                continue;
            }
            
            // 첫 번째 내용 시작
            if (!foundStart && line !== '' && !line.match(/^#+\s/)) {
                startIndex = i;
                foundStart = true;
            }
            
            // 빈 줄이 나오면 문단 끝
            if (foundStart && line === '') {
                endIndex = i;
                break;
            }
        }

        if (foundStart) {
            // 문단 교체
            lines.splice(startIndex, endIndex - startIndex, newParagraph);
        } else {
            // 문단이 없으면 헤더 다음에 추가
            const headerIndex = lines.findIndex(line => line.match(/^#+\s/));
            lines.splice(headerIndex + 1, 0, '', newParagraph);
        }

        return lines.join('\n');
    }

    /**
     * 풋터 (태그) 업데이트
     * @param content - 원본 내용
     * @param newFooter - 새 풋터
     */
    private updateFooter(content: string, newFooter: string): string {
        // 마지막에 태그 추가/변경
        // 간단히 맨 뒤에 추가
        return content + '\n\n' + newFooter;
    }

    /**
     * 편집 모드 종료
     * @param saved - 저장 여부
     */
    private endEditing(saved: boolean): void {
        if (!this.activeEditor || !this.originalElement) return;

        // 원래 요소 복원
        this.originalElement.style.display = '';
        this.activeEditor.remove();

        this.activeEditor = null;
        this.originalElement = null;

        if (!saved) {
            new Notice(t().notices.inlineEditor.editCancelled);
        }
    }

    /**
     * 현재 편집 중인지 확인
     */
    isEditing(): boolean {
        return this.activeEditor !== null;
    }

    /**
     * 강제로 편집 종료
     */
    cancelEditing(): void {
        if (this.activeEditor) {
            this.endEditing(false);
        }
    }
}

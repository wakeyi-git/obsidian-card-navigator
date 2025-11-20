import { App, Modal, Setting } from 'obsidian';
import { t } from '../../i18n';

/**
 * 사용자 텍스트 입력을 위한 모달
 * 
 * 사용자에게 텍스트 입력을 요청하는 간단한 모달 대화상자입니다.
 * 입력 검증을 지원하며, 키보드 단축키(Enter로 제출, Escape로 취소)를 제공하고
 * 한국어, 일본어, 중국어와 같은 언어의 IME 입력을 올바르게 처리합니다.
 * 
 * @example
 * ```typescript
 * const modal = new TextInputModal(
 *     this.app,
 *     'Preset Name',
 *     'Enter preset name',
 *     '',
 *     (result) => {
 *         console.log('User input:', result);
 *     }
 * );
 * modal.open();
 * ```
 */
export class TextInputModal extends Modal {
    private result: string;
    private onSubmit: (result: string) => void;
    private title: string;
    private placeholder: string;
    private defaultValue: string;

    /**
     * 새 텍스트 입력 모달을 생성합니다
     * 
     * @param app - Obsidian 애플리케이션 인스턴스
     * @param title - 모달 상단에 표시될 제목
     * @param placeholder - 입력 필드의 플레이스홀더 텍스트
     * @param defaultValue - 입력 필드의 기본값 (선택사항)
     * @param onSubmit - 사용자가 유효한 입력을 제출할 때 호출되는 콜백 함수
     */
    constructor(
        app: App,
        title: string,
        placeholder: string,
        defaultValue: string = '',
        onSubmit: (result: string) => void
    ) {
        super(app);
        this.title = title;
        this.placeholder = placeholder;
        this.defaultValue = defaultValue;
        this.result = defaultValue;
        this.onSubmit = onSubmit;
    }

    /**
     * 모달이 열릴 때 호출됩니다
     * 
     * 제목, 입력 필드, 동작 버튼으로 모달 UI를 구성합니다.
     * 키보드 단축키와 자동 포커스 동작을 설정합니다.
     */
    onOpen() {
        const { contentEl } = this;

        // 모달 제목
        contentEl.createEl('h2', { text: this.title });

        // 키보드 처리가 포함된 입력 필드
        new Setting(contentEl)
            .setName(t().modals.textInput.inputLabel)
            .addText(text => text
                .setPlaceholder(this.placeholder)
                .setValue(this.defaultValue)
                .onChange(value => {
                    this.result = value;
                })
                .inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    // IME 조합 중 Enter 키 무시 (한글, 일본어, 중국어 등)
                    // 이는 불완전한 문자가 제출되는 것을 방지합니다
                    if (e.isComposing) {
                        return;
                    }
                    
                    // Enter로 제출
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.submit();
                    }
                    
                    // Escape로 닫기
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        this.close();
                    }
                })
            );

        // 동작 버튼
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(t().modals.textInput.cancel)
                .onClick(() => {
                    this.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().modals.textInput.confirm)
                .setCta()
                .onClick(() => {
                    this.submit();
                })
            );

        // 입력 필드 자동 포커스 및 선택
        setTimeout(() => {
            const input = contentEl.querySelector('input');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    /**
     * 모달이 닫힐 때 호출됩니다
     * 
     * 모달 콘텐츠 요소를 정리합니다.
     */
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * 입력값을 제출하고 모달을 닫습니다
     * 
     * 공백이 제거된 입력값이 비어있지 않을 때만 제출합니다.
     * 공백이 제거된 결과와 함께 onSubmit 콜백을 호출합니다.
     */
    private submit() {
        if (this.result && this.result.trim()) {
            this.onSubmit(this.result.trim());
            this.close();
        }
    }
}

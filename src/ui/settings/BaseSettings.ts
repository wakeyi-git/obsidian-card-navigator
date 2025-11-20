import { Setting } from 'obsidian';
import CardNavigatorPlugin from '../../main';

/**
 * BaseSettings
 * 
 * 모든 설정 섹션의 베이스 클래스
 * 공통 유틸리티 메서드 제공
 */
export abstract class BaseSettings {
    protected plugin: CardNavigatorPlugin;

    constructor(plugin: CardNavigatorPlugin) {
        this.plugin = plugin;
    }

    /**
     * 설정 섹션을 렌더링합니다
     * 
     * @param containerEl - 컨테이너 요소
     */
    abstract render(containerEl: HTMLElement): void;

    /**
     * CSS 변수나 색상값에서 실제 색상값을 추출합니다
     * 
     * ColorComponent는 CSS 변수를 처리할 수 없으므로,
     * var(--) 형식이 아닌 경우에만 색상값을 반환합니다.
     * 
     * @param colorValue - CSS 변수 또는 색상값
     * @returns 실제 색상값 (HEX 형식) 또는 기본 회색
     */
    protected extractColorValue(colorValue: string): string {
        // CSS 변수인 경우 기본 회색 반환
        if (colorValue.startsWith('var(')) {
            return '#808080';
        }
        // 그대로 반환
        return colorValue;
    }

    /**
     * 설정 헤더를 생성합니다
     *
     * Obsidian 공식 문서에 따라 setHeading()을 사용하여 헤더를 생성합니다.
     * 참고: https://docs.obsidian.md/Plugins/User+interface/Settings
     *
     * @param containerEl - 컨테이너 요소
     * @param title - 헤더 제목
     * @param description - 헤더 설명 (선택사항)
     */
    protected createHeader(
        containerEl: HTMLElement,
        title: string,
        description?: string
    ): void {
        new Setting(containerEl)
            .setName(title)
            .setHeading();

        // 설명이 있으면 별도의 설명 요소로 추가
        if (description) {
            containerEl.createEl('div', {
                text: description,
                cls: 'setting-item-description'
            });
        }
    }

    /**
     * 섹션 구분선을 생성합니다
     * 
     * @param containerEl - 컨테이너 요소
     * @param text - 구분선 텍스트
     */
    protected createDivider(containerEl: HTMLElement, text: string): void {
        containerEl.createEl('div', { cls: 'setting-item-heading' })
            .createEl('div', { text });
    }
}

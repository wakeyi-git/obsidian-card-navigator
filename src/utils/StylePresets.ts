import { CardStyleSettings, CardSettings } from '../types';
import { StyleUtils } from './StyleUtils';

/**
 * ⭐ 스타일 프리셋 캐시 (Phase 2 최적화)
 *
 * CSS 커스텀 속성 문자열을 사전 계산하고 캐싱하여 성능을 향상시킵니다.
 *
 * @remarks
 * - 개별 setProperty() 호출 대신 cssText 사용
 * - 동일한 설정에 대해 반복 계산 방지
 * - 메모리와 CPU 시간 절약
 */
export class StylePresets {
    /** 카드 스타일 캐시 (설정 해시 → CSS 문자열) */
    private static cardStyleCache = new Map<string, string>();

    /** 섹션 스타일 캐시 (설정 해시 → CSS 문자열) */
    private static sectionStyleCache = new Map<string, string>();

    /**
     * 캐시를 초기화합니다
     */
    static clearCache(): void {
        this.cardStyleCache.clear();
        this.sectionStyleCache.clear();
    }

    /**
     * 설정 객체의 해시를 생성합니다
     */
    private static hashSettings(settings: any): string {
        return JSON.stringify(settings);
    }

    /**
     * ⭐ 카드 스타일 CSS 문자열을 생성하고 캐싱합니다
     *
     * @param normalStyle - Normal 상태 스타일
     * @param activeStyle - Active 상태 스타일
     * @param focusedStyle - Focused 상태 스타일
     * @returns CSS 커스텀 속성 문자열
     */
    static getCardStyleString(
        normalStyle: CardStyleSettings,
        activeStyle: CardStyleSettings,
        focusedStyle: CardStyleSettings
    ): string {
        const cacheKey = this.hashSettings({ normalStyle, activeStyle, focusedStyle });

        if (this.cardStyleCache.has(cacheKey)) {
            return this.cardStyleCache.get(cacheKey)!;
        }

        const styles: string[] = [];

        // Normal state - 항상 모든 속성 설정
        styles.push(`--card-bg-normal: ${normalStyle.backgroundColor}`);
        styles.push(`--card-font-size-normal: ${normalStyle.fontSize}px`);
        styles.push(`--card-text-color-normal: ${StyleUtils.getContrastColor(normalStyle.backgroundColor)}`);
        styles.push(`--card-navigator-border-color-normal: ${normalStyle.borderColor}`);
        styles.push(`--card-navigator-border-width-normal: ${normalStyle.borderWidth}px`);
        styles.push(`--card-navigator-border-radius-normal: ${normalStyle.borderRadius}px`);

        // Active state - 상속 모드가 아닐 때만 설정
        if (!activeStyle.inheritFromNormal) {
            styles.push(`--card-bg-active: ${activeStyle.backgroundColor}`);
            styles.push(`--card-font-size-active: ${activeStyle.fontSize}px`);
            styles.push(`--card-text-color-active: ${StyleUtils.getContrastColor(activeStyle.backgroundColor)}`);
            styles.push(`--card-navigator-border-color-active: ${activeStyle.borderColor}`);
            styles.push(`--card-navigator-border-width-active: ${activeStyle.borderWidth}px`);
            styles.push(`--card-navigator-border-radius-active: ${activeStyle.borderRadius}px`);
        }

        // Focused state - 상속 모드가 아닐 때만 설정
        if (!focusedStyle.inheritFromNormal) {
            styles.push(`--card-bg-focused: ${focusedStyle.backgroundColor}`);
            styles.push(`--card-font-size-focused: ${focusedStyle.fontSize}px`);
            styles.push(`--card-text-color-focused: ${StyleUtils.getContrastColor(focusedStyle.backgroundColor)}`);
            styles.push(`--card-navigator-border-color-focused: ${focusedStyle.borderColor}`);
            styles.push(`--card-navigator-border-width-focused: ${focusedStyle.borderWidth}px`);
            styles.push(`--card-navigator-border-radius-focused: ${focusedStyle.borderRadius}px`);
        }

        const cssText = styles.join('; ');
        this.cardStyleCache.set(cacheKey, cssText);
        return cssText;
    }

    /**
     * ⭐ 섹션 스타일 CSS 문자열을 생성하고 캐싱합니다
     *
     * @param cardSettings - 카드 설정
     * @returns CSS 커스텀 속성 문자열
     */
    static getSectionStyleString(cardSettings: CardSettings): string {
        const cacheKey = this.hashSettings({
            header: cardSettings.header,
            body: cardSettings.body,
            footer: cardSettings.footer
        });

        if (this.sectionStyleCache.has(cacheKey)) {
            return this.sectionStyleCache.get(cacheKey)!;
        }

        const styles: string[] = [];

        // Header styles
        if (cardSettings.header) {
            const { normalStyle, activeStyle, focusedStyle } = cardSettings.header;

            // Normal
            styles.push(`--card-header-bg-normal: ${normalStyle.backgroundColor}`);
            styles.push(`--card-header-font-size-normal: ${normalStyle.fontSize}px`);
            styles.push(`--card-header-text-color-normal: ${StyleUtils.getContrastColor(normalStyle.backgroundColor)}`);
            styles.push(`--card-header-border-color-normal: ${normalStyle.borderColor}`);
            styles.push(`--card-header-border-width-normal: ${normalStyle.borderWidth}px`);
            styles.push(`--card-header-border-radius-normal: ${normalStyle.borderRadius}px`);

            // Active
            if (!activeStyle.inheritFromNormal) {
                styles.push(`--card-header-bg-active: ${activeStyle.backgroundColor}`);
                styles.push(`--card-header-font-size-active: ${activeStyle.fontSize}px`);
                styles.push(`--card-header-text-color-active: ${StyleUtils.getContrastColor(activeStyle.backgroundColor)}`);
                styles.push(`--card-header-border-color-active: ${activeStyle.borderColor}`);
                styles.push(`--card-header-border-width-active: ${activeStyle.borderWidth}px`);
                styles.push(`--card-header-border-radius-active: ${activeStyle.borderRadius}px`);
            }

            // Focused
            if (!focusedStyle.inheritFromNormal) {
                styles.push(`--card-header-bg-focused: ${focusedStyle.backgroundColor}`);
                styles.push(`--card-header-font-size-focused: ${focusedStyle.fontSize}px`);
                styles.push(`--card-header-text-color-focused: ${StyleUtils.getContrastColor(focusedStyle.backgroundColor)}`);
                styles.push(`--card-header-border-color-focused: ${focusedStyle.borderColor}`);
                styles.push(`--card-header-border-width-focused: ${focusedStyle.borderWidth}px`);
                styles.push(`--card-header-border-radius-focused: ${focusedStyle.borderRadius}px`);
            }
        }

        // Body styles
        if (cardSettings.body) {
            const { normalStyle, activeStyle, focusedStyle } = cardSettings.body;

            // Normal
            styles.push(`--card-body-bg-normal: ${normalStyle.backgroundColor}`);
            styles.push(`--card-body-font-size-normal: ${normalStyle.fontSize}px`);
            styles.push(`--card-body-text-color-normal: ${StyleUtils.getContrastColor(normalStyle.backgroundColor)}`);
            styles.push(`--card-body-border-color-normal: ${normalStyle.borderColor}`);
            styles.push(`--card-body-border-width-normal: ${normalStyle.borderWidth}px`);
            styles.push(`--card-body-border-radius-normal: ${normalStyle.borderRadius}px`);

            // Active
            if (!activeStyle.inheritFromNormal) {
                styles.push(`--card-body-bg-active: ${activeStyle.backgroundColor}`);
                styles.push(`--card-body-font-size-active: ${activeStyle.fontSize}px`);
                styles.push(`--card-body-text-color-active: ${StyleUtils.getContrastColor(activeStyle.backgroundColor)}`);
                styles.push(`--card-body-border-color-active: ${activeStyle.borderColor}`);
                styles.push(`--card-body-border-width-active: ${activeStyle.borderWidth}px`);
                styles.push(`--card-body-border-radius-active: ${activeStyle.borderRadius}px`);
            }

            // Focused
            if (!focusedStyle.inheritFromNormal) {
                styles.push(`--card-body-bg-focused: ${focusedStyle.backgroundColor}`);
                styles.push(`--card-body-font-size-focused: ${focusedStyle.fontSize}px`);
                styles.push(`--card-body-text-color-focused: ${StyleUtils.getContrastColor(focusedStyle.backgroundColor)}`);
                styles.push(`--card-body-border-color-focused: ${focusedStyle.borderColor}`);
                styles.push(`--card-body-border-width-focused: ${focusedStyle.borderWidth}px`);
                styles.push(`--card-body-border-radius-focused: ${focusedStyle.borderRadius}px`);
            }
        }

        // Footer styles
        if (cardSettings.footer) {
            const { normalStyle, activeStyle, focusedStyle } = cardSettings.footer;

            // Normal
            styles.push(`--card-footer-bg-normal: ${normalStyle.backgroundColor}`);
            styles.push(`--card-footer-font-size-normal: ${normalStyle.fontSize}px`);
            styles.push(`--card-footer-text-color-normal: ${StyleUtils.getContrastColor(normalStyle.backgroundColor)}`);
            styles.push(`--card-footer-border-color-normal: ${normalStyle.borderColor}`);
            styles.push(`--card-footer-border-width-normal: ${normalStyle.borderWidth}px`);
            styles.push(`--card-footer-border-radius-normal: ${normalStyle.borderRadius}px`);

            // Active
            if (!activeStyle.inheritFromNormal) {
                styles.push(`--card-footer-bg-active: ${activeStyle.backgroundColor}`);
                styles.push(`--card-footer-font-size-active: ${activeStyle.fontSize}px`);
                styles.push(`--card-footer-text-color-active: ${StyleUtils.getContrastColor(activeStyle.backgroundColor)}`);
                styles.push(`--card-footer-border-color-active: ${activeStyle.borderColor}`);
                styles.push(`--card-footer-border-width-active: ${activeStyle.borderWidth}px`);
                styles.push(`--card-footer-border-radius-active: ${activeStyle.borderRadius}px`);
            }

            // Focused
            if (!focusedStyle.inheritFromNormal) {
                styles.push(`--card-footer-bg-focused: ${focusedStyle.backgroundColor}`);
                styles.push(`--card-footer-font-size-focused: ${focusedStyle.fontSize}px`);
                styles.push(`--card-footer-text-color-focused: ${StyleUtils.getContrastColor(focusedStyle.backgroundColor)}`);
                styles.push(`--card-footer-border-color-focused: ${focusedStyle.borderColor}`);
                styles.push(`--card-footer-border-width-focused: ${focusedStyle.borderWidth}px`);
                styles.push(`--card-footer-border-radius-focused: ${focusedStyle.borderRadius}px`);
            }
        }

        const cssText = styles.join('; ');
        this.sectionStyleCache.set(cacheKey, cssText);
        return cssText;
    }

    /**
     * ⭐ 카드에 스타일을 빠르게 적용합니다 (최적화된 버전)
     *
     * @param card - 카드 요소
     * @param cardSettings - 카드 설정
     *
     * @remarks
     * 개별 setProperty() 호출 대신 미리 계산된 cssText를 사용합니다.
     */
    static applyCardStyles(
        card: HTMLElement,
        cardSettings: CardSettings
    ): void {
        const cardStyles = this.getCardStyleString(
            cardSettings.normalCardStyle,
            cardSettings.activeCardStyle,
            cardSettings.focusedCardStyle
        );

        const sectionStyles = this.getSectionStyleString(cardSettings);

        // ⭐ cssText 사용: 한 번에 모든 스타일 적용 (리플로우 1회)
        const existingStyles = card.style.cssText;
        card.style.cssText = existingStyles + '; ' + cardStyles + '; ' + sectionStyles;
    }

    /**
     * 캐시 통계를 반환합니다 (디버깅용)
     */
    static getCacheStats(): {
        cardStyleCacheSize: number;
        sectionStyleCacheSize: number;
    } {
        return {
            cardStyleCacheSize: this.cardStyleCache.size,
            sectionStyleCacheSize: this.sectionStyleCache.size
        };
    }
}

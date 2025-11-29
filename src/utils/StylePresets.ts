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
    private static hashSettings(settings: Record<string, unknown>): string {
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
     *
     * @remarks
     * cardStyle 카테고리가 비활성화되면 headerStyle/bodyStyle/footerStyle이 undefined가 됩니다.
     * 이 경우 해당 섹션의 CSS 변수를 생성하지 않습니다.
     */
    static getSectionStyleString(cardSettings: CardSettings): string {
        const cacheKey = this.hashSettings({
            headerStyle: cardSettings.headerStyle,
            headerActiveStyle: cardSettings.headerActiveStyle,
            headerFocusedStyle: cardSettings.headerFocusedStyle,
            bodyStyle: cardSettings.bodyStyle,
            bodyActiveStyle: cardSettings.bodyActiveStyle,
            bodyFocusedStyle: cardSettings.bodyFocusedStyle,
            footerStyle: cardSettings.footerStyle,
            footerActiveStyle: cardSettings.footerActiveStyle,
            footerFocusedStyle: cardSettings.footerFocusedStyle
        });

        if (this.sectionStyleCache.has(cacheKey)) {
            return this.sectionStyleCache.get(cacheKey)!;
        }

        const styles: string[] = [];

        // Header styles (cardStyle 카테고리 - headerStyle이 있을 때만)
        if (cardSettings.headerStyle) {
            // Normal
            styles.push(`--card-header-bg-normal: ${cardSettings.headerStyle.backgroundColor}`);
            styles.push(`--card-header-font-size-normal: ${cardSettings.headerStyle.fontSize}px`);
            styles.push(`--card-header-text-color-normal: ${StyleUtils.getContrastColor(cardSettings.headerStyle.backgroundColor)}`);
            styles.push(`--card-header-border-color-normal: ${cardSettings.headerStyle.borderColor}`);
            styles.push(`--card-header-border-width-normal: ${cardSettings.headerStyle.borderWidth}px`);
            styles.push(`--card-header-border-radius-normal: ${cardSettings.headerStyle.borderRadius}px`);

            // Active
            if (cardSettings.headerActiveStyle && !cardSettings.headerActiveStyle.inheritFromNormal) {
                styles.push(`--card-header-bg-active: ${cardSettings.headerActiveStyle.backgroundColor}`);
                styles.push(`--card-header-font-size-active: ${cardSettings.headerActiveStyle.fontSize}px`);
                styles.push(`--card-header-text-color-active: ${StyleUtils.getContrastColor(cardSettings.headerActiveStyle.backgroundColor)}`);
                styles.push(`--card-header-border-color-active: ${cardSettings.headerActiveStyle.borderColor}`);
                styles.push(`--card-header-border-width-active: ${cardSettings.headerActiveStyle.borderWidth}px`);
                styles.push(`--card-header-border-radius-active: ${cardSettings.headerActiveStyle.borderRadius}px`);
            }

            // Focused
            if (cardSettings.headerFocusedStyle && !cardSettings.headerFocusedStyle.inheritFromNormal) {
                styles.push(`--card-header-bg-focused: ${cardSettings.headerFocusedStyle.backgroundColor}`);
                styles.push(`--card-header-font-size-focused: ${cardSettings.headerFocusedStyle.fontSize}px`);
                styles.push(`--card-header-text-color-focused: ${StyleUtils.getContrastColor(cardSettings.headerFocusedStyle.backgroundColor)}`);
                styles.push(`--card-header-border-color-focused: ${cardSettings.headerFocusedStyle.borderColor}`);
                styles.push(`--card-header-border-width-focused: ${cardSettings.headerFocusedStyle.borderWidth}px`);
                styles.push(`--card-header-border-radius-focused: ${cardSettings.headerFocusedStyle.borderRadius}px`);
            }
        }

        // Body styles (cardStyle 카테고리)
        if (cardSettings.bodyStyle) {
            // Normal
            styles.push(`--card-body-bg-normal: ${cardSettings.bodyStyle.backgroundColor}`);
            styles.push(`--card-body-font-size-normal: ${cardSettings.bodyStyle.fontSize}px`);
            styles.push(`--card-body-text-color-normal: ${StyleUtils.getContrastColor(cardSettings.bodyStyle.backgroundColor)}`);
            styles.push(`--card-body-border-color-normal: ${cardSettings.bodyStyle.borderColor}`);
            styles.push(`--card-body-border-width-normal: ${cardSettings.bodyStyle.borderWidth}px`);
            styles.push(`--card-body-border-radius-normal: ${cardSettings.bodyStyle.borderRadius}px`);

            // Active
            if (cardSettings.bodyActiveStyle && !cardSettings.bodyActiveStyle.inheritFromNormal) {
                styles.push(`--card-body-bg-active: ${cardSettings.bodyActiveStyle.backgroundColor}`);
                styles.push(`--card-body-font-size-active: ${cardSettings.bodyActiveStyle.fontSize}px`);
                styles.push(`--card-body-text-color-active: ${StyleUtils.getContrastColor(cardSettings.bodyActiveStyle.backgroundColor)}`);
                styles.push(`--card-body-border-color-active: ${cardSettings.bodyActiveStyle.borderColor}`);
                styles.push(`--card-body-border-width-active: ${cardSettings.bodyActiveStyle.borderWidth}px`);
                styles.push(`--card-body-border-radius-active: ${cardSettings.bodyActiveStyle.borderRadius}px`);
            }

            // Focused
            if (cardSettings.bodyFocusedStyle && !cardSettings.bodyFocusedStyle.inheritFromNormal) {
                styles.push(`--card-body-bg-focused: ${cardSettings.bodyFocusedStyle.backgroundColor}`);
                styles.push(`--card-body-font-size-focused: ${cardSettings.bodyFocusedStyle.fontSize}px`);
                styles.push(`--card-body-text-color-focused: ${StyleUtils.getContrastColor(cardSettings.bodyFocusedStyle.backgroundColor)}`);
                styles.push(`--card-body-border-color-focused: ${cardSettings.bodyFocusedStyle.borderColor}`);
                styles.push(`--card-body-border-width-focused: ${cardSettings.bodyFocusedStyle.borderWidth}px`);
                styles.push(`--card-body-border-radius-focused: ${cardSettings.bodyFocusedStyle.borderRadius}px`);
            }
        }

        // Footer styles (cardStyle 카테고리)
        if (cardSettings.footerStyle) {
            // Normal
            styles.push(`--card-footer-bg-normal: ${cardSettings.footerStyle.backgroundColor}`);
            styles.push(`--card-footer-font-size-normal: ${cardSettings.footerStyle.fontSize}px`);
            styles.push(`--card-footer-text-color-normal: ${StyleUtils.getContrastColor(cardSettings.footerStyle.backgroundColor)}`);
            styles.push(`--card-footer-border-color-normal: ${cardSettings.footerStyle.borderColor}`);
            styles.push(`--card-footer-border-width-normal: ${cardSettings.footerStyle.borderWidth}px`);
            styles.push(`--card-footer-border-radius-normal: ${cardSettings.footerStyle.borderRadius}px`);

            // Active
            if (cardSettings.footerActiveStyle && !cardSettings.footerActiveStyle.inheritFromNormal) {
                styles.push(`--card-footer-bg-active: ${cardSettings.footerActiveStyle.backgroundColor}`);
                styles.push(`--card-footer-font-size-active: ${cardSettings.footerActiveStyle.fontSize}px`);
                styles.push(`--card-footer-text-color-active: ${StyleUtils.getContrastColor(cardSettings.footerActiveStyle.backgroundColor)}`);
                styles.push(`--card-footer-border-color-active: ${cardSettings.footerActiveStyle.borderColor}`);
                styles.push(`--card-footer-border-width-active: ${cardSettings.footerActiveStyle.borderWidth}px`);
                styles.push(`--card-footer-border-radius-active: ${cardSettings.footerActiveStyle.borderRadius}px`);
            }

            // Focused
            if (cardSettings.footerFocusedStyle && !cardSettings.footerFocusedStyle.inheritFromNormal) {
                styles.push(`--card-footer-bg-focused: ${cardSettings.footerFocusedStyle.backgroundColor}`);
                styles.push(`--card-footer-font-size-focused: ${cardSettings.footerFocusedStyle.fontSize}px`);
                styles.push(`--card-footer-text-color-focused: ${StyleUtils.getContrastColor(cardSettings.footerFocusedStyle.backgroundColor)}`);
                styles.push(`--card-footer-border-color-focused: ${cardSettings.footerFocusedStyle.borderColor}`);
                styles.push(`--card-footer-border-width-focused: ${cardSettings.footerFocusedStyle.borderWidth}px`);
                styles.push(`--card-footer-border-radius-focused: ${cardSettings.footerFocusedStyle.borderRadius}px`);
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
     * cardStyle이 undefined면 해당 CSS 변수를 제거하여 전역 스타일이 적용되도록 합니다.
     */
    static applyCardStyles(
        card: HTMLElement,
        cardSettings: CardSettings
    ): void {
        // 카드 레벨 스타일이 정의된 경우에만 적용 (undefined면 전역 CSS 변수 사용)
        let cardStyles = '';
        if (cardSettings.normalCardStyle && cardSettings.activeCardStyle && cardSettings.focusedCardStyle) {
            cardStyles = this.getCardStyleString(
                cardSettings.normalCardStyle,
                cardSettings.activeCardStyle,
                cardSettings.focusedCardStyle
            );
        } else {
            // ⭐ cardStyle이 undefined면 이전에 설정된 CSS 변수 제거
            this.removeCardStyleProperties(card);
        }

        const sectionStyles = this.getSectionStyleString(cardSettings);

        // ⭐ cssText 사용: 한 번에 모든 스타일 적용 (리플로우 1회)
        const existingStyles = card.style.cssText;
        card.style.cssText = existingStyles + '; ' + cardStyles + '; ' + sectionStyles;
    }

    /**
     * 카드 스타일 CSS 변수를 제거합니다
     *
     * @param card - 카드 요소
     *
     * @remarks
     * cardStyle 카테고리가 비활성화되었을 때 호출됩니다.
     */
    private static removeCardStyleProperties(card: HTMLElement): void {
        const properties = [
            '--card-bg-normal', '--card-font-size-normal', '--card-text-color-normal',
            '--card-navigator-border-color-normal', '--card-navigator-border-width-normal', '--card-navigator-border-radius-normal',
            '--card-bg-active', '--card-font-size-active', '--card-text-color-active',
            '--card-navigator-border-color-active', '--card-navigator-border-width-active', '--card-navigator-border-radius-active',
            '--card-bg-focused', '--card-font-size-focused', '--card-text-color-focused',
            '--card-navigator-border-color-focused', '--card-navigator-border-width-focused', '--card-navigator-border-radius-focused',
            // card-navigator 접두사 버전도 제거
            '--card-navigator-bg-normal', '--card-navigator-font-size-normal',
            '--card-navigator-bg-active', '--card-navigator-font-size-active',
            '--card-navigator-bg-focused', '--card-navigator-font-size-focused'
        ];

        properties.forEach(prop => card.style.removeProperty(prop));
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

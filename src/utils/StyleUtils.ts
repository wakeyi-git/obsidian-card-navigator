import { CardStyleSettings, CardSettings } from '../types';

/**
 * Utility class for card styling operations
 */
export class StyleUtils {
    /**
     * Calculates contrast color (black or white) for given background color
     * Uses WCAG luminance formula for accessibility
     *
     * @param backgroundColor - Color in any CSS format (hex, rgb, var(), etc.)
     * @returns '#000000' for light backgrounds, '#ffffff' for dark backgrounds
     */
    static getContrastColor(backgroundColor: string): string {
        // Handle transparent background - use theme's default text color
        if (backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'rgba(0,0,0,0)') {
            // Return empty string to let CSS use fallback (--text-normal)
            const computedStyle = getComputedStyle(document.body);
            const textNormal = computedStyle.getPropertyValue('--text-normal').trim();
            return textNormal || 'var(--text-normal)';
        }

        // Handle CSS variables
        if (backgroundColor.startsWith('var(')) {
            const computedStyle = getComputedStyle(document.body);
            const varName = backgroundColor.match(/var\(--([^)]+)\)/)?.[1];
            if (varName) {
                backgroundColor = computedStyle.getPropertyValue(`--${varName}`).trim();

                // Check again if resolved value is transparent
                if (backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'rgba(0,0,0,0)' || backgroundColor === '') {
                    const textNormal = computedStyle.getPropertyValue('--text-normal').trim();
                    return textNormal || 'var(--text-normal)';
                }
            }
        }

        // Convert to RGB
        let r: number, g: number, b: number;

        if (backgroundColor.startsWith('#')) {
            // Hex color
            const hex = backgroundColor.replace('#', '');
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            }
        } else if (backgroundColor.startsWith('rgb')) {
            // RGB/RGBA color
            const matches = backgroundColor.match(/\d+/g);
            if (matches && matches.length >= 3) {
                r = parseInt(matches[0]);
                g = parseInt(matches[1]);
                b = parseInt(matches[2]);

                // Check if alpha is 0 (transparent)
                if (matches.length >= 4 && parseInt(matches[3]) === 0) {
                    const computedStyle = getComputedStyle(document.body);
                    const textNormal = computedStyle.getPropertyValue('--text-normal').trim();
                    return textNormal || 'var(--text-normal)';
                }
            } else {
                // Unknown RGB format, use theme default
                const computedStyle = getComputedStyle(document.body);
                const textNormal = computedStyle.getPropertyValue('--text-normal').trim();
                return textNormal || 'var(--text-normal)';
            }
        } else {
            // Unknown format, use theme default
            const computedStyle = getComputedStyle(document.body);
            const textNormal = computedStyle.getPropertyValue('--text-normal').trim();
            return textNormal || 'var(--text-normal)';
        }

        // Calculate relative luminance (WCAG formula)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Return black for light backgrounds, white for dark backgrounds
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    /**
     * Applies CSS custom properties to a card element for preset-based styling
     *
     * @param card - The card HTML element
     * @param normalStyle - Normal state card style settings
     * @param activeStyle - Active state card style settings
     * @param focusedStyle - Focused state card style settings
     *
     * @remarks
     * inheritFromNormal이 true인 경우, active/focused 변수를 설정하지 않아
     * 자동으로 normal 값으로 폴백되도록 합니다.
     */
    static applyCardCustomProperties(
        card: HTMLElement,
        normalStyle: CardStyleSettings,
        activeStyle: CardStyleSettings,
        focusedStyle: CardStyleSettings
    ): void {
        // Normal state - always set all properties
        card.style.setProperty('--card-bg-normal', normalStyle.backgroundColor);
        card.style.setProperty('--card-font-size-normal', `${normalStyle.fontSize}px`);
        card.style.setProperty('--card-text-color-normal', this.getContrastColor(normalStyle.backgroundColor));
        card.style.setProperty('--card-navigator-border-color-normal', normalStyle.borderColor);
        card.style.setProperty('--card-navigator-border-width-normal', `${normalStyle.borderWidth}px`);
        card.style.setProperty('--card-navigator-border-radius-normal', `${normalStyle.borderRadius}px`);

        // Active state - set all properties if not inheriting
        if (!activeStyle.inheritFromNormal) {
            card.style.setProperty('--card-bg-active', activeStyle.backgroundColor);
            card.style.setProperty('--card-font-size-active', `${activeStyle.fontSize}px`);
            card.style.setProperty('--card-text-color-active', this.getContrastColor(activeStyle.backgroundColor));
            card.style.setProperty('--card-navigator-border-color-active', activeStyle.borderColor);
            card.style.setProperty('--card-navigator-border-width-active', `${activeStyle.borderWidth}px`);
            card.style.setProperty('--card-navigator-border-radius-active', `${activeStyle.borderRadius}px`);
        }

        // Focused state - set all properties if not inheriting
        if (!focusedStyle.inheritFromNormal) {
            card.style.setProperty('--card-bg-focused', focusedStyle.backgroundColor);
            card.style.setProperty('--card-font-size-focused', `${focusedStyle.fontSize}px`);
            card.style.setProperty('--card-text-color-focused', this.getContrastColor(focusedStyle.backgroundColor));
            card.style.setProperty('--card-navigator-border-color-focused', focusedStyle.borderColor);
            card.style.setProperty('--card-navigator-border-width-focused', `${focusedStyle.borderWidth}px`);
            card.style.setProperty('--card-navigator-border-radius-focused', `${focusedStyle.borderRadius}px`);
        }
    }

    /**
     * Removes all card custom properties (for cleanup)
     *
     * @param card - The card HTML element
     */
    static removeCardCustomProperties(card: HTMLElement): void {
        const properties = [
            '--card-bg-normal', '--card-font-size-normal', '--card-text-color-normal',
            '--card-navigator-border-color-normal', '--card-navigator-border-width-normal', '--card-navigator-border-radius-normal',
            '--card-bg-active', '--card-font-size-active', '--card-text-color-active',
            '--card-navigator-border-color-active', '--card-navigator-border-width-active', '--card-navigator-border-radius-active',
            '--card-bg-focused', '--card-font-size-focused', '--card-text-color-focused',
            '--card-navigator-border-color-focused', '--card-navigator-border-width-focused', '--card-navigator-border-radius-focused'
        ];

        properties.forEach(prop => card.style.removeProperty(prop));
    }

    /**
     * 섹션별 CSS 커스텀 속성 적용 (헤더, 바디, 풋터)
     *
     * @param card - 카드 요소
     * @param cardSettings - 카드 설정
     *
     * @remarks
     * inheritFromNormal이 true인 경우, active/focused 변수를 설정하지 않아
     * 자동으로 normal 값으로 폴백되도록 합니다.
     */
    static applySectionCustomProperties(
        card: HTMLElement,
        cardSettings: CardSettings
    ): void {
        // ⭐ Card-level styles (normalCardStyle, activeCardStyle, focusedCardStyle)
        // cardStyle이 undefined면 이전에 설정된 CSS 변수를 제거하여 전역 스타일 사용
        if (cardSettings.normalCardStyle) {
            card.style.setProperty('--card-navigator-bg-normal', cardSettings.normalCardStyle.backgroundColor);
            card.style.setProperty('--card-navigator-font-size-normal', `${cardSettings.normalCardStyle.fontSize}px`);
            card.style.setProperty('--card-navigator-border-color-normal', cardSettings.normalCardStyle.borderColor);
            card.style.setProperty('--card-navigator-border-width-normal', `${cardSettings.normalCardStyle.borderWidth}px`);
            card.style.setProperty('--card-navigator-border-radius-normal', `${cardSettings.normalCardStyle.borderRadius}px`);
        } else {
            // ⭐ cardStyle 비활성화: 이전에 설정된 CSS 변수 제거
            card.style.removeProperty('--card-navigator-bg-normal');
            card.style.removeProperty('--card-navigator-font-size-normal');
            card.style.removeProperty('--card-navigator-border-color-normal');
            card.style.removeProperty('--card-navigator-border-width-normal');
            card.style.removeProperty('--card-navigator-border-radius-normal');
        }

        if (cardSettings.activeCardStyle) {
            if (!cardSettings.activeCardStyle.inheritFromNormal) {
                card.style.setProperty('--card-navigator-bg-active', cardSettings.activeCardStyle.backgroundColor);
                card.style.setProperty('--card-navigator-font-size-active', `${cardSettings.activeCardStyle.fontSize}px`);
                card.style.setProperty('--card-navigator-border-color-active', cardSettings.activeCardStyle.borderColor);
                card.style.setProperty('--card-navigator-border-width-active', `${cardSettings.activeCardStyle.borderWidth}px`);
                card.style.setProperty('--card-navigator-border-radius-active', `${cardSettings.activeCardStyle.borderRadius}px`);
            }
        } else {
            // ⭐ cardStyle 비활성화: 이전에 설정된 CSS 변수 제거
            card.style.removeProperty('--card-navigator-bg-active');
            card.style.removeProperty('--card-navigator-font-size-active');
            card.style.removeProperty('--card-navigator-border-color-active');
            card.style.removeProperty('--card-navigator-border-width-active');
            card.style.removeProperty('--card-navigator-border-radius-active');
        }

        if (cardSettings.focusedCardStyle) {
            if (!cardSettings.focusedCardStyle.inheritFromNormal) {
                card.style.setProperty('--card-navigator-bg-focused', cardSettings.focusedCardStyle.backgroundColor);
                card.style.setProperty('--card-navigator-font-size-focused', `${cardSettings.focusedCardStyle.fontSize}px`);
                card.style.setProperty('--card-navigator-border-color-focused', cardSettings.focusedCardStyle.borderColor);
                card.style.setProperty('--card-navigator-border-width-focused', `${cardSettings.focusedCardStyle.borderWidth}px`);
                card.style.setProperty('--card-navigator-border-radius-focused', `${cardSettings.focusedCardStyle.borderRadius}px`);
            }
        } else {
            // ⭐ cardStyle 비활성화: 이전에 설정된 CSS 변수 제거
            card.style.removeProperty('--card-navigator-bg-focused');
            card.style.removeProperty('--card-navigator-font-size-focused');
            card.style.removeProperty('--card-navigator-border-color-focused');
            card.style.removeProperty('--card-navigator-border-width-focused');
            card.style.removeProperty('--card-navigator-border-radius-focused');
        }

        // ⭐ Header styles (cardStyle 카테고리 - headerStyle로 활성화 여부 판단)
        if (cardSettings.headerStyle) {
            // Normal 스타일
            card.style.setProperty('--card-header-bg-normal', cardSettings.headerStyle.backgroundColor);
            card.style.setProperty('--card-header-font-size-normal', `${cardSettings.headerStyle.fontSize}px`);
            card.style.setProperty('--card-header-text-color-normal', this.getContrastColor(cardSettings.headerStyle.backgroundColor));
            card.style.setProperty('--card-header-border-color-normal', cardSettings.headerStyle.borderColor);
            card.style.setProperty('--card-header-border-width-normal', `${cardSettings.headerStyle.borderWidth}px`);
            card.style.setProperty('--card-header-border-radius-normal', `${cardSettings.headerStyle.borderRadius}px`);

            // Active 스타일
            if (cardSettings.headerActiveStyle && !cardSettings.headerActiveStyle.inheritFromNormal) {
                card.style.setProperty('--card-header-bg-active', cardSettings.headerActiveStyle.backgroundColor);
                card.style.setProperty('--card-header-font-size-active', `${cardSettings.headerActiveStyle.fontSize}px`);
                card.style.setProperty('--card-header-text-color-active', this.getContrastColor(cardSettings.headerActiveStyle.backgroundColor));
                card.style.setProperty('--card-header-border-color-active', cardSettings.headerActiveStyle.borderColor);
                card.style.setProperty('--card-header-border-width-active', `${cardSettings.headerActiveStyle.borderWidth}px`);
                card.style.setProperty('--card-header-border-radius-active', `${cardSettings.headerActiveStyle.borderRadius}px`);
            }

            // Focused 스타일
            if (cardSettings.headerFocusedStyle && !cardSettings.headerFocusedStyle.inheritFromNormal) {
                card.style.setProperty('--card-header-bg-focused', cardSettings.headerFocusedStyle.backgroundColor);
                card.style.setProperty('--card-header-font-size-focused', `${cardSettings.headerFocusedStyle.fontSize}px`);
                card.style.setProperty('--card-header-text-color-focused', this.getContrastColor(cardSettings.headerFocusedStyle.backgroundColor));
                card.style.setProperty('--card-header-border-color-focused', cardSettings.headerFocusedStyle.borderColor);
                card.style.setProperty('--card-header-border-width-focused', `${cardSettings.headerFocusedStyle.borderWidth}px`);
                card.style.setProperty('--card-header-border-radius-focused', `${cardSettings.headerFocusedStyle.borderRadius}px`);
            }
        } else {
            // ⭐ cardStyle 비활성화: 헤더 섹션 스타일 CSS 변수 제거
            this.removeSectionStyleProperties(card, 'header');
        }

        // ⭐ Body styles (cardStyle 카테고리)
        if (cardSettings.bodyStyle) {
            // Normal 스타일
            card.style.setProperty('--card-body-bg-normal', cardSettings.bodyStyle.backgroundColor);
            card.style.setProperty('--card-body-font-size-normal', `${cardSettings.bodyStyle.fontSize}px`);
            card.style.setProperty('--card-body-text-color-normal', this.getContrastColor(cardSettings.bodyStyle.backgroundColor));
            card.style.setProperty('--card-body-border-color-normal', cardSettings.bodyStyle.borderColor);
            card.style.setProperty('--card-body-border-width-normal', `${cardSettings.bodyStyle.borderWidth}px`);
            card.style.setProperty('--card-body-border-radius-normal', `${cardSettings.bodyStyle.borderRadius}px`);

            // Active 스타일
            if (cardSettings.bodyActiveStyle && !cardSettings.bodyActiveStyle.inheritFromNormal) {
                card.style.setProperty('--card-body-bg-active', cardSettings.bodyActiveStyle.backgroundColor);
                card.style.setProperty('--card-body-font-size-active', `${cardSettings.bodyActiveStyle.fontSize}px`);
                card.style.setProperty('--card-body-text-color-active', this.getContrastColor(cardSettings.bodyActiveStyle.backgroundColor));
                card.style.setProperty('--card-body-border-color-active', cardSettings.bodyActiveStyle.borderColor);
                card.style.setProperty('--card-body-border-width-active', `${cardSettings.bodyActiveStyle.borderWidth}px`);
                card.style.setProperty('--card-body-border-radius-active', `${cardSettings.bodyActiveStyle.borderRadius}px`);
            }

            // Focused 스타일
            if (cardSettings.bodyFocusedStyle && !cardSettings.bodyFocusedStyle.inheritFromNormal) {
                card.style.setProperty('--card-body-bg-focused', cardSettings.bodyFocusedStyle.backgroundColor);
                card.style.setProperty('--card-body-font-size-focused', `${cardSettings.bodyFocusedStyle.fontSize}px`);
                card.style.setProperty('--card-body-text-color-focused', this.getContrastColor(cardSettings.bodyFocusedStyle.backgroundColor));
                card.style.setProperty('--card-body-border-color-focused', cardSettings.bodyFocusedStyle.borderColor);
                card.style.setProperty('--card-body-border-width-focused', `${cardSettings.bodyFocusedStyle.borderWidth}px`);
                card.style.setProperty('--card-body-border-radius-focused', `${cardSettings.bodyFocusedStyle.borderRadius}px`);
            }
        } else {
            // ⭐ cardStyle 비활성화: 바디 섹션 스타일 CSS 변수 제거
            this.removeSectionStyleProperties(card, 'body');
        }

        // ⭐ Footer styles (cardStyle 카테고리)
        if (cardSettings.footerStyle) {
            // Normal 스타일
            card.style.setProperty('--card-footer-bg-normal', cardSettings.footerStyle.backgroundColor);
            card.style.setProperty('--card-footer-font-size-normal', `${cardSettings.footerStyle.fontSize}px`);
            card.style.setProperty('--card-footer-text-color-normal', this.getContrastColor(cardSettings.footerStyle.backgroundColor));
            card.style.setProperty('--card-footer-border-color-normal', cardSettings.footerStyle.borderColor);
            card.style.setProperty('--card-footer-border-width-normal', `${cardSettings.footerStyle.borderWidth}px`);
            card.style.setProperty('--card-footer-border-radius-normal', `${cardSettings.footerStyle.borderRadius}px`);

            // Active 스타일
            if (cardSettings.footerActiveStyle && !cardSettings.footerActiveStyle.inheritFromNormal) {
                card.style.setProperty('--card-footer-bg-active', cardSettings.footerActiveStyle.backgroundColor);
                card.style.setProperty('--card-footer-font-size-active', `${cardSettings.footerActiveStyle.fontSize}px`);
                card.style.setProperty('--card-footer-text-color-active', this.getContrastColor(cardSettings.footerActiveStyle.backgroundColor));
                card.style.setProperty('--card-footer-border-color-active', cardSettings.footerActiveStyle.borderColor);
                card.style.setProperty('--card-footer-border-width-active', `${cardSettings.footerActiveStyle.borderWidth}px`);
                card.style.setProperty('--card-footer-border-radius-active', `${cardSettings.footerActiveStyle.borderRadius}px`);
            }

            // Focused 스타일
            if (cardSettings.footerFocusedStyle && !cardSettings.footerFocusedStyle.inheritFromNormal) {
                card.style.setProperty('--card-footer-bg-focused', cardSettings.footerFocusedStyle.backgroundColor);
                card.style.setProperty('--card-footer-font-size-focused', `${cardSettings.footerFocusedStyle.fontSize}px`);
                card.style.setProperty('--card-footer-text-color-focused', this.getContrastColor(cardSettings.footerFocusedStyle.backgroundColor));
                card.style.setProperty('--card-footer-border-color-focused', cardSettings.footerFocusedStyle.borderColor);
                card.style.setProperty('--card-footer-border-width-focused', `${cardSettings.footerFocusedStyle.borderWidth}px`);
                card.style.setProperty('--card-footer-border-radius-focused', `${cardSettings.footerFocusedStyle.borderRadius}px`);
            }
        } else {
            // ⭐ cardStyle 비활성화: 풋터 섹션 스타일 CSS 변수 제거
            this.removeSectionStyleProperties(card, 'footer');
        }
    }

    /**
     * 섹션 스타일 CSS 변수를 제거합니다
     *
     * @param card - 카드 요소
     * @param section - 섹션 이름 (header, body, footer)
     */
    private static removeSectionStyleProperties(card: HTMLElement, section: 'header' | 'body' | 'footer'): void {
        const states = ['normal', 'active', 'focused'];
        const props = ['bg', 'font-size', 'text-color', 'border-color', 'border-width', 'border-radius'];

        for (const state of states) {
            for (const prop of props) {
                card.style.removeProperty(`--card-${section}-${prop}-${state}`);
            }
        }
    }

    /**
     * Updates text color CSS variables for existing cards based on current theme
     * Call this when theme changes to recalculate contrast colors
     *
     * @param card - The card HTML element to update
     * @param cardSettings - Card style settings
     *
     * @remarks
     * This only updates text color properties, leaving other styles unchanged.
     * Useful for theme switching without full card re-render.
     */
    static updateTextColorsForTheme(card: HTMLElement, cardSettings: CardSettings): void {
        // Update header text colors
        if (cardSettings.header) {
            const headerBgNormal = card.style.getPropertyValue('--card-header-bg-normal');
            if (headerBgNormal) {
                card.style.setProperty('--card-header-text-color-normal', this.getContrastColor(headerBgNormal));
            }

            if (!cardSettings.header.activeStyle.inheritFromNormal) {
                const headerBgActive = card.style.getPropertyValue('--card-header-bg-active');
                if (headerBgActive) {
                    card.style.setProperty('--card-header-text-color-active', this.getContrastColor(headerBgActive));
                }
            }

            if (!cardSettings.header.focusedStyle.inheritFromNormal) {
                const headerBgFocused = card.style.getPropertyValue('--card-header-bg-focused');
                if (headerBgFocused) {
                    card.style.setProperty('--card-header-text-color-focused', this.getContrastColor(headerBgFocused));
                }
            }
        }

        // Update body text colors
        if (cardSettings.body) {
            const bodyBgNormal = card.style.getPropertyValue('--card-body-bg-normal');
            if (bodyBgNormal) {
                card.style.setProperty('--card-body-text-color-normal', this.getContrastColor(bodyBgNormal));
            }

            if (!cardSettings.body.activeStyle.inheritFromNormal) {
                const bodyBgActive = card.style.getPropertyValue('--card-body-bg-active');
                if (bodyBgActive) {
                    card.style.setProperty('--card-body-text-color-active', this.getContrastColor(bodyBgActive));
                }
            }

            if (!cardSettings.body.focusedStyle.inheritFromNormal) {
                const bodyBgFocused = card.style.getPropertyValue('--card-body-bg-focused');
                if (bodyBgFocused) {
                    card.style.setProperty('--card-body-text-color-focused', this.getContrastColor(bodyBgFocused));
                }
            }
        }

        // Update footer text colors
        if (cardSettings.footer) {
            const footerBgNormal = card.style.getPropertyValue('--card-footer-bg-normal');
            if (footerBgNormal) {
                card.style.setProperty('--card-footer-text-color-normal', this.getContrastColor(footerBgNormal));
            }

            if (!cardSettings.footer.activeStyle.inheritFromNormal) {
                const footerBgActive = card.style.getPropertyValue('--card-footer-bg-active');
                if (footerBgActive) {
                    card.style.setProperty('--card-footer-text-color-active', this.getContrastColor(footerBgActive));
                }
            }

            if (!cardSettings.footer.focusedStyle.inheritFromNormal) {
                const footerBgFocused = card.style.getPropertyValue('--card-footer-bg-focused');
                if (footerBgFocused) {
                    card.style.setProperty('--card-footer-text-color-focused', this.getContrastColor(footerBgFocused));
                }
            }
        }
    }
}

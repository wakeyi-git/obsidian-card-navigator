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
        // Header styles
        if (cardSettings.header) {
            // Normal 스타일은 항상 모든 속성 설정
            card.style.setProperty('--card-header-bg-normal', cardSettings.header.normalStyle.backgroundColor);
            card.style.setProperty('--card-header-font-size-normal', `${cardSettings.header.normalStyle.fontSize}px`);
            card.style.setProperty('--card-header-text-color-normal', this.getContrastColor(cardSettings.header.normalStyle.backgroundColor));
            card.style.setProperty('--card-header-border-color-normal', cardSettings.header.normalStyle.borderColor);
            card.style.setProperty('--card-header-border-width-normal', `${cardSettings.header.normalStyle.borderWidth}px`);
            card.style.setProperty('--card-header-border-radius-normal', `${cardSettings.header.normalStyle.borderRadius}px`);

            // Active 스타일: 상속 모드가 아닐 때만 모든 속성 설정
            if (!cardSettings.header.activeStyle.inheritFromNormal) {
                card.style.setProperty('--card-header-bg-active', cardSettings.header.activeStyle.backgroundColor);
                card.style.setProperty('--card-header-font-size-active', `${cardSettings.header.activeStyle.fontSize}px`);
                card.style.setProperty('--card-header-text-color-active', this.getContrastColor(cardSettings.header.activeStyle.backgroundColor));
                card.style.setProperty('--card-header-border-color-active', cardSettings.header.activeStyle.borderColor);
                card.style.setProperty('--card-header-border-width-active', `${cardSettings.header.activeStyle.borderWidth}px`);
                card.style.setProperty('--card-header-border-radius-active', `${cardSettings.header.activeStyle.borderRadius}px`);
            }

            // Focused 스타일: 상속 모드가 아닐 때만 모든 속성 설정
            if (!cardSettings.header.focusedStyle.inheritFromNormal) {
                card.style.setProperty('--card-header-bg-focused', cardSettings.header.focusedStyle.backgroundColor);
                card.style.setProperty('--card-header-font-size-focused', `${cardSettings.header.focusedStyle.fontSize}px`);
                card.style.setProperty('--card-header-text-color-focused', this.getContrastColor(cardSettings.header.focusedStyle.backgroundColor));
                card.style.setProperty('--card-header-border-color-focused', cardSettings.header.focusedStyle.borderColor);
                card.style.setProperty('--card-header-border-width-focused', `${cardSettings.header.focusedStyle.borderWidth}px`);
                card.style.setProperty('--card-header-border-radius-focused', `${cardSettings.header.focusedStyle.borderRadius}px`);
            }
        }

        // Body styles
        if (cardSettings.body) {
            // Normal 스타일은 항상 모든 속성 설정
            card.style.setProperty('--card-body-bg-normal', cardSettings.body.normalStyle.backgroundColor);
            card.style.setProperty('--card-body-font-size-normal', `${cardSettings.body.normalStyle.fontSize}px`);
            card.style.setProperty('--card-body-text-color-normal', this.getContrastColor(cardSettings.body.normalStyle.backgroundColor));
            card.style.setProperty('--card-body-border-color-normal', cardSettings.body.normalStyle.borderColor);
            card.style.setProperty('--card-body-border-width-normal', `${cardSettings.body.normalStyle.borderWidth}px`);
            card.style.setProperty('--card-body-border-radius-normal', `${cardSettings.body.normalStyle.borderRadius}px`);

            // Active 스타일: 상속 모드가 아닐 때만 모든 속성 설정
            if (!cardSettings.body.activeStyle.inheritFromNormal) {
                card.style.setProperty('--card-body-bg-active', cardSettings.body.activeStyle.backgroundColor);
                card.style.setProperty('--card-body-font-size-active', `${cardSettings.body.activeStyle.fontSize}px`);
                card.style.setProperty('--card-body-text-color-active', this.getContrastColor(cardSettings.body.activeStyle.backgroundColor));
                card.style.setProperty('--card-body-border-color-active', cardSettings.body.activeStyle.borderColor);
                card.style.setProperty('--card-body-border-width-active', `${cardSettings.body.activeStyle.borderWidth}px`);
                card.style.setProperty('--card-body-border-radius-active', `${cardSettings.body.activeStyle.borderRadius}px`);
            }

            // Focused 스타일: 상속 모드가 아닐 때만 모든 속성 설정
            if (!cardSettings.body.focusedStyle.inheritFromNormal) {
                card.style.setProperty('--card-body-bg-focused', cardSettings.body.focusedStyle.backgroundColor);
                card.style.setProperty('--card-body-font-size-focused', `${cardSettings.body.focusedStyle.fontSize}px`);
                card.style.setProperty('--card-body-text-color-focused', this.getContrastColor(cardSettings.body.focusedStyle.backgroundColor));
                card.style.setProperty('--card-body-border-color-focused', cardSettings.body.focusedStyle.borderColor);
                card.style.setProperty('--card-body-border-width-focused', `${cardSettings.body.focusedStyle.borderWidth}px`);
                card.style.setProperty('--card-body-border-radius-focused', `${cardSettings.body.focusedStyle.borderRadius}px`);
            }
        }

        // Footer styles
        if (cardSettings.footer) {
            // Normal 스타일은 항상 모든 속성 설정
            card.style.setProperty('--card-footer-bg-normal', cardSettings.footer.normalStyle.backgroundColor);
            card.style.setProperty('--card-footer-font-size-normal', `${cardSettings.footer.normalStyle.fontSize}px`);
            card.style.setProperty('--card-footer-text-color-normal', this.getContrastColor(cardSettings.footer.normalStyle.backgroundColor));
            card.style.setProperty('--card-footer-border-color-normal', cardSettings.footer.normalStyle.borderColor);
            card.style.setProperty('--card-footer-border-width-normal', `${cardSettings.footer.normalStyle.borderWidth}px`);
            card.style.setProperty('--card-footer-border-radius-normal', `${cardSettings.footer.normalStyle.borderRadius}px`);

            // Active 스타일: 상속 모드가 아닐 때만 모든 속성 설정
            if (!cardSettings.footer.activeStyle.inheritFromNormal) {
                card.style.setProperty('--card-footer-bg-active', cardSettings.footer.activeStyle.backgroundColor);
                card.style.setProperty('--card-footer-font-size-active', `${cardSettings.footer.activeStyle.fontSize}px`);
                card.style.setProperty('--card-footer-text-color-active', this.getContrastColor(cardSettings.footer.activeStyle.backgroundColor));
                card.style.setProperty('--card-footer-border-color-active', cardSettings.footer.activeStyle.borderColor);
                card.style.setProperty('--card-footer-border-width-active', `${cardSettings.footer.activeStyle.borderWidth}px`);
                card.style.setProperty('--card-footer-border-radius-active', `${cardSettings.footer.activeStyle.borderRadius}px`);
            }

            // Focused 스타일: 상속 모드가 아닐 때만 모든 속성 설정
            if (!cardSettings.footer.focusedStyle.inheritFromNormal) {
                card.style.setProperty('--card-footer-bg-focused', cardSettings.footer.focusedStyle.backgroundColor);
                card.style.setProperty('--card-footer-font-size-focused', `${cardSettings.footer.focusedStyle.fontSize}px`);
                card.style.setProperty('--card-footer-text-color-focused', this.getContrastColor(cardSettings.footer.focusedStyle.backgroundColor));
                card.style.setProperty('--card-footer-border-color-focused', cardSettings.footer.focusedStyle.borderColor);
                card.style.setProperty('--card-footer-border-width-focused', `${cardSettings.footer.focusedStyle.borderWidth}px`);
                card.style.setProperty('--card-footer-border-radius-focused', `${cardSettings.footer.focusedStyle.borderRadius}px`);
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

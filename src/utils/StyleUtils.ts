import { CardStyleSettings } from '../types';

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
        // Handle CSS variables
        if (backgroundColor.startsWith('var(')) {
            const computedStyle = getComputedStyle(document.body);
            const varName = backgroundColor.match(/var\(--([^)]+)\)/)?.[1];
            if (varName) {
                backgroundColor = computedStyle.getPropertyValue(`--${varName}`).trim();
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
            } else {
                return '#000000';
            }
        } else {
            // Unknown format, default to black
            return '#000000';
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
        // Normal state - always set
        card.style.setProperty('--card-bg-normal', normalStyle.backgroundColor);
        card.style.setProperty('--card-font-size-normal', `${normalStyle.fontSize}px`);
        card.style.setProperty('--card-font-weight-normal', normalStyle.fontWeight);
        card.style.setProperty('--card-text-color-normal', this.getContrastColor(normalStyle.backgroundColor));

        // Active state - only if not inheriting
        if (!activeStyle.inheritFromNormal) {
            card.style.setProperty('--card-bg-active', activeStyle.backgroundColor);
            card.style.setProperty('--card-font-size-active', `${activeStyle.fontSize}px`);
            card.style.setProperty('--card-font-weight-active', activeStyle.fontWeight);
            card.style.setProperty('--card-text-color-active', this.getContrastColor(activeStyle.backgroundColor));
        }

        // Focused state - only if not inheriting
        if (!focusedStyle.inheritFromNormal) {
            card.style.setProperty('--card-bg-focused', focusedStyle.backgroundColor);
            card.style.setProperty('--card-font-size-focused', `${focusedStyle.fontSize}px`);
            card.style.setProperty('--card-font-weight-focused', focusedStyle.fontWeight);
            card.style.setProperty('--card-text-color-focused', this.getContrastColor(focusedStyle.backgroundColor));
        }

        // Section styles (header, body, footer) for normal state
        if (normalStyle.headerStyle) {
            card.style.setProperty('--card-header-bg-normal', normalStyle.headerStyle.backgroundColor);
            card.style.setProperty('--card-header-font-size-normal', `${normalStyle.headerStyle.fontSize}px`);
            card.style.setProperty('--card-header-font-weight-normal', normalStyle.headerStyle.fontWeight);
            card.style.setProperty('--card-header-text-color-normal', this.getContrastColor(normalStyle.headerStyle.backgroundColor));
        }

        if (normalStyle.bodyStyle) {
            card.style.setProperty('--card-body-bg-normal', normalStyle.bodyStyle.backgroundColor);
            card.style.setProperty('--card-body-font-size-normal', `${normalStyle.bodyStyle.fontSize}px`);
            card.style.setProperty('--card-body-font-weight-normal', normalStyle.bodyStyle.fontWeight);
            card.style.setProperty('--card-body-text-color-normal', this.getContrastColor(normalStyle.bodyStyle.backgroundColor));
        }

        if (normalStyle.footerStyle) {
            card.style.setProperty('--card-footer-bg-normal', normalStyle.footerStyle.backgroundColor);
            card.style.setProperty('--card-footer-font-size-normal', `${normalStyle.footerStyle.fontSize}px`);
            card.style.setProperty('--card-footer-font-weight-normal', normalStyle.footerStyle.fontWeight);
            card.style.setProperty('--card-footer-text-color-normal', this.getContrastColor(normalStyle.footerStyle.backgroundColor));
        }

        // Section styles for active state
        if (activeStyle.headerStyle) {
            card.style.setProperty('--card-header-bg-active', activeStyle.headerStyle.backgroundColor);
            card.style.setProperty('--card-header-font-size-active', `${activeStyle.headerStyle.fontSize}px`);
            card.style.setProperty('--card-header-font-weight-active', activeStyle.headerStyle.fontWeight);
            card.style.setProperty('--card-header-text-color-active', this.getContrastColor(activeStyle.headerStyle.backgroundColor));
        }

        if (activeStyle.bodyStyle) {
            card.style.setProperty('--card-body-bg-active', activeStyle.bodyStyle.backgroundColor);
            card.style.setProperty('--card-body-font-size-active', `${activeStyle.bodyStyle.fontSize}px`);
            card.style.setProperty('--card-body-font-weight-active', activeStyle.bodyStyle.fontWeight);
            card.style.setProperty('--card-body-text-color-active', this.getContrastColor(activeStyle.bodyStyle.backgroundColor));
        }

        if (activeStyle.footerStyle) {
            card.style.setProperty('--card-footer-bg-active', activeStyle.footerStyle.backgroundColor);
            card.style.setProperty('--card-footer-font-size-active', `${activeStyle.footerStyle.fontSize}px`);
            card.style.setProperty('--card-footer-font-weight-active', activeStyle.footerStyle.fontWeight);
            card.style.setProperty('--card-footer-text-color-active', this.getContrastColor(activeStyle.footerStyle.backgroundColor));
        }

        // Section styles for focused state
        if (focusedStyle.headerStyle) {
            card.style.setProperty('--card-header-bg-focused', focusedStyle.headerStyle.backgroundColor);
            card.style.setProperty('--card-header-font-size-focused', `${focusedStyle.headerStyle.fontSize}px`);
            card.style.setProperty('--card-header-font-weight-focused', focusedStyle.headerStyle.fontWeight);
            card.style.setProperty('--card-header-text-color-focused', this.getContrastColor(focusedStyle.headerStyle.backgroundColor));
        }

        if (focusedStyle.bodyStyle) {
            card.style.setProperty('--card-body-bg-focused', focusedStyle.bodyStyle.backgroundColor);
            card.style.setProperty('--card-body-font-size-focused', `${focusedStyle.bodyStyle.fontSize}px`);
            card.style.setProperty('--card-body-font-weight-focused', focusedStyle.bodyStyle.fontWeight);
            card.style.setProperty('--card-body-text-color-focused', this.getContrastColor(focusedStyle.bodyStyle.backgroundColor));
        }

        if (focusedStyle.footerStyle) {
            card.style.setProperty('--card-footer-bg-focused', focusedStyle.footerStyle.backgroundColor);
            card.style.setProperty('--card-footer-font-size-focused', `${focusedStyle.footerStyle.fontSize}px`);
            card.style.setProperty('--card-footer-font-weight-focused', focusedStyle.footerStyle.fontWeight);
            card.style.setProperty('--card-footer-text-color-focused', this.getContrastColor(focusedStyle.footerStyle.backgroundColor));
        }
    }

    /**
     * Removes all card custom properties (for cleanup)
     *
     * @param card - The card HTML element
     */
    static removeCardCustomProperties(card: HTMLElement): void {
        const properties = [
            '--card-bg-normal', '--card-font-size-normal', '--card-font-weight-normal', '--card-text-color-normal',
            '--card-bg-active', '--card-font-size-active', '--card-font-weight-active', '--card-text-color-active',
            '--card-bg-focused', '--card-font-size-focused', '--card-font-weight-focused', '--card-text-color-focused',
            '--card-header-bg-normal', '--card-header-font-size-normal', '--card-header-font-weight-normal', '--card-header-text-color-normal',
            '--card-body-bg-normal', '--card-body-font-size-normal', '--card-body-font-weight-normal', '--card-body-text-color-normal',
            '--card-footer-bg-normal', '--card-footer-font-size-normal', '--card-footer-font-weight-normal', '--card-footer-text-color-normal',
            '--card-header-bg-active', '--card-header-font-size-active', '--card-header-font-weight-active', '--card-header-text-color-active',
            '--card-body-bg-active', '--card-body-font-size-active', '--card-body-font-weight-active', '--card-body-text-color-active',
            '--card-footer-bg-active', '--card-footer-font-size-active', '--card-footer-font-weight-active', '--card-footer-text-color-active',
            '--card-header-bg-focused', '--card-header-font-size-focused', '--card-header-font-weight-focused', '--card-header-text-color-focused',
            '--card-body-bg-focused', '--card-body-font-size-focused', '--card-body-font-weight-focused', '--card-body-text-color-focused',
            '--card-footer-bg-focused', '--card-footer-font-size-focused', '--card-footer-font-weight-focused', '--card-footer-text-color-focused'
        ];

        properties.forEach(prop => card.style.removeProperty(prop));
    }
}

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
        card.style.setProperty('--card-text-color-normal', this.getContrastColor(normalStyle.backgroundColor));

        // Active state - only if not inheriting
        if (!activeStyle.inheritFromNormal) {
            card.style.setProperty('--card-bg-active', activeStyle.backgroundColor);
            card.style.setProperty('--card-font-size-active', `${activeStyle.fontSize}px`);
            card.style.setProperty('--card-text-color-active', this.getContrastColor(activeStyle.backgroundColor));
        }

        // Focused state - only if not inheriting
        if (!focusedStyle.inheritFromNormal) {
            card.style.setProperty('--card-bg-focused', focusedStyle.backgroundColor);
            card.style.setProperty('--card-font-size-focused', `${focusedStyle.fontSize}px`);
            card.style.setProperty('--card-text-color-focused', this.getContrastColor(focusedStyle.backgroundColor));
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
            '--card-bg-active', '--card-font-size-active', '--card-text-color-active',
            '--card-bg-focused', '--card-font-size-focused', '--card-text-color-focused'
        ];

        properties.forEach(prop => card.style.removeProperty(prop));
    }
}

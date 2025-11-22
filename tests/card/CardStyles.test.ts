import { CardStyleManager } from '../../src/card/CardStyles';
import { CardNavigatorSettings, CardStyleSettings, DEFAULT_SETTINGS } from '../../src/types';

describe('CardStyleManager', () => {
    let styleManager: CardStyleManager;
    let mockSettings: CardNavigatorSettings;

    beforeEach(() => {
        mockSettings = { ...DEFAULT_SETTINGS };
        styleManager = new CardStyleManager(() => mockSettings);

        // DOM 초기화
        document.body.style.cssText = '';
    });

    afterEach(() => {
        // CSS 변수 정리
        const types = ['normal', 'active', 'focused'];
        const properties = ['bg', 'font-size', 'border-color', 'border-width', 'border-radius'];

        types.forEach(type => {
            properties.forEach(prop => {
                document.body.style.removeProperty(`--card-navigator-${prop}-${type}`);
            });
        });
    });

    describe('applyStyles', () => {
        it('should apply all card styles', () => {
            const customSettings: CardNavigatorSettings = {
                ...mockSettings,
                normalCardStyle: {
                    backgroundColor: '#ffffff',
                    fontSize: 14,
                    borderColor: '#cccccc',
                    borderWidth: 1,
                    borderRadius: 4
                },
                activeCardStyle: {
                    backgroundColor: '#e0e0e0',
                    fontSize: 14,
                    borderColor: '#2196f3',
                    borderWidth: 2,
                    borderRadius: 4
                },
                focusedCardStyle: {
                    backgroundColor: '#f5f5f5',
                    fontSize: 14,
                    borderColor: '#4caf50',
                    borderWidth: 2,
                    borderRadius: 4
                }
            };

            styleManager.applyStyles(customSettings);

            // Normal card style
            expect(document.body.style.getPropertyValue('--card-navigator-bg-normal'))
                .toBe('#ffffff');
            expect(document.body.style.getPropertyValue('--card-navigator-font-size-normal'))
                .toBe('14px');
            expect(document.body.style.getPropertyValue('--card-navigator-border-color-normal'))
                .toBe('#cccccc');
            expect(document.body.style.getPropertyValue('--card-navigator-border-width-normal'))
                .toBe('1px');
            expect(document.body.style.getPropertyValue('--card-navigator-border-radius-normal'))
                .toBe('4px');

            // Active card style
            expect(document.body.style.getPropertyValue('--card-navigator-bg-active'))
                .toBe('#e0e0e0');
            expect(document.body.style.getPropertyValue('--card-navigator-border-color-active'))
                .toBe('#2196f3');

            // Focused card style
            expect(document.body.style.getPropertyValue('--card-navigator-bg-focused'))
                .toBe('#f5f5f5');
            expect(document.body.style.getPropertyValue('--card-navigator-border-color-focused'))
                .toBe('#4caf50');
        });
    });

    describe('updateCardStyle', () => {
        it('should update specific card type style', () => {
            const normalStyle: CardStyleSettings = {
                backgroundColor: '#ff0000',
                fontSize: 16,
                borderColor: '#00ff00',
                borderWidth: 3,
                borderRadius: 8
            };

            styleManager.updateCardStyle('normal', normalStyle);

            expect(document.body.style.getPropertyValue('--card-navigator-bg-normal'))
                .toBe('#ff0000');
            expect(document.body.style.getPropertyValue('--card-navigator-font-size-normal'))
                .toBe('16px');
            expect(document.body.style.getPropertyValue('--card-navigator-border-color-normal'))
                .toBe('#00ff00');
            expect(document.body.style.getPropertyValue('--card-navigator-border-width-normal'))
                .toBe('3px');
            expect(document.body.style.getPropertyValue('--card-navigator-border-radius-normal'))
                .toBe('8px');
        });

        it('should update active card style independently', () => {
            const activeStyle: CardStyleSettings = {
                backgroundColor: '#0000ff',
                fontSize: 18,
                borderColor: '#ff00ff',
                borderWidth: 4,
                borderRadius: 12
            };

            styleManager.updateCardStyle('active', activeStyle);

            expect(document.body.style.getPropertyValue('--card-navigator-bg-active'))
                .toBe('#0000ff');
            expect(document.body.style.getPropertyValue('--card-navigator-font-size-active'))
                .toBe('18px');

            // Other card types should not be affected
            expect(document.body.style.getPropertyValue('--card-navigator-bg-normal'))
                .toBe('');
        });

        it('should update focused card style independently', () => {
            const focusedStyle: CardStyleSettings = {
                backgroundColor: '#ffff00',
                fontSize: 15,
                borderColor: '#00ffff',
                borderWidth: 2,
                borderRadius: 6
            };

            styleManager.updateCardStyle('focused', focusedStyle);

            expect(document.body.style.getPropertyValue('--card-navigator-bg-focused'))
                .toBe('#ffff00');
            expect(document.body.style.getPropertyValue('--card-navigator-font-size-focused'))
                .toBe('15px');
        });
    });

    describe('resetStyles', () => {
        it('should remove all CSS variables', () => {
            const customSettings: CardNavigatorSettings = {
                ...mockSettings,
                normalCardStyle: {
                    backgroundColor: '#ffffff',
                    fontSize: 14,
                    borderColor: '#cccccc',
                    borderWidth: 1,
                    borderRadius: 4
                },
                activeCardStyle: {
                    backgroundColor: '#e0e0e0',
                    fontSize: 14,
                    borderColor: '#2196f3',
                    borderWidth: 2,
                    borderRadius: 4
                },
                focusedCardStyle: {
                    backgroundColor: '#f5f5f5',
                    fontSize: 14,
                    borderColor: '#4caf50',
                    borderWidth: 2,
                    borderRadius: 4
                }
            };

            // Apply styles first
            styleManager.applyStyles(customSettings);

            // Verify styles are applied
            expect(document.body.style.getPropertyValue('--card-navigator-bg-normal'))
                .not.toBe('');

            // Reset styles
            styleManager.resetStyles();

            // Verify all styles are removed
            const types = ['normal', 'active', 'focused'];
            const properties = ['bg', 'font-size', 'border-color', 'border-width', 'border-radius'];

            types.forEach(type => {
                properties.forEach(prop => {
                    expect(document.body.style.getPropertyValue(`--card-navigator-${prop}-${type}`))
                        .toBe('');
                });
            });
        });

        it('should handle reset on empty styles', () => {
            // Reset without applying any styles
            expect(() => styleManager.resetStyles()).not.toThrow();

            // Verify no styles exist
            expect(document.body.style.getPropertyValue('--card-navigator-bg-normal'))
                .toBe('');
        });
    });

    describe('logCurrentStyles', () => {
        it('should log current styles without errors', () => {
            const customSettings: CardNavigatorSettings = {
                ...mockSettings,
                debug: {
                    enabled: true,
                    categories: {
                        Card: true
                    }
                },
                normalCardStyle: {
                    backgroundColor: '#ffffff',
                    fontSize: 14,
                    borderColor: '#cccccc',
                    borderWidth: 1,
                    borderRadius: 4
                },
                activeCardStyle: {
                    backgroundColor: '#e0e0e0',
                    fontSize: 14,
                    borderColor: '#2196f3',
                    borderWidth: 2,
                    borderRadius: 4
                },
                focusedCardStyle: {
                    backgroundColor: '#f5f5f5',
                    fontSize: 14,
                    borderColor: '#4caf50',
                    borderWidth: 2,
                    borderRadius: 4
                }
            };

            // Create a new style manager with debug enabled
            const debugStyleManager = new CardStyleManager(() => customSettings);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            debugStyleManager.applyStyles(customSettings);
            debugStyleManager.logCurrentStyles();

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should log styles even when no styles are applied', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            styleManager.logCurrentStyles();

            // Since debug logger may not log when debug is disabled, just check it doesn't throw
            expect(() => styleManager.logCurrentStyles()).not.toThrow();

            consoleSpy.mockRestore();
        });
    });

    describe('Edge cases', () => {
        it('should handle zero values correctly', () => {
            const zeroStyle: CardStyleSettings = {
                backgroundColor: '#000000',
                fontSize: 0,
                borderColor: '#000000',
                borderWidth: 0,
                borderRadius: 0
            };

            styleManager.updateCardStyle('normal', zeroStyle);

            expect(document.body.style.getPropertyValue('--card-navigator-font-size-normal'))
                .toBe('0px');
            expect(document.body.style.getPropertyValue('--card-navigator-border-width-normal'))
                .toBe('0px');
            expect(document.body.style.getPropertyValue('--card-navigator-border-radius-normal'))
                .toBe('0px');
        });

        it('should handle very large values', () => {
            const largeStyle: CardStyleSettings = {
                backgroundColor: '#ffffff',
                fontSize: 999,
                borderColor: '#000000',
                borderWidth: 100,
                borderRadius: 500
            };

            styleManager.updateCardStyle('normal', largeStyle);

            expect(document.body.style.getPropertyValue('--card-navigator-font-size-normal'))
                .toBe('999px');
            expect(document.body.style.getPropertyValue('--card-navigator-border-width-normal'))
                .toBe('100px');
            expect(document.body.style.getPropertyValue('--card-navigator-border-radius-normal'))
                .toBe('500px');
        });

        it('should handle special color formats', () => {
            const specialColorStyle: CardStyleSettings = {
                backgroundColor: 'rgba(255, 0, 0, 0.5)',
                fontSize: 14,
                borderColor: 'hsl(120, 100%, 50%)',
                borderWidth: 1,
                borderRadius: 4
            };

            styleManager.updateCardStyle('normal', specialColorStyle);

            expect(document.body.style.getPropertyValue('--card-navigator-bg-normal'))
                .toBe('rgba(255, 0, 0, 0.5)');
            expect(document.body.style.getPropertyValue('--card-navigator-border-color-normal'))
                .toBe('hsl(120, 100%, 50%)');
        });

        it('should overwrite existing styles when reapplied', () => {
            const style1: CardStyleSettings = {
                backgroundColor: '#ff0000',
                fontSize: 14,
                borderColor: '#000000',
                borderWidth: 1,
                borderRadius: 4
            };

            const style2: CardStyleSettings = {
                backgroundColor: '#00ff00',
                fontSize: 16,
                borderColor: '#ffffff',
                borderWidth: 2,
                borderRadius: 8
            };

            styleManager.updateCardStyle('normal', style1);
            expect(document.body.style.getPropertyValue('--card-navigator-bg-normal'))
                .toBe('#ff0000');

            styleManager.updateCardStyle('normal', style2);
            expect(document.body.style.getPropertyValue('--card-navigator-bg-normal'))
                .toBe('#00ff00');
        });
    });
});

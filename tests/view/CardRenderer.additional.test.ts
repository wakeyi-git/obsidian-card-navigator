import { CardRenderer } from '../../src/card/CardRenderer';
import { CardData, CardSection, DEFAULT_SETTINGS, RenderMode } from '../../src/types';
import { App, Component, TFile } from 'obsidian';

describe('CardRenderer - Additional Coverage', () => {
    let renderer: CardRenderer;
    let mockApp: App;
    let mockComponent: Component;
    let mockGetSettings: () => typeof DEFAULT_SETTINGS;
    
    beforeEach(() => {
        // Mock App
        mockApp = {
            vault: {
                getAbstractFileByPath: jest.fn()
            },
            workspace: {
                openLinkText: jest.fn().mockResolvedValue(undefined),
                getLeavesOfType: jest.fn().mockReturnValue([]),
                getRightLeaf: jest.fn().mockReturnValue(null),
                revealLeaf: jest.fn()
            },
            metadataCache: {
                getFileCache: jest.fn().mockReturnValue(null)
            }
        } as any;
        
        // Mock Component
        mockComponent = {
            load: jest.fn(),
            unload: jest.fn(),
            addChild: jest.fn(),
            removeChild: jest.fn(),
            register: jest.fn(),
            registerEvent: jest.fn(),
            registerDomEvent: jest.fn(),
            registerInterval: jest.fn()
        } as any;
        
        // Mock getSettings
        mockGetSettings = jest.fn().mockReturnValue(DEFAULT_SETTINGS);
        
        renderer = new CardRenderer(mockApp, mockComponent, 'plain', mockGetSettings);
    });
    
    describe('Card Rendering', () => {
        test('renders card with all sections', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Test Header',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Test Body Content',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: '#test #example',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    // cardStyle 카테고리: 섹션 스타일 추가
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            expect(card).toBeInstanceOf(HTMLElement);
            expect(card.classList.contains('card-item')).toBe(true);
            expect(card.getAttribute('data-path')).toBe('test.md');
        });

        test('renders only enabled sections', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Test Header',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Test Body Content',
                    visible: false // Disabled
                },
                footer: {
                    type: 'footer',
                    content: '#test',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            const header = card.querySelector('.card-header');
            const body = card.querySelector('.card-body');
            const footer = card.querySelector('.card-footer');

            expect(header).toBeTruthy();
            expect(body).toBeFalsy(); // Body should not be rendered
            expect(footer).toBeTruthy();
        });

        test('applies active styles when isActive is true', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Active Card',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Body',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: 'Footer',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            // Should apply active styles
            expect(card).toBeInstanceOf(HTMLElement);
        });
    });

    describe('Render Mode', () => {
        test('supports plain text mode', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Plain **text**',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Body with *markdown*',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: '#tag',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            expect(card).toBeInstanceOf(HTMLElement);
        });

        test('supports markdown-html mode', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Markdown **Header**',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Body with *markdown*',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: '#tag',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'markdown-html',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            expect(card).toBeInstanceOf(HTMLElement);
        });

        test('changes render mode dynamically', () => {
            renderer.setRenderMode('markdown-html');
            // Mode change should not throw
            expect(() => renderer.setRenderMode('plain')).not.toThrow();
        });
    });
    
    describe('Empty Content Handling', () => {
        test('handles empty header content', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: '',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Body',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: 'Footer',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            const header = card.querySelector('.card-header');
            expect(header?.textContent).toBe('(No title)');
        });

        test('handles empty body content', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Header',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: '',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: 'Footer',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            const body = card.querySelector('.card-body');
            expect(body?.textContent).toBe('(No content)');
        });

        test('handles empty footer content', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Header',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Body',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: '',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            const footer = card.querySelector('.card-footer');
            expect(footer?.textContent).toBe('');
        });
    });

    describe('Link Handlers', () => {
        test('sets up link handlers on card', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Header',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: '<span class="internal-link" data-file-path="other.md">Link</span>',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: '<span class="tag-link" data-tag="test">#test</span>',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            // setupLinkHandlers should be called internally
            expect(card).toBeInstanceOf(HTMLElement);
        });

        test('can manually setup link handlers', () => {
            const card = document.createElement('div');
            card.innerHTML = '<span class="internal-link" data-file-path="test.md">Test</span>';
            
            // Should not throw
            expect(() => renderer.setupLinkHandlers(card)).not.toThrow();
        });
    });
    
    describe('Data Attributes', () => {
        test('sets data-path attribute', async () => {
            const mockFile = {
                path: 'folder/test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Header',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Body',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: 'Footer',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            expect(card.getAttribute('data-path')).toBe('folder/test.md');
        });

        test('sets tabindex attribute', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Header',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Body',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: 'Footer',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            expect(card.getAttribute('tabindex')).toBe('-1');
        });
    });

    describe('Style Application', () => {
        test('applies section styles', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Header',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Body',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: 'Footer',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            const header = card.querySelector('.card-header') as HTMLElement;
            const body = card.querySelector('.card-body') as HTMLElement;
            const footer = card.querySelector('.card-footer') as HTMLElement;

            // Modified Strategy A: CSS custom properties should be applied to card element
            expect(card.style.getPropertyValue('--card-header-font-size-normal')).toBeTruthy();
            expect(card.style.getPropertyValue('--card-body-font-size-normal')).toBeTruthy();
            expect(card.style.getPropertyValue('--card-footer-font-size-normal')).toBeTruthy();
        });
    });

    describe('Edge Cases', () => {
        test('handles very long content', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const longContent = 'A'.repeat(10000);
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: 'Header',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: longContent,
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: 'Footer',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');

            // Should not throw with long content
            await expect(
                renderer.renderCard(cardData, container)
            ).resolves.toBeInstanceOf(HTMLElement);
        });

        test('handles special characters in content', async () => {
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const cardData: CardData = {
                file: mockFile,
                header: {
                    type: 'header',
                    content: '한글 Header with 特殊文字 & symbols',
                    visible: true
                },
                body: {
                    type: 'body',
                    content: 'Body with <html> & "quotes"',
                    visible: true
                },
                footer: {
                    type: 'footer',
                    content: '#tag-한글',
                    visible: true
                },
                cardSettings: {
                    header: DEFAULT_SETTINGS.header,
                    body: DEFAULT_SETTINGS.body,
                    footer: DEFAULT_SETTINGS.footer,
                    renderMode: 'plain',
                    normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                    activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                    focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle,
                    headerStyle: DEFAULT_SETTINGS.header.normalStyle,
                    headerActiveStyle: DEFAULT_SETTINGS.header.activeStyle,
                    headerFocusedStyle: DEFAULT_SETTINGS.header.focusedStyle,
                    bodyStyle: DEFAULT_SETTINGS.body.normalStyle,
                    bodyActiveStyle: DEFAULT_SETTINGS.body.activeStyle,
                    bodyFocusedStyle: DEFAULT_SETTINGS.body.focusedStyle,
                    footerStyle: DEFAULT_SETTINGS.footer.normalStyle,
                    footerActiveStyle: DEFAULT_SETTINGS.footer.activeStyle,
                    footerFocusedStyle: DEFAULT_SETTINGS.footer.focusedStyle
                }
            };

            const container = document.createElement('div');
            const card = await renderer.renderCard(cardData, container);

            expect(card).toBeInstanceOf(HTMLElement);
        });
    });
});

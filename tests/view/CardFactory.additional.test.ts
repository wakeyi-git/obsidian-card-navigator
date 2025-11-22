import { CardFactory } from '../../src/view/CardFactory';
import { CardRenderer } from '../../src/card/CardRenderer';
import { CardDataExtractor } from '../../src/card/CardData';
import { ViewEventHandler } from '../../src/view/ViewEventHandler';
import { ICardView } from '../../src/interfaces/ICardView';
import { TFile, App } from 'obsidian';
import { CardData, CardSettings, DEFAULT_SETTINGS } from '../../src/types';

// Mock modules
jest.mock('../../src/card/CardRenderer');
jest.mock('../../src/card/CardData');
jest.mock('../../src/view/ViewEventHandler');

describe('CardFactory - Additional Coverage', () => {
    let factory: CardFactory;
    let mockApp: App;
    let mockView: ICardView;
    let mockRenderer: jest.Mocked<CardRenderer>;
    let mockExtractor: jest.Mocked<CardDataExtractor>;
    let mockEventHandler: jest.Mocked<ViewEventHandler>;
    
    beforeEach(() => {
        // Mock App
        mockApp = {
            vault: {
                getAbstractFileByPath: jest.fn(),
                read: jest.fn().mockResolvedValue('# Test\n\nContent')
            },
            metadataCache: {
                getFileCache: jest.fn().mockReturnValue({
                    frontmatter: {},
                    tags: [{ tag: '#test' }],
                    links: []
                })
            }
        } as any;
        
        // Mock ICardView
        mockView = {
            plugin: {
                settingsManager: {
                    getSettings: jest.fn().mockReturnValue(DEFAULT_SETTINGS)
                },
                presetManager: {
                    getCardSettingsForFile: jest.fn().mockReturnValue(null)
                }
            }
        } as any;
        
        // Mock CardRenderer - renderCard가 실제 DOM 요소를 반환하도록 설정
        const createMockCard = () => {
            const card = document.createElement('div');
            card.className = 'card-item';
            card.setAttribute('data-path', 'test.md');
            card.setAttribute('tabindex', '-1');
            return card;
        };
        
        mockRenderer = {
            renderCard: jest.fn().mockImplementation(() => Promise.resolve(createMockCard())),
            setupLinkHandlers: jest.fn()
        } as any;
        
        // Mock CardDataExtractor  
        mockExtractor = {
            extractContent: jest.fn().mockResolvedValue('Test content')
        } as any;
        
        // Mock ViewEventHandler
        mockEventHandler = {
            bindCardEvents: jest.fn()
        } as any;
        
        factory = new CardFactory(
            mockApp,
            mockView,
            mockRenderer,
            mockExtractor,
            mockEventHandler
        );
    });
    
    describe('Card Creation', () => {
        test('creates basic card element', async () => {
            const file = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card).toBeInstanceOf(HTMLElement);
            expect(card.classList.contains('card-item')).toBe(true);
            expect(card.getAttribute('data-file-path')).toBe('test.md');
        });
        
        test('calls renderer.renderCard', async () => {
            const file = {
                path: 'test.md',
                basename: 'test',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            await factory.createCard(file, container, null, onFileOpen);
            
            expect(mockRenderer.renderCard).toHaveBeenCalled();
            expect(mockRenderer.renderCard).toHaveBeenCalledWith(
                expect.objectContaining({
                    file: file
                }),
                container,
                false // isActive
            );
        });
        
        test('adds active class to active file', async () => {
            const file = {
                path: 'active.md',
                basename: 'active',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, file, onFileOpen);
            
            expect(card.classList.contains('active')).toBe(true);
            expect(mockRenderer.renderCard).toHaveBeenCalledWith(
                expect.any(Object),
                container,
                true // isActive
            );
        });
        
        test('does not add active class to non-active file', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const activeFile = {
                path: 'active.md',
                basename: 'active',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, activeFile, onFileOpen);
            
            expect(card.classList.contains('active')).toBe(false);
            expect(mockRenderer.renderCard).toHaveBeenCalledWith(
                expect.any(Object),
                container,
                false // isActive
            );
        });
        
        test('handles null active file', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.classList.contains('active')).toBe(false);
        });
    });
    
    describe('Event Binding', () => {
        test('binds card events', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            await factory.createCard(file, container, null, onFileOpen);
            
            expect(mockEventHandler.bindCardEvents).toHaveBeenCalled();
            expect(mockEventHandler.bindCardEvents).toHaveBeenCalledWith(
                expect.any(HTMLElement),
                file,
                onFileOpen
            );
        });
        
        test('passes correct callback to event handler', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const customCallback = jest.fn();
            
            await factory.createCard(file, container, null, customCallback);
            
            const callArgs = mockEventHandler.bindCardEvents.mock.calls[0];
            expect(callArgs[2]).toBe(customCallback);
        });
    });
    
    describe('CardData Extraction', () => {
        test('extracts content for all sections', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            await factory.createCard(file, container, null, onFileOpen);
            
            // header, body, footer 각각 한 번씩 = 총 3번 호출
            expect(mockExtractor.extractContent).toHaveBeenCalledTimes(3);
        });
        
        test('uses correct content types from settings', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            await factory.createCard(file, container, null, onFileOpen);
            
            // 헤더 - filename
            expect(mockExtractor.extractContent).toHaveBeenCalledWith(
                file,
                'filename',
                expect.any(Number),
                undefined,
                expect.any(String),
                false
            );
            
            // 바디 - content
            expect(mockExtractor.extractContent).toHaveBeenCalledWith(
                file,
                'content',
                expect.any(Number),
                undefined,
                expect.any(String),
                false
            );
            
            // 풋터 - tags
            expect(mockExtractor.extractContent).toHaveBeenCalledWith(
                file,
                'tags',
                expect.any(Number),
                undefined,
                expect.any(String),
                false
            );
        });
    });
    
    describe('Preset Integration', () => {
        test('uses preset settings when available', async () => {
            const file = {
                path: 'preset-file.md',
                basename: 'preset-file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const presetSettings: CardSettings = {
                header: DEFAULT_SETTINGS.header,
                body: DEFAULT_SETTINGS.body,
                footer: DEFAULT_SETTINGS.footer,
                renderMode: 'markdown-html',
                normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle
            };
            
            mockView.plugin.presetManager.getCardSettingsForFile = jest.fn()
                .mockReturnValue(presetSettings);
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            await factory.createCard(file, container, null, onFileOpen);
            
            expect(mockView.plugin.presetManager.getCardSettingsForFile)
                .toHaveBeenCalledWith(file);
        });
        
        test('uses global settings when no preset available', async () => {
            const file = {
                path: 'normal-file.md',
                basename: 'normal-file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            mockView.plugin.presetManager.getCardSettingsForFile = jest.fn()
                .mockReturnValue(null);
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            await factory.createCard(file, container, null, onFileOpen);
            
            expect(mockView.plugin.settingsManager.getSettings).toHaveBeenCalled();
        });
    });
    
    describe('Multiple Cards', () => {
        test('creates multiple cards independently', async () => {
            const files = [
                { path: 'file1.md', basename: 'file1', stat: { ctime: 1, mtime: 1 } },
                { path: 'file2.md', basename: 'file2', stat: { ctime: 2, mtime: 2 } },
                { path: 'file3.md', basename: 'file3', stat: { ctime: 3, mtime: 3 } }
            ] as TFile[];
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const cards = await Promise.all(
                files.map(file => factory.createCard(file, container, null, onFileOpen))
            );
            
            expect(cards).toHaveLength(3);
            expect(mockRenderer.renderCard).toHaveBeenCalledTimes(3);
        });
        
        test('each card has independent event binding', async () => {
            const files = [
                { path: 'file1.md', basename: 'file1', stat: { ctime: 1, mtime: 1 } },
                { path: 'file2.md', basename: 'file2', stat: { ctime: 2, mtime: 2 } }
            ] as TFile[];
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            await Promise.all(
                files.map(file => factory.createCard(file, container, null, onFileOpen))
            );
            
            expect(mockEventHandler.bindCardEvents).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('Data Attributes', () => {
        test('sets correct data-file-path attribute', async () => {
            const file = {
                path: 'folder/subfolder/file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.dataset.filePath).toBe('folder/subfolder/file.md');
        });
        
        test('handles files with special characters in path', async () => {
            const file = {
                path: 'folder/test (2023).md',
                basename: 'test (2023)',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.dataset.filePath).toBe('folder/test (2023).md');
        });
    });
    
    describe('CSS Classes', () => {
        test('applies base card class', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.classList.contains('card-item')).toBe(true);
        });
        
        test('applies active class only when file is active', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            // Not active
            const card1 = await factory.createCard(file, container, null, onFileOpen);
            expect(card1.classList.contains('active')).toBe(false);
            
            // Active
            const card2 = await factory.createCard(file, container, file, onFileOpen);
            expect(card2.classList.contains('active')).toBe(true);
        });
    });
    
    describe('Card Structure', () => {
        test('creates card as HTMLElement', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card).toBeInstanceOf(HTMLElement);
            expect(card.tagName).toBe('DIV');
        });
        
        test('sets tabindex for keyboard navigation', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.getAttribute('tabindex')).toBe('-1');
        });
    });
    
    describe('Edge Cases', () => {
        test('handles file with no stat', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: undefined
            } as any as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            // Should not throw
            await expect(
                factory.createCard(file, container, null, onFileOpen)
            ).resolves.toBeInstanceOf(HTMLElement);
        });
        
        test('handles very long file paths', async () => {
            const longPath = 'a/'.repeat(50) + 'file.md';
            const file = {
                path: longPath,
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.dataset.filePath).toBe(longPath);
        });
        
        test('handles files with unicode names', async () => {
            const file = {
                path: '한글/파일명.md',
                basename: '파일명',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.dataset.filePath).toBe('한글/파일명.md');
        });
    });
    
    describe('Style Application', () => {
        test('applies card styles with data attributes', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            // Data attributes for focused state should be set
            expect(card.dataset.focusedBg).toBeDefined();
            expect(card.dataset.focusedBorderColor).toBeDefined();
        });
        
        test('applies different styles for active cards', async () => {
            const file = {
                path: 'file.md',
                basename: 'file',
                stat: { ctime: 1000000, mtime: 2000000 }
            } as TFile;
            
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const activeCard = await factory.createCard(file, container, file, onFileOpen);
            
            expect(activeCard.dataset.activeBg).toBeDefined();
            expect(activeCard.classList.contains('active')).toBe(true);
        });
    });
});

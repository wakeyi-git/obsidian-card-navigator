/**
 * CardFactory 테스트
 * 
 * 카드 생성 팩토리의 동작을 테스트합니다.
 */

import { TFile, App } from 'obsidian';
import { CardFactory } from '../../src/view/CardFactory';
import { CardRenderer } from '../../src/card/CardRenderer';
import { CardDataExtractor } from '../../src/card/CardData';
import { ViewEventHandler } from '../../src/view/ViewEventHandler';
import { ICardView } from '../../src/interfaces/ICardView';
import { CardData, CardSettings, DEFAULT_SETTINGS } from '../../src/types';

// Mock dependencies
jest.mock('../../src/card/CardRenderer');
jest.mock('../../src/card/CardData');
jest.mock('../../src/view/ViewEventHandler');

// Helper: Mock TFile 생성
function createMockFile(
    basename: string,
    path: string = `${basename}.md`
): TFile {
    const file = new TFile();
    file.basename = basename;
    file.name = `${basename}.md`;
    file.path = path;
    file.extension = 'md';
    
    file.stat = {
        ctime: Date.parse('2024-01-01'),
        mtime: Date.parse('2024-01-15'),
        size: 1000
    } as any;
    
    return file;
}

// Helper: Mock CardData 생성
function createMockCardData(): CardData {
    return {
        file: createMockFile('test'),
        header: {
            type: 'header',
            visible: true,
            content: '<div class="card-title">Test File</div>'
        },
        body: {
            type: 'body',
            visible: true,
            content: '<p>Test content</p>'
        },
        footer: {
            type: 'footer',
            visible: true,
            content: '<div class="card-meta">Modified: 2024-01-15</div>'
        },
        cardSettings: DEFAULT_SETTINGS as any
    };
}

// Helper: Mock ICardView 생성
function createMockView(): jest.Mocked<ICardView> {
    const mockPresetManager = {
        getCardSettingsForFile: jest.fn().mockReturnValue(null)
    };
    
    const mockSettingsManager = {
        getSettings: jest.fn().mockReturnValue(DEFAULT_SETTINGS)
    };
    
    const mockPlugin = {
        settingsManager: mockSettingsManager,
        presetManager: mockPresetManager
    };
    
    return {
        plugin: mockPlugin as any
    };
}

describe('CardFactory', () => {
    let factory: CardFactory;
    let mockApp: App;
    let mockView: jest.Mocked<ICardView>;
    let mockRenderer: jest.Mocked<CardRenderer>;
    let mockExtractor: jest.Mocked<CardDataExtractor>;
    let mockEventHandler: jest.Mocked<ViewEventHandler>;
    let container: HTMLElement;
    
    beforeEach(() => {
        mockApp = new App();
        mockView = createMockView();
        
        // CardRenderer mock
        mockRenderer = {
            renderCard: jest.fn().mockImplementation((cardData: CardData, container: HTMLElement, isActive: boolean) => {
                const card = document.createElement('div');
                card.classList.add('cn-card');
                if (isActive) {
                    card.classList.add('is-active');
                }
                
                // Add sections
                const header = document.createElement('div');
                header.classList.add('card-header');
                header.innerHTML = cardData.header.content;
                card.appendChild(header);
                
                const body = document.createElement('div');
                body.classList.add('card-body');
                body.innerHTML = cardData.body.content;
                card.appendChild(body);
                
                const footer = document.createElement('div');
                footer.classList.add('card-footer');
                footer.innerHTML = cardData.footer.content;
                card.appendChild(footer);
                
                container.appendChild(card);
                return card;
            }),
            setupLinkHandlers: jest.fn()
        } as any;
        
        // CardDataExtractor mock
        mockExtractor = {
            extractContent: jest.fn().mockImplementation(async (file, contentType) => {
                // contentType에 따라 다른 내용 반환
                if (contentType === 'filename') {
                    return '<div class="card-title">Test File</div>';
                } else if (contentType === 'content') {
                    return '<p>Test content</p>';
                } else if (contentType === 'tags') {
                    return '<div class="card-meta">Modified: 2024-01-15</div>';
                }
                return '<div>Default content</div>';
            })
        } as any;
        
        // ViewEventHandler mock
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
        
        container = document.createElement('div');
        document.body.appendChild(container);
        
        jest.clearAllMocks();
    });
    
    afterEach(() => {
        document.body.removeChild(container);
    });
    
    describe('createCard', () => {
        it('should create a card element', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            expect(card).toBeInstanceOf(HTMLElement);
            expect(card.classList.contains('cn-card')).toBe(true);
        });
        
        it('should set file path as data attribute', async () => {
            const file = createMockFile('test', 'folder/test.md');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            expect(card.dataset.filePath).toBe('folder/test.md');
        });
        
        it('should call renderer with correct parameters', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            expect(mockRenderer.renderCard).toHaveBeenCalledWith(
                expect.any(Object), // cardData
                container,
                false // isActive
            );
        });
        
        it('should bind events to card', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            expect(mockEventHandler.bindCardEvents).toHaveBeenCalledWith(
                card,
                file,
                onFileOpen
            );
        });
        
        it('should extract content from file', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            // extractContent가 header, body, footer에 대해 각각 호출됨
            expect(mockExtractor.extractContent).toHaveBeenCalledTimes(3);
            
            // header에 대한 호출 검증 (contentType: 'filename')
            expect(mockExtractor.extractContent).toHaveBeenCalledWith(
                file,
                'filename',
                100,
                undefined,
                'plain',
                false
            );
            
            // body에 대한 호출 검증 (contentType: 'content')
            expect(mockExtractor.extractContent).toHaveBeenCalledWith(
                file,
                'content',
                200,
                undefined,
                'plain',
                false
            );
            
            // footer에 대한 호출 검증 (contentType: 'tags')
            expect(mockExtractor.extractContent).toHaveBeenCalledWith(
                file,
                'tags',
                50,
                undefined,
                'plain',
                false
            );
        });
    });
    
    describe('Active Card Highlighting', () => {
        it('should add active class when file is active', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(
                file,
                container,
                file, // activeFile = file
                onFileOpen
            );
            
            expect(card.classList.contains('active')).toBe(true);
        });
        
        it('should not add active class when file is not active', async () => {
            const file = createMockFile('test');
            const otherFile = createMockFile('other');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(
                file,
                container,
                otherFile, // activeFile is different
                onFileOpen
            );
            
            expect(card.classList.contains('active')).toBe(false);
        });
        
        it('should pass isActive to renderer', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            await factory.createCard(
                file,
                container,
                file, // activeFile = file
                onFileOpen
            );
            
            expect(mockRenderer.renderCard).toHaveBeenCalledWith(
                expect.any(Object),
                container,
                true // isActive = true
            );
        });
    });
    
    describe('Preset Settings', () => {
        it('should use preset settings if available', async () => {
            const file = createMockFile('test');
            const presetSettings: CardSettings = {
                header: {
                    ...DEFAULT_SETTINGS.header,
                    normalStyle: {
                        ...DEFAULT_SETTINGS.header.normalStyle,
                        fontSize: 18
                    }
                },
                body: DEFAULT_SETTINGS.body,
                footer: DEFAULT_SETTINGS.footer,
                renderMode: DEFAULT_SETTINGS.renderMode,
                normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
                activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
                focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle
            };
            
            mockView.plugin.presetManager.getCardSettingsForFile = jest.fn().mockReturnValue(presetSettings);
            
            const onFileOpen = jest.fn();
            
            await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            expect(mockView.plugin.presetManager.getCardSettingsForFile).toHaveBeenCalledWith(file);
        });
        
        it('should use global settings if no preset', async () => {
            const file = createMockFile('test');
            mockView.plugin.presetManager.getCardSettingsForFile = jest.fn().mockReturnValue(null);
            
            const onFileOpen = jest.fn();
            
            await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            expect(mockView.plugin.presetManager.getCardSettingsForFile).toHaveBeenCalledWith(file);
            // Global settings should be used, which calls extractContent
            expect(mockExtractor.extractContent).toHaveBeenCalled();
        });
    });
    
    describe('Card Structure', () => {
        it('should render card with header, body, and footer', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            expect(card.querySelector('.card-header')).toBeTruthy();
            expect(card.querySelector('.card-body')).toBeTruthy();
            expect(card.querySelector('.card-footer')).toBeTruthy();
        });
        
        it('should render header content', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            const header = card.querySelector('.card-header');
            expect(header?.innerHTML).toContain('Test File');
        });
        
        it('should render body content', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            const body = card.querySelector('.card-body');
            expect(body?.innerHTML).toContain('Test content');
        });
        
        it('should render footer content', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(
                file,
                container,
                null,
                onFileOpen
            );
            
            const footer = card.querySelector('.card-footer');
            expect(footer?.innerHTML).toContain('Modified');
        });
    });
    
    describe('Multiple Cards', () => {
        it('should create multiple cards independently', async () => {
            const file1 = createMockFile('file1');
            const file2 = createMockFile('file2');
            const onFileOpen = jest.fn();
            
            const card1 = await factory.createCard(file1, container, null, onFileOpen);
            const card2 = await factory.createCard(file2, container, null, onFileOpen);
            
            expect(card1).not.toBe(card2);
            expect(card1.dataset.filePath).toBe('file1.md');
            expect(card2.dataset.filePath).toBe('file2.md');
            expect(container.children.length).toBe(2);
        });
        
        it('should handle active state for multiple cards', async () => {
            const file1 = createMockFile('file1');
            const file2 = createMockFile('file2');
            const onFileOpen = jest.fn();
            
            const card1 = await factory.createCard(file1, container, file1, onFileOpen);
            const card2 = await factory.createCard(file2, container, file1, onFileOpen);
            
            expect(card1.classList.contains('active')).toBe(true);
            expect(card2.classList.contains('active')).toBe(false);
        });
    });
    
    describe('Error Handling', () => {
        it('should handle extraction errors gracefully', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            // extractContent가 에러를 발생하도록 재정의
            mockExtractor.extractContent = jest.fn().mockRejectedValue(new Error('Extraction failed'));
            
            await expect(
                factory.createCard(file, container, null, onFileOpen)
            ).rejects.toThrow('Extraction failed');
        });
        
        it('should handle rendering errors gracefully', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            mockRenderer.renderCard = jest.fn().mockImplementation(() => {
                throw new Error('Rendering failed');
            });
            
            await expect(
                factory.createCard(file, container, null, onFileOpen)
            ).rejects.toThrow('Rendering failed');
        });
    });
    
    describe('Integration with Components', () => {
        it('should integrate with renderer correctly', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            await factory.createCard(file, container, null, onFileOpen);
            
            expect(mockRenderer.renderCard).toHaveBeenCalledTimes(1);
        });
        
        it('should integrate with extractor correctly', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            await factory.createCard(file, container, null, onFileOpen);
            
            // extractContent is called for header, body, footer
            expect(mockExtractor.extractContent).toHaveBeenCalled();
        });
        
        it('should integrate with event handler correctly', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            await factory.createCard(file, container, null, onFileOpen);
            
            expect(mockEventHandler.bindCardEvents).toHaveBeenCalledTimes(1);
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle files with special characters in path', async () => {
            const file = createMockFile('test file!@#', 'folder/test file!@#.md');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.dataset.filePath).toBe('folder/test file!@#.md');
        });
        
        it('should handle files with unicode characters', async () => {
            const file = createMockFile('테스트파일', '폴더/테스트파일.md');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.dataset.filePath).toBe('폴더/테스트파일.md');
        });
        
        it('should handle files in deeply nested folders', async () => {
            const file = createMockFile('test', 'a/b/c/d/e/test.md');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.dataset.filePath).toBe('a/b/c/d/e/test.md');
        });
        
        it('should handle null active file', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card.classList.contains('active')).toBe(false);
        });
    });
    
    describe('Performance', () => {
        it('should create cards quickly', async () => {
            const file = createMockFile('test');
            const onFileOpen = jest.fn();
            
            const start = Date.now();
            await factory.createCard(file, container, null, onFileOpen);
            const duration = Date.now() - start;
            
            // 카드 생성은 50ms 이내여야 함
            expect(duration).toBeLessThan(50);
        });
        
        it('should handle batch creation efficiently', async () => {
            const files = Array.from({ length: 50 }, (_, i) => 
                createMockFile(`file${i}`)
            );
            const onFileOpen = jest.fn();
            
            const start = Date.now();
            await Promise.all(
                files.map(file => factory.createCard(file, container, null, onFileOpen))
            );
            const duration = Date.now() - start;
            
            // 50개 카드 생성은 500ms 이내여야 함 (평균 10ms per card)
            expect(duration).toBeLessThan(500);
        });
    });
});
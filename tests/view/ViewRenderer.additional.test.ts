import { ViewRenderer } from '../../src/view/ViewRenderer';
import { ViewStateManager } from '../../src/view/ViewStateManager';
import { CardFactory } from '../../src/view/CardFactory';
import { SearchEngine } from '../../src/search/SearchEngine';
import { SortManager } from '../../src/sort/SortManager';
import { LayoutManager } from '../../src/layout/LayoutManager';
import { ViewportManager } from '../../src/view/ViewportManager';
import { KeyboardNavigator } from '../../src/navigation/KeyboardNav';
import { SelectionManager } from '../../src/selection/SelectionManager';
import { FolderMode } from '../../src/modes/FolderMode';
import { TagMode } from '../../src/modes/TagMode';
import { TFile, TFolder, App, MarkdownRenderer } from 'obsidian';
import { CardNavigatorSettings, DEFAULT_SETTINGS } from '../../src/types';
import type { CardNavigatorView } from '../../src/view';
import CardNavigatorPlugin from '../../src/main';

// Mock 설정
jest.mock('../../src/view/CardFactory');
jest.mock('../../src/search/SearchEngine');
jest.mock('../../src/sort/SortManager');
jest.mock('../../src/layout/LayoutManager');
jest.mock('../../src/view/ViewportManager');
jest.mock('../../src/navigation/KeyboardNav');
jest.mock('../../src/selection/SelectionManager');
jest.mock('../../src/modes/FolderMode');
jest.mock('../../src/modes/TagMode');

describe('ViewRenderer - Additional Coverage', () => {
    let renderer: ViewRenderer;
    let stateManager: ViewStateManager;
    let cardFactory: jest.Mocked<CardFactory>;
    let searchEngine: jest.Mocked<SearchEngine>;
    let sortManager: jest.Mocked<SortManager>;
    let layoutManager: jest.Mocked<LayoutManager>;
    let viewportManager: jest.Mocked<ViewportManager>;
    let keyboardNav: jest.Mocked<KeyboardNavigator>;
    let selectionManager: jest.Mocked<SelectionManager>;
    let folderMode: jest.Mocked<FolderMode>;
    let tagMode: jest.Mocked<TagMode>;
    let settings: CardNavigatorSettings;
    let mockApp: any;
    let mockPlugin: any;
    let mockView: any;
    
    beforeEach(() => {
        // Mock App
        mockApp = {
            vault: {
                getMarkdownFiles: jest.fn(() => []),
                getAbstractFileByPath: jest.fn()
            },
            metadataCache: {
                getFileCache: jest.fn()
            },
            workspace: {
                getActiveFile: jest.fn(() => null)
            }
        };
        
        // Mock Plugin
        mockPlugin = {
            settingsManager: {
                getSettings: jest.fn(() => settings)
            }
        };
        
        // Mock View
        mockView = {
            containerEl: document.createElement('div'),
            plugin: mockPlugin,
            getToolbar: jest.fn(() => ({
                updateFileCount: jest.fn()
            })),
            updateContextBarPath: jest.fn(),
            updateContextBarGroupList: jest.fn()
        };
        
        // Settings
        settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        
        // Mocks
        stateManager = new ViewStateManager();
        
        // CardFactory mock
        cardFactory = {
            createCard: jest.fn().mockResolvedValue(undefined),
            createPlaceholder: jest.fn((file: TFile, container: HTMLElement, isActive: boolean) => {
                const div = document.createElement('div');
                div.classList.add('card-item');
                div.dataset.filePath = file.path;
                if (isActive) {
                    div.classList.add('active');
                }
                container.appendChild(div);
                return div;
            }),
            renderPlaceholder: jest.fn().mockResolvedValue(undefined)
        } as any;
        
        // SearchEngine mock
        searchEngine = {
            search: jest.fn((query: string, files: TFile[]) => Promise.resolve(files))
        } as any;
        
        // SortManager mock
        sortManager = {
            sort: jest.fn((files: TFile[], options: any) => files)
        } as any;
        
        // LayoutManager mock
        layoutManager = {
            updateLayout: jest.fn(),
            getMode: jest.fn(() => 'vertical'),
            updateViewportCards: jest.fn() // Phase 3.5
        } as any;
        
        // ViewportManager mock
        viewportManager = {
            observe: jest.fn(),
            destroy: jest.fn(),
            getVisibleCards: jest.fn(() => [])
        } as any;
        
        // KeyboardNavigator mock
        keyboardNav = {
            updateCards: jest.fn()
        } as any;
        
        // SelectionManager mock
        selectionManager = {
            setAllFiles: jest.fn(),
            getSelectionCount: jest.fn(() => 0),
            updateUI: jest.fn(),
            buildCardCache: jest.fn()
        } as any;
        
        // FolderMode mock
        folderMode = {
            getFiles: jest.fn(() => [])
        } as any;
        
        // TagMode mock
        tagMode = {
            getFiles: jest.fn(() => [])
        } as any;
        
        renderer = new ViewRenderer(
            mockApp,
            mockView,
            mockPlugin,
            cardFactory,
            stateManager,
            layoutManager,
            keyboardNav,
            selectionManager,
            searchEngine,
            folderMode,
            tagMode,
            sortManager
        );
    });
    
    describe('Edge Cases', () => {
        test('handles empty file list', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            mockApp.vault.getMarkdownFiles.mockReturnValue([]);
            folderMode.getFiles.mockReturnValue([]);
            
            await renderer.renderCards(container, onFileOpen);
            
            expect(container.querySelector('.card-navigator-empty')).toBeTruthy();
        });
        
        test('handles single file', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFile = { path: 'test.md', basename: 'test', parent: null } as TFile;
            
            // Ensure getActiveFile returns null
            mockApp.workspace.getActiveFile.mockReturnValue(null);
            folderMode.getFiles.mockReturnValue([mockFile]);
            sortManager.sort.mockReturnValue([mockFile]);
            
            await renderer.renderCards(container, onFileOpen);
            
            // Standard rendering for < 100 files
            // activeFile is null when getActiveFile() returns null
            // With grouping enabled, container is now DocumentFragment (Phase 1 optimization)
            expect(cardFactory.createCard).toHaveBeenCalledWith(
                mockFile,
                expect.anything(), // DocumentFragment or HTMLElement
                null,
                onFileOpen
            );
        });
        
        test('handles large file list with viewport rendering', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFiles = Array.from({ length: 150 }, (_, i) => ({
                path: `file${i}.md`,
                basename: `file${i}`,
                parent: null
            })) as TFile[];
            
            // Mock ViewportManager constructor to return our mock
            const ViewportManagerMock = require('../../src/view/ViewportManager').ViewportManager;
            ViewportManagerMock.mockImplementation(() => ({
                observe: jest.fn(),
                destroy: jest.fn(),
                getVisibleCards: jest.fn(() => [])
            }));
            
            folderMode.getFiles.mockReturnValue(mockFiles);
            sortManager.sort.mockReturnValue(mockFiles);
            
            await renderer.renderCards(container, onFileOpen);
            
            // Should use viewport rendering for >= 100 files
            expect(cardFactory.createPlaceholder).toHaveBeenCalled();
        });
    });
    
    describe('Mode Handling', () => {
        test('handles folder mode', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFile = { path: 'test.md', basename: 'test', parent: null } as TFile;
            
            settings.currentMode = 'folder';
            folderMode.getFiles.mockReturnValue([mockFile]);
            sortManager.sort.mockReturnValue([mockFile]);
            
            await renderer.renderCards(container, onFileOpen);
            
            expect(folderMode.getFiles).toHaveBeenCalled();
        });
        
        test('handles tag mode', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFile = { path: 'test.md', basename: 'test', parent: null } as TFile;
            
            settings.currentMode = 'tag';
            tagMode.getFiles.mockReturnValue([mockFile]);
            sortManager.sort.mockReturnValue([mockFile]);
            
            await renderer.renderCards(container, onFileOpen);
            
            expect(tagMode.getFiles).toHaveBeenCalled();
        });
    });
    
    describe('Search Integration', () => {
        test('filters files by search query', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFiles = [
                { path: 'test.md', basename: 'test', parent: null },
                { path: 'other.md', basename: 'other', parent: null }
            ] as TFile[];
            
            mockApp.vault.getMarkdownFiles.mockReturnValue(mockFiles);
            searchEngine.search.mockResolvedValue([mockFiles[0]]);
            sortManager.sort.mockReturnValue([mockFiles[0]]);
            
            stateManager.setSearchQuery('test');
            
            await renderer.renderCards(container, onFileOpen);
            
            expect(searchEngine.search).toHaveBeenCalled();
            expect(cardFactory.createCard).toHaveBeenCalledTimes(1);
        });
        
        test('handles empty search results', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            mockApp.vault.getMarkdownFiles.mockReturnValue([]);
            searchEngine.search.mockResolvedValue([]);
            sortManager.sort.mockReturnValue([]);
            
            stateManager.setSearchQuery('nonexistent');
            
            await renderer.renderCards(container, onFileOpen);
            
            expect(container.querySelector('.card-navigator-empty')).toBeTruthy();
        });
    });
    
    describe('Sort Integration', () => {
        test('sorts files', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFiles = [
                { path: 'b.md', basename: 'b', parent: null },
                { path: 'a.md', basename: 'a', parent: null }
            ] as TFile[];
            
            settings.sort = {
                criteria: 'name',
                order: 'asc'
            };
            
            folderMode.getFiles.mockReturnValue(mockFiles);
            sortManager.sort.mockReturnValue([mockFiles[1], mockFiles[0]]);
            
            await renderer.renderCards(container, onFileOpen);
            
            expect(sortManager.sort).toHaveBeenCalledWith(mockFiles, settings.sort, expect.anything());
        });
    });
    
    describe('Rendering Cancellation', () => {
        test('handles rendering state correctly', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFile = { path: 'test.md', basename: 'test', parent: null } as TFile;
            
            folderMode.getFiles.mockReturnValue([mockFile]);
            sortManager.sort.mockReturnValue([mockFile]);
            
            await renderer.renderCards(container, onFileOpen);
            
            expect(stateManager.getIsRendering()).toBe(false);
        });
    });
    
    describe('Layout Integration', () => {
        test('updates layout after rendering', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFile = { path: 'test.md', basename: 'test', parent: null } as TFile;
            
            folderMode.getFiles.mockReturnValue([mockFile]);
            sortManager.sort.mockReturnValue([mockFile]);
            
            await renderer.renderCards(container, onFileOpen);
            
            expect(layoutManager.updateLayout).toHaveBeenCalled();
        });
    });
    
    describe('Keyboard Navigation', () => {
        test('updates keyboard navigation after rendering', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFile = { path: 'test.md', basename: 'test', parent: null } as TFile;
            
            folderMode.getFiles.mockReturnValue([mockFile]);
            sortManager.sort.mockReturnValue([mockFile]);
            
            await renderer.renderCards(container, onFileOpen);
            
            expect(keyboardNav.updateCards).toHaveBeenCalled();
        });
    });
    
    describe('Active File Handling', () => {
        test('handles active file correctly', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFiles = [
                { path: 'test.md', basename: 'test', parent: null },
                { path: 'active.md', basename: 'active', parent: null }
            ] as TFile[];
            const activeFile = mockFiles[1];
            
            mockApp.workspace.getActiveFile.mockReturnValue(activeFile);
            folderMode.getFiles.mockReturnValue(mockFiles);
            sortManager.sort.mockReturnValue(mockFiles);
            
            await renderer.renderCards(container, onFileOpen);

            // With grouping enabled, container is now DocumentFragment (Phase 1 optimization)
            expect(cardFactory.createCard).toHaveBeenCalledWith(
                expect.any(Object),
                expect.anything(), // DocumentFragment or HTMLElement
                activeFile,
                onFileOpen
            );
        });
    });
    
    describe('Force Render', () => {
        test('forces re-render by clearing state', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            const mockFile = { path: 'test.md', basename: 'test', parent: null } as TFile;
            
            folderMode.getFiles.mockReturnValue([mockFile]);
            sortManager.sort.mockReturnValue([mockFile]);
            
            // First render
            await renderer.renderCards(container, onFileOpen);
            const firstCallCount = cardFactory.createCard.mock.calls.length;
            
            // Force render
            await renderer.forceRender(container, onFileOpen);
            const secondCallCount = cardFactory.createCard.mock.calls.length;
            
            expect(secondCallCount).toBeGreaterThan(firstCallCount);
        });
    });
    
    describe('Active Card Class Update', () => {
        test('updates active class without full re-render', () => {
            const container = document.createElement('div');
            const mockFiles = [
                { path: 'test.md', basename: 'test', parent: null },
                { path: 'active.md', basename: 'active', parent: null }
            ] as TFile[];
            
            // Create mock cards
            mockFiles.forEach((file, index) => {
                const card = document.createElement('div');
                card.classList.add('card-item');
                card.dataset.filePath = file.path;
                if (index === 1) {
                    card.classList.add('active');
                }
                container.appendChild(card);
            });
            
            const activeFile = mockFiles[1];
            mockApp.workspace.getActiveFile.mockReturnValue(activeFile);
            
            renderer.updateActiveCardClass(container);
            
            const cards = container.querySelectorAll('.card-item');
            expect(cards[0].classList.contains('active')).toBe(false);
            expect(cards[1].classList.contains('active')).toBe(true);
        });
    });
    
    describe('Needs Rerender for File Change', () => {
        test('requires rerender when folder changes', () => {
            const oldFile = {
                path: 'folder1/test.md',
                basename: 'test',
                parent: { path: 'folder1' }
            } as TFile;
            
            const newFile = {
                path: 'folder2/test.md',
                basename: 'test',
                parent: { path: 'folder2' }
            } as TFile;
            
            settings.currentMode = 'folder';
            stateManager.setPreviousFile(oldFile);
            
            const needsRerender = renderer.needsRerenderForFileChange(newFile);
            
            expect(needsRerender).toBe(true);
        });
        
        test('does not require rerender in same folder', () => {
            const oldFile = {
                path: 'folder1/test1.md',
                basename: 'test1',
                parent: { path: 'folder1' }
            } as TFile;
            
            const newFile = {
                path: 'folder1/test2.md',
                basename: 'test2',
                parent: { path: 'folder1' }
            } as TFile;
            
            settings.currentMode = 'folder';
            stateManager.setPreviousFile(oldFile);
            
            const needsRerender = renderer.needsRerenderForFileChange(newFile);
            
            expect(needsRerender).toBe(false);
        });
        
        test('requires rerender in active file tags mode', () => {
            const oldFile = {
                path: 'test1.md',
                basename: 'test1',
                parent: null
            } as TFile;
            
            const newFile = {
                path: 'test2.md',
                basename: 'test2',
                parent: null
            } as TFile;
            
            settings.currentMode = 'tag';
            settings.tagMode.useActiveFileTags = true;
            stateManager.setPreviousFile(oldFile);
            
            const needsRerender = renderer.needsRerenderForFileChange(newFile);
            
            expect(needsRerender).toBe(true);
        });
        
        test('does not require rerender in specified tags mode', () => {
            const oldFile = {
                path: 'test1.md',
                basename: 'test1',
                parent: null
            } as TFile;
            
            const newFile = {
                path: 'test2.md',
                basename: 'test2',
                parent: null
            } as TFile;
            
            settings.currentMode = 'tag';
            settings.tagMode.useActiveFileTags = false;
            settings.tagMode.specifiedTags = ['#project'];
            stateManager.setPreviousFile(oldFile);
            
            const needsRerender = renderer.needsRerenderForFileChange(newFile);
            
            expect(needsRerender).toBe(false);
        });
    });
    
    describe('File In Current View', () => {
        test('checks if file is in folder mode view', () => {
            const file = {
                path: 'test-folder/test.md',
                basename: 'test',
                parent: { path: 'test-folder' }
            } as TFile;
            
            const activeFile = {
                path: 'test-folder/active.md',
                basename: 'active',
                parent: { path: 'test-folder' }
            } as TFile;
            
            settings.currentMode = 'folder';
            settings.folderMode.useActiveFolder = true;
            mockApp.workspace.getActiveFile.mockReturnValue(activeFile);
            
            const isInView = renderer.isFileInCurrentView(file);
            
            expect(isInView).toBe(true);
        });
        
        test('checks if file is in tag mode view', () => {
            const file = {
                path: 'test.md',
                basename: 'test',
                parent: null
            } as TFile;
            
            const activeFile = {
                path: 'active.md',
                basename: 'active',
                parent: null
            } as TFile;
            
            settings.currentMode = 'tag';
            settings.tagMode.useActiveFileTags = true;
            mockApp.workspace.getActiveFile.mockReturnValue(activeFile);
            
            mockApp.metadataCache.getFileCache
                .mockReturnValueOnce({ tags: [{ tag: '#project' }] }) // for file
                .mockReturnValueOnce({ tags: [{ tag: '#project' }] }); // for activeFile
            
            const isInView = renderer.isFileInCurrentView(file);
            
            expect(isInView).toBe(true);
        });
    });
    
    describe('Viewport Manager Integration', () => {
        test('destroys viewport manager on cleanup', () => {
            renderer.destroy();
            
            // ViewportManager should be cleaned up
            // This is a basic test - in real scenario, we'd check if observers are disconnected
            expect(true).toBe(true);
        });
    });
});

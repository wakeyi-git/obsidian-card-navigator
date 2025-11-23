import { App, TFile, Vault, Workspace, MarkdownView, Editor } from 'obsidian';
import { DragDropHandler } from '../../src/utils/DragDropHandler';
import { CardNavigatorSettings } from '../../src/types';
import { createMockSettings } from '../__mocks__/settings';

// Mock DebugLogger
jest.mock('../../src/utils/DebugLogger');

describe('DragDropHandler', () => {
    let app: App;
    let vault: Vault;
    let workspace: Workspace;
    let handler: DragDropHandler;
    let mockSettings: CardNavigatorSettings;
    
    beforeEach(() => {
        // Mock Vault
        vault = {
            read: jest.fn(),
            modify: jest.fn(),
            getAbstractFileByPath: jest.fn()
        } as unknown as Vault;
        
        // Mock Workspace
        workspace = {
            getActiveViewOfType: jest.fn()
        } as unknown as Workspace;
        
        // Mock App
        app = {
            vault,
            workspace
        } as App;
        
        // Mock Settings using helper
        mockSettings = createMockSettings({
            dragDrop: {
                contentType: 'link',
                fullContentOptions: {
                    includeFrontmatter: false,
                    enableLengthLimit: true,
                    maxLength: 1000
                }
            },
            debug: {
                enabled: false,
                categories: {}
            }
        });
        
        // Create handler with settings getter
        handler = new DragDropHandler(app, () => mockSettings);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Constructor', () => {
        it('should create instance with app', () => {
            expect(handler).toBeDefined();
        });
        
        it('should create instance without settings getter', () => {
            const handlerWithoutSettings = new DragDropHandler(app);
            expect(handlerWithoutSettings).toBeDefined();
        });
    });
    
    describe('setupDraggable()', () => {
        let cardEl: HTMLElement;
        let mockFile: TFile;
        
        beforeEach(() => {
            // Create card element
            cardEl = document.createElement('div');
            cardEl.addClass = jest.fn();
            cardEl.removeClass = jest.fn();
            
            // Mock file
            mockFile = {
                path: 'test.md',
                basename: 'test',
                extension: 'md'
            } as TFile;
        });
        
        it('should make element draggable', () => {
            handler.setupDraggable(cardEl, mockFile);
            
            expect(cardEl.draggable).toBe(true);
            expect(cardEl.getAttribute('data-file-path')).toBe('test.md');
        });
        
        it('should return drag state object', () => {
            const dragState = handler.setupDraggable(cardEl, mockFile);
            
            expect(dragState).toBeDefined();
            expect(typeof dragState.isDragging).toBe('function');
        });
        
        it('should initialize isDragging as false', () => {
            const dragState = handler.setupDraggable(cardEl, mockFile);
            
            expect(dragState.isDragging()).toBe(false);
        });
        
        it('should set isDragging to true on dragstart', () => {
            const dragState = handler.setupDraggable(cardEl, mockFile);
            
            const mockDataTransfer = {
                setData: jest.fn(),
                effectAllowed: ''
            };
            
            const dragStartEvent = new DragEvent('dragstart', {
                bubbles: true,
                cancelable: true
            });
            
            Object.defineProperty(dragStartEvent, 'dataTransfer', {
                value: mockDataTransfer
            });
            
            cardEl.dispatchEvent(dragStartEvent);
            
            expect(dragState.isDragging()).toBe(true);
        });
        
        it('should set isDragging to false after dragend with delay', async () => {
            const dragState = handler.setupDraggable(cardEl, mockFile);
            
            // Start drag
            const mockDataTransfer = {
                setData: jest.fn(),
                effectAllowed: ''
            };
            
            const dragStartEvent = new DragEvent('dragstart');
            Object.defineProperty(dragStartEvent, 'dataTransfer', {
                value: mockDataTransfer
            });
            
            cardEl.dispatchEvent(dragStartEvent);
            expect(dragState.isDragging()).toBe(true);
            
            // End drag
            cardEl.dispatchEvent(new DragEvent('dragend'));
            
            // Should still be true immediately
            expect(dragState.isDragging()).toBe(true);
            
            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(dragState.isDragging()).toBe(false);
        });
    });
    
    describe('Drag Events', () => {
        let cardEl: HTMLElement;
        let mockFile: TFile;
        
        beforeEach(() => {
            cardEl = document.createElement('div');
            cardEl.addClass = jest.fn();
            cardEl.removeClass = jest.fn();
            
            mockFile = {
                path: 'test.md',
                basename: 'test',
                extension: 'md'
            } as TFile;
            
            handler.setupDraggable(cardEl, mockFile);
        });
        
        describe('dragstart', () => {
            it('should set drag data with link when contentType is link', () => {
                mockSettings.dragDrop.contentType = 'link';
                
                const mockDataTransfer = {
                    setData: jest.fn(),
                    effectAllowed: ''
                };
                
                const dragStartEvent = new DragEvent('dragstart');
                Object.defineProperty(dragStartEvent, 'dataTransfer', {
                    value: mockDataTransfer
                });
                
                cardEl.dispatchEvent(dragStartEvent);
                
                expect(mockDataTransfer.setData).toHaveBeenCalledWith(
                    'text/plain',
                    '[[test]]'
                );
                expect(mockDataTransfer.setData).toHaveBeenCalledWith(
                    'file-path',
                    JSON.stringify(['test.md'])
                );
                expect(mockDataTransfer.effectAllowed).toBe('copyLink');
            });
            
            it('should add dragging class', () => {
                const mockDataTransfer = {
                    setData: jest.fn(),
                    effectAllowed: ''
                };
                
                const dragStartEvent = new DragEvent('dragstart');
                Object.defineProperty(dragStartEvent, 'dataTransfer', {
                    value: mockDataTransfer
                });
                
                cardEl.dispatchEvent(dragStartEvent);
                
                expect(cardEl.addClass).toHaveBeenCalledWith('dragging');
            });
            
            it('should not crash if dataTransfer is null', () => {
                const dragStartEvent = new DragEvent('dragstart');
                
                expect(() => {
                    cardEl.dispatchEvent(dragStartEvent);
                }).not.toThrow();
            });
        });
        
        describe('dragend', () => {
            it('should remove dragging class', () => {
                cardEl.dispatchEvent(new DragEvent('dragend'));
                
                expect(cardEl.removeClass).toHaveBeenCalledWith('dragging');
            });
        });
    });
    
    describe('Drop Target Events', () => {
        let cardEl: HTMLElement;
        let mockFile: TFile;
        
        beforeEach(() => {
            cardEl = document.createElement('div');
            cardEl.addClass = jest.fn();
            cardEl.removeClass = jest.fn();
            
            mockFile = {
                path: 'target.md',
                basename: 'target',
                extension: 'md'
            } as TFile;
            
            handler.setupDraggable(cardEl, mockFile);
        });
        
        describe('dragover', () => {
            it('should prevent default and set drop effect', () => {
                const mockDataTransfer = {
                    dropEffect: ''
                };
                
                const dragOverEvent = new DragEvent('dragover', {
                    cancelable: true
                });
                Object.defineProperty(dragOverEvent, 'dataTransfer', {
                    value: mockDataTransfer
                });
                
                const preventDefaultSpy = jest.spyOn(dragOverEvent, 'preventDefault');
                
                cardEl.dispatchEvent(dragOverEvent);
                
                expect(preventDefaultSpy).toHaveBeenCalled();
                expect(mockDataTransfer.dropEffect).toBe('link');
                expect(cardEl.addClass).toHaveBeenCalledWith('drop-target');
            });
        });
        
        describe('dragleave', () => {
            it('should remove drop-target class', () => {
                cardEl.dispatchEvent(new DragEvent('dragleave'));
                
                expect(cardEl.removeClass).toHaveBeenCalledWith('drop-target');
            });
        });
        
        describe('drop', () => {
            it('should prevent default and stop propagation', () => {
                const mockDataTransfer = {
                    getData: jest.fn().mockReturnValue('')
                };
                
                const dropEvent = new DragEvent('drop', {
                    cancelable: true,
                    bubbles: true
                });
                Object.defineProperty(dropEvent, 'dataTransfer', {
                    value: mockDataTransfer
                });
                
                const preventDefaultSpy = jest.spyOn(dropEvent, 'preventDefault');
                const stopPropagationSpy = jest.spyOn(dropEvent, 'stopPropagation');
                
                cardEl.dispatchEvent(dropEvent);
                
                expect(preventDefaultSpy).toHaveBeenCalled();
                expect(stopPropagationSpy).toHaveBeenCalled();
            });
            
            it('should remove drop-target class', () => {
                const mockDataTransfer = {
                    getData: jest.fn().mockReturnValue('')
                };
                
                const dropEvent = new DragEvent('drop');
                Object.defineProperty(dropEvent, 'dataTransfer', {
                    value: mockDataTransfer
                });
                
                cardEl.dispatchEvent(dropEvent);
                
                expect(cardEl.removeClass).toHaveBeenCalledWith('drop-target');
            });
            
            it('should not process drop if dataTransfer is null', () => {
                const dropEvent = new DragEvent('drop');
                
                expect(() => {
                    cardEl.dispatchEvent(dropEvent);
                }).not.toThrow();
                
                expect(vault.read).not.toHaveBeenCalled();
            });
            
            it('should not process drop if file path is empty', () => {
                const mockDataTransfer = {
                    getData: jest.fn().mockReturnValue('')
                };
                
                const dropEvent = new DragEvent('drop');
                Object.defineProperty(dropEvent, 'dataTransfer', {
                    value: mockDataTransfer
                });
                
                cardEl.dispatchEvent(dropEvent);
                
                expect(vault.read).not.toHaveBeenCalled();
            });
            
            it('should not process drop if same file', () => {
                const mockDataTransfer = {
                    getData: jest.fn().mockReturnValue('target.md')
                };
                
                const dropEvent = new DragEvent('drop');
                Object.defineProperty(dropEvent, 'dataTransfer', {
                    value: mockDataTransfer
                });
                
                cardEl.dispatchEvent(dropEvent);
                
                expect(vault.read).not.toHaveBeenCalled();
            });
        });
    });
    
    describe('setupEditorDropZone()', () => {
        it('should setup editor drop zone without error', () => {
            expect(() => {
                handler.setupEditorDropZone();
            }).not.toThrow();
        });
    });
    
    describe('File Content for Drag', () => {
        let mockFile: TFile;
        
        beforeEach(() => {
            mockFile = {
                path: 'test.md',
                basename: 'test',
                extension: 'md'
            } as TFile;
        });
        
        it('should cache file content on mousedown', async () => {
            mockSettings.dragDrop.contentType = 'full-content';
            
            const fileContent = '---\ntitle: Test\n---\n\nContent here';
            (vault.read as jest.Mock).mockResolvedValue(fileContent);
            
            const cardEl = document.createElement('div');
            cardEl.addClass = jest.fn();
            cardEl.removeClass = jest.fn();
            
            handler.setupDraggable(cardEl, mockFile);
            
            // Simulate mousedown
            await cardEl.dispatchEvent(new MouseEvent('mousedown'));
            
            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 10));
            
            expect(vault.read).toHaveBeenCalledWith(mockFile);
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle multiple setup calls on same element', () => {
            const cardEl = document.createElement('div');
            cardEl.addClass = jest.fn();
            cardEl.removeClass = jest.fn();
            
            const mockFile = {
                path: 'test.md',
                basename: 'test',
                extension: 'md'
            } as TFile;
            
            expect(() => {
                handler.setupDraggable(cardEl, mockFile);
                handler.setupDraggable(cardEl, mockFile);
            }).not.toThrow();
        });
        
        it('should handle drag events without proper setup', () => {
            const cardEl = document.createElement('div');
            
            expect(() => {
                cardEl.dispatchEvent(new DragEvent('dragstart'));
                cardEl.dispatchEvent(new DragEvent('dragend'));
            }).not.toThrow();
        });
    });
});
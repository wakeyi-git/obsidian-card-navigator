/**
 * ViewEventHandler 테스트
 * 
 * 카드 이벤트 핸들링을 테스트합니다.
 */

import { TFile, App } from 'obsidian';
import { ViewEventHandler } from '../../src/view/ViewEventHandler';
import { DragDropHandler } from '../../src/utils/DragDropHandler';
import { CardContextMenu } from '../../src/ui/ContextMenu';
import { SelectionManager } from '../../src/selection/SelectionManager';
import { DEFAULT_SETTINGS } from '../../src/types';

// Mock dependencies
jest.mock('../../src/utils/DragDropHandler');
jest.mock('../../src/ui/ContextMenu');
jest.mock('../../src/selection/SelectionManager');

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

describe('ViewEventHandler', () => {
    let handler: ViewEventHandler;
    let mockApp: App;
    let mockDragDropHandler: jest.Mocked<DragDropHandler>;
    let mockContextMenu: jest.Mocked<CardContextMenu>;
    let mockSelectionManager: jest.Mocked<SelectionManager>;
    let onFileOpenCallback: jest.Mock;
    let testFile: TFile;
    
    beforeEach(() => {
        mockApp = {} as App;
        
        // Setup DragDropHandler mock
        mockDragDropHandler = {
            setupDraggable: jest.fn().mockReturnValue({
                isDragging: jest.fn().mockReturnValue(false)
            })
        } as any;
        
        // Setup CardContextMenu mock
        mockContextMenu = {
            show: jest.fn()
        } as any;
        
        // Setup SelectionManager mock
        mockSelectionManager = {
            toggleSelection: jest.fn(),
            clearSelection: jest.fn(),
            getSelectedFiles: jest.fn().mockReturnValue([]),
            isSelected: jest.fn().mockReturnValue(false)
        } as any;
        
        handler = new ViewEventHandler(
            mockApp,
            mockDragDropHandler,
            mockContextMenu,
            mockSelectionManager,
            () => DEFAULT_SETTINGS
        );
        
        onFileOpenCallback = jest.fn();
        testFile = createMockFile('Test File');
        
        jest.clearAllMocks();
    });
    
    describe('bindCardEvents', () => {
        let card: HTMLElement;
        
        beforeEach(() => {
            card = document.createElement('div');
            card.classList.add('cn-card');
            document.body.appendChild(card);
        });
        
        afterEach(() => {
            document.body.removeChild(card);
        });
        
        it('should bind events to card', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            expect(mockDragDropHandler.setupDraggable).toHaveBeenCalledWith(card, testFile);
        });
        
        it('should add hover class on mouseenter', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const event = new MouseEvent('mouseenter');
            card.dispatchEvent(event);
            
            expect(card.classList.contains('card-item-hover')).toBe(true);
        });
        
        it('should remove hover class on mouseleave', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            card.classList.add('card-item-hover');
            const event = new MouseEvent('mouseleave');
            card.dispatchEvent(event);
            
            expect(card.classList.contains('card-item-hover')).toBe(false);
        });
        
        it('should open file on click', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const event = new MouseEvent('click', { bubbles: true });
            card.dispatchEvent(event);
            
            expect(onFileOpenCallback).toHaveBeenCalledWith(testFile);
        });
        
        it('should not open file when dragging', () => {
            const dragState = {
                isDragging: jest.fn().mockReturnValue(true)
            };
            mockDragDropHandler.setupDraggable.mockReturnValue(dragState as any);
            
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const event = new MouseEvent('click', { bubbles: true });
            card.dispatchEvent(event);
            
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });
        
        it('should toggle selection with modifier key', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const event = new MouseEvent('click', { 
                bubbles: true,
                ctrlKey: true
            });
            card.dispatchEvent(event);
            
            expect(mockSelectionManager.toggleSelection).toHaveBeenCalledWith(testFile, event);
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });
        
        it('should show context menu on right click', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const event = new MouseEvent('contextmenu', { bubbles: true });
            card.dispatchEvent(event);
            
            expect(mockContextMenu.show).toHaveBeenCalledWith(event, testFile);
        });
        
        it('should not open file when clicking on tag', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const tag = document.createElement('a');
            tag.classList.add('tag-link');
            card.appendChild(tag);
            
            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: tag, enumerable: true });
            card.dispatchEvent(event);
            
            // 태그 클릭은 무시되어야 함
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });
        
        it('should not open file when clicking on internal link', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const link = document.createElement('a');
            link.classList.add('internal-link');
            card.appendChild(link);
            
            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: link, enumerable: true });
            card.dispatchEvent(event);
            
            // 내부 링크 클릭은 무시되어야 함
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });
    });
    
    describe('Multiple Cards', () => {
        it('should bind events to multiple cards independently', () => {
            const card1 = document.createElement('div');
            const card2 = document.createElement('div');
            const file1 = createMockFile('File 1');
            const file2 = createMockFile('File 2');
            
            document.body.appendChild(card1);
            document.body.appendChild(card2);
            
            handler.bindCardEvents(card1, file1, onFileOpenCallback);
            handler.bindCardEvents(card2, file2, onFileOpenCallback);
            
            // Click first card
            card1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(onFileOpenCallback).toHaveBeenCalledWith(file1);
            
            onFileOpenCallback.mockClear();
            
            // Click second card
            card2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(onFileOpenCallback).toHaveBeenCalledWith(file2);
            
            document.body.removeChild(card1);
            document.body.removeChild(card2);
        });
    });
    
    describe('Edge Cases', () => {
        let card: HTMLElement;
        
        beforeEach(() => {
            card = document.createElement('div');
            document.body.appendChild(card);
        });
        
        afterEach(() => {
            document.body.removeChild(card);
        });
        
        it('should handle multiple event bindings', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const event = new MouseEvent('click', { bubbles: true });
            card.dispatchEvent(event);
            
            // 이벤트가 여러 번 바인딩되어 콜백이 여러 번 호출될 수 있음
            expect(onFileOpenCallback).toHaveBeenCalled();
        });
        
        it('should handle clicks with multiple modifier keys', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const event = new MouseEvent('click', {
                bubbles: true,
                ctrlKey: true,
                shiftKey: true
            });
            card.dispatchEvent(event);
            
            expect(mockSelectionManager.toggleSelection).toHaveBeenCalledWith(testFile, event);
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });
        
        it('should handle meta key (Cmd on Mac)', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const event = new MouseEvent('click', {
                bubbles: true,
                metaKey: true
            });
            card.dispatchEvent(event);
            
            expect(mockSelectionManager.toggleSelection).toHaveBeenCalledWith(testFile, event);
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });
    });
    
    describe('Event Handler Without Settings', () => {
        it('should work without getSettings callback', () => {
            const handlerWithoutSettings = new ViewEventHandler(
                mockApp,
                mockDragDropHandler,
                mockContextMenu,
                mockSelectionManager
            );
            
            const card = document.createElement('div');
            document.body.appendChild(card);
            
            handlerWithoutSettings.bindCardEvents(card, testFile, onFileOpenCallback);
            
            const event = new MouseEvent('click', { bubbles: true });
            card.dispatchEvent(event);
            
            expect(onFileOpenCallback).toHaveBeenCalledWith(testFile);
            
            document.body.removeChild(card);
        });
    });
});

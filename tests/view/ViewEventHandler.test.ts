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
        // Setup App mock with vault
        mockApp = {
            vault: {
                getAbstractFileByPath: jest.fn((path: string) => {
                    if (path === testFile?.path) return testFile;
                    return null;
                })
            }
        } as any;

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
            card.classList.add('card-item');
            card.dataset.filePath = testFile.path;
            document.body.appendChild(card);
        });

        afterEach(() => {
            document.body.removeChild(card);
        });

        it('should setup draggable for card', () => {
            handler.bindCardEvents(card, testFile, onFileOpenCallback);

            expect(mockDragDropHandler.setupDraggable).toHaveBeenCalledWith(card, testFile);
        });
    });

    describe('setupDelegatedEvents', () => {
        let container: HTMLElement;
        let card: HTMLElement;

        beforeEach(() => {
            container = document.createElement('div');
            container.classList.add('card-container');

            card = document.createElement('div');
            card.classList.add('card-item');
            card.dataset.filePath = testFile.path;

            container.appendChild(card);
            document.body.appendChild(container);

            handler.setupDelegatedEvents(container, onFileOpenCallback);
        });

        afterEach(() => {
            document.body.removeChild(container);
        });

        it('should add hover class on mouseover', () => {
            const event = new MouseEvent('mouseover', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            container.dispatchEvent(event);

            expect(card.classList.contains('card-item-hover')).toBe(true);
        });

        it('should remove hover class on mouseout', () => {
            // First add hover
            card.classList.add('card-item-hover');

            const event = new MouseEvent('mouseout', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });
            Object.defineProperty(event, 'relatedTarget', { value: document.body, enumerable: true });

            container.dispatchEvent(event);

            expect(card.classList.contains('card-item-hover')).toBe(false);
        });

        it('should open file on click', () => {
            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            container.dispatchEvent(event);

            expect(onFileOpenCallback).toHaveBeenCalledWith(testFile);
        });

        it('should toggle selection with Ctrl key', () => {
            const event = new MouseEvent('click', {
                bubbles: true,
                ctrlKey: true
            });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            container.dispatchEvent(event);

            expect(mockSelectionManager.toggleSelection).toHaveBeenCalledWith(testFile, event);
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });

        it('should toggle selection with Shift key', () => {
            const event = new MouseEvent('click', {
                bubbles: true,
                shiftKey: true
            });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            container.dispatchEvent(event);

            expect(mockSelectionManager.toggleSelection).toHaveBeenCalledWith(testFile, event);
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });

        it('should toggle selection with Meta key (Cmd on Mac)', () => {
            const event = new MouseEvent('click', {
                bubbles: true,
                metaKey: true
            });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            container.dispatchEvent(event);

            expect(mockSelectionManager.toggleSelection).toHaveBeenCalledWith(testFile, event);
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });

        it('should show context menu on contextmenu event', () => {
            const event = new MouseEvent('contextmenu', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            container.dispatchEvent(event);

            expect(mockContextMenu.show).toHaveBeenCalledWith(event, testFile);
        });

        it('should not open file when clicking on tag', () => {
            const tag = document.createElement('span');
            tag.classList.add('tag-link');
            card.appendChild(tag);

            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: tag, enumerable: true });

            container.dispatchEvent(event);

            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });

        it('should not open file when clicking on internal link', () => {
            const link = document.createElement('a');
            link.classList.add('internal-link');
            card.appendChild(link);

            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: link, enumerable: true });

            container.dispatchEvent(event);

            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });

        it('should not setup events twice for the same container', () => {
            // Try to setup again
            handler.setupDelegatedEvents(container, onFileOpenCallback);

            // Should still work (not throw error)
            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            container.dispatchEvent(event);

            expect(onFileOpenCallback).toHaveBeenCalledWith(testFile);
        });
    });

    describe('Multiple Cards', () => {
        let container: HTMLElement;
        let card1: HTMLElement;
        let card2: HTMLElement;
        let file1: TFile;
        let file2: TFile;

        beforeEach(() => {
            file1 = createMockFile('File 1');
            file2 = createMockFile('File 2');

            mockApp.vault.getAbstractFileByPath = jest.fn((path: string) => {
                if (path === file1.path) return file1;
                if (path === file2.path) return file2;
                return null;
            });

            container = document.createElement('div');
            container.classList.add('card-container');

            card1 = document.createElement('div');
            card1.classList.add('card-item');
            card1.dataset.filePath = file1.path;

            card2 = document.createElement('div');
            card2.classList.add('card-item');
            card2.dataset.filePath = file2.path;

            container.appendChild(card1);
            container.appendChild(card2);
            document.body.appendChild(container);

            handler.setupDelegatedEvents(container, onFileOpenCallback);
        });

        afterEach(() => {
            document.body.removeChild(container);
        });

        it('should handle events for multiple cards independently', () => {
            // Click first card
            const event1 = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event1, 'target', { value: card1, enumerable: true });
            container.dispatchEvent(event1);
            expect(onFileOpenCallback).toHaveBeenCalledWith(file1);

            onFileOpenCallback.mockClear();

            // Click second card
            const event2 = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event2, 'target', { value: card2, enumerable: true });
            container.dispatchEvent(event2);
            expect(onFileOpenCallback).toHaveBeenCalledWith(file2);
        });

        it('should maintain hover state independently', () => {
            // Hover first card
            const event1 = new MouseEvent('mouseover', { bubbles: true });
            Object.defineProperty(event1, 'target', { value: card1, enumerable: true });
            container.dispatchEvent(event1);
            expect(card1.classList.contains('card-item-hover')).toBe(true);

            // Hover second card (should remove hover from first)
            const event2 = new MouseEvent('mouseover', { bubbles: true });
            Object.defineProperty(event2, 'target', { value: card2, enumerable: true });
            container.dispatchEvent(event2);

            expect(card1.classList.contains('card-item-hover')).toBe(false);
            expect(card2.classList.contains('card-item-hover')).toBe(true);
        });
    });

    describe('cleanupDelegatedEvents', () => {
        let container: HTMLElement;
        let card: HTMLElement;

        beforeEach(() => {
            container = document.createElement('div');
            container.classList.add('card-container');

            card = document.createElement('div');
            card.classList.add('card-item');
            card.dataset.filePath = testFile.path;

            container.appendChild(card);
            document.body.appendChild(container);

            handler.setupDelegatedEvents(container, onFileOpenCallback);
        });

        afterEach(() => {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        });

        it('should remove event listeners after cleanup', () => {
            handler.cleanupDelegatedEvents(container);

            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            container.dispatchEvent(event);

            // Should not be called after cleanup
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        let container: HTMLElement;
        let card: HTMLElement;

        beforeEach(() => {
            container = document.createElement('div');
            container.classList.add('card-container');

            card = document.createElement('div');
            card.classList.add('card-item');
            card.dataset.filePath = testFile.path;

            container.appendChild(card);
            document.body.appendChild(container);
        });

        afterEach(() => {
            document.body.removeChild(container);
        });

        it('should handle missing file path gracefully', () => {
            delete card.dataset.filePath;

            handler.setupDelegatedEvents(container, onFileOpenCallback);

            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            // Should not throw error
            expect(() => container.dispatchEvent(event)).not.toThrow();
            expect(onFileOpenCallback).not.toHaveBeenCalled();
        });

        it('should handle invalid file path gracefully', () => {
            card.dataset.filePath = 'non-existent.md';
            mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);

            handler.setupDelegatedEvents(container, onFileOpenCallback);

            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });

            // Should not throw error
            expect(() => container.dispatchEvent(event)).not.toThrow();
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

            const container = document.createElement('div');
            const card = document.createElement('div');
            card.classList.add('card-item');
            card.dataset.filePath = testFile.path;
            container.appendChild(card);
            document.body.appendChild(container);

            handlerWithoutSettings.setupDelegatedEvents(container, onFileOpenCallback);

            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card, enumerable: true });
            container.dispatchEvent(event);

            expect(onFileOpenCallback).toHaveBeenCalledWith(testFile);

            document.body.removeChild(container);
        });
    });
});

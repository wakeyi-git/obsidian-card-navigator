/**
 * DragDropHandler expanded tests - covering uncovered methods
 */

import { App, TFile, Vault, Workspace, MarkdownView, Editor } from 'obsidian';
import { DragDropHandler } from '../../src/utils/DragDropHandler';
import { CardNavigatorSettings } from '../../src/types';
import { createMockSettings } from '../__mocks__/settings';

// Mock DebugLogger
jest.mock('../../src/utils/DebugLogger');

describe('DragDropHandler - Expanded Coverage', () => {
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

        // Mock Settings
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

        handler = new DragDropHandler(app, () => mockSettings);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('setupDraggable - full-content mode', () => {
        it('should cache file content on mousedown for full-content mode', async () => {
            mockSettings.dragDrop.contentType = 'full-content';

            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            (vault.read as jest.Mock).mockResolvedValue('# Test\n\nContent here');

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            // Simulate mousedown
            const mousedownEvent = new MouseEvent('mousedown');
            cardEl.dispatchEvent(mousedownEvent);

            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(vault.read).toHaveBeenCalledWith(file);
        });

        it('should use cached content for dragstart in full-content mode', async () => {
            mockSettings.dragDrop.contentType = 'full-content';

            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const fileContent = '# Test\n\nContent here';
            (vault.read as jest.Mock).mockResolvedValue(fileContent);

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            // Simulate mousedown to cache content
            const mousedownEvent = new MouseEvent('mousedown');
            cardEl.dispatchEvent(mousedownEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            // Simulate dragstart
            const dragEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            cardEl.dispatchEvent(dragEvent);

            expect(dragEvent.dataTransfer?.getData('text/plain')).toBe(fileContent);
        });

        it('should fall back to link if content not cached', () => {
            mockSettings.dragDrop.contentType = 'full-content';

            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            // Simulate dragstart without mousedown (no cache)
            const dragEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            cardEl.dispatchEvent(dragEvent);

            expect(dragEvent.dataTransfer?.getData('text/plain')).toBe('[[test]]');
        });
    });

    describe('setupDropTarget', () => {
        it('should add drop-target class on dragover', () => {
            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            const dragoverEvent = new DragEvent('dragover', {
                dataTransfer: new DataTransfer()
            });

            cardEl.dispatchEvent(dragoverEvent);

            expect(cardEl.classList.contains('drop-target')).toBe(true);
        });

        it('should remove drop-target class on dragleave', () => {
            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            // Add class first
            cardEl.addClass('drop-target');

            // Simulate dragleave
            const dragleaveEvent = new DragEvent('dragleave');
            cardEl.dispatchEvent(dragleaveEvent);

            expect(cardEl.classList.contains('drop-target')).toBe(false);
        });

        it('should create bidirectional link on drop', async () => {
            const sourceFile = new TFile();
            sourceFile.path = 'source.md';
            sourceFile.basename = 'source';

            const targetFile = new TFile();
            targetFile.path = 'target.md';
            targetFile.basename = 'target';

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, targetFile);

            (vault.getAbstractFileByPath as jest.Mock).mockReturnValue(sourceFile);
            (vault.read as jest.Mock)
                .mockResolvedValueOnce('# Source\n\nSource content')
                .mockResolvedValueOnce('# Target\n\nTarget content');

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('file-path', sourceFile.path);

            const dropEvent = new DragEvent('drop', { dataTransfer });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: dataTransfer,
                writable: false
            });

            cardEl.dispatchEvent(dropEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(vault.modify).toHaveBeenCalledTimes(2);
        });

        it('should not create link when dropping on same file', async () => {
            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('file-path', file.path);

            const dropEvent = new DragEvent('drop', { dataTransfer });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: dataTransfer,
                writable: false
            });

            cardEl.dispatchEvent(dropEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(vault.modify).not.toHaveBeenCalled();
        });

        it('should not create link when file not found', async () => {
            const targetFile = new TFile();
            targetFile.path = 'target.md';
            targetFile.basename = 'target';

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, targetFile);

            (vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('file-path', 'nonexistent.md');

            const dropEvent = new DragEvent('drop', { dataTransfer });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: dataTransfer,
                writable: false
            });

            cardEl.dispatchEvent(dropEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(vault.modify).not.toHaveBeenCalled();
        });
    });

    describe('createBidirectionalLink', () => {
        it('should not add duplicate links', async () => {
            const sourceFile = new TFile();
            sourceFile.path = 'source.md';
            sourceFile.basename = 'source';

            const targetFile = new TFile();
            targetFile.path = 'target.md';
            targetFile.basename = 'target';

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, targetFile);

            // Files already have links to each other
            (vault.getAbstractFileByPath as jest.Mock).mockReturnValue(sourceFile);
            (vault.read as jest.Mock)
                .mockResolvedValueOnce('# Source\n\n[[target]]')
                .mockResolvedValueOnce('# Target\n\n[[source]]');

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('file-path', sourceFile.path);

            const dropEvent = new DragEvent('drop', { dataTransfer });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: dataTransfer,
                writable: false
            });

            cardEl.dispatchEvent(dropEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(vault.modify).not.toHaveBeenCalled();
        });

        it('should handle vault read errors', async () => {
            const sourceFile = new TFile();
            sourceFile.path = 'source.md';
            sourceFile.basename = 'source';

            const targetFile = new TFile();
            targetFile.path = 'target.md';
            targetFile.basename = 'target';

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, targetFile);

            (vault.getAbstractFileByPath as jest.Mock).mockReturnValue(sourceFile);
            (vault.read as jest.Mock).mockRejectedValue(new Error('Read failed'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('file-path', sourceFile.path);

            const dropEvent = new DragEvent('drop', { dataTransfer });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: dataTransfer,
                writable: false
            });

            cardEl.dispatchEvent(dropEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(vault.modify).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('getFileContentForDrag', () => {
        it('should remove frontmatter when option is disabled', async () => {
            mockSettings.dragDrop.contentType = 'full-content';
            mockSettings.dragDrop.fullContentOptions.includeFrontmatter = false;

            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const contentWithFrontmatter = '---\ntitle: Test\ntags: [test]\n---\n\n# Content';
            (vault.read as jest.Mock).mockResolvedValue(contentWithFrontmatter);

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            const mousedownEvent = new MouseEvent('mousedown');
            cardEl.dispatchEvent(mousedownEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            const dragEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            cardEl.dispatchEvent(dragEvent);

            const draggedContent = dragEvent.dataTransfer?.getData('text/plain') || '';
            expect(draggedContent).not.toContain('---');
            expect(draggedContent).toContain('# Content');
        });

        it('should keep frontmatter when option is enabled', async () => {
            mockSettings.dragDrop.contentType = 'full-content';
            mockSettings.dragDrop.fullContentOptions.includeFrontmatter = true;

            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const contentWithFrontmatter = '---\ntitle: Test\n---\n\n# Content';
            (vault.read as jest.Mock).mockResolvedValue(contentWithFrontmatter);

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            const mousedownEvent = new MouseEvent('mousedown');
            cardEl.dispatchEvent(mousedownEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            const dragEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            cardEl.dispatchEvent(dragEvent);

            const draggedContent = dragEvent.dataTransfer?.getData('text/plain') || '';
            expect(draggedContent).toContain('---');
            expect(draggedContent).toContain('title: Test');
        });

        it('should limit content length when enabled', async () => {
            mockSettings.dragDrop.contentType = 'full-content';
            mockSettings.dragDrop.fullContentOptions.enableLengthLimit = true;
            mockSettings.dragDrop.fullContentOptions.maxLength = 50;

            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const longContent = 'A'.repeat(100);
            (vault.read as jest.Mock).mockResolvedValue(longContent);

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            const mousedownEvent = new MouseEvent('mousedown');
            cardEl.dispatchEvent(mousedownEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            const dragEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            cardEl.dispatchEvent(dragEvent);

            const draggedContent = dragEvent.dataTransfer?.getData('text/plain') || '';
            expect(draggedContent.length).toBeLessThan(100);
            expect(draggedContent).toContain('...');
        });

        it('should not limit content length when disabled', async () => {
            mockSettings.dragDrop.contentType = 'full-content';
            mockSettings.dragDrop.fullContentOptions.enableLengthLimit = false;

            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const longContent = 'A'.repeat(100);
            (vault.read as jest.Mock).mockResolvedValue(longContent);

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            const mousedownEvent = new MouseEvent('mousedown');
            cardEl.dispatchEvent(mousedownEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            const dragEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            cardEl.dispatchEvent(dragEvent);

            const draggedContent = dragEvent.dataTransfer?.getData('text/plain') || '';
            expect(draggedContent.length).toBe(100);
        });

        it('should handle file read errors', async () => {
            mockSettings.dragDrop.contentType = 'full-content';

            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            (vault.read as jest.Mock).mockRejectedValue(new Error('Read error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const cardEl = document.createElement('div');
            handler.setupDraggable(cardEl, file);

            const mousedownEvent = new MouseEvent('mousedown');
            cardEl.dispatchEvent(mousedownEvent);

            await new Promise(resolve => setTimeout(resolve, 10));

            const dragEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            cardEl.dispatchEvent(dragEvent);

            const draggedContent = dragEvent.dataTransfer?.getData('text/plain') || '';
            // Should fall back to link
            expect(draggedContent).toBe('[[test]]');

            consoleSpy.mockRestore();
        });
    });

    describe('setupEditorDropZone', () => {
        it('should setup editor drop zone without errors', () => {
            expect(() => handler.setupEditorDropZone()).not.toThrow();
        });
    });

    describe('dragend event', () => {
        it('should remove dragging class on dragend', () => {
            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const cardEl = document.createElement('div');
            const dragState = handler.setupDraggable(cardEl, file);

            // Start drag
            const dragstartEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            cardEl.dispatchEvent(dragstartEvent);

            expect(cardEl.classList.contains('dragging')).toBe(true);

            // End drag
            const dragendEvent = new DragEvent('dragend');
            cardEl.dispatchEvent(dragendEvent);

            expect(cardEl.classList.contains('dragging')).toBe(false);
        });

        it('should update drag state after delay', async () => {
            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const cardEl = document.createElement('div');
            const dragState = handler.setupDraggable(cardEl, file);

            // Start drag
            const dragstartEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            cardEl.dispatchEvent(dragstartEvent);

            expect(dragState.isDragging()).toBe(true);

            // End drag
            const dragendEvent = new DragEvent('dragend');
            cardEl.dispatchEvent(dragendEvent);

            // Should still be true immediately
            expect(dragState.isDragging()).toBe(true);

            // Wait for timeout (100ms)
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(dragState.isDragging()).toBe(false);
        });

        it('should cancel previous dragend timeout', async () => {
            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const cardEl = document.createElement('div');
            const dragState = handler.setupDraggable(cardEl, file);

            // Start and end drag multiple times quickly
            for (let i = 0; i < 3; i++) {
                const dragstartEvent = new DragEvent('dragstart', {
                    dataTransfer: new DataTransfer()
                });
                cardEl.dispatchEvent(dragstartEvent);

                const dragendEvent = new DragEvent('dragend');
                cardEl.dispatchEvent(dragendEvent);

                await new Promise(resolve => setTimeout(resolve, 20));
            }

            // Should handle multiple rapid drag operations
            expect(dragState.isDragging()).toBe(true);

            await new Promise(resolve => setTimeout(resolve, 150));

            expect(dragState.isDragging()).toBe(false);
        });
    });

    describe('constructor without settings', () => {
        it('should work without settings function', () => {
            const handlerWithoutSettings = new DragDropHandler(app);

            const file = new TFile();
            file.path = 'test.md';
            file.basename = 'test';

            const cardEl = document.createElement('div');

            expect(() => handlerWithoutSettings.setupDraggable(cardEl, file)).not.toThrow();
        });
    });
});

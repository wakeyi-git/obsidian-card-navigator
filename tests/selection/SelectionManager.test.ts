import { App, Notice, TFile, TFolder } from 'obsidian';
import { SelectionManager } from '../../src/selection/SelectionManager';
import { CardNavigatorSettings, DEFAULT_SETTINGS } from '../../src/types';

// Mock Notice
jest.mock('obsidian', () => ({
	...jest.requireActual('obsidian'),
	Notice: jest.fn()
}));

// Mock TextInputModal and FolderSuggestModal
let mockTextInputCallback: ((value: string) => void) | null = null;
let mockFolderSuggestCallback: ((folder: any) => void) | null = null;

jest.mock('../../src/ui/modals/TextInputModal', () => ({
	TextInputModal: jest.fn().mockImplementation((app, title, placeholder, defaultValue, callback) => {
		mockTextInputCallback = callback;
		return {
			open: jest.fn(() => {
				// Simulate user input from global.prompt mock
				const value = (global as any).prompt?.() || defaultValue;
				if (value !== null && mockTextInputCallback) {
					setTimeout(() => mockTextInputCallback!(value), 0);
				}
			}),
			close: jest.fn()
		};
	})
}));

jest.mock('../../src/ui/FolderSuggestModal', () => ({
	FolderSuggestModal: jest.fn().mockImplementation((app, callback) => {
		mockFolderSuggestCallback = callback;
		return {
			open: jest.fn(() => {
				// Simulate folder selection from global mock
				const folder = (global as any).mockSelectedFolder;
				if (folder && mockFolderSuggestCallback) {
					setTimeout(() => mockFolderSuggestCallback!(folder), 0);
				}
			}),
			close: jest.fn()
		};
	})
}));

describe('SelectionManager', () => {
	let app: App;
	let manager: SelectionManager;
	let settings: CardNavigatorSettings;
	let mockFiles: TFile[];

	beforeEach(() => {
		// Clear mocks
		jest.clearAllMocks();

		// Mock Obsidian HTMLElement extensions
		HTMLElement.prototype.addClass = function(this: HTMLElement, className: string) {
			this.classList.add(className);
		};
		HTMLElement.prototype.removeClass = function(this: HTMLElement, className: string) {
			this.classList.remove(className);
		};
		HTMLElement.prototype.toggleClass = function(this: HTMLElement, className: string, force?: boolean) {
			this.classList.toggle(className, force);
		};
		HTMLElement.prototype.hasClass = function(this: HTMLElement, className: string): boolean {
			return this.classList.contains(className);
		};
		(HTMLElement.prototype as any).createDiv = function(this: HTMLElement, options?: any) {
			const div = document.createElement('div');
			if (typeof options === 'string') {
				div.className = options;
			} else if (options?.cls) {
				if (Array.isArray(options.cls)) {
					div.className = options.cls.join(' ');
				} else {
					div.className = options.cls;
				}
			}
			this.appendChild(div);
			return div;
		};
		(HTMLElement.prototype as any).createEl = function(
			this: HTMLElement,
			tag: string,
			options?: any
		) {
			const el = document.createElement(tag);
			if (options?.text) el.textContent = options.text;
			if (options?.cls) {
				if (Array.isArray(options.cls)) {
					el.className = options.cls.join(' ');
				} else {
					el.className = options.cls;
				}
			}
			if (options?.attr) {
				Object.entries(options.attr).forEach(([key, value]) => {
					el.setAttribute(key, value as string);
				});
			}
			this.appendChild(el);
			return el;
		};

		// Setup app mock
		// Create root folder mock
		const rootFolder = new TFolder();
		rootFolder.path = '/';
		rootFolder.name = '/';
		
		app = {
			vault: {
				read: jest.fn(),
				modify: jest.fn(),
				delete: jest.fn(),
				getRoot: jest.fn(() => rootFolder),
				getAllLoadedFiles: jest.fn(() => [])
			},
			fileManager: {
				renameFile: jest.fn(),
				processFrontMatter: jest.fn(async (file, fn) => {
					// Mock frontmatter processor
					const frontmatter: Record<string, any> = {};
					fn(frontmatter);
					return Promise.resolve();
				})
			}
		} as unknown as App;

		// Setup settings
		settings = {
			...DEFAULT_SETTINGS,
			debug: {
				enabled: false,
				categories: {
					View: false,
					Performance: false
				}
			}
		};

		// Create manager
		manager = new SelectionManager(app, () => settings);

		// Create mock files
		mockFiles = [
			{ path: 'file1.md', name: 'file1.md' } as TFile,
			{ path: 'file2.md', name: 'file2.md' } as TFile,
			{ path: 'file3.md', name: 'file3.md' } as TFile,
			{ path: 'file4.md', name: 'file4.md' } as TFile,
			{ path: 'file5.md', name: 'file5.md' } as TFile
		];

		manager.setAllFiles(mockFiles);

		// Setup DOM
		document.body.innerHTML = `
			<div class="card-navigator-container">
				<div class="card-item" data-file-path="file1.md"></div>
				<div class="card-item" data-file-path="file2.md"></div>
				<div class="card-item" data-file-path="file3.md"></div>
				<div class="card-item" data-file-path="file4.md"></div>
				<div class="card-item" data-file-path="file5.md"></div>
			</div>
		`;
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	describe('Basic Selection', () => {
		it('should initialize with empty selection', () => {
			expect(manager.getSelectionCount()).toBe(0);
			expect(manager.getSelectedFiles()).toEqual([]);
		});

		it('should select a single file', () => {
			const event = new MouseEvent('click');
			manager.toggleSelection(mockFiles[0], event);

			expect(manager.getSelectionCount()).toBe(1);
			expect(manager.isSelected(mockFiles[0])).toBe(true);
			expect(manager.isSelected(mockFiles[1])).toBe(false);
		});

		it('should replace selection when clicking without modifier keys', () => {
			const event = new MouseEvent('click');
			manager.toggleSelection(mockFiles[0], event);
			manager.toggleSelection(mockFiles[1], event);

			expect(manager.getSelectionCount()).toBe(1);
			expect(manager.isSelected(mockFiles[0])).toBe(false);
			expect(manager.isSelected(mockFiles[1])).toBe(true);
		});

		it('should get selected files as array', () => {
			const event = new MouseEvent('click');
			manager.toggleSelection(mockFiles[0], event);
			manager.toggleSelection(mockFiles[2], new MouseEvent('click', { ctrlKey: true }));

			const selected = manager.getSelectedFiles();
			expect(selected).toHaveLength(2);
			expect(selected).toContain(mockFiles[0]);
			expect(selected).toContain(mockFiles[2]);
		});
	});

	describe('Multi-Selection (Ctrl/Cmd)', () => {
		it('should add to selection with Ctrl key', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { ctrlKey: true }));
			manager.toggleSelection(mockFiles[2], new MouseEvent('click', { ctrlKey: true }));

			expect(manager.getSelectionCount()).toBe(3);
			expect(manager.isSelected(mockFiles[0])).toBe(true);
			expect(manager.isSelected(mockFiles[1])).toBe(true);
			expect(manager.isSelected(mockFiles[2])).toBe(true);
		});

		it('should add to selection with Meta key (Cmd on Mac)', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { metaKey: true }));

			expect(manager.getSelectionCount()).toBe(2);
			expect(manager.isSelected(mockFiles[0])).toBe(true);
			expect(manager.isSelected(mockFiles[1])).toBe(true);
		});

		it('should toggle off selected file with Ctrl key', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { ctrlKey: true }));
			
			expect(manager.getSelectionCount()).toBe(2);

			// Toggle off
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { ctrlKey: true }));

			expect(manager.getSelectionCount()).toBe(1);
			expect(manager.isSelected(mockFiles[0])).toBe(true);
			expect(manager.isSelected(mockFiles[1])).toBe(false);
		});
	});

	describe('Range Selection (Shift)', () => {
		it('should select range with Shift key', () => {
			manager.toggleSelection(mockFiles[1], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[3], new MouseEvent('click', { shiftKey: true }));

			expect(manager.getSelectionCount()).toBe(3);
			expect(manager.isSelected(mockFiles[1])).toBe(true);
			expect(manager.isSelected(mockFiles[2])).toBe(true);
			expect(manager.isSelected(mockFiles[3])).toBe(true);
		});

		it('should select range backwards', () => {
			manager.toggleSelection(mockFiles[3], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { shiftKey: true }));

			expect(manager.getSelectionCount()).toBe(3);
			expect(manager.isSelected(mockFiles[1])).toBe(true);
			expect(manager.isSelected(mockFiles[2])).toBe(true);
			expect(manager.isSelected(mockFiles[3])).toBe(true);
		});

		it('should ignore Shift key if no previous selection', () => {
			manager.toggleSelection(mockFiles[2], new MouseEvent('click', { shiftKey: true }));

			expect(manager.getSelectionCount()).toBe(1);
			expect(manager.isSelected(mockFiles[2])).toBe(true);
		});

		it('should handle range selection at edges', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[4], new MouseEvent('click', { shiftKey: true }));

			expect(manager.getSelectionCount()).toBe(5);
			mockFiles.forEach(file => {
				expect(manager.isSelected(file)).toBe(true);
			});
		});

		it('should handle single-file range', () => {
			manager.toggleSelection(mockFiles[2], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[2], new MouseEvent('click', { shiftKey: true }));

			expect(manager.getSelectionCount()).toBe(1);
			expect(manager.isSelected(mockFiles[2])).toBe(true);
		});
	});

	describe('Select All / Clear Selection', () => {
		it('should select all files', () => {
			manager.selectAll();

			expect(manager.getSelectionCount()).toBe(mockFiles.length);
			mockFiles.forEach(file => {
				expect(manager.isSelected(file)).toBe(true);
			});
			expect(Notice).toHaveBeenCalledWith(`${mockFiles.length} files selected`);
		});

		it('should clear all selections', () => {
			manager.selectAll();
			expect(manager.getSelectionCount()).toBe(mockFiles.length);

			manager.clearSelection();

			expect(manager.getSelectionCount()).toBe(0);
			mockFiles.forEach(file => {
				expect(manager.isSelected(file)).toBe(false);
			});
		});

		it('should clear selection even when empty', () => {
			expect(manager.getSelectionCount()).toBe(0);
			
			expect(() => manager.clearSelection()).not.toThrow();
			expect(manager.getSelectionCount()).toBe(0);
		});
	});

	describe('UI Updates', () => {
		it('should add selected class to card element', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));

			const card = document.querySelector('[data-file-path="file1.md"]');
			expect(card?.classList.contains('selected')).toBe(true);
		});

		it('should remove selected class when deselected', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			const card = document.querySelector('[data-file-path="file1.md"]');
			expect(card?.classList.contains('selected')).toBe(true);

			manager.clearSelection();
			expect(card?.classList.contains('selected')).toBe(false);
		});

		it('should update multiple card elements', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[2], new MouseEvent('click', { ctrlKey: true }));

			const card1 = document.querySelector('[data-file-path="file1.md"]');
			const card2 = document.querySelector('[data-file-path="file2.md"]');
			const card3 = document.querySelector('[data-file-path="file3.md"]');

			expect(card1?.classList.contains('selected')).toBe(true);
			expect(card2?.classList.contains('selected')).toBe(false);
			expect(card3?.classList.contains('selected')).toBe(true);
		});

		it('should show selection bar when files are selected', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));

			const selectionBar = document.querySelector('.selection-bar');
			expect(selectionBar).toBeTruthy();

			const countText = selectionBar?.querySelector('.selection-count');
			expect(countText?.textContent).toContain('Selected: 1 files');
		});

		it('should hide selection bar when selection is cleared', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			expect(document.querySelector('.selection-bar')).toBeTruthy();

			manager.clearSelection();
			expect(document.querySelector('.selection-bar')).toBeFalsy();
		});

		it('should update selection count in bar', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { ctrlKey: true }));

			const countText = document.querySelector('.selection-count');
			expect(countText?.textContent).toContain('Selected: 2 files');
		});

		it('should create batch action buttons', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));

			const buttons = document.querySelectorAll('.batch-action-icon');
			expect(buttons.length).toBeGreaterThan(0);

			const buttonLabels = Array.from(buttons).map(btn => btn.getAttribute('aria-label'));
			expect(buttonLabels).toContain('Add Tag');
			expect(buttonLabels).toContain('Move');
			expect(buttonLabels).toContain('Delete');
			expect(buttonLabels).toContain('Clear Selection');
		});
	});

	describe('Batch Add Tag', () => {
		beforeEach(() => {
			// Mock prompt
			global.prompt = jest.fn();
			
			// Mock vault.read to return file content
			(app.vault.read as jest.Mock).mockResolvedValue('# Test Content');
			
			// Mock vault.modify
			(app.vault.modify as jest.Mock).mockResolvedValue(undefined);
		});

		it('should add tag to files without frontmatter', async () => {
			(global.prompt as jest.Mock).mockReturnValue('newtag');
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			
			// Trigger batch add tag
			const addTagBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Add Tag') as HTMLButtonElement;
			
			addTagBtn?.click();

			// Wait for async operations
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.fileManager.processFrontMatter).toHaveBeenCalledWith(
				mockFiles[0],
				expect.any(Function)
			);
			expect(Notice).toHaveBeenCalledWith('Added #newtag tag to 1 files');
		});

		it('should handle tag with # prefix', async () => {
			(global.prompt as jest.Mock).mockReturnValue('#newtag');
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			
			const addTagBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Add Tag') as HTMLButtonElement;
			
			addTagBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.fileManager.processFrontMatter).toHaveBeenCalledWith(
				mockFiles[0],
				expect.any(Function)
			);
		});

		it('should add tag to existing frontmatter tags', async () => {
			(app.vault.read as jest.Mock).mockResolvedValue(
				'---\ntags: existing\n---\n# Content'
			);
			(global.prompt as jest.Mock).mockReturnValue('newtag');
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			
			const addTagBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Add Tag') as HTMLButtonElement;
			
			addTagBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.fileManager.processFrontMatter).toHaveBeenCalledWith(
				mockFiles[0],
				expect.any(Function)
			);
		});

		it('should cancel when prompt is cancelled', async () => {
			(global.prompt as jest.Mock).mockReturnValue(null);
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			
			const addTagBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Add Tag') as HTMLButtonElement;
			
			addTagBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.vault.modify).not.toHaveBeenCalled();
		});

		it('should cancel when empty tag is entered', async () => {
			(global.prompt as jest.Mock).mockReturnValue('');
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			
			const addTagBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Add Tag') as HTMLButtonElement;
			
			addTagBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.vault.modify).not.toHaveBeenCalled();
		});

		it('should process multiple selected files', async () => {
			(global.prompt as jest.Mock).mockReturnValue('tag');
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { ctrlKey: true }));
			
			const addTagBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Add Tag') as HTMLButtonElement;
			
			addTagBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
			expect(Notice).toHaveBeenCalledWith('Added #tag tag to 2 files');
		});

		it('should clear selection after batch add tag', async () => {
			(global.prompt as jest.Mock).mockReturnValue('tag');
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			expect(manager.getSelectionCount()).toBe(1);
			
			const addTagBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Add Tag') as HTMLButtonElement;
			
			addTagBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(manager.getSelectionCount()).toBe(0);
		});
	});

	describe('Batch Move', () => {
		beforeEach(() => {
			global.prompt = jest.fn();
			(app.fileManager.renameFile as jest.Mock).mockResolvedValue(undefined);
		});

		it('should move selected files to folder', async () => {
			(global as any).mockSelectedFolder = { path: 'new-folder', name: 'new-folder' };
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			
			const moveBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Move') as HTMLButtonElement;
			
			moveBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(app.fileManager.renameFile).toHaveBeenCalledWith(
				mockFiles[0],
				'new-folder/file1.md'
			);
			expect(Notice).toHaveBeenCalledWith('Moved 1 files to new-folder');
		});

		it('should cancel when prompt is cancelled', async () => {
			(global as any).mockSelectedFolder = null;
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			
			const moveBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Move') as HTMLButtonElement;
			
			moveBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(app.fileManager.renameFile).not.toHaveBeenCalled();
		});

		it('should move multiple files', async () => {
			(global as any).mockSelectedFolder = { path: 'archive', name: 'archive' };
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { ctrlKey: true }));
			
			const moveBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Move') as HTMLButtonElement;
			
			moveBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(app.fileManager.renameFile).toHaveBeenCalledTimes(2);
			expect(Notice).toHaveBeenCalledWith('Moved 2 files to archive');
		});

		it('should clear selection after batch move', async () => {
			(global as any).mockSelectedFolder = { path: 'folder', name: 'folder' };
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			expect(manager.getSelectionCount()).toBe(1);
			
			const moveBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Move') as HTMLButtonElement;
			
			moveBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(manager.getSelectionCount()).toBe(0);
		});
	});

	describe('Batch Delete', () => {
		beforeEach(() => {
			global.confirm = jest.fn();
			(app.vault.delete as jest.Mock).mockResolvedValue(undefined);
		});

		it('should delete selected files when confirmed', async () => {
			(global.confirm as jest.Mock).mockReturnValue(true);
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			
			const deleteBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Delete') as HTMLButtonElement;
			
			deleteBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.vault.delete).toHaveBeenCalledWith(mockFiles[0]);
			expect(Notice).toHaveBeenCalledWith('Deleted 1 files');
		});

		it('should cancel when not confirmed', async () => {
			(global.confirm as jest.Mock).mockReturnValue(false);
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			
			const deleteBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Delete') as HTMLButtonElement;
			
			deleteBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.vault.delete).not.toHaveBeenCalled();
		});

		it('should delete multiple files', async () => {
			(global.confirm as jest.Mock).mockReturnValue(true);
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { ctrlKey: true }));
			
			const deleteBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Delete') as HTMLButtonElement;
			
			deleteBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.vault.delete).toHaveBeenCalledTimes(2);
			expect(Notice).toHaveBeenCalledWith('Deleted 2 files');
		});

		it('should show confirmation message with count', async () => {
			(global.confirm as jest.Mock).mockReturnValue(false);
			
			manager.selectAll();
			
			const deleteBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Delete') as HTMLButtonElement;
			
			deleteBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(global.confirm).toHaveBeenCalledWith(
				expect.stringContaining(`Delete ${mockFiles.length} files?`)
			);
		});

		it('should clear selection after batch delete', async () => {
			(global.confirm as jest.Mock).mockReturnValue(true);
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			expect(manager.getSelectionCount()).toBe(1);
			
			const deleteBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Delete') as HTMLButtonElement;
			
			deleteBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(manager.getSelectionCount()).toBe(0);
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			// Disable console.error for error tests
			jest.spyOn(console, 'error').mockImplementation();
		});

		afterEach(() => {
			(console.error as jest.Mock).mockRestore();
		});

		it('should handle read error in batch add tag', async () => {
			global.prompt = jest.fn().mockReturnValue('tag');
			(app.vault.read as jest.Mock).mockRejectedValue(new Error('Read failed'));

			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));

			const addTagBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Add Tag') as HTMLButtonElement;

			addTagBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(Notice).toHaveBeenCalledWith('Added #tag tag to 1 files');
		});

		it('should handle modify error in batch add tag', async () => {
			global.prompt = jest.fn().mockReturnValue('tag');
			(app.vault.read as jest.Mock).mockResolvedValue('# Content');
			(app.vault.modify as jest.Mock).mockRejectedValue(new Error('Modify failed'));

			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));

			const addTagBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Add Tag') as HTMLButtonElement;

			addTagBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(Notice).toHaveBeenCalledWith('Added #tag tag to 1 files');
		});

		it('should handle move error', async () => {
			(global as any).mockSelectedFolder = { path: 'folder', name: 'folder' };
			(app.fileManager.renameFile as jest.Mock).mockRejectedValue(
				new Error('Move failed')
			);

			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));

			const moveBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Move') as HTMLButtonElement;

			moveBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(Notice).toHaveBeenCalledWith('Moved 0 files to folder');
		});

		it('should handle delete error', async () => {
			global.confirm = jest.fn().mockReturnValue(true);
			(app.vault.delete as jest.Mock).mockRejectedValue(new Error('Delete failed'));

			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));

			const deleteBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Delete') as HTMLButtonElement;

			deleteBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(Notice).toHaveBeenCalledWith('Deleted 0 files');
		});

		it('should continue processing other files when one fails', async () => {
			global.confirm = jest.fn().mockReturnValue(true);
			(app.vault.delete as jest.Mock)
				.mockRejectedValueOnce(new Error('Delete failed'))
				.mockResolvedValueOnce(undefined);

			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { ctrlKey: true }));

			const deleteBtn = Array.from(document.querySelectorAll('.batch-action-icon'))
				.find(btn => btn.getAttribute('aria-label') === 'Delete') as HTMLButtonElement;

			deleteBtn?.click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(app.vault.delete).toHaveBeenCalledTimes(2);
			expect(Notice).toHaveBeenCalledWith('Deleted 1 files');
		});
	});

	describe('Edge Cases', () => {
		it('should handle missing card element', () => {
			// Remove a card from DOM
			const card = document.querySelector('[data-file-path="file1.md"]');
			card?.remove();

			expect(() => {
				manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			}).not.toThrow();
		});

		it('should handle missing container for selection bar', () => {
			document.body.innerHTML = '';

			expect(() => {
				manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			}).not.toThrow();
		});

		it('should handle selection of file not in allFiles', () => {
			const unknownFile = { path: 'unknown.md', name: 'unknown.md' } as TFile;

			expect(() => {
				manager.toggleSelection(unknownFile, new MouseEvent('click'));
			}).not.toThrow();

			expect(manager.isSelected(unknownFile)).toBe(true);
		});

		it('should handle empty file list', () => {
			manager.setAllFiles([]);

			expect(() => {
				manager.selectAll();
			}).not.toThrow();

			expect(manager.getSelectionCount()).toBe(0);
		});

		it('should handle range selection with out of bounds index', () => {
			// When a file not in allFiles is shift-clicked, indexOf returns -1
			// The selectRange should handle this gracefully without adding undefined
			
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			expect(manager.getSelectionCount()).toBe(1);
			
			const outOfBoundsFile = { path: 'out.md', name: 'out.md' } as TFile;
			
			// Shift-click with out-of-bounds file should not crash
			expect(() => {
				manager.toggleSelection(outOfBoundsFile, new MouseEvent('click', { shiftKey: true }));
			}).not.toThrow();
			
			// After fix: should only select files 0 (no undefined in selection)
			const selected = manager.getSelectedFiles();
			expect(selected.every(f => f !== undefined)).toBe(true);
			expect(selected.every(f => f.path !== undefined)).toBe(true);
		});
	});

	describe('File List Management', () => {
		it('should update all files list', () => {
			const newFiles = [
				{ path: 'new1.md', name: 'new1.md' } as TFile,
				{ path: 'new2.md', name: 'new2.md' } as TFile
			];

			manager.setAllFiles(newFiles);
			manager.selectAll();

			expect(manager.getSelectionCount()).toBe(2);
		});

		it('should maintain selection when file list changes', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			expect(manager.isSelected(mockFiles[0])).toBe(true);

			const newFiles = [...mockFiles, { path: 'new.md', name: 'new.md' } as TFile];
			manager.setAllFiles(newFiles);

			// Selection should be maintained
			expect(manager.isSelected(mockFiles[0])).toBe(true);
		});
	});

	describe('Integration Tests', () => {
		it('should support complex selection workflow', () => {
			// Select first file
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			expect(manager.getSelectionCount()).toBe(1);

			// Add second file with Ctrl
			manager.toggleSelection(mockFiles[2], new MouseEvent('click', { ctrlKey: true }));
			expect(manager.getSelectionCount()).toBe(2);

			// Range select to fourth file
			manager.toggleSelection(mockFiles[4], new MouseEvent('click', { shiftKey: true }));
			expect(manager.getSelectionCount()).toBe(3); // files 2, 3, 4 (file 0 is cleared by Shift)

			// Deselect one with Ctrl
			manager.toggleSelection(mockFiles[3], new MouseEvent('click', { ctrlKey: true }));
			expect(manager.getSelectionCount()).toBe(2);

			// Clear all
			manager.clearSelection();
			expect(manager.getSelectionCount()).toBe(0);
		});

		it('should update UI throughout workflow', () => {
			manager.toggleSelection(mockFiles[0], new MouseEvent('click'));
			expect(document.querySelector('.selection-bar')).toBeTruthy();
			expect(document.querySelector('[data-file-path="file1.md"]')?.classList.contains('selected')).toBe(true);

			manager.toggleSelection(mockFiles[1], new MouseEvent('click', { ctrlKey: true }));
			expect(document.querySelector('.selection-count')?.textContent).toContain('2 files');

			manager.clearSelection();
			expect(document.querySelector('.selection-bar')).toBeFalsy();
			expect(document.querySelector('[data-file-path="file1.md"]')?.classList.contains('selected')).toBe(false);
		});
	});
});
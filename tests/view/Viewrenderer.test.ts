/**
 * ViewRenderer 테스트
 * 
 * 테스트 범위:
 * - 파일 목록 가져오기 (getFilesToDisplay)
 * - 상태 해시 생성 (generateStateHash)
 * - 재렌더링 필요 여부 판단 (needsRerenderForFileChange)
 * - 파일이 현재 뷰에 있는지 확인 (isFileInCurrentView)
 * - Active 클래스 업데이트 (updateActiveCardClass)
 * - 카드 렌더링 (renderCards)
 */

import { ViewRenderer } from '../../src/view/ViewRenderer';
import { CardFactory } from '../../src/view/CardFactory';
import { ViewStateManager } from '../../src/view/ViewStateManager';
import { LayoutManager } from '../../src/layout/LayoutManager';
import { KeyboardNavigator } from '../../src/navigation/KeyboardNav';
import { SelectionManager } from '../../src/selection/SelectionManager';
import { SearchEngine } from '../../src/search/SearchEngine';
import { FolderMode } from '../../src/modes/FolderMode';
import { TagMode } from '../../src/modes/TagMode';
import { SortManager } from '../../src/sort/SortManager';
import { App, TFile, TFolder, MetadataCache, Vault, Workspace } from 'obsidian';
import type { CardNavigatorSettings } from '../../src/types';

// Mock Obsidian
jest.mock('obsidian');

// Helper: Mock TFile 생성
const createMockFile = (path: string, parent?: TFolder | null): TFile => {
	const file = new TFile();
	file.path = path;
	file.basename = path.split('/').pop()?.replace('.md', '') || '';
	file.extension = 'md';
	file.parent = parent || null;
	return file;
};

// Helper: Mock TFolder 생성
const createMockFolder = (path: string): TFolder => {
	const folder = new TFolder();
	folder.path = path;
	folder.name = path.split('/').pop() || '';
	return folder;
};

// Helper: Mock HTMLElement 생성
const createMockElement = (): HTMLElement => {
	const element = document.createElement('div');
	(element as any).empty = jest.fn(() => {
		element.innerHTML = '';
	});
	(element as any).createEl = jest.fn((tag: string, options?: any) => {
		const el = document.createElement(tag);
		if (options?.cls) {
			el.className = options.cls;
		}
		if (options?.text) {
			el.textContent = options.text;
		}
		element.appendChild(el);
		return el;
	});
	return element;
};

describe('ViewRenderer', () => {
	let renderer: ViewRenderer;
	let mockApp: jest.Mocked<App>;
	let mockView: any;
	let mockPlugin: any;
	let mockCardFactory: jest.Mocked<CardFactory>;
	let mockState: ViewStateManager;
	let mockLayoutManager: jest.Mocked<LayoutManager> | null;
	let mockKeyboardNav: jest.Mocked<KeyboardNavigator>;
	let mockSelectionManager: jest.Mocked<SelectionManager>;
	let mockSearchEngine: jest.Mocked<SearchEngine>;
	let mockFolderMode: jest.Mocked<FolderMode>;
	let mockTagMode: jest.Mocked<TagMode>;
	let mockSortManager: jest.Mocked<SortManager>;
	let mockSettings: CardNavigatorSettings;
	
	// Test files
	let file1: TFile;
	let file2: TFile;
	let file3: TFile;
	let folder1: TFolder;
	let folder2: TFolder;
	
	beforeEach(() => {
		// Mock folders 생성
		folder1 = createMockFolder('folder1');
		folder2 = createMockFolder('folder2');
		
		// Mock files 생성
		file1 = createMockFile('folder1/file1.md', folder1);
		file2 = createMockFile('folder1/file2.md', folder1);
		file3 = createMockFile('folder2/file3.md', folder2);
		
		// Mock Settings (CardNavigatorSettings 전체 구조)
		mockSettings = {
			language: 'en',
			enablePresets: true,
			currentMode: 'folder',
			folderMode: {
				specifiedFolder: 'folder1',
				includeSubfolders: false,
				useActiveFolder: false
			},
			tagMode: {
				specifiedTags: [],
				useActiveFileTags: false,
				tagOperator: 'OR'
			},
			sort: {
				criteria: 'name',
				order: 'asc'
			},
			renderMode: 'plain',
			header: {
				enabled: true,
				normalContent: {
					contentType: 'filename',
					maxLength: 100,
					contentRenderMode: 'plain',
					includeFirstHeader: false
				},
				activeContent: {
					inheritFromNormal: true,
					contentType: 'filename',
					maxLength: 100,
					contentRenderMode: 'plain',
					includeFirstHeader: false
				},
				focusedContent: {
					inheritFromNormal: true,
					contentType: 'filename',
					maxLength: 100,
					contentRenderMode: 'plain',
					includeFirstHeader: false
				},
				normalStyle: {
					fontSize: 14,
					backgroundColor: 'var(--background-primary-alt)',
					borderColor: 'transparent',
					borderWidth: 0,
					borderRadius: 0
				},
				activeStyle: {
					fontSize: 14,
					backgroundColor: 'var(--background-primary-alt)',
					borderColor: 'transparent',
					borderWidth: 0,
					borderRadius: 0
				},
				focusedStyle: {
					fontSize: 14,
					backgroundColor: 'var(--background-primary-alt)',
					borderColor: 'transparent',
					borderWidth: 0,
					borderRadius: 0
				}
			},
			body: {
				enabled: true,
				normalContent: {
					contentType: 'content',
					maxLength: 200,
					contentRenderMode: 'plain',
					includeFirstHeader: false
				},
				activeContent: {
					inheritFromNormal: true,
					contentType: 'content',
					maxLength: 200,
					contentRenderMode: 'plain',
					includeFirstHeader: false
				},
				focusedContent: {
					inheritFromNormal: true,
					contentType: 'content',
					maxLength: 200,
					contentRenderMode: 'plain',
					includeFirstHeader: false
				},
				normalStyle: {
					fontSize: 13,
					backgroundColor: 'var(--background-primary)',
					borderColor: 'transparent',
					borderWidth: 0,
					borderRadius: 0
				},
				activeStyle: {
					fontSize: 13,
					backgroundColor: 'var(--background-primary)',
					borderColor: 'transparent',
					borderWidth: 0,
					borderRadius: 0
				},
				focusedStyle: {
					fontSize: 13,
					backgroundColor: 'var(--background-primary)',
					borderColor: 'transparent',
					borderWidth: 0,
					borderRadius: 0
				}
			},
			footer: {
				enabled: true,
				normalContent: {
					contentType: 'tags',
					maxLength: 50,
					contentRenderMode: 'plain',
					includeFirstHeader: false
				},
				activeContent: {
					inheritFromNormal: true,
					contentType: 'tags',
					maxLength: 50,
					contentRenderMode: 'plain',
					includeFirstHeader: false
				},
				focusedContent: {
					inheritFromNormal: true,
					contentType: 'tags',
					maxLength: 50,
					contentRenderMode: 'plain',
					includeFirstHeader: false
				},
				normalStyle: {
					fontSize: 12,
					backgroundColor: 'var(--background-primary-alt)',
					borderColor: 'transparent',
					borderWidth: 0,
					borderRadius: 0
				},
				activeStyle: {
					fontSize: 12,
					backgroundColor: 'var(--background-primary-alt)',
					borderColor: 'transparent',
					borderWidth: 0,
					borderRadius: 0
				},
				focusedStyle: {
					fontSize: 12,
					backgroundColor: 'var(--background-primary-alt)',
					borderColor: 'transparent',
					borderWidth: 0,
					borderRadius: 0
				}
			},
			normalCardStyle: {
				backgroundColor: '#ffffff',
				fontSize: 14,
				borderColor: '#e0e0e0',
				borderWidth: 1,
				borderRadius: 4
			},
			activeCardStyle: {
				backgroundColor: '#f0f0f0',
				fontSize: 14,
				borderColor: '#0078d4',
				borderWidth: 2,
				borderRadius: 4
			},
			focusedCardStyle: {
				backgroundColor: '#e8f4ff',
				fontSize: 14,
				borderColor: '#0078d4',
				borderWidth: 2,
				borderRadius: 4
			},
			layout: {
				mode: 'vertical',
				cardMinWidth: 200,
				cardMinHeight: 250,
				cardMaxWidth: 400,
				cardMaxHeight: 500,
				gap: 10
			},
			scrollBehavior: 'nearest',
			tagClickAction: 'plugin-search',
			dragDrop: {
				contentType: 'link',
				fullContentOptions: {
					includeFrontmatter: false,
					enableLengthLimit: false,
					maxLength: 1000
				}
			},
			presets: [],
			presetMappings: [],
			presetPriority: {
				mode: 'auto',
				preferredType: 'tag'
			},
			savedSearches: [],
			enableFuzzySearch: false,
			fuzzySearchThreshold: 0.3,
			grouping: {
				enabled: false,
				criteria: 'none',
				dateBasis: 'modified',
				tagMode: 'first',
				folderHierarchical: false,
				groupSort: 'name',
				groupSortOrder: 'asc',
				inheritFileSorting: true
			},
			debug: {
				enabled: false,
				categories: {}
			}
		};
		
		// Mock MetadataCache
		const mockMetadataCache = {
			getFileCache: jest.fn((file: TFile) => {
				if (file === file1) {
					return {
						tags: [{ tag: '#tag1' }, { tag: '#tag2' }]
					};
				}
				if (file === file2) {
					return {
						tags: [{ tag: '#tag1' }]
					};
				}
				return { tags: [] };
			})
		} as unknown as jest.Mocked<MetadataCache>;
		
		// Mock Workspace
		const mockWorkspace = {
			getActiveFile: jest.fn(() => file1)
		} as unknown as jest.Mocked<Workspace>;
		
		// Mock Vault
		const mockVault = {
			getMarkdownFiles: jest.fn(() => [file1, file2, file3])
		} as unknown as jest.Mocked<Vault>;
		
		// Mock App
		mockApp = {
			vault: mockVault,
			workspace: mockWorkspace,
			metadataCache: mockMetadataCache
		} as any;
		
		// Mock Plugin
		mockPlugin = {
			settingsManager: {
				getSettings: jest.fn(() => mockSettings)
			}
		};
		
		// Mock View
		mockView = {
			plugin: mockPlugin,
			getToolbar: jest.fn(() => ({
				updateFileCount: jest.fn()
			})),
			updateContextBarPath: jest.fn(),
			updateContextBarGroupList: jest.fn(),
			containerEl: {
				querySelector: jest.fn(() => null)
			}
		};
		
		// Mock CardFactory
		mockCardFactory = {
			createCard: jest.fn(),
			createPlaceholder: jest.fn(),
			renderPlaceholder: jest.fn()
		} as any;
		
		// Real ViewStateManager
		mockState = new ViewStateManager();
		
		// Mock LayoutManager
		mockLayoutManager = {
			updateLayout: jest.fn(),
			getMode: jest.fn(() => 'vertical'),
			updateViewportCards: jest.fn() // Phase 3.5
		} as any;
		
		// Mock KeyboardNavigator
		mockKeyboardNav = {
			updateCards: jest.fn()
		} as any;
		
		// Mock SelectionManager
		mockSelectionManager = {
			setAllFiles: jest.fn(),
			getSelectionCount: jest.fn(() => 0),
			isSelected: jest.fn(() => false),
			selectCard: jest.fn(),
			deselectCard: jest.fn(),
			clearSelection: jest.fn(),
			getSelectedFiles: jest.fn(() => []),
			buildCardCache: jest.fn()
		} as any;
		
		// Mock SearchEngine
		mockSearchEngine = {
			search: jest.fn(async (query: string, files: TFile[]) => {
				// 간단한 검색 구현
				return files.filter(f => f.basename.includes(query));
			})
		} as any;
		
		// Mock FolderMode
		mockFolderMode = {
			getFiles: jest.fn(() => [file1, file2])
		} as any;
		
		// Mock TagMode
		mockTagMode = {
			getFiles: jest.fn(() => [file1])
		} as any;
		
		// Mock SortManager
		mockSortManager = {
			sort: jest.fn((files: TFile[]) => files)
		} as any;
		
		// ViewRenderer 생성
		renderer = new ViewRenderer(
			mockApp,
			mockView,
			mockPlugin,
			mockCardFactory,
			mockState,
			mockLayoutManager,
			mockKeyboardNav,
			mockSelectionManager,
			mockSearchEngine,
			mockFolderMode,
			mockTagMode,
			mockSortManager
		);
	});
	
	describe('초기화', () => {
		it('should initialize with correct dependencies', () => {
			expect(renderer).toBeDefined();
			expect(renderer.viewportManager).toBeNull();
		});
	});
	
	describe('getFilesToDisplay', () => {
		it('should return files from FolderMode when no search query', async () => {
			mockSettings.currentMode = 'folder';
			mockState.setSearchQuery('');
			
			// getFilesToDisplay는 private이므로 renderCards를 통해 간접 테스트
			const container = createMockElement();
			await renderer.renderCards(container, jest.fn());
			
			expect(mockFolderMode.getFiles).toHaveBeenCalled();
			expect(mockSearchEngine.search).not.toHaveBeenCalled();
		});
		
		it('should return files from TagMode when mode is tag', async () => {
			mockSettings.currentMode = 'tag';
			mockState.setSearchQuery('');
			
			const container = createMockElement();
			await renderer.renderCards(container, jest.fn());
			
			expect(mockTagMode.getFiles).toHaveBeenCalled();
			expect(mockFolderMode.getFiles).not.toHaveBeenCalled();
		});
		
		it('should search files when search query exists', async () => {
			mockSettings.currentMode = 'folder';
			mockState.setSearchQuery('file1');
			
			const container = createMockElement();
			await renderer.renderCards(container, jest.fn());
			
			expect(mockSearchEngine.search).toHaveBeenCalledWith(
				'file1',
				[file1, file2, file3],
				false
			);
		});
		
		it('should apply sorting to files', async () => {
			mockSettings.currentMode = 'folder';
			mockState.setSearchQuery('');

			const container = createMockElement();
			await renderer.renderCards(container, jest.fn());

			expect(mockSortManager.sort).toHaveBeenCalled();
			expect(mockSortManager.sort.mock.calls[0][0]).toEqual([file1, file2]);
			expect(mockSortManager.sort.mock.calls[0][1]).toEqual(mockSettings.sort);
		});
	});
	
	describe('needsRerenderForFileChange', () => {
		it('should return false when new file is null', () => {
			const result = renderer.needsRerenderForFileChange(null);
			
			expect(result).toBe(false);
		});
		
		it('should return true on first load (no previous file)', () => {
			mockState.setPreviousFile(null);
			
			const result = renderer.needsRerenderForFileChange(file1);
			
			expect(result).toBe(true);
		});
		
		it('should return false on first load if already rendered', async () => {
			mockState.setPreviousFile(null);
			
			// 초기 렌더링 수행
			const container = createMockElement();
			await renderer.renderCards(container, jest.fn());
			
			// 이제 재렌더링 필요 없음
			const result = renderer.needsRerenderForFileChange(file1);
			
			expect(result).toBe(false);
		});
		
		it('should return false in search mode', () => {
			mockState.setPreviousFile(file1);
			mockState.setSearchQuery('test');
			
			const result = renderer.needsRerenderForFileChange(file2);
			
			expect(result).toBe(false);
		});
		
		it('should return true in active file tags mode', () => {
			mockSettings.currentMode = 'tag';
			mockSettings.tagMode.useActiveFileTags = true;
			mockState.setPreviousFile(file1);
			mockState.setSearchQuery('');
			
			const result = renderer.needsRerenderForFileChange(file2);
			
			expect(result).toBe(true);
		});
		
		it('should return false in specified tags mode', () => {
			mockSettings.currentMode = 'tag';
			mockSettings.tagMode.useActiveFileTags = false;
			mockSettings.tagMode.specifiedTags = ['#tag1'];
			mockState.setPreviousFile(file1);
			mockState.setSearchQuery('');
			
			const result = renderer.needsRerenderForFileChange(file2);
			
			expect(result).toBe(false);
		});
		
		it('should return true in folder mode when folder changes', () => {
			mockSettings.currentMode = 'folder';
			mockState.setPreviousFile(file1);
			mockState.setSearchQuery('');
			
			const result = renderer.needsRerenderForFileChange(file3);
			
			expect(result).toBe(true);
		});
		
		it('should return false in folder mode when same folder', () => {
			mockSettings.currentMode = 'folder';
			mockState.setPreviousFile(file1);
			mockState.setSearchQuery('');
			
			const result = renderer.needsRerenderForFileChange(file2);
			
			expect(result).toBe(false);
		});
	});
	
	describe('isFileInCurrentView', () => {
		it('should return true in search mode', () => {
			mockState.setSearchQuery('test');
			
			const result = renderer.isFileInCurrentView(file1);
			
			expect(result).toBe(true);
		});
		
		it('should check tag mode correctly', () => {
			mockSettings.currentMode = 'tag';
			mockSettings.tagMode.useActiveFileTags = true;
			mockState.setSearchQuery('');
			
			// file1은 #tag1, #tag2를 가짐
			// active file도 file1이므로 같은 태그
			const result = renderer.isFileInCurrentView(file1);
			
			expect(result).toBe(true);
		});
		
		it('should check folder mode correctly', () => {
			mockSettings.currentMode = 'folder';
			mockSettings.folderMode.useActiveFolder = true;
			mockState.setSearchQuery('');
			
			// active file은 file1 (folder1)
			// file2도 folder1에 있음
			const result = renderer.isFileInCurrentView(file2);
			
			expect(result).toBe(true);
		});
		
		it('should return false for file in different folder', () => {
			mockSettings.currentMode = 'folder';
			mockSettings.folderMode.useActiveFolder = true;
			mockState.setSearchQuery('');
			
			// active file은 file1 (folder1)
			// file3는 folder2에 있음
			const result = renderer.isFileInCurrentView(file3);
			
			expect(result).toBe(false);
		});
	});
	
	describe('updateActiveCardClass', () => {
		it('should update active class on cards', () => {
			const container = createMockElement();
			
			// 카드 생성
			const card1 = document.createElement('div');
			card1.className = 'card-item';
			card1.dataset.filePath = file1.path;
			container.appendChild(card1);
			
			const card2 = document.createElement('div');
			card2.className = 'card-item active';
			card2.dataset.filePath = file2.path;
			container.appendChild(card2);
			
			// active file은 file1
			mockApp.workspace.getActiveFile = jest.fn(() => file1);
			
			renderer.updateActiveCardClass(container);
			
			// card1이 active, card2는 active 제거
			expect(card1.classList.contains('active')).toBe(true);
			expect(card2.classList.contains('active')).toBe(false);
		});
		
		it('should remove active class from all cards when no active file', () => {
			const container = createMockElement();
			
			const card1 = document.createElement('div');
			card1.className = 'card-item active';
			container.appendChild(card1);
			
			mockApp.workspace.getActiveFile = jest.fn(() => null);
			
			renderer.updateActiveCardClass(container);
			
			expect(card1.classList.contains('active')).toBe(false);
		});
	});
	
	describe('renderCards - 기본 기능', () => {
		it('should render cards when files exist', async () => {
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			await renderer.renderCards(container, onFileOpen);
			
			expect(mockCardFactory.createCard).toHaveBeenCalledTimes(2);
			expect(mockLayoutManager?.updateLayout).toHaveBeenCalled();
			expect(mockKeyboardNav.updateCards).toHaveBeenCalled();
		});
		
		it('should show empty message when no files', async () => {
			mockFolderMode.getFiles = jest.fn(() => []);
			
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			await renderer.renderCards(container, onFileOpen);
			
			expect(mockCardFactory.createCard).not.toHaveBeenCalled();
			expect(container.createEl).toHaveBeenCalledWith('div', {
				cls: 'card-navigator-empty',
				text: 'No files to display'
			});
		});
		
		it('should preserve scroll position when file unchanged', async () => {
			const container = createMockElement();
			container.scrollTop = 100;
			const onFileOpen = jest.fn();
			
			// 같은 파일로 설정
			mockState.setPreviousFile(file1);
			mockApp.workspace.getActiveFile = jest.fn(() => file1);
			
			await renderer.renderCards(container, onFileOpen);
			
			expect(container.scrollTop).toBe(100);
		});
		
		it('should skip render when state unchanged', async () => {
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			// 첫 렌더링
			await renderer.renderCards(container, onFileOpen);
			const firstCallCount = (mockCardFactory.createCard as jest.Mock).mock.calls.length;
			
			// 두 번째 렌더링 (상태 동일)
			await renderer.renderCards(container, onFileOpen);
			const secondCallCount = (mockCardFactory.createCard as jest.Mock).mock.calls.length;
			
			// 두 번째는 스킵되어야 함
			expect(secondCallCount).toBe(firstCallCount);
		});
		
		it('should force render when requested', async () => {
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			// 첫 렌더링
			await renderer.renderCards(container, onFileOpen);
			const firstCallCount = (mockCardFactory.createCard as jest.Mock).mock.calls.length;
			
			// 강제 렌더링
			await renderer.forceRender(container, onFileOpen);
			const secondCallCount = (mockCardFactory.createCard as jest.Mock).mock.calls.length;
			
			// 두 번째도 실행되어야 함
			expect(secondCallCount).toBeGreaterThan(firstCallCount);
		});
	});
	
	describe('renderCards - 렌더링 취소', () => {
		it('should cancel rendering when new render starts', async () => {
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			// 렌더링 중 새 렌더링 시작
			const promise1 = renderer.renderCards(container, onFileOpen);
			const promise2 = renderer.renderCards(container, onFileOpen);
			
			await Promise.all([promise1, promise2]);
			
			// 두 번째 렌더링만 완료되어야 함
			expect(mockState.getIsRendering()).toBe(false);
		});
	});
	
	describe('viewport 렌더링', () => {
		it('should use viewport rendering for 100+ files', async () => {
			// 100개 이상의 파일 생성
			const manyFiles = Array.from({ length: 150 }, (_, i) => 
				createMockFile(`folder1/file${i}.md`, folder1)
			);
			
			mockFolderMode.getFiles = jest.fn(() => manyFiles);
			mockCardFactory.createPlaceholder = jest.fn((file, container, isActive) => {
				const placeholder = document.createElement('div');
				placeholder.className = 'card-item card-placeholder';
				placeholder.dataset.filePath = file.path;
				container.appendChild(placeholder);
				return placeholder;
			});
			
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			await renderer.renderCards(container, onFileOpen);
			
			// viewport manager가 생성되어야 함
			expect(renderer.viewportManager).not.toBeNull();
			
			// placeholder만 생성되고 createCard는 호출되지 않음
			expect(mockCardFactory.createPlaceholder).toHaveBeenCalled();
			expect(mockCardFactory.createCard).not.toHaveBeenCalled();
		});
		
		it('should use standard rendering for <100 files', async () => {
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			await renderer.renderCards(container, onFileOpen);
			
			// viewport manager가 생성되지 않아야 함
			expect(renderer.viewportManager).toBeNull();
			
			// createCard가 호출되어야 함
			expect(mockCardFactory.createCard).toHaveBeenCalled();
		});
	});
	
	describe('destroy', () => {
		it('should clean up viewport manager', () => {
			// Mock viewport manager
			const mockViewportManager = {
				destroy: jest.fn()
			};
			(renderer as any).viewportManager = mockViewportManager;
			
			renderer.destroy();
			
			expect(mockViewportManager.destroy).toHaveBeenCalled();
			expect(renderer.viewportManager).toBeNull();
		});
		
		it('should handle destroy when no viewport manager', () => {
			expect(() => renderer.destroy()).not.toThrow();
		});
	});
	
	describe('resetRenderState', () => {
		it('should force next render', async () => {
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			// 첫 렌더링
			await renderer.renderCards(container, onFileOpen);
			const firstCallCount = (mockCardFactory.createCard as jest.Mock).mock.calls.length;
			
			// 상태 리셋
			renderer.resetRenderState();
			
			// 다시 렌더링
			await renderer.renderCards(container, onFileOpen);
			const secondCallCount = (mockCardFactory.createCard as jest.Mock).mock.calls.length;
			
			// 리셋 후에는 재렌더링되어야 함
			expect(secondCallCount).toBeGreaterThan(firstCallCount);
		});
	});
	
	describe('updateLayoutManager', () => {
		it('should update layout manager reference', () => {
			const newLayoutManager = {
				updateLayout: jest.fn()
			} as any;
			
			renderer.updateLayoutManager(newLayoutManager);
			
			// private 필드이므로 간접 확인
			expect(() => renderer.updateLayoutManager(newLayoutManager)).not.toThrow();
		});
		
		it('should allow setting to null', () => {
			renderer.updateLayoutManager(null);
			
			expect(() => renderer.updateLayoutManager(null)).not.toThrow();
		});
	});
	
	describe('복잡한 시나리오', () => {
		it('should handle mode switch correctly', async () => {
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			// 폴더 모드로 렌더링
			mockSettings.currentMode = 'folder';
			await renderer.renderCards(container, onFileOpen);
			expect(mockFolderMode.getFiles).toHaveBeenCalled();
			
			// 태그 모드로 변경
			mockSettings.currentMode = 'tag';
			await renderer.forceRender(container, onFileOpen);
			expect(mockTagMode.getFiles).toHaveBeenCalled();
		});
		
		it('should handle search query change', async () => {
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			// 검색 없이 렌더링
			mockState.setSearchQuery('');
			await renderer.renderCards(container, onFileOpen);
			expect(mockFolderMode.getFiles).toHaveBeenCalled();
			
			// 검색 쿼리 추가
			mockState.setSearchQuery('test');
			await renderer.forceRender(container, onFileOpen);
			expect(mockSearchEngine.search).toHaveBeenCalled();
		});
		
		it('should handle rapid file changes', async () => {
			mockState.setPreviousFile(file1);
			
			// 같은 폴더의 다른 파일로 변경
			expect(renderer.needsRerenderForFileChange(file2)).toBe(false);
			
			// 다른 폴더의 파일로 변경
			expect(renderer.needsRerenderForFileChange(file3)).toBe(true);
		});
	});
	
	describe('엣지 케이스', () => {
		it('should handle empty folder', async () => {
			mockFolderMode.getFiles = jest.fn(() => []);
			
			const container = createMockElement();
			const onFileOpen = jest.fn();
			
			await renderer.renderCards(container, onFileOpen);
			
			expect(container.createEl).toHaveBeenCalledWith('div', {
				cls: 'card-navigator-empty',
				text: 'No files to display'
			});
		});
		
		it('should handle null active file', () => {
			mockApp.workspace.getActiveFile = jest.fn(() => null);
			
			const result = renderer.needsRerenderForFileChange(file1);
			
			expect(result).toBe(true);
		});
		
		it('should handle file without tags', () => {
			const fileNoTags = createMockFile('test.md', folder1);
			mockApp.metadataCache.getFileCache = jest.fn(() => ({
				tags: []
			})) as any;
			
			mockSettings.currentMode = 'tag';
			mockSettings.tagMode.useActiveFileTags = true;
			
			const result = renderer.isFileInCurrentView(fileNoTags);
			
			// active file에 태그가 없으면 false
			expect(result).toBe(false);
		});
		
		it('should handle file in root folder', () => {
			const rootFile = createMockFile('root.md', null);
			
			mockSettings.currentMode = 'folder';
			mockSettings.folderMode.specifiedFolder = '/';
			
			const result = renderer.isFileInCurrentView(rootFile);
			
			expect(result).toBe(true);
		});
	});
});
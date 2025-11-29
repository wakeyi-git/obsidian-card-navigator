import { TFile, App } from 'obsidian';
import { CardFactory } from './CardFactory';
import { ViewStateManager } from './ViewStateManager';
import { LayoutManager } from '../layout/LayoutManager';
import { KeyboardNavigator } from '../navigation/KeyboardNav';
import { SelectionManager } from '../selection/SelectionManager';
import { SearchEngine } from '../search/SearchEngine';
import { FolderMode } from '../modes/FolderMode';
import { TagMode } from '../modes/TagMode';
import { SortManager } from '../sort/SortManager';
import { GroupingManager } from '../grouping/GroupingManager';
import { GroupRenderer } from '../grouping/GroupRenderer';
import { MatrixRenderer } from '../grouping/MatrixRenderer';
import CardNavigatorPlugin from '../main';
import type { CardNavigatorView } from '../view';
import { isValidFile, isDefined } from '../utils/typeGuards';
import { DebugLogger } from '../utils/DebugLogger';
import { RenderProfiler } from '../utils/RenderProfiler';
import { ViewportManager } from './ViewportManager';
import { IncrementalRenderer } from './IncrementalRenderer';
import { ProgressBar } from '../ui/ProgressBar';
import { VIEWPORT } from '../constants';
import { t } from '../i18n';
import { getStyleLoader } from '../styles/StyleLoader';
import type { RenderState, RenderChanges, CardGroup, NavigatorMode, CardNavigatorSettings } from '../types';
import type { PathSegment } from '../ui/ContextBar';

/**
 * 뷰 렌더링을 담당합니다
 * 
 * 카드 목록 렌더링, 파일 목록 가져오기, active 클래스 관리,
 * 재렌더링 필요 여부 판단 등을 수행합니다.
 */
export class ViewRenderer {
	private app: App;
	private view: CardNavigatorView;
	private plugin: CardNavigatorPlugin;
	private cardFactory: CardFactory;
	private state: ViewStateManager;
	private layoutManager: LayoutManager | null;
	private keyboardNav: KeyboardNavigator;
	private selectionManager: SelectionManager;
	private searchEngine: SearchEngine;
	private folderMode: FolderMode;
	private tagMode: TagMode;
	private sortManager: SortManager;
	public groupingManager: GroupingManager;
	public groupRenderer: GroupRenderer;
	/** 🆕 2D 매트릭스 렌더러 */
	public matrixRenderer: MatrixRenderer | null = null;
	private logger: DebugLogger;

	private lastRenderState: string | null = null;

	/** ⭐ Phase 1.2: 조건부 재렌더링을 위한 상세 상태 정보 */
	private lastDetailedState: RenderState | null = null;

	/** Viewport 관리자 (viewport 렌더링용) */
	public viewportManager: ViewportManager | null = null;

	/** 이벤트 위임 설정 여부 */
	private eventsDelegated = false;

	/** ⭐ 렌더링 성능 프로파일러 (Phase 4.1) */
	private profiler: RenderProfiler;

	/** ⭐ 증분 렌더러 (Phase 3.1) */
	private incrementalRenderer: IncrementalRenderer;

	/** ⭐ Section 13.1: 진행률 바 (증분 렌더링용) */
	private progressBar: ProgressBar | null = null;

	/** 플러그인 설정 */
	private get settings() {
		return this.plugin.settingsManager.getSettings();
	}
	
	/**
	 * 렌더링 취소 여부를 확인합니다
	 *
	 * @param renderingId - 현재 렌더링 ID
	 * @param context - 취소 발생 지점 설명
	 * @returns 취소가 필요하면 true
	 *
	 * @remarks
	 * 빠른 파일 전환 시 이전 렌더링을 취소하여 중복 카드를 방지합니다.
	 * 취소 시 lastRenderState를 리셋하여 다음 렌더링이 스킵되지 않도록 합니다.
	 */
	private shouldCancelRendering(renderingId: number, context: string): boolean {
		const shouldCancel = renderingId !== this.state.getCurrentRenderingId();

		if (shouldCancel) {
			// ⭐ 렌더링 취소 시 상태 리셋 (다음 렌더링이 스킵되지 않도록)
			this.lastRenderState = null;

			this.logger.debug('View', `Render cancelled (${context})`, {
				currentId: renderingId,
				latestId: this.state.getCurrentRenderingId()
			});
		}

		return shouldCancel;
	}
	
	/** 현재 활성 파일 */
	private getActiveFile(): TFile | null {
		return this.app.workspace.getActiveFile();
	}
	
	/** 활성 파일의 태그 배열 */
	private getActiveFileTags(): string[] {
		const activeFile = this.getActiveFile();
		if (!isValidFile(activeFile)) {
			return [];
		}

		// getFileTags를 재사용하여 인라인 + 프론트매터 태그 모두 반환
		return this.getFileTags(activeFile);
	}
	
	/**
	 * 파일의 태그 배열을 가져옵니다 (인라인 + 프론트매터)
	 *
	 * @param file - 대상 파일
	 */
	private getFileTags(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		const tags: string[] = [];

		// 인라인 태그 (#로 시작)
		if (cache?.tags) {
			tags.push(...cache.tags.map(t => t.tag));
		}

		// 프론트매터 태그 (# 없이 저장되므로 추가)
		if (cache?.frontmatter?.tags) {
			const fmTags = cache.frontmatter.tags;
			if (Array.isArray(fmTags)) {
				tags.push(...fmTags
					.filter((t): t is string => typeof t === 'string' && t.length > 0)
					.map(t => t.startsWith('#') ? t : `#${t}`));
			} else if (typeof fmTags === 'string' && fmTags.length > 0) {
				tags.push(fmTags.startsWith('#') ? fmTags : `#${fmTags}`);
			}
		}

		return tags;
	}
	
	/**
	 * 태그 모드에서 파일이 현재 뷰에 포함되는지 확인
	 * 
	 * @param file - 확인할 파일
	 */
	private isFileInTagMode(file: TFile): boolean {
		if (this.settings.tagMode.useActiveFileTags) {
			// 활성 파일 태그 모드
			const activeTags = this.getActiveFileTags();
			if (activeTags.length === 0) {
				return false;
			}

			const fileTags = this.getFileTags(file);
			const hasCommonTag = fileTags.some(tag => activeTags.includes(tag));

			this.logger.debug('View', t().viewRenderer.comments.activeFileTagMode, {
				activeTags,
				fileTags,
				hasCommonTag
			});

			return hasCommonTag;
		} else {
			// 지정된 태그 모드
			const specifiedTags = this.settings.tagMode.specifiedTags;
			if (specifiedTags.length === 0) {
				return false;
			}

			const fileTags = this.getFileTags(file);
			// specifiedTags는 # 없이 저장되고, fileTags는 # 포함이므로
			// 비교 시 fileTags에서 # 제거하거나 specifiedTags에 # 추가
			const normalizedSpecifiedTags = specifiedTags.map(tag =>
				tag.startsWith('#') ? tag : `#${tag}`
			);
			const hasSpecifiedTag = fileTags.some(tag => normalizedSpecifiedTags.includes(tag));

			this.logger.debug('View', t().viewRenderer.comments.specifiedTagMode, {
				specifiedTags,
				normalizedSpecifiedTags,
				fileTags,
				hasSpecifiedTag
			});

			return hasSpecifiedTag;
		}
	}
	
	/**
	 * 폴더 모드에서 파일이 현재 뷰에 포함되는지 확인
	 * 
	 * @param file - 확인할 파일
	 */
	private isFileInFolderMode(file: TFile): boolean {
		if (this.settings.folderMode.useActiveFolder) {
			// 활성 파일 폴더 모드
			const activeFile = this.getActiveFile();
			if (!isValidFile(activeFile)) {
				return false;
			}
			
			const activeFolder = activeFile.parent;
			const fileFolder = file.parent;
			
			let result: boolean;
			if (this.settings.folderMode.includeSubfolders) {
				// 하위 폴더 포함
				if (!activeFolder || !fileFolder) {
					result = activeFolder === fileFolder;
				} else {
					result = file.path.startsWith(activeFolder.path + '/') || activeFolder.path === fileFolder.path;
				}
			} else {
				// 현재 폴더만
				result = fileFolder?.path === activeFolder?.path;
			}
			
			this.logger.debug('View', t().viewRenderer.comments.activeFolderMode, {
				activeFolder: activeFolder?.path || 'root',
				fileFolder: fileFolder?.path || 'root',
				result
			});
			
			return result;
		} else {
			// 지정된 폴더 모드
			const specifiedFolder = this.settings.folderMode.specifiedFolder;
			const fileFolder = file.parent;
			
			let result: boolean;
			if (this.settings.folderMode.includeSubfolders) {
				// 하위 폴더 포함
				if (specifiedFolder === '/') {
					result = true;
				} else {
					result = file.path.startsWith(specifiedFolder + '/') || file.parent?.path === specifiedFolder;
				}
			} else {
				// 현재 폴더만
				if (specifiedFolder === '/') {
					result = !fileFolder || fileFolder.path === '/';
				} else {
					result = fileFolder?.path === specifiedFolder;
				}
			}
			
			this.logger.debug('View', t().viewRenderer.comments.specifiedFolderMode, {
				specifiedFolder,
				fileFolder: fileFolder?.path || 'root',
				result
			});
			
			return result;
		}
	}
	
	constructor(
		app: App,
		view: CardNavigatorView,
		plugin: CardNavigatorPlugin,
		cardFactory: CardFactory,
		state: ViewStateManager,
		layoutManager: LayoutManager | null,
		keyboardNav: KeyboardNavigator,
		selectionManager: SelectionManager,
		searchEngine: SearchEngine,
		folderMode: FolderMode,
		tagMode: TagMode,
		sortManager: SortManager
	) {
		this.app = app;
		this.view = view;
		this.plugin = plugin;
		this.cardFactory = cardFactory;
		this.state = state;
		this.layoutManager = layoutManager;
		this.keyboardNav = keyboardNav;
		this.selectionManager = selectionManager;
		this.searchEngine = searchEngine;
		this.folderMode = folderMode;
		this.tagMode = tagMode;
		this.sortManager = sortManager;
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.logger = new DebugLogger(() => plugin.settingsManager.getSettings());
		this.groupingManager = new GroupingManager(app, () => plugin.settingsManager.getSettings());
		this.groupRenderer = new GroupRenderer();
		// GroupRenderer에 StateManager 설정
		this.groupRenderer.setStateManager(this.groupingManager.getStateManager());

		// ⭐ RenderProfiler 초기화 (Phase 4.1)
		this.profiler = new RenderProfiler();
		// 개발 모드에서만 프로파일러 활성화 (추후 설정으로 제어 가능)
		if (process.env.NODE_ENV === 'development') {
			this.profiler.enable();
		}

		// ⭐ IncrementalRenderer 초기화 (Phase 3.1)
		this.incrementalRenderer = new IncrementalRenderer(cardFactory, this.logger);
		// 렌더링 취소 콜백 설정
		this.incrementalRenderer.setShouldCancelCallback((renderingId, context) => {
			return this.shouldCancelRendering(renderingId, context);
		});
		// ⭐ Section 13.2: 청크 크기 설정
		this.incrementalRenderer.setChunkSize(this.settings.incrementalRenderChunkSize || 20);

		// ⭐ Section 13.1: ProgressBar 초기화
		this.progressBar = new ProgressBar(this.view.containerEl);

		// ⭐ 스크롤 이벤트 핸들러 (Context Bar 업데이트용) - 디바운스 적용
		this.scrollHandler = this.debounce(() => {
			this.updateContextBarOnScroll();
		}, 100);
	}

	/** ⭐ 스크롤 핸들러 참조 (정리용) */
	private scrollHandler: (() => void) | null = null;

	/** ⭐ 현재 렌더링된 그룹 목록 (Context Bar 업데이트용) */
	private currentGroups: CardGroup[] = [];

	/** ⭐ Performance: getFiles() 결과 캐싱 */
	private cachedFiles: TFile[] | null = null;
	private cacheTimestamp: number = 0;
	private readonly CACHE_TTL_MS = 100;

	/**
	 * ⭐ Performance: 캐싱된 파일 목록을 가져옵니다
	 *
	 * 동일한 렌더링 사이클 내에서 중복 getFiles() 호출을 방지합니다.
	 * TTL(100ms) 내에는 캐시된 결과를 반환합니다.
	 *
	 * @returns 파일 목록 (캐시 또는 새로 조회)
	 */
	private getFilesWithCache(): TFile[] {
		const now = Date.now();

		// 캐시가 유효한 경우 반환
		if (this.cachedFiles && (now - this.cacheTimestamp) < this.CACHE_TTL_MS) {
			this.logger.debug('View', '⚡ getFilesWithCache: 캐시 사용', {
				cachedCount: this.cachedFiles.length,
				cacheAge: now - this.cacheTimestamp
			});
			return this.cachedFiles;
		}

		// 새로 조회
		if (this.settings.currentMode === 'tag') {
			this.cachedFiles = this.tagMode.getFiles();
		} else {
			this.cachedFiles = this.folderMode.getFiles();
		}
		this.cacheTimestamp = now;

		this.logger.debug('View', '⚡ getFilesWithCache: 새로 조회', {
			mode: this.settings.currentMode,
			fileCount: this.cachedFiles.length
		});

		return this.cachedFiles;
	}

	/**
	 * ⭐ Performance: 파일 캐시를 무효화합니다
	 *
	 * 파일 생성/삭제/수정, 폴더 변경, 태그 변경 시 호출합니다.
	 */
	invalidateFileCache(): void {
		this.cachedFiles = null;
		this.cacheTimestamp = 0;
		this.logger.debug('View', '⚡ 파일 캐시 무효화됨');
	}

	/**
	 * ⭐ 카드 캐시를 무효화합니다
	 *
	 * 프리셋 변경, 설정 변경 시 호출하여 모든 카드가 새 설정으로 렌더링되도록 합니다.
	 */
	invalidateCardCache(): void {
		this.cardFactory.invalidateCache();
		this.logger.debug('View', '⚡ 카드 캐시 무효화됨');
	}

	/**
	 * 간단한 디바운스 유틸리티
	 */
	private debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		return ((...args: unknown[]) => {
			if (timeoutId) clearTimeout(timeoutId);
			timeoutId = setTimeout(() => fn(...args), delay);
		}) as T;
	}

	/**
	 * Context Bar를 초기화합니다 (렌더링 완료 후 호출)
	 *
	 * Context Bar는 그룹화 여부와 관계없이 항상 표시되며,
	 * 현재 모드(폴더/태그)에 따라 전체 목록을 드롭다운에 표시합니다.
	 *
	 * ⭐ Phase 5 최적화: requestAnimationFrame을 사용하여 렌더링 프레임 완료 후 업데이트
	 */
	private initializeContextBar(): void {
		requestAnimationFrame(() => this.doInitializeContextBar());
	}

	/**
	 * Context Bar 초기화 실제 구현
	 */
	private doInitializeContextBar(): void {
		const currentMode = this.settings.currentMode;

		// 현재 모드에 따른 Context Bar 경로 설정
		let fullPath = '';
		let icon = 'folder';
		let activeGroupId = '';

		if (currentMode === 'folder') {
			icon = 'folder';
			// 우선순위: overrideFolder > useActiveFolder > specifiedFolder
			if (this.settings.folderMode.overrideFolder) {
				// 컨텍스트 바에서 선택한 오버라이드 폴더
				fullPath = this.settings.folderMode.overrideFolder;
			} else if (this.settings.folderMode.useActiveFolder) {
				const activeFile = this.getActiveFile();
				fullPath = activeFile?.parent?.path || '';
			} else if (this.settings.folderMode.specifiedFolder) {
				fullPath = this.settings.folderMode.specifiedFolder;
			} else {
				fullPath = '';
			}
			activeGroupId = `folder-${fullPath}`;
		} else {
			icon = 'hash';
			// 우선순위: overrideTags > useActiveFileTags > specifiedTags
			if (this.settings.tagMode.overrideTags && this.settings.tagMode.overrideTags.length > 0) {
				// 컨텍스트 바에서 선택한 오버라이드 태그
				fullPath = this.settings.tagMode.overrideTags[0].replace('#', '');
			} else if (this.settings.tagMode.useActiveFileTags) {
				// 활성 태그 모드: 활성 파일의 첫 번째 태그 사용
				const activeFile = this.getActiveFile();
				if (activeFile) {
					const cache = this.app.metadataCache.getFileCache(activeFile);
					const tags: string[] = [];

					// frontmatter 태그 수집
					if (cache?.frontmatter?.tags) {
						const fmTags = cache.frontmatter.tags;
						if (Array.isArray(fmTags)) {
							tags.push(...fmTags
								.filter((t): t is string => typeof t === 'string' && t.length > 0)
								.map((t: string) => t.startsWith('#') ? t : `#${t}`));
						} else if (typeof fmTags === 'string' && fmTags.length > 0) {
							tags.push(fmTags.startsWith('#') ? fmTags : `#${fmTags}`);
						}
					}

					// 인라인 태그 수집
					if (cache?.tags) {
						tags.push(...cache.tags.map(t => t.tag));
					}

					if (tags.length > 0) {
						// # 제거하여 getAllTags()의 tag.tag와 일치시킴
						fullPath = tags[0].replace('#', '');
					} else {
						fullPath = '';
					}
				} else {
					fullPath = '';
				}
			} else if (this.settings.tagMode.specifiedTags.length > 0) {
				// # 제거하여 getAllTags()의 tag.tag와 일치시킴
				fullPath = this.settings.tagMode.specifiedTags[0].replace('#', '');
			} else {
				fullPath = '';
			}
			activeGroupId = `tag-${fullPath}`;
		}

		// Context Bar 경로 업데이트 - 전체 경로를 세그먼트로 분리
		const segments = this.buildPathSegmentsFromPath(fullPath, currentMode, icon);

		this.view.updateContextBarPath(segments);

		// 그룹 목록 업데이트 (현재 활성 그룹 표시)
		this.updateContextBarGroupList(activeGroupId);
	}

	/**
	 * 경로 문자열에서 PathSegment 배열을 생성합니다
	 *
	 * @param path - 경로 문자열 (폴더 경로 또는 태그 경로)
	 * @param mode - 현재 모드 ('folder', 'tag', 또는 'search')
	 * @param icon - 표시할 아이콘
	 */
	private buildPathSegmentsFromPath(path: string, mode: NavigatorMode, icon: string): PathSegment[] {
		const segments: PathSegment[] = [];

		// search 모드는 경로 분리 없이 단순 표시
		if (mode === 'search') {
			segments.push({
				name: path || 'Search',
				fullPath: `search-${path}`,
				level: 0,
				icon
			});
			return segments;
		}

		const prefix = mode === 'folder' ? 'folder-' : 'tag-';

		if (!path || path === '') {
			// 빈 경로는 Root 또는 No tags로 표시
			segments.push({
				name: mode === 'folder' ? 'Root' : 'No tags',
				fullPath: prefix,
				level: 0,
				icon
			});
			return segments;
		}

		// 경로에 구분자가 있으면 분리
		if (path.includes('/')) {
			const pathParts = path.split('/');
			let currentPath = prefix;

			pathParts.forEach((part, index) => {
				currentPath += (index > 0 ? '/' : '') + part;
				segments.push({
					name: part || 'Root',
					fullPath: currentPath,
					level: index,
					icon: index === 0 ? icon : undefined
				});
			});
		} else {
			// 단일 세그먼트
			segments.push({
				name: path || (mode === 'folder' ? 'Root' : path),
				fullPath: prefix + path,
				level: 0,
				icon
			});
		}

		return segments;
	}

	/**
	 * 스크롤 시 Context Bar를 업데이트합니다
	 *
	 * 그룹화가 활성화된 경우에만 스크롤에 따라 현재 그룹을 업데이트합니다.
	 * Context Bar 헤더는 항상 currentMode(폴더/태그)에 따른 정보를 표시합니다.
	 */
	private updateContextBarOnScroll(): void {
		// 그룹화가 비활성화된 경우 스크롤 이벤트 무시
		if (!this.settings.grouping.enabled) return;

		const container = this.view.containerEl.querySelector('.card-navigator-cards');
		if (!container) return;

		// 현재 보이는 그룹 찾기
		const visibleGroup = this.findVisibleGroup(container as HTMLElement);

		if (visibleGroup) {
			const currentMode = this.settings.currentMode;
			const groupingCriteria = this.settings.grouping.criteria;

			// grouping.criteria가 currentMode와 일치하는 경우에만 그룹 정보를 사용
			// 그렇지 않으면 currentMode에 따른 기본 정보 유지
			if ((currentMode === 'folder' && groupingCriteria === 'folder') ||
				(currentMode === 'tag' && groupingCriteria === 'tag')) {
				// 그룹화 기준이 모드와 일치하면 그룹 정보 사용
				const segments = this.buildPathSegments(visibleGroup);
				this.view.updateContextBarPath(segments);
				this.updateContextBarGroupList(visibleGroup.id);
			} else {
				// 그룹화 기준이 모드와 다르면 모드에 따른 기본 정보 유지
				// (initializeContextBar에서 설정한 값 유지)
				// 드롭다운 그룹 목록만 업데이트 (활성 그룹 표시용)
				this.updateContextBarGroupList(visibleGroup.id);
			}
		}
	}

	/**
	 * Context Bar의 활성 그룹을 업데이트합니다 (외부에서 호출 가능)
	 *
	 * @param activeGroupId - 활성화할 그룹 ID
	 */
	public updateContextBarActiveGroup(activeGroupId: string): void {
		this.updateContextBarGroupList(activeGroupId);
	}

	/**
	 * Context Bar 그룹 목록을 업데이트합니다
	 * 현재 모드(폴더/태그)에 따라 전체 목록을 표시합니다
	 */
	private updateContextBarGroupList(activeGroupId?: string): void {
		const currentMode = this.settings.currentMode;

		this.logger.debug('View', 'Context bar updating group list', {
			currentMode,
			activeGroupId
		});

		// 현재 모드에 따라 전체 목록 가져오기
		if (currentMode === 'folder') {
			const allFolders = this.groupingManager.getAllFolders();
			this.logger.debug('View', 'Context bar folder list retrieved', {
				count: allFolders.length
			});
			const groupListItems = allFolders.map(folder => ({
				id: `folder-${folder.path}`,
				name: folder.name,
				icon: 'folder',
				fileCount: folder.fileCount,
				isActive: `folder-${folder.path}` === activeGroupId,
				level: folder.level,
				hasChildren: folder.hasChildren,
				parentId: folder.parentId ?? undefined
			}));
			this.view.updateContextBarGroupList(groupListItems, activeGroupId);
		} else if (currentMode === 'tag') {
			const allTags = this.groupingManager.getAllTags();
			this.logger.debug('View', 'Context bar tag list retrieved', {
				count: allTags.length,
				tags: allTags.slice(0, 5).map(t => t.tag)
			});
			const groupListItems = allTags.map(tag => ({
				id: `tag-${tag.tag}`,
				name: tag.name,
				icon: 'hash',
				fileCount: tag.fileCount,
				isActive: `tag-${tag.tag}` === activeGroupId,
				level: tag.level,
				hasChildren: tag.hasChildren,
				parentId: tag.parentId ?? undefined
			}));
			this.view.updateContextBarGroupList(groupListItems, activeGroupId);
		} else {
			// 다른 모드는 현재 표시된 그룹만 표시
			const groupListItems = this.buildFlatGroupList(activeGroupId);
			this.view.updateContextBarGroupList(groupListItems, activeGroupId);
		}
	}

	/**
	 * 플랫한 그룹 목록을 생성합니다 (폴더/태그 외의 그룹화 기준용)
	 *
	 * 아이콘은 currentMode(폴더/태그 모드)에 따라 결정됩니다.
	 */
	private buildFlatGroupList(activeGroupId?: string): { id: string; name: string; icon: string; fileCount: number; isActive: boolean; level: number }[] {
		const currentMode = this.settings.currentMode;

		// currentMode에 따른 아이콘 결정 (그룹화 기준과 독립)
		const icon = currentMode === 'tag' ? 'hash' : 'folder';

		// 현재 그룹을 오름차순 정렬
		const sorted = [...this.currentGroups].sort((a, b) => a.name.localeCompare(b.name));

		return sorted.map(group => ({
			id: group.id,
			name: group.name,
			icon: group.icon || icon,
			fileCount: group.files.length,
			isActive: group.id === activeGroupId,
			level: 0
		}));
	}

	/**
	 * 현재 뷰포트에 보이는 그룹을 찾습니다
	 *
	 * @remarks
	 * ⭐ Performance: DOM 읽기/쓰기 분리
	 * - 모든 getBoundingClientRect() 호출을 일괄 수행
	 * - Forced reflow 방지
	 */
	private findVisibleGroup(container: HTMLElement): CardGroup | null {
		const groupSections = this.groupRenderer.findAllGroupSections(container);
		if (groupSections.length === 0) return null;

		// ⭐ Performance: 모든 DOM 읽기를 먼저 일괄 수행 (읽기 단계)
		const containerRect = container.getBoundingClientRect();
		const containerTop = containerRect.top;
		const sectionRects = groupSections.map(section => section.getBoundingClientRect());

		// ⭐ Performance: 읽기 완료 후 계산 수행 (처리 단계)
		// 스크롤 위치에 가장 가까운 그룹 찾기
		for (let i = 0; i < groupSections.length; i++) {
			const sectionRect = sectionRects[i];

			// 섹션의 상단이 컨테이너 상단 근처에 있으면 해당 그룹
			if (sectionRect.top <= containerTop + 50 && sectionRect.bottom > containerTop) {
				const groupId = groupSections[i].dataset.groupId;
				if (groupId) {
					return this.currentGroups.find(g => g.id === groupId) || null;
				}
			}
		}

		// 첫 번째 보이는 그룹 반환
		const firstSection = groupSections[0];
		const firstGroupId = firstSection?.dataset.groupId;
		if (firstGroupId) {
			return this.currentGroups.find(g => g.id === firstGroupId) || null;
		}

		return null;
	}

	/**
	 * 그룹 정보로 경로 세그먼트를 생성합니다
	 *
	 * 아이콘은 currentMode(폴더/태그 모드)에 따라 결정됩니다.
	 * 그룹화 기준(grouping.criteria)과는 독립적입니다.
	 */
	private buildPathSegments(group: CardGroup): PathSegment[] {
		const segments: PathSegment[] = [];
		const currentMode = this.settings.currentMode;

		// currentMode에 따른 아이콘 결정 (그룹화 기준과 독립)
		const icon = currentMode === 'tag' ? 'hash' : 'folder';

		// 폴더 모드에서 경로를 세그먼트로 분리
		if (currentMode === 'folder' && group.id.includes('/')) {
			const pathParts = group.id.replace('folder-', '').split('/');
			let currentPath = 'folder-';

			pathParts.forEach((part, index) => {
				currentPath += (index > 0 ? '/' : '') + part;
				segments.push({
					name: part || 'Root',
					fullPath: currentPath,
					level: index,
					icon: index === 0 ? icon : undefined
				});
			});
		} else if (currentMode === 'tag' && group.id.includes('/')) {
			// 태그 모드에서 중첩 태그 경로를 세그먼트로 분리
			const tagPath = group.id.replace('tag-', '');
			const pathParts = tagPath.split('/');
			let currentPath = 'tag-';

			pathParts.forEach((part, index) => {
				currentPath += (index > 0 ? '/' : '') + part;
				segments.push({
					name: part,
					fullPath: currentPath,
					level: index,
					icon: index === 0 ? icon : undefined
				});
			});
		} else {
			// 단일 세그먼트
			segments.push({
				name: group.name,
				fullPath: group.id,
				level: 0,
				icon
			});
		}

		return segments;
	}
	
	/**
	 * 카드를 렌더링합니다
	 *
	 * @param container - 카드를 추가할 컨테이너
	 * @param onFileOpen - 파일 열기 콜백
	 *
	 * @remarks
	 * ⭐ Phase 1.2: 조건부 재렌더링 지원
	 * - 상태 해시 기반 렌더링 스킵
	 * - 변경 감지를 통한 선택적 업데이트
	 * - 스크롤 위치 보존
	 * - 렌더링 ID 시스템을 통한 빠른 파일 전환 처리
	 */
	async renderCards(
		container: HTMLElement,
		onFileOpen: (file: TFile) => void
	): Promise<void> {
		// ⭐ Phase 1.2: 상세 상태 정보 생성
		const currentDetailedState = await this.generateDetailedState();
		const currentState = JSON.stringify(currentDetailedState);

		// 상태가 완전히 동일하면 렌더링 스킵
		if (currentState === this.lastRenderState) {
			this.logger.debug('View', 'State unchanged, skipping render', {
				currentState: currentState.substring(0, 50)
			});
			return;
		}

		// ⭐ Phase 1.2: 변경 사항 감지
		const changes = this.detectChanges(this.lastDetailedState, currentDetailedState);

		this.logger.debug('View', 'State changed, analyzing changes', {
			lastState: this.lastRenderState?.substring(0, 50) || 'null',
			currentState: currentState.substring(0, 50),
			changeType: changes.changeType,
			filesChanged: changes.filesChanged,
			groupsChanged: changes.groupsChanged,
			sortChanged: changes.sortChanged
		});

		// ⭐ Phase 1.2: 변경 유형에 따라 최적화된 업데이트 수행
		if (changes.changeType === 'none') {
			// 변경 사항 없음 (실제로는 여기 도달하지 않음 - 위에서 스킵됨)
			return;
		} else if (changes.changeType === 'partial' && changes.sortChanged && !changes.filesChanged && !changes.groupsChanged) {
			// 정렬만 변경됨 - 재정렬만 수행
			this.logger.debug('View', 'Partial update: sort only');

			// 현재는 전체 재렌더링 수행 (추후 재정렬 최적화 추가 가능)
			// TODO: 정렬만 변경된 경우 DOM 재배치만 수행
			// 지금은 full render로 fallback
		}

		// ⭐ 스크롤 위치 보존: 활성 파일이 변경되지 않았으면 스크롤 위치 저장
		const currentActiveFile = this.getActiveFile();
		const hasActiveFileChanged = this.state.hasFileChanged(currentActiveFile);
		let scrollTop = 0;
		if (!hasActiveFileChanged) {
			scrollTop = container.scrollTop;
		}

		// ⭐ 상태가 변경되었으므로 이전 콘텐츠를 먼저 제거
		// 이렇게 하면 폴더 재방문 시 이전 폴더의 카드가 남지 않음
		container.empty();

		// ⭐ Matrix 모드에서 다른 모드로 전환 시 matrix-view 클래스 제거
		// Matrix CSS가 일반 레이아웃과 충돌하지 않도록 함
		const wasMatrixMode = container.classList.contains('matrix-view');
		container.classList.remove('matrix-view');

		// ⭐ Matrix 관련 CSS 변수만 제거 (레이아웃 CSS 변수는 유지하여 깜빡임 방지)
		if (wasMatrixMode) {
			container.style.removeProperty('--matrix-primary-count');
			container.style.removeProperty('--matrix-cell-min-width');
			container.style.removeProperty('--matrix-cell-min-height');
		}

		// ⭐ container.empty()가 이벤트 리스너도 제거하므로 플래그 리셋
		this.eventsDelegated = false;

		// ⭐ 이벤트 위임 설정
		// CardFactory에서 개별 카드에 이벤트를 바인딩하는 대신
		// 컨테이너 레벨에서 한 번만 이벤트를 등록하여 성능 향상
		if (!this.eventsDelegated) {
			const eventHandler = this.view['eventHandler'];
			if (eventHandler && typeof eventHandler.setupDelegatedEvents === 'function') {
				eventHandler.setupDelegatedEvents(container, onFileOpen);
				this.eventsDelegated = true;
			}
		}

		const renderingId = this.state.startRendering();

		this.logger.debug('View', 'Render started', {
			renderingId,
			isRendering: this.state.getIsRendering(),
			timestamp: Date.now(),
			stateHash: currentState.substring(0, 10) + '...'
		});

		// ⭐ GroupRenderer에 현재 레이아웃 모드 설정
		// LayoutManager의 실제 모드를 사용 (화면 크기에 따라 자동 결정)
		const isHorizontalMode = this.layoutManager ? this.layoutManager.getMode() === 'horizontal' : false;
		this.groupRenderer.setHorizontalMode(isHorizontalMode);

	try {
			// 파일 개수 확인
			const files = await this.getFilesToDisplay();

			if (this.shouldCancelRendering(renderingId, 'after file list fetch')) {
				return;
			}

			// 🆕 2D 매트릭스 모드 확인
			const matrixSettings = this.settings.grouping.matrix2D;

			// ⭐ 디버그: 렌더링 시점의 설정 상태 확인
			this.logger.debug('View', 'Checking matrix mode at render time', {
				matrix2DEnabled: matrixSettings?.enabled,
				groupingEnabled: this.settings.grouping?.enabled,
				primaryAxis: matrixSettings?.primaryAxis?.propertyName,
				secondaryAxis: matrixSettings?.secondaryAxis?.propertyName
			});

			if (matrixSettings?.enabled) {
				this.logger.debug('View', 'Using 2D matrix rendering', {
					fileCount: files.length,
					primaryAxis: matrixSettings.primaryAxis.propertyName,
					secondaryAxis: matrixSettings.secondaryAxis.propertyName
				});

				await this.renderCardsAsMatrix(container, onFileOpen, files);
			}
			// 100개 이상이면 Viewport 렌더링 사용
			else if (files.length >= 100) {
				this.logger.debug('View', 'Using viewport rendering', {
				fileCount: files.length
				});

				await this.renderCardsWithViewport(container, onFileOpen, renderingId);
			} else {
				this.logger.debug('View', 'Using standard rendering', {
				fileCount: files.length
				});

				await this.renderCardsStandard(container, onFileOpen, renderingId, files);
			}

			// ⭐ Phase 1.2: 렌더링 완료 후 상태 저장
			this.lastRenderState = currentState;
			this.lastDetailedState = currentDetailedState;

			// ⭐ 스크롤 위치 복원: 활성 파일이 변경되지 않았으면 저장했던 스크롤 위치로 복원
			if (!hasActiveFileChanged && scrollTop > 0) {
				container.scrollTop = scrollTop;
			}

			// 폴더 변경 후 돌아왔을 때 선택된 카드의 스타일이 유지되도록 함
			if (this.selectionManager.getSelectionCount() > 0) {
				this.logger.debug('View', t().viewRenderer.comments.selectionRestore, {
					selectedCount: this.selectionManager.getSelectionCount()
				});
				this.selectionManager.updateUI();
			}
		} finally {
			this.state.endRendering();
		}
	}
	
	/**
	 * 현재 렌더링 상태의 해시를 생성합니다
	 *
	 * @returns 상태 해시 문자열
	 *
	 * @remarks
	 * 성능 최적화를 위해 상태가 변경되지 않았으면 렌더링을 건너뜁니다.
	 * 해시에는 파일 개수, 모드, 정렬, 검색어, 폴더 경로/태그가 포함됩니다.
	 */
	private async generateStateHash(): Promise<string> {
		const state = await this.generateDetailedState();
		return JSON.stringify(state);
	}

	/**
	 * ⭐ Phase 1.2: 상세한 렌더링 상태 정보를 생성합니다
	 *
	 * @returns 렌더링 상태 객체
	 *
	 * @remarks
	 * 변경 감지를 위해 구조화된 상태 정보를 반환합니다.
	 */
	private async generateDetailedState(): Promise<RenderState> {
		const files = await this.getFilesToDisplay();
		const settings = this.settings;

		const stateObject: RenderState = {
			fileCount: files.length,
			mode: settings.currentMode,
			sortBy: JSON.stringify(settings.sort.criteria),
			sortOrder: JSON.stringify(settings.sort.order),
			query: this.state.getSearchQuery(),
			// ⭐ 그룹화 설정 포함 (설정 변경 시 재렌더링 트리거)
			groupingEnabled: settings.grouping.enabled,
			groupingCriteria: settings.grouping.criteria,
			groupingSort: settings.grouping.groupSort,
			groupingSortOrder: settings.grouping.groupSortOrder,
			// ⭐ 2D 매트릭스 설정 포함 (프리셋 자동 적용 시 재렌더링 트리거)
			matrix2DEnabled: settings.grouping.matrix2D?.enabled || false,
			matrix2DPrimaryAxis: settings.grouping.matrix2D?.primaryAxis?.propertyName || '',
			matrix2DSecondaryAxis: settings.grouping.matrix2D?.secondaryAxis?.propertyName || '',
			// ⭐ 카드 스타일 설정 포함 (프리셋 자동 적용 시 재렌더링 트리거)
			cardStyleHash: this.generateCardStyleHash(settings)
		};

		if (settings.currentMode === 'folder') {
			const activeFile = this.getActiveFile();
			if (isValidFile(activeFile)) {
				stateObject.folderPath = activeFile.parent?.path || 'root';
			}
		}

		if (settings.currentMode === 'tag') {
			if (settings.tagMode.useActiveFileTags) {
				const activeFile = this.getActiveFile();
				if (isValidFile(activeFile)) {
					const cache = this.app.metadataCache.getFileCache(activeFile);
					const tags = cache?.tags?.map(t => t.tag).sort().join(',') || '';
					stateObject.activeTags = tags;
				}
			} else {
				stateObject.specifiedTags = settings.tagMode.specifiedTags.slice().sort().join(',');
			}
		}

		// ⭐ 그룹화 기준별 추가 설정
		if (settings.grouping.enabled) {
			if (settings.grouping.criteria === 'tag') {
				stateObject.tagMode = settings.grouping.tagMode;
			} else if (settings.grouping.criteria === 'property') {
				stateObject.propertyName = settings.grouping.propertyName;
			} else if (settings.grouping.criteria === 'folder') {
				stateObject.folderHierarchical = settings.grouping.folderHierarchical;
			} else if (settings.grouping.criteria.startsWith('date-')) {
				stateObject.dateBasis = settings.grouping.dateBasis;
			}
		}

		return stateObject;
	}

	/**
	 * ⭐ 카드 스타일 설정의 해시를 생성합니다
	 *
	 * @param settings - 현재 설정
	 * @returns 카드 스타일 설정의 간단한 해시 문자열
	 *
	 * @remarks
	 * 프리셋 자동 적용 시 카드 스타일이 변경되면 재렌더링을 트리거합니다.
	 */
	private generateCardStyleHash(settings: CardNavigatorSettings): string {
		// 주요 카드 스타일 설정만 포함 (성능 고려)
		const styleConfig = {
			headerNormalStyle: settings.header?.normalStyle,
			headerActiveStyle: settings.header?.activeStyle,
			bodyNormalStyle: settings.body?.normalStyle,
			bodyActiveStyle: settings.body?.activeStyle,
			footerNormalStyle: settings.footer?.normalStyle,
			footerActiveStyle: settings.footer?.activeStyle,
			renderMode: settings.renderMode
		};
		return JSON.stringify(styleConfig);
	}

	/**
	 * ⭐ Phase 1.2: 렌더링 상태 변경을 감지합니다
	 *
	 * @param oldState - 이전 렌더링 상태
	 * @param newState - 새로운 렌더링 상태
	 * @returns 변경 사항
	 *
	 * @remarks
	 * 변경 유형을 세밀하게 분석하여 최소한의 업데이트만 수행합니다.
	 */
	private detectChanges(oldState: RenderState | null, newState: RenderState): RenderChanges {
		// 이전 상태가 없으면 전체 렌더링 필요
		if (!oldState) {
			return {
				filesChanged: true,
				groupsChanged: true,
				sortChanged: true,
				stylesChanged: true,
				changedFiles: new Set<string>(),
				changeType: 'full'
			};
		}

		const changes: RenderChanges = {
			filesChanged: false,
			groupsChanged: false,
			sortChanged: false,
			stylesChanged: false,
			changedFiles: new Set<string>(),
			changeType: 'none'
		};

		// 파일 목록 변경 확인
		if (oldState.fileCount !== newState.fileCount ||
			oldState.mode !== newState.mode ||
			oldState.query !== newState.query ||
			oldState.folderPath !== newState.folderPath ||
			oldState.activeTags !== newState.activeTags ||
			oldState.specifiedTags !== newState.specifiedTags) {
			changes.filesChanged = true;
			changes.changeType = 'full';
		}

		// 그룹화 변경 확인
		if (oldState.groupingEnabled !== newState.groupingEnabled ||
			oldState.groupingCriteria !== newState.groupingCriteria ||
			oldState.groupingSort !== newState.groupingSort ||
			oldState.groupingSortOrder !== newState.groupingSortOrder) {
			changes.groupsChanged = true;
			changes.changeType = 'full';
		}

		// 정렬 변경 확인
		if (oldState.sortBy !== newState.sortBy ||
			oldState.sortOrder !== newState.sortOrder) {
			changes.sortChanged = true;
			if (changes.changeType === 'none') {
				changes.changeType = 'partial';
			}
		}

		// 변경 사항이 없으면 스타일만 변경되었을 수 있음
		if (changes.changeType === 'none') {
			// 추후 스타일 관련 설정 추가 시 여기서 체크
			// 현재는 항상 full render이므로 스타일 전용 업데이트는 없음
		}

		return changes;
	}

	/**
	 * ⭐ Phase 1.2: 변경된 카드만 업데이트합니다
	 *
	 * @param container - 카드 컨테이너
	 * @param changedFiles - 변경된 파일 경로 목록
	 *
	 * @remarks
	 * 파일 메타데이터 변경 시 해당 카드만 재렌더링합니다.
	 */
	private async updateChangedCards(
		container: HTMLElement,
		changedFiles: Set<string>
	): Promise<void> {
		this.logger.debug('View', 'Updating changed cards', {
			changedCount: changedFiles.size
		});

		const currentActiveFile = this.getActiveFile();
		const onFileOpen = (file: TFile) => {
			this.view.openFile(file);
		};

		for (const filePath of changedFiles) {
			// DOM에서 해당 카드 찾기
			const cardElement = container.querySelector(
				`.card-item[data-file-path="${filePath}"]`
			) as HTMLElement;

			if (cardElement) {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
					// 카드 재생성
					const parent = cardElement.parentElement;
					if (parent) {
						// 기존 카드 제거
						cardElement.remove();

						// 새 카드 생성
						await this.cardFactory.createCard(
							file,
							parent,
							currentActiveFile,
							onFileOpen
						);
					}
				}
			}
		}
	}

	/**
	 * ⭐ Phase 1.2: 스타일만 업데이트합니다
	 *
	 * @param container - 카드 컨테이너
	 *
	 * @remarks
	 * 레이아웃 설정이 변경된 경우 레이아웃만 업데이트합니다.
	 */
	private updateStyles(container: HTMLElement): void {
		this.logger.debug('View', 'Updating styles only');

		// 레이아웃 업데이트
		if (isDefined(this.layoutManager)) {
			this.layoutManager.updateLayout();
		}

		// active 클래스 업데이트
		this.updateActiveCardClass(container);
	}
	
	/**
	 * 상태 해시를 무시하고 강제로 재렌더링합니다
	 *
	 * @param container - 카드를 추가할 컨테이너
	 * @param onFileOpen - 파일 열기 콜백
	 *
	 * @remarks
	 * 설정 변경 후나 사용자가 명시적으로 새로고침을 요청했을 때 사용합니다.
	 */
	async forceRender(
		container: HTMLElement,
		onFileOpen: (file: TFile) => void
	): Promise<void> {
		this.lastRenderState = null;
		this.lastDetailedState = null; // ⭐ Phase 1.2
		this.invalidateFileCache(); // ⭐ Performance: 강제 렌더링 시 캐시 무효화

		// ⭐ 레이아웃 상태 리셋: 프리셋 변경 등으로 인한 강제 렌더링 시
		// renderCards에서 container.style.cssText = ''로 인라인 스타일이 초기화되므로
		// LayoutManager도 상태를 리셋해야 레이아웃이 다시 적용됨
		if (isDefined(this.layoutManager)) {
			this.layoutManager.invalidateState();
		}

		await this.renderCards(container, onFileOpen);
	}
	
	/**
	 * 표시할 파일 목록을 가져옵니다
	 *
	 * @returns 파일 배열
	 *
	 * @remarks
	 * 우선순위: 검색 모드 → 태그 모드 → 폴더 모드
	 * 파일을 가져온 후 정렬을 적용합니다.
	 * 핀된 파일 항상 표시 옵션이 활성화되어 있으면 핀된 파일을 결과에 추가합니다.
	 */
	private async getFilesToDisplay(): Promise<TFile[]> {
		let files: TFile[];

		if (this.state.hasSearchQuery()) {
			const allFiles = this.app.vault.getMarkdownFiles();
			files = await this.searchEngine.search(
				this.state.getSearchQuery(),
				allFiles,
				false
			);
		} else {
			// ⭐ Performance: 캐싱된 파일 목록 사용
			files = this.getFilesWithCache();
		}

		// 핀된 파일 항상 표시 옵션이 활성화되어 있으면 핀된 파일을 추가
		if (this.settings.alwaysShowPinnedFiles && this.settings.pinnedFiles && this.settings.pinnedFiles.length > 0) {
			const allFiles = this.app.vault.getMarkdownFiles();
			const pinnedFiles = allFiles.filter(file =>
				this.settings.pinnedFiles?.includes(file.path) && !files.includes(file)
			);
			files = [...pinnedFiles, ...files];
		}

		return this.sortManager.sort(files, this.settings.sort, this.settings.pinnedFiles);
	}
	
	/**
	 * 재렌더링 없이 active 클래스를 업데이트합니다
	 * 
	 * @param container - 카드 컨테이너
	 * 
	 * @remarks
	 * 같은 파일을 클릭했을 때 깜빡임을 방지하기 위해
	 * active 카드의 시각적 상태만 변경합니다.
	 */
	updateActiveCardClass(container: HTMLElement): void {
		const activeFile = this.getActiveFile();
		
		const allCards = container.querySelectorAll('.card-item');
		allCards.forEach(card => {
			const cardEl = card as HTMLElement;
			const isNowActive = isValidFile(activeFile) && cardEl.dataset.filePath === activeFile.path;
			
			// Modified Strategy A: CSS 클래스만으로 상태 관리
			if (isNowActive) {
				cardEl.addClass('active');
			} else {
				cardEl.removeClass('active');
			}
			// CSS가 자동으로 스타일 적용
		});
		
		if (isValidFile(activeFile)) {
			this.logger.debug('View', 'Active class updated', { file: activeFile.basename });
		}
	}
	
	// ⭐ applyCardStylesFromData, getContrastColor, parseColor 메서드 제거됨
	// Modified Strategy A: CSS 클래스만으로 모든 상태 관리
	// CSS 커스텀 속성과 CSS 클래스가 자동으로 스타일 처리

	/**
	 * 그룹을 준비하고 활성 파일이 포함된 그룹을 자동으로 펼칩니다
	 *
	 * @param files - 파일 목록
	 * @param currentActiveFile - 현재 활성 파일
	 * @param context - 로깅용 컨텍스트 (Standard/Viewport)
	 * @returns 준비된 그룹 배열
	 *
	 * @private
	 */
	private prepareGroups(
		files: TFile[],
		currentActiveFile: TFile | null,
		context: string
	): import('../types').CardGroup[] {
		// 그룹화 (핀된 파일 정보 전달)
		let groups = this.groupingManager.groupFiles(files, this.settings.grouping, this.settings.pinnedFiles);

		// ⭐ Phase 4: 계층 구조 정렬이면 계층 구조로 변환 후 플랫화
		const isHierarchyMode = this.settings.grouping.groupSort === 'hierarchy' &&
			(this.settings.grouping.criteria === 'folder' || this.settings.grouping.criteria === 'tag');

		if (isHierarchyMode) {
			// 계층 구조로 변환
			const hierarchicalGroups = this.groupingManager.buildHierarchy(groups);

			// 활성 파일이 있으면 해당 그룹의 조상들을 자동으로 펼침
			if (currentActiveFile) {
				const activeGroupId = this.findGroupIdForFile(groups, currentActiveFile);
				if (activeGroupId) {
					this.groupingManager.expandAncestors(activeGroupId, groups);
				}
			}

			// 플랫 배열로 변환 (렌더링용)
			groups = this.groupingManager.flattenHierarchy(hierarchicalGroups, false);

			this.logger.debug('View', `${context}: Hierarchical groups flattened`, {
				originalCount: hierarchicalGroups.length,
				flattenedCount: groups.length
			});
		}

		this.logger.debug('View', `${context}: Groups created`, {
			groupCount: groups.length,
			isHierarchyMode,
			groups: groups.map(g => ({
				id: g.id,
				name: g.name,
				fileCount: g.files.length,
				collapsed: g.collapsed,
				icon: g.icon,
				level: g.level
			}))
		});

		// 활성 파일이 포함된 그룹 자동 펼치기
		// 렌더링 시점에 활성 파일이 접힌 그룹에 있으면 자동으로 펼쳐서 사용자에게 보여줌
		if (currentActiveFile && !isHierarchyMode) {
			groups.forEach((group) => {
				const hasActiveFile = group.files.some((file) => file.path === currentActiveFile.path);
				if (hasActiveFile && group.collapsed) {
					group.collapsed = false;
					this.groupingManager.saveCollapsedState(group.id, false);
					this.logger.debug('View', 'Auto-expanded group containing active file', {
						groupId: group.id,
						groupName: group.name,
						activeFile: currentActiveFile.basename
					});
				}
			});
		}

		// 접힌 그룹 개수 확인
		const collapsedCount = groups.filter(g => g.collapsed).length;
		this.logger.debug('View', `${context}: Group collapsed status`, {
			totalGroups: groups.length,
			collapsedGroups: collapsedCount,
			expandedGroups: groups.length - collapsedCount
		});

		return groups;
	}

	/**
	 * 파일이 속한 그룹 ID를 찾습니다
	 *
	 * @param groups - 그룹 배열
	 * @param file - 찾을 파일
	 * @returns 그룹 ID 또는 null
	 */
	private findGroupIdForFile(groups: CardGroup[], file: TFile): string | null {
		for (const group of groups) {
			if (group.files.some(f => f.path === file.path)) {
				return group.id;
			}
		}
		return null;
	}
	
	/**
	 * 파일 변경 시 재렌더링이 필요한지 판단합니다
	 * 
	 * @param newActiveFile - 새로 활성화된 파일
	 * @returns 재렌더링이 필요하면 true
	 * 
	 * @remarks
	 * 재렌더링이 필요한 경우:
	 * - 폴더 모드에서 다른 폴더로 이동
	 * - 활성 파일 태그 모드에서 파일 변경
	 * 
	 * 재렌더링이 불필요한 경우:
	 * - 폴더 모드에서 같은 폴더 내 이동
	 * - 지정된 태그 모드 (고정 태그)
	 * - 검색 모드 (결과 불변)
	 * - 첫 로드인데 이미 렌더링 완료된 경우
	 */
	needsRerenderForFileChange(newActiveFile: TFile | null): boolean {
		return this.needsRerenderForFileChangeWithPrevious(newActiveFile, this.state.getPreviousFile());
	}

	/**
	 * ⭐ 파일 변경 시 재렌더링이 필요한지 확인합니다 (이전 파일 정보 직접 전달)
	 *
	 * @param newActiveFile - 새로운 활성 파일
	 * @param previousFile - 이전 활성 파일 (setPreviousFile 전에 저장된 값)
	 * @returns 재렌더링이 필요한 경우 true
	 *
	 * @remarks
	 * active-leaf-change 핸들러에서 중복 이벤트 방지를 위해 setPreviousFile을 먼저 호출하므로,
	 * 이전 파일 정보를 미리 저장해서 이 메서드에 전달해야 합니다.
	 */
	needsRerenderForFileChangeWithPrevious(newActiveFile: TFile | null, previousFile: TFile | null): boolean {
		if (!isValidFile(newActiveFile)) {
			return false;
		}

		// 첫 로드 체크 (이전 파일이 없음)
		if (!isValidFile(previousFile)) {
			// lastRenderState가 있으면 이미 초기 렌더링이 완료됨
			// onOpen()에서 초기 렌더링을 수행하므로 active-leaf-change 이벤트로 인한
			// 중복 렌더링을 방지합니다.
			if (this.lastRenderState !== null) {
				this.logger.debug('View', 'No previous file but already rendered → no rerender needed');
				return false;
			}

			// 아직 렌더링되지 않았으면 재렌더링 필요
			this.logger.debug('View', 'No previous file (first load) → rerender needed');
			return true;
		}

		// 검색 모드에서는 재렌더링 불필요 (검색 결과는 파일 변경과 무관)
		if (this.state.hasSearchQuery()) {
			this.logger.debug('View', 'Search mode → no rerender needed');
			return false;
		}

		// 태그 모드
		if (this.settings.currentMode === 'tag') {
			// 활성 파일 태그 모드: 파일마다 태그가 다르므로 재렌더링 필요
			if (this.settings.tagMode.useActiveFileTags) {
				this.logger.debug('View', 'Active file tags mode → rerender needed');
				return true;
			}

			// 지정된 태그 모드: 태그가 고정되어 있으므로 재렌더링 불필요
			this.logger.debug('View', 'Specified tags mode → no rerender needed');
			return false;
		}

		// 폴더 모드: 폴더가 변경되었는지 확인
		const previousFolder = previousFile.parent;
		const currentFolder = newActiveFile.parent;

		if (previousFolder?.path !== currentFolder?.path) {
			this.logger.debug('View', 'Folder mode + folder changed → rerender needed', {
				previousFolder: previousFolder?.path || 'root',
				currentFolder: currentFolder?.path || 'root'
			});
			return true;
		}

		this.logger.debug('View', 'Folder mode + same folder → no rerender needed');
		return false;
	}
	
	/**
	 * LayoutManager 인스턴스를 업데이트합니다
	 * 
	 * @param layoutManager - 새 LayoutManager 인스턴스
	 */
	updateLayoutManager(layoutManager: LayoutManager | null): void {
		this.layoutManager = layoutManager;
	}
	
	/**
	 * 렌더링 상태를 초기화하여 다음 렌더링을 강제합니다
	 *
	 * @remarks
	 * 파일 구조 변경 시 사용: 파일 삭제/생성, 폴더 구조 변경
	 */
	resetRenderState(): void {
		this.lastRenderState = null;
		this.lastDetailedState = null; // ⭐ Phase 1.2
	}
	
	/**
	 * 표준 렌더링 (기존 방식)
	 * 
	 * @param container - 카드를 추가할 컨테이너
	 * @param onFileOpen - 파일 열기 콜백
	 * @param renderingId - 렌더링 ID
	 * @param files - 파일 목록
	 * 
	 * @private
	 */
	private async renderCardsStandard(
		container: HTMLElement,
		onFileOpen: (file: TFile) => void,
		renderingId: number,
		files: TFile[]
	): Promise<void> {
		// ⭐ Matrix 모드에서 전환 시 matrix-view 클래스 제거
		container.classList.remove('matrix-view');

		if (this.shouldCancelRendering(renderingId, 'before rendering')) {
			return;
		}

		const currentActiveFile = this.getActiveFile();

		if (files.length === 0) {
			if (this.shouldCancelRendering(renderingId, 'before empty message')) {
				return;
			}

			container.createEl('div', {
				cls: 'card-navigator-empty',
				text: 'No files to display'
			});

			// ⭐ 파일이 없어도 Context Bar는 업데이트 (모드 전환 시 필요)
			this.initializeContextBar();
			return;
		}

		this.selectionManager.setAllFiles(files);

		// ⭐ 그룹화 및 활성 파일 자동 펼치기
		const groups = this.prepareGroups(files, currentActiveFile, 'Standard');

		// ⭐ 현재 그룹 저장 (Context Bar 업데이트용)
		this.currentGroups = groups;

		// ⭐ 프로파일링 시작 (Phase 4.1)
		this.profiler.startMeasure('standard', files.length, groups.length);

		// ⭐ Phase 4: 계층 구조 모드 확인
		const isHierarchyMode = this.settings.grouping.groupSort === 'hierarchy' &&
			(this.settings.grouping.criteria === 'folder' || this.settings.grouping.criteria === 'tag');

		// ⭐ DocumentFragment 활용: 모든 그룹을 먼저 생성한 후 한 번에 DOM에 추가
		const containerFragment = document.createDocumentFragment();

		// 그룹별로 렌더링
		for (const group of groups) {
			if (this.shouldCancelRendering(renderingId, 'during group rendering')) {
				return;
			}

			// ⭐ Phase 4: 계층 구조에서는 자식만 있고 파일이 없는 그룹도 헤더 표시
			// 플랫 모드에서는 빈 그룹 스킵
			const hasChildren = group.children && group.children.length > 0;
			if (group.files.length === 0 && !hasChildren) {
				this.logger.debug('View', 'Skipping empty group', {
					groupId: group.id,
					groupName: group.name
				});
				continue;
			}

			// ⭐ Phase 4: 계층 구조 모드일 때 다른 렌더러 사용
			const tempGroupContainer = document.createElement('div');
			const section = isHierarchyMode
				? this.groupRenderer.createHierarchicalGroupSection(
					group,
					tempGroupContainer,
					(groupId, collapsed) => this.onHierarchicalGroupToggle(groupId, collapsed, container),
					(groupId) => this.onGroupSelectAll(groupId),
					currentActiveFile
				)
				: this.groupRenderer.createGroupSection(
					group,
					tempGroupContainer,
					(groupId, collapsed) => this.onGroupToggle(groupId, collapsed),
					(groupId) => this.onGroupSelectAll(groupId),
					currentActiveFile
				);

			// 그룹이 접혀있지 않으면 카드 렌더링
			if (!group.collapsed) {
				// 카드 컨테이너 찾기
				const cardContainer = this.groupRenderer.findCardContainer(section);
				if (cardContainer) {
					// ⭐ 증분 렌더링: 카드가 50개 이상이면 청크 단위로 렌더링 (Phase 3.1)
					const INCREMENTAL_THRESHOLD = 50;

					if (group.files.length >= INCREMENTAL_THRESHOLD) {
						this.logger.debug('View', 'Using incremental rendering for large group', {
							groupId: group.id,
							fileCount: group.files.length
						});

						// ⭐ Section 13.1: 진행률 바 표시
						if (this.progressBar) {
							this.progressBar.show();
						}

						// 증분 렌더링 사용
						const success = await this.incrementalRenderer.renderInChunks(
							group.files,
							cardContainer,
							currentActiveFile,
							onFileOpen,
							(progress) => {
								// ⭐ Section 13.1: 진행률 업데이트
								if (this.progressBar) {
									this.progressBar.updateProgress(progress);
								}
							},
							renderingId
						);

						if (!success) {
							// 렌더링이 취소됨
							if (this.progressBar) {
								this.progressBar.hide(false); // 즉시 숨김
							}
							return;
						}
					} else {
						// 기존 방식: DocumentFragment 사용
						const cardFragment = document.createDocumentFragment();
						for (const file of group.files) {
							if (this.shouldCancelRendering(renderingId, 'during card creation')) {
								return;
							}

							await this.cardFactory.createCard(
								file,
								cardFragment as unknown as HTMLElement,
								currentActiveFile,
								onFileOpen
							);
						}

						// 카드들을 한 번에 DOM에 추가
						cardContainer.appendChild(cardFragment);
					}
				}
			}

			// 그룹 섹션을 컨테이너 fragment에 추가
			containerFragment.appendChild(section);
		}

		// ⭐ 모든 그룹을 한 번에 DOM에 추가 (리플로우 최소화)
		container.appendChild(containerFragment);

		if (this.shouldCancelRendering(renderingId, 'before layout update')) {
			return;
		}

		if (isDefined(this.layoutManager)) {
			this.layoutManager.updateLayout();
		}

		// ⭐ 활성 카드로 즉시 스크롤 (애니메이션 없이)
		if (currentActiveFile) {
			const activeCard = Array.from(container.querySelectorAll('.card-item')).find(
				card => (card as HTMLElement).dataset.filePath === currentActiveFile.path
			) as HTMLElement;

			if (activeCard) {
				const isHorizontalMode = container.classList.contains('horizontal-mode');
				const finalBlock: ScrollLogicalPosition = isHorizontalMode ? 'nearest' : 'center';
				const finalInline: ScrollLogicalPosition = isHorizontalMode ? 'center' : 'nearest';

				activeCard.scrollIntoView({
					behavior: 'instant',
					block: finalBlock,
					inline: finalInline
				});
			}
		}

		// ⭐ DOM에 실제로 렌더링된 카드만 수집 (접힌 그룹의 카드 제외)
		const cardElements = Array.from(
			container.querySelectorAll('.card-item')
		) as HTMLElement[];

		// DOM 순서대로 파일 배열 재구성
		const visibleFiles = cardElements
			.map(card => {
				const path = card.dataset.filePath;
				if (!path) return null;
				return files.find(f => f.path === path);
			})
			.filter(f => f !== null) as TFile[];

		this.keyboardNav.updateCards(cardElements, visibleFiles);

		// ⭐ Phase 3.5: ViewportLayoutManager에 카드 목록 업데이트
		if (isDefined(this.layoutManager)) {
			this.layoutManager.updateViewportCards(cardElements);
		}

		// ⭐ Section 8.3: 카드 요소 캐시 빌드
		this.selectionManager.buildCardCache();

		// ⭐ 프로파일링 종료 (Phase 4.1)
		this.profiler.endMeasure();

		this.logger.debug('View', 'Standard render completed', {
			renderingId,
			fileCount: files.length,
			timestamp: Date.now()
		});

		// Update file count in toolbar
		const toolbar = this.view.getToolbar();
		if (toolbar) {
			const totalFiles = this.app.vault.getMarkdownFiles().length;
			toolbar.updateFileCount(files.length, totalFiles);
		}

		// ⭐ Context Bar 초기 업데이트 (항상 표시)
		// Context Bar는 그룹화 여부와 관계없이 항상 표시되어야 함
		this.initializeContextBar();

		// 그룹화가 활성화된 경우 스크롤 이벤트 리스너 등록
		if (this.settings.grouping.enabled && groups.length > 0) {
			if (this.scrollHandler) {
				container.addEventListener('scroll', this.scrollHandler);
			}
		}
	}

	/**
	 * 파일이 현재 뷰 범위에 있는지 확인합니다
	 * 
	 * @param file - 확인할 파일
	 * @returns 현재 뷰 범위에 있으면 true
	 * 
	 * @remarks
	 * 파일 변경이 재렌더링을 트리거해야 하는지 판단하는 데 사용됩니다.
	 */
	isFileInCurrentView(file: TFile): boolean {
		this.logger.debug('View', t().viewRenderer.comments.fileInCurrentViewCheck, {
			file: file.path,
			mode: this.settings.currentMode,
			hasSearchQuery: this.state.hasSearchQuery()
		});

		// 검색 모드인 경우 - 단순화를 위해 무조건 true 반환
		// 실제 검색 결과에 포함되는지 확인하려면 성능 비용이 큼
		if (this.state.hasSearchQuery()) {
			this.logger.debug('View', t().viewRenderer.comments.searchMode);
			return true;
		}

		// 태그 모드
		if (this.settings.currentMode === 'tag') {
			this.logger.debug('View', t().viewRenderer.comments.tagModeCheck, {
				useActiveFileTags: this.settings.tagMode.useActiveFileTags
			});
			return this.isFileInTagMode(file);
		}

		// 폴더 모드
		this.logger.debug('View', t().viewRenderer.comments.folderModeCheck, {
			useActiveFolder: this.settings.folderMode.useActiveFolder,
			includeSubfolders: this.settings.folderMode.includeSubfolders
		});
		return this.isFileInFolderMode(file);
	}
	
	/**
	 * Viewport 기반으로 카드를 렌더링합니다 (성능 최적화)
	 * 
	 * @param container - 카드를 추가할 컨테이너
	 * @param onFileOpen - 파일 열기 콜백
	 * 
	 * @remarks
	 * 플레이스홀더를 먼저 생성하고, viewport에 진입한 카드만 실제 렌더링합니다.
	 * 활성 카드 주변은 초기에 강제 렌더링합니다.
	 */
	private async renderCardsWithViewport(
		container: HTMLElement,
		onFileOpen: (file: TFile) => void,
		renderingId: number
	): Promise<void> {
		// ⭐ Matrix 모드에서 전환 시 matrix-view 클래스 제거
		container.classList.remove('matrix-view');

		if (this.shouldCancelRendering(renderingId, 'before viewport setup')) {
			return;
		}

		// 기존 ViewportManager 정리
		if (this.viewportManager) {
			this.viewportManager.destroy();
			this.viewportManager = null;
		}

		if (this.shouldCancelRendering(renderingId, 'before rendering')) {
			return;
		}

		const currentActiveFile = this.getActiveFile();

		const files = await this.getFilesToDisplay();

		if (this.shouldCancelRendering(renderingId, 'after file list fetch')) {
			return;
		}

		if (files.length === 0) {
			container.createEl('div', {
				cls: 'card-navigator-empty',
				text: 'No files to display'
			});

			// ⭐ 파일이 없어도 Context Bar는 업데이트 (모드 전환 시 필요)
			this.initializeContextBar();
			return;
		}

		this.selectionManager.setAllFiles(files);

		// ⭐ 그룹화 및 활성 파일 자동 펼치기
		const groups = this.prepareGroups(files, currentActiveFile, 'Viewport');

		// ⭐ 현재 그룹 저장 (Context Bar 업데이트용)
		this.currentGroups = groups;

		// ⭐ 프로파일링 시작 (Phase 4.1)
		this.profiler.startMeasure('viewport', files.length, groups.length);

		// 1. 모든 파일에 대한 플레이스홀더 생성 (그룹별로)
		const placeholders: HTMLElement[] = [];
		let activeIndex = -1;
		let currentIndex = 0;

		// ⭐ DocumentFragment 활용: 모든 그룹을 먼저 생성한 후 한 번에 DOM에 추가
		const containerFragment = document.createDocumentFragment();

		// 그룹별로 렌더링
		for (const group of groups) {
			if (this.shouldCancelRendering(renderingId, 'during group rendering')) {
				return;
			}

			// 빈 그룹은 스킵 (파일이 없는 그룹)
			if (group.files.length === 0) {
				this.logger.debug('View', 'Skipping empty group', {
					groupId: group.id,
					groupName: group.name
				});
				continue;
			}

			// 그룹 섹션 생성 (임시 컨테이너에)
			const tempGroupContainer = document.createElement('div');
			const section = this.groupRenderer.createGroupSection(
				group,
				tempGroupContainer,
				(groupId, collapsed) => this.onGroupToggle(groupId, collapsed),
				(groupId) => this.onGroupSelectAll(groupId),
				currentActiveFile
			);

			// 그룹이 접혀있지 않으면 플레이스홀더 생성
			if (!group.collapsed) {
				// 카드 컨테이너 찾기
				const cardContainer = this.groupRenderer.findCardContainer(section);
				if (cardContainer) {
					// ⭐ DocumentFragment 사용: 플레이스홀더들을 먼저 fragment에 모아서 한 번에 추가
					const placeholderFragment = document.createDocumentFragment();

					for (const file of group.files) {
						const isActive = isValidFile(currentActiveFile) && currentActiveFile.path === file.path;

						if (isActive) {
							activeIndex = currentIndex;
						}

						const placeholder = this.cardFactory.createPlaceholder(
							file,
							placeholderFragment as unknown as HTMLElement,
							isActive
						);

						placeholders.push(placeholder);
						currentIndex++;
					}

					// 플레이스홀더를 한 번에 DOM에 추가
					cardContainer.appendChild(placeholderFragment);
				}
			}

			// 그룹 섹션을 컨테이너 fragment에 추가
			containerFragment.appendChild(section);
		}

		// ⭐ 모든 그룹을 한 번에 DOM에 추가 (리플로우 최소화)
		container.appendChild(containerFragment);

		this.logger.debug('View', 'Placeholders created', {
			count: placeholders.length,
			activeIndex
		});

		if (this.shouldCancelRendering(renderingId, 'after placeholder creation')) {
			return;
		}

		// ⭐ 활성 카드로 즉시 스크롤 (애니메이션 없이, ViewportManager 생성 전)
		if (activeIndex >= 0 && placeholders[activeIndex]) {
			const activeCard = placeholders[activeIndex];
			const isHorizontalMode = container.classList.contains('horizontal-mode');
			const finalBlock: ScrollLogicalPosition = isHorizontalMode ? 'nearest' : 'center';
			const finalInline: ScrollLogicalPosition = isHorizontalMode ? 'center' : 'nearest';

			activeCard.scrollIntoView({
				behavior: 'instant',
				block: finalBlock,
				inline: finalInline
			});
		}

		// 2. ViewportManager 생성
		this.viewportManager = new ViewportManager(
			container,
			async (card: HTMLElement) => {
				await this.cardFactory.renderPlaceholder(card, onFileOpen);
			},
			undefined, // onCardHidden 콜백은 선택사항
			this.settings, // 디버그 로깅용
			{
				rootMargin: VIEWPORT.PRELOAD_MARGIN,
				threshold: VIEWPORT.VISIBILITY_THRESHOLD
			}
		);

		// 3. 모든 플레이스홀더를 ViewportManager에 등록
		placeholders.forEach(placeholder => {
			this.viewportManager?.observe(placeholder);
		});

		// 4. 활성 카드 주변 초기 렌더링
		if (activeIndex >= 0) {
			await this.renderInitialCards(placeholders, activeIndex, onFileOpen);
		}

		if (this.shouldCancelRendering(renderingId, 'after initial render')) {
			return;
		}

		// 5. 레이아웃 적용
		if (isDefined(this.layoutManager)) {
			this.layoutManager.updateLayout();
		}

		// 6. 키보드 네비게이션 설정
		// ⭐ DOM에 실제로 렌더링된 카드만 수집 (접힌 그룹의 카드 제외)
		const cardElements = Array.from(
			container.querySelectorAll('.card-item')
		) as HTMLElement[];

		// DOM 순서대로 파일 배열 재구성
		const visibleFiles = cardElements
			.map(card => {
				const path = card.dataset.filePath;
				if (!path) return null;
				return files.find(f => f.path === path);
			})
			.filter(f => f !== null) as TFile[];

		this.keyboardNav.updateCards(cardElements, visibleFiles);

		// ⭐ Phase 3.5: ViewportLayoutManager에 카드 목록 업데이트
		if (isDefined(this.layoutManager)) {
			this.layoutManager.updateViewportCards(cardElements);
		}

		// ⭐ Section 8.3: 카드 요소 캐시 빌드
		this.selectionManager.buildCardCache();

		// ⭐ 프로파일링 종료 (Phase 4.1)
		this.profiler.endMeasure();

		this.logger.debug('View', 'Viewport rendering complete', {
			renderingId,
			totalCards: files.length,
			visibleCards: this.viewportManager?.getVisibleCards().length || 0
		});

		// Update file count in toolbar
		const toolbar = this.view.getToolbar();
		if (toolbar) {
			const totalFiles = this.app.vault.getMarkdownFiles().length;
			toolbar.updateFileCount(files.length, totalFiles);
		}

		// ⭐ Context Bar 초기 업데이트 (항상 표시)
		// Context Bar는 그룹화 여부와 관계없이 항상 표시되어야 함
		this.initializeContextBar();

		// 그룹화가 활성화된 경우 스크롤 이벤트 리스너 등록
		if (this.settings.grouping.enabled && groups.length > 0) {
			if (this.scrollHandler) {
				container.addEventListener('scroll', this.scrollHandler);
			}
		}
	}

	/**
	 * 초기에 활성 카드 주변 카드들을 강제 렌더링
	 *
	 * @remarks
	 * 사용자가 즉시 볼 수 있도록 활성 카드와 그 주변 카드를 먼저 렌더링합니다.
	 * 핀된 파일 항상 표시 옵션이 활성화되어 있으면 핀된 카드도 함께 렌더링합니다.
	 *
	 * @private
	 */
	private async renderInitialCards(
		placeholders: HTMLElement[],
		activeIndex: number,
		onFileOpen: (file: TFile) => void
	): Promise<void> {
		const halfCount = Math.floor(VIEWPORT.INITIAL_RENDER_COUNT / 2);
		const startIndex = Math.max(0, activeIndex - halfCount);
		const endIndex = Math.min(
			placeholders.length,
			activeIndex + halfCount + 1
		);

		this.logger.debug('View', 'Rendering initial cards', {
			activeIndex,
			startIndex,
			endIndex,
			count: endIndex - startIndex
		});

		// 활성 카드 주변 렌더링
		for (let i = startIndex; i < endIndex; i++) {
			const placeholder = placeholders[i];

			if (!placeholder.classList.contains('card-rendered')) {
				await this.cardFactory.renderPlaceholder(placeholder, onFileOpen);
			}
		}

		// 핀된 파일 항상 표시 옵션이 활성화되어 있으면 핀된 카드도 모두 렌더링
		if (this.settings.alwaysShowPinnedFiles && this.settings.pinnedFiles && this.settings.pinnedFiles.length > 0) {
			this.logger.debug('View', 'Rendering pinned cards', {
				pinnedCount: this.settings.pinnedFiles.length
			});

			for (const placeholder of placeholders) {
				const filePath = placeholder.dataset.filePath;
				if (filePath && this.settings.pinnedFiles.includes(filePath)) {
					if (!placeholder.classList.contains('card-rendered')) {
						await this.cardFactory.renderPlaceholder(placeholder, onFileOpen);
					}
				}
			}
		}
	}
	
	/**
	 * 특정 파일을 포함하는 접힌 그룹을 찾아서 펼칩니다
	 *
	 * @param container - 컨테이너 요소
	 * @param file - 찾을 파일
	 * @returns 펼쳐진 그룹 이름, 없으면 null
	 */
	expandGroupContainingFile(container: HTMLElement, file: TFile): string | null {
		const allGroupSections = this.groupRenderer.findAllGroupSections(container);

		// 접힌 그룹만 필터링
		const collapsedSections = allGroupSections.filter(s => s.hasClass('is-collapsed'));
		if (collapsedSections.length === 0) {
			return null;
		}

		// 파일 목록 가져오기
		const files = this.getFilesToDisplaySync();
		if (!files) {
			return null;
		}

		// 그룹 생성 (핀된 파일 정보 전달)
		const groups = this.groupingManager.groupFiles(files, this.settings.grouping, this.settings.pinnedFiles);

		// 접힌 그룹 중 활성 파일을 포함하는 그룹 찾기
		for (const section of collapsedSections) {
			const groupId = section.dataset.groupId;
			if (!groupId) continue;

			const group = groups.find(g => g.id === groupId);
			if (!group) continue;

			const hasActiveFile = group.files.some(f => f.path === file.path);
			if (hasActiveFile) {
				// 그룹 펼치기
				this.onGroupToggle(groupId, false);
				this.logger.debug('View', 'Expanded collapsed group via file click', {
					groupId,
					groupName: group.name,
					activeFile: file.basename
				});
				return group.name;
			}
		}

		return null;
	}

	/**
	 * 파일 목록을 동기적으로 가져옵니다 (캐시된 데이터 사용)
	 *
	 * @remarks
	 * ⭐ Performance: getFilesWithCache()를 사용하여 중복 조회 방지
	 */
	private getFilesToDisplaySync(): TFile[] | null {
		try {
			if (this.state.hasSearchQuery()) {
				return null; // 검색 모드는 비동기 필요
			}

			// ⭐ Performance: 캐싱된 파일 목록 사용
			return this.getFilesWithCache();
		} catch (error) {
			this.logger.debug('View', 'Failed to get files synchronously', { error });
			return null;
		}
	}

	/**
	 * 그룹 토글 핸들러
	 *
	 * @param groupId - 그룹 ID
	 * @param collapsed - 접힌 상태
	 */
	private async onGroupToggle(groupId: string, collapsed: boolean): Promise<void> {
		// 상태 저장
		this.groupingManager.saveCollapsedState(groupId, collapsed);

		// UI 업데이트
		const section = this.groupRenderer.findGroupSection(
			this.view.containerEl,
			groupId
		);

		if (section) {
			this.groupRenderer.toggleGroup(section, collapsed);

			this.logger.debug('View', 'Group toggled', {
				groupId,
				collapsed,
				sectionFound: !!section,
				hasCollapsedClass: section.hasClass('is-collapsed')
			});

			// 펼쳐질 때 카드가 렌더링되지 않았으면 렌더링
			if (!collapsed) {
				await this.renderGroupCards(section, groupId);
			}
		} else {
			this.logger.debug('View', 'Group section not found for toggle', {
				groupId,
				collapsed
			});
		}
	}

	/**
	 * ⭐ Phase 4: 계층 구조 그룹 토글 핸들러
	 *
	 * @remarks
	 * 부모 그룹이 접히면 자식 그룹들도 함께 숨깁니다.
	 *
	 * @param groupId - 그룹 ID
	 * @param collapsed - 접힌 상태
	 * @param container - 카드 컨테이너 (자식 그룹 처리용)
	 */
	private async onHierarchicalGroupToggle(
		groupId: string,
		collapsed: boolean,
		container: HTMLElement
	): Promise<void> {
		// 상태 저장
		this.groupingManager.saveCollapsedState(groupId, collapsed);

		// UI 업데이트
		const section = this.groupRenderer.findGroupSection(
			this.view.containerEl,
			groupId
		);

		if (section) {
			// 계층 구조 토글 (자식 그룹도 함께 처리)
			this.groupRenderer.toggleHierarchicalGroup(section, collapsed, container);

			this.logger.debug('View', 'Hierarchical group toggled', {
				groupId,
				collapsed,
				sectionFound: !!section
			});

			// 펼쳐질 때 카드가 렌더링되지 않았으면 렌더링
			if (!collapsed) {
				await this.renderGroupCards(section, groupId);
			}
		} else {
			this.logger.debug('View', 'Hierarchical group section not found for toggle', {
				groupId,
				collapsed
			});
		}
	}

	/**
	 * 그룹 내 카드를 렌더링합니다 (지연 렌더링용)
	 *
	 * @param section - 그룹 섹션
	 * @param groupId - 그룹 ID
	 */
	private async renderGroupCards(section: HTMLElement, groupId: string): Promise<void> {
		const cardContainer = this.groupRenderer.findCardContainer(section);
		if (!cardContainer) {
			this.logger.debug('View', 'Card container not found for group', { groupId });
			return;
		}

		// 이미 렌더링되어 있으면 스킵
		if (cardContainer.children.length > 0) {
			this.logger.debug('View', 'Group cards already rendered', {
				groupId,
				cardCount: cardContainer.children.length
			});
			return;
		}

		// 그룹의 파일 목록을 다시 가져와서 렌더링 (핀된 파일 정보 전달)
		const files = await this.getFilesToDisplay();
		const groups = this.groupingManager.groupFiles(files, this.settings.grouping, this.settings.pinnedFiles);
		const group = groups.find(g => g.id === groupId);

		if (!group || group.files.length === 0) {
			this.logger.debug('View', 'Group not found or empty', {
				groupId,
				groupFound: !!group,
				fileCount: group?.files.length || 0
			});
			return;
		}

		this.logger.debug('View', 'Rendering group cards on expand', {
			groupId,
			fileCount: group.files.length
		});

		// ⭐ 프로파일링 시작 (Phase 4.1)
		this.profiler.startMeasure('group-expand', group.files.length, 1);

		// 카드 렌더링
		const currentActiveFile = this.getActiveFile();
		const onFileOpen = (file: TFile) => {
			this.view.openFile(file);
		};

		// ⭐ DocumentFragment 사용: 카드들을 먼저 fragment에 모아서 한 번에 추가
		const cardFragment = document.createDocumentFragment();
		for (const file of group.files) {
			await this.cardFactory.createCard(
				file,
				cardFragment as unknown as HTMLElement,
				currentActiveFile,
				onFileOpen
			);
		}

		// 카드들을 한 번에 DOM에 추가
		cardContainer.appendChild(cardFragment);

		// 레이아웃 업데이트
		if (isDefined(this.layoutManager)) {
			this.layoutManager.updateLayout();
		}

		// 키보드 네비게이션 업데이트
		// ⭐ DOM에 실제로 렌더링된 카드만 수집 (접힌 그룹의 카드 제외)
		const cardElements = Array.from(
			this.view.containerEl.querySelectorAll('.card-item')
		) as HTMLElement[];

		// DOM 순서대로 파일 배열 재구성
		const visibleFiles = cardElements
			.map(card => {
				const path = card.dataset.filePath;
				if (!path) return null;
				return files.find(f => f.path === path);
			})
			.filter(f => f !== null) as TFile[];

		this.keyboardNav.updateCards(cardElements, visibleFiles);

		// ⭐ Phase 3.5: ViewportLayoutManager에 카드 목록 업데이트
		if (isDefined(this.layoutManager)) {
			this.layoutManager.updateViewportCards(cardElements);
		}

		// ⭐ 프로파일링 종료 (Phase 4.1)
		this.profiler.endMeasure();
	}

	/**
	 * 그룹 내 모든 카드 선택 핸들러
	 *
	 * @param groupId - 그룹 ID
	 */
	private onGroupSelectAll(groupId: string): void {
		const cardContainer = this.view.containerEl.querySelector(
			`.card-group-content[data-group-id="${groupId}"]`
		) as HTMLElement;

		if (cardContainer) {
			const cards = cardContainer.querySelectorAll('.card-item');
			const files = Array.from(cards)
				.map(card => {
					const path = (card as HTMLElement).dataset.filePath;
					if (!path) return null;
					const file = this.app.vault.getAbstractFileByPath(path);
					return file instanceof TFile ? file : null;
				})
				.filter(f => f !== null) as TFile[];

			if (files.length > 0) {
				// 선택 초기화 후 그룹 파일들 추가
				this.selectionManager.clearSelection();
				files.forEach(file => {
					// SelectionManager의 내부 selected Set에 직접 접근하기 위해
					// toggleSelection을 사용 (Ctrl 키를 시뮬레이션)
					const mockEvent = new MouseEvent('click', { ctrlKey: true });
					this.selectionManager.toggleSelection(file, mockEvent);
				});

				this.logger.debug('View', 'Selected all files in group', {
					groupId,
					count: files.length
				});
			}
		}
	}

	/**
	 * ⭐ ViewportManager 정리 및 그룹 상태 플러시 (Phase 2)
	 */
	destroy(): void {
		if (this.viewportManager) {
			this.viewportManager.destroy();
			this.viewportManager = null;
		}

		// ⭐ 스크롤 이벤트 리스너 정리
		if (this.scrollHandler) {
			const container = this.view.containerEl.querySelector('.card-navigator-cards');
			if (container) {
				container.removeEventListener('scroll', this.scrollHandler);
			}
			this.scrollHandler = null;
		}

		// ⭐ 현재 그룹 목록 초기화
		this.currentGroups = [];

		// ⭐ 그룹 상태 즉시 저장
		this.groupingManager.flush();
	}

	/**
	 * ⭐ 렌더링 성능 리포트를 콘솔에 출력합니다 (Phase 4.1)
	 *
	 * @remarks
	 * 개발자 콘솔에서 호출 가능:
	 * app.workspace.getLeavesOfType('card-navigator')[0].view.renderer.printPerformanceReport()
	 */
	printPerformanceReport(): void {
		this.profiler.printReport();
	}

	/**
	 * ⭐ 렌더링 성능 리포트를 반환합니다 (Phase 4.1)
	 */
	getPerformanceReport() {
		return this.profiler.exportReport();
	}

	/**
	 * ⭐ 프로파일러를 활성화/비활성화합니다 (Phase 4.1)
	 */
	enableProfiler(enabled: boolean): void {
		if (enabled) {
			this.profiler.enable();
		} else {
			this.profiler.disable();
		}
	}

	/**
	 * ⭐ 성능 메트릭을 초기화합니다 (Phase 4.1)
	 */
	clearPerformanceMetrics(): void {
		this.profiler.clearMetrics();
	}

	// =========================================================================
	// 2D Matrix Grouping (Eisenhower Matrix)
	// =========================================================================

	/**
	 * 🆕 2D 매트릭스 모드로 카드를 렌더링합니다
	 *
	 * @remarks
	 * 아이젠하워 매트릭스와 같은 2D 그리드 레이아웃으로 카드를 표시합니다.
	 * 두 가지 프론트매터 속성을 기준으로 파일을 N×M 그리드에 배치합니다.
	 *
	 * @param container - 렌더링할 컨테이너
	 * @param onFileOpen - 파일 오픈 콜백
	 * @param files - 표시할 파일 목록
	 */
	private async renderCardsAsMatrix(
		container: HTMLElement,
		onFileOpen: (file: TFile) => void,
		files: TFile[]
	): Promise<void> {
		const matrixSettings = this.settings.grouping.matrix2D;

		// Matrix CSS 로드
		await getStyleLoader().loadMatrixStyles();

		// ⭐ 기존 레이아웃 클래스 제거 (Matrix 모드는 독립적)
		container.classList.remove('vertical-mode', 'horizontal-mode');

		// ⭐ 기존 레이아웃 CSS 변수 제거 (Matrix는 자체 CSS 사용)
		container.style.removeProperty('--card-min-width');
		container.style.removeProperty('--card-min-height');
		container.style.removeProperty('--card-max-width');
		container.style.removeProperty('--card-max-height');
		container.style.removeProperty('--card-gap');
		container.style.removeProperty('--grid-columns');
		container.style.removeProperty('--grid-rows');

		container.classList.add('matrix-view');

		// MatrixRenderer가 없으면 생성
		if (!this.matrixRenderer) {
			this.matrixRenderer = new MatrixRenderer(
				this.app,
				container,
				() => this.settings,
				// createCard 콜백 - CardFactory 사용
				async (file, cardContainer, activeFile, fileOpenCallback) => {
					return this.cardFactory.createCard(file, cardContainer, activeFile, fileOpenCallback);
				},
				this.view.dragDropHandler,
				onFileOpen,
				// onPropertyChange 콜백
				async (file, primaryProp, primaryVal, secondaryProp, secondaryVal) => {
					await this.view.dragDropHandler.updateFileProperties(file, {
						[primaryProp]: primaryVal,
						[secondaryProp]: secondaryVal
					});
					// 뷰 리렌더링
					await this.forceRender(container, onFileOpen);
				},
				// onCellToggle 콜백
				(cellId, collapsed) => {
					this.groupingManager.saveMatrixCellCollapsedState(cellId, collapsed);
				}
			);
		}

		// 파일을 2D 매트릭스로 그룹화
		const grid = this.groupingManager.groupFilesAs2DMatrix(files, matrixSettings);

		// 매트릭스 렌더링
		await this.matrixRenderer.render(grid);

		this.logger.debug('View', '2D Matrix rendering complete', {
			totalFiles: grid.totalFileCount,
			unclassifiedCount: grid.unclassifiedFiles.length,
			gridSize: `${grid.primaryLabels.length}x${grid.secondaryLabels.length}`
		});

		// Update file count in toolbar
		const toolbar = this.view.getToolbar();
		if (toolbar) {
			const totalFiles = this.app.vault.getMarkdownFiles().length;
			toolbar.updateFileCount(files.length, totalFiles);
		}
	}
}

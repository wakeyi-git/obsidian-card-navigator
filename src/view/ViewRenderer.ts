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
import CardNavigatorPlugin from '../main';
import type { CardNavigatorView } from '../view';
import { isValidFile, isDefined } from '../utils/typeGuards';
import { DebugLogger } from '../utils/DebugLogger';
import { ViewportManager } from './ViewportManager';
import { VIEWPORT } from '../constants';
import { t } from '../i18n';

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
	private logger: DebugLogger;
	
	private lastRenderState: string | null = null;
	
	/** Viewport 관리자 (viewport 렌더링용) */
	public viewportManager: ViewportManager | null = null;
	
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
	 */
	private shouldCancelRendering(renderingId: number, context: string): boolean {
		const shouldCancel = renderingId !== this.state.getCurrentRenderingId();
		
		if (shouldCancel) {
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
	
	/** 활성 파일이 유효한지 확인 */
	private hasValidActiveFile(): boolean {
		return isValidFile(this.getActiveFile());
	}
	
	/** 활성 파일의 태그 배열 */
	private getActiveFileTags(): string[] {
		const activeFile = this.getActiveFile();
		if (!isValidFile(activeFile)) {
			return [];
		}
		
		const cache = this.app.metadataCache.getFileCache(activeFile);
		return cache?.tags?.map(t => t.tag) || [];
	}
	
	/**
	 * 파일의 태그 배열을 가져옵니다
	 * 
	 * @param file - 대상 파일
	 */
	private getFileTags(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		return cache?.tags?.map(t => t.tag) || [];
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
			const hasSpecifiedTag = fileTags.some(tag => specifiedTags.includes(tag));
			
			this.logger.debug('View', t().viewRenderer.comments.specifiedTagMode, {
				specifiedTags,
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
	}
	
	/**
	 * 카드를 렌더링합니다
	 * 
	 * @param container - 카드를 추가할 컨테이너
	 * @param onFileOpen - 파일 열기 콜백
	 * 
	 * @remarks
	 * 상태 해시 기반 렌더링 스킵, 스크롤 위치 보존, 렌더링 ID 시스템을 통해
	 * 성능을 최적화하고 빠른 파일 전환을 처리합니다.
	 */
	async renderCards(
		container: HTMLElement,
		onFileOpen: (file: TFile) => void
	): Promise<void> {
		const currentState = await this.generateStateHash();
		
		if (currentState === this.lastRenderState) {
			this.logger.debug('View', 'State unchanged, skipping render');
			return;
		}
		
		const renderingId = this.state.startRendering();
		
		this.logger.debug('View', 'Render started', {
			renderingId,
			isRendering: this.state.getIsRendering(),
			timestamp: Date.now(),
			stateHash: currentState.substring(0, 10) + '...'
		});

	try {
			// 파일 개수 확인
			const files = await this.getFilesToDisplay();
			
			if (this.shouldCancelRendering(renderingId, 'after file list fetch')) {
				return;
			}
			
			// 100개 이상이면 Viewport 렌더링 사용
			if (files.length >= 100) {
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
			
			this.lastRenderState = currentState;
			
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
		const files = await this.getFilesToDisplay();
		const settings = this.settings;
		
		const stateObject: any = {
			fileCount: files.length,
			mode: settings.currentMode,
			sortBy: settings.sort.criteria,
			sortOrder: settings.sort.order,
			query: this.state.getSearchQuery()
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
		
		return JSON.stringify(stateObject);
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
			if (this.settings.currentMode === 'tag') {
				files = this.tagMode.getFiles();
			} else {
				files = this.folderMode.getFiles();
			}
		}
		
		return this.sortManager.sort(files, this.settings.sort);
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
			
			// 모든 카드의 active 클래스 및 스타일 업데이트
			if (isNowActive) {
				cardEl.addClass('active');
			} else {
				cardEl.removeClass('active');
			}
			
			// 이미 active였던 카드도 스타일 재적용 (설정 변경 대응)
			this.applyCardStylesFromData(cardEl, isNowActive);
		});
		
		if (isValidFile(activeFile)) {
			this.logger.debug('View', 'Active class updated', { file: activeFile.basename });
		}
	}
	
	/**
	 * 카드의 data attributes를 사용하여 스타일을 적용합니다
	 * 
	 * @param card - 카드 DOM 요소
	 * @param isActive - active 상태 여부
	 */
	private applyCardStylesFromData(card: HTMLElement, isActive: boolean): void {
		// CardFactory에서 저장한 data attributes 사용
		const prefix = isActive ? 'active' : 'normal';
		
		// 카드 전체 스타일 적용
		const bg = card.dataset[`${prefix}Bg`];
		const fontSize = card.dataset[`${prefix}FontSize`];
		const borderColor = card.dataset[`${prefix}BorderColor`];
		const borderWidth = card.dataset[`${prefix}BorderWidth`];
		const borderRadius = card.dataset[`${prefix}BorderRadius`];
		
		if (bg) card.style.backgroundColor = bg;
		if (fontSize) card.style.fontSize = fontSize;
		if (borderColor) card.style.borderColor = borderColor;
		if (borderWidth) card.style.borderWidth = borderWidth;
		if (borderRadius) card.style.borderRadius = borderRadius;
		
		// 섹션별 스타일 적용 (올바른 data 속성명 사용)
		const statePrefix = isActive ? 'Active' : 'Normal';
		
		// 헤더
		const header = card.querySelector('.card-header') as HTMLElement;
		if (header) {
			const headerBg = card.dataset[`header${statePrefix}Bg`];
			const headerFontSize = card.dataset[`header${statePrefix}FontSize`];
			const headerBorderColor = card.dataset[`header${statePrefix}BorderColor`];
			const headerBorderWidth = card.dataset[`header${statePrefix}BorderWidth`];
			
			if (headerBg) header.style.backgroundColor = headerBg;
			if (headerFontSize) header.style.fontSize = headerFontSize;
			if (headerBorderColor) header.style.borderBottomColor = headerBorderColor;
			if (headerBorderWidth) {
				header.style.borderBottomWidth = headerBorderWidth;
				header.style.borderBottomStyle = parseInt(headerBorderWidth) > 0 ? 'solid' : 'none';
			}
		}
		
		// 바디
		const body = card.querySelector('.card-body') as HTMLElement;
		if (body) {
			const bodyBg = card.dataset[`body${statePrefix}Bg`];
			const bodyFontSize = card.dataset[`body${statePrefix}FontSize`];
			
			if (bodyBg) body.style.backgroundColor = bodyBg;
			if (bodyFontSize) body.style.fontSize = bodyFontSize;
		}
		
		// 풋터
		const footer = card.querySelector('.card-footer') as HTMLElement;
		if (footer) {
			const footerBg = card.dataset[`footer${statePrefix}Bg`];
			const footerFontSize = card.dataset[`footer${statePrefix}FontSize`];
			const footerBorderColor = card.dataset[`footer${statePrefix}BorderColor`];
			const footerBorderWidth = card.dataset[`footer${statePrefix}BorderWidth`];
			
			if (footerBg) footer.style.backgroundColor = footerBg;
			if (footerFontSize) footer.style.fontSize = footerFontSize;
			if (footerBorderColor) footer.style.borderTopColor = footerBorderColor;
			if (footerBorderWidth) {
				footer.style.borderTopWidth = footerBorderWidth;
				footer.style.borderTopStyle = parseInt(footerBorderWidth) > 0 ? 'solid' : 'none';
			}
		}
	}
	
	/** 전역 설정에서 CardSettings 추출 */
	private getGlobalCardSettings() {
		return {
			header: this.settings.header,
			body: this.settings.body,
			footer: this.settings.footer,
			renderMode: this.settings.renderMode,
			normalCardStyle: this.settings.normalCardStyle,
			activeCardStyle: this.settings.activeCardStyle,
			focusedCardStyle: this.settings.focusedCardStyle
		};
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
		if (!isValidFile(newActiveFile)) {
			return false;
		}
		
		const previousFile = this.state.getPreviousFile();
		
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
		if (this.shouldCancelRendering(renderingId, 'before container.empty()')) {
			return;
		}
		
		const currentActiveFile = this.getActiveFile();
		const hasActiveFileChanged = this.state.hasFileChanged(currentActiveFile);

		let scrollTop = 0;
		if (!hasActiveFileChanged) {
			scrollTop = container.scrollTop;
		}

		container.empty();

		if (this.shouldCancelRendering(renderingId, 'after container.empty()')) {
			return;
		}

		if (files.length === 0) {
			if (this.shouldCancelRendering(renderingId, 'before empty message')) {
				return;
			}

			container.createEl('div', {
				cls: 'card-navigator-empty',
				text: 'No files to display'
			});
			return;
		}

		this.selectionManager.setAllFiles(files);

		// ⭐ DocumentFragment 사용하여 reflow 최소화
		const fragment = document.createDocumentFragment();
		const tempContainer = document.createElement('div');

		for (const file of files) {
			if (this.shouldCancelRendering(renderingId, 'during card creation')) {
				return;
			}

			await this.cardFactory.createCard(
				file,
				tempContainer,
				currentActiveFile,
				onFileOpen
			);
		}

		// 모든 카드를 한 번에 DOM에 추가
		while (tempContainer.firstChild) {
			fragment.appendChild(tempContainer.firstChild);
		}
		container.appendChild(fragment);

		if (this.shouldCancelRendering(renderingId, 'before layout update')) {
			return;
		}
		
		if (isDefined(this.layoutManager)) {
			this.layoutManager.updateLayout();
		}

		const cardElements = Array.from(
			container.querySelectorAll('.card-item')
		) as HTMLElement[];
		this.keyboardNav.updateCards(cardElements, files);
		
		this.logger.debug('View', 'Standard render completed', {
			renderingId,
			fileCount: files.length,
			timestamp: Date.now()
		});

		if (!hasActiveFileChanged) {
			container.scrollTop = scrollTop;
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
		if (this.shouldCancelRendering(renderingId, 'before viewport setup')) {
			return;
		}
		
		// 기존 ViewportManager 정리
		if (this.viewportManager) {
			this.viewportManager.destroy();
			this.viewportManager = null;
		}
		
		const currentActiveFile = this.getActiveFile();
		const hasActiveFileChanged = this.state.hasFileChanged(currentActiveFile);
		
		let scrollTop = 0;
		if (!hasActiveFileChanged) {
			scrollTop = container.scrollTop;
		}
		
		container.empty();
		
		if (this.shouldCancelRendering(renderingId, 'after container.empty()')) {
			return;
		}
		
		const files = await this.getFilesToDisplay();
		
		if (this.shouldCancelRendering(renderingId, 'after file list fetch')) {
			return;
		}
		
		if (files.length === 0) {
			container.createEl('div', {
				cls: 'card-navigator-empty',
				text: 'No files to display'
			});
			return;
		}
		
		this.selectionManager.setAllFiles(files);

		// 1. 모든 파일에 대한 플레이스홀더 생성 (DocumentFragment로 reflow 최소화)
		const placeholders: HTMLElement[] = [];
		let activeIndex = -1;
		const fragment = document.createDocumentFragment();
		const tempContainer = document.createElement('div');

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const isActive = isValidFile(currentActiveFile) && currentActiveFile.path === file.path;

			if (isActive) {
				activeIndex = i;
			}

			const placeholder = this.cardFactory.createPlaceholder(
				file,
				tempContainer,
				isActive
			);

			placeholders.push(placeholder);
		}

		// 모든 플레이스홀더를 한 번에 DOM에 추가
		while (tempContainer.firstChild) {
			fragment.appendChild(tempContainer.firstChild);
		}
		container.appendChild(fragment);
		
		this.logger.debug('View', 'Placeholders created', {
			count: placeholders.length,
			activeIndex
		});
		
		if (this.shouldCancelRendering(renderingId, 'after placeholder creation')) {
			return;
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
		const cardElements = Array.from(
			container.querySelectorAll('.card-item')
		) as HTMLElement[];
		this.keyboardNav.updateCards(cardElements, files);
		
		this.logger.debug('View', 'Viewport rendering complete', {
			renderingId,
			totalCards: files.length,
			visibleCards: this.viewportManager?.getVisibleCards().length || 0
		});
		
		if (!hasActiveFileChanged) {
			container.scrollTop = scrollTop;
		}
	}
	
	/**
	 * 초기에 활성 카드 주변 카드들을 강제 렌더링
	 * 
	 * @remarks
	 * 사용자가 즉시 볼 수 있도록 활성 카드와 그 주변 카드를 먼저 렌더링합니다.
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
		
		for (let i = startIndex; i < endIndex; i++) {
			const placeholder = placeholders[i];
			
			if (!placeholder.classList.contains('card-rendered')) {
				await this.cardFactory.renderPlaceholder(placeholder, onFileOpen);
			}
		}
	}
	
	/**
	 * ViewportManager 정리
	 */
	destroy(): void {
		if (this.viewportManager) {
			this.viewportManager.destroy();
			this.viewportManager = null;
		}
	}
}

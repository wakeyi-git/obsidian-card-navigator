import { ItemView, WorkspaceLeaf, TFile, TFolder, Notice } from 'obsidian';
import { CardRenderer } from './card/CardRenderer';
import { CardDataExtractor } from './card/CardData';
import CardNavigatorPlugin from './main';
import { isValidElement, isValidFile, isDefined } from './utils/typeGuards';
import { DebugLogger } from './utils/DebugLogger';
import { StyleUtils } from './utils/StyleUtils';
import { ViewStateManager } from './view/ViewStateManager';
import { ViewEventHandler } from './view/ViewEventHandler';
import { CardFactory } from './view/CardFactory';
import { ViewRenderer } from './view/ViewRenderer';
import { LayoutManager } from './layout/LayoutManager';
import { KeyboardNavigator } from './navigation/KeyboardNav';
import { ScrollManager } from './navigation/ScrollManager';
import { SearchEngine } from './search/SearchEngine';
import { SearchInput } from './search/SearchInput';
import { FolderMode } from './modes/FolderMode';
import { TagMode } from './modes/TagMode';
import { SortManager } from './sort/SortManager';
import { Toolbar } from './ui/Toolbar';
import { DragDropHandler } from './utils/DragDropHandler';
import { CardContextMenu } from './ui/ContextMenu';
import { SelectionManager } from './selection/SelectionManager';
import { ContextBar, PathSegment, GroupListItem } from './ui/ContextBar';
import { TIMING } from './constants';
import { ICardView } from './interfaces/ICardView';
import { debounceAsync } from './utils/debounce';
import { t } from './i18n';

export const VIEW_TYPE_CARD_NAVIGATOR = 'card-navigator-view';

/**
 * Card Navigator 메인 뷰
 * 
 * 전체 UI를 조율하고 각 컴포넌트를 초기화합니다.
 * 
 * @remarks
 * 이 클래스는 조율자(Orchestrator) 역할만 수행하며,
 * 실제 작업은 전문화된 매니저 클래스들에게 위임됩니다.
 * ICardView 인터페이스를 구현하여 CardFactory와의 순환 참조를 방지합니다.
 */
export class CardNavigatorView extends ItemView implements ICardView {
	private logger: DebugLogger;
	
	private get settings() {
		return this.plugin.settingsManager.getSettings();
	}
	
	private get layout() {
		return this.settings.layout;
	}
	
	private get currentMode() {
		return this.settings.currentMode;
	}
	
	private get sortOptions() {
		return this.settings.sort;
	}
	
	private get folderModeSettings() {
		return this.settings.folderMode;
	}
	
	private get tagModeSettings() {
		return this.settings.tagMode;
	}
	
	private get scrollBehavior() {
		return this.settings.scrollBehavior;
	}
	
	private renderer: CardRenderer;
	private extractor: CardDataExtractor;
	private state: ViewStateManager;
	private eventHandler: ViewEventHandler;
	private cardFactory: CardFactory;
	private viewRenderer: ViewRenderer;
	public plugin: CardNavigatorPlugin;
	private cardsContainer: HTMLElement | null = null;
	private layoutManager: LayoutManager | null = null;
	private keyboardNavigator: KeyboardNavigator;
	private scrollManager: ScrollManager;
	public searchEngine: SearchEngine;
	private searchInput: SearchInput | null = null;
	public folderMode: FolderMode;
	public tagMode: TagMode;
	private sortManager: SortManager;
	private toolbar: Toolbar | null = null;
	private searchInputContainer: HTMLElement | null = null;
	private dragDropHandler: DragDropHandler;
	private contextMenu: CardContextMenu;
	public selectionManager: SelectionManager;
	private contextBar: ContextBar | null = null;

	// ⭐ 디바운스된 렌더링 함수 (중복 렌더링 방지)
	private debouncedForceRender: (() => Promise<void>) | null = null;

	/**
	 * Toolbar에 접근할 수 있는 getter
	 */
	public getToolbar(): Toolbar | null {
		return this.toolbar;
	}

	/**
	 * Plugin 인스턴스에 접근할 수 있는 getter
	 */
	public getPlugin(): CardNavigatorPlugin {
		return this.plugin;
	}

	constructor(leaf: WorkspaceLeaf, plugin: CardNavigatorPlugin) {
		super(leaf);
		
		this.plugin = plugin;
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.logger = new DebugLogger(() => this.settings);
		
		this.state = new ViewStateManager();
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.renderer = new CardRenderer(this.app, this, this.settings.renderMode, () => this.settings);
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.extractor = new CardDataExtractor(this.app, () => this.settings);
		
		this.keyboardNavigator = new KeyboardNavigator(this);
		this.scrollManager = new ScrollManager(this);
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.searchEngine = new SearchEngine(this.app, this.logger, () => this.settings);
		this.folderMode = new FolderMode(this.app, this);
		this.tagMode = new TagMode(this.app, this);
		this.sortManager = new SortManager(this.app);
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.contextMenu = new CardContextMenu(this.app, () => this.settings);
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.selectionManager = new SelectionManager(
			this.app,
			() => this.settings,
			async () => {
				await this.plugin.saveSettings();
				await this.refresh();
			}
		);
		// ✅ selectionManager를 DragDropHandler에 전달하여 다중 선택 드래그 지원
		this.dragDropHandler = new DragDropHandler(this.app, () => this.settings, this.selectionManager);

		this.eventHandler = new ViewEventHandler(
			this.app,
			this.dragDropHandler,
			this.contextMenu,
			this.selectionManager,
			() => this.settings  // ✅ 함수로 전달
		);
		
		this.cardFactory = new CardFactory(
			this.app,
			this,
			this.renderer,
			this.extractor,
			this.eventHandler
		);
		
		this.viewRenderer = new ViewRenderer(
			this.app,
			this,
			this.plugin,
			this.cardFactory,
			this.state,
			null,
			this.keyboardNavigator,
			this.selectionManager,
			this.searchEngine,
			this.folderMode,
			this.tagMode,
			this.sortManager
		);
	}

	getViewType(): string {
		return VIEW_TYPE_CARD_NAVIGATOR;
	}

	getDisplayText(): string {
		return 'Card Navigator';
	}

	getIcon(): string {
		return 'layout-grid';
	}

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('card-navigator-container');

		const header = container.createEl('div', {
			cls: 'card-navigator-header'
		});
		
		this.toolbar = new Toolbar(this.app, this, this.plugin);
		this.toolbar.render(header);
		
		this.searchInputContainer = header.createEl('div', {
			cls: 'search-input-container-wrapper hidden'
		});

		this.searchInput = new SearchInput(
			this.app,
			this.searchInputContainer,
			this.plugin.settings,
			async () => await this.plugin.saveSettings()
		);
		this.searchInput.render();
		
		if (this.toolbar) {
			this.toolbar.setSearchInputContainer(this.searchInputContainer);
		}

		this.searchInput.onInput((query) => {
			this.state.setSearchQuery(query);
			if (this.cardsContainer) {
				this.renderCards(this.cardsContainer);
			}
		});

		// Context Bar 초기화 (그룹화 활성화 시에만 표시)
		this.contextBar = new ContextBar(container);
		this.contextBar.render((groupId: string) => this.onContextBarGroupSelect(groupId));

		this.cardsContainer = container.createEl('div', {
			cls: 'card-navigator-cards'
		});

		this.layoutManager = new LayoutManager(
			this.cardsContainer,
			this.layout,
			() => this.settings  // ✅ 함수로 전달
		);
		
		this.viewRenderer.updateLayoutManager(this.layoutManager);
		this.layoutManager.updateLayout();
		this.keyboardNavigator.registerKeyboardListeners();

		// 초기 렌더링을 먼저 수행한 후 이벤트 리스너 등록
		// onOpen() 중 active-leaf-change 이벤트로 인한 중복 렌더링 방지
		const activeFile = this.app.workspace.getActiveFile();
		await this.plugin.presetManager.autoApplyPreset(activeFile);
		await this.renderCards(this.cardsContainer);
		
		// ⭐ 디바운스된 forceRender 함수 생성
		// 500ms 내 여러 파일 이벤트가 발생해도 마지막 한 번만 렌더링
		this.debouncedForceRender = debounceAsync(async () => {
			if (isValidElement(this.cardsContainer)) {
				this.logger.debug('View', t().debug.view.debouncedRenderExecuted);
				await this.viewRenderer.forceRender(
					this.cardsContainer,
					(f) => this.openFile(f)
				);
			}
		}, 500); // 500ms 디바운스

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', async () => {
				if (!isValidElement(this.cardsContainer)) {
					return;
				}

				if (this.state.getIsRendering()) {
					this.logger.debug('View', t().debug.view.renderingSkipped);
					return;
				}

				const activeFile = this.app.workspace.getActiveFile();

				// ⭐ Phase 5 최적화: 파일 변경 여부를 가장 먼저 체크하여 조기 반환
				const hasActiveFileChanged = this.state.hasFileChanged(activeFile);
				if (!hasActiveFileChanged) {
					this.logger.debug('View', t().debug.view.sameFileNoAction);
					return; // 같은 파일이면 아무 작업도 하지 않음
				}

				this.logger.debug('View', t().debug.view.activeLeafChange, {
					previousFile: this.state.getPreviousFile()?.path || 'none',
					currentFile: activeFile?.path || 'none'
				});

				// 파일이 실제로 변경되었을 때만 preset 적용
				await this.plugin.presetManager.autoApplyPreset(activeFile);

				const needsRerender = this.viewRenderer.needsRerenderForFileChange(activeFile);

				this.logger.debug('View', t().debug.view.rerenderRequired, {
					hasActiveFileChanged,
					needsRerender
				});

				if (needsRerender) {
					this.logger.debug('View', t().debug.view.contextChangeRerender);
					await this.renderCards(this.cardsContainer);

					if (isValidFile(activeFile)) {
						const fileToScroll: TFile = activeFile;
						setTimeout(async () => {
							await this.scrollManager.scrollToActiveFile(fileToScroll, 'file-change');
						}, TIMING.RENDER_COMPLETE_DELAY);
					}
				} else {
					this.logger.debug('View', t().debug.view.sameContextUpdateClass);

					// 그룹화 활성화 시, 접힌 그룹에 활성 파일이 있으면 자동 펼치기
					if (this.settings.grouping.enabled && isValidFile(activeFile)) {
						this.viewRenderer.expandGroupContainingFile(this.cardsContainer, activeFile);
					}

					if (isValidElement(this.cardsContainer)) {
						this.viewRenderer.updateActiveCardClass(this.cardsContainer);
					}

					if (isValidFile(activeFile)) {
						const fileToScroll: TFile = activeFile;
						await this.scrollManager.scrollToActiveFile(fileToScroll, 'card-click');
					}
				}

				if (isDefined(this.toolbar)) {
					this.toolbar.updateModeToggleIcon();
				}

				this.state.setPreviousFile(activeFile);
			})
		);
		
		// ⭐ 메타데이터 변경 감지 및 실시간 업데이트
		// metadataCache.on('changed')를 사용하여 태그, 링크 등의 메타데이터 변경을 추적합니다.
		// 백링크/나가는 링크는 여러 파일에 영향을 미치므로 전체 뷰를 재렌더링합니다.
		// 
		// ⭐ 디바운싱 적용: 짧은 시간 내 여러 파일 변경이 발생해도 한 번만 렌더링
		// 드래그 앤 드롭 시 rename + metadata 이벤트가 동시 발생하는 것을 방지
		this.registerEvent(
			this.app.metadataCache.on('changed', async (file) => {
				if (!(file instanceof TFile)) return;

				this.logger.debug('View', t().debug.view.metadataChangeDetected, { path: file.path });

				// ⭐ Phase 2: 캐시 무효화
				this.cardFactory.invalidateCache(file);
				this.sortManager.invalidateCacheForFile(file);
				// ⭐ Performance: 태그 변경 시 파일 목록 캐시 무효화 (태그 모드에서 필요)
				if (this.settings.currentMode === 'tag') {
					this.viewRenderer.invalidateFileCache();
				}

				// ⭐ resolvedLinks 업데이트 대기 + 디바운싱
				setTimeout(() => {
					if (this.debouncedForceRender) {
						this.debouncedForceRender().catch(err => {
							if (err.message !== 'Debounced call cancelled') {
								this.logger.error('View', t().debug.view.debouncedRenderFailed, { error: err });
							}
						});
					}
				}, TIMING.FILE_CHANGE_DEBOUNCE_DELAY);
			})
		);
		
		// ⭐ 파일 삭제 감지 및 자동 제거 (디바운싱 적용)
		this.registerEvent(
			this.app.vault.on('delete', async (file) => {
				if (!(file instanceof TFile)) return;

				this.logger.debug('View', t().debug.view.fileDeleteDetected, { path: file.path });

				// ⭐ Phase 2: 캐시 무효화
				this.cardFactory.invalidateCache(file);
				this.sortManager.clearCache(); // 파일 삭제는 전체 캐시 무효화
				this.folderMode.invalidateCache(); // ⭐ Phase 4: FolderMode 캐시 무효화
				this.viewRenderer.invalidateFileCache(); // ⭐ Performance: 파일 목록 캐시 무효화

				// ⭐ Vault 파일 목록 업데이트 대기 + 디바운싱
				setTimeout(() => {
					if (this.debouncedForceRender) {
						this.debouncedForceRender().catch(err => {
							if (err.message !== 'Debounced call cancelled') {
								this.logger.error('View', t().debug.view.debouncedRenderFailed, { error: err });
							}
						});
					}
				}, TIMING.VAULT_UPDATE_DELAY);
			})
		);
		
		// ⭐ 파일 이름 변경 감지 및 업데이트 (디바운싱 적용)
		// 드래그 앤 드롭 시 rename 이벤트와 metadata 이벤트가 동시 발생하므로
		// 디바운싱으로 중복 렌더링 방지
		this.registerEvent(
			this.app.vault.on('rename', async (file, oldPath) => {
				if (!(file instanceof TFile)) return;

				this.logger.debug('View', t().debug.view.fileRenameDetected, {
					oldPath,
					newPath: file.path
				});

				// ⭐ Phase 2: 캐시 무효화 (이전 경로와 새 경로 모두)
				this.cardFactory.invalidateCache(file);
				// 이전 경로로 캐시된 항목도 삭제
				const oldFile = this.app.vault.getAbstractFileByPath(oldPath);
				if (oldFile instanceof TFile) {
					this.cardFactory.invalidateCache(oldFile);
				}
				this.sortManager.clearCache(); // 파일 이름 변경은 전체 캐시 무효화
				this.folderMode.invalidateCache(); // ⭐ Phase 4: FolderMode 캐시 무효화
				this.viewRenderer.invalidateFileCache(); // ⭐ Performance: 파일 목록 캐시 무효화

				// ⭐ 디바운싱 적용: metadata 이벤트와 합쳐짐
				if (this.debouncedForceRender) {
					this.debouncedForceRender().catch(err => {
						if (err.message !== 'Debounced call cancelled') {
							this.logger.error('View', t().debug.view.debouncedRenderFailed, { error: err });
						}
					});
				}
			})
		);

		// ⭐ 테마 변경 감지 및 카드 리프레시
		// Obsidian 테마가 변경되면 카드의 색상을 즉시 업데이트합니다
		this.registerEvent(
			this.app.workspace.on('css-change', async () => {
				this.logger.debug('View', 'Theme change detected - updating card colors');

				// ⭐ 기존 카드들의 텍스트 색상 CSS 변수 즉시 업데이트
				if (isValidElement(this.cardsContainer)) {
					const cardElements = this.cardsContainer.querySelectorAll('.card-item');
					// 현재 설정으로 CardSettings 구성
					const cardSettings = {
						header: this.settings.header,
						body: this.settings.body,
						footer: this.settings.footer,
						renderMode: this.settings.renderMode,
						normalCardStyle: this.settings.normalCardStyle,
						activeCardStyle: this.settings.activeCardStyle,
						focusedCardStyle: this.settings.focusedCardStyle
					};

					cardElements.forEach((cardEl) => {
						const htmlCardEl = cardEl as HTMLElement;
						// 텍스트 색상만 재계산하여 업데이트 (빠른 테마 전환)
						StyleUtils.updateTextColorsForTheme(htmlCardEl, cardSettings);
					});
				}

				// ⭐ 캐시는 무효화하여 다음 렌더링 시 새로운 색상 사용
				this.cardFactory.invalidateCache();
			})
		);

		container.setAttribute('tabindex', '-1');
		
		this.registerDomEvent(container, 'keydown', (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
				const isCardNavigatorFocused = container.contains(document.activeElement);
				
				if (isCardNavigatorFocused) {
					e.preventDefault();
					e.stopPropagation();
					this.selectionManager.selectAll();
				}
			}
		});
		
		// 검색창 스마트 자동 숨김
		// Card Navigator 외부 클릭 시 빈 검색창을 자동으로 숨깁니다.
		// 검색어가 입력되어 있으면 검색 결과를 참고할 수 있도록 유지합니다.
		this.registerDomEvent(document, 'click', (event: MouseEvent) => {
			if (!this.searchInputContainer ||
				this.searchInputContainer.classList.contains('hidden')) {
				return;
			}

			if (this.searchInput && this.searchInput.getValue().trim()) {
				return;
			}

			const isClickInside = container.contains(event.target as Node);
			if (!isClickInside) {
				this.searchInputContainer.classList.add('hidden');
				this.logger.debug('View', t().debug.view.searchAutoHide);
			}
		});
	}

	async onClose() {
		this.logger.debug('View', t().debug.view.closing);

		// ⭐ ViewportManager 정리 추가
		if (isDefined(this.viewRenderer)) {
			this.viewRenderer.destroy();
		}

		if (isDefined(this.layoutManager)) {
			this.layoutManager.destroy();
			this.layoutManager = null;
		}

		if (isDefined(this.searchInput)) {
			this.searchInput.destroy();
			this.searchInput = null;
		}

		if (isDefined(this.toolbar)) {
			this.toolbar.destroy();
			this.toolbar = null;
		}

		if (isDefined(this.contextBar)) {
			this.contextBar.destroy();
			this.contextBar = null;
		}
	}

	/**
	 * 뷰를 새로고침합니다
	 * 
	 * @remarks
	 * 설정 변경 시 호출되어 UI를 업데이트합니다.
	 * 상태 해시 체크를 건너뛰고 강제로 재렌더링합니다.
	 */
	async refresh() {
		this.logger.debug('View', t().debug.view.refreshing);
		
		this.renderer.setRenderMode(this.settings.renderMode);
		
		if (isDefined(this.layoutManager)) {
			this.layoutManager.updateSettings(this.layout);
		}
		
		if (isDefined(this.toolbar)) {
			this.toolbar.updateModeToggleIcon();
		}
		
		if (isValidElement(this.cardsContainer)) {
			await this.viewRenderer.forceRender(
				this.cardsContainer,
				(f) => this.openFile(f)
			);
		}
	}

	/**
	 * 검색을 초기화합니다
	 * 
	 * @remarks
	 * 검색어를 지우고 모든 카드를 다시 표시합니다.
	 * Toolbar의 검색 초기화 버튼에서 호출됩니다.
	 */
	public clearSearch(): void {
		if (isDefined(this.searchInput)) {
			this.searchInput.clear();
		}

		this.state.setSearchQuery('');

		if (isValidElement(this.cardsContainer)) {
			this.renderCards(this.cardsContainer);
		}
	}

	/**
	 * 검색 입력창을 표시하고 포커스합니다
	 *
	 * @remarks
	 * 리팩토링 2025-11-23: CSS 클래스 기반 표시/숨김
	 */
	public showSearchInput(): void {
		if (!this.searchInputContainer) return;

		this.searchInputContainer.classList.remove('hidden');
		const input = this.searchInputContainer.querySelector('input');
		if (input) {
			input.focus();
		}
	}

	/**
	 * 현재 검색어를 반환합니다
	 */
	public getCurrentSearchQuery(): string {
		if (!this.searchInput) return '';
		return this.searchInput.getValue();
	}

	/**
	 * 검색어를 적용하고 검색을 실행합니다
	 *
	 * @remarks
	 * 리팩토링 2025-11-23: CSS 클래스 기반 표시/숨김
	 */
	public applySearchQuery(query: string): void {
		if (!this.searchInput || !this.searchInputContainer) return;

		// Show search input if hidden
		this.searchInputContainer.classList.remove('hidden');

		// Set value and trigger search
		this.searchInput.setValueAndSearch(query);
	}

	/**
	 * 모드를 전환합니다 (폴더 ↔ 태그)
	 */
	public async switchMode(): Promise<void> {
		if (this.toolbar) {
			await this.toolbar.onModeSwitch();
		}
	}

	/**
	 * 모드 옵션을 전환합니다 (활성/지정)
	 */
	public async toggleModeOption(): Promise<void> {
		if (this.toolbar) {
			await this.toolbar.onModeToggleClick();
		}
	}

	/**
	 * 폴더 선택 모달을 엽니다
	 */
	public openFolderSelector(): void {
		if (this.toolbar) {
			this.toolbar.openFolderSelector();
		}
	}

	/**
	 * 태그 선택 모달을 엽니다
	 */
	public openTagSelector(): void {
		if (this.toolbar) {
			this.toolbar.openTagSelector();
		}
	}

	/**
	 * 렌더링 모드를 전환합니다 (plain ↔ markdown-html)
	 *
	 * @remarks
	 * 본문(body) 렌더링 모드만 토글합니다.
	 */
	public async toggleRenderMode(): Promise<void> {
		const currentMode = this.plugin.settings.body.normalContent.contentRenderMode || 'plain';
		const newMode = currentMode === 'plain' ? 'markdown-html' : 'plain';

		this.plugin.settingsManager.updateSettings({
			body: {
				...this.plugin.settings.body,
				normalContent: {
					...this.plugin.settings.body.normalContent,
					contentRenderMode: newMode
				}
			}
		});

		await this.plugin.saveSettings();

		// 사용자에게 피드백 제공
		const message = newMode === 'plain'
			? t().ui.renderModeSwitched.plain
			: t().ui.renderModeSwitched.markdownHtml;
		new Notice(message);
	}

	/**
	 * 카드를 렌더링합니다
	 * 
	 * @param container - 카드를 렌더링할 컨테이너
	 * 
	 * @remarks
	 * 실제 렌더링 로직은 ViewRenderer에게 위임됩니다.
	 */
	async renderCards(container: HTMLElement) {
		await this.viewRenderer.renderCards(
			container,
			(f) => this.openFile(f)
		);
	}

	/**
	 * 카드를 생성합니다
	 * 
	 * @param file - 카드로 표시할 파일
	 * @param container - 카드를 추가할 컨테이너
	 * @returns 생성된 카드 DOM 요소
	 * 
	 * @remarks
	 * 실제 카드 생성 로직은 CardFactory에게 위임됩니다.
	 */
	async createCard(file: TFile, container: HTMLElement): Promise<HTMLElement> {
		const activeFile = this.app.workspace.getActiveFile();
		
		return this.cardFactory.createCard(
			file,
			container,
			activeFile,
			(f) => this.openFile(f)
		);
	}

	/**
	 * 파일을 엽니다
	 * 
	 * @param file - 열 파일
	 * 
	 * @throws 파일 열기 실패 시 Notice를 표시하고 에러를 로깅합니다
	 */
	async openFile(file: TFile): Promise<void> {
		try {
			this.logger.debug('View', t().debug.view.fileOpening, { filePath: file.path });
			await this.app.workspace.openLinkText(file.path, '', false);
		} catch (error) {
			const message = t().errors.fileOpenFailed(file.basename);
			new Notice(message);
			this.logger.error('View', t().debug.view.fileOpenFailed, {
				filePath: file.path,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
	

	
	/**
	 * Card Navigator에 포커스를 설정하고 활성 카드로 이동합니다
	 *
	 * @remarks
	 * Obsidian 명령어로 등록되어 단축키로 호출할 수 있습니다.
	 * 활성 파일이 없으면 첫 번째 카드로 이동합니다.
	 */
	public focusOnActiveCard(): void {
		this.containerEl.focus();

		const activeFile = this.app.workspace.getActiveFile();
		if (!isValidFile(activeFile)) {
			// 첫 번째 카드 요소 찾기
			const firstCard = this.cardsContainer?.querySelector('.card-item') as HTMLElement;
			if (firstCard) {
				// KeyboardNavigator를 통해 포커스 설정
				this.keyboardNavigator.focusCardElement(firstCard);
			}
			return;
		}

		this.keyboardNavigator.focusFileCard(activeFile);
	}

	/**
	 * 모든 그룹을 펼칩니다
	 */
	expandAllGroups(): void {
		const sections = this.viewRenderer.groupRenderer.findAllGroupSections(this.containerEl);
		sections.forEach(section => {
			const groupId = section.dataset.groupId;
			if (groupId) {
				this.viewRenderer.groupRenderer.toggleGroup(section, false);
				this.viewRenderer.groupingManager.saveCollapsedState(groupId, false);
			}
		});
	}

	/**
	 * 모든 그룹을 접습니다
	 */
	collapseAllGroups(): void {
		const sections = this.viewRenderer.groupRenderer.findAllGroupSections(this.containerEl);
		sections.forEach(section => {
			const groupId = section.dataset.groupId;
			if (groupId) {
				this.viewRenderer.groupRenderer.toggleGroup(section, true);
				this.viewRenderer.groupingManager.saveCollapsedState(groupId, true);
			}
		});
	}

	/**
	 * Context Bar에 접근할 수 있는 getter
	 */
	public getContextBar(): ContextBar | null {
		return this.contextBar;
	}

	/**
	 * Context Bar 경로를 업데이트합니다
	 *
	 * @param segments - 경로 세그먼트 배열
	 */
	public updateContextBarPath(segments: PathSegment[]): void {
		if (this.contextBar) {
			// Context Bar는 항상 표시 (그룹화 설정과 독립)
			this.contextBar.update(segments);
		}
	}

	/**
	 * Context Bar 그룹 목록을 업데이트합니다
	 *
	 * @param groups - 그룹 목록
	 * @param activeGroupId - 현재 활성 그룹 ID
	 */
	public updateContextBarGroupList(groups: GroupListItem[], activeGroupId?: string): void {
		if (this.contextBar) {
			this.contextBar.updateGroupList(groups, activeGroupId);
		}
	}

	/**
	 * Context Bar 그룹 선택 핸들러
	 *
	 * @param groupId - 선택된 그룹 ID
	 */
	private async onContextBarGroupSelect(groupId: string): Promise<void> {
		this.logger.debug('View', 'Context bar group selected', { groupId });

		// Context Bar 활성 상태 업데이트 (선택된 그룹을 활성으로 표시)
		this.viewRenderer.updateContextBarActiveGroup(groupId);

		// 그룹 ID에서 폴더/태그 경로 추출
		if (groupId.startsWith('folder-')) {
			// 폴더 선택: 해당 폴더로 이동 (모드 옵션 유지)
			const folderPath = groupId.replace('folder-', '');

			this.logger.debug('View', 'Navigating to folder', { folderPath });

			// specifiedFolder 업데이트 (지정 폴더 모드에서 사용)
			this.plugin.settingsManager.updateSettings({
				currentMode: 'folder',
				folderMode: {
					...this.settings.folderMode,
					specifiedFolder: folderPath
				}
			});

			await this.plugin.saveSettings();

			// 활성 폴더 모드인 경우: 해당 폴더의 파일을 열어서 활성 폴더 변경
			if (this.settings.folderMode.useActiveFolder) {
				const folder = this.app.vault.getAbstractFileByPath(folderPath);
				if (folder instanceof TFolder) {
					// 폴더 내 첫 번째 마크다운 파일 찾기 (재귀적으로 하위 폴더도 검색)
					const firstFile = this.findFirstMarkdownFileRecursively(folder);
					if (firstFile) {
						// 파일 열기 전 렌더 상태 초기화 (강제 재렌더링 유도)
						this.viewRenderer.resetRenderState();
						await this.openFile(firstFile);
						return;
					}
				}
				// 폴더와 하위 폴더에 파일이 없으면 지정 폴더 모드로 표시
				// (뷰 새로고침으로 specifiedFolder 사용)
			}

			// 지정 폴더 모드이거나 파일이 없는 경우: 뷰 새로고침
			if (this.cardsContainer) {
				await this.viewRenderer.forceRender(
					this.cardsContainer,
					(f) => this.openFile(f)
				);
			}

			// Toolbar 아이콘 업데이트
			if (this.toolbar) {
				this.toolbar.updateModeToggleIcon();
			}

			return;
		} else if (groupId.startsWith('tag-')) {
			// 태그 선택: 해당 태그로 이동 (모드 옵션 유지)
			const tagPath = groupId.replace('tag-', '');

			this.logger.debug('View', 'Navigating to tag', { tagPath });

			// specifiedTags 업데이트 (지정 태그 모드에서 사용)
			this.plugin.settingsManager.updateSettings({
				currentMode: 'tag',
				tagMode: {
					...this.settings.tagMode,
					specifiedTags: [tagPath]
				}
			});

			await this.plugin.saveSettings();

			// 활성 파일 태그 모드인 경우: 해당 태그가 있는 파일을 열어서 활성 태그 변경
			if (this.settings.tagMode.useActiveFileTags) {
				const currentFile = this.app.workspace.getActiveFile();

				// 선택한 태그를 포함하는 파일 필터링
				const filesWithTag = this.app.vault.getMarkdownFiles().filter(file => {
					const cache = this.app.metadataCache.getFileCache(file);
					const tags = cache?.tags?.map(t => t.tag) || [];

					// 프론트매터 태그 처리 (배열 또는 문자열)
					const fmTags = cache?.frontmatter?.tags;
					const frontmatterTags: string[] = [];
					if (Array.isArray(fmTags)) {
						frontmatterTags.push(...fmTags
							.filter((t): t is string => typeof t === 'string' && t.length > 0)
							.map(t => t.startsWith('#') ? t : `#${t}`));
					} else if (typeof fmTags === 'string' && fmTags.length > 0) {
						frontmatterTags.push(fmTags.startsWith('#') ? fmTags : `#${fmTags}`);
					}

					const allTags = [...tags, ...frontmatterTags];
					return allTags.some(t => t === `#${tagPath}` || t === tagPath);
				});

				if (filesWithTag.length > 0) {
					// 플러그인 정렬 기준에 따라 파일 정렬 후 첫 번째 파일 선택
					const sortedFiles = this.sortManager.sort(filesWithTag, this.settings.sort);
					const targetFile = sortedFiles[0];

					this.logger.debug('View', 'Tag dropdown: opening file with selected tag', {
						tagPath,
						targetFile: targetFile.path,
						currentFile: currentFile?.path,
						totalFilesWithTag: filesWithTag.length
					});

					// 파일 열기 전 렌더 상태 초기화 (강제 재렌더링 유도)
					this.viewRenderer.resetRenderState();

					// 현재 파일과 대상 파일이 다른 경우: 먼저 파일 열기
					if (currentFile?.path !== targetFile.path) {
						this.logger.debug('View', 'Tag dropdown: opening different file');
						await this.openFile(targetFile);
						// openFile 후 active-leaf-change 이벤트가 발생하여 재렌더링됨
						// 하지만 이벤트 타이밍 문제로 재렌더링이 안 될 수 있으므로
						// 약간의 지연 후 상태를 확인하고 필요시 강제 재렌더링
					}

					// 항상 강제 재렌더링 수행 (타이밍 문제 방지)
					// 파일이 변경되었으면 active-leaf-change에서 이미 렌더링했을 수 있지만,
					// 중복 렌더링보다는 누락되는 것이 더 큰 문제이므로 항상 수행
					this.logger.debug('View', 'Tag dropdown: force render after file selection');
					if (this.cardsContainer) {
						await this.viewRenderer.forceRender(
							this.cardsContainer,
							(f) => this.openFile(f)
						);
					}

					// Toolbar 아이콘 업데이트
					if (this.toolbar) {
						this.toolbar.updateModeToggleIcon();
					}
					return;
				}

				this.logger.debug('View', 'Tag dropdown: no files with tag found', { tagPath });
				// 태그를 가진 파일이 없으면 지정 태그 모드로 표시
			}

			// 지정 태그 모드이거나 파일이 없는 경우: 뷰 새로고침
			if (this.cardsContainer) {
				await this.viewRenderer.forceRender(
					this.cardsContainer,
					(f) => this.openFile(f)
				);
			}

			// Toolbar 아이콘 업데이트
			if (this.toolbar) {
				this.toolbar.updateModeToggleIcon();
			}

			return;
		}

		// 기존 그룹화 기준 (날짜, 속성 등): 해당 그룹 섹션으로 스크롤
		const section = this.viewRenderer.groupRenderer.findGroupSection(
			this.containerEl,
			groupId
		);

		if (section) {
			// 접힌 상태라면 펼치기
			if (section.hasClass('is-collapsed')) {
				this.viewRenderer.groupRenderer.toggleGroup(section, false);
				this.viewRenderer.groupingManager.saveCollapsedState(groupId, false);
			}

			// 스크롤
			section.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}
		// 섹션이 없는 경우 (중간 폴더 등): Context Bar만 업데이트됨
	}

	/**
	 * 폴더 내에서 첫 번째 마크다운 파일을 재귀적으로 찾습니다
	 * (플러그인 정렬 설정에 따라 정렬)
	 *
	 * @param folder - 검색할 폴더
	 * @returns 첫 번째 마크다운 파일 또는 null
	 */
	private findFirstMarkdownFileRecursively(folder: TFolder): TFile | null {
		// 현재 폴더의 마크다운 파일들 수집
		const mdFiles = folder.children.filter(
			(child): child is TFile => child instanceof TFile && child.extension === 'md'
		);

		// 파일이 있으면 플러그인 정렬 설정에 따라 정렬 후 첫 번째 반환
		if (mdFiles.length > 0) {
			const sortedFiles = this.sortManager.sort(mdFiles, this.settings.sort);
			return sortedFiles[0];
		}

		// 하위 폴더들을 이름순으로 정렬 후 재귀 탐색
		const subfolders = folder.children
			.filter((child): child is TFolder => child instanceof TFolder)
			.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

		for (const subfolder of subfolders) {
			const fileInSubfolder = this.findFirstMarkdownFileRecursively(subfolder);
			if (fileInSubfolder) {
				return fileInSubfolder;
			}
		}

		return null;
	}

}

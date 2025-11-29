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
	/** 🆕 public으로 변경 - MatrixRenderer에서 접근 필요 */
	public dragDropHandler: DragDropHandler;
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
		this.keyboardNavigator.registerKeyboardListeners();

		// ⭐ 초기 렌더링: workspace 레이아웃이 준비될 때까지 대기
		// onOpen() 시점에는 컨테이너가 DOM에 추가되었지만 아직 레이아웃이 완료되지 않아
		// 0×0 크기일 수 있음. onLayoutReady 콜백에서 렌더링하면 컨테이너가 실제 크기를 갖음
		// Reference: https://docs.obsidian.md/plugins/guides/load-time
		const activeFile = this.app.workspace.getActiveFile();
		await this.plugin.presetManager.autoApplyPreset(activeFile);

		// workspace 레이아웃이 준비되면 초기 렌더링 수행
		this.app.workspace.onLayoutReady(async () => {
			// renderCards() 내부에서 layoutManager.updateLayout()이 호출되므로
			// 여기서 별도로 호출할 필요 없음 (중복 레이아웃 적용 방지)
			if (this.cardsContainer) {
				await this.renderCards(this.cardsContainer);
			}
		});
		
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

				// ⭐ 오버라이드 해제: 사용자가 직접 파일을 열었을 때
				// 컨텍스트 바 드롭다운에서 선택한 임시 폴더/태그 오버라이드를 해제하고
				// 다시 활성 파일 기반으로 동작하도록 함
				this.clearOverrides();

				// ⭐ 이전 파일 정보를 먼저 저장 (폴더 변경 감지에 필요)
				const previousFile = this.state.getPreviousFile();

				this.logger.debug('View', t().debug.view.activeLeafChange, {
					previousFile: previousFile?.path || 'none',
					currentFile: activeFile?.path || 'none'
				});

				// ⭐ previousFile을 먼저 설정하여 중복 이벤트 방지
				// autoApplyPreset이 비동기 작업 중 이벤트가 재발생해도 조기 반환됨
				this.state.setPreviousFile(activeFile);

				// 파일이 실제로 변경되었을 때만 preset 적용
				// ⭐ 프리셋이 변경되면 강제로 리렌더링해야 함 (레이아웃/스타일 변경)
				const presetChanged = await this.plugin.presetManager.autoApplyPreset(activeFile);

				// ⭐ 프리셋 변경 시 카드 캐시 무효화 (새 스타일로 렌더링되도록)
				if (presetChanged) {
					this.viewRenderer.invalidateCardCache();
				}

				// ⭐ 폴더 변경 감지: 저장해둔 이전 파일 정보를 전달
				const needsRerender = presetChanged || this.viewRenderer.needsRerenderForFileChangeWithPrevious(activeFile, previousFile);

				this.logger.debug('View', t().debug.view.rerenderRequired, {
					hasActiveFileChanged,
					needsRerender,
					presetChanged
				});

				if (needsRerender) {
					this.logger.debug('View', t().debug.view.contextChangeRerender);

					// ⭐ 프리셋 변경 시 forceRender 사용 (상태 비교 건너뛰기)
					// 프리셋이 변경되면 설정이 완전히 달라지므로 상태 캐시를 무효화해야 함
					if (presetChanged) {
						await this.viewRenderer.forceRender(
							this.cardsContainer,
							(f) => this.openFile(f)
						);
					} else {
						await this.renderCards(this.cardsContainer);
					}

					// ⭐ ViewRenderer에서 이미 렌더링 시 활성 카드로 스크롤을 처리합니다.
					// 중복 스크롤 호출을 제거하여 깜빡임을 방지합니다.
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

				// previousFile은 이미 위에서 설정됨 (중복 이벤트 방지용)
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
		
		// ⭐ 파일 생성 감지 및 자동 추가 (디바운싱 적용)
		// 새 파일이 생성되면 뷰를 자동으로 업데이트하여 새 카드를 표시합니다.
		this.registerEvent(
			this.app.vault.on('create', async (file) => {
				if (!(file instanceof TFile)) return;

				this.logger.debug('View', 'File create detected', { path: file.path });

				// ⭐ 캐시 무효화
				this.folderMode.invalidateCache();
				this.viewRenderer.invalidateFileCache();

				// ⭐ Vault 파일 목록 업데이트 대기 + 디바운싱
				setTimeout(() => {
					if (this.debouncedForceRender) {
						this.debouncedForceRender().catch(err => {
							if (err.message !== 'Debounced call cancelled') {
								this.logger.error('View', 'Debounced render failed after file create', { error: err });
							}
						});
					}
				}, TIMING.VAULT_UPDATE_DELAY);
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
	 * 폴더/태그 오버라이드를 해제합니다
	 *
	 * @remarks
	 * 컨텍스트 바 드롭다운에서 선택한 임시 오버라이드를 해제하고
	 * 다시 활성 파일 기반으로 동작하도록 합니다.
	 * 사용자가 직접 파일을 열었을 때 (active-leaf-change) 호출됩니다.
	 */
	private clearOverrides(): void {
		let hasChanges = false;

		// ⭐ 폴더 오버라이드 해제: 활성 폴더 모드일 때만
		// 지정 폴더 모드에서는 오버라이드를 유지해야 사용자가 선택한 폴더가 유지됨
		if (this.settings.folderMode.overrideFolder && this.settings.folderMode.useActiveFolder) {
			this.logger.debug('View', 'Clearing folder override (active folder mode)', {
				previousOverride: this.settings.folderMode.overrideFolder
			});
			this.plugin.settingsManager.updateSettings({
				folderMode: {
					...this.settings.folderMode,
					overrideFolder: null
				}
			});
			this.folderMode.invalidateCache();
			hasChanges = true;
		}

		// ⭐ 태그 오버라이드 해제: 활성 태그 모드일 때만
		// 지정 태그 모드에서는 오버라이드를 유지해야 사용자가 선택한 태그가 유지됨
		if (this.settings.tagMode.overrideTags && this.settings.tagMode.overrideTags.length > 0 && this.settings.tagMode.useActiveFileTags) {
			this.logger.debug('View', 'Clearing tag override (active tag mode)', {
				previousOverride: this.settings.tagMode.overrideTags
			});
			this.plugin.settingsManager.updateSettings({
				tagMode: {
					...this.settings.tagMode,
					overrideTags: null
				}
			});
			hasChanges = true;
		}

		// 변경사항이 있으면 저장 (비동기, 완료 대기 안함)
		if (hasChanges) {
			this.plugin.saveSettings();
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
			// 폴더 선택: 해당 폴더의 카드 표시 (파일 열지 않음)
			const folderPath = groupId.replace('folder-', '');

			this.logger.debug('View', 'Navigating to folder (cards only)', { folderPath });

			// 활성 폴더 모드인 경우: 오버라이드 설정 (파일 열지 않고 카드만 표시)
			if (this.settings.folderMode.useActiveFolder) {
				this.plugin.settingsManager.updateSettings({
					currentMode: 'folder',
					folderMode: {
						...this.settings.folderMode,
						overrideFolder: folderPath
					}
				});

				this.logger.debug('View', 'Folder dropdown: set override folder', { folderPath });
			} else {
				// 지정 폴더 모드: specifiedFolder 업데이트
				this.plugin.settingsManager.updateSettings({
					currentMode: 'folder',
					folderMode: {
						...this.settings.folderMode,
						specifiedFolder: folderPath
					}
				});
			}

			await this.plugin.saveSettings();

			// 파일 목록 캐시 무효화 (새 폴더 기준으로 다시 조회)
			this.folderMode.invalidateCache();

			// 렌더 상태 초기화 및 카드 렌더링 (파일 열지 않음)
			this.viewRenderer.resetRenderState();
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
			// 태그 선택: 해당 태그의 카드 표시 (파일 열지 않음)
			const tagPath = groupId.replace('tag-', '');

			this.logger.debug('View', 'Navigating to tag (cards only)', { tagPath });

			// 활성 태그 모드인 경우: 오버라이드 설정 (파일 열지 않고 카드만 표시)
			if (this.settings.tagMode.useActiveFileTags) {
				this.plugin.settingsManager.updateSettings({
					currentMode: 'tag',
					tagMode: {
						...this.settings.tagMode,
						overrideTags: [tagPath]
					}
				});

				this.logger.debug('View', 'Tag dropdown: set override tag', { tagPath });
			} else {
				// 지정 태그 모드: specifiedTags 업데이트
				this.plugin.settingsManager.updateSettings({
					currentMode: 'tag',
					tagMode: {
						...this.settings.tagMode,
						specifiedTags: [tagPath]
					}
				});
			}

			await this.plugin.saveSettings();

			// 렌더 상태 초기화 및 카드 렌더링 (파일 열지 않음)
			this.viewRenderer.resetRenderState();
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

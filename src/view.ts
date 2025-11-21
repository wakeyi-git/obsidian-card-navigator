import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { CardRenderer } from './card/CardRenderer';
import { CardDataExtractor } from './card/CardData';
import CardNavigatorPlugin from './main';
import { isValidElement, isValidFile, isDefined } from './utils/typeGuards';
import { DebugLogger } from './utils/DebugLogger';
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
	private searchEngine: SearchEngine;
	private searchInput: SearchInput | null = null;
	public folderMode: FolderMode;
	public tagMode: TagMode;
	private sortManager: SortManager;
	private toolbar: Toolbar | null = null;
	private searchInputContainer: HTMLElement | null = null;
	private dragDropHandler: DragDropHandler;
	private contextMenu: CardContextMenu;
	public selectionManager: SelectionManager;
	
	// ⭐ 디바운스된 렌더링 함수 (중복 렌더링 방지)
	private debouncedForceRender: (() => Promise<void>) | null = null;

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
		this.searchEngine = new SearchEngine(this.app, this.logger);
		this.folderMode = new FolderMode(this.app, this);
		this.tagMode = new TagMode(this.app, this);
		this.sortManager = new SortManager(this.app);
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.dragDropHandler = new DragDropHandler(this.app, () => this.settings);
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.contextMenu = new CardContextMenu(this.app, () => this.settings);
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.selectionManager = new SelectionManager(this.app, () => this.settings);
		
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
			cls: 'search-input-container-wrapper'
		});
		this.searchInputContainer.style.display = 'none';
		
		this.searchInput = new SearchInput(this.app, this.searchInputContainer);
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

				this.logger.debug('View', t().debug.view.activeLeafChange, {
					previousFile: this.state.getPreviousFile()?.path || 'none',
					currentFile: activeFile?.path || 'none'
				});
				
				await this.plugin.presetManager.autoApplyPreset(activeFile);
				
				const hasActiveFileChanged = this.state.hasFileChanged(activeFile);
				const needsRerender = hasActiveFileChanged &&
					this.viewRenderer.needsRerenderForFileChange(activeFile);

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
				} else if (hasActiveFileChanged) {
					this.logger.debug('View', t().debug.view.sameContextUpdateClass);
					if (isValidElement(this.cardsContainer)) {
						this.viewRenderer.updateActiveCardClass(this.cardsContainer);
					}
					
					if (isValidFile(activeFile)) {
						const fileToScroll: TFile = activeFile;
						await this.scrollManager.scrollToActiveFile(fileToScroll, 'card-click');
					}
				} else {
					this.logger.debug('View', t().debug.view.sameFileNoAction);
				}
				
				if (isDefined(this.toolbar)) {
					this.toolbar.updateModeDisplay();
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
				this.searchInputContainer.style.display === 'none') {
				return;
			}
			
			if (this.searchInput && this.searchInput.getValue().trim()) {
				return;
			}
			
			const isClickInside = container.contains(event.target as Node);
			if (!isClickInside) {
				this.searchInputContainer.style.display = 'none';
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
			this.toolbar.updateModeDisplay();
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
	 */
	public showSearchInput(): void {
		if (!this.searchInputContainer) return;

		this.searchInputContainer.style.display = 'block';
		const input = this.searchInputContainer.querySelector('input');
		if (input) {
			input.focus();
		}
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
			const firstCard = this.cardsContainer?.querySelector('.card-item') as HTMLElement;
			if (firstCard) {
				firstCard.addClass('focused');
				firstCard.scrollIntoView({
					behavior: 'smooth',
					block: 'center'
				});
			}
			return;
		}
		
		this.keyboardNavigator.focusFileCard(activeFile);
	}
}

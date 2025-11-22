import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { CardNavigatorView, VIEW_TYPE_CARD_NAVIGATOR } from './view';
import { SettingsManager } from './settings';
import { CardNavigatorSettingTab } from './ui/SettingsTab';
import { CardNavigatorSettings, DebugCategory } from './types';
import { CardStyleManager } from './card/CardStyles';
import { PresetManager } from './preset/PresetManager';
import { DebugLogger } from './utils/DebugLogger';
import { ErrorHandler, ErrorSeverity } from './utils/ErrorHandler';
import { PerformanceMonitor } from './utils/performance';
import { setLanguage, t, detectLanguageFromLocale } from './i18n';
import { getMomentLocale } from './utils/locale';

/**
 * Card Navigator 플러그인
 * 
 * 노트를 카드 형태로 시각화하고 탐색하는 플러그인입니다.
 * 폴더 모드, 태그 모드, 검색 모드를 지원하며,
 * 프리셋을 통한 빠른 설정 전환이 가능합니다.
 */
export default class CardNavigatorPlugin extends Plugin {
	settingsManager: SettingsManager;
	styleManager: CardStyleManager;
	presetManager: PresetManager;
	settingsTab!: CardNavigatorSettingTab;
	public logger!: DebugLogger;
	public errorHandler!: ErrorHandler;
	public performanceMonitor!: PerformanceMonitor;

	/**
	 * 플러그인 활성화
	 * 
	 * 플러그인이 로드될 때 호출되며, 모든 초기화 작업을 수행합니다.
	 */
	async onload(): Promise<void> {
		this.settingsManager = new SettingsManager(
			this.app,
			async (settings: CardNavigatorSettings) => {
				await this.saveData(settings);
			}
		);

		this.presetManager = new PresetManager(this);

	await this.loadSettings();

	// Set language based on settings
	const languageSetting = this.settingsManager.getSettings().language;
	const actualLanguage = languageSetting === 'auto'
		? detectLanguageFromLocale(getMomentLocale())
		: languageSetting;
	setLanguage(actualLanguage);

	// ✅ 함수를 전달하여 항상 최신 settings를 참조
	this.styleManager = new CardStyleManager(() => this.settingsManager.getSettings());

	// ✅ 함수를 전달하여 항상 최신 settings를 참조
	this.logger = new DebugLogger(() => this.settingsManager.getSettings());
	this.errorHandler = new ErrorHandler(this.logger);
	this.performanceMonitor = new PerformanceMonitor(this.settingsManager.getSettings());
		this.logger.debug('Plugin', t().plugin.loadingStart);

		await this.presetManager.initialize();
		this.styleManager.applyStyles(this.settingsManager.getSettings());

		this.registerView(
			VIEW_TYPE_CARD_NAVIGATOR,
			(leaf) => new CardNavigatorView(leaf, this)
		);

		this.addRibbonIcon('layout-grid', t().plugin.ribbonTitle, (_evt: MouseEvent) => {
			this.activateView();
		});
		this.addCommand({
			id: 'select-all-cards',
			name: t().commands.selectAll,
			checkCallback: (checking: boolean) => {
				// Card Navigator 뷰가 활성화되어 있는지 확인
				const leaf = this.app.workspace.getActiveViewOfType(CardNavigatorView);
				
				if (leaf) {
					if (!checking) {
						// 명령어 실행
						leaf.selectionManager.selectAll();
					}
					return true;
				}
				
				return false;
			}
		});
		
		this.addCommand({
			id: 'focus-card-navigator',
			name: t().commands.focusCardNavigator,
			callback: async () => {
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR);
				
				if (leaves.length === 0) {
					await this.activateView();
					await new Promise(resolve => setTimeout(resolve, 100));
				}
				
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR)[0];
				if (leaf && leaf.view instanceof CardNavigatorView) {
					this.app.workspace.revealLeaf(leaf);
					leaf.view.focusOnActiveCard();
				}
			}
		});

		// Performance monitoring commands
		this.addCommand({
			id: 'show-performance-stats',
			name: 'Show Performance Statistics',
			callback: () => {
				const stats = this.performanceMonitor.getAllStats();
				if (stats.size === 0) {
					new Notice('No performance data collected yet. Enable performance monitoring first.');
					return;
				}

				// Format stats for display
				const statsArray = Array.from(stats.entries())
					.map(([label, stat]) => {
						if (!stat) return null;
						return {
							Label: label,
							Count: stat.count,
							'Avg (ms)': stat.avg.toFixed(2),
							'Min (ms)': stat.min.toFixed(2),
							'Max (ms)': stat.max.toFixed(2),
							'Total (ms)': stat.total.toFixed(2)
						};
					})
					.filter(Boolean);

				console.table(statsArray);
				new Notice(`Performance stats logged to console (${stats.size} operations)`);
			}
		});

		this.addCommand({
			id: 'enable-performance-monitoring',
			name: 'Enable Performance Monitoring',
			callback: () => {
				this.performanceMonitor.enable();
				new Notice('Performance monitoring enabled');
			}
		});

		this.addCommand({
			id: 'disable-performance-monitoring',
			name: 'Disable Performance Monitoring',
			callback: () => {
				this.performanceMonitor.disable();
				new Notice('Performance monitoring disabled');
			}
		});

		this.addCommand({
			id: 'clear-performance-stats',
			name: 'Clear Performance Statistics',
			callback: () => {
				this.performanceMonitor.clearStats();
				new Notice('Performance statistics cleared');
			}
		});

		// 모드 전환 단축키 (폴더 ↔ 태그)
		this.addCommand({
			id: 'switch-mode',
			name: t().commands.switchMode,
			callback: async () => {
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR)[0];
				if (leaf?.view instanceof CardNavigatorView) {
					await leaf.view.switchMode();
				}
			}
		});

		// 모드 옵션 전환 단축키 (활성/지정)
		this.addCommand({
			id: 'toggle-mode-option',
			name: t().commands.toggleModeOption,
			callback: async () => {
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR)[0];
				if (leaf?.view instanceof CardNavigatorView) {
					await leaf.view.toggleModeOption();
				}
			}
		});

		// 검색 입력창 표시 단축키
		this.addCommand({
			id: 'show-search',
			name: t().commands.showSearch,
			callback: () => {
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR)[0];
				if (leaf?.view instanceof CardNavigatorView) {
					leaf.view.showSearchInput();
				}
			}
		});

		// 폴더 선택 단축키
		this.addCommand({
			id: 'select-folder',
			name: t().commands.selectFolder,
			callback: () => {
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR)[0];
				if (leaf?.view instanceof CardNavigatorView) {
					leaf.view.openFolderSelector();
				}
			}
		});

		// 태그 선택 단축키
		this.addCommand({
			id: 'select-tag',
			name: t().commands.selectTag,
			callback: () => {
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR)[0];
				if (leaf?.view instanceof CardNavigatorView) {
					leaf.view.openTagSelector();
				}
			}
		});

		// 렌더링 모드 전환 단축키 (plain ↔ markdown-html)
		this.addCommand({
			id: 'toggle-render-mode',
			name: t().commands.toggleRenderMode,
			callback: async () => {
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR)[0];
				if (leaf?.view instanceof CardNavigatorView) {
					await leaf.view.toggleRenderMode();
				}
			}
		});

		this.settingsTab = new CardNavigatorSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);

		this.logger.debug('Plugin', t().plugin.loadingComplete);
	}

	/**
	 * 플러그인 비활성화
	 * 
	 * 플러그인이 언로드될 때 호출되며, 모든 정리 작업을 수행합니다.
	 */
	onunload(): void {
		this.logger.debug('Plugin', t().plugin.unloading);
		this.styleManager.resetStyles();
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR);
	}

	/**
	 * 현재 설정 반환
	 */
	get settings(): CardNavigatorSettings {
		return this.settingsManager.getSettings();
	}

	/**
	 * 설정 로드
	 */
	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		this.settingsManager.loadSettings(data);
	}

	/**
	 * 설정 저장
	 * 
	 * 설정을 파일에 저장한 후,
	 * 스타일을 적용하고 모든 뷰를 새로고침합니다.
	 */
	async saveSettings(): Promise<void> {
		try {
			this.logger.debug('Plugin', 'saveSettings() called');

			const settings = this.settingsManager.getSettings();

			// Update language if changed
			const actualLanguage = settings.language === 'auto'
				? detectLanguageFromLocale(getMomentLocale())
				: settings.language;
			setLanguage(actualLanguage);

			await this.saveData(settings);

			this.styleManager.applyStyles(settings);

			await this.refreshView();

			this.logger.debug('Plugin', 'saveSettings() complete');
		} catch (error) {
			this.errorHandler.handle(
				error,
				ErrorSeverity.ERROR,
				{ category: 'Plugin', action: 'save settings' },
				t().errors.settingsSaveFailed,
				true
			);
		}
	}

	/**
	 * 설정을 조용히 저장 (뷰 새로고침 없이)
	 * 
	 * refreshView()를 호출하지 않으므로 불필요한 재렌더링을 방지합니다.
	 */
	async saveSettingsQuiet(): Promise<void> {
		try {
			this.logger.debug('Plugin', t().settingsAdditional.settingsSaveQuietStart);

			const settings = this.settingsManager.getSettings();

			// Update language if changed
			const actualLanguage = settings.language === 'auto'
				? detectLanguageFromLocale(getMomentLocale())
				: settings.language;
			setLanguage(actualLanguage);

			await this.saveData(settings);
			this.styleManager.applyStyles(settings);

			this.logger.debug('Plugin', t().settingsAdditional.settingsSaveQuietComplete);
		} catch (error) {
			this.errorHandler.handle(
				error,
				ErrorSeverity.ERROR,
				{ category: 'Plugin', action: 'save settings quietly' },
				t().errors.settingsSaveFailed,
				true
			);
		}
	}

	/**
	 * 뷰 새로고침
	 * 
	 * 설정 변경 시 모든 Card Navigator 뷰를 새로고침합니다.
	 */
	async refreshView(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof CardNavigatorView) {
				await view.refresh();
			}
		}
	}

	/**
	 * 디버그 로그 출력
	 * 
	 * 디버그 모드가 활성화되어 있고 해당 카테고리가 선택되어 있을 때만
	 * 콘솔에 로그를 출력합니다.
	 * 
	 * @param category - 디버그 카테고리
	 * @param message - 로그 메시지
	 * @param data - 추가 데이터 (선택사항)
	 * 
	 * @example
	 * ```typescript
	 * this.plugin.debugLog('Layout', '그리드 레이아웃 계산 시작');
	 * this.plugin.debugLog('Layout', '카드 크기:', { width: 200, height: 150 });
	 * ```
	 */
	debugLog(category: DebugCategory, message: string, data?: Record<string, unknown>): void {
		this.logger.debug(category, message, data);
	}

	/**
	 * 카드 뷰 활성화
	 * 
	 * 기존 뷰가 있으면 활성화하고, 없으면 오른쪽 사이드바에 새로 생성합니다.
	 */
	async activateView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CARD_NAVIGATOR);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_CARD_NAVIGATOR,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}
}

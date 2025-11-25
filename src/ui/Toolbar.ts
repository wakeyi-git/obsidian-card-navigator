import { App, Menu, setIcon } from 'obsidian';
import { t } from '../i18n';
import CardNavigatorPlugin from '../main';
import { SortCriteria, SortOrder } from '../types';
import { DebugLogger } from '../utils/DebugLogger';
import { CardNavigatorView } from '../view';
import { FolderSuggestModal } from './FolderSuggestModal';
import { MultiSortModal } from './MultiSortModal';
import { TagSuggestModal } from './TagSuggestModal';

/**
 * Card Navigator 툴바
 *
 * 툴바 UI 생성 및 관리를 담당합니다.
 * 모드 전환, 정렬 옵션, 검색창 토글, 그룹화 활성화 기능을 제공합니다.
 */
export class Toolbar {
	private app: App;
	private view: CardNavigatorView;
	private plugin: CardNavigatorPlugin;
	private logger: DebugLogger;

	private toolbarElement: HTMLElement | null = null;
	private modeToggleIcon: HTMLElement | null = null;
	private searchInputContainer: HTMLElement | null = null;
	private fileCountElement: HTMLElement | null = null;
	private sortButton: HTMLElement | null = null;
	private groupingButton: HTMLElement | null = null;
	private collapseExpandButton: HTMLElement | null = null;
	private pinButton: HTMLElement | null = null;
	private allCollapsed: boolean = false;

	constructor(app: App, view: CardNavigatorView, plugin: CardNavigatorPlugin) {
		this.app = app;
		this.view = view;
		this.plugin = plugin;
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.logger = new DebugLogger(() => this.plugin.settingsManager.getSettings());
	}

	/**
	 * 툴바 렌더링
	 *
	 * @param container - 툴바를 추가할 컨테이너
	 */
	public render(container: HTMLElement): void {
		this.createToolbar(container);
	}

	/**
	 * 툴바 DOM 생성
	 */
	private createToolbar(container: HTMLElement): void {
		this.toolbarElement = container.createEl('div', {
			cls: 'card-navigator-toolbar'
		});

		// 현재 모드 표시 (좌측에 배치)
		this.fileCountElement = this.toolbarElement.createEl('div', {
			cls: 'toolbar-mode-display'
		});
		this.updateModeDisplay();

		const iconGroup = this.toolbarElement.createEl('div', {
			cls: 'toolbar-icon-group'
		});

		// 1. 모드 전환 버튼 (폴더 ↔ 태그)
		const modeToggle = iconGroup.createEl('div', {
			cls: 'clickable-icon',
			attr: { 'aria-label': t().toolbar.modeSwitch }
		});
		setIcon(modeToggle, 'repeat');

		modeToggle.addEventListener('click', async () => {
			await this.onModeSwitch();
		});

		// 2. 모드 토글 아이콘 (활성 폴더/지정 폴더)
		this.modeToggleIcon = iconGroup.createEl('div', {
			cls: ['clickable-icon', 'mode-toggle-icon']
		});

		this.modeToggleIcon.addEventListener('click', async () => {
			await this.onModeToggleClick();
		});

		// 3. 그룹화 활성화 버튼
		this.groupingButton = iconGroup.createEl('div', {
			cls: 'clickable-icon',
			attr: { 'aria-label': t().toolbar.groupingToggle || 'Toggle grouping' }
		});
		this.updateGroupingButton();

		this.groupingButton.addEventListener('click', async () => {
			await this.onGroupingToggle();
		});

		// 4. 모두 접기/펼치기 토글 버튼
		this.collapseExpandButton = iconGroup.createEl('div', {
			cls: 'clickable-icon',
			attr: { 'aria-label': t().commands.collapseAllGroups || 'Collapse all groups' }
		});
		this.updateCollapseExpandButton();

		this.collapseExpandButton.addEventListener('click', async () => {
			await this.onCollapseExpandToggle();
		});

		// 5. 핀 표시 토글 버튼
		this.pinButton = iconGroup.createEl('div', {
			cls: 'clickable-icon',
			attr: { 'aria-label': t().toolbar.pinToggle || 'Toggle pinned files' }
		});
		this.updatePinButton();

		this.pinButton.addEventListener('click', async () => {
			await this.onPinToggle();
		});

		// 6. 정렬 버튼
		this.sortButton = iconGroup.createEl('div', {
			cls: 'clickable-icon',
			attr: { 'aria-label': t().toolbar.sortByLabel }
		});
		setIcon(this.sortButton, 'arrow-up-down');

		this.sortButton.addEventListener('click', (event) => {
			this.showSortMenu(event);
		});

		this.updateModeToggleIcon();
		this.updateSortButton();

		// 7. 검색 버튼
		const searchButton = iconGroup.createEl('div', {
			cls: 'clickable-icon',
			attr: { 'aria-label': t().toolbar.searchLabel }
		});
		setIcon(searchButton, 'search');

		searchButton.addEventListener('click', () => {
			this.onSearchToggle();
		});
	}

	/**
	 * 그룹화 버튼 상태 업데이트
	 */
	public updateGroupingButton(): void {
		if (!this.groupingButton) return;

		const settings = this.plugin.settingsManager.getSettings();
		const isEnabled = settings?.grouping?.enabled || false;

		this.groupingButton.empty();
		setIcon(this.groupingButton, isEnabled ? 'gallery-vertical' : 'rows-2');

		if (isEnabled) {
			this.groupingButton.addClass('is-active');
		} else {
			this.groupingButton.removeClass('is-active');
		}

		this.groupingButton.setAttribute(
			'aria-label',
			isEnabled
				? (t().toolbar.groupingDisable || 'Disable grouping')
				: (t().toolbar.groupingEnable || 'Enable grouping')
		);
	}

	/**
	 * 핀 버튼 상태 업데이트
	 */
	public updatePinButton(): void {
		if (!this.pinButton) return;

		const settings = this.plugin.settingsManager.getSettings();
		const isEnabled = settings?.alwaysShowPinnedFiles || false;

		this.pinButton.empty();
		setIcon(this.pinButton, 'pin');

		if (isEnabled) {
			this.pinButton.addClass('is-active');
		} else {
			this.pinButton.removeClass('is-active');
		}

		this.pinButton.setAttribute(
			'aria-label',
			isEnabled
				? (t().toolbar.pinHide || 'Hide pinned files')
				: (t().toolbar.pinShow || 'Always show pinned files')
		);
	}

	/**
	 * 그룹화 토글 클릭 처리
	 */
	private async onGroupingToggle(): Promise<void> {
		const settings = this.plugin.settingsManager.getSettings();
		settings.grouping.enabled = !settings.grouping.enabled;

		await this.plugin.settingsManager.updateSettings({
			grouping: settings.grouping
		});

		this.updateGroupingButton();
		this.updateCollapseExpandButton();
		await this.view.refresh();
	}

	/**
	 * 모두 접기/펼치기 버튼 상태 업데이트
	 */
	public updateCollapseExpandButton(): void {
		if (!this.collapseExpandButton) return;

		const settings = this.plugin.settingsManager.getSettings();
		const isGroupingEnabled = settings?.grouping?.enabled || false;

		this.collapseExpandButton.empty();

		// 그룹화가 비활성화되면 버튼 숨김
		if (!isGroupingEnabled) {
			this.collapseExpandButton.style.display = 'none';
			return;
		}

		this.collapseExpandButton.style.display = '';

		// 현재 상태에 따라 아이콘 변경
		if (this.allCollapsed) {
			setIcon(this.collapseExpandButton, 'chevrons-down-up');
			this.collapseExpandButton.setAttribute(
				'aria-label',
				t().commands.expandAllGroups || 'Expand all groups'
			);
		} else {
			setIcon(this.collapseExpandButton, 'chevrons-up-down');
			this.collapseExpandButton.setAttribute(
				'aria-label',
				t().commands.collapseAllGroups || 'Collapse all groups'
			);
		}
	}

	/**
	 * 모두 접기/펼치기 토글 클릭 처리
	 */
	private async onCollapseExpandToggle(): Promise<void> {
		this.allCollapsed = !this.allCollapsed;

		if (this.allCollapsed) {
			await this.view.collapseAllGroups();
		} else {
			await this.view.expandAllGroups();
		}

		this.updateCollapseExpandButton();
	}

	/**
	 * 핀 토글 클릭 처리
	 */
	private async onPinToggle(): Promise<void> {
		const settings = this.plugin.settingsManager.getSettings();
		settings.alwaysShowPinnedFiles = !settings.alwaysShowPinnedFiles;

		await this.plugin.settingsManager.updateSettings({
			alwaysShowPinnedFiles: settings.alwaysShowPinnedFiles
		});

		this.updatePinButton();
		await this.view.refresh();
	}

	/**
	 * 모드 토글 아이콘 업데이트
	 *
	 * 현재 모드(폴더/태그)와 설정(활성/지정)에 따라 아이콘을 변경합니다.
	 *
	 * 폴더 모드:
	 * - 활성 폴더: folder-sync 아이콘
	 * - 폴더 지정: folder 아이콘
	 *
	 * 태그 모드:
	 * - 활성 파일 태그: file-text 아이콘
	 * - 태그 지정: tags 아이콘
	 */
	public updateModeToggleIcon(): void {
		if (!this.modeToggleIcon) return;

		const settings = this.plugin.settingsManager.getSettings();

		// settings가 null인 경우 기본 아이콘 표시
		if (!settings) {
			setIcon(this.modeToggleIcon, 'folder');
			this.modeToggleIcon.setAttribute('aria-label', t().toolbar.modeSwitch);
			return;
		}

		this.modeToggleIcon.removeClass('mode-active');

		if (settings.currentMode === 'folder') {
			if (settings.folderMode.useActiveFolder) {
				setIcon(this.modeToggleIcon, 'folder-sync');
				this.modeToggleIcon.setAttribute('aria-label', t().toolbar.modeToggleFolderToSpecific);
				this.modeToggleIcon.addClass('mode-active');
			} else {
				setIcon(this.modeToggleIcon, 'folder');
				this.modeToggleIcon.setAttribute('aria-label', t().toolbar.modeToggleFolderToActive);
			}
		} else {
			if (settings.tagMode.useActiveFileTags) {
				setIcon(this.modeToggleIcon, 'file-text');
				this.modeToggleIcon.setAttribute('aria-label', t().toolbar.modeToggleTagToSpecific);
				this.modeToggleIcon.addClass('mode-active');
			} else {
				setIcon(this.modeToggleIcon, 'tags');
				this.modeToggleIcon.setAttribute('aria-label', t().toolbar.modeToggleTagToActive);
			}
		}
	}

	/**
	 * 모드 토글 클릭 처리
	 *
	 * 현재 모드와 설정에 따라 적절한 동작을 수행합니다:
	 * - 폴더 모드 + 활성 폴더 → 폴더 선택 모달
	 * - 폴더 모드 + 폴더 지정 → 활성 폴더로 전환
	 * - 태그 모드 + 활성 파일 태그 → 태그 선택 모달
	 * - 태그 모드 + 태그 지정 → 활성 파일 태그로 전환
	 */
	public async onModeToggleClick(): Promise<void> {
		const settings = this.plugin.settingsManager.getSettings();

		if (settings.currentMode === 'folder') {
			if (settings.folderMode.useActiveFolder) {
				this.openFolderSelector();
			} else {
				await this.onFolderModeToActive();
			}
		} else {
			if (settings.tagMode.useActiveFileTags) {
				this.openTagSelector();
			} else {
				await this.onTagModeToActive();
			}
		}
	}

	/**
	 * 검색 입력창 컨테이너 설정
	 */
	public setSearchInputContainer(container: HTMLElement): void {
		this.searchInputContainer = container;
	}

	/**
	 * 검색 입력창 토글
	 *
	 * @remarks
	 * 리팩토링 2025-11-23: CSS 클래스 기반 표시/숨김
	 */
	private onSearchToggle(): void {
		if (!this.searchInputContainer) return;

		const isHidden = this.searchInputContainer.classList.contains('hidden');

		if (isHidden) {
			this.searchInputContainer.classList.remove('hidden');

			const input = this.searchInputContainer.querySelector('input');
			if (input) {
				input.focus();
			}
		} else {
			this.searchInputContainer.classList.add('hidden');
			this.view.clearSearch();
		}
	}

	/**
	 * 정렬 메뉴 표시
	 */
	private showSortMenu(event: MouseEvent): void {
		const menu = new Menu();

		// Get current settings at menu creation time
		const currentSettings = this.plugin.settingsManager.getSettings();
		const currentSort = currentSettings.sort;

		// Multi-sort toggle (unified: toggle + configure)
		menu.addItem(item => {
			const isEnabled = currentSort.enableMultiSort || false;
			item.setTitle(t().toolbar.sortOptions.multiSort);
			item.setChecked(isEnabled);

			item.onClick(async () => {
				const settings = this.plugin.settingsManager.getSettings();
				if (!isEnabled) {
					// Enable and open configuration modal
					settings.sort.enableMultiSort = true;
					// Initialize with current sort as first level if no levels exist
					if (!settings.sort.levels || settings.sort.levels.length === 0) {
						settings.sort.levels = [{
							criteria: settings.sort.criteria,
							order: settings.sort.order,
							propertyName: settings.sort.propertyName
						}];
					}
					await this.plugin.settingsManager.updateSettings({ sort: settings.sort });
				}
				// Always open modal whether enabling or already enabled
				this.openMultiSortModal();
			});
		});

		// Add a separate item to disable multi-sort when it's enabled
		if (currentSort.enableMultiSort) {
			menu.addItem(item => {
				item.setTitle(t().toolbar.disableMultiSort);
				item.setIcon('x');
				item.onClick(async () => {
					const settings = this.plugin.settingsManager.getSettings();
					settings.sort.enableMultiSort = false;
					// Keep levels to restore later, don't delete them
					await this.plugin.settingsManager.updateSettings({ sort: settings.sort });
					this.updateSortButton();
					await this.view.refresh();
				});
			});
		}

		menu.addSeparator();

		// If multi-sort is enabled, show the levels
		if (currentSort.enableMultiSort && currentSort.levels && currentSort.levels.length > 0) {
			currentSort.levels.forEach((level, index) => {
				menu.addItem(item => {
					const criteriaLabel = this.getCriteriaLabel(level.criteria);
					const orderLabel = level.order === 'asc' ? '↑' : '↓';
					const levelLabel = t().toolbar.sortLevel(index + 1);
					item.setTitle(`${levelLabel}: ${criteriaLabel} ${orderLabel}`);
					item.setDisabled(true); // Read-only display
				});
			});
		} else {
			// Show single sort options
			const sortOptions: Array<{
				label: string;
				criteria: SortCriteria;
				order: SortOrder;
			}> = [
				{ label: t().toolbar.sortOptions.nameAsc, criteria: 'name', order: 'asc' },
				{ label: t().toolbar.sortOptions.nameDesc, criteria: 'name', order: 'desc' },
				{ label: t().toolbar.sortOptions.modifiedDesc, criteria: 'modified', order: 'desc' },
				{ label: t().toolbar.sortOptions.modifiedAsc, criteria: 'modified', order: 'asc' },
				{ label: t().toolbar.sortOptions.createdDesc, criteria: 'created', order: 'desc' },
				{ label: t().toolbar.sortOptions.createdAsc, criteria: 'created', order: 'asc' },
				{ label: t().toolbar.sortOptions.sizeDesc, criteria: 'size', order: 'desc' },
				{ label: t().toolbar.sortOptions.sizeAsc, criteria: 'size', order: 'asc' }
			];

			sortOptions.forEach(option => {
				menu.addItem(item => {
					item.setTitle(option.label);

					// Show check if this option is currently applied (and multi-sort is disabled)
					const isCurrentOption = !currentSort.enableMultiSort &&
						currentSort.criteria === option.criteria &&
						currentSort.order === option.order;
					item.setChecked(isCurrentOption);

					item.onClick(async () => {
						// Get fresh settings for update
						const settings = this.plugin.settingsManager.getSettings();
						// Disable multi-sort and apply single sort
						settings.sort.enableMultiSort = false;
						// Keep levels to restore later, don't delete them
						settings.sort.criteria = option.criteria;
						settings.sort.order = option.order;
						await this.plugin.settingsManager.updateSettings({ sort: settings.sort });
						this.updateSortButton();
						await this.view.refresh();
					});
				});
			});
		}

		menu.showAtMouseEvent(event);
	}

	/**
	 * 폴더 선택 모달 열기
	 */
	public openFolderSelector(): void {
		const modal = new FolderSuggestModal(this.app, async (folder) => {
			if (folder) {
				const settings = this.plugin.settingsManager.getSettings();
				settings.folderMode.useActiveFolder = false;
				settings.folderMode.specifiedFolder = folder.path === '/' ? '' : folder.path;

				await this.plugin.settingsManager.updateSettings({
					folderMode: settings.folderMode
				});

				await this.view.refresh();
				this.updateModeToggleIcon();
				this.updateModeDisplay();
			}
		});

		modal.open();
	}

	/**
	 * 태그 선택 모달 열기
	 */
	public openTagSelector(): void {
		const modal = new TagSuggestModal(this.app, async (tag) => {
			if (tag) {
				const settings = this.plugin.settingsManager.getSettings();
				settings.tagMode.useActiveFileTags = false;
				settings.tagMode.specifiedTags = [tag];

				await this.plugin.settingsManager.updateSettings({
					tagMode: settings.tagMode
				});

				await this.view.refresh();
				this.updateModeToggleIcon();
				this.updateModeDisplay();
			}
		});

		modal.open();
	}

	/**
	 * 모드 전환 (폴더 ↔ 태그)
	 */
	public async onModeSwitch(): Promise<void> {
		const settings = this.plugin.settingsManager.getSettings();
		settings.currentMode = settings.currentMode === 'folder' ? 'tag' : 'folder';
		await this.plugin.settingsManager.updateSettings({ currentMode: settings.currentMode });

		await this.view.refresh();
		this.updateModeToggleIcon();
		this.updateModeDisplay();
	}

	/**
	 * 폴더 모드를 활성 폴더로 전환
	 */
	private async onFolderModeToActive(): Promise<void> {
		const settings = this.plugin.settingsManager.getSettings();
		settings.folderMode.useActiveFolder = true;
		settings.folderMode.specifiedFolder = undefined;

		await this.plugin.settingsManager.updateSettings({
			folderMode: settings.folderMode
		});

		await this.view.refresh();
		this.updateModeToggleIcon();
		this.updateModeDisplay();
	}

	/**
	 * 태그 모드를 활성 파일 태그로 전환
	 */
	private async onTagModeToActive(): Promise<void> {
		const settings = this.plugin.settingsManager.getSettings();
		settings.tagMode.useActiveFileTags = true;
		settings.tagMode.specifiedTags = [];

		await this.plugin.settingsManager.updateSettings({
			tagMode: settings.tagMode
		});

		await this.view.refresh();
		this.updateModeToggleIcon();
		this.updateModeDisplay();
	}

	/**
	 * 현재 모드 표시 업데이트
	 *
	 * 폴더 모드: 📁 Folder(Active) 또는 📁 Folder(Specified)
	 * 태그 모드: # Tag(Active) 또는 # Tag(Specified)
	 *
	 * 실제 폴더/태그명은 Context Bar에서 표시합니다.
	 */
	public updateModeDisplay(): void {
		if (!this.fileCountElement) return;

		const settings = this.plugin.settingsManager.getSettings();
		if (!settings) {
			this.fileCountElement.empty();
			return;
		}

		this.fileCountElement.empty();

		if (settings.currentMode === 'folder') {
			// 폴더 아이콘
			const iconEl = this.fileCountElement.createEl('span', {
				cls: 'toolbar-mode-icon'
			});
			setIcon(iconEl, 'folder');

			// 모드명 + 옵션 표시
			const modeName = t().toolbar.folderMode || 'Folder';
			const optionName = settings.folderMode.useActiveFolder
				? (t().toolbar.modeOptionActive || 'Active')
				: (t().toolbar.modeOptionSpecified || 'Specified');
			this.fileCountElement.createEl('span', {
				cls: 'toolbar-mode-name',
				text: `${modeName}(${optionName})`
			});
		} else {
			// 태그 아이콘
			const iconEl = this.fileCountElement.createEl('span', {
				cls: 'toolbar-mode-icon'
			});
			setIcon(iconEl, 'hash');

			// 모드명 + 옵션 표시
			const modeName = t().toolbar.tagMode || 'Tag';
			const optionName = settings.tagMode.useActiveFileTags
				? (t().toolbar.modeOptionActive || 'Active')
				: (t().toolbar.modeOptionSpecified || 'Specified');
			this.fileCountElement.createEl('span', {
				cls: 'toolbar-mode-name',
				text: `${modeName}(${optionName})`
			});
		}
	}

	/**
	 * 파일 개수 업데이트 (하위 호환성 유지, 실제로는 모드 표시 업데이트)
	 *
	 * @param displayed - 현재 표시되는 파일 수 (사용하지 않음)
	 * @param total - 전체 파일 수 (사용하지 않음)
	 */
	public updateFileCount(displayed: number, total: number): void {
		// 하위 호환성을 위해 유지하지만 실제로는 모드 표시 업데이트
		this.updateModeDisplay();
	}

	/**
	 * 정렬 버튼 툴팁 업데이트
	 */
	public updateSortButton(): void {
		if (!this.sortButton) return;

		this.sortButton.setAttribute('aria-label', this.getSortDescription());
	}

	/**
	 * 현재 정렬 상태를 설명하는 문자열을 반환합니다
	 */
	private getSortDescription(): string {
		const settings = this.plugin.settingsManager.getSettings();
		const sort = settings.sort;

		if (sort.enableMultiSort && sort.levels && sort.levels.length > 0) {
			const levelDescriptions = sort.levels.map((level, index) => {
				const criteriaLabel = this.getCriteriaLabel(level.criteria);
				const orderLabel = level.order === 'asc' ? '↑' : '↓';
				return `${index + 1}. ${criteriaLabel} ${orderLabel}`;
			});
			return `${t().toolbar.sortByLabel}\n${levelDescriptions.join('\n')}`;
		} else {
			const criteriaLabel = this.getCriteriaLabel(sort.criteria);
			const orderLabel = sort.order === 'asc' ? '↑' : '↓';
			return `${t().toolbar.sortByLabel}: ${criteriaLabel} ${orderLabel}`;
		}
	}

	/**
	 * 정렬 기준의 라벨을 반환합니다
	 */
	private getCriteriaLabel(criteria: SortCriteria): string {
		const labels: Record<SortCriteria, string> = {
			'name': t().toolbar.sortOptions.nameAsc.split(' (')[0],
			'created': t().settingsTab.sortSettings.criteriaOptions.created,
			'modified': t().settingsTab.sortSettings.criteriaOptions.modified,
			'size': t().settingsTab.sortSettings.criteriaOptions.size,
			'property': t().settingsTab.sortSettings.criteriaOptions.property
		};
		return labels[criteria] || criteria;
	}

	/**
	 * 다단계 정렬 구성 모달을 엽니다
	 */
	private openMultiSortModal(): void {
		const settings = this.plugin.settingsManager.getSettings();
		const initialLevels = settings.sort.levels || [{
			criteria: settings.sort.criteria,
			order: settings.sort.order,
			propertyName: settings.sort.propertyName
		}];

		const modal = new MultiSortModal(
			this.app,
			this.plugin,
			initialLevels,
			async (levels) => {
				// Get fresh settings for update
				const currentSettings = this.plugin.settingsManager.getSettings();
				currentSettings.sort.levels = levels;
				await this.plugin.settingsManager.updateSettings({ sort: currentSettings.sort });
				this.updateSortButton();
				await this.view.refresh();
			}
		);

		modal.open();
	}

	/**
	 * 툴바 정리
	 */
	public destroy(): void {
		this.toolbarElement = null;
		this.modeToggleIcon = null;
		this.searchInputContainer = null;
		this.fileCountElement = null;
		this.groupingButton = null;
		this.collapseExpandButton = null;
		this.pinButton = null;
		this.allCollapsed = false;
	}
}

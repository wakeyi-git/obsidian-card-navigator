import { App, Menu, setIcon } from 'obsidian';
import { SortCriteria, SortOrder } from '../types';
import CardNavigatorPlugin from '../main';
import { CardNavigatorView } from '../view';
import { FolderSuggestModal } from './FolderSuggestModal';
import { TagSuggestModal } from './TagSuggestModal';
import { MultiSortModal } from './MultiSortModal';
import { DebugLogger } from '../utils/DebugLogger';
import { t } from '../i18n';

/**
 * Card Navigator 툴바
 * 
 * 툴바 UI 생성 및 관리를 담당합니다.
 * 모드 표시, 모드 전환, 정렬 옵션, 검색창 토글 기능을 제공합니다.
 */
export class Toolbar {
	private app: App;
	private view: CardNavigatorView;
	private plugin: CardNavigatorPlugin;
	private logger: DebugLogger;
	
	private toolbarElement: HTMLElement | null = null;
	private modeDisplayElement: HTMLElement | null = null;
	private modeToggleIcon: HTMLElement | null = null;
	private searchInputContainer: HTMLElement | null = null;
	private fileCountElement: HTMLElement | null = null;
	private sortButton: HTMLElement | null = null;

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

		this.modeDisplayElement = this.toolbarElement.createEl('div', {
			cls: 'toolbar-mode-display'
		});
		this.updateModeDisplay();

		// File count display
		this.fileCountElement = this.toolbarElement.createEl('div', {
			cls: 'toolbar-file-count'
		});
		this.updateFileCount(0, 0); // Initialize with 0

		const iconGroup = this.toolbarElement.createEl('div', {
			cls: 'toolbar-icon-group'
		});

		this.modeToggleIcon = iconGroup.createEl('div', {
			cls: ['clickable-icon', 'mode-toggle-icon']
		});
		
		this.modeToggleIcon.addEventListener('click', async () => {
			await this.onModeToggleClick();
		});
		
		const modeToggle = iconGroup.createEl('div', {
			cls: 'clickable-icon',
			attr: { 'aria-label': t().toolbar.modeSwitch }
		});
		setIcon(modeToggle, 'repeat');
		
		modeToggle.addEventListener('click', async () => {
			await this.onModeSwitch();
		});

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
	 * 모드 표시 업데이트
	 * 
	 * 폴더 모드: 현재 폴더명 표시 (클릭 가능)
	 * 태그 모드: 현재 태그 표시 (클릭 가능)
	 */
	public updateModeDisplay(): void {
		if (!this.modeDisplayElement) return;

		const parent = this.modeDisplayElement.parentElement;
		if (!parent) return;

		const newElement = document.createElement('div');
		newElement.classList.add('toolbar-mode-display', 'clickable');
		newElement.setAttribute('aria-label', t().toolbar.clickToSelectFolderTag);

		parent.replaceChild(newElement, this.modeDisplayElement);
		this.modeDisplayElement = newElement;

		const settings = this.plugin.settingsManager.getSettings();

		// settings가 null인 경우 기본 텍스트 표시
		if (!settings) {
			this.modeDisplayElement.createEl('span', {
				text: t().toolbar.noSettings
			});
			return;
		}

		if (settings.currentMode === 'folder') {
			let displayText: string = t().toolbar.all;

			if (settings.folderMode.useActiveFolder) {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.parent) {
					displayText = activeFile.parent.name || t().toolbar.root;
				}
			} else if (settings.folderMode.specifiedFolder) {
				const folder = this.app.vault.getAbstractFileByPath(settings.folderMode.specifiedFolder);
				if (folder) {
					displayText = folder.name;
				}
			}
			
			const iconEl = this.modeDisplayElement.createEl('span', {
				cls: 'mode-display-icon'
			});
			setIcon(iconEl, 'folder');
			
			this.modeDisplayElement.createEl('span', {
				cls: 'mode-display-text',
				text: displayText
			});
			
			this.modeDisplayElement.addEventListener('mousedown', (e) => {
				e.preventDefault(); // 포커스 변경 방지
				this.openFolderSelector();
			});
		} else {
			let displayText: string = t().toolbar.allTags;
			let fullTagList = '';
			
			const normalizeTag = (tag: string): string => {
				if (!tag) return '';
				if (tag.startsWith('#')) return tag;
				return '#' + tag;
			};
			
			if (settings.tagMode.useActiveFileTags) {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					const cache = this.app.metadataCache.getFileCache(activeFile);
					
					const inlineTags = cache?.tags?.map(tag => normalizeTag(tag.tag)) || [];

					const rawFrontmatterTags = cache?.frontmatter?.tags;
					let frontmatterTags: string[] = [];

					if (rawFrontmatterTags) {
						if (Array.isArray(rawFrontmatterTags)) {
							frontmatterTags = rawFrontmatterTags.map((tag: unknown) => {
								if (typeof tag === 'string') {
									return normalizeTag(tag.trim());
								}
								return '';
							}).filter((tag: string) => tag);
						} else if (typeof rawFrontmatterTags === 'string') {
							frontmatterTags = rawFrontmatterTags
								.split(',')
								.map(tag => normalizeTag(tag.trim()))
								.filter(tag => tag);
						}
					}

					const allTags = [...new Set([...inlineTags, ...frontmatterTags])];

					this.logger.debug('UI', t().uiLabels.ui.activeTags, {
						file: activeFile.basename,
						inlineTags,
						frontmatterTags,
						allTags
					});
					
					if (allTags.length > 0) {
						const firstTag = allTags[0];
						const MAX_TAG_LENGTH = 20;
						
						if (firstTag.length > MAX_TAG_LENGTH) {
							displayText = firstTag.slice(0, MAX_TAG_LENGTH) + '...';
						} else {
							displayText = firstTag;
						}
						
						if (allTags.length > 1) {
							displayText += ` +${allTags.length - 1}`;
						}
						
						fullTagList = allTags.join(', ');
					}
				}
			} else if (settings.tagMode.specifiedTags.length > 0) {
				const normalizedTags = settings.tagMode.specifiedTags.map(normalizeTag);
				const firstTag = normalizedTags[0];
				const MAX_TAG_LENGTH = 20;
				
				if (firstTag.length > MAX_TAG_LENGTH) {
					displayText = firstTag.slice(0, MAX_TAG_LENGTH) + '...';
				} else {
					displayText = firstTag;
				}
				
				if (normalizedTags.length > 1) {
					displayText += ` +${normalizedTags.length - 1}`;
				}
				
				fullTagList = normalizedTags.join(', ');
			}
			
			const iconEl = this.modeDisplayElement.createEl('span', {
				cls: 'mode-display-icon'
			});
			setIcon(iconEl, 'tag');
			
			const textEl = this.modeDisplayElement.createEl('span', {
				cls: 'mode-display-text',
				text: displayText
			});
			
			if (fullTagList) {
				textEl.setAttribute('title', fullTagList);
			}
			
			this.modeDisplayElement.addEventListener('mousedown', (e) => {
				e.preventDefault(); // 포커스 변경 방지
				this.openTagSelector();
			});
		}
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
	 */
	private onSearchToggle(): void {
		if (!this.searchInputContainer) return;

		const isHidden = this.searchInputContainer.style.display === 'none';
		
		if (isHidden) {
			this.searchInputContainer.style.display = 'block';
			
			const input = this.searchInputContainer.querySelector('input');
			if (input) {
				input.focus();
			}
		} else {
			this.searchInputContainer.style.display = 'none';
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
				this.updateModeDisplay();
				this.updateModeToggleIcon();
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
				this.updateModeDisplay();
				this.updateModeToggleIcon();
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
		this.updateModeDisplay();
		this.updateModeToggleIcon();
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
		this.updateModeDisplay();
		this.updateModeToggleIcon();
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
		this.updateModeDisplay();
		this.updateModeToggleIcon();
	}

	/**
	 * 파일 개수 업데이트
	 *
	 * @param displayed - 현재 표시되는 파일 수
	 * @param total - 전체 파일 수
	 */
	public updateFileCount(displayed: number, total: number): void {
		if (!this.fileCountElement) return;

		this.fileCountElement.setText(t().toolbar.fileCount(displayed, total));
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
		this.modeDisplayElement = null;
		this.modeToggleIcon = null;
		this.searchInputContainer = null;
		this.fileCountElement = null;
	}
}

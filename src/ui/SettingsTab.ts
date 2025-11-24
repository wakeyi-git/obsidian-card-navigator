import { App, Notice, PluginSettingTab, Setting, setIcon } from 'obsidian';
import { getAvailableLanguages, getLanguage, getLanguageDisplayName, setLanguageAsync, t, type LanguageSetting } from '../i18n';
import CardNavigatorPlugin from '../main';
import { DebugCategory } from '../types';
import { CardNavigatorView } from '../view';
import { InteractiveCardSettings } from './settings/InteractiveCardSettings';
import { LayoutSettings } from './settings/LayoutSettings';
import { ModeSettings } from './settings/ModeSettings';
import { PresetSettings } from './settings/PresetSettings';
import { SortSettings } from './settings/SortSettings';

/**
 * 설정 탭 타입
 */
type SettingTabType = 'source' | 'grouping' | 'card' | 'layout' | 'interaction' | 'presets' | 'other';

/**
 * CardNavigatorSettingTab
 *
 * 플러그인 설정 UI를 탭 기반으로 제공합니다.
 *
 * 탭 구성:
 * 1. 모드 및 검색 - 폴더/태그/검색 모드 설정
 * 2. 그룹화 및 정렬 - 카드 그룹화, 정렬, 핀 설정
 * 3. 카드 설정 - 카드 내용(데이터) 및 스타일링 (통합)
 * 4. 레이아웃 - 그리드/메이슨리 레이아웃 설정
 * 5. 상호작용 - 네비게이션, 클릭, 드래그 앤 드롭 설정
 * 6. 프리셋 - 프리셋 관리
 * 7. 기타 - 언어, 디버그 모드, 설정 관리
 */
export class CardNavigatorSettingTab extends PluginSettingTab {
    plugin: CardNavigatorPlugin;

    // 설정 섹션 인스턴스
    private modeSettings: ModeSettings;
    private sortSettings: SortSettings;
    private layoutSettings: LayoutSettings;
    private presetSettings: PresetSettings;
    private interactiveCardSettings: InteractiveCardSettings;

    // 현재 활성 탭
    private activeTab: SettingTabType = 'source';

    // 탭 컨테이너들
    private tabContainers: Map<SettingTabType, HTMLElement> = new Map();

    // ⭐ Phase 4.3: Track if rendering is in progress to prevent duplicate renders
    private isRendering = false;

    constructor(app: App, plugin: CardNavigatorPlugin) {
        super(app, plugin);
        this.plugin = plugin;

        // 설정 섹션 초기화
        this.modeSettings = new ModeSettings(plugin);
        this.sortSettings = new SortSettings(plugin);
        this.layoutSettings = new LayoutSettings(plugin);
        this.presetSettings = new PresetSettings(plugin);
        this.interactiveCardSettings = new InteractiveCardSettings(plugin);
    }

    /**
     * 설정 UI를 표시합니다
     *
     * ⭐ Phase 4.3: Ensure translations are loaded before rendering
     */
    display(): void {
        const { containerEl } = this;

        // ⭐ Prevent duplicate rendering if already in progress
        if (this.isRendering) {
            return;
        }

        containerEl.empty();
        containerEl.addClass('card-navigator-settings');

        this.isRendering = true;

        // ⭐ Ensure current language translation is loaded before rendering
        // This prevents crashes when settings tab opens after language change
        const currentLang = getLanguage();
        setLanguageAsync(currentLang).then(() => {
            // Double-check we're still rendering (in case display() was called again)
            if (!this.isRendering) {
                return;
            }
            this.renderSettingsUI(containerEl);
        }).catch(error => {
            console.error('Failed to load translations for settings tab:', error);
            // Fallback: render anyway (deep fallback Proxy will handle missing keys)
            if (this.isRendering) {
                this.renderSettingsUI(containerEl);
            }
        }).finally(() => {
            this.isRendering = false;
        });
    }

    /**
     * 설정 UI를 실제로 렌더링합니다
     */
    private renderSettingsUI(containerEl: HTMLElement): void {
        // 탭 버튼 컨테이너
        const tabBar = containerEl.createDiv({ cls: 'setting-tab-bar' });
        this.createTabButtons(tabBar);

        // 탭 콘텐츠 컨테이너
        const contentContainer = containerEl.createDiv({ cls: 'setting-tab-content' });
        this.createTabContents(contentContainer);

        // 탭 콘텐츠만 초기화 (버튼은 createTabButtons에서 이미 처리됨)
        this.showTabContent(this.activeTab);

        // DOM 렌더링 완료 후 활성 탭 버튼에 포커스
        setTimeout(() => {
            const activeButton = containerEl.querySelector(`.setting-tab-button[data-tab="${this.activeTab}"]`) as HTMLElement;
            if (activeButton) {
                activeButton.focus();
                activeButton.blur();
            }
        }, 0);
    }

    /**
     * 탭 버튼들을 생성합니다
     */
    private createTabButtons(container: HTMLElement): void {
        const t = this.plugin.t();
        const tabs: { id: SettingTabType; label: string; icon: string }[] = [
            { id: 'source', label: t.settingsTab.tabs.source, icon: 'folder-open' },
            { id: 'grouping', label: t.settingsTab.tabs.grouping, icon: 'layers' },
            { id: 'card', label: t.settingsTab.tabs.card, icon: 'credit-card' },
            { id: 'layout', label: t.settingsTab.tabs.layout, icon: 'layout-grid' },
            { id: 'interaction', label: t.settingsTab.tabs.interaction, icon: 'mouse-pointer' },
            { id: 'presets', label: t.settingsTab.tabs.presets, icon: 'save' },
            { id: 'other', label: t.settingsTab.tabs.other, icon: 'more-horizontal' }
        ];

        tabs.forEach(tab => {
            const button = container.createEl('button', {
                cls: 'setting-tab-button'
            });
            button.dataset.tab = tab.id;

            // Lucide 아이콘 추가
            const iconEl = button.createSpan({ cls: 'setting-tab-icon' });
            setIcon(iconEl, tab.icon);

            // 텍스트 추가
            button.createEl('span', { cls: 'setting-tab-label', text: tab.label });

            button.addEventListener('click', () => {
                this.switchTab(tab.id);
            });

            // 현재 활성 탭이면 active 클래스 추가
            if (tab.id === this.activeTab) {
                button.addClass('is-active');
            }
        });

        // ⭐ 마우스 움직임에 따른 자동 스크롤 기능 추가
        this.setupAutoScroll(container);
    }

    /**
     * 마우스 움직임에 따른 탭 바 자동 스크롤을 설정합니다
     */
    private setupAutoScroll(container: HTMLElement): void {
        let animationFrameId: number | null = null;
        let isScrolling = false;
        let currentMouseX = 0;
        let currentContainerRect: DOMRect | null = null;

        // 연속 스크롤 함수
        const continuousScroll = () => {
            if (!isScrolling || !currentContainerRect) {
                animationFrameId = null;
                return;
            }

            const mouseX = currentMouseX - currentContainerRect.left;
            const containerWidth = currentContainerRect.width;

            // 좌우 가장자리 영역 (25% 영역)
            const edgeThreshold = containerWidth * 0.3;

            // 스크롤 가능 여부 확인
            const canScrollLeft = container.scrollLeft > 0;
            const canScrollRight = container.scrollLeft < (container.scrollWidth - containerWidth);

            let scrolled = false;

            // 좌측 가장자리에서 왼쪽으로 스크롤
            if (mouseX < edgeThreshold && canScrollLeft) {
                const intensity = 1 - (mouseX / edgeThreshold); // 0~1
                const scrollSpeed = intensity * 6; // 프레임당 최대 6px
                container.scrollLeft -= scrollSpeed;
                scrolled = true;
            }
            // 우측 가장자리에서 오른쪽으로 스크롤
            else if (mouseX > containerWidth - edgeThreshold && canScrollRight) {
                const intensity = (mouseX - (containerWidth - edgeThreshold)) / edgeThreshold; // 0~1
                const scrollSpeed = intensity * 6; // 프레임당 최대 6px
                container.scrollLeft += scrollSpeed;
                scrolled = true;
            }

            // 스크롤이 발생했으면 다음 프레임 예약
            if (scrolled && isScrolling) {
                animationFrameId = requestAnimationFrame(continuousScroll);
            } else {
                animationFrameId = null;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            currentMouseX = e.clientX;
            currentContainerRect = container.getBoundingClientRect();

            const mouseX = currentMouseX - currentContainerRect.left;
            const containerWidth = currentContainerRect.width;
            const edgeThreshold = containerWidth * 0.25;

            // 가장자리 영역에 있는지 확인
            const isInScrollZone = mouseX < edgeThreshold || mouseX > containerWidth - edgeThreshold;

            if (isInScrollZone && !isScrolling) {
                // 스크롤 시작
                isScrolling = true;
                if (animationFrameId === null) {
                    animationFrameId = requestAnimationFrame(continuousScroll);
                }
            } else if (!isInScrollZone && isScrolling) {
                // 스크롤 중지
                isScrolling = false;
            }
        };

        const handleMouseLeave = () => {
            // 마우스가 컨테이너를 벗어나면 스크롤 중지
            isScrolling = false;
            currentContainerRect = null;
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);
    }

    /**
     * 탭 콘텐츠들을 생성합니다
     */
    private createTabContents(container: HTMLElement): void {
        // 1. 모드 및 검색 탭 (폴더/태그/검색 모드)
        const sourceTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.modeSettings.render(sourceTab);
        this.addSearchSettings(sourceTab);
        this.tabContainers.set('source', sourceTab);

        // 2. 그룹화 및 정렬 탭
        const groupingTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.addGroupingSettings(groupingTab);
        this.addPinSettings(groupingTab, this.plugin.t());
        this.sortSettings.render(groupingTab);
        this.tabContainers.set('grouping', groupingTab);

        // 3. 카드 설정 탭 (내용 + 스타일링 통합)
        const cardTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.interactiveCardSettings.render(cardTab);
        this.tabContainers.set('card', cardTab);

        // 4. 레이아웃 탭
        const layoutTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.layoutSettings.render(layoutTab);
        this.tabContainers.set('layout', layoutTab);

        // 5. 상호작용 탭 (네비게이션, 클릭, 드래그 앤 드롭)
        const interactionTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.addScrollBehaviorSettings(interactionTab);
        this.addTagClickActionSettings(interactionTab);
        this.addDragDropSettings(interactionTab);
        this.tabContainers.set('interaction', interactionTab);

        // 6. 프리셋 탭
        const presetsTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.presetSettings.render(presetsTab);
        this.tabContainers.set('presets', presetsTab);

        // 7. 기타 탭 (언어, 성능, 디버그, 설정 관리)
        const otherTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.addLanguageSettings(otherTab);
        this.addPerformanceSettings(otherTab);
        this.addDebugSettings(otherTab);
        this.addResetButton(otherTab);
        this.tabContainers.set('other', otherTab);
    }

    /**
     * 탭 콘텐츠만 표시합니다 (버튼 상태 변경 없음)
     */
    private showTabContent(tabId: SettingTabType): void {
        // 모든 탭 콘텐츠 숨기기
        this.tabContainers.forEach((container) => {
            container.style.display = 'none';
        });

        // 선택한 탭 콘텐츠만 표시
        const selectedContainer = this.tabContainers.get(tabId);
        if (selectedContainer) {
            selectedContainer.style.display = 'block';
        }
    }

    /**
     * 탭을 전환합니다
     */
    private switchTab(tabId: SettingTabType): void {
        this.activeTab = tabId;

        // 모든 탭 버튼의 active 클래스 제거 및 선택된 탭에 추가
        const buttons = this.containerEl.querySelectorAll('.setting-tab-button');
        buttons.forEach(button => {
            button.removeClass('is-active');
            if ((button as HTMLElement).dataset.tab === tabId) {
                button.addClass('is-active');
            }
        });

        this.showTabContent(tabId);
    }

    /**
     * 언어 설정을 추가합니다
     */
    private addLanguageSettings(containerEl: HTMLElement): void {
        const t = this.plugin.t();

        // 섹션 헤더
        new Setting(containerEl).setHeading().setName(t.settings.language.name);

        const availableLanguages = getAvailableLanguages();

        new Setting(containerEl)
            .setName(t.settings.language.name)
            .setDesc(t.settings.language.description)
            .addDropdown(dropdown => {
                // Add auto option
                dropdown.addOption('auto', 'Auto');

                // Add available languages
                availableLanguages.forEach(lang => {
                    dropdown.addOption(lang, getLanguageDisplayName(lang));
                });

                dropdown
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value: string) => {
                        this.plugin.settings.language = value as LanguageSetting;
                        await this.plugin.saveSettings();
                        // Refresh the settings UI to apply new language
                        this.display();
                        new Notice('Language changed. Please reload the plugin for full effect.');
                    });
            });
    }

    /**
     * 그룹화 설정을 추가합니다
     */
    private addGroupingSettings(containerEl: HTMLElement): void {
        const t = this.plugin.t();

        // 섹션 헤더
        new Setting(containerEl).setHeading().setName(t.settings.grouping.title);

        // 그룹화 활성화
        new Setting(containerEl)
            .setName(t.settings.grouping.enableGrouping)
            .setDesc(t.settings.grouping.enableGroupingDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.grouping.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.grouping.enabled = value;
                    // 그룹화를 활성화하면서 기준이 'none'이면 기본값으로 'folder' 설정
                    if (value && this.plugin.settings.grouping.criteria === 'none') {
                        this.plugin.settings.grouping.criteria = 'folder';
                    }
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                    this.display();
                })
            );

        if (!this.plugin.settings.grouping.enabled) {
            return;
        }

        // 그룹화 기준 ('none' 옵션 제거)
        new Setting(containerEl)
            .setName(t.settings.grouping.groupBy)
            .setDesc(t.settings.grouping.groupByDescription)
            .addDropdown(dropdown => dropdown
                .addOption('folder', t.settings.grouping.criteria.folder)
                .addOption('tag', t.settings.grouping.criteria.tag)
                .addOption('date-year', t.settings.grouping.criteria.dateYear)
                .addOption('date-month', t.settings.grouping.criteria.dateMonth)
                .addOption('date-week', t.settings.grouping.criteria.dateWeek)
                .addOption('property', t.settings.grouping.criteria.property)
                .addOption('size', t.settings.grouping.criteria.size)
                .addOption('first-letter', t.settings.grouping.criteria.firstLetter)
                .setValue(this.plugin.settings.grouping.criteria === 'none' ? 'folder' : this.plugin.settings.grouping.criteria)
                .onChange(async (value: import('../types').GroupCriteria) => {
                    this.plugin.settings.grouping.criteria = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                    this.display();
                })
            );

        // 날짜 기준 (date-* 타입일 때만 표시)
        if (this.plugin.settings.grouping.criteria.startsWith('date-')) {
            new Setting(containerEl)
                .setName(t.settings.grouping.dateBasis)
                .setDesc(t.settings.grouping.dateBasisDescription)
                .addDropdown(dropdown => dropdown
                    .addOption('created', t.settings.grouping.dateBasisOptions.created)
                    .addOption('modified', t.settings.grouping.dateBasisOptions.modified)
                    .setValue(this.plugin.settings.grouping.dateBasis)
                    .onChange(async (value: 'created' | 'modified') => {
                        this.plugin.settings.grouping.dateBasis = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshView();
                    })
                );
        }

        // 태그 모드 (tag 타입일 때만 표시)
        if (this.plugin.settings.grouping.criteria === 'tag') {
            new Setting(containerEl)
                .setName(t.settings.grouping.tagMode)
                .setDesc(t.settings.grouping.tagModeDescription)
                .addDropdown(dropdown => dropdown
                    .addOption('first', t.settings.grouping.tagModeOptions.first)
                    .addOption('all', t.settings.grouping.tagModeOptions.all)
                    .setValue(this.plugin.settings.grouping.tagMode)
                    .onChange(async (value: 'first' | 'all') => {
                        this.plugin.settings.grouping.tagMode = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshView();
                    })
                );
        }

        // 속성명 (property 타입일 때만 표시)
        if (this.plugin.settings.grouping.criteria === 'property') {
            new Setting(containerEl)
                .setName(t.settings.grouping.propertyName)
                .setDesc(t.settings.grouping.propertyNameDescription)
                .addText(text => text
                    .setPlaceholder(t.settings.grouping.propertyNamePlaceholder)
                    .setValue(this.plugin.settings.grouping.propertyName || '')
                    .onChange(async (value) => {
                        this.plugin.settings.grouping.propertyName = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshView();
                    })
                );
        }

        // 폴더 계층 구조 (folder 타입일 때만 표시)
        if (this.plugin.settings.grouping.criteria === 'folder') {
            new Setting(containerEl)
                .setName(t.settings.grouping.showFullFolderPath)
                .setDesc(t.settings.grouping.showFullFolderPathDescription)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.grouping.folderHierarchical)
                    .onChange(async (value) => {
                        this.plugin.settings.grouping.folderHierarchical = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshView();
                    })
                );
        }

        // 그룹 정렬
        new Setting(containerEl)
            .setName(t.settings.grouping.sortGroupsBy)
            .setDesc(t.settings.grouping.sortGroupsByDescription)
            .addDropdown(dropdown => dropdown
                .addOption('name', t.settings.grouping.sortGroupsOptions.name)
                .addOption('file-count', t.settings.grouping.sortGroupsOptions.fileCount)
                .addOption('latest-file', t.settings.grouping.sortGroupsOptions.latestFile)
                .addOption('hierarchy', t.settings.grouping.sortGroupsOptions.hierarchy)
                .setValue(this.plugin.settings.grouping.groupSort)
                .onChange(async (value: import('../types').GroupSortCriteria) => {
                    this.plugin.settings.grouping.groupSort = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // 그룹 정렬 순서
        new Setting(containerEl)
            .setName(t.settings.grouping.groupSortOrder)
            .setDesc(t.settings.grouping.groupSortOrderDescription)
            .addDropdown(dropdown => dropdown
                .addOption('asc', t.settings.grouping.groupSortOrderOptions.asc)
                .addOption('desc', t.settings.grouping.groupSortOrderOptions.desc)
                .setValue(this.plugin.settings.grouping.groupSortOrder)
                .onChange(async (value: 'asc' | 'desc') => {
                    this.plugin.settings.grouping.groupSortOrder = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );
    }

    /**
     * 핀 설정을 추가합니다
     */
    private addPinSettings(containerEl: HTMLElement, t: ReturnType<typeof this.plugin.t>): void {
        // 구분선
        new Setting(containerEl)
            .setName(t.settingsTab.pinSettings?.title || 'Pin Settings')
            .setHeading();

        // 핀된 파일 항상 표시 토글
        new Setting(containerEl)
            .setName(t.settingsTab.pinSettings?.alwaysShowPinned || 'Always show pinned files')
            .setDesc(t.settingsTab.pinSettings?.alwaysShowPinnedDescription || 'Show pinned files even when scrolling or changing modes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.alwaysShowPinnedFiles || false)
                .onChange(async (value) => {
                    this.plugin.settings.alwaysShowPinnedFiles = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // 핀된 파일을 별도 그룹으로 표시
        new Setting(containerEl)
            .setName(t.settings.grouping.showPinnedAsGroup)
            .setDesc(t.settings.grouping.showPinnedAsGroupDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.grouping.showPinnedAsGroup ?? true)
                .onChange(async (value) => {
                    this.plugin.settings.grouping.showPinnedAsGroup = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );
    }

    /**
     * 스크롤 동작 설정을 추가합니다
     */
    private addScrollBehaviorSettings(containerEl: HTMLElement): void {
        // 섹션 헤더 (Obsidian 표준 스타일)
        new Setting(containerEl).setHeading().setName(t().settingsTab.scrollBehavior.title);

        new Setting(containerEl)
            .setName(t().settingsTab.scrollBehavior.name)
            .setDesc(t().settingsTab.scrollBehavior.description)
            .addDropdown(dropdown => dropdown
                .addOption('nearest', t().settingsTab.scrollBehavior.nearest)
                .addOption('center', t().settingsTab.scrollBehavior.center)
                .addOption('none', t().settingsTab.scrollBehavior.none)
                .setValue(this.plugin.settings.scrollBehavior)
                .onChange(async (value: 'center' | 'nearest' | 'none') => {
                    this.plugin.settings.scrollBehavior = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    /**
     * 검색 설정을 추가합니다
     */
    private addSearchSettings(containerEl: HTMLElement): void {
        // 섹션 헤더
        new Setting(containerEl).setHeading().setName(t().settings.searchSection.name);

        new Setting(containerEl)
            .setName(t().settings.enableFuzzySearch.name)
            .setDesc(t().settings.enableFuzzySearch.description)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFuzzySearch)
                .onChange(async (value) => {
                    this.plugin.settings.enableFuzzySearch = value;
                    await this.plugin.saveSettings();
                    // Show/hide threshold setting
                    this.display();
                })
            );

        if (this.plugin.settings.enableFuzzySearch) {
            new Setting(containerEl)
                .setName(t().settings.fuzzySearchThreshold.name)
                .setDesc(t().settings.fuzzySearchThreshold.description)
                .addSlider(slider => slider
                    .setLimits(0, 1, 0.05)
                    .setValue(this.plugin.settings.fuzzySearchThreshold)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.fuzzySearchThreshold = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // 검색어 하이라이트 설정
        new Setting(containerEl)
            .setName(t().settings.enableSearchHighlight.name)
            .setDesc(t().settings.enableSearchHighlight.description)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSearchHighlight ?? true)
                .onChange(async (value) => {
                    this.plugin.settings.enableSearchHighlight = value;
                    await this.plugin.saveSettings();
                })
            );

        // 대소문자 구분 검색 설정
        new Setting(containerEl)
            .setName(t().settings.caseSensitiveSearch.name)
            .setDesc(t().settings.caseSensitiveSearch.description)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.caseSensitiveSearch ?? false)
                .onChange(async (value) => {
                    this.plugin.settings.caseSensitiveSearch = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    /**
     * 태그 클릭 동작 설정을 추가합니다
     */
    private addTagClickActionSettings(containerEl: HTMLElement): void {
        // 섹션 헤더
        new Setting(containerEl).setHeading().setName(t().settingsTab.tagClickAction.title);

        new Setting(containerEl)
            .setName(t().settingsTab.tagClickAction.name)
            .setDesc(t().settingsTab.tagClickAction.description)
            .addDropdown(dropdown => dropdown
                .addOption('plugin-search', t().settingsTab.tagClickAction.pluginSearch)
                .addOption('obsidian-search', t().settingsTab.tagClickAction.obsidianSearch)
                .setValue(this.plugin.settings.tagClickAction)
                .onChange(async (value: 'obsidian-search' | 'plugin-search') => {
                    this.plugin.settings.tagClickAction = value;
                    await this.plugin.saveSettings();
                    const action = value === 'plugin-search' ? t().settingsTab.tagClickAction.pluginSearch : t().settingsTab.tagClickAction.obsidianSearch;
                    new Notice(t().settingsTab.tagClickAction.notice(action));
                })
            );
    }

    /**
     * 드래그 앤 드롭 설정을 추가합니다
     */
    private addDragDropSettings(containerEl: HTMLElement): void {
        // 섹션 헤더
        new Setting(containerEl).setHeading().setName(t().settingsTab.dragDrop.title);

        new Setting(containerEl)
            .setName(t().settingsTab.dragDrop.contentType)
            .setDesc(t().settingsTab.dragDrop.contentTypeDescription)
            .addDropdown(dropdown => dropdown
                .addOption('link', t().settingsTab.dragDrop.link)
                .addOption('full-content', t().settingsTab.dragDrop.fullContent)
                .setValue(this.plugin.settings.dragDrop.contentType)
                .onChange(async (value: 'link' | 'full-content') => {
                    this.plugin.settings.dragDrop.contentType = value;
                    await this.plugin.saveSettings();
                    // UI 업데이트
                    this.display();
                })
            );

        // '파일 내용'을 선택한 경우에만 추가 옵션 표시
        if (this.plugin.settings.dragDrop.contentType === 'full-content') {
            // 설명 텍스트
            const descEl = containerEl.createDiv({ cls: 'setting-item-description' });
            descEl.setText(t().settingsTab.dragDrop.optionsDescription);
            descEl.style.marginTop = '10px';
            descEl.style.marginBottom = '10px';
            descEl.style.fontSize = '0.9em';
            descEl.style.color = 'var(--text-muted)';

            // 프론트매터 포함 여부
            new Setting(containerEl)
                .setName(t().settingsTab.dragDrop.includeFrontmatter)
                .setDesc(t().settingsTab.dragDrop.includeFrontmatterDescription)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.dragDrop.fullContentOptions.includeFrontmatter)
                    .onChange(async (value) => {
                        this.plugin.settings.dragDrop.fullContentOptions.includeFrontmatter = value;
                        await this.plugin.saveSettings();
                    })
                );

            // 최대 길이 제한 활성화
            new Setting(containerEl)
                .setName(t().settingsTab.dragDrop.enableLengthLimit)
                .setDesc(t().settingsTab.dragDrop.enableLengthLimitDescription)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.dragDrop.fullContentOptions.enableLengthLimit)
                    .onChange(async (value) => {
                        this.plugin.settings.dragDrop.fullContentOptions.enableLengthLimit = value;
                        await this.plugin.saveSettings();
                        // UI 업데이트
                        this.display();
                    })
                );

            // 최대 글자 수 (최대 길이 제한이 활성화되었을 때만 표시)
            if (this.plugin.settings.dragDrop.fullContentOptions.enableLengthLimit) {
                new Setting(containerEl)
                    .setName(t().settingsTab.dragDrop.maxLength)
                    .setDesc(t().settingsTab.dragDrop.maxLengthDescription)
                    .addText(text => text
                        .setValue(String(this.plugin.settings.dragDrop.fullContentOptions.maxLength))
                        .setPlaceholder('1000')
                        .onChange(async (value) => {
                            const num = parseInt(value);
                            if (!isNaN(num) && num > 0) {
                                this.plugin.settings.dragDrop.fullContentOptions.maxLength = num;
                                await this.plugin.saveSettings();
                            }
                        })
                    );
            }
        }
    }

    /**
     * 성능 설정을 추가합니다
     *
     * ⭐ Section 13.2: 증분 렌더링 청크 크기 조정
     */
    private addPerformanceSettings(containerEl: HTMLElement): void {
        const trans = t().settingsTab.performanceSettings;

        // 섹션 헤더
        new Setting(containerEl).setHeading().setName(trans.title);

        // 증분 렌더링 청크 크기
        new Setting(containerEl)
            .setName(trans.chunkSize)
            .setDesc(trans.chunkSizeDescription)
            .addSlider(slider => slider
                .setLimits(5, 50, 5)
                .setValue(this.plugin.settings.incrementalRenderChunkSize || 20)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.incrementalRenderChunkSize = value;
                    await this.plugin.saveSettings();
                })
            );

        // 캐시 통계
        this.addCacheStatistics(containerEl);
    }

    /**
     * 캐시 통계를 추가합니다
     */
    private addCacheStatistics(containerEl: HTMLElement): void {
        const trans = t().settingsTab.cacheStatistics;

        // 섹션 헤더
        new Setting(containerEl)
            .setHeading()
            .setName(trans.title);

        // 통계 컨테이너
        const statsContainer = containerEl.createDiv({ cls: 'cache-stats-container' });
        statsContainer.style.padding = '10px';
        statsContainer.style.backgroundColor = 'var(--background-secondary)';
        statsContainer.style.borderRadius = '6px';
        statsContainer.style.marginBottom = '20px';

        // ⭐ Fix: Check all leaves of CardNavigatorView type, not just active view
        const leaves = this.app.workspace.getLeavesOfType('card-navigator-view');
        const viewLeaf = leaves.length > 0 ? leaves[0] : null;
        const view = viewLeaf ? (viewLeaf.view as CardNavigatorView) : null;

        if (!view) {
            statsContainer.createEl('p', {
                text: trans.viewNotOpen,
                cls: 'setting-item-description'
            });
            return;
        }

        // 캐시 통계 가져오기
        const stats = view.searchEngine?.getCacheStats();
        const cacheSize = view.searchEngine?.size;

        if (!stats || !cacheSize) {
            statsContainer.createEl('p', {
                text: trans.notAvailable,
                cls: 'setting-item-description'
            });
            return;
        }

        // 통계 표시
        const createStatRow = (label: string, value: string | number) => {
            const row = statsContainer.createDiv({ cls: 'cache-stat-row' });
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.padding = '4px 0';

            row.createEl('span', { text: label, cls: 'cache-stat-label' });
            row.createEl('strong', { text: String(value), cls: 'cache-stat-value' });
        };

        createStatRow(trans.totalRequests, stats.totalRequests);
        createStatRow(trans.hitRate, `${(stats.hitRate * 100).toFixed(1)}%`);

        statsContainer.createEl('div', { cls: 'cache-stat-divider' })
            .style.borderTop = '1px solid var(--background-modifier-border)';

        createStatRow(trans.l1Hits, stats.l1Hits);
        createStatRow(trans.l2Hits, stats.l2Hits);
        createStatRow(trans.l3Hits, stats.l3Hits);
        createStatRow(trans.misses, stats.misses);

        statsContainer.createEl('div', { cls: 'cache-stat-divider' })
            .style.borderTop = '1px solid var(--background-modifier-border)';

        createStatRow(trans.l1Size, `${cacheSize.l1} / 10`);
        createStatRow(trans.l2Size, `${cacheSize.l2} / 40`);
        createStatRow(trans.totalSize, `${cacheSize.total} / 50`);

        // 캐시 클리어 버튼
        new Setting(containerEl)
            .setName(trans.clearCache)
            .setDesc(trans.clearCacheDescription)
            .addButton(button => button
                .setButtonText(trans.clearCacheButton)
                .onClick(() => {
                    view.searchEngine?.clearCache();
                    new Notice(trans.cacheCleared);
                    // UI 새로고침
                    this.display();
                })
            );
    }

    /**
     * 디버그 모드 설정을 추가합니다
     */
    private addDebugSettings(containerEl: HTMLElement): void {
        const trans = t().settingsTab.debugMode;

        // 섹션 헤더
        new Setting(containerEl).setHeading().setName(trans.title);

        // 디버그 모드 활성화/비활성화
        new Setting(containerEl)
            .setName(trans.enable)
            .setDesc(trans.enableDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debug.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.debug.enabled = value;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        // 디버그 모드가 활성화되어 있을 때만 카테고리 설정 표시
        if (this.plugin.settings.debug.enabled) {
            // 카테고리 설명
            const descEl = containerEl.createDiv({ cls: 'setting-item-description' });
            descEl.setText(trans.categoriesDescription);
            descEl.style.marginBottom = '10px';
            descEl.style.fontSize = '0.9em';
            descEl.style.color = 'var(--text-muted)';

            // 카테고리별 설정
            const categoryMap: Record<DebugCategory, keyof typeof trans.categories> = {
                'Plugin': 'plugin',
                'View': 'view',
                'Layout': 'layout',
                'Card': 'card',
                'Search': 'search',
                'Filter': 'filter',
                'Navigation': 'navigation',
                'Preset': 'preset',
                'Sort': 'sort',
                'Selection': 'selection',
                'DragDrop': 'dragDrop',
                'Mode': 'mode',
                'Settings': 'settings',
                'Grouping': 'grouping',
                'Cache': 'cache',
                'Event': 'event',
                'UI': 'ui',
                'Performance': 'performance'
            };

            const categories: DebugCategory[] = Object.keys(categoryMap) as DebugCategory[];

            categories.forEach(category => {
                const catKey = categoryMap[category];
                const catInfo = trans.categories[catKey];
                const currentValue = this.plugin.settings.debug.categories?.[category] ?? true;

                new Setting(containerEl)
                    .setName(`[${category}] ${catInfo.label}`)
                    .setDesc(catInfo.description)
                    .addToggle(toggle => toggle
                        .setValue(currentValue)
                        .onChange(async (value) => {
                            // categories가 undefined면 빈 객체로 초기화
                            if (!this.plugin.settings.debug.categories) {
                                this.plugin.settings.debug.categories = {};
                            }
                            this.plugin.settings.debug.categories[category] = value;
                            await this.plugin.saveSettings();
                        })
                    );
            });

            // 전체 선택/해제 버튼
            new Setting(containerEl)
                .setName(trans.allCategories)
                .setDesc(trans.allCategoriesDescription)
                .addButton(button => button
                    .setButtonText(trans.selectAll)
                    .onClick(async () => {
                        if (!this.plugin.settings.debug.categories) {
                            this.plugin.settings.debug.categories = {};
                        }
                        categories.forEach(category => {
                            this.plugin.settings.debug.categories![category] = true;
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    })
                )
                .addButton(button => button
                    .setButtonText(trans.deselectAll)
                    .onClick(async () => {
                        if (!this.plugin.settings.debug.categories) {
                            this.plugin.settings.debug.categories = {};
                        }
                        categories.forEach(category => {
                            this.plugin.settings.debug.categories![category] = false;
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    })
                );
        }
    }

    /**
     * 설정 초기화 버튼을 추가합니다
     */
    private addResetButton(containerEl: HTMLElement): void {
        const trans = t().settingsTab.settingsManagement;

        // 섹션 헤더 (Obsidian 표준 스타일)
        new Setting(containerEl).setHeading().setName(trans.title);

        new Setting(containerEl)
            .setName(trans.reset)
            .setDesc(trans.resetDescription)
            .addButton(button => button
                .setButtonText(trans.resetButton)
                .setWarning()
                .onClick(async () => {
                    if (confirm(trans.resetConfirm)) {
                        this.plugin.logger.debug('Settings', t().settingsAdditional.settingsResetStart);

                        // 1. 설정 초기화 (프리셋과 매핑도 기본값인 빈 배열로)
                        await this.plugin.settingsManager.resetSettings();
                        this.plugin.logger.debug('Settings', 'settingsManager.resetSettings() 완료');

                        // 2. PresetManager 상태 리셋 (currentPresetId 초기화)
                        this.plugin.presetManager.reset();
                        this.plugin.logger.debug('Settings', 'presetManager.reset() 완료');

                        // 3. 스타일 다시 적용 (기본 스타일로)
                        const defaultSettings = this.plugin.settingsManager.getSettings();
                        this.plugin.styleManager.applyStyles(defaultSettings);
                        this.plugin.logger.debug('Settings', 'styleManager.applyStyles() 완료');

                        // 4. 뷰 새로고침
                        this.plugin.refreshView();
                        this.plugin.logger.debug('Settings', 'refreshView() 완료');

                        // 5. 설정 UI 새로고침
                        this.display();
                        this.plugin.logger.debug('Settings', 'display() 완료');

                        this.plugin.logger.debug('Settings', t().settingsAdditional.settingsResetComplete);
                        new Notice(trans.resetSuccess);
                    }
                })
            );

        // 설정 내보내기/가져오기
        new Setting(containerEl)
            .setName(trans.export)
            .setDesc(trans.exportDescription)
            .addButton(button => button
                .setButtonText(trans.exportButton)
                .onClick(() => {
                    this.exportSettings();
                })
            );

        new Setting(containerEl)
            .setName(trans.import)
            .setDesc(trans.importDescription)
            .addButton(button => button
                .setButtonText(trans.importButton)
                .onClick(() => {
                    this.importSettings();
                })
            );
    }

    /**
     * 설정을 JSON으로 내보냅니다
     */
    private exportSettings(): void {
        const settings = this.plugin.settings;
        const json = JSON.stringify(settings, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'card-navigator-settings.json';
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * JSON 파일에서 설정을 가져옵니다
     */
    private importSettings(): void {
        const trans = t().settingsTab.settingsManagement;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const settings = JSON.parse(text);

                // 설정 검증 (간단한 타입 체크)
                if (typeof settings === 'object' && settings !== null) {
                    Object.assign(this.plugin.settings, settings);
                    await this.plugin.saveSettings();
                    this.plugin.refreshView();
                    this.display();
                    alert(trans.importSuccess);
                } else {
                    throw new Error(trans.importInvalid);
                }
            } catch (error) {
                this.plugin.logger.error('Settings', t().settingsAdditional.settingsImportError, error);
                alert(trans.importError);
            }
        });

        input.click();
    }

}

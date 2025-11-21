import { App, PluginSettingTab, Setting, setIcon, Notice } from 'obsidian';
import CardNavigatorPlugin from '../main';
import { DebugCategory } from '../types';
import { RenderingSettings } from './settings/RenderingSettings';
import { InteractiveLayoutSettings } from './settings/InteractiveLayoutSettings';
import { ModeSettings } from './settings/ModeSettings';
import { SortSettings } from './settings/SortSettings';
import { PresetSettings } from './settings/PresetSettings';
import { InteractiveCardSettings } from './settings/InteractiveCardSettings';
import { getAvailableLanguages, getLanguageDisplayName, type LanguageSetting, t } from '../i18n';

/**
 * 설정 탭 타입
 */
type SettingTabType = 'mode' | 'card' | 'layout' | 'presets' | 'other';

/**
 * CardNavigatorSettingTab
 * 
 * 플러그인 설정 UI를 탭 기반으로 제공합니다.
 * 
 * 탭 구성:
 * 1. 모드 & 정렬 - 폴더/태그 모드, 정렬 설정
 * 2. 카드 설정 - 내용, 렌더링, 스타일
 * 3. 레이아웃 - 그리드/메이슨리 레이아웃 설정
 * 4. 프리셋 - 프리셋 관리
 * 5. 기타 - 설정 초기화 등
 */
export class CardNavigatorSettingTab extends PluginSettingTab {
    plugin: CardNavigatorPlugin;
    
    // 설정 섹션 인스턴스
    private modeSettings: ModeSettings;
    private sortSettings: SortSettings;
    private renderingSettings: RenderingSettings;
    private layoutSettings: InteractiveLayoutSettings;
    private presetSettings: PresetSettings;
    private interactiveCardSettings: InteractiveCardSettings;

    // 현재 활성 탭
    private activeTab: SettingTabType = 'mode';

    // 탭 컨테이너들
    private tabContainers: Map<SettingTabType, HTMLElement> = new Map();

    constructor(app: App, plugin: CardNavigatorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        
        // 설정 섹션 초기화
        this.modeSettings = new ModeSettings(plugin);
        this.sortSettings = new SortSettings(plugin);
        this.renderingSettings = new RenderingSettings(plugin);
        this.layoutSettings = new InteractiveLayoutSettings(plugin);
        this.presetSettings = new PresetSettings(plugin);
        this.interactiveCardSettings = new InteractiveCardSettings(plugin);
    }

    /**
     * 설정 UI를 표시합니다
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('card-navigator-settings');

        // 탭 버튼 컨테이너
        const tabBar = containerEl.createDiv({ cls: 'setting-tab-bar' });
        this.createTabButtons(tabBar);

        // 탭 콘텐츠 컨테이너
        const contentContainer = containerEl.createDiv({ cls: 'setting-tab-content' });
        this.createTabContents(contentContainer);

        // 첫 번째 탭 활성화
        this.switchTab(this.activeTab);
    }

    /**
     * 탭 버튼들을 생성합니다
     */
    private createTabButtons(container: HTMLElement): void {
        const tabs: { id: SettingTabType; label: string; icon: string }[] = [
            { id: 'mode', label: t().settingsTab.tabs.mode, icon: 'settings' },
            { id: 'card', label: t().settingsTab.tabs.card, icon: 'credit-card' },
            { id: 'layout', label: t().settingsTab.tabs.layout, icon: 'layout-grid' },
            { id: 'presets', label: t().settingsTab.tabs.presets, icon: 'save' },
            { id: 'other', label: t().settingsTab.tabs.other, icon: 'more-horizontal' }
        ];

        tabs.forEach(tab => {
            const button = container.createEl('button', {
                cls: 'setting-tab-button'
            });

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
    }

    /**
     * 탭 콘텐츠들을 생성합니다
     */
    private createTabContents(container: HTMLElement): void {
        // 1. 모드 & 정렬 탭
        const modeTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.modeSettings.render(modeTab);
        this.sortSettings.render(modeTab);
        this.tabContainers.set('mode', modeTab);

        // 2. 카드 설정 탭
        const cardTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.interactiveCardSettings.render(cardTab);
        this.tabContainers.set('card', cardTab);

        // 3. 레이아웃 탭
        const layoutTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.layoutSettings.render(layoutTab);
        this.tabContainers.set('layout', layoutTab);

        // 4. 프리셋 탭
        const presetsTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.presetSettings.render(presetsTab);
        this.tabContainers.set('presets', presetsTab);

        // 5. 기타 탭
        const otherTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.addLanguageSettings(otherTab);
        this.addScrollBehaviorSettings(otherTab);
        this.addTagClickActionSettings(otherTab);
        this.addDragDropSettings(otherTab);
        this.addDebugSettings(otherTab);
        this.addResetButton(otherTab);
        this.tabContainers.set('other', otherTab);
    }

    /**
     * 탭을 전환합니다
     */
    private switchTab(tabId: SettingTabType): void {
        this.activeTab = tabId;

        // 모든 탭 버튼의 active 클래스 제거
        const buttons = this.containerEl.querySelectorAll('.setting-tab-button');
        buttons.forEach(button => button.removeClass('is-active'));

        // 클릭한 탭 버튼에 active 클래스 추가
        const tabButtons = Array.from(buttons);
        const tabOrder: SettingTabType[] = ['mode', 'card', 'layout', 'presets', 'other'];
        const index = tabOrder.indexOf(tabId);
        if (index !== -1 && tabButtons[index]) {
            tabButtons[index].addClass('is-active');
        }

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
     * 언어 설정을 추가합니다
     */
    private addLanguageSettings(containerEl: HTMLElement): void {
        // 섹션 헤더
        new Setting(containerEl).setHeading().setName('Language / 언어');

        const availableLanguages = getAvailableLanguages();

        new Setting(containerEl)
            .setName('Display Language / 표시 언어')
            .setDesc('Select the display language for the plugin interface / 플러그인 인터페이스에 사용할 언어를 선택하세요')
            .addDropdown(dropdown => {
                // Add auto option
                dropdown.addOption('auto', 'Auto (Follow Obsidian / 옵시디언 설정 따르기)');

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

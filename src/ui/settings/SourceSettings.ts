import { Setting } from 'obsidian';
import { t } from '../../i18n';
import CardNavigatorPlugin from '../../main';
import { CardNavigatorSettings } from '../../types';
import type { CardNavigatorSettingTab } from '../SettingsTab';

/**
 * SourceSettings
 *
 * 소스 탭 설정 UI (모드 + 검색 설정)
 */
export class SourceSettings {
    constructor(
        private plugin: CardNavigatorPlugin,
        private settingsTab: CardNavigatorSettingTab
    ) {}

    /**
     * 소스 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.addModeSettings(containerEl);
        this.addSearchSettings(containerEl);
    }

    /**
     * 모드 설정을 추가합니다
     */
    private addModeSettings(containerEl: HTMLElement): void {
        const trans = t().settingsTab.modeSettings;
        const settings = this.plugin.settingsManager.getSettings();

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        // 모드 선택 (폴더 / 태그)
        new Setting(itemsEl)
            .setName(trans.mode)
            .setDesc(trans.modeDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('folder', trans.modeOptions.folder)
                    .addOption('tag', trans.modeOptions.tag)
                    .setValue(settings.currentMode)
                    .onChange(async (value) => {
                        settings.currentMode = value as 'folder' | 'tag';
                        await this.plugin.saveSettings();
                        this.settingsTab.display();
                    });
            });

        // 폴더 모드 설정
        if (settings.currentMode === 'folder') {
            this.addFolderModeSettings(itemsEl, settings);
        }

        // 태그 모드 설정
        if (settings.currentMode === 'tag') {
            this.addTagModeSettings(itemsEl, settings);
        }
    }

    /**
     * 폴더 모드 설정을 추가합니다
     * @param itemsEl - setting-items 컨테이너
     */
    private addFolderModeSettings(itemsEl: HTMLElement, settings: CardNavigatorSettings): void {
        const trans = t().settingsTab.modeSettings;
        const folderSettings = settings.folderMode;

        // 폴더 선택 방식
        new Setting(itemsEl)
            .setName(trans.folderSelection)
            .setDesc(trans.folderSelectionDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('active', trans.folderSelectionOptions.active)
                    .addOption('specific', trans.folderSelectionOptions.specific)
                    .setValue(folderSettings.useActiveFolder ? 'active' : 'specific')
                    .onChange(async (value) => {
                        folderSettings.useActiveFolder = (value === 'active');
                        await this.plugin.saveSettings();
                        this.settingsTab.display();
                    });
            });

        // 폴더 지정 입력 (useActiveFolder가 false일 때만 표시)
        if (!folderSettings.useActiveFolder) {
            new Setting(itemsEl)
                .setName(trans.specifyFolder)
                .setDesc(trans.specifyFolderDescription)
                .addText(text => text
                    .setPlaceholder(trans.folderPathPlaceholder)
                    .setValue(folderSettings.specifiedFolder || '')
                    .onChange(async (value) => {
                        folderSettings.specifiedFolder = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // 하위 폴더 포함 토글
        new Setting(itemsEl)
            .setName(trans.includeSubfolders)
            .setDesc(trans.includeSubfoldersDescription)
            .addToggle(toggle => toggle
                .setValue(folderSettings.includeSubfolders)
                .onChange(async (value) => {
                    folderSettings.includeSubfolders = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    /**
     * 태그 모드 설정을 추가합니다
     * @param itemsEl - setting-items 컨테이너
     */
    private addTagModeSettings(itemsEl: HTMLElement, settings: CardNavigatorSettings): void {
        const trans = t().settingsTab.modeSettings;
        const tagSettings = settings.tagMode;

        // 태그 선택 방식
        new Setting(itemsEl)
            .setName(trans.tagSelection)
            .setDesc(trans.tagSelectionDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('active', trans.tagSelectionOptions.active)
                    .addOption('specific', trans.tagSelectionOptions.specific)
                    .setValue(tagSettings.useActiveFileTags ? 'active' : 'specific')
                    .onChange(async (value) => {
                        tagSettings.useActiveFileTags = (value === 'active');
                        await this.plugin.saveSettings();
                        this.settingsTab.display();
                    });
            });

        // 태그 지정 입력 (useActiveFileTags가 false일 때만 표시)
        if (!tagSettings.useActiveFileTags) {
            new Setting(itemsEl)
                .setName(trans.specifyTag)
                .setDesc(trans.specifyTagDescription)
                .addText(text => text
                    .setPlaceholder(trans.tagPlaceholder)
                    .setValue(tagSettings.specifiedTags.join(','))
                    .onChange(async (value) => {
                        tagSettings.specifiedTags = value
                            .split(',')
                            .map(tag => tag.trim())
                            .filter(tag => tag.length > 0);
                        await this.plugin.saveSettings();
                    })
                );

            // 태그 연산자 (여러 태그를 지정했을 때만 표시)
            if (tagSettings.specifiedTags.length > 1) {
                new Setting(itemsEl)
                    .setName(trans.tagOperator)
                    .setDesc(trans.tagOperatorDescription)
                    .addDropdown(dropdown => {
                        dropdown
                            .addOption('OR', trans.tagOperatorOptions.or)
                            .addOption('AND', trans.tagOperatorOptions.and)
                            .setValue(tagSettings.tagOperator)
                            .onChange(async (value) => {
                                tagSettings.tagOperator = value as 'OR' | 'AND';
                                await this.plugin.saveSettings();
                            });
                    });
            }
        }
    }

    /**
     * 검색 설정을 추가합니다
     */
    private addSearchSettings(containerEl: HTMLElement): void {
        const trans = t().settings;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.searchSection.name);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        new Setting(itemsEl)
            .setName(trans.enableFuzzySearch.name)
            .setDesc(trans.enableFuzzySearch.description)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFuzzySearch)
                .onChange(async (value) => {
                    this.plugin.settings.enableFuzzySearch = value;
                    await this.plugin.saveSettings();
                    // Show/hide threshold setting
                    this.settingsTab.display();
                })
            );

        if (this.plugin.settings.enableFuzzySearch) {
            new Setting(itemsEl)
                .setName(trans.fuzzySearchThreshold.name)
                .setDesc(trans.fuzzySearchThreshold.description)
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
        new Setting(itemsEl)
            .setName(trans.enableSearchHighlight.name)
            .setDesc(trans.enableSearchHighlight.description)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSearchHighlight ?? true)
                .onChange(async (value) => {
                    this.plugin.settings.enableSearchHighlight = value;
                    await this.plugin.saveSettings();
                })
            );

        // 대소문자 구분 검색 설정
        new Setting(itemsEl)
            .setName(trans.caseSensitiveSearch.name)
            .setDesc(trans.caseSensitiveSearch.description)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.caseSensitiveSearch ?? false)
                .onChange(async (value) => {
                    this.plugin.settings.caseSensitiveSearch = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}

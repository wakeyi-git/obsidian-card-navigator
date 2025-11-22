import { Setting } from 'obsidian';
import { BaseSettings } from './BaseSettings';
import { CardNavigatorSettings } from '../../types';
import { t } from '../../i18n';

/**
 * ModeSettings
 *
 * 폴더/태그 모드 설정 UI
 */
export class ModeSettings extends BaseSettings {
    /**
     * 모드 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.createHeader(
            containerEl,
            t().settingsTab.modeSettings.title,
            t().settingsTab.modeSettings.description
        );

        const settings = this.plugin.settingsManager.getSettings();

        // 모드 선택 (폴더 / 태그)
        new Setting(containerEl)
            .setName(t().settingsTab.modeSettings.mode)
            .setDesc(t().settingsTab.modeSettings.modeDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('folder', t().settingsTab.modeSettings.modeOptions.folder)
                    .addOption('tag', t().settingsTab.modeSettings.modeOptions.tag)
                    .setValue(settings.currentMode)
                    .onChange(async (value) => {
                        settings.currentMode = value as 'folder' | 'tag';
                        await this.plugin.saveSettings();
                        this.plugin.settingsTab.display();
                    });
            });

        // 폴더 모드 설정
        if (settings.currentMode === 'folder') {
            this.addFolderModeSettings(containerEl, settings);
        }

        // 태그 모드 설정
        if (settings.currentMode === 'tag') {
            this.addTagModeSettings(containerEl, settings);
        }

        // 핀 설정
        this.addPinSettings(containerEl, settings);
    }

    /**
     * 폴더 모드 설정을 추가합니다
     *
     * @param containerEl - 컨테이너 요소
     * @param settings - 설정 객체
     */
    private addFolderModeSettings(containerEl: HTMLElement, settings: CardNavigatorSettings): void {
        this.createDivider(containerEl, t().settingsTab.modeSettings.folderModeSettings);

        const folderSettings = settings.folderMode;

        // 폴더 선택 방식
        new Setting(containerEl)
            .setName(t().settingsTab.modeSettings.folderSelection)
            .setDesc(t().settingsTab.modeSettings.folderSelectionDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('active', t().settingsTab.modeSettings.folderSelectionOptions.active)
                    .addOption('specific', t().settingsTab.modeSettings.folderSelectionOptions.specific)
                    .setValue(folderSettings.useActiveFolder ? 'active' : 'specific')
                    .onChange(async (value) => {
                        folderSettings.useActiveFolder = (value === 'active');
                        await this.plugin.saveSettings();
                        this.plugin.settingsTab.display();
                    });
            });

        // 폴더 지정 입력 (useActiveFolder가 false일 때만 표시)
        if (!folderSettings.useActiveFolder) {
            new Setting(containerEl)
                .setName(t().settingsTab.modeSettings.specifyFolder)
                .setDesc(t().settingsTab.modeSettings.specifyFolderDescription)
                .addText(text => text
                    .setPlaceholder(t().settingsTab.modeSettings.folderPathPlaceholder)
                    .setValue(folderSettings.specifiedFolder || '')
                    .onChange(async (value) => {
                        folderSettings.specifiedFolder = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // 하위 폴더 포함 토글
        new Setting(containerEl)
            .setName(t().settingsTab.modeSettings.includeSubfolders)
            .setDesc(t().settingsTab.modeSettings.includeSubfoldersDescription)
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
     *
     * @param containerEl - 컨테이너 요소
     * @param settings - 설정 객체
     */
    private addTagModeSettings(containerEl: HTMLElement, settings: CardNavigatorSettings): void {
        this.createDivider(containerEl, t().settingsTab.modeSettings.tagModeSettings);

        const tagSettings = settings.tagMode;

        // 태그 선택 방식
        new Setting(containerEl)
            .setName(t().settingsTab.modeSettings.tagSelection)
            .setDesc(t().settingsTab.modeSettings.tagSelectionDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('active', t().settingsTab.modeSettings.tagSelectionOptions.active)
                    .addOption('specific', t().settingsTab.modeSettings.tagSelectionOptions.specific)
                    .setValue(tagSettings.useActiveFileTags ? 'active' : 'specific')
                    .onChange(async (value) => {
                        tagSettings.useActiveFileTags = (value === 'active');
                        await this.plugin.saveSettings();
                        this.plugin.settingsTab.display();
                    });
            });

        // 태그 지정 입력 (useActiveFileTags가 false일 때만 표시)
        if (!tagSettings.useActiveFileTags) {
            new Setting(containerEl)
                .setName(t().settingsTab.modeSettings.specifyTag)
                .setDesc(t().settingsTab.modeSettings.specifyTagDescription)
                .addText(text => text
                    .setPlaceholder(t().settingsTab.modeSettings.tagPlaceholder)
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
                new Setting(containerEl)
                    .setName(t().settingsTab.modeSettings.tagOperator)
                    .setDesc(t().settingsTab.modeSettings.tagOperatorDescription)
                    .addDropdown(dropdown => {
                        dropdown
                            .addOption('OR', t().settingsTab.modeSettings.tagOperatorOptions.or)
                            .addOption('AND', t().settingsTab.modeSettings.tagOperatorOptions.and)
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
     * 핀 설정을 추가합니다
     *
     * @param containerEl - 컨테이너 요소
     * @param settings - 설정 객체
     */
    private addPinSettings(containerEl: HTMLElement, settings: CardNavigatorSettings): void {
        this.createDivider(containerEl, t().settingsTab.pinSettings?.title || 'Pin Settings');

        // 핀된 파일 항상 표시 토글
        new Setting(containerEl)
            .setName(t().settingsTab.pinSettings?.alwaysShowPinned || 'Always show pinned files')
            .setDesc(t().settingsTab.pinSettings?.alwaysShowPinnedDescription || 'Show pinned files even when scrolling or changing modes')
            .addToggle(toggle => toggle
                .setValue(settings.alwaysShowPinnedFiles || false)
                .onChange(async (value) => {
                    settings.alwaysShowPinnedFiles = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}

import { Setting } from 'obsidian';
import { LAYOUT_LIMITS } from '../../constants';
import { t } from '../../i18n';
import CardNavigatorPlugin from '../../main';
import { DEFAULT_SETTINGS, LayoutOrientationMode } from '../../types';
import type { CardNavigatorSettingTab } from '../SettingsTab';

/**
 * LayoutSettings
 *
 * 레이아웃 설정 UI
 */
export class LayoutSettings {
    constructor(
        private plugin: CardNavigatorPlugin,
        private settingsTab: CardNavigatorSettingTab
    ) {}

    /**
     * 레이아웃 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        // 섹션 헤더
        new Setting(containerEl)
            .setHeading()
            .setName(t().settingsTab.tabs.layout);

        // containerEl.createEl('p', {
        //     text: t().settings.layoutSection.description,
        //     cls: 'setting-item-description'
        // });

        const settings = this.plugin.settingsManager.getSettings();
        const defaultLayout = DEFAULT_SETTINGS.layout;

        // 레이아웃 방향 모드 드롭다운
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.orientationMode)
            .setDesc(t().settingsTab.layoutSettings.orientationModeDescription)
            .addDropdown(dropdown => dropdown
                .addOption('auto', t().settingsTab.layoutSettings.orientationModeOptions.auto)
                .addOption('always-vertical', t().settingsTab.layoutSettings.orientationModeOptions.alwaysVertical)
                .addOption('always-horizontal', t().settingsTab.layoutSettings.orientationModeOptions.alwaysHorizontal)
                .setValue(settings.layout.orientationMode ?? 'auto')
                .onChange(async (value) => {
                    settings.layout.orientationMode = value as LayoutOrientationMode;
                    await this.plugin.saveSettings();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    settings.layout.orientationMode = defaultLayout.orientationMode;
                    await this.plugin.saveSettings();
                    this.settingsTab.display();
                })
            );

        // 카드 최소 너비 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.minWidth)
            .setDesc(t().settingsTab.layoutSettings.minWidthDescription(LAYOUT_LIMITS.cardMinWidth.min, LAYOUT_LIMITS.cardMinWidth.max))
            .addSlider(slider => slider
                .setLimits(LAYOUT_LIMITS.cardMinWidth.min, LAYOUT_LIMITS.cardMinWidth.max, LAYOUT_LIMITS.cardMinWidth.step)
                .setValue(settings.layout.cardMinWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.layout.cardMinWidth = value;
                    await this.plugin.saveSettings();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    settings.layout.cardMinWidth = defaultLayout.cardMinWidth;
                    await this.plugin.saveSettings();
                    this.settingsTab.display();
                })
            );

        // 카드 최소 높이 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.minHeight)
            .setDesc(t().settingsTab.layoutSettings.minHeightDescription(LAYOUT_LIMITS.cardMinHeight.min, LAYOUT_LIMITS.cardMinHeight.max))
            .addSlider(slider => slider
                .setLimits(LAYOUT_LIMITS.cardMinHeight.min, LAYOUT_LIMITS.cardMinHeight.max, LAYOUT_LIMITS.cardMinHeight.step)
                .setValue(settings.layout.cardMinHeight)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.layout.cardMinHeight = value;
                    await this.plugin.saveSettings();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    settings.layout.cardMinHeight = defaultLayout.cardMinHeight;
                    await this.plugin.saveSettings();
                    this.settingsTab.display();
                })
            );

        // 카드 최대 너비 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.maxWidth)
            .setDesc(t().settingsTab.layoutSettings.maxWidthDescription(LAYOUT_LIMITS.cardMaxWidth.min, LAYOUT_LIMITS.cardMaxWidth.max))
            .addSlider(slider => slider
                .setLimits(LAYOUT_LIMITS.cardMaxWidth.min, LAYOUT_LIMITS.cardMaxWidth.max, LAYOUT_LIMITS.cardMaxWidth.step)
                .setValue(settings.layout.cardMaxWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.layout.cardMaxWidth = value;
                    await this.plugin.saveSettings();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    settings.layout.cardMaxWidth = defaultLayout.cardMaxWidth;
                    await this.plugin.saveSettings();
                    this.settingsTab.display();
                })
            );

        // 카드 최대 높이 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.maxHeight)
            .setDesc(t().settingsTab.layoutSettings.maxHeightDescription(LAYOUT_LIMITS.cardMaxHeight.min, LAYOUT_LIMITS.cardMaxHeight.max))
            .addSlider(slider => slider
                .setLimits(LAYOUT_LIMITS.cardMaxHeight.min, LAYOUT_LIMITS.cardMaxHeight.max, LAYOUT_LIMITS.cardMaxHeight.step)
                .setValue(settings.layout.cardMaxHeight)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.layout.cardMaxHeight = value;
                    await this.plugin.saveSettings();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    settings.layout.cardMaxHeight = defaultLayout.cardMaxHeight;
                    await this.plugin.saveSettings();
                    this.settingsTab.display();
                })
            );

        // 카드 간격 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.cardGap)
            .setDesc(t().settingsTab.layoutSettings.cardGapDescription(LAYOUT_LIMITS.gap.min, LAYOUT_LIMITS.gap.max))
            .addSlider(slider => slider
                .setLimits(LAYOUT_LIMITS.gap.min, LAYOUT_LIMITS.gap.max, LAYOUT_LIMITS.gap.step)
                .setValue(settings.layout.gap)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.layout.gap = value;
                    await this.plugin.saveSettings();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    settings.layout.gap = defaultLayout.gap;
                    await this.plugin.saveSettings();
                    this.settingsTab.display();
                })
            );
    }
}

import { Setting } from 'obsidian';
import { BaseSettings } from './BaseSettings';
import { DEFAULT_SETTINGS } from '../../types';
import { t } from '../../i18n';

/**
 * LayoutSettings
 *
 * 레이아웃 설정 UI
 */
export class LayoutSettings extends BaseSettings {
    /**
     * 레이아웃 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.createHeader(
            containerEl,
            t().settingsTab.tabs.layout,
            t().settings.layoutSection.description
        );

        const settings = this.plugin.settingsManager.getSettings();
        const defaultLayout = DEFAULT_SETTINGS.layout;

        // 카드 최소 너비 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.minWidth)
            .setDesc(t().settingsTab.layoutSettings.minWidthDescription)
            .addSlider(slider => slider
                .setLimits(100, 400, 10)
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
                    this.plugin.settingsTab.display();
                })
            );

        // 카드 최소 높이 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.minHeight)
            .setDesc(t().settingsTab.layoutSettings.minHeightDescription)
            .addSlider(slider => slider
                .setLimits(80, 300, 10)
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
                    this.plugin.settingsTab.display();
                })
            );

        // 카드 최대 너비 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.maxWidth)
            .setDesc(t().settingsTab.layoutSettings.maxWidthDescription)
            .addSlider(slider => slider
                .setLimits(200, 600, 10)
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
                    this.plugin.settingsTab.display();
                })
            );

        // 카드 최대 높이 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.maxHeight)
            .setDesc(t().settingsTab.layoutSettings.maxHeightDescription)
            .addSlider(slider => slider
                .setLimits(150, 500, 10)
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
                    this.plugin.settingsTab.display();
                })
            );

        // 카드 간격 슬라이더
        new Setting(containerEl)
            .setName(t().settingsTab.layoutSettings.cardGap)
            .setDesc(t().settingsTab.layoutSettings.cardGapDescription)
            .addSlider(slider => slider
                .setLimits(5, 20, 1)
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
                    this.plugin.settingsTab.display();
                })
            );
    }
}

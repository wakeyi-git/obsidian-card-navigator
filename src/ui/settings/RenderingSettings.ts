import { Setting } from 'obsidian';
import { BaseSettings } from './BaseSettings';
import { t } from '../../i18n';

/**
 * RenderingSettings
 *
 * 렌더링 설정 UI
 */
export class RenderingSettings extends BaseSettings {
    /**
     * 렌더링 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.createHeader(containerEl, t().settings.renderingSection.name);

        const settings = this.plugin.settingsManager.getSettings();

        // 렌더링 모드
        new Setting(containerEl)
            .setName(t().settingsTab.renderingSettings.renderMode)
            .setDesc(t().settingsTab.renderingSettings.renderModeDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('plain', t().settingsTab.cardSettings.renderModeOptions.plain)
                    .addOption('markdown-html', t().settingsTab.cardSettings.renderModeOptions.markdownHtml)
                    .setValue(settings.renderMode)
                    .onChange(async (value) => {
                        settings.renderMode = value as 'plain' | 'markdown-html';
                        await this.plugin.saveSettings();
                    });
            });
    }
}

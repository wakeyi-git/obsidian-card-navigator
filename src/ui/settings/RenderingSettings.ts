import { Setting } from 'obsidian';
import { BaseSettings } from './BaseSettings';

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
        this.createHeader(containerEl, '렌더링');

        const settings = this.plugin.settingsManager.getSettings();

        // 렌더링 모드
        new Setting(containerEl)
            .setName('렌더링 모드')
            .setDesc('카드 내용을 일반 텍스트로 표시할지, 마크다운으로 렌더링할지 선택합니다')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('plain', '일반 텍스트')
                    .addOption('markdown-html', '마크다운 렌더링 (읽기 뷰 스타일)')
                    .setValue(settings.renderMode)
                    .onChange(async (value) => {
                        settings.renderMode = value as 'plain' | 'markdown-html';
                        await this.plugin.saveSettings();
                    });
            });
    }
}

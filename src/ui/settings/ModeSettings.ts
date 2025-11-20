import { Setting } from 'obsidian';
import { BaseSettings } from './BaseSettings';

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
            '모드',
            '카드를 표시할 기준을 선택합니다.'
        );

        const settings = this.plugin.settingsManager.getSettings();

        // 모드 선택 (폴더 / 태그)
        new Setting(containerEl)
            .setName('모드 선택')
            .setDesc('폴더 기반으로 표시할지, 태그 기반으로 표시할지 선택합니다')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('folder', '폴더 모드')
                    .addOption('tag', '태그 모드')
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
    }

    /**
     * 폴더 모드 설정을 추가합니다
     * 
     * @param containerEl - 컨테이너 요소
     * @param settings - 설정 객체
     */
    private addFolderModeSettings(containerEl: HTMLElement, settings: any): void {
        this.createDivider(containerEl, '폴더 모드 설정');

        const folderSettings = settings.folderMode;

        // 폴더 선택 방식
        new Setting(containerEl)
            .setName('폴더 선택')
            .setDesc('활성 파일의 폴더를 사용할지, 특정 폴더를 지정할지 선택합니다')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('active', '활성 폴더')
                    .addOption('specific', '폴더 지정')
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
                .setName('지정 폴더')
                .setDesc('카드를 표시할 폴더 경로를 입력하세요 (예: Projects/Work)')
                .addText(text => text
                    .setPlaceholder('폴더 경로')
                    .setValue(folderSettings.specifiedFolder || '')
                    .onChange(async (value) => {
                        folderSettings.specifiedFolder = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // 하위 폴더 포함 토글
        new Setting(containerEl)
            .setName('하위 폴더 포함')
            .setDesc('선택한 폴더의 하위 폴더에 있는 파일도 포함합니다')
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
    private addTagModeSettings(containerEl: HTMLElement, settings: any): void {
        this.createDivider(containerEl, '태그 모드 설정');

        const tagSettings = settings.tagMode;

        // 태그 선택 방식
        new Setting(containerEl)
            .setName('태그 선택')
            .setDesc('활성 파일의 태그를 사용할지, 특정 태그를 지정할지 선택합니다')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('active', '활성 파일 태그')
                    .addOption('specific', '태그 지정')
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
                .setName('지정 태그')
                .setDesc('카드를 표시할 태그를 쉼표로 구분하여 입력하세요 (예: important,work)')
                .addText(text => text
                    .setPlaceholder('태그1,태그2,태그3')
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
                    .setName('태그 연산자')
                    .setDesc('여러 태그 중 하나라도 포함하면 표시(OR), 모두 포함해야 표시(AND)')
                    .addDropdown(dropdown => {
                        dropdown
                            .addOption('OR', 'OR (하나라도 포함)')
                            .addOption('AND', 'AND (모두 포함)')
                            .setValue(tagSettings.tagOperator)
                            .onChange(async (value) => {
                                tagSettings.tagOperator = value as 'OR' | 'AND';
                                await this.plugin.saveSettings();
                            });
                    });
            }
        }
    }
}

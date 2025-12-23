import { Setting, Notice } from 'obsidian';
import CardNavigatorPlugin from '../../main';
import { t } from '../../i18n';
import type { CardNavigatorSettingTab } from '../SettingsTab';

/**
 * InteractionSettings
 *
 * 상호작용 탭 설정 UI (스크롤 동작 + 태그 클릭 + 드래그 앤 드롭)
 */
export class InteractionSettings {
    constructor(
        private plugin: CardNavigatorPlugin,
        private settingsTab: CardNavigatorSettingTab
    ) {}

    /**
     * 상호작용 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.addScrollBehaviorSettings(containerEl);
        this.addTagClickActionSettings(containerEl);
        this.addDragDropSettings(containerEl);
    }

    /**
     * 스크롤 동작 설정을 추가합니다
     */
    private addScrollBehaviorSettings(containerEl: HTMLElement): void {
        const trans = t().settingsTab.scrollBehavior;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        new Setting(itemsEl)
            .setName(trans.name)
            .setDesc(trans.description)
            .addDropdown(dropdown => dropdown
                .addOption('nearest', trans.nearest)
                .addOption('center', trans.center)
                .addOption('none', trans.none)
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
        const trans = t().settingsTab.tagClickAction;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        new Setting(itemsEl)
            .setName(trans.name)
            .setDesc(trans.description)
            .addDropdown(dropdown => dropdown
                .addOption('plugin-search', trans.pluginSearch)
                .addOption('obsidian-search', trans.obsidianSearch)
                .setValue(this.plugin.settings.tagClickAction)
                .onChange(async (value: 'obsidian-search' | 'plugin-search') => {
                    this.plugin.settings.tagClickAction = value;
                    await this.plugin.saveSettings();
                    const action = value === 'plugin-search' ? trans.pluginSearch : trans.obsidianSearch;
                    new Notice(trans.notice(action));
                })
            );
    }

    /**
     * 드래그 앤 드롭 설정을 추가합니다
     */
    private addDragDropSettings(containerEl: HTMLElement): void {
        const trans = t().settingsTab.dragDrop;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        new Setting(itemsEl)
            .setName(trans.contentType)
            .setDesc(trans.contentTypeDescription)
            .addDropdown(dropdown => dropdown
                .addOption('link', trans.link)
                .addOption('full-content', trans.fullContent)
                .setValue(this.plugin.settings.dragDrop.contentType)
                .onChange(async (value: 'link' | 'full-content') => {
                    this.plugin.settings.dragDrop.contentType = value;
                    await this.plugin.saveSettings();
                    // UI 업데이트
                    this.settingsTab.display();
                })
            );

        // '파일 내용'을 선택한 경우에만 추가 옵션 표시
        if (this.plugin.settings.dragDrop.contentType === 'full-content') {
            // 설명 텍스트
            const descEl = itemsEl.createDiv({ cls: 'setting-item-description' });
            descEl.setText(trans.optionsDescription);
            descEl.style.marginTop = '10px';
            descEl.style.marginBottom = '10px';
            descEl.style.fontSize = '0.9em';
            descEl.style.color = 'var(--text-muted)';

            // 프론트매터 포함 여부
            new Setting(itemsEl)
                .setName(trans.includeFrontmatter)
                .setDesc(trans.includeFrontmatterDescription)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.dragDrop.fullContentOptions.includeFrontmatter)
                    .onChange(async (value) => {
                        this.plugin.settings.dragDrop.fullContentOptions.includeFrontmatter = value;
                        await this.plugin.saveSettings();
                    })
                );

            // 최대 길이 제한 활성화
            new Setting(itemsEl)
                .setName(trans.enableLengthLimit)
                .setDesc(trans.enableLengthLimitDescription)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.dragDrop.fullContentOptions.enableLengthLimit)
                    .onChange(async (value) => {
                        this.plugin.settings.dragDrop.fullContentOptions.enableLengthLimit = value;
                        await this.plugin.saveSettings();
                        // UI 업데이트
                        this.settingsTab.display();
                    })
                );

            // 최대 글자 수 (최대 길이 제한이 활성화되었을 때만 표시)
            if (this.plugin.settings.dragDrop.fullContentOptions.enableLengthLimit) {
                new Setting(itemsEl)
                    .setName(trans.maxLength)
                    .setDesc(trans.maxLengthDescription)
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
}

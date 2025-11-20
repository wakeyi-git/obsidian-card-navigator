import { Setting } from 'obsidian';
import { BaseSettings } from './BaseSettings';
import { t } from '../../i18n';

/**
 * SortSettings
 * 
 * 정렬 설정 UI
 */
export class SortSettings extends BaseSettings {
    /**
     * 정렬 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.createHeader(
            containerEl,
            t().settingsTab.sortSettings.title,
            t().settingsTab.sortSettings.description
        );

        const settings = this.plugin.settingsManager.getSettings();
        const sortSettings = settings.sort;

        // 정렬 기준 선택
        new Setting(containerEl)
            .setName(t().settingsTab.sortSettings.sortBy)
            .setDesc(t().settingsTab.sortSettings.sortByDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('name', t().settingsTab.sortSettings.criteriaOptions.name)
                    .addOption('created', t().settingsTab.sortSettings.criteriaOptions.created)
                    .addOption('modified', t().settingsTab.sortSettings.criteriaOptions.modified)
                    .addOption('size', t().settingsTab.sortSettings.criteriaOptions.size)
                    .addOption('property', t().settingsTab.sortSettings.criteriaOptions.property)
                    .setValue(sortSettings.criteria)
                    .onChange(async (value) => {
                        sortSettings.criteria = value as any;
                        await this.plugin.saveSettings();
                        this.plugin.settingsTab.display();
                    });
            });

        // 프론트매터 속성 입력 (criteria가 'property'일 때만 표시)
        if (sortSettings.criteria === 'property') {
            new Setting(containerEl)
                .setName(t().settingsTab.sortSettings.propertyName)
                .setDesc(t().settingsTab.sortSettings.propertyNameDescription)
                .addText(text => text
                    .setPlaceholder(t().settingsTab.sortSettings.propertyNamePlaceholder)
                    .setValue(sortSettings.propertyName || '')
                    .onChange(async (value) => {
                        sortSettings.propertyName = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // 정렬 순서 선택
        new Setting(containerEl)
            .setName(t().settingsTab.sortSettings.sortOrder)
            .setDesc(t().settingsTab.sortSettings.sortOrderDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('asc', t().settingsTab.sortSettings.orderOptions.asc)
                    .addOption('desc', t().settingsTab.sortSettings.orderOptions.desc)
                    .setValue(sortSettings.order)
                    .onChange(async (value) => {
                        sortSettings.order = value as 'asc' | 'desc';
                        await this.plugin.saveSettings();
                    });
            });

        // 정렬 예시 안내
        this.addSortExamples(containerEl, sortSettings);
    }

    /**
     * 정렬 예시를 추가합니다
     * 
     * @param containerEl - 컨테이너 요소
     * @param sortSettings - 정렬 설정 객체
     */
    private addSortExamples(containerEl: HTMLElement, sortSettings: any): void {
        const examples = t().settingsTab.sortSettings.examples;
        const examplesMap: Record<string, string> = {
            'name': examples.name,
            'created': examples.created,
            'modified': examples.modified,
            'size': examples.size,
            'property': examples.property
        };

        const currentExample = examplesMap[sortSettings.criteria];

        if (currentExample) {
            const exampleEl = containerEl.createEl('div', {
                cls: 'setting-item-description card-navigator-sort-example'
            });
            exampleEl.createEl('strong', { text: t().settingsTab.sortSettings.exampleLabel });
            exampleEl.appendText(currentExample);
        }
    }
}

import { Setting, setIcon } from 'obsidian';
import { BaseSettings } from './BaseSettings';
import { SortOptions, SortCriteria, SortLevel, SortOrder } from '../../types';
import { t } from '../../i18n';

/**
 * SortSettings
 *
 * 정렬 설정 UI
 */
export class SortSettings extends BaseSettings {
    private draggedIndex: number | null = null;
    private levelsContainerEl: HTMLElement | null = null;

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
                        sortSettings.criteria = value as SortCriteria;
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

        // 다단계 정렬 활성화
        new Setting(containerEl)
            .setName(t().settingsTab.sortSettings.enableMultiSort || 'Enable Multi-level Sort')
            .setDesc(t().settingsTab.sortSettings.enableMultiSortDescription || 'Sort files by multiple criteria in sequence')
            .addToggle(toggle => toggle
                .setValue(sortSettings.enableMultiSort || false)
                .onChange(async (value) => {
                    sortSettings.enableMultiSort = value;
                    if (value && (!sortSettings.levels || sortSettings.levels.length === 0)) {
                        // Initialize with current sort as first level only if no levels exist
                        sortSettings.levels = [{
                            criteria: sortSettings.criteria,
                            order: sortSettings.order,
                            propertyName: sortSettings.propertyName
                        }];
                    }
                    // Don't delete levels when disabling, keep them to restore later
                    await this.plugin.saveSettings();
                    this.plugin.settingsTab.display();
                })
            );

        // 다단계 정렬 레벨 구성 (인라인)
        if (sortSettings.enableMultiSort) {
            this.renderMultiSortLevels(containerEl, sortSettings);
        }

        // 정렬 예시 안내
        this.addSortExamples(containerEl, sortSettings);
    }

    /**
     * 다단계 정렬 레벨을 렌더링합니다 (인라인)
     */
    private renderMultiSortLevels(containerEl: HTMLElement, sortSettings: SortOptions): void {
        // Description section
        const descriptionEl = containerEl.createEl('div', {
            cls: 'setting-item-description',
            attr: { style: 'margin-bottom: 12px;' }
        });
        descriptionEl.innerHTML = (t().toolbar.multiSortModalDescription ||
            'Drag and drop to reorder sort levels. Files will be sorted by Level 1 first, then Level 2, and so on.').replace('\n', '<br>');

        // Levels container
        this.levelsContainerEl = containerEl.createEl('div', {
            cls: 'multi-sort-levels-container',
            attr: { style: 'margin-bottom: 12px;' }
        });

        if (!sortSettings.levels) {
            sortSettings.levels = [{
                criteria: sortSettings.criteria,
                order: sortSettings.order,
                propertyName: sortSettings.propertyName
            }];
        }

        this.renderLevels(sortSettings);

        // Add level button (max 3 levels)
        if (sortSettings.levels.length < 3) {
            new Setting(containerEl)
                .addButton(button => button
                    .setButtonText(t().settingsTab.sortSettings.addLevel || '+ Add Sort Level')
                    .onClick(async () => {
                        sortSettings.levels = sortSettings.levels || [];
                        sortSettings.levels.push({
                            criteria: 'name',
                            order: 'asc'
                        });
                        await this.plugin.saveSettings();
                        this.renderLevels(sortSettings);
                    })
                );
        }
    }

    /**
     * 레벨 리스트를 렌더링합니다
     */
    private renderLevels(sortSettings: SortOptions): void {
        if (!this.levelsContainerEl) return;
        this.levelsContainerEl.empty();

        const levels = sortSettings.levels || [];
        levels.forEach((level, index) => {
            const levelEl = this.createLevelElement(level, index, sortSettings);
            this.levelsContainerEl!.appendChild(levelEl);
        });
    }

    /**
     * 개별 레벨 요소를 생성합니다
     */
    private createLevelElement(level: SortLevel, index: number, sortSettings: SortOptions): HTMLElement {
        const levelEl = document.createElement('div');
        levelEl.className = 'multi-sort-level-item';
        levelEl.draggable = true;

        // Drag handle
        const dragHandle = levelEl.createEl('div', {
            cls: 'multi-sort-drag-handle',
            attr: { 'aria-label': 'Drag to reorder' }
        });
        setIcon(dragHandle, 'grip-vertical');

        // Level number
        levelEl.createEl('div', {
            cls: 'multi-sort-level-number',
            text: String(index + 1)
        });

        // Content container
        const contentContainer = levelEl.createEl('div', {
            cls: 'multi-sort-level-content'
        });

        // Criteria dropdown
        const criteriaContainer = contentContainer.createEl('div', {
            cls: 'multi-sort-field'
        });
        const criteriaSelect = criteriaContainer.createEl('select', {
            cls: 'dropdown'
        }) as HTMLSelectElement;

        const criteriaOptions: Array<{ value: SortCriteria; label: string }> = [
            { value: 'name', label: t().settingsTab.sortSettings.criteriaOptions.name },
            { value: 'created', label: t().settingsTab.sortSettings.criteriaOptions.created },
            { value: 'modified', label: t().settingsTab.sortSettings.criteriaOptions.modified },
            { value: 'size', label: t().settingsTab.sortSettings.criteriaOptions.size },
            { value: 'property', label: t().settingsTab.sortSettings.criteriaOptions.property }
        ];

        criteriaOptions.forEach(option => {
            const optionEl = criteriaSelect.createEl('option', {
                text: option.label
            }) as HTMLOptionElement;
            optionEl.value = option.value;
            if (option.value === level.criteria) {
                optionEl.selected = true;
            }
        });

        criteriaSelect.addEventListener('change', async () => {
            level.criteria = criteriaSelect.value as SortCriteria;
            await this.plugin.saveSettings();
            // Re-render to show/hide property input
            this.renderLevels(sortSettings);
        });

        // Property name input (if criteria is 'property')
        if (level.criteria === 'property') {
            const propertyContainer = contentContainer.createEl('div', {
                cls: 'multi-sort-field'
            });
            const propertyInput = propertyContainer.createEl('input', {
                cls: 'multi-sort-property-input',
                attr: {
                    placeholder: t().settingsTab.sortSettings.propertyNamePlaceholder
                }
            }) as HTMLInputElement;
            propertyInput.type = 'text';
            propertyInput.value = level.propertyName || '';
            propertyInput.addEventListener('change', async () => {
                level.propertyName = propertyInput.value;
                await this.plugin.saveSettings();
            });
        }

        // Order dropdown
        const orderContainer = contentContainer.createEl('div', {
            cls: 'multi-sort-field'
        });
        const orderSelect = orderContainer.createEl('select', {
            cls: 'dropdown'
        }) as HTMLSelectElement;

        const orderOptions: Array<{ value: SortOrder; label: string }> = [
            { value: 'asc', label: '↑ ' + t().settingsTab.sortSettings.orderOptions.asc },
            { value: 'desc', label: '↓ ' + t().settingsTab.sortSettings.orderOptions.desc }
        ];

        orderOptions.forEach(option => {
            const optionEl = orderSelect.createEl('option', {
                text: option.label
            }) as HTMLOptionElement;
            optionEl.value = option.value;
            if (option.value === level.order) {
                optionEl.selected = true;
            }
        });

        orderSelect.addEventListener('change', async () => {
            level.order = orderSelect.value as SortOrder;
            await this.plugin.saveSettings();
        });

        // Delete button
        const deleteBtn = levelEl.createEl('div', {
            cls: 'clickable-icon multi-sort-delete-btn',
            attr: { 'aria-label': t().settingsTab.sortSettings.removeLevel || 'Remove' }
        });
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.addEventListener('click', async () => {
            sortSettings.levels = sortSettings.levels || [];
            sortSettings.levels.splice(index, 1);
            await this.plugin.saveSettings();
            this.renderLevels(sortSettings);
        });

        // Drag and drop events
        levelEl.addEventListener('dragstart', (e) => {
            this.draggedIndex = index;
            levelEl.addClass('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        levelEl.addEventListener('dragend', () => {
            levelEl.removeClass('dragging');
            this.draggedIndex = null;
        });

        levelEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.draggedIndex !== null && this.draggedIndex !== index) {
                levelEl.addClass('drag-over');
            }
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
        });

        levelEl.addEventListener('dragleave', () => {
            levelEl.removeClass('drag-over');
        });

        levelEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            levelEl.removeClass('drag-over');

            if (this.draggedIndex !== null && this.draggedIndex !== index) {
                // Reorder levels
                const levels = sortSettings.levels || [];
                const draggedLevel = levels[this.draggedIndex];
                levels.splice(this.draggedIndex, 1);
                levels.splice(index, 0, draggedLevel);
                sortSettings.levels = levels;

                await this.plugin.saveSettings();
                this.renderLevels(sortSettings);
            }
        });

        return levelEl;
    }

    /**
     * 정렬 예시를 추가합니다
     *
     * @param containerEl - 컨테이너 요소
     * @param sortSettings - 정렬 설정 객체
     */
    private addSortExamples(containerEl: HTMLElement, sortSettings: SortOptions): void {
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

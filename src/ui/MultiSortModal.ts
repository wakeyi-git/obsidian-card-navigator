import { App, Modal, Setting, setIcon } from 'obsidian';
import { SortCriteria, SortLevel, SortOrder } from '../types';
import { t } from '../i18n';
import CardNavigatorPlugin from '../main';

/**
 * 다단계 정렬 구성 모달
 *
 * 드래그 앤 드롭으로 정렬 레벨을 구성할 수 있습니다.
 */
export class MultiSortModal extends Modal {
    private plugin: CardNavigatorPlugin;
    private levels: SortLevel[];
    private onSubmit: (levels: SortLevel[]) => void;
    private draggedIndex: number | null = null;

    constructor(
        app: App,
        plugin: CardNavigatorPlugin,
        initialLevels: SortLevel[],
        onSubmit: (levels: SortLevel[]) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.levels = JSON.parse(JSON.stringify(initialLevels)); // Deep copy
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', {
            text: t().settingsTab.sortSettings.sortLevels || 'Multi-level Sort Configuration'
        });

        const description = contentEl.createEl('p', {
            cls: 'multi-sort-modal-description'
        });
        description.innerHTML = (t().toolbar.multiSortModalDescription ||
            'Drag and drop to reorder sort levels. Files will be sorted by Level 1 first, then Level 2, and so on.').replace('\n', '<br>');

        // Levels container
        const levelsContainer = contentEl.createEl('div', {
            cls: 'multi-sort-levels-container'
        });

        this.renderLevels(levelsContainer);

        // Add level button
        if (this.levels.length < 3) {
            new Setting(contentEl)
                .addButton(button => button
                    .setButtonText(t().settingsTab.sortSettings.addLevel || '+ Add Sort Level')
                    .onClick(() => {
                        this.levels.push({
                            criteria: 'name',
                            order: 'asc'
                        });
                        this.renderLevels(levelsContainer);
                    })
                );
        }

        // Action buttons
        const buttonContainer = contentEl.createEl('div', {
            cls: 'multi-sort-modal-buttons'
        });

        const cancelButton = buttonContainer.createEl('button', {
            text: t().savedSearches.cancelButton || 'Cancel'
        });
        cancelButton.addEventListener('click', () => {
            this.close();
        });

        const applyButton = buttonContainer.createEl('button', {
            text: t().savedSearches.applyButton || 'Apply',
            cls: 'mod-cta'
        });
        applyButton.addEventListener('click', () => {
            this.onSubmit(this.levels);
            this.close();
        });
    }

    private renderLevels(container: HTMLElement): void {
        container.empty();

        this.levels.forEach((level, index) => {
            const levelEl = this.createLevelElement(level, index);
            container.appendChild(levelEl);
        });
    }

    private createLevelElement(level: SortLevel, index: number): HTMLElement {
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

        criteriaSelect.addEventListener('change', () => {
            level.criteria = criteriaSelect.value as SortCriteria;
            // Re-render to show/hide property input
            this.renderLevels(levelEl.parentElement as HTMLElement);
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
            propertyInput.addEventListener('change', () => {
                level.propertyName = propertyInput.value;
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

        orderSelect.addEventListener('change', () => {
            level.order = orderSelect.value as SortOrder;
        });

        // Delete button
        const deleteBtn = levelEl.createEl('div', {
            cls: 'clickable-icon multi-sort-delete-btn',
            attr: { 'aria-label': t().settingsTab.sortSettings.removeLevel || 'Remove' }
        });
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.addEventListener('click', () => {
            this.levels.splice(index, 1);
            this.renderLevels(levelEl.parentElement as HTMLElement);
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

        levelEl.addEventListener('drop', (e) => {
            e.preventDefault();
            levelEl.removeClass('drag-over');

            if (this.draggedIndex !== null && this.draggedIndex !== index) {
                // Reorder levels
                const draggedLevel = this.levels[this.draggedIndex];
                this.levels.splice(this.draggedIndex, 1);
                this.levels.splice(index, 0, draggedLevel);

                this.renderLevels(levelEl.parentElement as HTMLElement);
            }
        });

        return levelEl;
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

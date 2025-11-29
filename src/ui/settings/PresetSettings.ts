import { Modal, Notice, setIcon, Setting, TFolder } from 'obsidian';
import { t } from '../../i18n';
import type CardNavigatorPlugin from '../../main';
import { Preset, PresetMapping, PresetApplyCategories, DEFAULT_PRESET_APPLY_CATEGORIES } from '../../types';
import { DebugLogger } from '../../utils/DebugLogger';
import { ErrorHandler, ErrorSeverity } from '../../utils/ErrorHandler';
import { getMomentLocale } from '../../utils/locale';
import { TextInputModal } from '../modals/TextInputModal';
import type { CardNavigatorSettingTab } from '../SettingsTab';

/**
 * 프리셋 관리 UI
 *
 * 프리셋 생성, 적용, 삭제 및 폴더/태그별 자동 적용 매핑을 관리합니다.
 */
export class PresetSettings {
    private logger: DebugLogger;
    private errorHandler: ErrorHandler;

    constructor(
        private plugin: CardNavigatorPlugin,
        private settingsTab: CardNavigatorSettingTab
    ) {
        this.logger = new DebugLogger(() => plugin.settings);
        this.errorHandler = new ErrorHandler(this.logger);
    }
    /**
     * 프리셋 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        // 섹션 헤더
        new Setting(containerEl)
            .setHeading()
            .setName(t().settingsTab.presetSettings.title);

        // containerEl.createEl('p', {
        //     text: t().settingsTab.presetSettings.description,
        //     cls: 'setting-item-description'
        // });

        this.addEnablePresetsToggle(containerEl);

        if (this.plugin.settings.enablePresets) {
            this.addCreatePresetButton(containerEl);
            this.addPresetList(containerEl);
            this.addPresetMapping(containerEl);
        } else {
            containerEl.createEl('div', {
                cls: 'setting-item-description',
                text: t().settingsTab.presetSettings.enableFeatureDescription
            }).style.marginTop = '20px';
        }
    }

    /**
     * 프리셋 기능 활성화/비활성화 토글을 추가합니다
     */
    private addEnablePresetsToggle(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName(t().settingsTab.presets.enablePresets)
            .setDesc(t().settingsTab.presets.enablePresetsDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enablePresets)
                .onChange(async (value) => {
                    this.plugin.settings.enablePresets = value;
                    await this.plugin.saveSettings();

                    this.plugin.settingsTab.display();

                    new Notice(t().settingsTab.presetSettings.featureStatusChanged(value));
                })
            );

        containerEl.createEl('div', { cls: 'setting-item-divider' });
    }

    /**
     * 프리셋 생성 버튼을 추가합니다
     */
    private addCreatePresetButton(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setHeading()
            .setName(t().settingsTab.presetSettings.createDivider);

        new Setting(containerEl)
            .setName(t().settingsTab.presets.createPreset)
            .setDesc(t().settingsTab.presets.createPresetDescription)
            .addButton(button => button
                .setButtonText(t().settingsTab.presets.createPresetButton)
                .setCta()
                .onClick(async () => {
                    await this.createPreset();
                })
            );
    }

    /**
     * 프리셋 생성 모달을 표시합니다
     */
    private async createPreset(): Promise<void> {
        const nameModal = new TextInputModal(
            this.plugin.app,
            t().settingsTab.presetSettings.createModalTitle,
            t().settingsTab.presetSettings.createName,
            '',
            (presetName) => {
                if (presetName) {
                    this.showDescriptionModal(presetName);
                }
            }
        );
        nameModal.open();
    }

    /**
     * 프리셋 이름 편집 모달을 표시합니다
     */
    private editPresetName(preset: Preset): void {
        const modal = new TextInputModal(
            this.plugin.app,
            t().settingsTab.presetSettings.editNameModalTitle,
            t().settingsTab.presetSettings.editNamePlaceholder,
            preset.name,
            async (newName) => {
                if (newName && newName !== preset.name) {
                    try {
                        await this.plugin.presetManager.updatePreset(preset.id, newName, preset.description || '');
                        this.plugin.settingsTab.display();
                        new Notice(t().settingsTab.presetSettings.editSuccess(newName));
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'update preset name' },
                            'Failed to update preset name'
                        );
                    }
                }
            }
        );
        modal.open();
    }

    /**
     * 프리셋 설명 편집 모달을 표시합니다
     */
    private editPresetDescription(preset: Preset): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presetSettings.editDescriptionModalTitle);

        let description = preset.description || '';
        let inputEl: HTMLInputElement | null = null;

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.descriptionLabel)
            .setDesc(t().settingsTab.presets.descriptionPlaceholder)
            .addText(text => {
                inputEl = text
                    .setPlaceholder(t().settingsTab.presetSettings.editDescriptionPlaceholder)
                    .setValue(description)
                    .onChange(value => {
                        description = value;
                    })
                    .inputEl;

                inputEl.style.width = '100%';

                inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.isComposing) {
                        return;
                    }

                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.savePresetDescription(preset, description);
                        modal.close();
                    }

                    if (e.key === 'Escape') {
                        e.preventDefault();
                        modal.close();
                    }
                });
            });

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    await this.savePresetDescription(preset, description);
                    modal.close();
                })
            );

        modal.open();

        setTimeout(() => {
            inputEl?.focus();
        }, 100);
    }

    /**
     * 프리셋 설명을 저장합니다
     */
    private async savePresetDescription(preset: Preset, description: string): Promise<void> {
        try {
            await this.plugin.presetManager.updatePreset(preset.id, preset.name, description);
            this.plugin.settingsTab.display();
            new Notice(t().settingsTab.presetSettings.editSuccess(preset.name));
        } catch (error) {
            this.errorHandler.handle(
                error,
                ErrorSeverity.ERROR,
                { category: 'Preset', action: 'update preset description' },
                'Failed to update preset description'
            );
        }
    }

    /**
     * 프리셋 설명 입력 모달을 표시합니다
     */
    private showDescriptionModal(presetName: string): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presets.presetDescriptionTitle);

        let description = '';
        let inputEl: HTMLInputElement | null = null;

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.descriptionLabel)
            .setDesc(t().settingsTab.presets.descriptionPlaceholder)
            .addText(text => {
                inputEl = text
                    .setPlaceholder(t().settingsTab.presetSettings.createNamePlaceholder)
                    .onChange(value => {
                        description = value;
                    })
                    .inputEl;

                inputEl.style.width = '100%';

                inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    // IME 입력 중에는 엔터 키 무시
                    if (e.isComposing) {
                        return;
                    }

                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.savePreset(presetName, description);
                        modal.close();
                    }

                    if (e.key === 'Escape') {
                        e.preventDefault();
                        modal.close();
                    }
                });
            });

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    await this.savePreset(presetName, description);
                    modal.close();
                })
            );

        modal.open();

        setTimeout(() => {
            inputEl?.focus();
        }, 100);
    }

    /**
     * 프리셋을 저장합니다
     */
    private async savePreset(name: string, description: string): Promise<void> {
        try {
            await this.plugin.presetManager.createPreset(name, description);

            this.logger.debug('Preset', t().debug.presets.createComplete, { name });

            this.plugin.settingsTab.display();
            new Notice(t().settingsTab.presetSettings.createSuccess(name));
        } catch (error) {
            this.errorHandler.handle(
                error,
                ErrorSeverity.ERROR,
                { category: 'Preset', action: 'create preset' },
                t().notices.presets.createFailed
            );
        }
    }

    /**
     * 프리셋 목록을 추가합니다
     */
    private addPresetList(containerEl: HTMLElement): void {
        // new Setting(containerEl)
        //     .setHeading()
        //     .setName(t().settingsTab.presetSettings.title);

        const presets = this.plugin.presetManager.getAllPresets();

        if (presets.length === 0) {
            containerEl.createEl('div', {
                cls: 'setting-item-description',
                text: t().settingsTab.presets.createPresetDescription
            });
            return;
        }

        presets.forEach((preset: Preset) => {
            const presetContainer = containerEl.createDiv({ cls: 'card-navigator-preset-item'});

            const infoContainer = presetContainer.createDiv({ cls: 'preset-info'});

            const nameEl = infoContainer.createEl('h4', {
                text: preset.name,
                cls: 'preset-name preset-name-editable'
            });

            const iconEl = nameEl.createSpan({ cls: 'preset-icon'});
            setIcon(iconEl, 'save');

            nameEl.addEventListener('click', () => {
                this.editPresetName(preset);
            });
            nameEl.style.cursor = 'pointer';

            if (preset.description) {
                const descEl = infoContainer.createEl('p', {
                    text: preset.description,
                    cls: 'preset-description preset-description-editable setting-item-description'
                });
                descEl.addEventListener('click', () => {
                    this.editPresetDescription(preset);
                });
                descEl.style.cursor = 'pointer';
            } else {
                const descEl = infoContainer.createEl('p', {
                    text: t().settingsTab.presetSettings.noDescription,
                    cls: 'preset-description preset-description-editable setting-item-description'
                });
                descEl.style.opacity = '0.5';
                descEl.addEventListener('click', () => {
                    this.editPresetDescription(preset);
                });
                descEl.style.cursor = 'pointer';
            }

            const date = new Date(preset.createdAt);
            infoContainer.createEl('p', {
                text: `${t().settingsTab.presetSettings.createdDate} ${date.toLocaleDateString(getMomentLocale())}`,
                cls: 'preset-date setting-item-description'
            });

            const buttonsContainer = presetContainer.createDiv({ cls: 'preset-buttons'});

            const applyBtn = buttonsContainer.createEl('button', {
                text: t().settingsTab.presetSettings.applyButton,
                cls: 'mod-cta'
            });
            applyBtn.addEventListener('click', async () => {
                await this.plugin.presetManager.applyPreset(preset.id);
                this.plugin.settingsTab.display();
                new Notice(t().settingsTab.presetSettings.applySuccess(preset.name));
            });

            const overwriteBtn = buttonsContainer.createEl('button', {
                text: t().settingsTab.presetSettings.overwriteButton
            });
            overwriteBtn.addEventListener('click', async () => {
                if (confirm(t().settingsTab.presetSettings.overwriteConfirm(preset.name))) {
                    try {
                        await this.plugin.presetManager.updatePreset(preset.id, preset.name, preset.description || '');
                        this.plugin.settingsTab.display();
                        new Notice(t().settingsTab.presetSettings.overwriteSuccess(preset.name));
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'overwrite preset' },
                            'Failed to overwrite preset'
                        );
                    }
                }
            });

            const applyScopeBtn = buttonsContainer.createEl('button', {
                text: t().settingsTab.presetSettings.applyScopeButton
            });
            applyScopeBtn.addEventListener('click', () => {
                this.showApplyScopeModal(preset);
            });

            const duplicateBtn = buttonsContainer.createEl('button', {
                text: t().settingsTab.presetSettings.duplicateButton
            });
            duplicateBtn.addEventListener('click', async () => {
                try {
                    const newPreset = await this.plugin.presetManager.duplicatePreset(preset.id);
                    this.plugin.settingsTab.display();
                    if (newPreset) {
                        new Notice(t().settingsTab.presetSettings.duplicateSuccess(preset.name, newPreset.name));
                    }
                } catch (error) {
                    this.errorHandler.handle(
                        error,
                        ErrorSeverity.ERROR,
                        { category: 'Preset', action: 'duplicate preset' },
                        t().notices.presets.duplicateFailed
                    );
                }
            });

            const exportBtn = buttonsContainer.createEl('button', {
                text: t().settingsTab.presetSettings.exportButton
            });
            exportBtn.addEventListener('click', async () => {
                try {
                    const json = await this.plugin.presetManager.exportPreset(preset.id);
                    this.downloadJSON(json, `preset-${preset.name}.json`);
                } catch (error) {
                    this.errorHandler.handle(
                        error,
                        ErrorSeverity.ERROR,
                        { category: 'Preset', action: 'export preset' },
                        t().notices.presets.exportFailed
                    );
                }
            });

            const deleteBtn = buttonsContainer.createEl('button', {
                text: t().settingsTab.presetSettings.deleteButton,
                cls: 'mod-warning'
            });
            deleteBtn.addEventListener('click', async () => {
                if (confirm(t().settingsTab.presetSettings.deleteConfirm(preset.name))) {
                    try {
                        await this.plugin.presetManager.deletePreset(preset.id);
                        this.plugin.settingsTab.display();
                        new Notice(t().settingsTab.presetSettings.deleteSuccess(preset.name));
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'delete preset' },
                            t().notices.presets.deleteFailed
                        );
                    }
                }
            });
        });

        new Setting(containerEl)
            .setName(t().settingsTab.presets.importPreset)
            .setDesc(t().settingsTab.settingsManagement.importDescription)
            .addButton(button => button
                .setButtonText(t().settingsTab.presets.importPresetButton)
                .onClick(() => {
                    this.importPreset();
                })
            );
    }

    /**
     * JSON 파일로 다운로드합니다
     */
    private downloadJSON(json: string, filename: string): void {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
        new Notice(t().notices.presets.exported);
    }

    /**
     * 프리셋을 가져옵니다
     */
    private importPreset(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                await this.plugin.presetManager.importPreset(text);

                this.plugin.settingsTab.display();
                new Notice(t().notices.presets.imported);
            } catch (error) {
                this.errorHandler.handle(
                    error,
                    ErrorSeverity.ERROR,
                    { category: 'Preset', action: 'import preset' },
                    t().notices.presets.importFailed
                );
            }
        });

        input.click();
    }

    /**
     * 프리셋 매핑 설정을 추가합니다
     */
    private addPresetMapping(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setHeading()
            .setName(t().settingsTab.presetSettings.priorityDivider);

        // 우선순위 설정을 가장 먼저 표시
        this.addPriorityModeSettings(containerEl);

        // 통합된 매핑 목록 표시
        this.addUnifiedMappingList(containerEl);
    }

    /**
     * 프리셋 우선순위 설정을 추가합니다
     */
    private addPriorityModeSettings(containerEl: HTMLElement): void {
        const settings = this.plugin.settings.presetPriority;

        // 우선순위 모드 선택
        new Setting(containerEl)
            .setName(t().settingsTab.presets.priorityMode)
            .setDesc(t().settingsTab.presets.priorityModeDescription)
            .addDropdown(dropdown => dropdown
                .addOption('auto', t().settingsTab.presetSettings.priorityOptions.auto)
                .addOption('semi-auto', t().settingsTab.presetSettings.priorityOptions.semiAuto)
                .addOption('manual', t().settingsTab.presetSettings.priorityOptions.manual)
                .setValue(settings.mode)
                .onChange(async (value: 'auto' | 'semi-auto' | 'manual') => {
                    this.plugin.settings.presetPriority.mode = value;
                    await this.plugin.saveSettings();
                    this.plugin.settingsTab.display();
                })
            );

        // 자동 모드 설명
        if (settings.mode === 'auto') {
            const descEl = containerEl.createDiv({ cls: 'setting-item-description'});
            descEl.style.marginTop = '10px';
            descEl.style.padding = '12px';
            descEl.style.background = 'var(--background-secondary)';
            descEl.style.borderRadius = '6px';
            descEl.innerHTML = t().settingsTab.presetSettings.autoModeExplanationHtml;
        }

        // 반자동 모드 설명 및 타입 우선순위 설정
        if (settings.mode === 'semi-auto') {
            const descEl = containerEl.createDiv({ cls: 'setting-item-description'});
            descEl.style.marginTop = '10px';
            descEl.style.padding = '12px';
            descEl.style.background = 'var(--background-secondary)';
            descEl.style.borderRadius = '6px';
            descEl.innerHTML = t().settingsTab.presetSettings.semiAutoModeExplanationHtml;

            // 반자동 모드에서 타입 우선순위 설정 표시
            new Setting(containerEl)
                .setName(t().settingsTab.presets.preferredPriorityType)
                .setDesc(t().settingsTab.presets.preferredPriorityTypeDescription)
                .addDropdown(dropdown => dropdown
                    .addOption('folder', t().settingsTab.presetSettings.priorityTypeOptions.folder)
                    .addOption('tag', t().settingsTab.presetSettings.priorityTypeOptions.tag)
                    .addOption('property', t().settingsTab.presetSettings.priorityTypeOptions.property)
                    .addOption('date', t().settingsTab.presetSettings.priorityTypeOptions.date)
                    .setValue(settings.preferredType)
                    .onChange(async (value: 'folder' | 'tag' | 'property' | 'date') => {
                        this.plugin.settings.presetPriority.preferredType = value;
                        await this.plugin.saveSettings();
                        this.plugin.settingsTab.display();
                    })
                );
        }

        // 수동 모드 설명
        if (settings.mode === 'manual') {
            const statusEl = containerEl.createDiv({ cls: 'setting-item-description'});
            statusEl.style.marginTop = '10px';
            statusEl.style.padding = '12px';
            statusEl.style.background = 'var(--background-secondary)';
            statusEl.style.borderRadius = '6px';
            statusEl.innerHTML = t().settingsTab.presetSettings.manualModeExplanationHtml;
        }
    }

    /**
     * 통합된 프리셋 매핑 목록을 추가합니다
     */
    private addUnifiedMappingList(containerEl: HTMLElement): void {
        const mappingContainer = containerEl.createEl('div', {
            cls: 'card-navigator-preset-mapping unified-mapping-list'
        });

        mappingContainer.createEl('h4', { text: t().settingsTab.presetSettings.presetMappingsTitle });

        mappingContainer.createEl('p', {
            cls: 'setting-item-description',
            text: t().settingsTab.presetSettings.presetMappingsDescription
        });

        // 모든 매핑을 가져와서 ID 기준으로 정렬 (settings.presetMappings 배열 순서대로)
        const allMappings = this.plugin.presetManager.getAllMappings();

        if (allMappings.length > 0) {
            const levelsContainerEl = mappingContainer.createEl('div', {
                cls: 'multi-sort-levels-container preset-mappings-container',
                attr: { style: 'margin-bottom: 12px;' }
            });

            this.renderUnifiedMappings(levelsContainerEl, allMappings);
        } else {
            mappingContainer.createEl('p', {
                cls: 'setting-item-description',
                text: t().settingsTab.presetSettings.noMappingsYet
            });
        }

        // 매핑 추가 버튼들
        const addButtonsContainer = mappingContainer.createEl('div', {
            cls: 'preset-mapping-add-buttons',
            attr: { style: 'display: flex; gap: 8px; margin-top: 12px;' }
        });

        new Setting(addButtonsContainer)
            .addButton(button => button
                .setButtonText(t().settingsTab.presetSettings.addFolderButton)
                .onClick(() => {
                    this.showFolderMappingModal();
                })
            )
            .addButton(button => button
                .setButtonText(t().settingsTab.presetSettings.addTagButton)
                .onClick(() => {
                    this.showTagMappingModal();
                })
            )
            .addButton(button => button
                .setButtonText(t().settingsTab.presetSettings.addPropertyButton)
                .onClick(() => {
                    this.showPropertyMappingModal();
                })
            )
            .addButton(button => button
                .setButtonText(t().settingsTab.presetSettings.addDateButton)
                .onClick(() => {
                    this.showDateMappingModal();
                })
            );
    }

    /**
     * 통합 매핑 목록을 렌더링합니다
     */
    private renderUnifiedMappings(containerEl: HTMLElement, mappings: PresetMapping[]): void {
        containerEl.empty();

        let draggedIndex: number | null = null;

        mappings.forEach((mapping, index) => {
            const mappingEl = this.createUnifiedMappingElement(mapping, index, mappings.length, draggedIndex);

            // Drag events
            mappingEl.addEventListener('dragstart', (e) => {
                draggedIndex = index;
                mappingEl.addClass('dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                }
            });

            mappingEl.addEventListener('dragend', () => {
                mappingEl.removeClass('dragging');
                draggedIndex = null;
            });

            mappingEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) {
                    mappingEl.addClass('drag-over');
                }
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
            });

            mappingEl.addEventListener('dragleave', () => {
                mappingEl.removeClass('drag-over');
            });

            mappingEl.addEventListener('drop', async (e) => {
                e.preventDefault();
                mappingEl.removeClass('drag-over');

                if (draggedIndex !== null && draggedIndex !== index && mapping.id) {
                    const draggedMapping = mappings[draggedIndex];
                    if (draggedMapping.id) {
                        await this.plugin.presetManager.reorderMapping(draggedMapping.id, index);
                        this.plugin.settingsTab.display();
                    }
                }
            });

            containerEl.appendChild(mappingEl);
        });
    }

    /**
     * 통합 매핑 항목 요소를 생성합니다
     */
    private createUnifiedMappingElement(
        mapping: PresetMapping,
        index: number,
        totalCount: number,
        draggedIndex: number | null
    ): HTMLElement {
        const mappingEl = document.createElement('div');
        mappingEl.className = 'multi-sort-level-item preset-mapping-item';
        mappingEl.draggable = true;

        // Drag handle
        const dragHandle = mappingEl.createEl('div', {
            cls: 'multi-sort-drag-handle',
            attr: { 'aria-label': 'Drag to reorder' }
        });
        setIcon(dragHandle, 'grip-vertical');

        // Type icon
        const typeIcon = mappingEl.createEl('div', {
            cls: 'preset-mapping-type-icon'
        });
        const iconName = mapping.type === 'folder' ? 'folder' :
                         mapping.type === 'tag' ? 'tag' :
                         mapping.type === 'property' ? 'file-text' :
                         'calendar';
        setIcon(typeIcon, iconName);

        // Content container
        const contentContainer = mappingEl.createEl('div', {
            cls: 'multi-sort-level-content preset-mapping-content'
        });

        // Target display
        const targetText = this.getMappingTargetDisplay(mapping);
        contentContainer.createEl('div', {
            cls: 'preset-mapping-target',
            text: targetText
        });

        // Preset name
        const preset = this.plugin.presetManager.getPreset(mapping.presetId);
        const presetName = preset ? preset.name : 'Deleted Preset';
        contentContainer.createEl('div', {
            cls: 'preset-mapping-preset-name setting-item-description',
            text: `→ ${presetName}`
        });

        // Edit button
        const editBtn = mappingEl.createEl('div', {
            cls: 'clickable-icon multi-sort-edit-btn',
            attr: { 'aria-label': 'Edit mapping' }
        });
        setIcon(editBtn, 'pencil');
        editBtn.addEventListener('click', () => {
            this.showEditMappingModal(mapping);
        });

        // Delete button
        const deleteBtn = mappingEl.createEl('div', {
            cls: 'clickable-icon multi-sort-delete-btn',
            attr: { 'aria-label': 'Remove mapping' }
        });
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.addEventListener('click', async () => {
            if (mapping.id) {
                const targetDisplay = this.getMappingTargetDisplay(mapping);
                if (confirm(t().settingsTab.presetSettings.deleteMappingConfirm(targetDisplay))) {
                    await this.plugin.presetManager.removeMapping(mapping.id);
                    this.plugin.settingsTab.display();
                }
            }
        });

        return mappingEl;
    }

    /**
     * 매핑의 타겟 표시 텍스트를 생성합니다
     */
    private getMappingTargetDisplay(mapping: PresetMapping): string {
        switch (mapping.type) {
            case 'folder': {
                const folderText = mapping.target || 'Root';
                return mapping.includeSubfolders ? `${folderText} (+ subfolders)` : folderText;
            }
            case 'tag':
                return `#${mapping.target}`;
            case 'property':
                return `${mapping.target} = ${mapping.propertyValue}`;
            case 'date': {
                const criteria = mapping.dateCriteria === 'created-date' ? 'Created' :
                               mapping.dateCriteria === 'modified-date' ? 'Modified' :
                               mapping.datePropertyName || 'Date';
                if (mapping.useRelativeDate) {
                    return `${criteria}: Last ${mapping.relativeDays} days`;
                } else {
                    const from = mapping.dateFrom || 'any';
                    const to = mapping.dateTo || 'any';
                    return `${criteria}: ${from} ~ ${to}`;
                }
            }
            default:
                return mapping.target;
        }
    }

    /**
     * Property 매핑 추가 모달을 표시합니다
     */
    private showPropertyMappingModal(): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presetSettings.propertyMappingTitle);

        let propertyName = '';
        let propertyValue = '';
        let selectedPresetId = '';

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presetSettings.propertyName)
            .setDesc(t().settingsTab.presetSettings.propertyNameDescription)
            .addText(text => text
                .setPlaceholder(t().settingsTab.presetSettings.propertyNamePlaceholder)
                .onChange(value => {
                    propertyName = value;
                })
            );

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presetSettings.propertyValue)
            .setDesc(t().settingsTab.presetSettings.propertyValueDescription)
            .addText(text => text
                .setPlaceholder(t().settingsTab.presetSettings.propertyValuePlaceholder)
                .onChange(value => {
                    propertyValue = value;
                })
            );

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectPreset)
            .setDesc(t().settingsTab.presets.selectPresetDescription)
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();

                if (presets.length === 0) {
                    dropdown.addOption('', t().settingsTab.presetSettings.noPresets);
                    dropdown.setDisabled(true);
                } else {
                    presets.forEach((preset: Preset) => {
                        dropdown.addOption(preset.id, preset.name);
                    });

                    dropdown.onChange(value => {
                        selectedPresetId = value;
                    });

                    selectedPresetId = presets[0].id;
                }
            });

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    if (!propertyName || !propertyValue) {
                        new Notice(t().settingsTab.presetSettings.enterPropertyNameAndValue);
                        return;
                    }

                    if (!selectedPresetId) {
                        new Notice(t().notices.presets.selectPreset);
                        return;
                    }

                    const mapping: PresetMapping = {
                        type: 'property',
                        target: propertyName,
                        propertyValue: propertyValue,
                        presetId: selectedPresetId,
                        priority: 0
                    };

                    await this.plugin.presetManager.addMapping(mapping);
                    modal.close();
                    this.plugin.settingsTab.display();
                    new Notice(t().settingsTab.presetSettings.propertyMappingAdded);
                })
            );

        modal.open();

        // Enter 키로 확인
        modal.contentEl.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();

                if (!propertyName || !propertyValue) {
                    new Notice(t().settingsTab.presetSettings.enterPropertyNameAndValue);
                    return;
                }

                if (!selectedPresetId) {
                    new Notice(t().notices.presets.selectPreset);
                    return;
                }

                const mapping: PresetMapping = {
                    type: 'property',
                    target: propertyName,
                    propertyValue: propertyValue,
                    presetId: selectedPresetId,
                    priority: 0
                };

                await this.plugin.presetManager.addMapping(mapping);
                modal.close();
                this.plugin.settingsTab.display();
                new Notice(t().settingsTab.presetSettings.propertyMappingAdded);
            }
        });
    }

    /**
     * Date 매핑 추가 모달을 표시합니다
     */
    private showDateMappingModal(): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presetSettings.dateMappingTitle);

        let dateCriteria: 'created-date' | 'modified-date' | 'property' = 'created-date';
        let datePropertyName = '';
        let useRelativeDate = true;
        let relativeDays = 7;
        let dateFrom = '';
        let dateTo = '';
        let selectedPresetId = '';

        const renderDateInputs = (container: HTMLElement) => {
            container.empty();

            if (useRelativeDate) {
                new Setting(container)
                    .setName(t().settingsTab.presetSettings.relativeDays)
                    .setDesc(t().settingsTab.presetSettings.relativeDaysDescription)
                    .addText(text => text
                        .setPlaceholder(t().settingsTab.presetSettings.relativeDaysPlaceholder)
                        .setValue(String(relativeDays))
                        .onChange(value => {
                            relativeDays = parseInt(value) || 7;
                        })
                    );
            } else {
                new Setting(container)
                    .setName(t().settingsTab.presetSettings.dateFrom)
                    .setDesc(t().settingsTab.presetSettings.dateFromDescription)
                    .addText(text => text
                        .setPlaceholder(t().settingsTab.presetSettings.dateFromPlaceholder)
                        .onChange(value => {
                            dateFrom = value;
                        })
                    );

                new Setting(container)
                    .setName(t().settingsTab.presetSettings.dateTo)
                    .setDesc(t().settingsTab.presetSettings.dateToDescription)
                    .addText(text => text
                        .setPlaceholder(t().settingsTab.presetSettings.dateToPlaceholder)
                        .onChange(value => {
                            dateTo = value;
                        })
                    );
            }
        };

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presetSettings.dateCriteria)
            .setDesc(t().settingsTab.presetSettings.dateCriteriaDescription)
            .addDropdown(dropdown => dropdown
                .addOption('created-date', t().settingsTab.presetSettings.dateCriteriaCreated)
                .addOption('modified-date', t().settingsTab.presetSettings.dateCriteriaModified)
                .addOption('property', t().settingsTab.presetSettings.dateCriteriaProperty)
                .setValue(dateCriteria)
                .onChange((value: 'created-date' | 'modified-date' | 'property') => {
                    dateCriteria = value;
                    propertyContainer.style.display = value === 'property' ? 'block' : 'none';
                })
            );

        const propertyContainer = modal.contentEl.createDiv();
        propertyContainer.style.display = 'none';

        new Setting(propertyContainer)
            .setName(t().settingsTab.presetSettings.datePropertyName)
            .setDesc(t().settingsTab.presetSettings.datePropertyNameDescription)
            .addText(text => text
                .setPlaceholder(t().settingsTab.presetSettings.datePropertyNamePlaceholder)
                .onChange(value => {
                    datePropertyName = value;
                })
            );

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presetSettings.dateType)
            .setDesc(t().settingsTab.presetSettings.dateTypeDescription)
            .addDropdown(dropdown => dropdown
                .addOption('relative', t().settingsTab.presetSettings.dateTypeRelative)
                .addOption('absolute', t().settingsTab.presetSettings.dateTypeAbsolute)
                .setValue('relative')
                .onChange(value => {
                    useRelativeDate = value === 'relative';
                    renderDateInputs(dateInputContainer);
                })
            );

        const dateInputContainer = modal.contentEl.createDiv();
        renderDateInputs(dateInputContainer);

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectPreset)
            .setDesc(t().settingsTab.presets.selectPresetDescription)
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();

                if (presets.length === 0) {
                    dropdown.addOption('', t().settingsTab.presetSettings.noPresets);
                    dropdown.setDisabled(true);
                } else {
                    presets.forEach((preset: Preset) => {
                        dropdown.addOption(preset.id, preset.name);
                    });

                    dropdown.onChange(value => {
                        selectedPresetId = value;
                    });

                    selectedPresetId = presets[0].id;
                }
            });

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    if (!selectedPresetId) {
                        new Notice(t().notices.presets.selectPreset);
                        return;
                    }

                    if (dateCriteria === 'property' && !datePropertyName) {
                        new Notice(t().settingsTab.presetSettings.enterDatePropertyName);
                        return;
                    }

                    const mapping: PresetMapping = {
                        type: 'date',
                        target: dateCriteria === 'property' ? datePropertyName : dateCriteria,
                        dateCriteria,
                        datePropertyName: dateCriteria === 'property' ? datePropertyName : undefined,
                        useRelativeDate,
                        relativeDays: useRelativeDate ? relativeDays : undefined,
                        dateFrom: !useRelativeDate ? dateFrom : undefined,
                        dateTo: !useRelativeDate ? dateTo : undefined,
                        presetId: selectedPresetId,
                        priority: 0
                    };

                    await this.plugin.presetManager.addMapping(mapping);
                    modal.close();
                    this.plugin.settingsTab.display();
                    new Notice(t().settingsTab.presetSettings.dateMappingAdded);
                })
            );

        modal.open();

        // Enter 키로 확인
        modal.contentEl.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();

                if (!selectedPresetId) {
                    new Notice(t().notices.presets.selectPreset);
                    return;
                }

                if (dateCriteria === 'property' && !datePropertyName) {
                    new Notice(t().settingsTab.presetSettings.enterDatePropertyName);
                    return;
                }

                const mapping: PresetMapping = {
                    type: 'date',
                    target: dateCriteria === 'property' ? datePropertyName : dateCriteria,
                    dateCriteria,
                    datePropertyName: dateCriteria === 'property' ? datePropertyName : undefined,
                    useRelativeDate,
                    relativeDays: useRelativeDate ? relativeDays : undefined,
                    dateFrom: !useRelativeDate ? dateFrom : undefined,
                    dateTo: !useRelativeDate ? dateTo : undefined,
                    presetId: selectedPresetId,
                    priority: 0
                };

                await this.plugin.presetManager.addMapping(mapping);
                modal.close();
                this.plugin.settingsTab.display();
                new Notice(t().settingsTab.presetSettings.dateMappingAdded);
            }
        });
    }

    /**
     * 폴더 프리셋 매핑을 추가합니다
     */
    private addFolderMapping(containerEl: HTMLElement): void {
        const mappingContainer = containerEl.createEl('div', {
            cls: 'card-navigator-preset-mapping'
        });

        mappingContainer.createEl('h4', { text: t().settingsTab.presetSettings.folderMappingDivider });

        const folderMappings = this.plugin.presetManager
            .getMappingsByType('folder')
            .sort((a: PresetMapping, b: PresetMapping) => a.priority - b.priority);

        if (folderMappings.length > 0) {
            folderMappings.forEach((mapping: PresetMapping, index: number) => {
                this.renderMappingItem(
                    mappingContainer,
                    mapping,
                    index,
                    folderMappings.length
                );
            });
        } else {
            mappingContainer.createEl('p', {
                cls: 'setting-item-description',
                text: t().settingsTab.presets.addFolderMappingDescription
            });
        }

        new Setting(mappingContainer)
            .setName(t().settingsTab.presets.addFolderMapping)
            .setDesc(t().settingsTab.presets.addFolderMappingDescription)
            .addButton(button => button
                .setButtonText(t().settingsTab.presets.addMappingButton)
                .onClick(() => {
                    this.showFolderMappingModal();
                })
            );
    }

    /**
     * 태그 프리셋 매핑을 추가합니다
     */
    private addTagMapping(containerEl: HTMLElement): void {
        const mappingContainer = containerEl.createEl('div', {
            cls: 'card-navigator-preset-mapping'
        });

        mappingContainer.createEl('h4', { text: t().settingsTab.presetSettings.tagMappingDivider });

        const tagMappings = this.plugin.presetManager
            .getMappingsByType('tag')
            .sort((a: PresetMapping, b: PresetMapping) => a.priority - b.priority);

        if (tagMappings.length > 0) {
            tagMappings.forEach((mapping: PresetMapping, index: number) => {
                this.renderMappingItem(
                    mappingContainer,
                    mapping,
                    index,
                    tagMappings.length
                );
            });
        } else {
            mappingContainer.createEl('p', {
                cls: 'setting-item-description',
                text: t().settingsTab.presets.addTagMappingDescription
            });
        }

        new Setting(mappingContainer)
            .setName(t().settingsTab.presets.addTagMapping)
            .setDesc(t().settingsTab.presets.addTagMappingDescription)
            .addButton(button => button
                .setButtonText(t().settingsTab.presets.addMappingButton)
                .onClick(() => {
                    this.showTagMappingModal();
                })
            );
    }

    /**
     * 매핑 항목을 렌더링합니다
     */
    private renderMappingItem(
        container: HTMLElement,
        mapping: PresetMapping,
        index: number,
        totalCount: number
    ): void {
        const mappingItem = container.createDiv({ cls: 'card-navigator-mapping-item'});

        const infoContainer = mappingItem.createDiv({ cls: 'mapping-info'});

        const targetEl = infoContainer.createEl('div', {
            cls: 'mapping-target'
        });

        const iconEl = targetEl.createSpan({ cls: 'mapping-icon'});
        setIcon(iconEl, mapping.type === 'folder' ? 'folder' : 'tag');

        const targetText = mapping.type === 'folder'
            ? (mapping.target || t().settingsTab.presetSettings.root)
            : `#${mapping.target}`;
        targetEl.createSpan({
            text: targetText,
            cls: 'mapping-target-text'
        });

        if (mapping.type === 'folder' && mapping.includeSubfolders) {
            targetEl.createSpan({
                text: ` ${t().settingsTab.presetSettings.mappingIncludesSubfolders}`,
                cls: 'mapping-subfolder-badge'
            });
        }

        const preset = this.plugin.presetManager.getPreset(mapping.presetId);
        const presetName = preset ? preset.name : t().settingsTab.presetSettings.deletedPreset;
        infoContainer.createEl('div', {
            text: `→ ${t().settingsTab.presetSettings.presetLabel} ${presetName}`,
            cls: 'mapping-preset-name setting-item-description'
        });

        const buttonsContainer = mappingItem.createDiv({ cls: 'mapping-buttons'});

        if (index > 0) {
            const upBtn = buttonsContainer.createEl('button', {
                cls: 'mapping-priority-btn'
            });
            setIcon(upBtn, 'chevron-up');
            upBtn.title = t().uiLabels.presets.priorityUp;
            upBtn.addEventListener('click', async () => {
                await this.moveMappingUp(mapping, index);
            });
        }

        if (index < totalCount - 1) {
            const downBtn = buttonsContainer.createEl('button', {
                cls: 'mapping-priority-btn'
            });
            setIcon(downBtn, 'chevron-down');
            downBtn.title = t().uiLabels.presets.priorityDown;
            downBtn.addEventListener('click', async () => {
                await this.moveMappingDown(mapping, index);
            });
        }

        const deleteBtn = buttonsContainer.createEl('button', {
            cls: 'mod-warning mapping-delete-btn'
        });
        setIcon(deleteBtn, 'trash');
        deleteBtn.title = t().uiLabels.presets.deleteMapping;
        deleteBtn.addEventListener('click', async () => {
            await this.deleteMapping(mapping);
        });
    }

    /**
     * 폴더 매핑 추가 모달을 표시합니다
     */
    private showFolderMappingModal(): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presets.folderMappingTitle);

        let selectedFolder = '';
        let selectedPresetId = '';
        let includeSubfolders = false;

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectFolder)
            .setDesc(t().settingsTab.presets.selectFolderDescription)
            .addDropdown(dropdown => {
                dropdown.addOption('', t().settingsTab.presetSettings.rootFolder);

                const folders = this.getAllFolders();
                folders.forEach(folder => {
                    dropdown.addOption(folder.path, folder.path);
                });

                dropdown.onChange(value => {
                    selectedFolder = value;
                });
            });

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectPreset)
            .setDesc(t().settingsTab.presets.selectPresetDescription)
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();


                if (presets.length === 0) {
                    dropdown.addOption('', t().settingsTab.presetSettings.noPresets);
                    dropdown.setDisabled(true);
                } else {
                    presets.forEach((preset: Preset) => {
                        dropdown.addOption(preset.id, preset.name);
                    });

                    dropdown.onChange(value => {
                        selectedPresetId = value;
                    });

                    selectedPresetId = presets[0].id;
                }
            });

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.includeSubfolders)
            .setDesc(t().settingsTab.presets.includeSubfoldersDescription)
            .addToggle(toggle => toggle
                .setValue(false)
                .onChange(value => {
                    includeSubfolders = value;
                })
            );

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    if (!selectedPresetId) {
                        new Notice(t().notices.presets.selectPreset);
                        return;
                    }

                    try {
                        await this.addFolderMappingToManager(
                            selectedFolder,
                            selectedPresetId,
                            includeSubfolders
                        );

                        modal.close();
                        this.plugin.settingsTab.display();
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'add folder mapping' },
                            t().notices.presets.folderMappingAddFailed
                        );
                    }
                })
            );

        modal.open();

        // Enter 키로 확인
        modal.contentEl.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();

                if (!selectedPresetId) {
                    new Notice(t().notices.presets.selectPreset);
                    return;
                }

                try {
                    await this.addFolderMappingToManager(
                        selectedFolder,
                        selectedPresetId,
                        includeSubfolders
                    );

                    modal.close();
                    this.plugin.settingsTab.display();
                } catch (error) {
                    this.errorHandler.handle(
                        error,
                        ErrorSeverity.ERROR,
                        { category: 'Preset', action: 'add folder mapping' },
                        t().notices.presets.folderMappingAddFailed
                    );
                }
            }
        });
    }

    /**
     * 태그 매핑 추가 모달을 표시합니다
     */
    private showTagMappingModal(): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presets.tagMappingTitle);

        let tagName = '';
        let selectedPresetId = '';

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.tagLabel)
            .setDesc(t().settingsTab.presets.tagDescription)
            .addText(text => text
                .setPlaceholder(t().settingsTab.presetSettings.tagPlaceholder)
                .onChange(value => {
                    tagName = value.replace(/^#+/, '');
                })
            );

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectPreset)
            .setDesc(t().settingsTab.presets.selectPresetDescription)
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();


                if (presets.length === 0) {
                    dropdown.addOption('', t().settingsTab.presetSettings.noPresets);
                    dropdown.setDisabled(true);
                } else {
                    presets.forEach((preset: Preset) => {
                        dropdown.addOption(preset.id, preset.name);
                    });

                    dropdown.onChange(value => {
                        selectedPresetId = value;
                    });

                    selectedPresetId = presets[0].id;
                }
            });

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    if (!tagName) {
                        new Notice(t().notices.presets.enterTag);
                        return;
                    }

                    if (!selectedPresetId) {
                        new Notice(t().notices.presets.selectPreset);
                        return;
                    }

                    try {
                        await this.addTagMappingToManager(
                            tagName,
                            selectedPresetId
                        );

                        modal.close();
                        this.plugin.settingsTab.display();
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'add tag mapping' },
                            t().notices.presets.tagMappingAddFailed
                        );
                    }
                })
            );

        modal.open();

        // Enter 키로 확인
        modal.contentEl.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();

                if (!tagName) {
                    new Notice(t().notices.presets.enterTag);
                    return;
                }

                if (!selectedPresetId) {
                    new Notice(t().notices.presets.selectPreset);
                    return;
                }

                try {
                    await this.addTagMappingToManager(
                        tagName,
                        selectedPresetId
                    );

                    modal.close();
                    this.plugin.settingsTab.display();
                } catch (error) {
                    this.errorHandler.handle(
                        error,
                        ErrorSeverity.ERROR,
                        { category: 'Preset', action: 'add tag mapping' },
                        t().notices.presets.tagMappingAddFailed
                    );
                }
            }
        });
    }

    /**
     * Vault의 모든 폴더를 가져옵니다
     */
    private getAllFolders(): TFolder[] {
        const folders: TFolder[] = [];

        const addFoldersRecursively = (folder: TFolder) => {
            folders.push(folder);

            folder.children.forEach(child => {
                if (child instanceof TFolder) {
                    addFoldersRecursively(child);
                }
            });
        };

        const rootFolder = this.plugin.app.vault.getRoot();
        rootFolder.children.forEach(child => {
            if (child instanceof TFolder) {
                addFoldersRecursively(child);
            }
        });

        return folders;
    }

    /**
     * 폴더 매핑을 PresetManager에 추가합니다
     */
    private async addFolderMappingToManager(
        folderPath: string,
        presetId: string,
        includeSubfolders: boolean
    ): Promise<void> {
        const folderMappings = this.plugin.presetManager.getMappingsByType('folder');
        const priority = folderMappings.length > 0
            ? Math.max(...folderMappings.map((m: PresetMapping) => m.priority)) + 1
            : 0;

        const mapping: PresetMapping = {
            type: 'folder',
            target: folderPath,
            presetId,
            priority,
            includeSubfolders
        };

        await this.plugin.presetManager.addMapping(mapping);
    }

    /**
     * 태그 매핑을 PresetManager에 추가합니다
     */
    private async addTagMappingToManager(
        tagName: string,
        presetId: string
    ): Promise<void> {
        const tagMappings = this.plugin.presetManager.getMappingsByType('tag');
        const priority = tagMappings.length > 0
            ? Math.max(...tagMappings.map((m: PresetMapping) => m.priority)) + 1
            : 0;

        const mapping: PresetMapping = {
            type: 'tag',
            target: tagName,
            presetId,
            priority
        };

        await this.plugin.presetManager.addMapping(mapping);
    }

    /**
     * 매핑을 삭제합니다
     */
    private async deleteMapping(mapping: PresetMapping): Promise<void> {
        const targetDisplay = mapping.type === 'folder'
            ? (mapping.target || t().settingsTab.presetSettings.root)
            : `#${mapping.target}`;

        if (confirm(t().settingsTab.presetSettings.deleteConfirm(targetDisplay))) {
            try {
                await this.plugin.presetManager.removeMapping(mapping.type, mapping.target);

                this.plugin.settingsTab.display();
                new Notice(t().notices.presets.mappingDeleted);
            } catch (error) {
                this.errorHandler.handle(
                    error,
                    ErrorSeverity.ERROR,
                    { category: 'Preset', action: 'delete mapping' },
                    t().notices.presets.mappingDeleteFailed
                );
            }
        }
    }

    /**
     * 매핑의 우선순위를 올립니다
     */
    private async moveMappingUp(mapping: PresetMapping, currentIndex: number): Promise<void> {
        if (currentIndex === 0) return;

        try {
            const allMappings = this.plugin.presetManager
                .getMappingsByType(mapping.type as 'folder' | 'tag')
                .sort((a: PresetMapping, b: PresetMapping) => a.priority - b.priority);

            const prevMapping = allMappings[currentIndex - 1];
            const tempPriority = mapping.priority;

            await this.plugin.presetManager.updateMappingPriority(
                mapping.type,
                mapping.target,
                prevMapping.priority
            );

            await this.plugin.presetManager.updateMappingPriority(
                prevMapping.type,
                prevMapping.target,
                tempPriority
            );

            this.plugin.settingsTab.display();
        } catch (error) {
            this.errorHandler.handle(
                error,
                ErrorSeverity.ERROR,
                { category: 'Preset', action: 'move mapping up' },
                t().notices.presets.priorityChangeFailed
            );
        }
    }

    /**
     * 매핑의 우선순위를 내립니다
     */
    private async moveMappingDown(mapping: PresetMapping, currentIndex: number): Promise<void> {
        const allMappings = this.plugin.presetManager
            .getMappingsByType(mapping.type as 'folder' | 'tag')
            .sort((a: PresetMapping, b: PresetMapping) => a.priority - b.priority);

        if (currentIndex === allMappings.length - 1) return;

        try {
            const nextMapping = allMappings[currentIndex + 1];
            const tempPriority = mapping.priority;

            await this.plugin.presetManager.updateMappingPriority(
                mapping.type,
                mapping.target,
                nextMapping.priority
            );

            await this.plugin.presetManager.updateMappingPriority(
                nextMapping.type,
                nextMapping.target,
                tempPriority
            );

            this.plugin.settingsTab.display();
        } catch (error) {
            this.errorHandler.handle(
                error,
                ErrorSeverity.ERROR,
                { category: 'Preset', action: 'move mapping down' },
                t().notices.presets.priorityChangeFailed
            );
        }
    }

    /**
     * 매핑 편집 모달을 표시합니다
     */
    private showEditMappingModal(mapping: PresetMapping): void {
        switch (mapping.type) {
            case 'folder':
                this.showEditFolderMappingModal(mapping);
                break;
            case 'tag':
                this.showEditTagMappingModal(mapping);
                break;
            case 'property':
                this.showEditPropertyMappingModal(mapping);
                break;
            case 'date':
                this.showEditDateMappingModal(mapping);
                break;
        }
    }

    /**
     * 폴더 매핑 편집 모달을 표시합니다
     */
    private showEditFolderMappingModal(mapping: PresetMapping): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presetSettings.editFolderMappingTitle);

        let selectedFolder = mapping.target || '';
        let selectedPresetId = mapping.presetId;
        let includeSubfolders = mapping.includeSubfolders || false;

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectFolder)
            .setDesc(t().settingsTab.presets.selectFolderDescription)
            .addDropdown(dropdown => {
                dropdown.addOption('', t().settingsTab.presetSettings.rootFolder);

                const folders = this.getAllFolders();
                folders.forEach(folder => {
                    dropdown.addOption(folder.path, folder.path);
                });

                dropdown.setValue(selectedFolder);
                dropdown.onChange(value => {
                    selectedFolder = value;
                });
            });

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectPreset)
            .setDesc(t().settingsTab.presets.selectPresetDescription)
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();

                if (presets.length === 0) {
                    dropdown.addOption('', t().settingsTab.presetSettings.noPresets);
                    dropdown.setDisabled(true);
                } else {
                    presets.forEach((preset: Preset) => {
                        dropdown.addOption(preset.id, preset.name);
                    });

                    dropdown.setValue(selectedPresetId);
                    dropdown.onChange(value => {
                        selectedPresetId = value;
                    });
                }
            });

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.includeSubfolders)
            .setDesc(t().settingsTab.presets.includeSubfoldersDescription)
            .addToggle(toggle => toggle
                .setValue(includeSubfolders)
                .onChange(value => {
                    includeSubfolders = value;
                })
            );

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    if (!selectedPresetId) {
                        new Notice(t().notices.presets.selectPreset);
                        return;
                    }

                    try {
                        if (mapping.id) {
                            await this.plugin.presetManager.removeMapping(mapping.id);
                        }

                        const updatedMapping: PresetMapping = {
                            type: 'folder',
                            target: selectedFolder,
                            presetId: selectedPresetId,
                            priority: mapping.priority,
                            includeSubfolders
                        };

                        await this.plugin.presetManager.addMapping(updatedMapping);
                        modal.close();
                        this.plugin.settingsTab.display();
                        new Notice(t().settingsTab.presetSettings.folderMappingUpdated);
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'edit folder mapping' },
                            'Failed to update folder mapping'
                        );
                    }
                })
            );

        modal.open();

        // Enter 키로 확인
        modal.contentEl.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();

                if (!selectedPresetId) {
                    new Notice(t().notices.presets.selectPreset);
                    return;
                }

                try {
                    if (mapping.id) {
                        await this.plugin.presetManager.removeMapping(mapping.id);
                    }

                    const updatedMapping: PresetMapping = {
                        type: 'folder',
                        target: selectedFolder,
                        presetId: selectedPresetId,
                        priority: mapping.priority,
                        includeSubfolders
                    };

                    await this.plugin.presetManager.addMapping(updatedMapping);
                    modal.close();
                    this.plugin.settingsTab.display();
                    new Notice(t().settingsTab.presetSettings.folderMappingUpdated);
                } catch (error) {
                    this.errorHandler.handle(
                        error,
                        ErrorSeverity.ERROR,
                        { category: 'Preset', action: 'edit folder mapping' },
                        'Failed to update folder mapping'
                    );
                }
            }
        });
    }

    /**
     * 태그 매핑 편집 모달을 표시합니다
     */
    private showEditTagMappingModal(mapping: PresetMapping): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presetSettings.editTagMappingTitle);

        let tagName = mapping.target || '';
        let selectedPresetId = mapping.presetId;

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.tagLabel)
            .setDesc(t().settingsTab.presets.tagDescription)
            .addText(text => {
                text
                    .setPlaceholder(t().settingsTab.presetSettings.tagPlaceholder)
                    .setValue(tagName)
                    .onChange(value => {
                        tagName = value.replace(/^#+/, '');
                    });
            });

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectPreset)
            .setDesc(t().settingsTab.presets.selectPresetDescription)
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();

                if (presets.length === 0) {
                    dropdown.addOption('', t().settingsTab.presetSettings.noPresets);
                    dropdown.setDisabled(true);
                } else {
                    presets.forEach((preset: Preset) => {
                        dropdown.addOption(preset.id, preset.name);
                    });

                    dropdown.setValue(selectedPresetId);
                    dropdown.onChange(value => {
                        selectedPresetId = value;
                    });
                }
            });

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    if (!tagName) {
                        new Notice(t().notices.presets.enterTag);
                        return;
                    }

                    if (!selectedPresetId) {
                        new Notice(t().notices.presets.selectPreset);
                        return;
                    }

                    try {
                        if (mapping.id) {
                            await this.plugin.presetManager.removeMapping(mapping.id);
                        }

                        const updatedMapping: PresetMapping = {
                            type: 'tag',
                            target: tagName,
                            presetId: selectedPresetId,
                            priority: mapping.priority
                        };

                        await this.plugin.presetManager.addMapping(updatedMapping);
                        modal.close();
                        this.plugin.settingsTab.display();
                        new Notice(t().settingsTab.presetSettings.tagMappingUpdated);
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'edit tag mapping' },
                            'Failed to update tag mapping'
                        );
                    }
                })
            );

        modal.open();

        // Enter 키로 확인
        modal.contentEl.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();

                if (!tagName) {
                    new Notice(t().notices.presets.enterTag);
                    return;
                }

                if (!selectedPresetId) {
                    new Notice(t().notices.presets.selectPreset);
                    return;
                }

                try {
                    if (mapping.id) {
                        await this.plugin.presetManager.removeMapping(mapping.id);
                    }

                    const updatedMapping: PresetMapping = {
                        type: 'tag',
                        target: tagName,
                        presetId: selectedPresetId,
                        priority: mapping.priority
                    };

                    await this.plugin.presetManager.addMapping(updatedMapping);
                    modal.close();
                    this.plugin.settingsTab.display();
                    new Notice(t().settingsTab.presetSettings.tagMappingUpdated);
                } catch (error) {
                    this.errorHandler.handle(
                        error,
                        ErrorSeverity.ERROR,
                        { category: 'Preset', action: 'edit tag mapping' },
                        'Failed to update tag mapping'
                    );
                }
            }
        });
    }

    /**
     * Property 매핑 편집 모달을 표시합니다
     */
    private showEditPropertyMappingModal(mapping: PresetMapping): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presetSettings.editPropertyMappingTitle);

        let propertyName = mapping.target || '';
        let propertyValue = mapping.propertyValue || '';
        let selectedPresetId = mapping.presetId;

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presetSettings.propertyName)
            .setDesc(t().settingsTab.presetSettings.propertyNameDescription)
            .addText(text => {
                text
                    .setPlaceholder(t().settingsTab.presetSettings.propertyNamePlaceholder)
                    .setValue(propertyName)
                    .onChange(value => {
                        propertyName = value;
                    });
            });

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presetSettings.propertyValue)
            .setDesc(t().settingsTab.presetSettings.propertyValueDescription)
            .addText(text => {
                text
                    .setPlaceholder(t().settingsTab.presetSettings.propertyValuePlaceholder)
                    .setValue(propertyValue)
                    .onChange(value => {
                        propertyValue = value;
                    });
            });

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectPreset)
            .setDesc(t().settingsTab.presets.selectPresetDescription)
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();

                if (presets.length === 0) {
                    dropdown.addOption('', t().settingsTab.presetSettings.noPresets);
                    dropdown.setDisabled(true);
                } else {
                    presets.forEach((preset: Preset) => {
                        dropdown.addOption(preset.id, preset.name);
                    });

                    dropdown.setValue(selectedPresetId);
                    dropdown.onChange(value => {
                        selectedPresetId = value;
                    });
                }
            });

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    if (!propertyName || !propertyValue) {
                        new Notice(t().settingsTab.presetSettings.enterPropertyNameAndValue);
                        return;
                    }

                    if (!selectedPresetId) {
                        new Notice(t().notices.presets.selectPreset);
                        return;
                    }

                    try {
                        if (mapping.id) {
                            await this.plugin.presetManager.removeMapping(mapping.id);
                        }

                        const updatedMapping: PresetMapping = {
                            type: 'property',
                            target: propertyName,
                            propertyValue: propertyValue,
                            presetId: selectedPresetId,
                            priority: mapping.priority
                        };

                        await this.plugin.presetManager.addMapping(updatedMapping);
                        modal.close();
                        this.plugin.settingsTab.display();
                        new Notice(t().settingsTab.presetSettings.propertyMappingUpdated);
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'edit property mapping' },
                            'Failed to update property mapping'
                        );
                    }
                })
            );

        modal.open();

        // Enter 키로 확인
        modal.contentEl.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();

                if (!propertyName || !propertyValue) {
                    new Notice(t().settingsTab.presetSettings.enterPropertyNameAndValue);
                    return;
                }

                if (!selectedPresetId) {
                    new Notice(t().notices.presets.selectPreset);
                    return;
                }

                try {
                    if (mapping.id) {
                        await this.plugin.presetManager.removeMapping(mapping.id);
                    }

                    const updatedMapping: PresetMapping = {
                        type: 'property',
                        target: propertyName,
                        propertyValue: propertyValue,
                        presetId: selectedPresetId,
                        priority: mapping.priority
                    };

                    await this.plugin.presetManager.addMapping(updatedMapping);
                    modal.close();
                    this.plugin.settingsTab.display();
                    new Notice(t().settingsTab.presetSettings.propertyMappingUpdated);
                } catch (error) {
                    this.errorHandler.handle(
                        error,
                        ErrorSeverity.ERROR,
                        { category: 'Preset', action: 'edit property mapping' },
                        'Failed to update property mapping'
                    );
                }
            }
        });
    }

    /**
     * 프리셋 적용 범위 편집 모달을 표시합니다
     */
    private showApplyScopeModal(preset: Preset): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presetSettings.applyScopeTitle);

        // 현재 적용 범위 가져오기 (없으면 기본값 사용)
        const currentCategories: PresetApplyCategories = preset.applyCategories
            ? { ...preset.applyCategories }
            : { ...DEFAULT_PRESET_APPLY_CATEGORIES };

        // 설명
        modal.contentEl.createEl('p', {
            cls: 'setting-item-description',
            text: t().settingsTab.presetSettings.applyScopeDescription
        });

        // 카테고리별 체크박스
        const categories: Array<{ key: keyof PresetApplyCategories; label: string; desc: string }> = [
            { key: 'mode', label: t().settingsTab.presetSettings.categoryMode, desc: t().settingsTab.presetSettings.categoryModeDesc },
            { key: 'grouping', label: t().settingsTab.presetSettings.categoryGrouping, desc: t().settingsTab.presetSettings.categoryGroupingDesc },
            { key: 'matrix2D', label: t().settingsTab.presetSettings.categoryMatrix2D, desc: t().settingsTab.presetSettings.categoryMatrix2DDesc },
            { key: 'pin', label: t().settingsTab.presetSettings.categoryPin, desc: t().settingsTab.presetSettings.categoryPinDesc },
            { key: 'sort', label: t().settingsTab.presetSettings.categorySort, desc: t().settingsTab.presetSettings.categorySortDesc },
            { key: 'cardContent', label: t().settingsTab.presetSettings.categoryCardContent, desc: t().settingsTab.presetSettings.categoryCardContentDesc },
            { key: 'cardStyle', label: t().settingsTab.presetSettings.categoryCardStyle, desc: t().settingsTab.presetSettings.categoryCardStyleDesc },
            { key: 'layout', label: t().settingsTab.presetSettings.categoryLayout, desc: t().settingsTab.presetSettings.categoryLayoutDesc },
            { key: 'interaction', label: t().settingsTab.presetSettings.categoryInteraction, desc: t().settingsTab.presetSettings.categoryInteractionDesc }
        ];

        for (const category of categories) {
            new Setting(modal.contentEl)
                .setName(category.label)
                .setDesc(category.desc)
                .addToggle(toggle => toggle
                    .setValue(currentCategories[category.key])
                    .onChange(value => {
                        currentCategories[category.key] = value;
                    })
                );
        }

        // 전체 선택/해제 버튼
        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presetSettings.selectAll)
                .onClick(() => {
                    for (const key of Object.keys(currentCategories) as Array<keyof PresetApplyCategories>) {
                        currentCategories[key] = true;
                    }
                    modal.close();
                    this.showApplyScopeModal({ ...preset, applyCategories: currentCategories });
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presetSettings.deselectAll)
                .onClick(() => {
                    for (const key of Object.keys(currentCategories) as Array<keyof PresetApplyCategories>) {
                        currentCategories[key] = false;
                    }
                    modal.close();
                    this.showApplyScopeModal({ ...preset, applyCategories: currentCategories });
                })
            );

        // 확인/취소 버튼
        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    try {
                        await this.plugin.presetManager.updatePresetApplyCategories(preset.id, currentCategories);
                        modal.close();
                        this.plugin.settingsTab.display();
                        new Notice(t().settingsTab.presetSettings.applyScopeUpdated);
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'update apply scope' },
                            'Failed to update preset apply scope'
                        );
                    }
                })
            );

        modal.open();
    }

    /**
     * Date 매핑 편집 모달을 표시합니다
     */
    private showEditDateMappingModal(mapping: PresetMapping): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t().settingsTab.presetSettings.editDateMappingTitle);

        let dateCriteria: 'created-date' | 'modified-date' | 'property' = mapping.dateCriteria || 'created-date';
        let datePropertyName = mapping.datePropertyName || '';
        let useRelativeDate = mapping.useRelativeDate !== undefined ? mapping.useRelativeDate : true;
        let relativeDays = mapping.relativeDays || 7;
        let dateFrom = mapping.dateFrom || '';
        let dateTo = mapping.dateTo || '';
        let selectedPresetId = mapping.presetId;

        const renderDateInputs = (container: HTMLElement) => {
            container.empty();

            if (useRelativeDate) {
                new Setting(container)
                    .setName(t().settingsTab.presetSettings.relativeDays)
                    .setDesc(t().settingsTab.presetSettings.relativeDaysDescription)
                    .addText(text => text
                        .setPlaceholder(t().settingsTab.presetSettings.relativeDaysPlaceholder)
                        .setValue(String(relativeDays))
                        .onChange(value => {
                            relativeDays = parseInt(value) || 7;
                        })
                    );
            } else {
                new Setting(container)
                    .setName(t().settingsTab.presetSettings.dateFrom)
                    .setDesc(t().settingsTab.presetSettings.dateFromDescription)
                    .addText(text => text
                        .setPlaceholder(t().settingsTab.presetSettings.dateFromPlaceholder)
                        .setValue(dateFrom)
                        .onChange(value => {
                            dateFrom = value;
                        })
                    );

                new Setting(container)
                    .setName(t().settingsTab.presetSettings.dateTo)
                    .setDesc(t().settingsTab.presetSettings.dateToDescription)
                    .addText(text => text
                        .setPlaceholder(t().settingsTab.presetSettings.dateToPlaceholder)
                        .setValue(dateTo)
                        .onChange(value => {
                            dateTo = value;
                        })
                    );
            }
        };

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presetSettings.dateCriteria)
            .setDesc(t().settingsTab.presetSettings.dateCriteriaDescription)
            .addDropdown(dropdown => dropdown
                .addOption('created-date', t().settingsTab.presetSettings.dateCriteriaCreated)
                .addOption('modified-date', t().settingsTab.presetSettings.dateCriteriaModified)
                .addOption('property', t().settingsTab.presetSettings.dateCriteriaProperty)
                .setValue(dateCriteria)
                .onChange((value: 'created-date' | 'modified-date' | 'property') => {
                    dateCriteria = value;
                    propertyContainer.style.display = value === 'property' ? 'block' : 'none';
                })
            );

        const propertyContainer = modal.contentEl.createDiv();
        propertyContainer.style.display = dateCriteria === 'property' ? 'block' : 'none';

        new Setting(propertyContainer)
            .setName(t().settingsTab.presetSettings.datePropertyName)
            .setDesc(t().settingsTab.presetSettings.datePropertyNameDescription)
            .addText(text => text
                .setPlaceholder(t().settingsTab.presetSettings.datePropertyNamePlaceholder)
                .setValue(datePropertyName)
                .onChange(value => {
                    datePropertyName = value;
                })
            );

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presetSettings.dateType)
            .setDesc(t().settingsTab.presetSettings.dateTypeDescription)
            .addDropdown(dropdown => dropdown
                .addOption('relative', t().settingsTab.presetSettings.dateTypeRelative)
                .addOption('absolute', t().settingsTab.presetSettings.dateTypeAbsolute)
                .setValue(useRelativeDate ? 'relative' : 'absolute')
                .onChange(value => {
                    useRelativeDate = value === 'relative';
                    renderDateInputs(dateInputContainer);
                })
            );

        const dateInputContainer = modal.contentEl.createDiv();
        renderDateInputs(dateInputContainer);

        new Setting(modal.contentEl)
            .setName(t().settingsTab.presets.selectPreset)
            .setDesc(t().settingsTab.presets.selectPresetDescription)
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();

                if (presets.length === 0) {
                    dropdown.addOption('', t().settingsTab.presetSettings.noPresets);
                    dropdown.setDisabled(true);
                } else {
                    presets.forEach((preset: Preset) => {
                        dropdown.addOption(preset.id, preset.name);
                    });

                    dropdown.setValue(selectedPresetId);
                    dropdown.onChange(value => {
                        selectedPresetId = value;
                    });
                }
            });

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.cancel)
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText(t().settingsTab.presets.confirm)
                .setCta()
                .onClick(async () => {
                    if (!selectedPresetId) {
                        new Notice(t().notices.presets.selectPreset);
                        return;
                    }

                    if (dateCriteria === 'property' && !datePropertyName) {
                        new Notice(t().settingsTab.presetSettings.enterDatePropertyName);
                        return;
                    }

                    try {
                        if (mapping.id) {
                            await this.plugin.presetManager.removeMapping(mapping.id);
                        }

                        const updatedMapping: PresetMapping = {
                            type: 'date',
                            target: dateCriteria === 'property' ? datePropertyName : dateCriteria,
                            dateCriteria,
                            datePropertyName: dateCriteria === 'property' ? datePropertyName : undefined,
                            useRelativeDate,
                            relativeDays: useRelativeDate ? relativeDays : undefined,
                            dateFrom: !useRelativeDate ? dateFrom : undefined,
                            dateTo: !useRelativeDate ? dateTo : undefined,
                            presetId: selectedPresetId,
                            priority: mapping.priority
                        };

                        await this.plugin.presetManager.addMapping(updatedMapping);
                        modal.close();
                        this.plugin.settingsTab.display();
                        new Notice(t().settingsTab.presetSettings.dateMappingUpdated);
                    } catch (error) {
                        this.errorHandler.handle(
                            error,
                            ErrorSeverity.ERROR,
                            { category: 'Preset', action: 'edit date mapping' },
                            'Failed to update date mapping'
                        );
                    }
                })
            );

        modal.open();

        // Enter 키로 확인
        modal.contentEl.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();

                if (!selectedPresetId) {
                    new Notice(t().notices.presets.selectPreset);
                    return;
                }

                if (dateCriteria === 'property' && !datePropertyName) {
                    new Notice(t().settingsTab.presetSettings.enterDatePropertyName);
                    return;
                }

                try {
                    if (mapping.id) {
                        await this.plugin.presetManager.removeMapping(mapping.id);
                    }

                    const updatedMapping: PresetMapping = {
                        type: 'date',
                        target: dateCriteria === 'property' ? datePropertyName : dateCriteria,
                        dateCriteria,
                        datePropertyName: dateCriteria === 'property' ? datePropertyName : undefined,
                        useRelativeDate,
                        relativeDays: useRelativeDate ? relativeDays : undefined,
                        dateFrom: !useRelativeDate ? dateFrom : undefined,
                        dateTo: !useRelativeDate ? dateTo : undefined,
                        presetId: selectedPresetId,
                        priority: mapping.priority
                    };

                    await this.plugin.presetManager.addMapping(updatedMapping);
                    modal.close();
                    this.plugin.settingsTab.display();
                    new Notice(t().settingsTab.presetSettings.dateMappingUpdated);
                } catch (error) {
                    this.errorHandler.handle(
                        error,
                        ErrorSeverity.ERROR,
                        { category: 'Preset', action: 'edit date mapping' },
                        'Failed to update date mapping'
                    );
                }
            }
        });
    }
}

import { Setting, Notice, Modal, setIcon, TFolder, TAbstractFile } from 'obsidian';
import { BaseSettings } from './BaseSettings';
import { TextInputModal } from '../modals/TextInputModal';
import { PresetMapping } from '../../types';
import { DebugLogger } from '../../utils/DebugLogger';
import { t } from '../../i18n';

/**
 * 프리셋 관리 UI
 * 
 * 프리셋 생성, 적용, 삭제 및 폴더/태그별 자동 적용 매핑을 관리합니다.
 */
export class PresetSettings extends BaseSettings {
    private logger: DebugLogger;
    
    constructor(plugin: any) {
        super(plugin);
        this.logger = new DebugLogger(plugin.settings);
    }
    /**
     * 프리셋 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.createHeader(
            containerEl,
            t().settingsTab.presetSettings.title,
            t().settingsTab.presetSettings.description
        );

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
        this.createDivider(containerEl, t().settingsTab.presetSettings.createDivider);

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
            console.error(t().debug.presets.createError, error);
            new Notice(t().notices.presets.createFailed);
        }
    }

    /**
     * 프리셋 목록을 추가합니다
     */
    private addPresetList(containerEl: HTMLElement): void {
        this.createDivider(containerEl, t().settingsTab.presetSettings.title);

        const presets = this.plugin.presetManager.getAllPresets();

        if (presets.length === 0) {
            containerEl.createEl('div', {
                cls: 'setting-item-description',
                text: t().settingsTab.presets.createPresetDescription
            });
            return;
        }

        presets.forEach((preset: any) => {
            const presetContainer = containerEl.createDiv({ cls: 'card-navigator-preset-item'});
            
            const infoContainer = presetContainer.createDiv({ cls: 'preset-info'});
            
            const nameEl = infoContainer.createEl('h4', {
                text: preset.name,
                cls: 'preset-name'
            });
            
            const iconEl = nameEl.createSpan({ cls: 'preset-icon'});
            setIcon(iconEl, 'save');
            
            if (preset.description) {
                infoContainer.createEl('p', {
                    text: preset.description,
                    cls: 'preset-description setting-item-description'
                });
            }
            
            const date = new Date(preset.createdAt);
            infoContainer.createEl('p', {
                text: `${t().settingsTab.presetSettings.createdDate} ${date.toLocaleDateString('ko-KR')}`,
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
                    console.error(t().debug.presets.duplicateError, error);
                    new Notice(t().notices.presets.duplicateFailed);
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
                    console.error(t().debug.presets.exportError, error);
                    new Notice(t().notices.presets.exportFailed);
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
                        console.error(t().debug.presets.deleteError, error);
                        new Notice(t().notices.presets.deleteFailed);
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
                console.error(t().debug.presets.importError, error);
                new Notice(t().notices.presets.importFailed);
            }
        });

        input.click();
    }

    /**
     * 프리셋 매핑 설정을 추가합니다
     */
    private addPresetMapping(containerEl: HTMLElement): void {
        this.createDivider(containerEl, t().settingsTab.presetSettings.priorityDivider);

        // 우선순위 설정을 가장 먼저 표시
        this.addPriorityModeSettings(containerEl);

        containerEl.createEl('p', {
            cls: 'setting-item-description',
            text: t().settingsTab.presets.addFolderMappingDescription
        });

        this.addFolderMapping(containerEl);
        this.addTagMapping(containerEl);

        // 설명
        const infoEl = containerEl.createDiv({ cls: 'setting-item-description'});
        infoEl.style.marginTop = '20px';
        infoEl.style.padding = '12px';
        infoEl.style.background = 'var(--background-primary-alt)';
        infoEl.style.borderRadius = '6px';
        infoEl.innerHTML = t().settingsTab.presetSettings.mappingPriorityRulesHtml;
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
                .addOption('manual', t().settingsTab.presetSettings.priorityOptions.manual)
                .setValue(settings.mode)
                .onChange(async (value: 'auto' | 'manual') => {
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
            descEl.innerHTML = t().settingsTab.presetSettings.priorityRulesHtml;
        }

        // 수동 모드 선택
        if (settings.mode === 'manual') {
            new Setting(containerEl)
                .setName(t().settingsTab.presets.manualPriorityType)
                .setDesc(t().settingsTab.presets.manualPriorityTypeDescription)
                .addToggle(toggle => toggle
                    .setValue(settings.manualType === 'tag-first')
                    .onChange(async (value) => {
                        this.plugin.settings.presetPriority.manualType = 
                            value ? 'tag-first' : 'folder-first';
                        await this.plugin.saveSettings();
                        this.plugin.settingsTab.display();
                    })
                )
                .addExtraButton(button => {
                    const currentType = settings.manualType;
                    setIcon(button.extraSettingsEl, currentType === 'folder-first' ? 'folder' : 'tag');
                    button.setTooltip(
                        currentType === 'folder-first'
                            ? t().settingsTab.presetSettings.priorityTypeOptions.folder
                            : t().settingsTab.presetSettings.priorityTypeOptions.tag
                    );
                });

            // 현재 설정 표시
            const statusEl = containerEl.createDiv({ cls: 'setting-item-description'});
            statusEl.style.marginTop = '10px';
            statusEl.style.padding = '12px';
            statusEl.style.background = 'var(--background-secondary)';
            statusEl.style.borderRadius = '6px';
            statusEl.innerHTML = t().settingsTab.presetSettings.manualModeExplanationHtml;
        }
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
                    presets.forEach((preset: any) => {
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
                        console.error(t().debug.presets.folderMappingAddError, error);
                        new Notice(t().notices.presets.folderMappingAddFailed);
                    }
                })
            );

        modal.open();
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
                    presets.forEach((preset: any) => {
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
                        console.error(t().debug.presets.tagMappingAddError, error);
                        new Notice(t().notices.presets.tagMappingAddFailed);
                    }
                })
            );

        modal.open();
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
                console.error(t().debug.presets.mappingDeleteError, error);
                new Notice(t().notices.presets.mappingDeleteFailed);
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
            console.error(t().debug.presets.priorityChangeError, error);
            new Notice(t().notices.presets.priorityChangeFailed);
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
            console.error(t().debug.presets.priorityChangeError, error);
            new Notice(t().notices.presets.priorityChangeFailed);
        }
    }
}

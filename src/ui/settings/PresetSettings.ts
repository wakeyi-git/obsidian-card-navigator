import { Setting, Notice, Modal, setIcon, TFolder, TAbstractFile } from 'obsidian';
import { BaseSettings } from './BaseSettings';
import { TextInputModal } from '../modals/TextInputModal';
import { PresetMapping } from '../../types';
import { DebugLogger } from '../../utils/DebugLogger';

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
            '프리셋',
            '사용자 설정을 프리셋으로 저장하고 쉽게 불러올 수 있습니다.'
        );

        this.addEnablePresetsToggle(containerEl);

        if (this.plugin.settings.enablePresets) {
            this.addCreatePresetButton(containerEl);
            this.addPresetList(containerEl);
            this.addPresetMapping(containerEl);
        } else {
            containerEl.createEl('div', {
                cls: 'setting-item-description',
                text: '프리셋 기능이 비활성화되어 있습니다. 위의 토글을 활성화하면 프리셋 기능을 사용할 수 있습니다.'
            }).style.marginTop = '20px';
        }
    }

    /**
     * 프리셋 기능 활성화/비활성화 토글을 추가합니다
     */
    private addEnablePresetsToggle(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('프리셋 기능 활성화')
            .setDesc('프리셋 기능을 사용하려면 활성화하세요. 비활성화하면 프리셋 생성, 적용, 자동 매핑이 모두 비활성화됩니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enablePresets)
                .onChange(async (value) => {
                    this.plugin.settings.enablePresets = value;
                    await this.plugin.saveSettings();
                    
                    this.plugin.settingsTab.display();
                    
                    const statusText = value ? '활성화' : '비활성화';
                    new Notice(`프리셋 기능이 ${statusText}되었습니다.`);
                })
            );

        containerEl.createEl('div', { cls: 'setting-item-divider' });
    }

    /**
     * 프리셋 생성 버튼을 추가합니다
     */
    private addCreatePresetButton(containerEl: HTMLElement): void {
        this.createDivider(containerEl, '프리셋 생성');

        new Setting(containerEl)
            .setName('현재 설정으로 프리셋 생성')
            .setDesc('현재 설정을 새로운 프리셋으로 저장합니다')
            .addButton(button => button
                .setButtonText('프리셋 생성')
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
            '프리셋 이름',
            '프리셋의 이름을 입력하세요',
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
        modal.titleEl.setText('프리셋 설명 (선택)');
        
        let description = '';
        let inputEl: HTMLInputElement | null = null;
        
        new Setting(modal.contentEl)
            .setName('설명')
            .setDesc('프리셋에 대한 간단한 설명을 입력하세요 (선택사항)')
            .addText(text => {
                inputEl = text
                    .setPlaceholder('예: 작업용 카드 레이아웃')
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
                .setButtonText('취소')
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText('확인')
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
            
            this.logger.debug('Preset', '프리셋 생성 완료', { name });
            
            this.plugin.settingsTab.display();
            new Notice(`프리셋 "${name}"이(가) 생성되었습니다.`);
        } catch (error) {
            console.error('프리셋 생성 오류:', error);
            new Notice('프리셋 생성에 실패했습니다.');
        }
    }

    /**
     * 프리셋 목록을 추가합니다
     */
    private addPresetList(containerEl: HTMLElement): void {
        this.createDivider(containerEl, '프리셋 목록');

        const presets = this.plugin.presetManager.getAllPresets();
        
        if (presets.length === 0) {
            containerEl.createEl('div', {
                cls: 'setting-item-description',
                text: '저장된 프리셋이 없습니다. 위의 버튼을 클릭하여 새 프리셋을 생성하세요.'
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
                text: `생성일: ${date.toLocaleDateString('ko-KR')}`,
                cls: 'preset-date setting-item-description'
            });
            
            const buttonsContainer = presetContainer.createDiv({ cls: 'preset-buttons'});
            
            const applyBtn = buttonsContainer.createEl('button', {
                text: '적용',
                cls: 'mod-cta'
            });
            applyBtn.addEventListener('click', async () => {
                await this.plugin.presetManager.applyPreset(preset.id);
                this.plugin.settingsTab.display();
                new Notice(`프리셋 "${preset.name}"을(를) 적용했습니다.`);
            });
            
            const duplicateBtn = buttonsContainer.createEl('button', {
                text: '복제'
            });
            duplicateBtn.addEventListener('click', async () => {
                try {
                    await this.plugin.presetManager.duplicatePreset(preset.id);
                    this.plugin.settingsTab.display();
                    new Notice(`프리셋 "${preset.name}"을(를) 복제했습니다.`);
                } catch (error) {
                    console.error('프리셋 복제 오류:', error);
                    new Notice('프리셋 복제에 실패했습니다.');
                }
            });
            
            const exportBtn = buttonsContainer.createEl('button', {
                text: '내보내기'
            });
            exportBtn.addEventListener('click', async () => {
                try {
                    const json = await this.plugin.presetManager.exportPreset(preset.id);
                    this.downloadJSON(json, `preset-${preset.name}.json`);
                } catch (error) {
                    console.error('프리셋 내보내기 오류:', error);
                    new Notice('프리셋 내보내기에 실패했습니다.');
                }
            });
            
            const deleteBtn = buttonsContainer.createEl('button', {
                text: '삭제',
                cls: 'mod-warning'
            });
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`프리셋 "${preset.name}"을(를) 삭제하시겠습니까?`)) {
                    try {
                        await this.plugin.presetManager.deletePreset(preset.id);
                        this.plugin.settingsTab.display();
                        new Notice(`프리셋 "${preset.name}"을(를) 삭제했습니다.`);
                    } catch (error) {
                        console.error('프리셋 삭제 오류:', error);
                        new Notice('프리셋 삭제에 실패했습니다.');
                    }
                }
            });
        });
        
        new Setting(containerEl)
            .setName('프리셋 가져오기')
            .setDesc('JSON 파일에서 프리셋을 가져옵니다')
            .addButton(button => button
                .setButtonText('가져오기')
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
        new Notice('프리셋을 내보냈습니다.');
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
                new Notice('프리셋을 가져왔습니다.');
            } catch (error) {
                console.error('프리셋 가져오기 오류:', error);
                new Notice('프리셋 가져오기에 실패했습니다.');
            }
        });
        
        input.click();
    }

    /**
     * 프리셋 매핑 설정을 추가합니다
     */
    private addPresetMapping(containerEl: HTMLElement): void {
        this.createDivider(containerEl, '자동 적용 매핑');

        // 우선순위 설정을 가장 먼저 표시
        this.addPriorityModeSettings(containerEl);

        containerEl.createEl('p', {
            cls: 'setting-item-description',
            text: '특정 폴더나 태그에 자동으로 적용할 프리셋을 설정합니다.'
        });

        this.addFolderMapping(containerEl);
        this.addTagMapping(containerEl);

        // 설명
        const infoEl = containerEl.createDiv({ cls: 'setting-item-description'});
        infoEl.style.marginTop = '20px';
        infoEl.style.padding = '12px';
        infoEl.style.background = 'var(--background-primary-alt)';
        infoEl.style.borderRadius = '6px';
        infoEl.innerHTML = `
            <strong>💡 매핑 우선순위 규칙</strong><br><br>
            <strong>1. 폴더 vs 태그:</strong> 위의 "우선순위 모드" 설정에 따름<br>
            <strong>2. 같은 종류 내:</strong> 위에 있는 매핑이 우선 적용됨<br><br>
            <span style="color: var(--text-muted); font-size: 0.9em;">
            예: 폴더 목록에서 "프로젝트"가 "프로젝트/중요"보다 위에 있으면,<br>
            "프로젝트/중요/문서.md"에는 "프로젝트" 프리셋이 적용됩니다.
            </span>
        `;
    }

    /**
     * 프리셋 우선순위 설정을 추가합니다
     */
    private addPriorityModeSettings(containerEl: HTMLElement): void {
        const settings = this.plugin.settings.presetPriority;

        // 우선순위 모드 선택
        new Setting(containerEl)
            .setName('우선순위 모드')
            .setDesc('폴더와 태그 프리셋의 우선순위를 자동으로 결정할지, 수동으로 설정할지 선택합니다.')
            .addDropdown(dropdown => dropdown
                .addOption('auto', '자동 (모드에 따라 결정)')
                .addOption('manual', '수동 (사용자 선택)')
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
            descEl.innerHTML = `
                <strong>📌 자동 모드 동작 방식</strong><br><br>
                <strong>폴더 모드:</strong> 태그 프리셋 우선 적용<br>
                <span style="color: var(--text-muted); font-size: 0.9em;">
                → 특정 태그가 더 중요하므로 태그 프리셋을 먼저 적용합니다
                </span><br><br>
                <strong>태그 모드:</strong> 폴더 프리셋 우선 적용<br>
                <span style="color: var(--text-muted); font-size: 0.9em;">
                → 폴더 위치가 더 중요하므로 폴더 프리셋을 먼저 적용합니다
                </span>
            `;
        }

        // 수동 모드 선택
        if (settings.mode === 'manual') {
            new Setting(containerEl)
                .setName('우선 적용할 프리셋 타입')
                .setDesc('폴더 프리셋과 태그 프리셋이 모두 매칭될 때, 어느 것을 우선 적용할지 선택합니다.')
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
                            ? '📁 폴더 프리셋 우선'
                            : '🏷️ 태그 프리셋 우선'
                    );
                });

            // 현재 설정 표시
            const statusEl = containerEl.createDiv({ cls: 'setting-item-description'});
            statusEl.style.marginTop = '10px';
            statusEl.style.padding = '12px';
            statusEl.style.background = 'var(--background-secondary)';
            statusEl.style.borderRadius = '6px';
            
            const icon = settings.manualType === 'folder-first' ? '📁' : '🏷️';
            const typeText = settings.manualType === 'folder-first' 
                ? '폴더 프리셋'
                : '태그 프리셋';
            
            statusEl.innerHTML = `
                <strong>${icon} 현재 설정: ${typeText} 우선</strong><br>
                <span style="color: var(--text-muted); font-size: 0.9em;">
                ${typeText}을 먼저 확인하고, 매칭되지 않으면 
                ${settings.manualType === 'folder-first' ? '태그 프리셋' : '폴더 프리셋'}을 확인합니다.
                </span>
            `;
        }
    }

    /**
     * 폴더 프리셋 매핑을 추가합니다
     */
    private addFolderMapping(containerEl: HTMLElement): void {
        const mappingContainer = containerEl.createEl('div', {
            cls: 'card-navigator-preset-mapping'
        });

        mappingContainer.createEl('h4', { text: '폴더 프리셋' });

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
                text: '매핑된 폴더가 없습니다. 아래 버튼을 클릭하여 폴더 매핑을 추가하세요.'
            });
        }

        new Setting(mappingContainer)
            .setName('폴더 매핑 추가')
            .setDesc('특정 폴더에 프리셋을 매핑합니다')
            .addButton(button => button
                .setButtonText('매핑 추가')
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

        mappingContainer.createEl('h4', { text: '태그 프리셋' });

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
                text: '매핑된 태그가 없습니다. 아래 버튼을 클릭하여 태그 매핑을 추가하세요.'
            });
        }

        new Setting(mappingContainer)
            .setName('태그 매핑 추가')
            .setDesc('특정 태그에 프리셋을 매핑합니다')
            .addButton(button => button
                .setButtonText('매핑 추가')
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
            ? (mapping.target || '(루트)')
            : `#${mapping.target}`;
        targetEl.createSpan({
            text: targetText,
            cls: 'mapping-target-text'
        });

        if (mapping.type === 'folder' && mapping.includeSubfolders) {
            targetEl.createSpan({
                text: ' (하위 폴더 포함)',
                cls: 'mapping-subfolder-badge'
            });
        }

        const preset = this.plugin.presetManager.getPreset(mapping.presetId);
        const presetName = preset ? preset.name : '(삭제된 프리셋)';
        infoContainer.createEl('div', {
            text: `→ 프리셋: ${presetName}`,
            cls: 'mapping-preset-name setting-item-description'
        });

        const buttonsContainer = mappingItem.createDiv({ cls: 'mapping-buttons'});

        if (index > 0) {
            const upBtn = buttonsContainer.createEl('button', {
                cls: 'mapping-priority-btn'
            });
            setIcon(upBtn, 'chevron-up');
            upBtn.title = '우선순위 올리기';
            upBtn.addEventListener('click', async () => {
                await this.moveMappingUp(mapping, index);
            });
        }

        if (index < totalCount - 1) {
            const downBtn = buttonsContainer.createEl('button', {
                cls: 'mapping-priority-btn'
            });
            setIcon(downBtn, 'chevron-down');
            downBtn.title = '우선순위 내리기';
            downBtn.addEventListener('click', async () => {
                await this.moveMappingDown(mapping, index);
            });
        }

        const deleteBtn = buttonsContainer.createEl('button', {
            cls: 'mod-warning mapping-delete-btn'
        });
        setIcon(deleteBtn, 'trash');
        deleteBtn.title = '매핑 삭제';
        deleteBtn.addEventListener('click', async () => {
            await this.deleteMapping(mapping);
        });
    }

    /**
     * 폴더 매핑 추가 모달을 표시합니다
     */
    private showFolderMappingModal(): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText('폴더 프리셋 매핑 추가');

        let selectedFolder = '';
        let selectedPresetId = '';
        let includeSubfolders = false;

        new Setting(modal.contentEl)
            .setName('폴더 선택')
            .setDesc('프리셋을 매핑할 폴더를 선택하세요')
            .addDropdown(dropdown => {
                dropdown.addOption('', '(루트 폴더)');

                const folders = this.getAllFolders();
                folders.forEach(folder => {
                    dropdown.addOption(folder.path, folder.path);
                });

                dropdown.onChange(value => {
                    selectedFolder = value;
                });
            });

        new Setting(modal.contentEl)
            .setName('프리셋 선택')
            .setDesc('자동으로 적용할 프리셋을 선택하세요')
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();
                
                if (presets.length === 0) {
                    dropdown.addOption('', '(프리셋 없음)');
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
            .setName('하위 폴더 포함')
            .setDesc('하위 폴더의 파일에도 이 프리셋을 적용합니다')
            .addToggle(toggle => toggle
                .setValue(false)
                .onChange(value => {
                    includeSubfolders = value;
                })
            );

        new Setting(modal.contentEl)
            .addButton(btn => btn
                .setButtonText('취소')
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText('확인')
                .setCta()
                .onClick(async () => {
                    if (!selectedPresetId) {
                        new Notice('프리셋을 선택하세요.');
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
                        console.error('폴더 매핑 추가 오류:', error);
                        new Notice('폴더 매핑 추가에 실패했습니다.');
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
        modal.titleEl.setText('태그 프리셋 매핑 추가');

        let tagName = '';
        let selectedPresetId = '';

        new Setting(modal.contentEl)
            .setName('태그')
            .setDesc('프리셋을 매핑할 태그를 입력하세요 (# 없이)')
            .addText(text => text
                .setPlaceholder('예: important')
                .onChange(value => {
                    tagName = value.replace(/^#+/, '');
                })
            );

        new Setting(modal.contentEl)
            .setName('프리셋 선택')
            .setDesc('자동으로 적용할 프리셋을 선택하세요')
            .addDropdown(dropdown => {
                const presets = this.plugin.presetManager.getAllPresets();
                
                if (presets.length === 0) {
                    dropdown.addOption('', '(프리셋 없음)');
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
                .setButtonText('취소')
                .onClick(() => {
                    modal.close();
                })
            )
            .addButton(btn => btn
                .setButtonText('확인')
                .setCta()
                .onClick(async () => {
                    if (!tagName) {
                        new Notice('태그를 입력하세요.');
                        return;
                    }

                    if (!selectedPresetId) {
                        new Notice('프리셋을 선택하세요.');
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
                        console.error('태그 매핑 추가 오류:', error);
                        new Notice('태그 매핑 추가에 실패했습니다.');
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
            ? (mapping.target || '(루트)')
            : `#${mapping.target}`;

        if (confirm(`"${targetDisplay}" 매핑을 삭제하시겠습니까?`)) {
            try {
                await this.plugin.presetManager.removeMapping(mapping.type, mapping.target);
                
                this.plugin.settingsTab.display();
                new Notice('매핑이 삭제되었습니다.');
            } catch (error) {
                console.error('매핑 삭제 오류:', error);
                new Notice('매핑 삭제에 실패했습니다.');
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
            console.error('우선순위 변경 오류:', error);
            new Notice('우선순위 변경에 실패했습니다.');
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
            console.error('우선순위 변경 오류:', error);
            new Notice('우선순위 변경에 실패했습니다.');
        }
    }
}

import { TFile, CachedMetadata, TagCache } from 'obsidian';
import { CardNavigatorSettings, Preset, PresetMapping, CardSettings } from '../types';
import CardNavigatorPlugin from '../main';
import { DebugLogger } from '../utils/DebugLogger';
import { t } from '../i18n';

/**
 * 프리셋 관리 매니저
 * 
 * 프리셋의 생성, 수정, 삭제, 적용을 관리하며,
 * 폴더/태그 기반 자동 프리셋 매핑 기능을 제공합니다.
 */
export class PresetManager {
    /** 현재 적용된 프리셋 ID */
    private currentPresetId: string | null = null;
    private logger: DebugLogger;
    
    constructor(private plugin: CardNavigatorPlugin) {
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(() => this.plugin.settingsManager.getSettings());
    }

    /**
     * PresetManager를 초기화합니다
     */
    async initialize(): Promise<void> {
        this.logger.debug('Preset', t().debug.presets.managerInitialized);
    }

    /**
     * PresetManager 상태를 리셋합니다
     */
    reset(): void {
        this.currentPresetId = null;
        this.logger.debug('Preset', t().debug.presets.managerReset);
    }

    /**
     * 현재 적용된 프리셋 ID를 가져옵니다
     * 
     * @returns 프리셋 ID 또는 null
     */
    getCurrentPresetId(): string | null {
        return this.currentPresetId;
    }

    /**
     * 파일에 매핑된 프리셋의 카드 설정을 반환합니다
     * 
     * @param file - 대상 파일
     * @returns 카드 설정 또는 null
     */
    getCardSettingsForFile(file: TFile | null): CardSettings | null {
        if (!file || !this.plugin.settings.enablePresets) {
            return null;
        }
        
        const preset = this.findMatchingPreset(file);
        if (!preset) {
            return null;
        }
        
        return this.extractCardSettings(preset.settings);
    }
    
    /**
     * CardNavigatorSettings에서 CardSettings만 추출합니다
     */
    private extractCardSettings(settings: CardNavigatorSettings): CardSettings {
        return {
            header: settings.header,
            body: settings.body,
            footer: settings.footer,
            renderMode: settings.renderMode,
            normalCardStyle: settings.normalCardStyle,
            activeCardStyle: settings.activeCardStyle,
            focusedCardStyle: settings.focusedCardStyle
        };
    }

    /**
     * 새로운 프리셋을 생성합니다
     * 
     * @param name - 프리셋 이름
     * @param description - 프리셋 설명
     * @returns 생성된 Preset 객체
     */
    createPreset(name: string, description: string = ''): Preset {
        const settings = this.plugin.settings;
        const clonedSettings = this.cloneCurrentSettings();
        
        const preset: Preset = {
            id: this.generateId(),
            name,
            description,
            settings: clonedSettings,
            createdAt: Date.now()
        };

        settings.presets.push(preset);
        this.plugin.saveSettings();

        this.logger.debug('Preset', t().debug.presets.create, {
            name,
            headerNormalStyle: clonedSettings.header.normalStyle,
            bodyNormalStyle: clonedSettings.body.normalStyle,
            footerNormalStyle: clonedSettings.footer.normalStyle
        });
        return preset;
    }

    /**
     * 프리셋을 삭제합니다
     * 
     * @param id - 삭제할 프리셋 ID
     * 
     * @remarks
     * 관련된 모든 매핑도 함께 삭제됩니다.
     */
    async deletePreset(id: string): Promise<void> {
        const settings = this.plugin.settings;
        const index = settings.presets.findIndex(p => p.id === id);

        if (index === -1) {
            this.logger.warn('Preset', t().debug.presets.notFound, id);
            return;
        }

        const deletedPreset = settings.presets[index];
        settings.presets.splice(index, 1);
        
        settings.presetMappings = settings.presetMappings.filter(
            m => m.presetId !== id
        );
        
        if (this.currentPresetId === id) {
            this.currentPresetId = null;
            this.logger.debug('Preset', t().debug.presets.currentPresetDeleted);
        }

        await this.plugin.saveSettings();
        this.logger.debug('Preset', t().debug.presets.deleted, deletedPreset.name);
    }

    /**
     * 프리셋을 업데이트합니다
     * 
     * @param id - 업데이트할 프리셋 ID
     * @param name - 새로운 프리셋 이름
     * @param description - 새로운 프리셋 설명
     */
    async updatePreset(id: string, name: string, description: string): Promise<void> {
        const settings = this.plugin.settings;
        const preset = settings.presets.find(p => p.id === id);

        if (!preset) {
            this.logger.warn('Preset', t().debug.presets.notFound, id);
            return;
        }

        preset.name = name;
        preset.description = description;
        const clonedSettings = this.cloneCurrentSettings();
        preset.settings = clonedSettings;

        await this.plugin.saveSettings();
        this.logger.debug('Preset', t().debug.presets.updated, {
            name,
            headerNormalStyle: clonedSettings.header.normalStyle,
            bodyNormalStyle: clonedSettings.body.normalStyle,
            footerNormalStyle: clonedSettings.footer.normalStyle
        });
    }

    /**
     * 프리셋을 복제합니다
     * 
     * @param id - 복제할 프리셋 ID
     * @returns 복제된 Preset 객체 또는 null
     */
    async duplicatePreset(id: string): Promise<Preset | null> {
        const settings = this.plugin.settings;
        const original = settings.presets.find(p => p.id === id);

        if (!original) {
            this.logger.warn('Preset', t().debug.presets.notFound, id);
            return null;
        }

        const duplicated: Preset = {
            id: this.generateId(),
            name: `${original.name}${t().uiLabels.presets.copySuffix}`,
            description: original.description,
            settings: JSON.parse(JSON.stringify(original.settings)),
            createdAt: Date.now()
        };

        settings.presets.push(duplicated);
        await this.plugin.saveSettings();

        this.logger.debug('Preset', t().debug.presets.duplicated, duplicated.name);
        return duplicated;
    }

    /**
     * 모든 프리셋을 가져옵니다
     * 
     * @returns 프리셋 배열
     */
    getAllPresets(): Preset[] {
        return this.plugin.settings.presets;
    }

    /**
     * ID로 프리셋을 가져옵니다
     * 
     * @param id - 프리셋 ID
     * @returns Preset 객체 또는 undefined
     */
    getPreset(id: string): Preset | undefined {
        return this.plugin.settings.presets.find(p => p.id === id);
    }

    /**
     * 프리셋을 적용합니다
     * 
     * @param id - 적용할 프리셋 ID
     * 
     * @remarks
     * 설정 UI에서 수동으로 프리셋을 적용할 때 사용합니다.
     * 뷰를 즉시 새로고침합니다.
     */
    async applyPreset(id: string): Promise<void> {
        const settings = this.plugin.settings;
        const preset = settings.presets.find(p => p.id === id);

        if (!preset) {
            this.logger.warn('Preset', t().debug.presets.notFound, id);
            return;
        }

        // presets, presetMappings, debug는 제외하고 적용
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { presets, presetMappings, debug, ...settingsToApply } = preset.settings;
        

        Object.assign(settings, this.deepMerge(settings, settingsToApply));

        this.currentPresetId = id;
        this.logger.debug('Preset', t().debug.presets.applied, {
            name: preset.name,
            headerStyle: settingsToApply.header.normalStyle,
            bodyStyle: settingsToApply.body.normalStyle,
            footerStyle: settingsToApply.footer.normalStyle
        });
        
        await this.plugin.saveSettings();
        this.plugin.refreshView();
    }

    /**
     * 파일 변경 시 프리셋을 자동으로 추적합니다
     * 
     * @param file - 현재 활성화된 파일
     * @returns 프리셋이 변경되었으면 true
     * 
     * @remarks
     * 설정을 변경하지 않고 currentPresetId만 업데이트합니다.
     * 카드 렌더링 시 이 정보를 사용하여 파일별로 적절한 프리셋을 적용합니다.
     */
    async autoApplyPreset(file: TFile | null): Promise<boolean> {
        const settings = this.plugin.settings;
        
        if (!settings.enablePresets) {
            return false;
        }

        const previousPresetId = this.currentPresetId;

        if (file === null) {
            this.currentPresetId = null;
            const changed = previousPresetId !== null;
            if (changed) {
                this.logger.debug('Preset', t().debug.presets.changedToNone);
            }
            return changed;
        }

        const preset = this.findMatchingPreset(file);
        
        if (preset) {
            this.currentPresetId = preset.id;
            const changed = previousPresetId !== preset.id;
            if (changed) {
                this.logger.debug('Preset', t().debug.presets.changed, {
                    from: previousPresetId || 'none',
                    to: preset.id
                });
            }
            return changed;
        } else {
            this.currentPresetId = null;
            const changed = previousPresetId !== null;
            if (changed) {
                this.logger.debug('Preset', t().debug.presets.changedToNone);
            }
            return changed;
        }
    }

    /**
     * 프리셋 매핑을 추가합니다
     * 
     * @param mapping - 추가할 프리셋 매핑
     * 
     * @remarks
     * 같은 타입/타겟의 기존 매핑은 자동으로 제거됩니다.
     */
    async addMapping(mapping: PresetMapping): Promise<void> {
        const settings = this.plugin.settings;
        
        settings.presetMappings = settings.presetMappings.filter(
            m => !(m.type === mapping.type && m.target === mapping.target)
        );

        settings.presetMappings.push(mapping);
        await this.plugin.saveSettings();

        this.logger.debug('Preset', t().debug.presets.mappingAdded, { type: mapping.type, target: mapping.target });
    }

    /**
     * 프리셋 매핑을 삭제합니다
     * 
     * @param type - 매핑 타입 ('folder' 또는 'tag')
     * @param target - 매핑 타겟 (폴더 경로 또는 태그 이름)
     */
    async removeMapping(type: string, target: string): Promise<void> {
        const settings = this.plugin.settings;
        
        settings.presetMappings = settings.presetMappings.filter(
            m => !(m.type === type && m.target === target)
        );

        await this.plugin.saveSettings();
        this.logger.debug('Preset', t().debug.presets.mappingDeleted, { type, target });
    }

    /**
     * 타입별 프리셋 매핑을 가져옵니다
     * 
     * @param type - 매핑 타입 ('folder' 또는 'tag')
     * @returns 해당 타입의 매핑 배열
     */
    getMappingsByType(type: 'folder' | 'tag'): PresetMapping[] {
        return this.plugin.settings.presetMappings.filter(m => m.type === type);
    }

    /**
     * 매핑의 우선순위를 업데이트합니다
     * 
     * @param type - 매핑 타입
     * @param target - 매핑 타겟
     * @param newPriority - 새로운 우선순위 값
     */
    async updateMappingPriority(type: 'folder' | 'tag', target: string, newPriority: number): Promise<void> {
        const mapping = this.plugin.settings.presetMappings.find(
            m => m.type === type && m.target === target
        );
        
        if (mapping) {
            mapping.priority = newPriority;
            await this.plugin.saveSettings();
            this.logger.debug('Preset', t().debug.presets.mappingPriorityUpdated, { type, target, newPriority });
        }
    }

    /**
     * 파일에 매칭되는 프리셋을 찾습니다
     * 
     * @param file - 확인할 파일
     * @returns 매칭된 프리셋 또는 null
     * 
     * @remarks
     * 우선순위: 모드 확인 → 우선 타입 검색 → 후순위 타입 검색
     * 낮은 priority 값이 더 높은 우선순위를 가집니다.
     */
    findMatchingPreset(file: TFile): Preset | null {
        if (!file) {
            return null;
        }

        const settings = this.plugin.settings;
        
        // 1. 우선순위 타입 결정
        const priorityType = this.determinePriorityType();
        
        // 2. 우선순위에 따라 폴더/태그 순서 결정
        const searchOrder = priorityType === 'folder-first'
            ? ['folder', 'tag'] as const
            : ['tag', 'folder'] as const;

        this.logger.debug('Preset', t().debug.presets.searchStart, {
            file: file.path,
            priorityType,
            searchOrder
        });
        
        // 3. 우선순위 순서대로 매칭 검색
        for (const type of searchOrder) {
            const mappings = this.getMappingsByType(type)
                .sort((a, b) => a.priority - b.priority);  // 낮은 priority가 우선 (위→아래)

            this.logger.debug('Preset', t().debug.presets.mappingSearch(type), {
                count: mappings.length,
                priorities: mappings.map(m => ({ target: m.target, priority: m.priority }))
            });
            
            for (const mapping of mappings) {
                if (this.isMatch(file, mapping)) {
                    const preset = settings.presets.find(
                        p => p.id === mapping.presetId
                    );

                    if (preset) {
                        this.logger.debug('Preset', t().debug.presets.matchedPreset, {
                            type,
                            target: mapping.target,
                            priority: mapping.priority,
                            preset: preset.name,
                            priorityType
                        });
                        return preset;
                    }
                }
            }
        }

        this.logger.debug('Preset', t().debug.presets.noMatchedPreset);
        return null;
    }

    /**
     * 현재 우선순위 타입을 결정합니다
     * 
     * @returns 'folder-first' 또는 'tag-first'
     */
    private determinePriorityType(): 'folder-first' | 'tag-first' {
        const settings = this.plugin.settings;
        const prioritySettings = settings.presetPriority;
        
        // 수동 모드: 사용자 설정 사용
        if (prioritySettings.mode === 'manual') {
            this.logger.debug('Preset', t().debug.presets.manualPriority, prioritySettings.manualType);
            return prioritySettings.manualType;
        }
        
        // 자동 모드: 현재 모드에 따라 결정
        const currentMode = settings.currentMode;
        
        if (currentMode === 'folder') {
            // 폴더 모드: 태그가 더 구체적이므로 태그 우선
            this.logger.debug('Preset', t().debug.presets.autoPriorityFolderMode);
            return 'tag-first';
        } else {
            // 태그 모드: 폴더가 더 구체적이므로 폴더 우선
            this.logger.debug('Preset', t().debug.presets.autoPriorityTagMode);
            return 'folder-first';
        }
    }

    /**
     * 파일이 매핑과 일치하는지 확인합니다
     */
    private isMatch(file: TFile, mapping: PresetMapping): boolean {
        switch (mapping.type) {
            case 'folder': {
                const folderPath = file.parent?.path || '';
                const folderMatch = mapping.includeSubfolders
                    ? (folderPath === mapping.target || folderPath.startsWith(mapping.target + '/'))
                    : (folderPath === mapping.target);

                this.logger.debug('Preset', t().debug.presets.folderMatched, {
                    file: file.path,
                    folderPath,
                    mappingTarget: mapping.target,
                    includeSubfolders: mapping.includeSubfolders,
                    match: folderMatch
                });

                return folderMatch;
            }

            case 'tag': {
                const cache = this.plugin.app.metadataCache.getFileCache(file);
                const tags = this.getFileTags(cache);

                const normalizedMappingTarget = this.normalizeTag(mapping.target);
                const normalizedTags = tags.map(tag => this.normalizeTag(tag));
                const tagMatch = normalizedTags.includes(normalizedMappingTarget);

                this.logger.debug('Preset', t().debug.presets.tagMatched, {
                    file: file.path,
                    fileTags: tags,
                    normalizedFileTags: normalizedTags,
                    mappingTarget: mapping.target,
                    normalizedMappingTarget,
                    match: tagMatch
                });

                return tagMatch;
            }

            default:
                return false;
        }
    }

    /**
     * 태그를 정규화합니다 (# 접두사 통일)
     */
    private normalizeTag(tag: string): string {
        return tag.startsWith('#') ? tag : `#${tag}`;
    }

    /**
     * 파일의 모든 태그를 가져옵니다
     */
    private getFileTags(cache: CachedMetadata | null): string[] {
        const tags: string[] = [];

        if (cache?.frontmatter?.tags) {
            if (Array.isArray(cache.frontmatter.tags)) {
                const frontmatterTags = cache.frontmatter.tags.map((t: string) =>
                    t.startsWith('#') ? t : `#${t}`
                );
                tags.push(...frontmatterTags);
                this.logger.debug('Preset', t().debug.presets.frontmatterTagsArray, frontmatterTags);
            } else if (typeof cache.frontmatter.tags === 'string') {
                const tag = cache.frontmatter.tags.startsWith('#')
                    ? cache.frontmatter.tags
                    : `#${cache.frontmatter.tags}`;
                tags.push(tag);
                this.logger.debug('Preset', t().debug.presets.frontmatterTagsString, tag);
            }
        }

        if (cache?.tags) {
            const inlineTags = cache.tags.map((t: TagCache) => t.tag);
            tags.push(...inlineTags);
            this.logger.debug('Preset', t().debug.presets.inlineTags, inlineTags);
        }

        if (tags.length > 0) {
            this.logger.debug('Preset', t().debug.presets.allTags, tags);
        }

        return tags;
    }

    /**
     * 프리셋을 JSON 문자열로 내보냅니다
     * 
     * @param id - 내보낼 프리셋 ID
     * @returns JSON 문자열 또는 빈 문자열
     */
    exportPreset(id: string): string {
        const preset = this.plugin.settings.presets.find(p => p.id === id);
        if (!preset) {
            this.logger.warn('Preset', t().debug.presets.notFound, id);
            return '';
        }

        return JSON.stringify(preset, null, 2);
    }

    /**
     * JSON 문자열로부터 프리셋을 가져옵니다
     * 
     * @param json - 프리셋 JSON 문자열
     * @returns 가져오기 성공 여부
     */
    async importPreset(json: string): Promise<boolean> {
        try {
            const preset = JSON.parse(json) as Preset;
            preset.id = this.generateId();

            this.plugin.settings.presets.push(preset);
            await this.plugin.saveSettings();

            this.logger.debug('Preset', t().debug.presets.importSuccess, preset.name);
            return true;
        } catch (error) {
            this.logger.error('Preset', t().debug.presets.importFailed, error);
            return false;
        }
    }

    /**
     * 현재 설정을 복제합니다
     */
    private cloneCurrentSettings(): CardNavigatorSettings {
        return JSON.parse(JSON.stringify(this.plugin.settings));
    }

    /**
     * 고유 ID를 생성합니다
     */
    private generateId(): string {
        return `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 깊은 병합을 수행합니다
     * 
     * @param target - 대상 객체
     * @param source - 병합할 객체
     * @returns 병합된 객체
     */
    private deepMerge<T>(target: T, source: Partial<T>): T {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                const sourceValue = source[key];
                const targetValue = result[key];
                
                if (
                    sourceValue &&
                    typeof sourceValue === 'object' &&
                    !Array.isArray(sourceValue) &&
                    targetValue &&
                    typeof targetValue === 'object' &&
                    !Array.isArray(targetValue)
                ) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    result[key] = this.deepMerge(targetValue, sourceValue as any);
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    result[key] = sourceValue as any;
                }
            }
        }
        
        return result;
    }
}

import { TFile, CachedMetadata, TagCache } from 'obsidian';
import { CardNavigatorSettings, Preset, PresetMapping, PresetMappingType, CardSettings } from '../types';
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
     * ⭐ 개선 (2025-11-23):
     * - ID 자동 생성
     * - 배열 끝에 추가 (가장 낮은 우선순위)
     */
    async addMapping(mapping: PresetMapping): Promise<void> {
        const settings = this.plugin.settings;

        // ID가 없으면 생성
        if (!mapping.id) {
            mapping.id = this.generateMappingId();
        }

        // 기존에 같은 type/target을 가진 매핑이 있으면 제거 (교체)
        const existingIndex = settings.presetMappings.findIndex(
            m => m.type === mapping.type && m.target === mapping.target
        );

        if (existingIndex !== -1) {
            settings.presetMappings.splice(existingIndex, 1);
            this.logger.debug('Preset', 'Replaced existing mapping', {
                type: mapping.type,
                target: mapping.target
            });
        }

        settings.presetMappings.push(mapping);
        await this.plugin.saveSettings();

        this.logger.debug('Preset', 'Mapping added', {
            id: mapping.id,
            type: mapping.type,
            target: mapping.target
        });
    }

    /**
     * 프리셋 매핑을 삭제합니다
     *
     * @param id - 매핑 ID (또는 type/target 기반 삭제를 위한 복합 키)
     *
     * ⭐ 개선 (2025-11-23): ID 기반으로 삭제 (하위 호환성 유지)
     */
    async removeMapping(id: string): Promise<void>;
    async removeMapping(type: string, target: string): Promise<void>;
    async removeMapping(idOrType: string, target?: string): Promise<void> {
        const settings = this.plugin.settings;

        let index: number;
        if (target !== undefined) {
            // type, target 기반 삭제 (하위 호환성)
            index = settings.presetMappings.findIndex(
                m => m.type === idOrType && m.target === target
            );
        } else {
            // ID 기반 삭제
            index = settings.presetMappings.findIndex(m => m.id === idOrType);
        }

        if (index === -1) {
            this.logger.warn('Preset', 'Mapping not found', { idOrType, target });
            return;
        }

        const removed = settings.presetMappings[index];
        settings.presetMappings.splice(index, 1);

        await this.plugin.saveSettings();
        this.logger.debug('Preset', 'Mapping deleted', {
            id: removed.id,
            type: removed.type,
            target: removed.target
        });
    }

    /**
     * 매핑의 순서를 변경합니다
     *
     * @param id - 이동할 매핑 ID
     * @param newIndex - 새로운 인덱스 위치
     *
     * ⭐ 신규 (2025-11-23): 드래그 앤 드롭 지원
     */
    async reorderMapping(id: string, newIndex: number): Promise<void> {
        const settings = this.plugin.settings;

        const oldIndex = settings.presetMappings.findIndex(m => m.id === id);
        if (oldIndex === -1) {
            this.logger.warn('Preset', 'Mapping not found for reordering', id);
            return;
        }

        // 배열에서 제거
        const [mapping] = settings.presetMappings.splice(oldIndex, 1);

        // 새 위치에 삽입
        settings.presetMappings.splice(newIndex, 0, mapping);

        await this.plugin.saveSettings();
        this.logger.debug('Preset', 'Mapping reordered', {
            id,
            from: oldIndex,
            to: newIndex
        });
    }

    /**
     * 매핑을 업데이트합니다
     *
     * @param id - 업데이트할 매핑 ID
     * @param updates - 업데이트할 필드들
     *
     * ⭐ 신규 (2025-11-23)
     */
    async updateMapping(id: string, updates: Partial<PresetMapping>): Promise<void> {
        const settings = this.plugin.settings;

        const mapping = settings.presetMappings.find(m => m.id === id);
        if (!mapping) {
            this.logger.warn('Preset', 'Mapping not found for update', id);
            return;
        }

        Object.assign(mapping, updates);

        await this.plugin.saveSettings();
        this.logger.debug('Preset', 'Mapping updated', { id, updates });
    }

    /**
     * 모든 매핑 목록을 가져옵니다
     *
     * ⭐ 신규 (2025-11-23)
     */
    getAllMappings(): PresetMapping[] {
        return this.plugin.settings.presetMappings;
    }

    /**
     * ID로 매핑을 가져옵니다
     *
     * ⭐ 신규 (2025-11-23)
     */
    getMapping(id: string): PresetMapping | undefined {
        return this.plugin.settings.presetMappings.find(m => m.id === id);
    }

    /**
     * 타입별 프리셋 매핑을 가져옵니다
     *
     * @param type - 매핑 타입
     * @returns 해당 타입의 매핑 배열
     *
     * ⭐ 개선 (2025-11-23): 모든 매핑 타입 지원
     */
    getMappingsByType(type: PresetMappingType): PresetMapping[] {
        return this.plugin.settings.presetMappings.filter(m => m.type === type);
    }

    /**
     * 매핑의 우선순위를 업데이트합니다
     *
     * @param type - 매핑 타입
     * @param target - 매핑 타겟
     * @param newPriority - 새로운 우선순위 값
     *
     * ⭐ 개선 (2025-11-23): 모든 매핑 타입 지원
     */
    async updateMappingPriority(type: PresetMappingType, target: string, newPriority: number): Promise<void> {
        const mapping = this.plugin.settings.presetMappings.find(
            m => m.type === type && m.target === target
        );

        if (mapping) {
            mapping.priority = newPriority;
            await this.plugin.saveSettings();
            this.logger.debug('Preset', 'Mapping priority updated', { type, target, newPriority });
        }
    }

    /**
     * 파일에 매칭되는 프리셋을 찾습니다
     *
     * @param file - 확인할 파일
     * @returns 매칭된 프리셋 또는 null
     *
     * ⭐ 개선 (2025-11-23):
     * - 배열 순서대로 매핑을 확인 (인덱스 = 우선순위)
     * - 모든 타입(folder, tag, property, date)을 통합하여 처리
     * - 우선순위 모드가 'manual'일 때만 배열 순서 사용
     */
    findMatchingPreset(file: TFile): Preset | null {
        if (!file) {
            return null;
        }

        const settings = this.plugin.settings;
        const prioritySettings = settings.presetPriority;

        this.logger.debug('Preset', 'Search start', {
            file: file.path,
            priorityMode: prioritySettings.mode,
            totalMappings: settings.presetMappings.length
        });

        // 수동 모드: 배열 순서대로 매칭 확인
        if (prioritySettings.mode === 'manual') {
            for (let i = 0; i < settings.presetMappings.length; i++) {
                const mapping = settings.presetMappings[i];

                if (this.isMatch(file, mapping)) {
                    const preset = settings.presets.find(
                        p => p.id === mapping.presetId
                    );

                    if (preset) {
                        this.logger.debug('Preset', 'Matched preset (manual mode)', {
                            index: i,
                            type: mapping.type,
                            target: mapping.target,
                            presetName: preset.name
                        });
                        return preset;
                    }
                }
            }
        }
        // 자동/반자동 모드: 타입별 우선순위 적용
        else {
            const typeOrder = this.determineTypeOrder();
            const modeLabel = prioritySettings.mode === 'auto' ? 'auto' : 'semi-auto';

            this.logger.debug('Preset', `Search start (${modeLabel} mode)`, {
                file: file.path,
                priorityMode: prioritySettings.mode,
                typeOrder
            });

            // 타입 우선순위 순서대로 매칭 검색
            for (const type of typeOrder) {
                const mappings = this.getMappingsByType(type)
                    .sort((a, b) => a.priority - b.priority);

                this.logger.debug('Preset', `Mapping search (${type})`, {
                    count: mappings.length,
                    priorities: mappings.map(m => ({ target: m.target, priority: m.priority }))
                });

                for (const mapping of mappings) {
                    if (this.isMatch(file, mapping)) {
                        const preset = settings.presets.find(
                            p => p.id === mapping.presetId
                        );

                        if (preset) {
                            this.logger.debug('Preset', `Matched preset (${modeLabel} mode)`, {
                                type,
                                target: mapping.target,
                                priority: mapping.priority,
                                presetName: preset.name
                            });
                            return preset;
                        }
                    }
                }
            }
        }

        this.logger.debug('Preset', 'No matched preset');
        return null;
    }

    /**
     * 현재 우선순위 타입 순서를 결정합니다
     *
     * @returns 매핑 타입 배열 (우선순위 순)
     */
    private determineTypeOrder(): PresetMappingType[] {
        const settings = this.plugin.settings;
        const prioritySettings = settings.presetPriority;

        // 반자동 모드: 사용자가 선택한 타입을 최우선으로
        if (prioritySettings.mode === 'semi-auto') {
            const preferredType = prioritySettings.preferredType;
            this.logger.debug('Preset', '🔧 반자동 우선순위:', preferredType);

            // 선택된 타입을 맨 앞에, 나머지는 기본 순서대로
            const allTypes: PresetMappingType[] = ['folder', 'tag', 'property', 'date'];
            return [preferredType, ...allTypes.filter(t => t !== preferredType)];
        }

        // 자동 모드: 현재 모드에 따라 자동 결정
        const currentMode = settings.currentMode;

        if (currentMode === 'folder') {
            // 폴더 모드: 태그가 더 구체적이므로 태그 우선
            this.logger.debug('Preset', t().debug.presets.autoPriorityFolderMode);
            return ['tag', 'folder', 'property', 'date'];
        } else {
            // 태그 모드: 폴더가 더 구체적이므로 폴더 우선
            this.logger.debug('Preset', t().debug.presets.autoPriorityTagMode);
            return ['folder', 'tag', 'property', 'date'];
        }
    }

    /**
     * 파일이 매핑과 일치하는지 확인합니다
     *
     * ⭐ 확장 (2025-11-23): property, date 타입 지원 추가
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

            case 'property': {
                const cache = this.plugin.app.metadataCache.getFileCache(file);
                const propertyValue = cache?.frontmatter?.[mapping.target];
                const propertyMatch = propertyValue !== undefined &&
                    String(propertyValue) === mapping.propertyValue;

                this.logger.debug('Preset', 'Property match check', {
                    file: file.path,
                    propertyName: mapping.target,
                    actualValue: propertyValue,
                    expectedValue: mapping.propertyValue,
                    match: propertyMatch
                });

                return propertyMatch;
            }

            case 'date': {
                const dateMatch = this.isDateMatch(file, mapping);

                this.logger.debug('Preset', 'Date match check', {
                    file: file.path,
                    dateCriteria: mapping.dateCriteria,
                    useRelativeDate: mapping.useRelativeDate,
                    relativeDays: mapping.relativeDays,
                    dateFrom: mapping.dateFrom,
                    dateTo: mapping.dateTo,
                    match: dateMatch
                });

                return dateMatch;
            }

            default:
                return false;
        }
    }

    /**
     * 날짜 매핑이 일치하는지 확인합니다
     */
    private isDateMatch(file: TFile, mapping: PresetMapping): boolean {
        if (!mapping.dateCriteria) {
            return false;
        }

        // 비교할 날짜 가져오기
        let targetDate: number | null = null;

        switch (mapping.dateCriteria) {
            case 'created-date':
                targetDate = file.stat.ctime;
                break;
            case 'modified-date':
                targetDate = file.stat.mtime;
                break;
            case 'property': {
                if (!mapping.datePropertyName) {
                    return false;
                }
                const cache = this.plugin.app.metadataCache.getFileCache(file);
                const propValue = cache?.frontmatter?.[mapping.datePropertyName];
                if (!propValue) {
                    return false;
                }
                // YYYY-MM-DD 형식의 문자열을 타임스탬프로 변환
                targetDate = new Date(propValue).getTime();
                break;
            }
        }

        if (!targetDate || isNaN(targetDate)) {
            return false;
        }

        // 상대 날짜 vs 절대 날짜 범위 체크
        if (mapping.useRelativeDate && mapping.relativeDays !== undefined) {
            const now = Date.now();
            const daysAgo = now - (mapping.relativeDays * 24 * 60 * 60 * 1000);
            return targetDate >= daysAgo;
        } else if (mapping.dateFrom || mapping.dateTo) {
            const fromTime = mapping.dateFrom ? new Date(mapping.dateFrom).getTime() : -Infinity;
            const toTime = mapping.dateTo ? new Date(mapping.dateTo).getTime() : Infinity;
            return targetDate >= fromTime && targetDate <= toTime;
        }

        return false;
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
     * 매핑 고유 ID를 생성합니다
     *
     * ⭐ 신규 (2025-11-23)
     */
    private generateMappingId(): string {
        return `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

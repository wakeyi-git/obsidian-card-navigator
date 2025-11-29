import { TFile, CachedMetadata, TagCache } from 'obsidian';
import { CardNavigatorSettings, Preset, PresetMapping, PresetMappingType, CardSettings, PresetApplyCategories, DEFAULT_PRESET_APPLY_CATEGORIES } from '../types';
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

    /** ⭐ 프리셋 적용 전 원래 설정 (프리셋 매핑 폴더를 벗어났을 때 복원용) */
    private originalSettings: Partial<CardNavigatorSettings> | null = null;

    /** ⭐ Phase 2: 프리셋 매핑 인덱스 (성능 최적화 - O(n) → O(1)) */
    private mappingIndex: {
        byFolder: Map<string, PresetMapping[]>;  // folder path → mappings
        byTag: Map<string, PresetMapping[]>;     // tag → mappings
        byProperty: Map<string, PresetMapping[]>; // property name → mappings
    } = {
        byFolder: new Map(),
        byTag: new Map(),
        byProperty: new Map()
    };

    /** 인덱스 빌드 여부 */
    private isIndexBuilt = false;

    constructor(private plugin: CardNavigatorPlugin) {
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(() => this.plugin.settingsManager.getSettings());
    }

    /**
     * PresetManager를 초기화합니다
     *
     * @remarks
     * ⭐ 개선 (2025-11-29): 플러그인 시작 시 프리셋 상태 검증
     * 플러그인이 비활성화된 상태에서 settings.json에 프리셋 설정이 저장되어 있을 수 있습니다.
     * 플러그인을 다시 활성화할 때 현재 파일이 프리셋 매핑과 일치하지 않으면
     * 프리셋 관련 설정을 기본값으로 리셋합니다.
     */
    async initialize(): Promise<void> {
        this.buildMappingIndex();

        // ⭐ 플러그인 시작 시 프리셋 상태 검증
        await this.validatePresetStateOnLoad();

        this.logger.debug('Preset', t().debug.presets.managerInitialized);
    }

    /**
     * 플러그인 로드 시 프리셋 상태를 검증합니다
     *
     * @remarks
     * 프리셋이 적용된 상태(예: matrix2D.enabled = true)에서 플러그인이 비활성화되면
     * 해당 설정이 settings.json에 저장됩니다. 플러그인을 다시 활성화할 때
     * 프리셋 관련 설정을 기본값으로 리셋하여 뷰가 열릴 때 올바른 프리셋이 적용되도록 합니다.
     *
     * ⭐ 중요: 플러그인 로드 시점과 뷰 열림 시점의 활성 파일이 다를 수 있으므로
     * 여기서는 프리셋을 적용하지 않고 리셋만 합니다. 실제 프리셋 적용은
     * 뷰의 onOpen()에서 autoApplyPreset()을 통해 이루어집니다.
     */
    private async validatePresetStateOnLoad(): Promise<void> {
        const settings = this.plugin.settings;

        // 프리셋 기능이 비활성화되어 있으면 검증 불필요
        if (!settings.enablePresets) {
            return;
        }

        // 매핑이 없으면 검증 불필요
        if (settings.presetMappings.length === 0) {
            return;
        }

        // ⭐ 프리셋 고유 설정이 활성화되어 있는지 확인
        // (예: matrix2D.enabled가 true이면 프리셋이 적용된 상태)
        const hasPresetSettingsApplied = this.hasPresetSpecificSettings(settings);

        if (hasPresetSettingsApplied) {
            // 프리셋 설정이 저장되어 있음 → 기본값으로 리셋
            // 뷰가 열릴 때 autoApplyPreset()에서 현재 활성 파일에 맞는 프리셋이 적용됨
            this.logger.debug('Preset', 'Resetting preset settings on plugin load (will be re-applied when view opens)', {
                matrix2DEnabled: settings.grouping?.matrix2D?.enabled
            });

            await this.resetPresetSpecificSettings();
        }
    }

    /**
     * 프리셋 고유 설정이 활성화되어 있는지 확인합니다
     *
     * @remarks
     * 기본값과 다른 프리셋 고유 설정이 있는지 확인합니다.
     * 현재는 matrix2D.enabled를 주로 확인합니다.
     */
    private hasPresetSpecificSettings(settings: CardNavigatorSettings): boolean {
        // Matrix 2D가 활성화되어 있으면 프리셋 설정이 적용된 것으로 판단
        // (기본값은 false)
        if (settings.grouping?.matrix2D?.enabled === true) {
            return true;
        }

        // 추후 다른 프리셋 고유 설정 추가 가능
        // 예: 특정 그룹화 설정, 특수 레이아웃 등

        return false;
    }

    /**
     * 프리셋 관련 설정을 기본값으로 리셋합니다
     */
    private async resetPresetSpecificSettings(): Promise<void> {
        const settings = this.plugin.settings;

        // Matrix 2D 비활성화
        if (settings.grouping?.matrix2D) {
            settings.grouping.matrix2D.enabled = false;
        }

        // 현재 프리셋 ID 초기화
        this.currentPresetId = null;

        // 설정 저장 (뷰 새로고침 없이)
        await this.plugin.saveSettingsQuiet();

        this.logger.debug('Preset', 'Preset specific settings reset to defaults');
    }

    /**
     * PresetManager 상태를 리셋합니다
     */
    reset(): void {
        this.currentPresetId = null;
        this.isIndexBuilt = false;
        this.logger.debug('Preset', t().debug.presets.managerReset);
    }

    /**
     * ⭐ Phase 2: 프리셋 매핑 인덱스를 빌드합니다
     *
     * @remarks
     * 모든 매핑을 타입별로 인덱싱하여 O(1) 검색을 가능하게 합니다.
     */
    private buildMappingIndex(): void {
        // 인덱스 초기화
        this.mappingIndex.byFolder.clear();
        this.mappingIndex.byTag.clear();
        this.mappingIndex.byProperty.clear();

        const settings = this.plugin.settings;

        for (const mapping of settings.presetMappings) {
            switch (mapping.type) {
                case 'folder':
                    if (!this.mappingIndex.byFolder.has(mapping.target)) {
                        this.mappingIndex.byFolder.set(mapping.target, []);
                    }
                    this.mappingIndex.byFolder.get(mapping.target)!.push(mapping);
                    break;

                case 'tag':
                    if (!this.mappingIndex.byTag.has(mapping.target)) {
                        this.mappingIndex.byTag.set(mapping.target, []);
                    }
                    this.mappingIndex.byTag.get(mapping.target)!.push(mapping);
                    break;

                case 'property': {
                    const propName = mapping.target.split(':')[0]; // "property:value" → "property"
                    if (!this.mappingIndex.byProperty.has(propName)) {
                        this.mappingIndex.byProperty.set(propName, []);
                    }
                    this.mappingIndex.byProperty.get(propName)!.push(mapping);
                    break;
                }
            }
        }

        this.isIndexBuilt = true;
        this.logger.debug('Preset', '인덱스 빌드 완료', {
            folders: this.mappingIndex.byFolder.size,
            tags: this.mappingIndex.byTag.size,
            properties: this.mappingIndex.byProperty.size
        });
    }

    /**
     * ⭐ 인덱스를 무효화합니다 (매핑이 변경되었을 때 호출)
     */
    invalidateIndex(): void {
        this.isIndexBuilt = false;
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
     *
     * @remarks
     * applyCategories의 cardContent와 cardStyle 카테고리를 고려합니다.
     * 두 카테고리가 모두 비활성화된 경우 null을 반환합니다.
     */
    getCardSettingsForFile(file: TFile | null): CardSettings | null {
        if (!file || !this.plugin.settings.enablePresets) {
            return null;
        }

        const preset = this.findMatchingPreset(file);
        if (!preset) {
            return null;
        }

        // applyCategories 확인 (없으면 기본값 사용)
        const applyCategories = preset.applyCategories ?? DEFAULT_PRESET_APPLY_CATEGORIES;

        // cardContent와 cardStyle 모두 비활성화된 경우 null 반환
        if (!applyCategories.cardContent && !applyCategories.cardStyle) {
            return null;
        }

        return this.extractCardSettings(preset.settings, applyCategories);
    }

    /**
     * CardNavigatorSettings에서 CardSettings만 추출합니다
     *
     * @param settings - 프리셋 설정
     * @param applyCategories - 적용할 카테고리 (undefined면 모든 설정 추출)
     *
     * @remarks
     * cardContent 카테고리: header/body/footer 내용 설정 + renderMode
     * cardStyle 카테고리: 카드 전체 스타일 + header/body/footer 섹션 스타일
     *
     * 비활성화된 카테고리는 originalSettings (프리셋 적용 전 원래 설정)를 사용합니다.
     * originalSettings가 없으면 현재 plugin.settings를 사용합니다.
     */
    private extractCardSettings(
        settings: CardNavigatorSettings,
        applyCategories?: PresetApplyCategories
    ): CardSettings {
        // 현재 전역 설정 (항상 유효함)
        const currentSettings = this.plugin.settings;

        // ⭐ 비활성화된 카테고리에 사용할 원래 설정 (프리셋 적용 전 설정)
        // originalSettings가 있으면 사용, 없으면 현재 설정 사용

        // cardContent용 fallback
        const fallbackHeader = this.originalSettings?.header ?? currentSettings.header;
        const fallbackBody = this.originalSettings?.body ?? currentSettings.body;
        const fallbackFooter = this.originalSettings?.footer ?? currentSettings.footer;
        const fallbackRenderMode = this.originalSettings?.renderMode ?? currentSettings.renderMode;

        // ⭐ cardStyle용 fallback (별도로 관리)
        const fallbackNormalCardStyle = this.originalSettings?.normalCardStyle ?? currentSettings.normalCardStyle;
        const fallbackActiveCardStyle = this.originalSettings?.activeCardStyle ?? currentSettings.activeCardStyle;
        const fallbackFocusedCardStyle = this.originalSettings?.focusedCardStyle ?? currentSettings.focusedCardStyle;
        // 섹션 스타일은 header/body/footer 내에 있음
        const fallbackHeaderStyle = this.originalSettings?.header?.normalStyle ?? currentSettings.header.normalStyle;
        const fallbackHeaderActiveStyle = this.originalSettings?.header?.activeStyle ?? currentSettings.header.activeStyle;
        const fallbackHeaderFocusedStyle = this.originalSettings?.header?.focusedStyle ?? currentSettings.header.focusedStyle;
        const fallbackBodyStyle = this.originalSettings?.body?.normalStyle ?? currentSettings.body.normalStyle;
        const fallbackBodyActiveStyle = this.originalSettings?.body?.activeStyle ?? currentSettings.body.activeStyle;
        const fallbackBodyFocusedStyle = this.originalSettings?.body?.focusedStyle ?? currentSettings.body.focusedStyle;
        const fallbackFooterStyle = this.originalSettings?.footer?.normalStyle ?? currentSettings.footer.normalStyle;
        const fallbackFooterActiveStyle = this.originalSettings?.footer?.activeStyle ?? currentSettings.footer.activeStyle;
        const fallbackFooterFocusedStyle = this.originalSettings?.footer?.focusedStyle ?? currentSettings.footer.focusedStyle;

        // applyCategories가 없으면 모든 설정 사용
        if (!applyCategories) {
            return {
                header: settings.header,
                body: settings.body,
                footer: settings.footer,
                renderMode: settings.renderMode,
                normalCardStyle: settings.normalCardStyle,
                activeCardStyle: settings.activeCardStyle,
                focusedCardStyle: settings.focusedCardStyle,
                // 섹션 스타일도 포함
                headerStyle: settings.header.normalStyle,
                headerActiveStyle: settings.header.activeStyle,
                headerFocusedStyle: settings.header.focusedStyle,
                bodyStyle: settings.body.normalStyle,
                bodyActiveStyle: settings.body.activeStyle,
                bodyFocusedStyle: settings.body.focusedStyle,
                footerStyle: settings.footer.normalStyle,
                footerActiveStyle: settings.footer.activeStyle,
                footerFocusedStyle: settings.footer.focusedStyle
            };
        }

        // ⭐ cardContent: 내용 설정만 추출 (스타일은 fallback 사용)
        // ⭐ cardStyle: 카드 전체 스타일 + 섹션 스타일

        // 헤더 설정: 내용은 cardContent, 스타일은 cardStyle에서 제어
        const headerResult = {
            enabled: applyCategories.cardContent ? settings.header.enabled : fallbackHeader.enabled,
            normalContent: applyCategories.cardContent ? settings.header.normalContent : fallbackHeader.normalContent,
            activeContent: applyCategories.cardContent ? settings.header.activeContent : fallbackHeader.activeContent,
            focusedContent: applyCategories.cardContent ? settings.header.focusedContent : fallbackHeader.focusedContent,
            // ⭐ 스타일은 cardStyle 카테고리에서 제어 - 별도의 fallback 사용
            normalStyle: applyCategories.cardStyle ? settings.header.normalStyle : fallbackHeaderStyle,
            activeStyle: applyCategories.cardStyle ? settings.header.activeStyle : fallbackHeaderActiveStyle,
            focusedStyle: applyCategories.cardStyle ? settings.header.focusedStyle : fallbackHeaderFocusedStyle
        };

        // 바디 설정
        const bodyResult = {
            enabled: applyCategories.cardContent ? settings.body.enabled : fallbackBody.enabled,
            normalContent: applyCategories.cardContent ? settings.body.normalContent : fallbackBody.normalContent,
            activeContent: applyCategories.cardContent ? settings.body.activeContent : fallbackBody.activeContent,
            focusedContent: applyCategories.cardContent ? settings.body.focusedContent : fallbackBody.focusedContent,
            // ⭐ 스타일은 cardStyle 카테고리에서 제어 - 별도의 fallback 사용
            normalStyle: applyCategories.cardStyle ? settings.body.normalStyle : fallbackBodyStyle,
            activeStyle: applyCategories.cardStyle ? settings.body.activeStyle : fallbackBodyActiveStyle,
            focusedStyle: applyCategories.cardStyle ? settings.body.focusedStyle : fallbackBodyFocusedStyle
        };

        // 풋터 설정
        const footerResult = {
            enabled: applyCategories.cardContent ? settings.footer.enabled : fallbackFooter.enabled,
            normalContent: applyCategories.cardContent ? settings.footer.normalContent : fallbackFooter.normalContent,
            activeContent: applyCategories.cardContent ? settings.footer.activeContent : fallbackFooter.activeContent,
            focusedContent: applyCategories.cardContent ? settings.footer.focusedContent : fallbackFooter.focusedContent,
            // ⭐ 스타일은 cardStyle 카테고리에서 제어 - 별도의 fallback 사용
            normalStyle: applyCategories.cardStyle ? settings.footer.normalStyle : fallbackFooterStyle,
            activeStyle: applyCategories.cardStyle ? settings.footer.activeStyle : fallbackFooterActiveStyle,
            focusedStyle: applyCategories.cardStyle ? settings.footer.focusedStyle : fallbackFooterFocusedStyle
        };

        const result: CardSettings = {
            header: headerResult,
            body: bodyResult,
            footer: footerResult,
            renderMode: applyCategories.cardContent ? settings.renderMode : fallbackRenderMode,
            // ⭐ cardStyle이 비활성화되면 originalSettings 값 사용 (undefined가 아님!)
            normalCardStyle: applyCategories.cardStyle ? settings.normalCardStyle : fallbackNormalCardStyle,
            activeCardStyle: applyCategories.cardStyle ? settings.activeCardStyle : fallbackActiveCardStyle,
            focusedCardStyle: applyCategories.cardStyle ? settings.focusedCardStyle : fallbackFocusedCardStyle,
            // ⭐ 섹션 스타일도 마찬가지로 fallback 사용
            headerStyle: applyCategories.cardStyle ? settings.header.normalStyle : fallbackHeaderStyle,
            headerActiveStyle: applyCategories.cardStyle ? settings.header.activeStyle : fallbackHeaderActiveStyle,
            headerFocusedStyle: applyCategories.cardStyle ? settings.header.focusedStyle : fallbackHeaderFocusedStyle,
            bodyStyle: applyCategories.cardStyle ? settings.body.normalStyle : fallbackBodyStyle,
            bodyActiveStyle: applyCategories.cardStyle ? settings.body.activeStyle : fallbackBodyActiveStyle,
            bodyFocusedStyle: applyCategories.cardStyle ? settings.body.focusedStyle : fallbackBodyFocusedStyle,
            footerStyle: applyCategories.cardStyle ? settings.footer.normalStyle : fallbackFooterStyle,
            footerActiveStyle: applyCategories.cardStyle ? settings.footer.activeStyle : fallbackFooterActiveStyle,
            footerFocusedStyle: applyCategories.cardStyle ? settings.footer.focusedStyle : fallbackFooterFocusedStyle
        };

        this.logger.debug('Preset', 'extractCardSettings result', {
            cardContentEnabled: applyCategories.cardContent,
            cardStyleEnabled: applyCategories.cardStyle,
            resultRenderMode: result.renderMode,
            presetRenderMode: settings.renderMode,
            fallbackRenderMode: fallbackRenderMode,
            hasOriginalSettings: this.originalSettings !== null,
            // 카드 스타일 디버깅
            hasNormalCardStyle: !!result.normalCardStyle,
            hasHeaderStyle: !!result.headerStyle
        });

        return result;
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
     * 프리셋의 적용 범위를 업데이트합니다
     *
     * @param id - 프리셋 ID
     * @param applyCategories - 새로운 적용 범위 설정
     */
    async updatePresetApplyCategories(id: string, applyCategories: PresetApplyCategories): Promise<void> {
        const settings = this.plugin.settings;
        const preset = settings.presets.find(p => p.id === id);

        if (!preset) {
            this.logger.warn('Preset', t().debug.presets.notFound, id);
            return;
        }

        preset.applyCategories = applyCategories;

        // 현재 적용된 프리셋의 적용 범위가 변경되면 원래 설정 복원 후 재적용
        const needsReapply = this.currentPresetId === id;
        if (needsReapply) {
            // 원래 설정으로 복원 (originalSettings는 유지하여 재적용 시 사용)
            if (this.originalSettings) {
                Object.assign(settings, this.deepMerge(settings, this.originalSettings));
                this.logger.debug('Preset', 'Restored original settings for re-apply', {
                    renderMode: this.originalSettings.renderMode,
                    matrix2DEnabled: this.originalSettings.grouping?.matrix2D?.enabled
                });
            }
            this.currentPresetId = null;
            this.logger.debug('Preset', 'Reset currentPresetId for re-apply', { presetId: id });
        }

        await this.plugin.saveSettings();
        this.logger.debug('Preset', 'Updated preset apply categories', {
            presetName: preset.name,
            applyCategories: Object.entries(applyCategories)
                .filter(([, v]) => v)
                .map(([k]) => k)
        });

        // 프리셋 재적용 및 뷰 새로고침
        if (needsReapply) {
            // 현재 활성 파일로 프리셋 재적용
            const activeFile = this.plugin.app.workspace.getActiveFile();
            await this.autoApplyPreset(activeFile);

            // 뷰 새로고침
            this.plugin.refreshView();
        }
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
     * 파일 변경 시 프리셋을 자동으로 적용합니다
     *
     * @param file - 현재 활성화된 파일
     * @returns 프리셋이 변경되었으면 true
     *
     * @remarks
     * ⭐ 개선 (2025-11-29): 프리셋 설정을 메모리에만 적용 (디스크 저장 안 함)
     * 뷰 레벨 설정(mode, grouping, matrix2D 등)은 plugin.settings에 적용되지만
     * 디스크에 저장하지 않습니다. 플러그인 재시작 후에는 원래 설정이 유지됩니다.
     */
    async autoApplyPreset(file: TFile | null): Promise<boolean> {
        const settings = this.plugin.settings;

        if (!settings.enablePresets) {
            return false;
        }

        const previousPresetId = this.currentPresetId;

        if (file === null) {
            // 파일이 없으면 원래 설정으로 복원 (메모리에서만)
            if (previousPresetId !== null && this.originalSettings) {
                this.restoreOriginalSettings(settings);
            }
            this.currentPresetId = null;
            const changed = previousPresetId !== null;
            if (changed) {
                this.logger.debug('Preset', t().debug.presets.changedToNone);
            }
            return changed;
        }

        const preset = this.findMatchingPreset(file);

        if (preset) {
            const changed = previousPresetId !== preset.id;
            this.currentPresetId = preset.id;

            if (changed) {
                this.logger.debug('Preset', t().debug.presets.changed, {
                    from: previousPresetId || 'none',
                    to: preset.id
                });
            }

            // 첫 프리셋 적용 시 원래 설정 저장
            if (previousPresetId === null && this.originalSettings === null) {
                this.saveOriginalSettings(settings);
            }

            // ⭐ 프리셋 설정을 메모리에 적용 (디스크 저장 안 함)
            // 동일한 프리셋이라도 항상 재적용: 비활성화된 카테고리의 전역 설정 변경을 반영하기 위함
            const applyCategories = preset.applyCategories ?? DEFAULT_PRESET_APPLY_CATEGORIES;
            const settingsToApply = this.extractSettingsByCategories(preset.settings, applyCategories);

            this.logger.debug('Preset', 'Applying preset (memory only)', {
                presetId: preset.id,
                changed,
                currentMatrix2DEnabled: settings.grouping?.matrix2D?.enabled,
                presetMatrix2DEnabled: preset.settings.grouping?.matrix2D?.enabled,
                applyCategories
            });

            const mergedSettings = this.deepMerge(settings, settingsToApply);
            Object.assign(settings, mergedSettings);

            this.logger.debug('Preset', 'After applying preset (memory only)', {
                settingsMatrix2DEnabled: settings.grouping?.matrix2D?.enabled,
                settingsRenderMode: settings.renderMode,
                note: 'Settings applied to memory only - NOT saved to disk'
            });

            return changed;
        } else {
            // 매칭되는 프리셋이 없으면 원래 설정으로 복원 (메모리에서만)
            if (previousPresetId !== null && this.originalSettings) {
                this.restoreOriginalSettings(settings);
            }
            this.currentPresetId = null;
            const changed = previousPresetId !== null;
            if (changed) {
                this.logger.debug('Preset', t().debug.presets.changedToNone);
            }
            return changed;
        }
    }

    /**
     * 현재 적용된 프리셋의 설정을 반환합니다 (렌더링용)
     *
     * @returns 프리셋 설정 또는 null (프리셋이 적용되지 않은 경우)
     */
    getCurrentPresetSettings(): Partial<CardNavigatorSettings> | null {
        if (!this.currentPresetId) {
            return null;
        }

        const preset = this.plugin.settings.presets.find(p => p.id === this.currentPresetId);
        if (!preset) {
            return null;
        }

        const applyCategories = preset.applyCategories ?? DEFAULT_PRESET_APPLY_CATEGORIES;
        return this.extractSettingsByCategories(preset.settings, applyCategories);
    }

    /**
     * 프리셋 적용 전 원래 설정을 저장합니다
     */
    private saveOriginalSettings(settings: CardNavigatorSettings): void {
        // presets, presetMappings, debug는 제외하고 저장
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { presets, presetMappings, debug, ...settingsToSave } = settings;
        this.originalSettings = JSON.parse(JSON.stringify(settingsToSave));

        this.logger.debug('Preset', 'Saved original settings', {
            renderMode: settingsToSave.renderMode,
            matrix2DEnabled: settingsToSave.grouping?.matrix2D?.enabled
        });
    }

    /**
     * 원래 설정으로 복원합니다 (메모리에서만)
     */
    private restoreOriginalSettings(settings: CardNavigatorSettings): void {
        if (!this.originalSettings) {
            return;
        }

        Object.assign(settings, this.deepMerge(settings, this.originalSettings));

        this.logger.debug('Preset', 'Restored original settings (memory only)', {
            renderMode: this.originalSettings.renderMode,
            matrix2DEnabled: this.originalSettings.grouping?.matrix2D?.enabled
        });

        // 복원 후 원래 설정 초기화
        this.originalSettings = null;
    }

    /**
     * ⭐ 전역 설정 변경 시 originalSettings를 업데이트합니다
     *
     * @remarks
     * 프리셋이 적용된 상태에서 전역 설정이 변경(저장)되면,
     * 프리셋이 비활성화한 카테고리의 설정을 originalSettings에 반영해야 합니다.
     * 이렇게 해야 프리셋 비적용 영역으로 이동 시 변경된 설정이 유지됩니다.
     *
     * @param savedSettings - 디스크에 저장된 새 설정
     */
    updateOriginalSettingsOnSave(savedSettings: CardNavigatorSettings): void {
        if (!this.originalSettings || !this.currentPresetId) {
            return;
        }

        const preset = this.plugin.settings.presets.find(p => p.id === this.currentPresetId);
        if (!preset) {
            return;
        }

        const applyCategories = preset.applyCategories ?? DEFAULT_PRESET_APPLY_CATEGORIES;

        // 프리셋이 비활성화한 카테고리의 설정만 originalSettings에 업데이트
        // (활성화된 카테고리는 프리셋 설정이 적용되므로 originalSettings에서 유지)

        // cardContent가 비활성화되면 해당 설정을 originalSettings에 업데이트
        if (!applyCategories.cardContent) {
            this.originalSettings.header = JSON.parse(JSON.stringify(savedSettings.header));
            this.originalSettings.body = JSON.parse(JSON.stringify(savedSettings.body));
            this.originalSettings.footer = JSON.parse(JSON.stringify(savedSettings.footer));
            this.originalSettings.renderMode = savedSettings.renderMode;
        }

        // cardStyle이 비활성화되면 해당 설정을 originalSettings에 업데이트
        if (!applyCategories.cardStyle) {
            this.originalSettings.normalCardStyle = JSON.parse(JSON.stringify(savedSettings.normalCardStyle));
            this.originalSettings.activeCardStyle = JSON.parse(JSON.stringify(savedSettings.activeCardStyle));
            this.originalSettings.focusedCardStyle = JSON.parse(JSON.stringify(savedSettings.focusedCardStyle));
            // 섹션 스타일도 header/body/footer 내에 있으므로 cardContent와 함께 처리됨
        }

        // mode가 비활성화되면 해당 설정을 originalSettings에 업데이트
        if (!applyCategories.mode) {
            this.originalSettings.currentMode = savedSettings.currentMode;
            this.originalSettings.folderMode = JSON.parse(JSON.stringify(savedSettings.folderMode));
            this.originalSettings.tagMode = JSON.parse(JSON.stringify(savedSettings.tagMode));
        }

        // grouping이 비활성화되면 해당 설정을 originalSettings에 업데이트
        if (!applyCategories.grouping) {
            if (!this.originalSettings.grouping) {
                this.originalSettings.grouping = JSON.parse(JSON.stringify(savedSettings.grouping));
            } else {
                // matrix2D는 별도 카테고리이므로 제외
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { matrix2D, ...rest } = savedSettings.grouping;
                Object.assign(this.originalSettings.grouping, JSON.parse(JSON.stringify(rest)));
            }
        }

        // matrix2D가 비활성화되면 해당 설정을 originalSettings에 업데이트
        if (!applyCategories.matrix2D) {
            if (!this.originalSettings.grouping) {
                this.originalSettings.grouping = { ...savedSettings.grouping };
            }
            this.originalSettings.grouping.matrix2D = JSON.parse(JSON.stringify(savedSettings.grouping.matrix2D));
        }

        // sort가 비활성화되면 해당 설정을 originalSettings에 업데이트
        if (!applyCategories.sort) {
            this.originalSettings.sort = JSON.parse(JSON.stringify(savedSettings.sort));
        }

        // layout이 비활성화되면 해당 설정을 originalSettings에 업데이트
        if (!applyCategories.layout) {
            this.originalSettings.layout = JSON.parse(JSON.stringify(savedSettings.layout));
        }

        // interaction이 비활성화되면 해당 설정을 originalSettings에 업데이트
        if (!applyCategories.interaction) {
            this.originalSettings.enableCardHoverActions = savedSettings.enableCardHoverActions;
            this.originalSettings.tagClickAction = savedSettings.tagClickAction;
            this.originalSettings.scrollBehavior = savedSettings.scrollBehavior;
            this.originalSettings.dragDrop = JSON.parse(JSON.stringify(savedSettings.dragDrop));
        }

        // pin이 비활성화되면 해당 설정을 originalSettings에 업데이트
        if (!applyCategories.pin) {
            this.originalSettings.alwaysShowPinnedFiles = savedSettings.alwaysShowPinnedFiles;
            if (this.originalSettings.grouping) {
                this.originalSettings.grouping.showPinnedAsGroup = savedSettings.grouping.showPinnedAsGroup;
            }
        }

        this.logger.debug('Preset', 'Updated originalSettings on save', {
            presetId: this.currentPresetId,
            applyCategories,
            updatedRenderMode: !applyCategories.cardContent ? savedSettings.renderMode : undefined
        });
    }

    /**
     * ⭐ 디스크에 저장할 설정을 반환합니다
     *
     * @param currentSettings - 현재 메모리 설정 (프리셋이 적용되어 있을 수 있음)
     * @returns 디스크에 저장할 깨끗한 설정
     *
     * @remarks
     * 프리셋이 적용된 상태에서는:
     * - 활성화된 카테고리: originalSettings (프리셋 적용 전 원래 설정)
     * - 비활성화된 카테고리: currentSettings (사용자가 변경한 설정)
     *
     * 프리셋이 적용되지 않은 상태에서는:
     * - currentSettings를 그대로 반환
     *
     * 이렇게 해야 프리셋 설정이 디스크에 저장되지 않고,
     * 플러그인 재시작 시 원래 설정이 유지됩니다.
     */
    getSettingsForDisk(currentSettings: CardNavigatorSettings): CardNavigatorSettings {
        // 프리셋이 적용되지 않았으면 현재 설정 그대로 반환
        if (!this.currentPresetId || !this.originalSettings) {
            return currentSettings;
        }

        const preset = this.plugin.settings.presets.find(p => p.id === this.currentPresetId);
        if (!preset) {
            return currentSettings;
        }

        const applyCategories = preset.applyCategories ?? DEFAULT_PRESET_APPLY_CATEGORIES;

        // 깊은 복사로 시작
        const diskSettings = JSON.parse(JSON.stringify(currentSettings)) as CardNavigatorSettings;

        // ⭐ 프리셋이 활성화한 카테고리는 originalSettings 값으로 덮어씀
        // (프리셋 설정이 디스크에 저장되지 않도록)

        // mode 카테고리
        if (applyCategories.mode && this.originalSettings.currentMode !== undefined) {
            diskSettings.currentMode = this.originalSettings.currentMode;
            if (this.originalSettings.folderMode) {
                diskSettings.folderMode = JSON.parse(JSON.stringify(this.originalSettings.folderMode));
            }
            if (this.originalSettings.tagMode) {
                diskSettings.tagMode = JSON.parse(JSON.stringify(this.originalSettings.tagMode));
            }
        }

        // grouping 카테고리
        if (applyCategories.grouping && this.originalSettings.grouping) {
            // matrix2D는 별도 카테고리이므로 보존
            const currentMatrix2D = diskSettings.grouping?.matrix2D;
            diskSettings.grouping = JSON.parse(JSON.stringify(this.originalSettings.grouping));
            if (currentMatrix2D && !applyCategories.matrix2D) {
                diskSettings.grouping.matrix2D = currentMatrix2D;
            }
        }

        // matrix2D 카테고리
        if (applyCategories.matrix2D && this.originalSettings.grouping?.matrix2D) {
            if (!diskSettings.grouping) {
                diskSettings.grouping = { ...currentSettings.grouping };
            }
            diskSettings.grouping.matrix2D = JSON.parse(JSON.stringify(this.originalSettings.grouping.matrix2D));
        }

        // sort 카테고리
        if (applyCategories.sort && this.originalSettings.sort) {
            diskSettings.sort = JSON.parse(JSON.stringify(this.originalSettings.sort));
        }

        // cardContent 카테고리
        if (applyCategories.cardContent) {
            if (this.originalSettings.header) {
                diskSettings.header = JSON.parse(JSON.stringify(this.originalSettings.header));
            }
            if (this.originalSettings.body) {
                diskSettings.body = JSON.parse(JSON.stringify(this.originalSettings.body));
            }
            if (this.originalSettings.footer) {
                diskSettings.footer = JSON.parse(JSON.stringify(this.originalSettings.footer));
            }
            if (this.originalSettings.renderMode !== undefined) {
                diskSettings.renderMode = this.originalSettings.renderMode;
            }
        }

        // cardStyle 카테고리
        if (applyCategories.cardStyle) {
            if (this.originalSettings.normalCardStyle) {
                diskSettings.normalCardStyle = JSON.parse(JSON.stringify(this.originalSettings.normalCardStyle));
            }
            if (this.originalSettings.activeCardStyle) {
                diskSettings.activeCardStyle = JSON.parse(JSON.stringify(this.originalSettings.activeCardStyle));
            }
            if (this.originalSettings.focusedCardStyle) {
                diskSettings.focusedCardStyle = JSON.parse(JSON.stringify(this.originalSettings.focusedCardStyle));
            }
        }

        // layout 카테고리
        if (applyCategories.layout && this.originalSettings.layout) {
            diskSettings.layout = JSON.parse(JSON.stringify(this.originalSettings.layout));
        }

        // interaction 카테고리
        if (applyCategories.interaction) {
            if (this.originalSettings.enableCardHoverActions !== undefined) {
                diskSettings.enableCardHoverActions = this.originalSettings.enableCardHoverActions;
            }
            if (this.originalSettings.tagClickAction !== undefined) {
                diskSettings.tagClickAction = this.originalSettings.tagClickAction;
            }
            if (this.originalSettings.scrollBehavior !== undefined) {
                diskSettings.scrollBehavior = this.originalSettings.scrollBehavior;
            }
            if (this.originalSettings.dragDrop) {
                diskSettings.dragDrop = JSON.parse(JSON.stringify(this.originalSettings.dragDrop));
            }
        }

        // pin 카테고리
        if (applyCategories.pin) {
            if (this.originalSettings.alwaysShowPinnedFiles !== undefined) {
                diskSettings.alwaysShowPinnedFiles = this.originalSettings.alwaysShowPinnedFiles;
            }
            if (this.originalSettings.grouping?.showPinnedAsGroup !== undefined && diskSettings.grouping) {
                diskSettings.grouping.showPinnedAsGroup = this.originalSettings.grouping.showPinnedAsGroup;
            }
        }

        this.logger.debug('Preset', 'Generated settings for disk (preset active)', {
            presetId: this.currentPresetId,
            applyCategories,
            diskRenderMode: diskSettings.renderMode,
            currentRenderMode: currentSettings.renderMode,
            originalRenderMode: this.originalSettings.renderMode
        });

        return diskSettings;
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

        // ⭐ Performance: Early return - 프리셋 기능이 비활성화된 경우
        if (!settings.enablePresets) {
            return null;
        }

        // ⭐ Performance: Early return - 매핑이 없는 경우 (가장 흔한 케이스)
        // 로그 출력 없이 즉시 반환하여 성능 향상
        if (settings.presetMappings.length === 0) {
            return null;
        }

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

            // ⭐ Performance: 검색 시작 로그는 한 번만
            this.logger.debug('Preset', `Search (${modeLabel} mode)`, {
                file: file.path,
                typeOrder,
                totalMappings: settings.presetMappings.length
            });

            // 타입 우선순위 순서대로 매칭 검색
            for (const type of typeOrder) {
                const mappings = this.getMappingsByType(type)
                    .sort((a, b) => a.priority - b.priority);

                // ⭐ Performance: 매핑이 없는 타입은 로그 생략
                if (mappings.length === 0) {
                    continue;
                }

                for (const mapping of mappings) {
                    if (this.isMatch(file, mapping)) {
                        const preset = settings.presets.find(
                            p => p.id === mapping.presetId
                        );

                        if (preset) {
                            this.logger.debug('Preset', `Matched: ${preset.name}`, {
                                type,
                                target: mapping.target
                            });
                            return preset;
                        }
                    }
                }
            }
        }

        // ⭐ Performance: 매칭 실패 로그 생략 (대부분의 경우)
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
     *
     * @remarks
     * ⭐ 프리셋 메타 설정은 제외합니다:
     * - enablePresets: 프리셋 기능 활성화 여부
     * - presetPriority: 우선순위 모드 설정
     * - presets: 프리셋 목록 (순환 참조 방지)
     * - presetMappings: 매핑 목록
     *
     * 이 설정들은 프리셋이 적용될 때 덮어씌워지지 않지만 (extractSettingsByCategories에서 추출하지 않음),
     * 프리셋에 저장하면 다음 문제가 발생합니다:
     * 1. 저장 공간 낭비 (프리셋 안에 모든 프리셋이 중첩 저장됨)
     * 2. data.json 크기가 기하급수적으로 증가
     */
    private cloneCurrentSettings(): CardNavigatorSettings {
        const cloned = JSON.parse(JSON.stringify(this.plugin.settings));

        // ⭐ 프리셋 메타 설정 제거 (프리셋에 저장할 필요 없음)
        delete cloned.enablePresets;
        delete cloned.presetPriority;
        delete cloned.presets;
        delete cloned.presetMappings;

        return cloned;
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
     * 프리셋 적용 범위에 따라 설정을 선택적으로 추출합니다
     *
     * @param presetSettings - 프리셋에 저장된 전체 설정
     * @param categories - 적용할 카테고리
     * @returns 선택된 카테고리의 설정만 포함하는 객체
     */
    private extractSettingsByCategories(
        presetSettings: CardNavigatorSettings,
        categories: PresetApplyCategories
    ): Partial<CardNavigatorSettings> {
        const result: Partial<CardNavigatorSettings> = {};

        // 모드 (폴더/태그 모드 + 모드별 설정)
        if (categories.mode) {
            result.currentMode = presetSettings.currentMode;
            result.folderMode = presetSettings.folderMode;
            result.tagMode = presetSettings.tagMode;
        }

        // 그룹화 (기준, 그룹 정렬 등) - matrix2D 제외
        if (categories.grouping) {
            result.grouping = {
                ...presetSettings.grouping,
                // matrix2D는 별도 카테고리이므로 현재 설정 유지
                matrix2D: this.plugin.settings.grouping.matrix2D
            };
        }

        // 2D 매트릭스 그룹화
        if (categories.matrix2D) {
            if (!result.grouping) {
                result.grouping = { ...this.plugin.settings.grouping };
            }
            if (presetSettings.grouping?.matrix2D) {
                result.grouping.matrix2D = presetSettings.grouping.matrix2D;
            }
        }

        // 핀 설정
        if (categories.pin) {
            result.alwaysShowPinnedFiles = presetSettings.alwaysShowPinnedFiles;
            if (!result.grouping) {
                result.grouping = { ...this.plugin.settings.grouping };
            }
            result.grouping.showPinnedAsGroup = presetSettings.grouping.showPinnedAsGroup;
        }

        // 정렬
        if (categories.sort) {
            result.sort = presetSettings.sort;
        }

        // 카드 내용 (header/body/footer 콘텐츠 타입, renderMode)
        if (categories.cardContent) {
            result.header = presetSettings.header;
            result.body = presetSettings.body;
            result.footer = presetSettings.footer;
            result.renderMode = presetSettings.renderMode;
        }

        // 카드 스타일 (색상, 테두리 등)
        if (categories.cardStyle) {
            result.normalCardStyle = presetSettings.normalCardStyle;
            result.activeCardStyle = presetSettings.activeCardStyle;
            result.focusedCardStyle = presetSettings.focusedCardStyle;
        }

        // 레이아웃 (카드 크기, 간격 등)
        if (categories.layout) {
            result.layout = presetSettings.layout;
        }

        // 상호작용 (호버 액션, 클릭 동작 등)
        if (categories.interaction) {
            result.enableCardHoverActions = presetSettings.enableCardHoverActions;
            result.tagClickAction = presetSettings.tagClickAction;
            result.scrollBehavior = presetSettings.scrollBehavior;
            result.dragDrop = presetSettings.dragDrop;
        }

        this.logger.debug('Preset', 'Extracted settings by categories', {
            appliedCategories: Object.entries(categories)
                .filter(([, v]) => v)
                .map(([k]) => k),
            extractedKeys: Object.keys(result)
        });

        return result;
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

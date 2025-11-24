import { App } from 'obsidian';
import { CardNavigatorSettings, DEFAULT_SETTINGS } from './types';
import { DebugLogger } from './utils/DebugLogger';
import { SettingsValidator } from './settings/SettingsValidator';
import { SettingsMigration } from './settings/SettingsMigration';

/**
 * 플러그인 설정을 관리합니다
 * 
 * 설정 로드, 저장, 업데이트, 리셋 기능을 제공하며
 * 중첩된 객체도 올바르게 병합합니다.
 */
export class SettingsManager {
    private app: App;
    private settings: CardNavigatorSettings;
    private saveCallback: (settings: CardNavigatorSettings) => Promise<void>;
    private logger: DebugLogger;

    /** ⭐ 설정 검증기 (Phase 4.2) */
    private validator: SettingsValidator;

    /** ⭐ 설정 마이그레이션 (Phase 4.2) */
    private migration: SettingsMigration;

    /**
     * SettingsManager를 생성합니다
     *
     * @param app - Obsidian App 객체
     * @param saveCallback - 설정 저장 콜백 함수
     */
    constructor(
        app: App,
        saveCallback: (settings: CardNavigatorSettings) => Promise<void>
    ) {
        this.app = app;
        this.saveCallback = saveCallback;
        this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(() => this.settings);

        // ⭐ Phase 4.2: 검증 및 마이그레이션 초기화
        this.validator = new SettingsValidator(this.logger);
        this.migration = new SettingsMigration(this.logger);
    }

    /**
     * ⭐ 설정을 로드합니다 (Phase 4.2: 마이그레이션 및 검증 추가)
     *
     * @param data - 로드된 데이터
     *
     * @remarks
     * 1. 설정 마이그레이션 수행 (이전 버전 → 현재 버전)
     * 2. 기본 설정과 로드된 데이터 병합
     * 3. 설정 검증 및 자동 수정
     */
    loadSettings(data: Record<string, unknown> | null): void {
        let settingsData = data;

        // ⭐ 1. 마이그레이션 (Phase 4.2)
        if (settingsData && this.migration.needsMigration(settingsData)) {
            const { settings: migratedSettings, info } = this.migration.migrate(settingsData);
            settingsData = migratedSettings as unknown as Record<string, unknown>;

            if (info) {
                this.logger.debug('Settings', 'Settings migrated', {
                    fromVersion: info.fromVersion,
                    toVersion: info.toVersion,
                    changesCount: info.changedFields.length
                });
            }
        }

        // ⭐ 2. 기본 설정과 병합
        if (settingsData) {
            const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            this.settings = this.deepMerge(defaultCopy, settingsData);
        } else {
            this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }

        // ⭐ 3. 검증 및 자동 수정 (Phase 4.2)
        const { settings: validatedSettings, result } = this.validator.validateAndFix(this.settings);

        if (!result.valid) {
            this.logger.warn('Settings', 'Settings validation found issues', {
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
                errors: result.errors,
                warnings: result.warnings
            });
            this.settings = validatedSettings;
        }

        if (result.warnings.length > 0) {
            this.logger.debug('Settings', 'Settings validation warnings', {
                warnings: result.warnings
            });
        }
    }

    /**
     * 현재 설정을 반환합니다
     * 
     * @returns 현재 설정
     */
    getSettings(): CardNavigatorSettings {
        return this.settings;
    }

    /**
     * 설정을 업데이트하고 저장합니다
     * 
     * @param updates - 업데이트할 설정 (부분 업데이트 가능)
     * 
     * @remarks
     * 중첩된 객체도 올바르게 병합됩니다.
     */
    async updateSettings(updates: Partial<CardNavigatorSettings>): Promise<void> {
        this.settings = this.deepMerge(this.settings, updates);
        await this.saveCallback(this.settings);
    }

    /**
     * 깊은 병합을 수행합니다
     * 
     * @param target - 대상 객체
     * @param source - 병합할 객체
     * @returns 병합된 객체
     * 
     * @remarks
     * 중첩된 객체도 올바르게 병합하며, 배열은 대체합니다.
     */
    private deepMerge<T>(target: T, source: Partial<T>): T {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                const sourceValue = source[key];
                const targetValue = result[key];
                
                // undefined 값은 무시하고 기존 값 유지
                if (sourceValue === undefined) {
                    continue;
                }
                
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

    /**
     * 설정을 기본값으로 리셋합니다
     */
    async resetSettings(): Promise<void> {
        this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        await this.saveCallback(this.settings);
    }

    /**
     * 기본 설정을 반환합니다
     * 
     * @returns 기본 설정 (복사본)
     * 
     * @remarks
     * 원본 DEFAULT_SETTINGS가 변경되지 않도록 깊은 복사를 반환합니다.
     */
    getDefaultSettings(): CardNavigatorSettings {
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
}
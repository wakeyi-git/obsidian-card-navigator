import { App, Setting, Notice } from 'obsidian';
import CardNavigatorPlugin from '../../main';
import { DebugCategory } from '../../types';
import { CardNavigatorView } from '../../view';
import { getAvailableLanguages, getLanguageDisplayName, t, type LanguageSetting } from '../../i18n';
import type { CardNavigatorSettingTab } from '../SettingsTab';

/**
 * OtherSettings
 *
 * 기타 탭 설정 UI (언어 + 성능 + 디버그 + 설정 관리)
 */
export class OtherSettings {
    constructor(
        private plugin: CardNavigatorPlugin,
        private settingsTab: CardNavigatorSettingTab,
        private app: App
    ) {}

    /**
     * 기타 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.addLanguageSettings(containerEl);
        this.addPerformanceSettings(containerEl);

        // 디버그 설정은 개발 모드에서만 표시
        if (process.env.NODE_ENV !== 'production') {
            this.addDebugSettings(containerEl);
        }

        this.addSettingsManagement(containerEl);
    }

    /**
     * 언어 설정을 추가합니다
     */
    private addLanguageSettings(containerEl: HTMLElement): void {
        const trans = t().settings.language;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.name);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        const availableLanguages = getAvailableLanguages();

        new Setting(itemsEl)
            .setName(trans.name)
            .setDesc(trans.description)
            .addDropdown(dropdown => {
                // Add auto option
                dropdown.addOption('auto', 'Auto');

                // Add available languages
                availableLanguages.forEach(lang => {
                    dropdown.addOption(lang, getLanguageDisplayName(lang));
                });

                dropdown
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value: string) => {
                        this.plugin.settings.language = value as LanguageSetting;
                        await this.plugin.saveSettings();
                        // Refresh the settings UI to apply new language
                        this.settingsTab.display();
                        new Notice('Language changed. Please reload the plugin for full effect.');
                    });
            });
    }

    /**
     * 성능 설정을 추가합니다
     */
    private addPerformanceSettings(containerEl: HTMLElement): void {
        const trans = t().settingsTab.performanceSettings;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        // 증분 렌더링 청크 크기
        new Setting(itemsEl)
            .setName(trans.chunkSize)
            .setDesc(trans.chunkSizeDescription)
            .addSlider(slider => slider
                .setLimits(5, 50, 5)
                .setValue(this.plugin.settings.incrementalRenderChunkSize || 20)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.incrementalRenderChunkSize = value;
                    await this.plugin.saveSettings();
                })
            );

        // 사용자 정의 문법 필터
        this.addCustomSyntaxFilters(itemsEl);

        // 캐시 통계
        this.addCacheStatistics(containerEl);
    }

    /**
     * 사용자 정의 문법 필터 설정을 추가합니다
     */
    private addCustomSyntaxFilters(itemsEl: HTMLElement): void {
        const cardTrans = t().settingsTab.cardSettings;
        const currentFilters = this.plugin.settings.customSyntaxFilters || [];

        new Setting(itemsEl)
            .setName(cardTrans.customSyntaxFilters)
            .setDesc(cardTrans.customSyntaxFiltersDescription)
            .addTextArea(text => text
                .setPlaceholder(cardTrans.customSyntaxFiltersPlaceholder)
                .setValue(currentFilters.join(', '))
                .onChange(async (value) => {
                    // 쉼표 또는 줄바꿈으로 구분
                    const filters = value
                        .split(/[,\n]/)
                        .map(f => f.trim())
                        .filter(f => f.length > 0);
                    this.plugin.settings.customSyntaxFilters = filters;
                    await this.plugin.saveSettings();
                })
            );
    }

    /**
     * 캐시 통계를 추가합니다
     */
    private addCacheStatistics(containerEl: HTMLElement): void {
        const trans = t().settingsTab.cacheStatistics;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        // 통계 컨테이너
        const statsContainer = itemsEl.createDiv({ cls: 'cache-stats-container' });
        statsContainer.style.padding = '10px';
        statsContainer.style.backgroundColor = 'var(--background-secondary)';
        statsContainer.style.borderRadius = '6px';
        statsContainer.style.marginBottom = '20px';

        // Check all leaves of CardNavigatorView type
        const leaves = this.app.workspace.getLeavesOfType('card-navigator-view');
        const viewLeaf = leaves.length > 0 ? leaves[0] : null;
        const view = viewLeaf ? (viewLeaf.view as CardNavigatorView) : null;

        if (!view) {
            statsContainer.createEl('p', {
                text: trans.viewNotOpen,
                cls: 'setting-item-description'
            });
            return;
        }

        // 캐시 통계 가져오기
        const stats = view.searchEngine?.getCacheStats();
        const cacheSize = view.searchEngine?.size;

        if (!stats || !cacheSize) {
            statsContainer.createEl('p', {
                text: trans.notAvailable,
                cls: 'setting-item-description'
            });
            return;
        }

        // 통계 표시
        const createStatRow = (label: string, value: string | number) => {
            const row = statsContainer.createDiv({ cls: 'cache-stat-row' });
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.padding = '4px 0';

            row.createEl('span', { text: label, cls: 'cache-stat-label' });
            row.createEl('strong', { text: String(value), cls: 'cache-stat-value' });
        };

        createStatRow(trans.totalRequests, stats.totalRequests);
        createStatRow(trans.hitRate, `${(stats.hitRate * 100).toFixed(1)}%`);

        statsContainer.createEl('div', { cls: 'cache-stat-divider' })
            .style.borderTop = '1px solid var(--background-modifier-border)';

        createStatRow(trans.l1Hits, stats.l1Hits);
        createStatRow(trans.l2Hits, stats.l2Hits);
        createStatRow(trans.l3Hits, stats.l3Hits);
        createStatRow(trans.misses, stats.misses);

        statsContainer.createEl('div', { cls: 'cache-stat-divider' })
            .style.borderTop = '1px solid var(--background-modifier-border)';

        createStatRow(trans.l1Size, `${cacheSize.l1} / 10`);
        createStatRow(trans.l2Size, `${cacheSize.l2} / 40`);
        createStatRow(trans.totalSize, `${cacheSize.total} / 50`);

        // 캐시 클리어 버튼
        new Setting(itemsEl)
            .setName(trans.clearCache)
            .setDesc(trans.clearCacheDescription)
            .addButton(button => button
                .setButtonText(trans.clearCacheButton)
                .onClick(() => {
                    view.searchEngine?.clearCache();
                    new Notice(trans.cacheCleared);
                    // UI 새로고침
                    this.settingsTab.display();
                })
            );
    }

    /**
     * 디버그 모드 설정을 추가합니다
     */
    private addDebugSettings(containerEl: HTMLElement): void {
        const trans = t().settingsTab.debugMode;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        // 디버그 모드 활성화/비활성화
        new Setting(itemsEl)
            .setName(trans.enable)
            .setDesc(trans.enableDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debug.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.debug.enabled = value;
                    await this.plugin.saveSettings();
                    this.settingsTab.display();
                })
            );

        // 디버그 모드가 활성화되어 있을 때만 카테고리 설정 표시
        if (this.plugin.settings.debug.enabled) {
            // 카테고리 설명
            const descEl = itemsEl.createDiv({ cls: 'setting-item-description' });
            descEl.setText(trans.categoriesDescription);
            descEl.style.marginBottom = '10px';
            descEl.style.fontSize = '0.9em';
            descEl.style.color = 'var(--text-muted)';

            // 카테고리별 설정
            const categoryMap: Record<DebugCategory, keyof typeof trans.categories> = {
                'Plugin': 'plugin',
                'View': 'view',
                'Layout': 'layout',
                'Card': 'card',
                'Search': 'search',
                'Filter': 'filter',
                'Navigation': 'navigation',
                'Preset': 'preset',
                'Sort': 'sort',
                'Selection': 'selection',
                'DragDrop': 'dragDrop',
                'Mode': 'mode',
                'Settings': 'settings',
                'Grouping': 'grouping',
                'Cache': 'cache',
                'Event': 'event',
                'UI': 'ui',
                'Performance': 'performance'
            };

            const categories: DebugCategory[] = Object.keys(categoryMap) as DebugCategory[];

            categories.forEach(category => {
                const catKey = categoryMap[category];
                const catInfo = trans.categories[catKey];
                const currentValue = this.plugin.settings.debug.categories?.[category] ?? true;

                new Setting(itemsEl)
                    .setName(`[${category}] ${catInfo.label}`)
                    .setDesc(catInfo.description)
                    .addToggle(toggle => toggle
                        .setValue(currentValue)
                        .onChange(async (value) => {
                            // categories가 undefined면 빈 객체로 초기화
                            if (!this.plugin.settings.debug.categories) {
                                this.plugin.settings.debug.categories = {};
                            }
                            this.plugin.settings.debug.categories[category] = value;
                            await this.plugin.saveSettings();
                        })
                    );
            });

            // 전체 선택/해제 버튼
            new Setting(itemsEl)
                .setName(trans.allCategories)
                .setDesc(trans.allCategoriesDescription)
                .addButton(button => button
                    .setButtonText(trans.selectAll)
                    .onClick(async () => {
                        if (!this.plugin.settings.debug.categories) {
                            this.plugin.settings.debug.categories = {};
                        }
                        categories.forEach(category => {
                            this.plugin.settings.debug.categories![category] = true;
                        });
                        await this.plugin.saveSettings();
                        this.settingsTab.display();
                    })
                )
                .addButton(button => button
                    .setButtonText(trans.deselectAll)
                    .onClick(async () => {
                        if (!this.plugin.settings.debug.categories) {
                            this.plugin.settings.debug.categories = {};
                        }
                        categories.forEach(category => {
                            this.plugin.settings.debug.categories![category] = false;
                        });
                        await this.plugin.saveSettings();
                        this.settingsTab.display();
                    })
                );
        }
    }

    /**
     * 설정 관리(초기화/내보내기/가져오기)를 추가합니다
     */
    private addSettingsManagement(containerEl: HTMLElement): void {
        const trans = t().settingsTab.settingsManagement;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        // 설정 초기화
        new Setting(itemsEl)
            .setName(trans.reset)
            .setDesc(trans.resetDescription)
            .addButton(button => button
                .setButtonText(trans.resetButton)
                .setWarning()
                .onClick(async () => {
                    if (confirm(trans.resetConfirm)) {
                        this.plugin.logger.debug('Settings', t().settingsAdditional.settingsResetStart);

                        // 1. 설정 초기화 (프리셋과 매핑도 기본값인 빈 배열로)
                        await this.plugin.settingsManager.resetSettings();
                        this.plugin.logger.debug('Settings', 'settingsManager.resetSettings() 완료');

                        // 2. PresetManager 상태 리셋 (currentPresetId 초기화)
                        this.plugin.presetManager.reset();
                        this.plugin.logger.debug('Settings', 'presetManager.reset() 완료');

                        // 3. 스타일 다시 적용 (기본 스타일로)
                        const defaultSettings = this.plugin.settingsManager.getSettings();
                        this.plugin.styleManager.applyStyles(defaultSettings);
                        this.plugin.logger.debug('Settings', 'styleManager.applyStyles() 완료');

                        // 4. 뷰 새로고침
                        this.plugin.refreshView();
                        this.plugin.logger.debug('Settings', 'refreshView() 완료');

                        // 5. 설정 UI 새로고침
                        this.settingsTab.display();
                        this.plugin.logger.debug('Settings', 'display() 완료');

                        this.plugin.logger.debug('Settings', t().settingsAdditional.settingsResetComplete);
                        new Notice(trans.resetSuccess);
                    }
                })
            );

        // 설정 내보내기
        new Setting(itemsEl)
            .setName(trans.export)
            .setDesc(trans.exportDescription)
            .addButton(button => button
                .setButtonText(trans.exportButton)
                .onClick(() => {
                    this.exportSettings();
                })
            );

        // 설정 가져오기
        new Setting(itemsEl)
            .setName(trans.import)
            .setDesc(trans.importDescription)
            .addButton(button => button
                .setButtonText(trans.importButton)
                .onClick(() => {
                    this.importSettings();
                })
            );
    }

    /**
     * 설정을 JSON으로 내보냅니다
     */
    private exportSettings(): void {
        const settings = this.plugin.settings;
        const json = JSON.stringify(settings, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'card-navigator-settings.json';
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * JSON 파일에서 설정을 가져옵니다
     */
    private importSettings(): void {
        const trans = t().settingsTab.settingsManagement;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const settings = JSON.parse(text);

                // 설정 검증 (간단한 타입 체크)
                if (typeof settings === 'object' && settings !== null) {
                    Object.assign(this.plugin.settings, settings);
                    await this.plugin.saveSettings();
                    this.plugin.refreshView();
                    this.settingsTab.display();
                    alert(trans.importSuccess);
                } else {
                    throw new Error(trans.importInvalid);
                }
            } catch (error) {
                this.plugin.logger.error('Settings', t().settingsAdditional.settingsImportError, error);
                alert(trans.importError);
            }
        });

        input.click();
    }
}

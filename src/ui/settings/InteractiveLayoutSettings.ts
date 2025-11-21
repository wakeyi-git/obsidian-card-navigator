import { Setting } from 'obsidian';
import { BaseSettings } from './BaseSettings';
import { DEFAULT_SETTINGS } from '../../types';
import { LAYOUT_LIMITS } from '../../constants';
import { debounce } from '../../utils/debounce';
import { t } from '../../i18n';

/**
 * InteractiveLayoutSettings
 *
 * 레이아웃 설정 UI
 */
export class InteractiveLayoutSettings extends BaseSettings {
    private debouncedForceViewRender: () => void;

    constructor(plugin: any) {
        super(plugin);

        this.debouncedForceViewRender = debounce(() => {
            this.forceViewRender();
        }, 300);
    }

    /**
     * Card Navigator 뷰를 강제로 다시 렌더링합니다
     */
    private forceViewRender(): void {
        const leaves = this.plugin.app.workspace.getLeavesOfType('card-navigator');
        if (leaves.length > 0) {
            const view = leaves[0].view;
            if (view && 'refresh' in view && typeof view.refresh === 'function') {
                (view as any).refresh();
            }
        }
    }

    /**
     * 레이아웃 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.createHeader(
            containerEl,
            t().settingsTab.tabs.layout,
            t().settings.layoutSection.description
        );

        const settings = this.plugin.settingsManager.getSettings();
        const defaultLayout = DEFAULT_SETTINGS.layout;

        // 카드 최소 너비
        this.createSliderSetting(
            containerEl,
            t().settingsTab.layoutSettings.minWidth,
            t().settingsTab.layoutSettings.minWidthDescription(LAYOUT_LIMITS.cardMinWidth.min, LAYOUT_LIMITS.cardMinWidth.max),
            LAYOUT_LIMITS.cardMinWidth,
            settings.layout.cardMinWidth,
            async (value) => {
                settings.layout.cardMinWidth = value;
                await this.plugin.saveSettings();
                this.debouncedForceViewRender();
            },
            async () => {
                settings.layout.cardMinWidth = defaultLayout.cardMinWidth;
                await this.plugin.saveSettings();
                this.plugin.settingsTab.display();
            }
        );

        // 카드 최소 높이
        this.createSliderSetting(
            containerEl,
            t().settingsTab.layoutSettings.minHeight,
            t().settingsTab.layoutSettings.minHeightDescription(LAYOUT_LIMITS.cardMinHeight.min, LAYOUT_LIMITS.cardMinHeight.max),
            LAYOUT_LIMITS.cardMinHeight,
            settings.layout.cardMinHeight,
            async (value) => {
                settings.layout.cardMinHeight = value;
                await this.plugin.saveSettings();
                this.debouncedForceViewRender();
            },
            async () => {
                settings.layout.cardMinHeight = defaultLayout.cardMinHeight;
                await this.plugin.saveSettings();
                this.plugin.settingsTab.display();
            }
        );

        // 카드 최대 너비
        this.createSliderSetting(
            containerEl,
            t().settingsTab.layoutSettings.maxWidth,
            t().settingsTab.layoutSettings.maxWidthDescription(LAYOUT_LIMITS.cardMaxWidth.min, LAYOUT_LIMITS.cardMaxWidth.max),
            LAYOUT_LIMITS.cardMaxWidth,
            settings.layout.cardMaxWidth,
            async (value) => {
                settings.layout.cardMaxWidth = value;
                await this.plugin.saveSettings();
                this.debouncedForceViewRender();
            },
            async () => {
                settings.layout.cardMaxWidth = defaultLayout.cardMaxWidth;
                await this.plugin.saveSettings();
                this.plugin.settingsTab.display();
            }
        );

        // 카드 최대 높이
        this.createSliderSetting(
            containerEl,
            t().settingsTab.layoutSettings.maxHeight,
            t().settingsTab.layoutSettings.maxHeightDescription(LAYOUT_LIMITS.cardMaxHeight.min, LAYOUT_LIMITS.cardMaxHeight.max),
            LAYOUT_LIMITS.cardMaxHeight,
            settings.layout.cardMaxHeight,
            async (value) => {
                settings.layout.cardMaxHeight = value;
                await this.plugin.saveSettings();
                this.debouncedForceViewRender();
            },
            async () => {
                settings.layout.cardMaxHeight = defaultLayout.cardMaxHeight;
                await this.plugin.saveSettings();
                this.plugin.settingsTab.display();
            }
        );

        // 카드 간격
        this.createSliderSetting(
            containerEl,
            t().settingsTab.layoutSettings.cardGap,
            t().settingsTab.layoutSettings.cardGapDescription(LAYOUT_LIMITS.gap.min, LAYOUT_LIMITS.gap.max),
            LAYOUT_LIMITS.gap,
            settings.layout.gap,
            async (value) => {
                settings.layout.gap = value;
                await this.plugin.saveSettings();
                this.debouncedForceViewRender();
            },
            async () => {
                settings.layout.gap = defaultLayout.gap;
                await this.plugin.saveSettings();
                this.plugin.settingsTab.display();
            }
        );
    }

    /**
     * 슬라이더 설정을 생성합니다
     */
    private createSliderSetting(
        container: HTMLElement,
        name: string,
        desc: string,
        limits: { min: number; max: number; step: number },
        value: number,
        onChange: (value: number) => Promise<void>,
        onReset: () => Promise<void>
    ): void {
        new Setting(container)
            .setName(name)
            .setDesc(desc)
            .addSlider(slider => slider
                .setLimits(limits.min, limits.max, limits.step)
                .setValue(value)
                .setDynamicTooltip()
                .onChange(onChange)
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(onReset)
            );
    }
}

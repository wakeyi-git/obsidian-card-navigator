import { Setting, Notice, setIcon } from 'obsidian';
import CardNavigatorPlugin from '../../main';
import { CardSettings, CardSectionSettings, CardStyleSettings, CardSectionStyleSettings, CardSectionContentSettings, DEFAULT_SETTINGS } from '../../types';
import { debounce } from '../../utils/debounce';
import { DebugLogger } from '../../utils/DebugLogger';
import { StyleUtils } from '../../utils/StyleUtils';
import { t } from '../../i18n';

/**
 * 미리 보기 기반 인터랙티브 카드 설정 UI
 *
 * 실시간 미리 보기를 통해 직관적으로 카드 스타일을 설정할 수 있습니다.
 * 헤더/바디/풋터 영역을 클릭하여 선택하고, 각 영역의 내용과 스타일을
 * 일반/활성/포커스 상태별로 설정할 수 있습니다.
 *
 * @remarks
 * - 메모리 누수 방지 (AbortController)
 * - 키보드 접근성 지원
 * - 모바일 터치 이벤트 대응
 * - requestAnimationFrame으로 리플로우 최소화
 */
export class CardSettingsUI {
    private previewCard: HTMLElement | null = null;
    private selectedSection: 'header' | 'body' | 'footer' = 'header';
    private selectedState: 'normal' | 'active' | 'focused' = 'normal';
    private sectionSettingsPanel: HTMLElement | null = null;
    private cardBaseSettingsContent: HTMLElement | null = null;

    private availableProperties: Set<string> = new Set();
    private currentFileProperties: Map<string, string> = new Map();

    private debouncedSave: () => void;
    private debouncedUpdatePreview: () => void;
    private debouncedForceViewRender: () => void;

    private abortController: AbortController | null = null;
    private currentTabIndex = 0;
    private readonly stateKeys: ('normal' | 'active' | 'focused')[] = ['normal', 'active', 'focused'];

    private logger: DebugLogger;

    // ⭐ Phase 5 최적화: 마지막으로 로드한 파일 경로 추적
    private lastLoadedFilePath: string | null = null;

    constructor(private plugin: CardNavigatorPlugin) {
        
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(() => plugin.settings);
        
        this.debouncedSave = debounce(async () => {
            await this.plugin.saveSettings();
        }, 300);
        
        this.collectFrontmatterProperties();
        this.loadCurrentFileProperties();
        
        this.debouncedUpdatePreview = debounce(() => {
            this.updatePreviewStyles();
        }, 150);
        
        this.debouncedForceViewRender = debounce(() => {
            this.forceViewRender();
        }, 500);
        
        this.abortController = new AbortController();
    }
    
    /**
     * 볼트의 모든 프론트매터 속성을 수집합니다
     */
    private collectFrontmatterProperties(): void {
        const files = this.plugin.app.vault.getMarkdownFiles();
        
        for (const file of files) {
            const cache = this.plugin.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter) {
                Object.keys(cache.frontmatter).forEach(key => {
                    if (!key.startsWith('_') && key !== 'position' && key !== 'tags') {
                        this.availableProperties.add(key);
                    }
                });
            }
        }
        
        this.logger.debug('Settings', t().interactiveCardSettings.propertyCollectionComplete, {
            count: this.availableProperties.size
        });
    }
    
    /**
     * 현재 활성 파일의 프론트매터 속성을 로드합니다
     */
    private loadCurrentFileProperties(): void {
        this.currentFileProperties.clear();
        
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) return;
        
        const cache = this.plugin.app.metadataCache.getFileCache(activeFile);
        if (cache?.frontmatter) {
            Object.entries(cache.frontmatter).forEach(([key, value]) => {
                if (!key.startsWith('_') && key !== 'position' && key !== 'tags') {
                    this.currentFileProperties.set(key, String(value));
                }
            });
        }
        
        this.logger.debug('Settings', t().interactiveCardSettings.currentFilePropertiesLoaded, {
            count: this.currentFileProperties.size
        });
    }
    
    /**
     * Card Navigator 뷰를 강제로 다시 렌더링합니다
     *
     * @remarks
     * 설정 변경 시 실제 카드에 즉시 반영하기 위해 사용합니다.
     */
    private forceViewRender(): void {
        const leaves = this.plugin.app.workspace.getLeavesOfType('card-navigator');
        if (leaves.length > 0) {
            const view = leaves[0].view;
            if (view && 'refresh' in view && typeof view.refresh === 'function') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (view as any).refresh();
            }
        }
    }

    /**
     * 일반 상태 카드 스타일 변경 시 상속 중인 활성/포커스 스타일을 자동 업데이트합니다
     *
     * @param property - 변경된 속성 이름
     * @param value - 새로운 값
     */
    private updateInheritingCardStyles(property: keyof CardStyleSettings, value: string | number): void {
        const activeStyle = this.plugin.settings.activeCardStyle;
        const focusedStyle = this.plugin.settings.focusedCardStyle;

        // 활성 상태가 상속 중이면 업데이트
        if (activeStyle.inheritFromNormal) {
            activeStyle[property] = value as never;
        }

        // 포커스 상태가 상속 중이면 업데이트
        if (focusedStyle.inheritFromNormal) {
            focusedStyle[property] = value as never;
        }
    }

    /**
     * 일반 상태 섹션 스타일 변경 시 상속 중인 활성/포커스 스타일을 자동 업데이트합니다
     *
     * @param section - 섹션 타입 ('header' | 'body' | 'footer')
     * @param property - 변경된 속성 이름
     * @param value - 새로운 값
     */
    private updateInheritingSectionStyles(
        section: 'header' | 'body' | 'footer',
        property: keyof CardSectionStyleSettings,
        value: string | number
    ): void {
        const sectionSettings = this.plugin.settings[section];
        const activeStyle = sectionSettings.activeStyle;
        const focusedStyle = sectionSettings.focusedStyle;

        // 활성 상태가 상속 중이면 업데이트
        if (activeStyle.inheritFromNormal) {
            activeStyle[property] = value as never;
        }

        // 포커스 상태가 상속 중이면 업데이트
        if (focusedStyle.inheritFromNormal) {
            focusedStyle[property] = value as never;
        }
    }

    /**
     * 일반 상태 섹션 내용 설정 변경 시 상속 중인 활성/포커스 내용 설정을 자동 업데이트합니다
     *
     * @param section - 섹션 타입 ('header' | 'body' | 'footer')
     * @param property - 변경된 속성 이름
     * @param value - 새로운 값
     */
    private updateInheritingSectionContents(
        section: 'header' | 'body' | 'footer',
        property: keyof CardSectionContentSettings,
        value: unknown
    ): void {
        const sectionSettings = this.plugin.settings[section];

        // activeContent와 focusedContent는 DEFAULT_SETTINGS로 이미 초기화되어 있음
        // 추가 초기화 불필요

        // 활성 상태가 상속 중이면 업데이트
        if (sectionSettings.activeContent.inheritFromNormal) {
            sectionSettings.activeContent[property] = value as never;
        }

        // 포커스 상태가 상속 중이면 업데이트
        if (sectionSettings.focusedContent.inheritFromNormal) {
            sectionSettings.focusedContent[property] = value as never;
        }
    }
    
    /**
     * 컴포넌트를 정리하고 메모리 누수를 방지합니다
     * 
     * @remarks
     * AbortController로 모든 이벤트 리스너를 한 번에 제거하여
     * 메모리 누수를 방지합니다.
     */
    destroy(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        
        this.previewCard = null;
        this.sectionSettingsPanel = null;
        this.cardBaseSettingsContent = null;
    }

    /**
     * 설정 UI를 렌더링합니다
     * 
     * @param containerEl - 설정을 렌더링할 컨테이너 요소
     * 
     * @remarks
     * 모바일 기기 감지 및 전용 스타일 적용
     */
    render(containerEl: HTMLElement): void {
        this.collectFrontmatterProperties();
        this.loadCurrentFileProperties();
        
        const container = containerEl.createDiv({ cls: 'card-settings-container'});
        
        if (this.isMobileDevice()) {
            container.addClass('is-mobile');
        }
        
        // ⭐ Phase 5 최적화: 파일 변경 체크 추가
        this.plugin.app.workspace.on('active-leaf-change', () => {
            const activeFile = this.plugin.app.workspace.getActiveFile();
            const currentPath = activeFile?.path || null;

            // 같은 파일이면 스킵
            if (currentPath === this.lastLoadedFilePath) {
                return;
            }
            this.lastLoadedFilePath = currentPath;

            this.loadCurrentFileProperties();
            if (this.previewCard && this.plugin.settings[this.selectedSection].normalContent.contentType === 'property') {
                this.refreshPreviewCard();
            }
        });

        // ⭐ DOM 순서를 Grid 레이아웃 순서와 일치시킴 (왼쪽 -> 오른쪽 -> 아래)
        this.renderPreviewSection(container);      // grid-row: 1, grid-column: 1
        this.renderCardBaseSettings(container);    // grid-row: 1, grid-column: 2
        this.renderSectionSettings(container);     // grid-row: 2, grid-column: 1 / -1
    }

    /**
     * 카드 기본 설정을 렌더링합니다
     */
    private renderCardBaseSettings(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'card-base-settings'});

        section.createEl('h3', { text: t().settingsTab.cardSettings.cardBaseSettings });

        const descEl = section.createDiv({ cls: 'setting-item-description'});
        descEl.setText(t().settingsTab.cardSettings.cardBaseSettingsDescription);
        descEl.style.marginBottom = '12px';
        descEl.style.fontSize = '0.9em';
        descEl.style.color = 'var(--text-muted)';

        const currentStateLabel = section.createDiv({ cls: 'current-state-label'});
        currentStateLabel.setText(t().settingsTab.cardSettings.currentState(this.getStateLabel()));

        this.cardBaseSettingsContent = section.createDiv({ cls: 'card-base-settings-content'});
        this.updateCardBaseSettings();
    }
    
    /**
     * 카드 기본 설정을 업데이트합니다
     */
    private updateCardBaseSettings(): void {
        if (!this.cardBaseSettingsContent) return;

        this.cardBaseSettingsContent.empty();

        const style = this.getCurrentCardStyle();

        // 활성/포커스 상태에서만 상속 토글 표시
        if (this.selectedState !== 'normal') {
            new Setting(this.cardBaseSettingsContent)
                .setName(t().settingsTab.cardSettings.inheritFromNormal)
                .setDesc(t().settingsTab.cardSettings.inheritFromNormalDescription)
                .addToggle(toggle => toggle
                    .setValue(style.inheritFromNormal || false)
                    .onChange(async (value) => {
                        style.inheritFromNormal = value;

                        // 상속 활성화 시: 일반 상태의 값을 현재 상태로 복사
                        if (value) {
                            const normalStyle = this.plugin.settings.normalCardStyle;
                            style.backgroundColor = normalStyle.backgroundColor;
                            style.fontSize = normalStyle.fontSize;
                            style.borderColor = normalStyle.borderColor;
                            style.borderWidth = normalStyle.borderWidth;
                            style.borderRadius = normalStyle.borderRadius;
                        }
                        // 상속 비활성화 시: 현재 저장된 값 유지 (사용자가 수정 가능)

                        await this.plugin.saveSettings();
                        this.updateCardBaseSettings(); // UI 다시 렌더링
                        this.updatePreviewStyles();
                        this.forceViewRender();
                    })
                );

            // 상속 모드일 때는 다른 설정 비활성화
            if (style.inheritFromNormal) {
                const inheritInfo = this.cardBaseSettingsContent.createDiv({ cls: 'setting-item-description' });
                inheritInfo.setText(`ℹ️ ${t().settingsTab.cardSettings.inheritingFromNormalInfo}`);
                inheritInfo.style.marginBottom = '12px';
                inheritInfo.style.fontStyle = 'italic';
                inheritInfo.style.color = 'var(--text-muted)';
                return; // 상속 모드에서는 나머지 설정 숨김
            }
        }

        new Setting(this.cardBaseSettingsContent)
            .setName(t().settingsTab.cardSettings.borderColor)
            .setDesc(t().settingsTab.cardSettings.borderColorDescription)
            .addColorPicker(color => color
                .setValue(this.extractColorValue(style.borderColor))
                .onChange(async (value) => {
                    style.borderColor = value;
                    // 일반 상태일 때만 상속 중인 스타일 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingCardStyles('borderColor', value);
                    }
                    await this.plugin.saveSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    const defaultStyle = this.getDefaultCardStyle();
                    style.borderColor = defaultStyle.borderColor;
                    // 일반 상태일 때만 상속 중인 스타일 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingCardStyles('borderColor', defaultStyle.borderColor);
                    }
                    await this.plugin.saveSettings();
                    this.updateCardBaseSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice(t().notices.interactiveCard.borderColorReset);
                })
            );

        new Setting(this.cardBaseSettingsContent)
            .setName(t().settingsTab.cardSettings.borderThickness)
            .setDesc(t().settingsTab.cardSettings.borderThicknessDescription)
            .addText(text => text
                .setValue(String(style.borderWidth))
                .onChange((value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 0) {
                        style.borderWidth = num;
                        // 일반 상태일 때만 상속 중인 스타일 업데이트
                        if (this.selectedState === 'normal') {
                            this.updateInheritingCardStyles('borderWidth', num);
                        }
                        this.debouncedUpdatePreview();
                        this.debouncedSave();
                        this.debouncedForceViewRender();
                    }
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    const defaultStyle = this.getDefaultCardStyle();
                    style.borderWidth = defaultStyle.borderWidth;
                    // 일반 상태일 때만 상속 중인 스타일 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingCardStyles('borderWidth', defaultStyle.borderWidth);
                    }
                    await this.plugin.saveSettings();
                    this.updateCardBaseSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice(t().notices.interactiveCard.borderThicknessReset);
                })
            );

        new Setting(this.cardBaseSettingsContent)
            .setName(t().settingsTab.cardSettings.borderRadius)
            .setDesc(t().settingsTab.cardSettings.borderRadiusDescription)
            .addText(text => text
                .setValue(String(style.borderRadius))
                .onChange((value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 0) {
                        style.borderRadius = num;
                        // 일반 상태일 때만 상속 중인 스타일 업데이트
                        if (this.selectedState === 'normal') {
                            this.updateInheritingCardStyles('borderRadius', num);
                        }
                        this.debouncedUpdatePreview();
                        this.debouncedSave();
                        this.debouncedForceViewRender();
                    }
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    const defaultStyle = this.getDefaultCardStyle();
                    style.borderRadius = defaultStyle.borderRadius;
                    // 일반 상태일 때만 상속 중인 스타일 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingCardStyles('borderRadius', defaultStyle.borderRadius);
                    }
                    await this.plugin.saveSettings();
                    this.updateCardBaseSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice(t().notices.interactiveCard.borderRadiusReset);
                })
            );
    }
    
    /**
     * 현재 선택된 상태의 카드 스타일을 반환합니다
     */
    private getCurrentCardStyle(): CardStyleSettings {
        const settings = this.plugin.settings;
        switch (this.selectedState) {
            case 'active':
                return settings.activeCardStyle;
            case 'focused':
                return settings.focusedCardStyle;
            default:
                return settings.normalCardStyle;
        }
    }

    /**
     * 미리 보기 섹션을 렌더링합니다
     */
    private renderPreviewSection(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'card-preview-section'});
        
        const header = section.createDiv({ cls: 'preview-header'});
        // header.createEl('h3', { text: '카드 미리 보기' });
        
        const tabs = header.createDiv({ cls: 'preview-state-tabs'});
        this.createStateTabs(tabs);
        
        this.previewCard = this.createPreviewCard(section);
        
        const hint = section.createDiv({ cls: 'preview-hint'});
        const hintIcon = hint.createSpan({ cls: 'preview-hint-icon'});
        setIcon(hintIcon, 'lightbulb');
        hint.createSpan({ cls: ''}).setText(t().settingsTab.cardSettings.clickSectionHint);
        
        this.bindSectionClickEvents();
    }

    /**
     * 상태 전환 탭을 생성합니다
     * 
     * @remarks
     * 키보드 접근성 지원 (화살표 키로 탭 전환)
     */
    private createStateTabs(container: HTMLElement): void {
        const states = [
            { key: 'normal' as const, label: t().settingsTab.cardSettings.stateName.normal },
            { key: 'active' as const, label: t().settingsTab.cardSettings.stateName.active },
            { key: 'focused' as const, label: t().settingsTab.cardSettings.stateName.focused }
        ];

        states.forEach((state, index) => {
            const button = container.createEl('button', {
                text: state.label,
                cls: state.key === this.selectedState ? 'active' : ''
            });

            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', (state.key === this.selectedState).toString());
            button.setAttribute('aria-label', `${state.label} ${t().settingsTab.cardSettings.stateLabel[state.key]}`);

            button.addEventListener('click', () => {
                this.switchState(state.key);
                this.currentTabIndex = index;
            }, { signal: this.abortController?.signal });

            button.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'ArrowLeft' && index > 0) {
                    e.preventDefault();
                    const prevButton = container.children[index - 1] as HTMLElement;
                    prevButton.click();
                    prevButton.focus();
                } else if (e.key === 'ArrowRight' && index < states.length - 1) {
                    e.preventDefault();
                    const nextButton = container.children[index + 1] as HTMLElement;
                    nextButton.click();
                    nextButton.focus();
                }
            }, { signal: this.abortController?.signal });
        });
    }

    /**
     * 상태를 전환합니다
     */
    private switchState(state: 'normal' | 'active' | 'focused'): void {
        this.selectedState = state;
        
        const tabs = this.previewCard?.parentElement?.querySelectorAll('.preview-state-tabs button');
        tabs?.forEach((tab, index) => {
            tab.removeClass('active');
            const stateKeys: ('normal' | 'active' | 'focused')[] = ['normal', 'active', 'focused'];
            if (stateKeys[index] === state) {
                tab.addClass('active');
            }
        });
        
        if (this.previewCard) {
            this.previewCard.dataset.state = state;
            this.updatePreviewStyles();
        }
        
        this.updateCardBaseSettings();

        const stateLabel = document.querySelector('.current-state-label');
        if (stateLabel) {
            stateLabel.textContent = t().settingsTab.cardSettings.currentState(this.getStateLabel());
        }

        this.updateSectionSettings();
    }

    /**
     * 미리 보기 카드를 생성합니다
     */
    private createPreviewCard(container: HTMLElement): HTMLElement {
        // Modified Strategy A: 실제 카드와 동일한 클래스 사용
        const card = container.createDiv({ cls: 'preview-card card-item'});
        card.dataset.state = this.selectedState;

        if (this.plugin.settings.header.enabled) {
            const headerSection = card.createDiv({ cls: 'card-section card-header'});
            headerSection.dataset.section = 'header';
            if (this.selectedSection === 'header') {
                headerSection.addClass('selected');
            }

            headerSection.createEl('span', {
                cls: 'section-label',
                text: t().settingsTab.cardSettings.sectionLabel.header
            });

            const headerContent = headerSection.createEl('div', {
                cls: 'section-content'
            });
            const headerContentText = this.getSampleContent('header');
            if (headerContentText.includes('<span')) {
                headerContent.innerHTML = headerContentText;
            } else {
                headerContent.textContent = headerContentText;
            }
        }

        if (this.plugin.settings.body.enabled) {
            const bodySection = card.createDiv({ cls: 'card-section card-body'});
            bodySection.dataset.section = 'body';
            if (this.selectedSection === 'body') {
                bodySection.addClass('selected');
            }

            bodySection.createEl('span', {
                cls: 'section-label',
                text: t().settingsTab.cardSettings.sectionLabel.body
            });

            const bodyContent = bodySection.createEl('div', {
                cls: 'section-content'
            });
            const bodyContentText = this.getSampleContent('body');
            if (bodyContentText.includes('<span')) {
                bodyContent.innerHTML = bodyContentText;
            } else {
                bodyContent.textContent = bodyContentText;
            }
        }

        if (this.plugin.settings.footer.enabled) {
            const footerSection = card.createDiv({ cls: 'card-section card-footer'});
            footerSection.dataset.section = 'footer';
            if (this.selectedSection === 'footer') {
                footerSection.addClass('selected');
            }

            footerSection.createEl('span', {
                cls: 'section-label',
                text: t().settingsTab.cardSettings.sectionLabel.footer
            });

            const footerContent = footerSection.createEl('div', {
                cls: 'section-content'
            });
            const footerContentText = this.getSampleContent('footer');
            if (footerContentText.includes('<span')) {
                footerContent.innerHTML = footerContentText;
            } else {
                footerContent.textContent = footerContentText;
            }
        }

        // Modified Strategy A: 초기 렌더링 시 CSS 커스텀 속성 동기적으로 적용
        // requestAnimationFrame 사용하지 않고 즉시 적용하여 첫 로드 시 기본 스타일 표시 방지
        const settings = this.plugin.settings;
        this.applyPreviewCustomProperties(
            card,
            settings.normalCardStyle,
            settings.activeCardStyle,
            settings.focusedCardStyle,
            settings
        );

        // 상태별 CSS 클래스 초기 설정
        if (this.selectedState === 'active') {
            card.classList.add('active');
        } else if (this.selectedState === 'focused') {
            card.classList.add('focused');
        }

        return card;
    }

    /**
     * 샘플 콘텐츠를 반환합니다
     * 
     * @remarks
     * 현재 활성 파일의 실제 프론트매터 값을 사용하여 더 정확한 미리보기를 제공합니다.
     */
    private getSampleContent(section: 'header' | 'body' | 'footer'): string {
        const settings = this.plugin.settings[section];
        const sampleContent = t().settingsTab.cardSettings.sampleContent;

        switch (settings.normalContent.contentType) {
            case 'filename':
                return sampleContent.filename;
            case 'file-path':
                return sampleContent.filePath;
            case 'first-header':
                return sampleContent.firstHeader;
            case 'content':
                return sampleContent.content;
            case 'tags':
                return sampleContent.tags;
            case 'created-date':
                return sampleContent.createdDate;
            case 'modified-date':
                return sampleContent.modifiedDate;
            case 'property':
                if (settings.normalContent.customProperty) {
                    const realValue = this.currentFileProperties.get(settings.normalContent.customProperty);
                    if (realValue) {
                        return sampleContent.propertyWithName(settings.normalContent.customProperty, realValue);
                    } else {
                        return sampleContent.propertyNotFound(settings.normalContent.customProperty);
                    }
                }
                return sampleContent.property;
            case 'backlinks':
                return `<span class="internal-link" data-file-path="note1.md" style="cursor: pointer; color: var(--link-color);">${sampleContent.backlinks.link1}</span>, <span class="internal-link" data-file-path="note2.md" style="cursor: pointer; color: var(--link-color);">${sampleContent.backlinks.link2}</span>`;
            case 'outgoing-links':
                return `<span class="internal-link" data-file-path="reference1.md" style="cursor: pointer; color: var(--link-color);">${sampleContent.outgoingLinks.link1}</span>, <span class="internal-link" data-file-path="reference2.md" style="cursor: pointer; color: var(--link-color);">${sampleContent.outgoingLinks.link2}</span>`;
            default:
                return sampleContent.default;
        }
    }

    /**
     * 영역 클릭 및 키보드 이벤트를 바인딩합니다
     * 
     * @remarks
     * 키보드 접근성과 터치 이벤트 지원 추가
     */
    private bindSectionClickEvents(): void {
        if (!this.previewCard) return;
        
        const sections = this.previewCard.querySelectorAll('.card-section');
        sections.forEach((section, index) => {
            const sectionEl = section as HTMLElement;

            sectionEl.setAttribute('tabindex', '0');
            sectionEl.setAttribute('role', 'button');
            sectionEl.setAttribute('aria-label', `${this.getSectionLabelByIndex(index)} ${t().settingsTab.cardSettings.sectionEnabled(this.getSectionLabelByIndex(index))}`);

            sectionEl.addEventListener('click', () => {
                const sectionType = sectionEl.dataset.section as 'header' | 'body' | 'footer';
                if (sectionType) {
                    this.selectSection(sectionType);
                }
            }, { signal: this.abortController?.signal });
            
            sectionEl.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const sectionType = sectionEl.dataset.section as 'header' | 'body' | 'footer';
                    if (sectionType) {
                        this.selectSection(sectionType);
                    }
                }
            }, { signal: this.abortController?.signal });
        });
        
        this.bindKeyboardNavigation();
        this.bindTouchEvents();
    }
    
    /**
     * 인덱스로 섹션 라벨을 반환합니다
     */
    private getSectionLabelByIndex(index: number): string {
        const sections: ('header' | 'body' | 'footer')[] = ['header', 'body', 'footer'];
        const section = sections[index];
        if (section) {
            return t().settingsTab.cardSettings.sectionLabel[section];
        }
        return t().settingsTab.cardSettings.sectionLabel.header;
    }
    
    /**
     * 키보드 네비게이션을 바인딩합니다
     */
    private bindKeyboardNavigation(): void {
        if (!this.previewCard) return;
        
        const container = this.previewCard.closest('.card-settings-container');
        if (!container) return;
        
        container.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                this.handleTabNavigation(e.key === 'ArrowRight' ? 1 : -1);
                e.preventDefault();
            }
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                this.handleSectionNavigation(e.key === 'ArrowDown' ? 1 : -1);
                e.preventDefault();
            }
        }, { signal: this.abortController?.signal });
    }
    
    /**
     * 화살표 키로 상태 탭을 전환합니다
     */
    private handleTabNavigation(direction: number): void {
        this.currentTabIndex = (this.currentTabIndex + direction + 3) % 3;
        const newState = this.stateKeys[this.currentTabIndex];
        this.switchState(newState);
    }
    
    /**
     * 화살표 키로 섹션을 전환합니다
     */
    private handleSectionNavigation(direction: number): void {
        const sections: ('header' | 'body' | 'footer')[] = ['header', 'body', 'footer'];
        const currentIndex = sections.indexOf(this.selectedSection);
        const newIndex = (currentIndex + direction + 3) % 3;
        this.selectSection(sections[newIndex]);
        
        if (this.previewCard) {
            const newSection = this.previewCard.querySelector(`[data-section="${sections[newIndex]}"]`) as HTMLElement;
            newSection?.focus();
        }
    }

    /**
     * 영역을 선택합니다
     */
    private selectSection(section: 'header' | 'body' | 'footer'): void {
        this.selectedSection = section;
        
        if (this.previewCard) {
            const sections = this.previewCard.querySelectorAll('.card-section');
            sections.forEach(s => s.removeClass('selected'));
            
            const selectedElement = this.previewCard.querySelector(`[data-section="${section}"]`);
            selectedElement?.addClass('selected');
        }
        
        this.updateSectionSettings();
    }

    /**
     * 미리 보기 스타일을 업데이트합니다 (Modified Strategy A: Hybrid Approach)
     *
     * @remarks
     * - CSS 커스텀 속성으로 스타일 설정
     * - 실제 카드와 동일한 CSS 계층 구조 사용
     * - 인라인 스타일 대신 CSS 변수 활용
     */
    private updatePreviewStyles(): void {
        if (!this.previewCard) return;

        requestAnimationFrame(() => {
            if (!this.previewCard) return;

            const settings = this.plugin.settings;

            // Modified Strategy A: CSS 커스텀 속성으로 모든 상태 스타일 설정
            this.applyPreviewCustomProperties(
                this.previewCard,
                settings.normalCardStyle,
                settings.activeCardStyle,
                settings.focusedCardStyle,
                settings
            );

            // 상태별 CSS 클래스 토글
            this.previewCard.classList.remove('active', 'focused');
            if (this.selectedState === 'active') {
                this.previewCard.classList.add('active');
            } else if (this.selectedState === 'focused') {
                this.previewCard.classList.add('focused');
            }
        });
    }
    
    /**
     * 미리 보기 카드에 CSS 커스텀 속성 적용 (Modified Strategy A)
     *
     * @remarks
     * 실제 카드와 동일한 CSS 변수 계층 구조 사용
     */
    private applyPreviewCustomProperties(
        card: HTMLElement,
        normalStyle: CardStyleSettings,
        activeStyle: CardStyleSettings,
        focusedStyle: CardStyleSettings,
        settings: CardSettings
    ): void {
        // 카드 전체 스타일
        StyleUtils.applyCardCustomProperties(card, normalStyle, activeStyle, focusedStyle);

        // 섹션별 스타일 (헤더, 바디, 풋터)
        // Header
        if (settings.header) {
            card.style.setProperty('--card-header-bg-normal', settings.header.normalStyle.backgroundColor);
            card.style.setProperty('--card-header-font-size-normal', `${settings.header.normalStyle.fontSize}px`);
            card.style.setProperty('--card-header-text-color-normal', StyleUtils.getContrastColor(settings.header.normalStyle.backgroundColor));

            card.style.setProperty('--card-header-bg-active', settings.header.activeStyle.backgroundColor);
            card.style.setProperty('--card-header-font-size-active', `${settings.header.activeStyle.fontSize}px`);
            card.style.setProperty('--card-header-text-color-active', StyleUtils.getContrastColor(settings.header.activeStyle.backgroundColor));

            card.style.setProperty('--card-header-bg-focused', settings.header.focusedStyle.backgroundColor);
            card.style.setProperty('--card-header-font-size-focused', `${settings.header.focusedStyle.fontSize}px`);
            card.style.setProperty('--card-header-text-color-focused', StyleUtils.getContrastColor(settings.header.focusedStyle.backgroundColor));
        }

        // Body
        if (settings.body) {
            card.style.setProperty('--card-body-bg-normal', settings.body.normalStyle.backgroundColor);
            card.style.setProperty('--card-body-font-size-normal', `${settings.body.normalStyle.fontSize}px`);
            card.style.setProperty('--card-body-text-color-normal', StyleUtils.getContrastColor(settings.body.normalStyle.backgroundColor));

            card.style.setProperty('--card-body-bg-active', settings.body.activeStyle.backgroundColor);
            card.style.setProperty('--card-body-font-size-active', `${settings.body.activeStyle.fontSize}px`);
            card.style.setProperty('--card-body-text-color-active', StyleUtils.getContrastColor(settings.body.activeStyle.backgroundColor));

            card.style.setProperty('--card-body-bg-focused', settings.body.focusedStyle.backgroundColor);
            card.style.setProperty('--card-body-font-size-focused', `${settings.body.focusedStyle.fontSize}px`);
            card.style.setProperty('--card-body-text-color-focused', StyleUtils.getContrastColor(settings.body.focusedStyle.backgroundColor));
        }

        // Footer
        if (settings.footer) {
            card.style.setProperty('--card-footer-bg-normal', settings.footer.normalStyle.backgroundColor);
            card.style.setProperty('--card-footer-font-size-normal', `${settings.footer.normalStyle.fontSize}px`);
            card.style.setProperty('--card-footer-text-color-normal', StyleUtils.getContrastColor(settings.footer.normalStyle.backgroundColor));

            card.style.setProperty('--card-footer-bg-active', settings.footer.activeStyle.backgroundColor);
            card.style.setProperty('--card-footer-font-size-active', `${settings.footer.activeStyle.fontSize}px`);
            card.style.setProperty('--card-footer-text-color-active', StyleUtils.getContrastColor(settings.footer.activeStyle.backgroundColor));

            card.style.setProperty('--card-footer-bg-focused', settings.footer.focusedStyle.backgroundColor);
            card.style.setProperty('--card-footer-font-size-focused', `${settings.footer.focusedStyle.fontSize}px`);
            card.style.setProperty('--card-footer-text-color-focused', StyleUtils.getContrastColor(settings.footer.focusedStyle.backgroundColor));
        }
    }

    // ⭐ getContrastColor, parseColor 메서드 제거됨
    // Modified Strategy A: StyleUtils.getContrastColor() 사용

    /**
     * 선택된 섹션 설정을 렌더링합니다
     */
    private renderSectionSettings(container: HTMLElement): void {
        this.sectionSettingsPanel = container.createDiv({ cls: 'card-section-settings'});
        this.updateSectionSettings();
    }

    /**
     * 선택된 섹션 설정을 업데이트합니다
     */
    private updateSectionSettings(): void {
        if (!this.sectionSettingsPanel) return;
        
        this.sectionSettingsPanel.empty();
        
        const content = this.sectionSettingsPanel.createDiv({ cls: 'settings-content'});
        
        this.addContentSettings(content);
        this.addSectionStyleSettings(content);
    }

    /**
     * 내용 설정을 추가합니다
     */
    private addContentSettings(container: HTMLElement): void {
        const settings = this.plugin.settings;
        const sectionSettings = settings[this.selectedSection];

        new Setting(container).setHeading().setName(t().settingsTab.cardSettings.sectionContentSettings(this.getSectionLabel()));

        new Setting(container)
            .setName(t().settingsTab.cardSettings.sectionEnabled(this.getSectionLabel()))
            .setDesc(t().settingsTab.cardSettings.sectionEnabledDescription(this.getSectionLabel()))
            .addToggle(toggle => toggle
                .setValue(sectionSettings.enabled)
                .onChange(async (value) => {
                    sectionSettings.enabled = value;
                    await this.plugin.saveSettings();
                    this.refreshPreviewCard();
                })
            );

        // 활성/포커스 상태에서만 내용 상속 토글 표시
        const currentContent = this.getCurrentSectionContent();
        if (this.selectedState !== 'normal') {
            new Setting(container)
                .setName(t().settingsTab.cardSettings.inheritFromNormal)
                .setDesc(t().settingsTab.cardSettings.inheritFromNormalContentDescription)
                .addToggle(toggle => toggle
                    .setValue(currentContent.inheritFromNormal || false)
                    .onChange(async (value) => {
                        currentContent.inheritFromNormal = value;

                        // 상속 활성화 시: 일반 상태의 값을 현재 상태로 복사
                        if (value) {
                            const normalContent = sectionSettings.normalContent;
                            currentContent.contentType = normalContent.contentType;
                            currentContent.maxLength = normalContent.maxLength;
                            currentContent.contentRenderMode = normalContent.contentRenderMode;
                            currentContent.includeFirstHeader = normalContent.includeFirstHeader;
                            currentContent.customProperty = normalContent.customProperty;
                            currentContent.imageThumbnail = normalContent.imageThumbnail;
                        }
                        // 상속 비활성화 시: 현재 저장된 값 유지 (사용자가 수정 가능)

                        await this.plugin.saveSettings();
                        this.updateSectionSettings(); // UI 다시 렌더링
                        this.refreshPreviewCard();
                    })
                );

            // 상속 모드일 때는 다른 설정 비활성화
            if (currentContent.inheritFromNormal) {
                const inheritInfo = container.createDiv({ cls: 'setting-item-description' });
                inheritInfo.setText(`ℹ️ ${t().settingsTab.cardSettings.inheritingFromNormalContentInfo}`);
                inheritInfo.style.marginBottom = '12px';
                inheritInfo.style.fontStyle = 'italic';
                inheritInfo.style.color = 'var(--text-muted)';
                return; // 상속 모드에서는 나머지 설정 숨김
            }
        }

        new Setting(container)
            .setName(t().settingsTab.cardSettings.displayContent)
            .setDesc(t().settingsTab.cardSettings.displayContentDescription)
            .addDropdown(dropdown => dropdown
                .addOption('filename', t().settingsTab.cardSettings.contentType.filename)
                .addOption('file-path', t().settingsTab.cardSettings.contentType.filePath)
                .addOption('first-header', t().settingsTab.cardSettings.contentType.firstHeader)
                .addOption('content', t().settingsTab.cardSettings.contentType.content)
                .addOption('tags', t().settingsTab.cardSettings.contentType.tags)
                .addOption('created-date', t().settingsTab.cardSettings.contentType.createdDate)
                .addOption('modified-date', t().settingsTab.cardSettings.contentType.modifiedDate)
                .addOption('property', t().settingsTab.cardSettings.contentType.property)
                .addOption('backlinks', t().settingsTab.cardSettings.contentType.backlinks)
                .addOption('outgoing-links', t().settingsTab.cardSettings.contentType.outgoingLinks)
                .addOption('image-thumbnail', t().settingsTab.cardSettings.contentType.imageThumbnail)
                .setValue(sectionSettings.normalContent.contentType)
                .onChange(async (value) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    sectionSettings.normalContent.contentType = value as any;

                    // 이미지 섬네일 선택 시 기본 설정 생성
                    if (value === 'image-thumbnail' && !sectionSettings.normalContent.imageThumbnail) {
                        sectionSettings.normalContent.imageThumbnail = {
                            enabled: true,
                            size: 'medium',
                            aspectRatio: 'square',
                            fallback: 'icon',
                            allowExternalImages: false,
                            retryCount: 2,
                            clickAction: 'open-file'
                        };
                    }

                    // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingSectionContents(this.selectedSection, 'contentType', value);
                    }

                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.refreshPreviewCard();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    const defaultSettings = this.getDefaultSectionSettings();
                    sectionSettings.normalContent.contentType = defaultSettings.normalContent.contentType;

                    // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingSectionContents(this.selectedSection, 'contentType', defaultSettings.normalContent.contentType);
                    }

                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.refreshPreviewCard();
                    new Notice(t().notices.interactiveCard.displayContentReset);
                })
            );

        if (sectionSettings.normalContent.contentType === 'property') {
            const datalistId = `frontmatter-properties-${this.selectedSection}`;
            let datalist = container.querySelector(`#${datalistId}`);
            
            if (!datalist) {
                datalist = container.createEl('datalist', { attr: { id: datalistId } });
                Array.from(this.availableProperties).sort().forEach(prop => {
                    datalist!.createEl('option', { attr: { value: prop } });
                });
            }
            
            new Setting(container)
                .setName(t().settingsTab.cardSettings.propertyName)
                .setDesc(t().settingsTab.cardSettings.propertyNameDescription)
                .addText(text => {
                    const inputEl = text
                        .setPlaceholder(t().settingsTab.cardSettings.propertyNamePlaceholder)
                        .setValue(sectionSettings.normalContent.customProperty || '')
                        .onChange((value) => {
                            sectionSettings.normalContent.customProperty = value;

                            // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                            if (this.selectedState === 'normal') {
                                this.updateInheritingSectionContents(this.selectedSection, 'customProperty', value);
                            }

                            this.debouncedSave();
                            this.refreshPreviewCard();
                        })
                        .inputEl;

                    inputEl.setAttribute('list', datalistId);

                    return text;
                })
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip(t().settingsTab.cardSettings.clearPropertyName)
                    .onClick(async () => {
                        sectionSettings.normalContent.customProperty = undefined;

                        // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                        if (this.selectedState === 'normal') {
                            this.updateInheritingSectionContents(this.selectedSection, 'customProperty', undefined);
                        }

                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.refreshPreviewCard();
                        new Notice(t().notices.interactiveCard.propertyNameCleared);
                    })
                );
        }

        // 이미지 섬네일 설정
        if (sectionSettings.normalContent.contentType === 'image-thumbnail') {
            this.addImageThumbnailSettings(container, sectionSettings);
        }

        if (sectionSettings.normalContent.contentType === 'content') {
            new Setting(container)
                .setName(t().settingsTab.cardSettings.includeFirstHeader)
                .setDesc(t().settingsTab.cardSettings.includeFirstHeaderDescription)
                .addToggle(toggle => toggle
                    .setValue(sectionSettings.normalContent.includeFirstHeader || false)
                    .onChange(async (value) => {
                        sectionSettings.normalContent.includeFirstHeader = value;

                        // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                        if (this.selectedState === 'normal') {
                            this.updateInheritingSectionContents(this.selectedSection, 'includeFirstHeader', value);
                        }

                        await this.plugin.saveSettings();
                        this.refreshPreviewCard();
                    })
                )
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip(t().settingsTab.cardSettings.includeFirstHeaderReset)
                    .onClick(async () => {
                        sectionSettings.normalContent.includeFirstHeader = false;

                        // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                        if (this.selectedState === 'normal') {
                            this.updateInheritingSectionContents(this.selectedSection, 'includeFirstHeader', false);
                        }

                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.refreshPreviewCard();
                        new Notice(t().notices.interactiveCard.includeFirstHeaderReset);
                    })
                );

            new Setting(container)
                .setName(t().settingsTab.cardSettings.bodyRenderMode)
                .setDesc(t().settingsTab.cardSettings.bodyRenderModeDescription)
                .addDropdown(dropdown => dropdown
                    .addOption('plain', t().settingsTab.cardSettings.renderModeOptions.plain)
                    .addOption('plain-stripped', t().settingsTab.cardSettings.renderModeOptions.plainStripped)
                    .addOption('markdown-html', t().settingsTab.cardSettings.renderModeOptions.markdownHtml)
                    .setValue(sectionSettings.normalContent.contentRenderMode || 'plain')
                    .onChange(async (value) => {
                        sectionSettings.normalContent.contentRenderMode = value as 'plain' | 'plain-stripped' | 'markdown-html';

                        // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                        if (this.selectedState === 'normal') {
                            this.updateInheritingSectionContents(this.selectedSection, 'contentRenderMode', value);
                        }

                        await this.plugin.saveSettings();
                        this.refreshPreviewCard();
                        this.updateSectionSettings();
                    })
                )
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                    .onClick(async () => {
                        sectionSettings.normalContent.contentRenderMode = 'plain';

                        // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                        if (this.selectedState === 'normal') {
                            this.updateInheritingSectionContents(this.selectedSection, 'contentRenderMode', 'plain');
                        }

                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.refreshPreviewCard();
                        new Notice(t().notices.interactiveCard.bodyRenderModeReset);
                    })
                );
        }

        const isMarkdownHtml = sectionSettings.normalContent.contentType === 'content' && sectionSettings.normalContent.contentRenderMode === 'markdown-html';
        const maxLengthDesc = t().settingsTab.cardSettings.maxLengthDescription(isMarkdownHtml);

        new Setting(container)
            .setName(t().settingsTab.cardSettings.maxLength)
            .setDesc(maxLengthDesc)
            .addText(text => text
                .setValue(String(sectionSettings.normalContent.maxLength || 100))
                .onChange((value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        sectionSettings.normalContent.maxLength = num;

                        // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                        if (this.selectedState === 'normal') {
                            this.updateInheritingSectionContents(this.selectedSection, 'maxLength', num);
                        }

                        this.debouncedSave();
                        this.refreshPreviewCard();
                    }
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    const defaultSettings = this.getDefaultSectionSettings();
                    sectionSettings.normalContent.maxLength = defaultSettings.normalContent.maxLength;

                    // 일반 상태 변경 시 상속 중인 활성/포커스 상태도 자동 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingSectionContents(this.selectedSection, 'maxLength', defaultSettings.normalContent.maxLength);
                    }

                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.refreshPreviewCard();
                    new Notice(t().notices.interactiveCard.maxLengthReset);
                })
            );
    }

    /**
     * 섹션 스타일 설정을 추가합니다
     */
    private addSectionStyleSettings(container: HTMLElement): void {
        const style = this.getCurrentSectionStyle();

        new Setting(container).setHeading().setName(t().settingsTab.cardSettings.sectionStyleSettings(this.getSectionLabel()));

        // 활성/포커스 상태에서만 상속 토글 표시
        if (this.selectedState !== 'normal') {
            new Setting(container)
                .setName(t().settingsTab.cardSettings.inheritFromNormal)
                .setDesc(t().settingsTab.cardSettings.inheritFromNormalDescription)
                .addToggle(toggle => toggle
                    .setValue(style.inheritFromNormal || false)
                    .onChange(async (value) => {
                        style.inheritFromNormal = value;

                        // 상속 활성화 시: 일반 상태의 값을 현재 상태로 복사
                        if (value) {
                            const sectionSettings = this.plugin.settings[this.selectedSection];
                            const normalStyle = sectionSettings.normalStyle;
                            style.fontSize = normalStyle.fontSize;
                            style.backgroundColor = normalStyle.backgroundColor;
                            style.borderColor = normalStyle.borderColor;
                            style.borderWidth = normalStyle.borderWidth;
                            style.borderRadius = normalStyle.borderRadius;
                        }
                        // 상속 비활성화 시: 현재 저장된 값 유지 (사용자가 수정 가능)

                        await this.plugin.saveSettings();
                        this.updateSectionSettings(); // UI 다시 렌더링
                        this.updatePreviewStyles();
                        this.forceViewRender();
                    })
                );

            // 상속 모드일 때는 다른 설정 비활성화
            if (style.inheritFromNormal) {
                const inheritInfo = container.createDiv({ cls: 'setting-item-description' });
                inheritInfo.setText(`ℹ️ ${t().settingsTab.cardSettings.inheritingFromNormalInfo}`);
                inheritInfo.style.marginBottom = '12px';
                inheritInfo.style.fontStyle = 'italic';
                inheritInfo.style.color = 'var(--text-muted)';
                return; // 상속 모드에서는 나머지 설정 숨김
            }
        }

        new Setting(container)
            .setName(t().settingsTab.cardSettings.fontSize)
            .setDesc(t().settingsTab.cardSettings.fontSizeDescription(this.getSectionLabel()))
            .addText(text => text
                .setValue(String(style.fontSize))
                .onChange((value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        style.fontSize = num;
                        // 일반 상태일 때만 상속 중인 스타일 업데이트
                        if (this.selectedState === 'normal') {
                            this.updateInheritingSectionStyles(this.selectedSection, 'fontSize', num);
                        }
                        this.debouncedUpdatePreview();
                        this.debouncedSave();
                        this.debouncedForceViewRender();
                    }
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    const defaultStyle = this.getDefaultSectionStyle();
                    style.fontSize = defaultStyle.fontSize;
                    // 일반 상태일 때만 상속 중인 스타일 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingSectionStyles(this.selectedSection, 'fontSize', defaultStyle.fontSize);
                    }
                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice(t().notices.interactiveCard.fontSizeReset);
                })
            );

        new Setting(container)
            .setName(t().settingsTab.cardSettings.backgroundColor)
            .setDesc(t().settingsTab.cardSettings.backgroundColorDescription(this.getSectionLabel()))
            .addColorPicker(color => color
                .setValue(this.extractColorValue(style.backgroundColor))
                .onChange(async (value) => {
                    style.backgroundColor = value;
                    // 일반 상태일 때만 상속 중인 스타일 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingSectionStyles(this.selectedSection, 'backgroundColor', value);
                    }
                    await this.plugin.saveSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                .onClick(async () => {
                    const defaultStyle = this.getDefaultSectionStyle();
                    style.backgroundColor = defaultStyle.backgroundColor;
                    // 일반 상태일 때만 상속 중인 스타일 업데이트
                    if (this.selectedState === 'normal') {
                        this.updateInheritingSectionStyles(this.selectedSection, 'backgroundColor', defaultStyle.backgroundColor);
                    }
                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice(t().notices.interactiveCard.backgroundColorReset);
                })
            );

        if (this.selectedSection === 'header') {
            new Setting(container)
                .setName(t().settingsTab.cardSettings.headerBottomBorderColor)
                .setDesc(t().settingsTab.cardSettings.headerBottomBorderColorDescription)
                .addColorPicker(color => color
                    .setValue(this.extractColorValue(style.borderColor))
                    .onChange(async (value) => {
                        style.borderColor = value;
                        await this.plugin.saveSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                    })
                )
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                    .onClick(async () => {
                        const defaultStyle = this.getDefaultSectionStyle();
                        style.borderColor = defaultStyle.borderColor;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                        new Notice(t().notices.interactiveCard.borderColorReset);
                    })
                );

            new Setting(container)
                .setName(t().settingsTab.cardSettings.headerBottomBorderThickness)
                .setDesc(t().settingsTab.cardSettings.headerBottomBorderThicknessDescription)
                .addText(text => text
                    .setValue(String(style.borderWidth))
                    .onChange((value) => {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 0) {
                            style.borderWidth = num;
                            this.debouncedUpdatePreview();
                            this.debouncedSave();
                            this.debouncedForceViewRender();
                        }
                    })
                )
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                    .onClick(async () => {
                        const defaultStyle = this.getDefaultSectionStyle();
                        style.borderWidth = defaultStyle.borderWidth;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                        new Notice(t().notices.interactiveCard.borderThicknessReset);
                    })
                );
        } else if (this.selectedSection === 'footer') {
            new Setting(container)
                .setName(t().settingsTab.cardSettings.footerTopBorderColor)
                .setDesc(t().settingsTab.cardSettings.footerTopBorderColorDescription)
                .addColorPicker(color => color
                    .setValue(this.extractColorValue(style.borderColor))
                    .onChange(async (value) => {
                        style.borderColor = value;
                        await this.plugin.saveSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                    })
                )
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                    .onClick(async () => {
                        const defaultStyle = this.getDefaultSectionStyle();
                        style.borderColor = defaultStyle.borderColor;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                        new Notice(t().notices.interactiveCard.borderColorReset);
                    })
                );

            new Setting(container)
                .setName(t().settingsTab.cardSettings.footerTopBorderThickness)
                .setDesc(t().settingsTab.cardSettings.footerTopBorderThicknessDescription)
                .addText(text => text
                    .setValue(String(style.borderWidth))
                    .onChange((value) => {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 0) {
                            style.borderWidth = num;
                            this.debouncedUpdatePreview();
                            this.debouncedSave();
                            this.debouncedForceViewRender();
                        }
                    })
                )
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip(t().settingsTab.cardSettings.resetToDefault)
                    .onClick(async () => {
                        const defaultStyle = this.getDefaultSectionStyle();
                        style.borderWidth = defaultStyle.borderWidth;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                        new Notice(t().notices.interactiveCard.borderThicknessReset);
                    })
                );
        }
    }
    
    /**
     * 현재 선택된 섹션의 현재 상태 스타일을 반환합니다
     */
    private getCurrentSectionStyle(): CardSectionStyleSettings {
        const sectionSettings = this.plugin.settings[this.selectedSection];
        switch (this.selectedState) {
            case 'active':
                return sectionSettings.activeStyle;
            case 'focused':
                return sectionSettings.focusedStyle;
            default:
                return sectionSettings.normalStyle;
        }
    }

    /**
     * 현재 선택된 섹션의 현재 상태 내용 설정을 반환합니다
     */
    private getCurrentSectionContent(): CardSectionContentSettings {
        const sectionSettings = this.plugin.settings[this.selectedSection];
        switch (this.selectedState) {
            case 'active':
                return sectionSettings.activeContent;
            case 'focused':
                return sectionSettings.focusedContent;
            default:
                return sectionSettings.normalContent;
        }
    }

    /**
     * 미리 보기 카드를 새로고침합니다
     */
    private refreshPreviewCard(): void {
        if (!this.previewCard) return;
        
        const parent = this.previewCard.parentElement;
        if (!parent) return;
        
        this.previewCard.remove();
        
        this.previewCard = this.createPreviewCard(parent);
        this.bindSectionClickEvents();
    }

    /**
     * 섹션 라벨을 반환합니다
     */
    private getSectionLabel(): string {
        return t().settingsTab.cardSettings.sectionLabel[this.selectedSection];
    }

    /**
     * 상태 라벨을 반환합니다
     */
    private getStateLabel(): string {
        return t().settingsTab.cardSettings.stateLabel[this.selectedState];
    }

    /**
     * 모바일 기기를 감지합니다
     */
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        ) || window.innerWidth < 768;
    }
    
    /**
     * 터치 이벤트를 바인딩합니다
     * 
     * @remarks
     * 모바일 기기에서 더 나은 사용자 경험을 위한 터치 피드백 추가
     */
    private bindTouchEvents(): void {
        if (!this.previewCard) return;
        
        const sections = this.previewCard.querySelectorAll('.card-section');
        
        sections.forEach(section => {
            const sectionEl = section as HTMLElement;
            
            sectionEl.addEventListener('touchstart', (e: TouchEvent) => {
                sectionEl.style.opacity = '0.8';
            }, { signal: this.abortController?.signal, passive: true });
            
            sectionEl.addEventListener('touchend', (e: TouchEvent) => {
                sectionEl.style.opacity = '';
                
                const sectionType = sectionEl.dataset.section as 'header' | 'body' | 'footer';
                if (sectionType) {
                    this.selectSection(sectionType);
                }
            }, { signal: this.abortController?.signal });
            
            sectionEl.addEventListener('touchcancel', () => {
                sectionEl.style.opacity = '';
            }, { signal: this.abortController?.signal, passive: true });
        });
    }
    
    /**
     * 색상 값을 HEX 형식으로 추출합니다
     *
     * @remarks
     * RGB/RGBA 형식을 HEX로 변환하여 color picker와 호환되도록 합니다.
     */
    private extractColorValue(color: string): string {
        // CSS 변수인 경우 기본값 반환
        if (color.startsWith('var(')) {
            const match = color.match(/var\([^,]+,\s*([^)]+)\)/);
            if (match && match[1]) {
                return this.extractColorValue(match[1].trim());
            }
            return '#000000';
        }

        if (color.startsWith('#')) {
            return color;
        }

        const rgb = color.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            const hex = '#' + rgb.slice(0, 3)
                .map(x => parseInt(x).toString(16).padStart(2, '0'))
                .join('');
            return hex;
        }

        return '#000000';
    }
    
    /**
     * 현재 상태에 해당하는 기본 카드 스타일을 반환합니다
     */
    private getDefaultCardStyle(): CardStyleSettings {
        switch (this.selectedState) {
            case 'active':
                return DEFAULT_SETTINGS.activeCardStyle;
            case 'focused':
                return DEFAULT_SETTINGS.focusedCardStyle;
            default:
                return DEFAULT_SETTINGS.normalCardStyle;
        }
    }
    
    /**
     * 현재 선택된 섹션의 기본 설정을 반환합니다
     */
    private getDefaultSectionSettings(): CardSectionSettings {
        return DEFAULT_SETTINGS[this.selectedSection];
    }
    
    /**
     * 현재 선택된 섹션의 현재 상태에 해당하는 기본 스타일을 반환합니다
     */
    private getDefaultSectionStyle(): CardSectionStyleSettings {
        const defaultSection = this.getDefaultSectionSettings();
        switch (this.selectedState) {
            case 'active':
                return defaultSection.activeStyle;
            case 'focused':
                return defaultSection.focusedStyle;
            default:
                return defaultSection.normalStyle;
        }
    }

    /**
     * 이미지 섬네일 설정 UI를 추가합니다
     */
    private addImageThumbnailSettings(
        container: HTMLElement,
        sectionSettings: import('../../types').CardSectionSettings
    ): void {
        if (!sectionSettings.normalContent.imageThumbnail) {
            sectionSettings.normalContent.imageThumbnail = {
                enabled: true,
                size: 'medium',
                aspectRatio: 'square',
                fallback: 'icon',
                allowExternalImages: false,
                retryCount: 2,
                clickAction: 'open-file'
            };
        }

        const imgSettings = sectionSettings.normalContent.imageThumbnail;

        // 활성화 토글
        new Setting(container)
            .setName(t().settingsTab.cardSettings.imageThumbnail.enabled)
            .setDesc(t().settingsTab.cardSettings.imageThumbnail.enabledDescription)
            .addToggle(toggle => toggle
                .setValue(imgSettings.enabled)
                .onChange(async (value) => {
                    imgSettings.enabled = value;
                    await this.plugin.saveSettings();
                    this.refreshPreviewCard();
                })
            );

        // 크기 설정
        new Setting(container)
            .setName(t().settingsTab.cardSettings.imageThumbnail.size)
            .setDesc(t().settingsTab.cardSettings.imageThumbnail.sizeDescription)
            .addDropdown(dropdown => dropdown
                .addOption('small', t().settingsTab.cardSettings.imageThumbnail.sizeSmall)
                .addOption('medium', t().settingsTab.cardSettings.imageThumbnail.sizeMedium)
                .addOption('large', t().settingsTab.cardSettings.imageThumbnail.sizeLarge)
                .setValue(imgSettings.size)
                .onChange(async (value) => {
                    imgSettings.size = value as import('../../types').ThumbnailSize;
                    await this.plugin.saveSettings();
                    this.refreshPreviewCard();
                })
            );

        // 종횡비 설정
        new Setting(container)
            .setName(t().settingsTab.cardSettings.imageThumbnail.aspectRatio)
            .setDesc(t().settingsTab.cardSettings.imageThumbnail.aspectRatioDescription)
            .addDropdown(dropdown => dropdown
                .addOption('square', t().settingsTab.cardSettings.imageThumbnail.aspectRatioSquare)
                .addOption('original', t().settingsTab.cardSettings.imageThumbnail.aspectRatioOriginal)
                .addOption('16:9', t().settingsTab.cardSettings.imageThumbnail.aspectRatio16_9)
                .addOption('4:3', t().settingsTab.cardSettings.imageThumbnail.aspectRatio4_3)
                .setValue(imgSettings.aspectRatio)
                .onChange(async (value) => {
                    imgSettings.aspectRatio = value as import('../../types').ThumbnailAspectRatio;
                    await this.plugin.saveSettings();
                    this.refreshPreviewCard();
                })
            );

        // 폴백 옵션
        new Setting(container)
            .setName(t().settingsTab.cardSettings.imageThumbnail.fallback)
            .setDesc(t().settingsTab.cardSettings.imageThumbnail.fallbackDescription)
            .addDropdown(dropdown => dropdown
                .addOption('none', t().settingsTab.cardSettings.imageThumbnail.fallbackNone)
                .addOption('icon', t().settingsTab.cardSettings.imageThumbnail.fallbackIcon)
                .addOption('folder-color', t().settingsTab.cardSettings.imageThumbnail.fallbackFolderColor)
                .addOption('tag-color', t().settingsTab.cardSettings.imageThumbnail.fallbackTagColor)
                .addOption('first-emoji', t().settingsTab.cardSettings.imageThumbnail.fallbackEmoji)
                .setValue(imgSettings.fallback)
                .onChange(async (value) => {
                    imgSettings.fallback = value as import('../../types').ThumbnailFallback;
                    await this.plugin.saveSettings();
                    this.refreshPreviewCard();
                })
            );

        // 외부 이미지 허용
        new Setting(container)
            .setName(t().settingsTab.cardSettings.imageThumbnail.allowExternal)
            .setDesc(t().settingsTab.cardSettings.imageThumbnail.allowExternalDescription)
            .addToggle(toggle => toggle
                .setValue(imgSettings.allowExternalImages)
                .onChange(async (value) => {
                    imgSettings.allowExternalImages = value;
                    await this.plugin.saveSettings();
                    this.refreshPreviewCard();
                })
            );

        // 재시도 횟수
        new Setting(container)
            .setName(t().settingsTab.cardSettings.imageThumbnail.retryCount)
            .setDesc(t().settingsTab.cardSettings.imageThumbnail.retryCountDescription)
            .addText(text => text
                .setValue(String(imgSettings.retryCount))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 0) {
                        imgSettings.retryCount = num;
                        await this.plugin.saveSettings();
                        this.refreshPreviewCard();
                    }
                })
            );

        // 클릭 동작
        new Setting(container)
            .setName(t().settingsTab.cardSettings.imageThumbnail.clickAction)
            .setDesc(t().settingsTab.cardSettings.imageThumbnail.clickActionDescription)
            .addDropdown(dropdown => dropdown
                .addOption('open-file', t().settingsTab.cardSettings.imageThumbnail.clickOpenFile)
                .addOption('open-image', t().settingsTab.cardSettings.imageThumbnail.clickOpenImage)
                .addOption('none', t().settingsTab.cardSettings.imageThumbnail.clickNone)
                .setValue(imgSettings.clickAction)
                .onChange(async (value) => {
                    imgSettings.clickAction = value as 'open-file' | 'open-image' | 'none';
                    await this.plugin.saveSettings();
                    this.refreshPreviewCard();
                })
            );
    }
}

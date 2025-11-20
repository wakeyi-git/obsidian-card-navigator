import { Setting, Notice, setIcon } from 'obsidian';
import CardNavigatorPlugin from '../../main';
import { BaseSettings } from './BaseSettings';
import { CardSectionSettings, CardStyleSettings, CardSectionStyleSettings, DEFAULT_SETTINGS } from '../../types';
import { debounce } from '../../utils/debounce';
import { DebugLogger } from '../../utils/DebugLogger';

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
export class InteractiveCardSettings extends BaseSettings {
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
    
    constructor(plugin: CardNavigatorPlugin) {
        super(plugin);
        
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
        
        this.logger.debug('Settings', '프론트매터 속성 수집 완료', {
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
        
        this.logger.debug('Settings', '현재 파일 속성 로드', {
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
                (view as any).refresh();
            }
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
        
        this.plugin.app.workspace.on('active-leaf-change', () => {
            this.loadCurrentFileProperties();
            if (this.previewCard && this.plugin.settings[this.selectedSection].contentType === 'property') {
                this.refreshPreviewCard();
            }
        });
        
        this.renderPreviewSection(container);
        this.renderCardBaseSettings(container);
        this.renderSectionSettings(container);
    }

    /**
     * 카드 기본 설정을 렌더링합니다
     */
    private renderCardBaseSettings(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'card-base-settings'});
        
        section.createEl('h3', { text: '카드 기본 설정' });
        
        const descEl = section.createDiv({ cls: 'setting-item-description'});
        descEl.setText('모든 카드에 공통으로 적용되는 스타일을 설정합니다. 각 섹션(헤더/바디/풋터)의 배경색은 해당 섹션 설정에서 변경할 수 있습니다.');
        descEl.style.marginBottom = '12px';
        descEl.style.fontSize = '0.9em';
        descEl.style.color = 'var(--text-muted)';
        
        const currentStateLabel = section.createDiv({ cls: 'current-state-label'});
        currentStateLabel.setText(`현재: ${this.getStateLabel()}`);
        
        this.cardBaseSettingsContent = section.createDiv({ cls: 'card-base-settings-content'});
        this.updateCardBaseSettings();
    }
    
    /**
     * 카드 기본 설정을 업데이트합니다
     */
    private updateCardBaseSettings(): void {
        if (!this.cardBaseSettingsContent) return;
        
        this.cardBaseSettingsContent.empty();
        
        const settings = this.plugin.settings;
        const style = this.getCurrentCardStyle();
        
        new Setting(this.cardBaseSettingsContent)
            .setName('테두리 색')
            .setDesc('카드 전체의 외곽 테두리 색상입니다')
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
                .setTooltip('기본값으로 복구')
                .onClick(async () => {
                    const defaultStyle = this.getDefaultCardStyle();
                    style.borderColor = defaultStyle.borderColor;
                    await this.plugin.saveSettings();
                    this.updateCardBaseSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice('테두리 색을 기본값으로 복구했습니다');
                })
            );
        
        new Setting(this.cardBaseSettingsContent)
            .setName('테두리 두께')
            .setDesc('카드 외곽 테두리의 두께입니다 (px). 0으로 설정하면 테두리가 표시되지 않습니다')
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
                .setTooltip('기본값으로 복구')
                .onClick(async () => {
                    const defaultStyle = this.getDefaultCardStyle();
                    style.borderWidth = defaultStyle.borderWidth;
                    await this.plugin.saveSettings();
                    this.updateCardBaseSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice('테두리 두께를 기본값으로 복구했습니다');
                })
            );
        
        new Setting(this.cardBaseSettingsContent)
            .setName('테두리 둥글기')
            .setDesc('카드 모서리의 둥근 정도입니다 (px). 값이 클수록 더 둥글게 표시됩니다')
            .addText(text => text
                .setValue(String(style.borderRadius))
                .onChange((value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 0) {
                        style.borderRadius = num;
                        this.debouncedUpdatePreview();
                        this.debouncedSave();
                        this.debouncedForceViewRender();
                    }
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('기본값으로 복구')
                .onClick(async () => {
                    const defaultStyle = this.getDefaultCardStyle();
                    style.borderRadius = defaultStyle.borderRadius;
                    await this.plugin.saveSettings();
                    this.updateCardBaseSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice('테두리 둥글기를 기본값으로 복구했습니다');
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
        hint.createSpan({ cls: ''}).setText('섹션을 클릭하여 설정을 변경하세요');
        
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
            { key: 'normal' as const, label: '일반' },
            { key: 'active' as const, label: '활성' },
            { key: 'focused' as const, label: '포커스' }
        ];

        states.forEach((state, index) => {
            const button = container.createEl('button', {
                text: state.label,
                cls: state.key === this.selectedState ? 'active' : ''
            });
            
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', (state.key === this.selectedState).toString());
            button.setAttribute('aria-label', `${state.label} 카드 상태`);
            
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
            stateLabel.textContent = `현재: ${this.getStateLabel()}`;
        }
        
        this.updateSectionSettings();
    }

    /**
     * 미리 보기 카드를 생성합니다
     */
    private createPreviewCard(container: HTMLElement): HTMLElement {
        const card = container.createDiv({ cls: 'preview-card'});
        card.dataset.state = this.selectedState;
        
        const settings = this.plugin.settings;
        
        if (settings.header.enabled) {
            const headerSection = card.createDiv({ cls: 'card-section card-header'});
            headerSection.dataset.section = 'header';
            if (this.selectedSection === 'header') {
                headerSection.addClass('selected');
            }
            
            headerSection.createEl('span', {
                cls: 'section-label',
                text: '헤더'
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
        
        if (settings.body.enabled) {
            const bodySection = card.createDiv({ cls: 'card-section card-body'});
            bodySection.dataset.section = 'body';
            if (this.selectedSection === 'body') {
                bodySection.addClass('selected');
            }
            
            bodySection.createEl('span', {
                cls: 'section-label',
                text: '바디'
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
        
        if (settings.footer.enabled) {
            const footerSection = card.createDiv({ cls: 'card-section card-footer'});
            footerSection.dataset.section = 'footer';
            if (this.selectedSection === 'footer') {
                footerSection.addClass('selected');
            }
            
            footerSection.createEl('span', {
                cls: 'section-label',
                text: '풋터'
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
        
        this.updatePreviewStyles();
        
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
        
        switch (settings.contentType) {
            case 'filename':
                return '샘플파일.md';
            case 'file-path':
                return 'folder/subfolder/샘플파일.md';
            case 'first-header':
                return '# 첫 번째 헤더';
            case 'content':
                return '본문 내용이 여기에 표시됩니다. 마크다운 문법이 적용될 수 있습니다.';
            case 'tags':
                return '#태그1 #태그2 #태그3';
            case 'created-date':
                return '생성: 2024-11-16';
            case 'modified-date':
                return '수정: 2024-11-16';
            case 'property':
                if (settings.customProperty) {
                    const realValue = this.currentFileProperties.get(settings.customProperty);
                    if (realValue) {
                        return `${settings.customProperty}: ${realValue}`;
                    } else {
                        return `${settings.customProperty}: (속성 없음)`;
                    }
                }
                return '속성: 값';
            case 'backlinks':
                return '<span class="internal-link" data-file-path="note1.md" style="cursor: pointer; color: var(--link-color);">노트1</span>, <span class="internal-link" data-file-path="note2.md" style="cursor: pointer; color: var(--link-color);">노트2</span>';
            case 'outgoing-links':
                return '<span class="internal-link" data-file-path="reference1.md" style="cursor: pointer; color: var(--link-color);">참조문1</span>, <span class="internal-link" data-file-path="reference2.md" style="cursor: pointer; color: var(--link-color);">참조문2</span>';
            default:
                return '샘플 텍스트';
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
            sectionEl.setAttribute('aria-label', `${this.getSectionLabelByIndex(index)} 영역 선택`);
            
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
        const labels = ['헤더', '바디', '풋터'];
        return labels[index] || '영역';
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
     * 미리 보기 스타일을 업데이트합니다
     * 
     * @remarks
     * requestAnimationFrame으로 브라우저 최적화를 활용하고
     * 배치 스타일 업데이트로 리플로우를 최소화합니다.
     */
    private updatePreviewStyles(): void {
        if (!this.previewCard) return;
        
        requestAnimationFrame(() => {
            if (!this.previewCard) return;
            
            const settings = this.plugin.settings;
            const style = this.getCurrentStyle();
            
            this.applyCardStyles(this.previewCard, style);
            this.applySectionStyles(style);
        });
    }
    
    /**
     * 현재 상태에 해당하는 스타일을 반환합니다
     */
    private getCurrentStyle(): CardStyleSettings {
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
     * 카드 전체 스타일을 한번에 적용합니다
     * 
     * @remarks
     * 모든 스타일을 Object.assign으로 한 번에 적용하여 리플로우를 최소화합니다.
     */
    private applyCardStyles(card: HTMLElement, style: CardStyleSettings): void {
        Object.assign(card.style, {
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            borderWidth: `${style.borderWidth}px`,
            borderRadius: `${style.borderRadius}px`,
            borderStyle: 'solid',
            fontSize: `${style.fontSize}px`
        });
    }
    
    /**
     * 섹션별 스타일을 적용합니다
     * 
     * @remarks
     * 헤더는 아래 테두리만, 풋터는 위 테두리만, 바디는 테두리 없음
     */
    private applySectionStyles(cardStyle: CardStyleSettings): void {
        if (!this.previewCard) return;
        
        const settings = this.plugin.settings;
        
        const sections = {
            header: this.previewCard.querySelector('.card-header') as HTMLElement,
            body: this.previewCard.querySelector('.card-body') as HTMLElement,
            footer: this.previewCard.querySelector('.card-footer') as HTMLElement
        };
        
        if (sections.header) {
            const headerStyle = settings.header[`${this.selectedState}Style`] as CardSectionStyleSettings;
            Object.assign(sections.header.style, {
                fontSize: `${headerStyle.fontSize}px`,
                backgroundColor: headerStyle.backgroundColor,
                borderBottomColor: headerStyle.borderColor,
                borderBottomWidth: `${headerStyle.borderWidth}px`,
                borderBottomStyle: headerStyle.borderWidth > 0 ? 'solid' : 'none',
                borderTopStyle: 'none',
                borderLeftStyle: 'none',
                borderRightStyle: 'none'
            });
        }
        
        if (sections.body) {
            const bodyStyle = settings.body[`${this.selectedState}Style`] as CardSectionStyleSettings;
            Object.assign(sections.body.style, {
                fontSize: `${bodyStyle.fontSize}px`,
                backgroundColor: bodyStyle.backgroundColor,
                borderStyle: 'none'
            });
        }
        
        if (sections.footer) {
            const footerStyle = settings.footer[`${this.selectedState}Style`] as CardSectionStyleSettings;
            Object.assign(sections.footer.style, {
                fontSize: `${footerStyle.fontSize}px`,
                backgroundColor: footerStyle.backgroundColor,
                borderTopColor: footerStyle.borderColor,
                borderTopWidth: `${footerStyle.borderWidth}px`,
                borderTopStyle: footerStyle.borderWidth > 0 ? 'solid' : 'none',
                borderBottomStyle: 'none',
                borderLeftStyle: 'none',
                borderRightStyle: 'none'
            });
        }
    }

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
        
        new Setting(container).setHeading().setName(`${this.getSectionLabel()} 내용 설정`);
        
        new Setting(container)
            .setName(`${this.getSectionLabel()} 표시`)
            .setDesc(`카드에 ${this.getSectionLabel()} 영역을 표시할지 결정합니다`)
            .addToggle(toggle => toggle
                .setValue(sectionSettings.enabled)
                .onChange(async (value) => {
                    sectionSettings.enabled = value;
                    await this.plugin.saveSettings();
                    this.refreshPreviewCard();
                })
            );
        
        new Setting(container)
            .setName('표시 내용')
            .setDesc('이 영역에 표시할 정보를 선택합니다. 선택한 내용에 따라 각 파일에서 해당 정보를 추출하여 표시합니다')
            .addDropdown(dropdown => dropdown
                .addOption('filename', '파일명')
                .addOption('file-path', '파일 경로')
                .addOption('first-header', '첫 번째 헤더')
                .addOption('content', '본문 내용')
                .addOption('tags', '태그')
                .addOption('created-date', '생성일')
                .addOption('modified-date', '수정일')
                .addOption('property', '프론트매터 속성')
                .addOption('backlinks', '백링크 (이 파일을 링크하는 파일들)')
                .addOption('outgoing-links', '나가는 링크 (이 파일에서 링크하는 파일들)')
                .setValue(sectionSettings.contentType)
                .onChange(async (value) => {
                    sectionSettings.contentType = value as any;
                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.refreshPreviewCard();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('기본값으로 복구')
                .onClick(async () => {
                    const defaultSettings = this.getDefaultSectionSettings();
                    sectionSettings.contentType = defaultSettings.contentType;
                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.refreshPreviewCard();
                    new Notice('표시 내용을 기본값으로 복구했습니다');
                })
            );
        
        if (sectionSettings.contentType === 'property') {
            const datalistId = `frontmatter-properties-${this.selectedSection}`;
            let datalist = container.querySelector(`#${datalistId}`);
            
            if (!datalist) {
                datalist = container.createEl('datalist', { attr: { id: datalistId } });
                Array.from(this.availableProperties).sort().forEach(prop => {
                    datalist!.createEl('option', { attr: { value: prop } });
                });
            }
            
            new Setting(container)
                .setName('프론트매터 속성명')
                .setDesc('표시하고자 하는 프론트매터 속성의 이름을 입력하세요. 자동완성에서 선택하거나 직접 입력할 수 있습니다.')
                .addText(text => {
                    const inputEl = text
                        .setPlaceholder('예: author, status, priority')
                        .setValue(sectionSettings.customProperty || '')
                        .onChange((value) => {
                            sectionSettings.customProperty = value;
                            this.debouncedSave();
                            this.refreshPreviewCard();
                        })
                        .inputEl;
                    
                    inputEl.setAttribute('list', datalistId);
                    
                    return text;
                })
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip('속성명 지우기')
                    .onClick(async () => {
                        sectionSettings.customProperty = undefined;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.refreshPreviewCard();
                        new Notice('속성명을 지웠습니다');
                    })
                );
        }
        
        if (sectionSettings.contentType === 'content') {
            new Setting(container)
                .setName('첫 번째 헤더 포함')
                .setDesc('본문 내용 표시 시 맨 앞에 있는 첫 번째 헤더를 포함할지 결정합니다. 비활성화하면 첫 헤더는 제목으로 간주되어 제외됩니다')
                .addToggle(toggle => toggle
                    .setValue(sectionSettings.includeFirstHeader || false)
                    .onChange(async (value) => {
                        sectionSettings.includeFirstHeader = value;
                        await this.plugin.saveSettings();
                        this.refreshPreviewCard();
                    })
                )
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip('기본값으로 복구 (비활성화)')
                    .onClick(async () => {
                        sectionSettings.includeFirstHeader = false;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.refreshPreviewCard();
                        new Notice('첫 번째 헤더 포함을 기본값으로 복구했습니다');
                    })
                );

            new Setting(container)
                .setName('본문 렌더링 모드')
                .setDesc('본문 내용을 표시하는 방식을 선택합니다. "Markdown HTML" 모드에서는 최대 길이 제한이 적용되지 않습니다')
                .addDropdown(dropdown => dropdown
                    .addOption('plain', 'Plain Text (마크다운 문법 그대로)')
                    .addOption('markdown-html', 'Markdown HTML (읽기 뷰 스타일)')
                    .setValue(sectionSettings.contentRenderMode || 'plain')
                    .onChange(async (value) => {
                        sectionSettings.contentRenderMode = value as 'plain' | 'markdown-html';
                        await this.plugin.saveSettings();
                        this.refreshPreviewCard();
                        this.updateSectionSettings();
                    })
                )
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip('기본값으로 복구')
                    .onClick(async () => {
                        sectionSettings.contentRenderMode = 'plain';
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.refreshPreviewCard();
                        new Notice('본문 렌더링 모드를 기본값으로 복구했습니다');
                    })
                );
        }
        
        const maxLengthDesc = sectionSettings.contentType === 'content' && sectionSettings.contentRenderMode === 'markdown-html'
            ? '표시할 최대 글자 수입니다. ⚠️ 현재 Markdown HTML 렌더링 모드로 설정되어 있어 이 설정이 적용되지 않습니다 (HTML 태그가 잘리는 것을 방지)'
            : '표시할 최대 글자 수입니다. 내용이 이보다 길면 자동으로 잘리고 "..."이 추가됩니다';
        
        new Setting(container)
            .setName('최대 길이')
            .setDesc(maxLengthDesc)
            .addText(text => text
                .setValue(String(sectionSettings.maxLength || 100))
                .onChange((value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        sectionSettings.maxLength = num;
                        this.debouncedSave();
                        this.refreshPreviewCard();
                    }
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('기본값으로 복구')
                .onClick(async () => {
                    const defaultSettings = this.getDefaultSectionSettings();
                    sectionSettings.maxLength = defaultSettings.maxLength;
                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.refreshPreviewCard();
                    new Notice('최대 길이를 기본값으로 복구했습니다');
                })
            );
    }

    /**
     * 섹션 스타일 설정을 추가합니다
     */
    private addSectionStyleSettings(container: HTMLElement): void {
        const sectionSettings = this.plugin.settings[this.selectedSection];
        const style = this.getCurrentSectionStyle();
        
        new Setting(container).setHeading().setName(`${this.getSectionLabel()} 스타일 설정`);
        
        new Setting(container)
            .setName('폰트 크기')
            .setDesc(`${this.getSectionLabel()} 영역의 텍스트 크기입니다 (px). 기본값은 일반적으로 14px입니다`)
            .addText(text => text
                .setValue(String(style.fontSize))
                .onChange((value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        style.fontSize = num;
                        this.debouncedUpdatePreview();
                        this.debouncedSave();
                        this.debouncedForceViewRender();
                    }
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('기본값으로 복구')
                .onClick(async () => {
                    const defaultStyle = this.getDefaultSectionStyle();
                    style.fontSize = defaultStyle.fontSize;
                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice('폰트 크기를 기본값으로 복구했습니다');
                })
            );
        
        new Setting(container)
            .setName('배경색')
            .setDesc(`${this.getSectionLabel()} 영역의 배경 색상입니다. 카드 전체 배경과 다른 색을 지정하여 영역을 구분할 수 있습니다`)
            .addColorPicker(color => color
                .setValue(this.extractColorValue(style.backgroundColor))
                .onChange(async (value) => {
                    style.backgroundColor = value;
                    await this.plugin.saveSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('기본값으로 복구')
                .onClick(async () => {
                    const defaultStyle = this.getDefaultSectionStyle();
                    style.backgroundColor = defaultStyle.backgroundColor;
                    await this.plugin.saveSettings();
                    this.updateSectionSettings();
                    this.updatePreviewStyles();
                    this.forceViewRender();
                    new Notice('배경색을 기본값으로 복구했습니다');
                })
            );
        
        if (this.selectedSection === 'header') {
            new Setting(container)
                .setName('아래 테두리 색')
                .setDesc('헤더와 바디를 구분하는 테두리의 색상입니다')
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
                    .setTooltip('기본값으로 복구')
                    .onClick(async () => {
                        const defaultStyle = this.getDefaultSectionStyle();
                        style.borderColor = defaultStyle.borderColor;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                        new Notice('테두리 색을 기본값으로 복구했습니다');
                    })
                );
            
            new Setting(container)
                .setName('아래 테두리 두께')
                .setDesc('헤더 아래 테두리의 두께입니다 (px). 0으로 설정하면 테두리가 표시되지 않습니다')
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
                    .setTooltip('기본값으로 복구')
                    .onClick(async () => {
                        const defaultStyle = this.getDefaultSectionStyle();
                        style.borderWidth = defaultStyle.borderWidth;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                        new Notice('테두리 두께를 기본값으로 복구했습니다');
                    })
                );
        } else if (this.selectedSection === 'footer') {
            new Setting(container)
                .setName('위 테두리 색')
                .setDesc('바디와 풋터를 구분하는 테두리의 색상입니다')
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
                    .setTooltip('기본값으로 복구')
                    .onClick(async () => {
                        const defaultStyle = this.getDefaultSectionStyle();
                        style.borderColor = defaultStyle.borderColor;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                        new Notice('테두리 색을 기본값으로 복구했습니다');
                    })
                );
            
            new Setting(container)
                .setName('위 테두리 두께')
                .setDesc('풋터 위 테두리의 두께입니다 (px). 0으로 설정하면 테두리가 표시되지 않습니다')
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
                    .setTooltip('기본값으로 복구')
                    .onClick(async () => {
                        const defaultStyle = this.getDefaultSectionStyle();
                        style.borderWidth = defaultStyle.borderWidth;
                        await this.plugin.saveSettings();
                        this.updateSectionSettings();
                        this.updatePreviewStyles();
                        this.forceViewRender();
                        new Notice('테두리 두께를 기본값으로 복구했습니다');
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
        switch (this.selectedSection) {
            case 'header': return '헤더';
            case 'body': return '바디';
            case 'footer': return '풋터';
        }
    }

    /**
     * 상태 라벨을 반환합니다
     */
    private getStateLabel(): string {
        switch (this.selectedState) {
            case 'normal': return '일반 카드';
            case 'active': return '활성 카드';
            case 'focused': return '포커스 카드';
        }
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
    protected extractColorValue(color: string): string {
        if (color.startsWith('var(')) {
            return super.extractColorValue(color);
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
}

import { App, Component, MarkdownRenderer } from 'obsidian';
import { CardData, CardSection, RenderMode, CardNavigatorSettings } from '../types';
import { DebugLogger } from '../utils/DebugLogger';
import { t } from '../i18n';

/**
 * 카드 데이터를 HTML 요소로 렌더링합니다
 * 
 * 헤더, 바디, 풋터를 독립적으로 렌더링하며
 * 일반 텍스트와 마크다운 두 가지 렌더링 모드를 지원합니다.
 * 
 * @remarks
 * 렌더링 모드:
 * - plain: 일반 텍스트로 표시
 * - markdown-html: 마크다운 완전 렌더링 (Obsidian 읽기 뷰와 동일)
 */
export class CardRenderer {
    private app: App;
    private component: Component;
    private renderMode: RenderMode;
    private logger: DebugLogger;
    private settings: CardNavigatorSettings;
    private view: any; // CardNavigatorView 타입 (circular dependency 회피)

    /**
     * CardRenderer를 생성합니다
     * 
     * @param app - Obsidian App 객체
     * @param component - 마크다운 렌더링에 사용할 Component (또는 view 인스턴스)
     * @param renderMode - 렌더링 모드 (기본값: 'plain')
     * @param settings - 플러그인 설정
     * 
     * @remarks
     * component는 view 인스턴스로도 사용되어 태그 클릭 처리에 활용됩니다.
     */
    constructor(app: App, component: Component, renderMode: RenderMode = 'plain', getSettings: () => CardNavigatorSettings) {
        this.app = app;
        this.component = component;
        this.view = component;
        this.renderMode = renderMode;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.settings = getSettings();
        this.logger = new DebugLogger(getSettings);
    }

    /**
     * 렌더링 모드를 변경합니다
     * 
     * @param mode - 새로운 렌더링 모드
     */
    setRenderMode(mode: RenderMode): void {
        this.renderMode = mode;
    }

    /**
     * 카드 전체를 렌더링합니다
     * 
     * @param data - 카드 데이터 (cardSettings 포함)
     * @param container - 카드를 추가할 컨테이너
     * @param isActive - 활성 카드 여부 (기본값: false)
     * @returns 생성된 카드 요소
     * 
     * @remarks
     * 각 섹션(헤더/바디/풋터)의 상태별 스타일을 개별적으로 적용합니다.
     * normalStyle, activeStyle을 카드 상태에 따라 선택하여 적용합니다.
     */
    async renderCard(data: CardData, container: HTMLElement, isActive: boolean = false): Promise<HTMLElement> {
        const cardEl = container.createEl('div', {
            cls: 'card-item'
        });
        
        cardEl.setAttribute('data-path', data.file.path);
        cardEl.setAttribute('tabindex', '-1');

        const headerRenderMode = data.cardSettings.header.contentRenderMode || data.cardSettings.renderMode;
        const bodyRenderMode = data.cardSettings.body.contentRenderMode || data.cardSettings.renderMode;
        const footerRenderMode = data.cardSettings.footer.contentRenderMode || data.cardSettings.renderMode;

        if (data.header.visible) {
            const headerEl = await this.renderSection(data.header, 'card-header', data.file.path, headerRenderMode);
            const headerStyle = isActive 
                ? data.cardSettings.header.activeStyle 
                : data.cardSettings.header.normalStyle;
            this.applySectionStyle(headerEl, headerStyle, 'header');
            cardEl.appendChild(headerEl);
        }

        if (data.body.visible) {
            const bodyEl = await this.renderSection(data.body, 'card-body', data.file.path, bodyRenderMode);
            const bodyStyle = isActive 
                ? data.cardSettings.body.activeStyle 
                : data.cardSettings.body.normalStyle;
            this.applySectionStyle(bodyEl, bodyStyle, 'body');
            cardEl.appendChild(bodyEl);
        }

        if (data.footer.visible) {
            const footerEl = await this.renderSection(data.footer, 'card-footer', data.file.path, footerRenderMode);
            const footerStyle = isActive 
                ? data.cardSettings.footer.activeStyle 
                : data.cardSettings.footer.normalStyle;
            this.applySectionStyle(footerEl, footerStyle, 'footer');
            cardEl.appendChild(footerEl);
        }

        this.setupLinkHandlersInternal(cardEl);

        return cardEl;
    }

    /**
     * 카드 내 내부 링크와 태그에 클릭 핸들러를 설정합니다 (public)
     * 
     * @param cardEl - 카드 요소
     * 
     * @remarks
     * 외부에서 호출 가능한 public 메서드입니다.
     * 내부적으로는 setupLinkHandlersInternal을 호출합니다.
     */
    public setupLinkHandlers(cardEl: HTMLElement): void {
        this.setupLinkHandlersInternal(cardEl);
    }
    
    /**
     * 카드 내 내부 링크와 태그에 클릭 핸들러를 설정합니다 (internal)
     * 
     * @param cardEl - 카드 요소
     * 
     * @remarks
     * internal-link: 백링크/나가는 링크
     * - Ctrl/Cmd 클릭: 새 탭에서 열기
     * - 일반 클릭: 현재 탭에서 열기
     * 
     * tag-link: 태그
     * - 설정에 따라 플러그인 검색 또는 Obsidian 검색으로 분기
     */
    private setupLinkHandlersInternal(cardEl: HTMLElement): void {
        this.logger.debug('Card', t().debug.card.setupLinkHandlers);
        
        const linkElements = cardEl.querySelectorAll('.internal-link');
        
        this.logger.debug('Card', t().debug.card.internalLinkElementsFound, { count: linkElements.length });
        
        linkElements.forEach((linkEl, index) => {
            const span = linkEl as HTMLElement;
            const filePath = span.dataset.filePath;
            
            this.logger.debug('Card', t().debug.card.linkFilePath(index), filePath);
            
            if (!filePath) {
                this.logger.debug('Card', t().debug.card.linkNoFilePath(index));
                return;
            }
            
            span.style.cursor = 'pointer';
            span.style.color = 'var(--link-color)';
            span.style.textDecoration = 'none';
            
            span.addEventListener('mouseenter', () => {
                span.style.textDecoration = 'underline';
            });
            
            span.addEventListener('mouseleave', () => {
                span.style.textDecoration = 'none';
            });
            
            span.addEventListener('click', async (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                
                const file = this.app.vault.getAbstractFileByPath(filePath);
                
                if (!file) {
                    this.logger.error('Card', t().debug.card.fileNotFound, filePath);
                    return;
                }
                
                const newLeaf = e.ctrlKey || e.metaKey;
                
                try {
                    await this.app.workspace.openLinkText(
                        filePath,
                        '',
                        newLeaf
                    );
                    
                    this.logger.debug('Card', t().debug.card.linkOpenSuccess, {
                        filePath,
                        newLeaf
                    });
                } catch (error) {
                    this.logger.error('Card', t().debug.card.linkOpenError, error);
                }
            });
        });
        
        const tagElements = cardEl.querySelectorAll('.tag-link');
        
        this.logger.debug('Card', t().debug.card.tagLinkElementsFound, { count: tagElements.length });
        
        tagElements.forEach((tagEl, index) => {
            const span = tagEl as HTMLElement;
            const tagName = span.dataset.tag;
            
            this.logger.debug('Card', t().debug.card.tagName(index), tagName);
            
            if (!tagName) {
                this.logger.debug('Card', t().debug.card.tagNoName(index));
                return;
            }
            
            span.style.cursor = 'pointer';
            span.style.color = 'var(--text-accent)';
            span.style.textDecoration = 'none';
            
            span.addEventListener('mouseenter', () => {
                span.style.textDecoration = 'underline';
            });
            
            span.addEventListener('mouseleave', () => {
                span.style.textDecoration = 'none';
            });
            
            span.addEventListener('click', async (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                
                this.logger.debug('Card', t().debug.card.tagClicked, {
                    tagName,
                    tagClickAction: this.settings?.tagClickAction || 'obsidian-search',
                    timestamp: Date.now()
                });
                
                const tagClickAction = this.settings?.tagClickAction || 'plugin-search';
                
                switch (tagClickAction) {
                    case 'plugin-search':
                        await this.handlePluginSearch(tagName);
                        break;
                        
                    case 'obsidian-search':
                    default:
                        await this.handleObsidianSearch(tagName);
                        break;
                }
            });
        });
    }

    /**
     * Obsidian 기본 검색으로 태그 검색
     */
    private async handleObsidianSearch(tagName: string): Promise<void> {
        const searchLeaf = this.app.workspace.getLeavesOfType('search')[0];
        
        if (searchLeaf) {
            this.app.workspace.revealLeaf(searchLeaf);
            
            const searchView = searchLeaf.view as any;
            if (searchView && searchView.setQuery) {
                searchView.setQuery(`tag:#${tagName}`);
            }
            
            this.logger.debug('Card', t().debug.card.obsidianSearchExecuted, {
                tagName,
                searchQuery: `tag:#${tagName}`
            });
        } else {
            const leaf = this.app.workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: 'search',
                    state: {
                        query: `tag:#${tagName}`
                    }
                });
                
                this.app.workspace.revealLeaf(leaf);
                
                this.logger.debug('Card', t().debug.card.newSearchViewCreated, {
                    tagName,
                    searchQuery: `tag:#${tagName}`
                });
            }
        }
    }

    /**
     * 플러그인 검색 모드로 전환하여 태그 검색
     * 
     * @remarks
     * 검색 입력 필드에 태그 검색어를 설정하고 검색 결과를 표시합니다.
     * view 인스턴스가 없으면 Obsidian 검색으로 폴백합니다.
     */
    private async handlePluginSearch(tagName: string): Promise<void> {
        this.logger.debug('Card', t().debug.card.pluginSearchRequested, {
            tagName
        });
        
        if (this.view && this.view.searchInput) {
            if (this.view.searchInputContainer) {
                this.view.searchInputContainer.style.display = 'block';
                
                const input = this.view.searchInputContainer.querySelector('input');
                if (input) {
                    input.focus();
                }
            }
            
            const searchQuery = `tag:${tagName}`;
            this.view.searchInput.setValueAndSearch(searchQuery);
            
            this.logger.debug('Card', t().debug.card.pluginSearchConfigured, {
                tagName,
                searchQuery
            });
        } else {
            this.logger.error('Card', t().debug.card.pluginSearchFailed);
            
            await this.handleObsidianSearch(tagName);
        }
    }

    /**
     * 섹션 요소에 스타일을 적용합니다
     * 
     * @remarks
     * 헤더: border-bottom만 적용
     * 풋터: border-top만 적용
     * 바디: 테두리 없음
     */
    private applySectionStyle(
        element: HTMLElement, 
        style: import('../types').CardSectionStyleSettings,
        sectionType: 'header' | 'body' | 'footer'
    ): void {
        element.style.fontSize = `${style.fontSize}px`;
        element.style.backgroundColor = style.backgroundColor;
        
        if (sectionType === 'header') {
            element.style.borderBottomColor = style.borderColor;
            element.style.borderBottomWidth = `${style.borderWidth}px`;
            element.style.borderBottomStyle = style.borderWidth > 0 ? 'solid' : 'none';
        } else if (sectionType === 'footer') {
            element.style.borderTopColor = style.borderColor;
            element.style.borderTopWidth = `${style.borderWidth}px`;
            element.style.borderTopStyle = style.borderWidth > 0 ? 'solid' : 'none';
        }
    }

    /**
     * 섹션을 렌더링합니다
     * 
     * @param section - 섹션 데이터
     * @param className - CSS 클래스명
     * @param sourcePath - 마크다운 렌더링에 사용할 파일 경로
     * @param renderMode - 렌더링 모드
     * @returns 섹션 요소
     * 
     * @remarks
     * 렌더링 모드에 따라 일반 텍스트 또는 마크다운으로 표시합니다.
     * 내용이 비어있으면 타입에 따라 기본 텍스트를 표시합니다.
     */
    private async renderSection(
        section: CardSection,
        className: string,
        sourcePath: string,
        renderMode: RenderMode
    ): Promise<HTMLElement> {
        const sectionEl = document.createElement('div');
        sectionEl.className = className;

        this.logger.debug('Card', t().debug.card.renderSectionCalled, {
            sectionType: section.type,
            renderMode: renderMode,
            contentLength: section.content?.length || 0,
            contentPreview: section.content?.substring(0, 100),
            hasInternalLink: section.content?.includes('internal-link')
        });

        if (!section.content) {
            if (section.type === 'header') {
                sectionEl.textContent = t().uiLabels.view.noTitle;
            } else if (section.type === 'body') {
                sectionEl.textContent = t().uiLabels.view.noContent;
            }
            return sectionEl;
        }

        if (renderMode === 'markdown-html') {
            this.logger.debug('Card', t().debug.card.markdownRenderingStart, { sectionType: section.type });
            
            // Obsidian 읽기 뷰와 동일한 클래스 추가
            sectionEl.addClass('markdown-preview-view');
            sectionEl.addClass('markdown-preview-section');
            sectionEl.addClass('markdown-rendered');
            
            await this.renderMarkdown(section.content, sectionEl, sourcePath);
            
            sectionEl.addClass('card-markdown-content');
            
            this.logger.debug('Card', t().debug.card.markdownRenderingComplete, {
                sectionType: section.type,
                innerHTML: sectionEl.innerHTML.substring(0, 100)
            });
        } else {
            this.logger.debug('Card', t().debug.card.plainTextRendering, { sectionType: section.type });
            this.renderPlainText(section.content, sectionEl);
        }

        return sectionEl;
    }

    /**
     * 일반 텍스트로 렌더링합니다
     * 
     * @remarks
     * DOM API를 사용하여 한글 경로가 포함된 HTML도 안전하게 렌더링합니다.
     * internal-link, tag-link를 감지하여 HTML 콘텐츠로 판별합니다.
     */
    private renderPlainText(text: string, container: HTMLElement): void {
        this.logger.debug('Card', t().debug.card.renderPlainTextCalled, {
            textLength: text.length,
            hasSpan: text.includes('<span'),
            hasInternalLink: text.includes('internal-link'),
            hasTagLink: text.includes('tag-link'),
            containerClass: container.className
        });
        
        // HTML 태그가 포함되어 있으면 DOM API로 파싱
        if (text.includes('<span') && (text.includes('internal-link') || text.includes('tag-link'))) {
            this.logger.debug('Card', t().debug.card.htmlContentDetected);
            this.renderHTMLContent(text, container);
        } else {
            this.logger.debug('Card', t().debug.card.plainTextContent);
            container.textContent = text;
        }
    }

    /**
     * HTML 콘텐츠(internal-link, tag-link)를 DOM 요소로 변환합니다
     * 
     * @remarks
     * innerHTML을 사용하지 않고 정규식으로 파싱 후 DOM API로 요소를 생성합니다.
     * 한글, 특수문자가 포함된 파일 경로도 안전하게 처리합니다.
     * 쉼표로 구분된 여러 링크/태그를 지원합니다.
     */
    private renderHTMLContent(html: string, container: HTMLElement): void {
        this.logger.debug('Card', t().debug.card.renderHtmlContentCalled, {
            htmlLength: html.length,
            htmlPreview: html.substring(0, 200)
        });

        const parts = html.split(', ');
        this.logger.debug('Card', t().debug.card.partsSeparated, { count: parts.length });
        
        const fragment = document.createDocumentFragment();
        
        parts.forEach((part, index) => {
            const trimmedPart = part.trim();
            this.logger.debug('Card', t().debug.card.partTrimmed(index), { content: trimmedPart });
            
            let match = trimmedPart.match(/<span class="internal-link" data-file-path="([^"]+)">(.+?)<\/span>/);
            
            if (match) {
                const [_, filePath, displayName] = match;
                this.logger.debug('Card', t().debug.card.linkParsed, { filePath, displayName });
                
                const span = document.createElement('span');
                span.className = 'internal-link';
                span.dataset.filePath = filePath;
                span.textContent = displayName;
                
                fragment.appendChild(span);
                
                if (index < parts.length - 1) {
                    fragment.appendChild(document.createTextNode(', '));
                }
            } else {
                match = trimmedPart.match(/<span class="tag-link" data-tag="([^"]+)">(.+?)<\/span>/);
                
                if (match) {
                    const [_, tagName, displayText] = match;
                    this.logger.debug('Card', t().debug.card.tagParsed, { tagName, displayText });
                    
                    const span = document.createElement('span');
                    span.className = 'tag-link';
                    span.dataset.tag = tagName;
                    span.textContent = displayText;
                    
                    fragment.appendChild(span);
                    
                    if (index < parts.length - 1) {
                        fragment.appendChild(document.createTextNode(', '));
                    }
                } else {
                    this.logger.warn('Card', t().debug.card.htmlParsingFailed, {
                        part: trimmedPart,
                        reason: 'internal-link도 tag-link도 아님'
                    });
                    
                    if (trimmedPart.startsWith('<span') && trimmedPart.includes('tag-link')) {
                        const textMatch = trimmedPart.match(/>(.+?)</);
                        if (textMatch) {
                            this.logger.debug('Card', t().debug.card.tagTextExtracted, { text: textMatch[1] });
                            fragment.appendChild(document.createTextNode(textMatch[1]));
                        } else {
                            fragment.appendChild(document.createTextNode(trimmedPart));
                        }
                    } else {
                        fragment.appendChild(document.createTextNode(trimmedPart));
                    }
                    
                    if (index < parts.length - 1) {
                        fragment.appendChild(document.createTextNode(', '));
                    }
                }
            }
        });
        
        container.appendChild(fragment);
        this.logger.debug('Card', t().debug.card.domAddComplete, { childrenCount: container.children.length });
    }

    /**
     * 마크다운으로 렌더링합니다
     * 
     * @param text - 마크다운 텍스트
     * @param container - 렌더링 결과를 추가할 컨테이너
     * @param sourcePath - 파일 경로 (내부 링크 처리에 사용)
     * 
     * @remarks
     * Obsidian의 MarkdownRenderer를 사용하여
     * 볼드, 이탤릭, 링크 등의 마크다운 문법을 HTML로 변환합니다.
     * 렌더링 실패 시 일반 텍스트로 폴백합니다.
     */
    private async renderMarkdown(
        text: string,
        container: HTMLElement,
        sourcePath: string
    ): Promise<void> {
        try {
            this.logger.debug('Card', t().debug.card.markdownRendererCalled, {
                textLength: text.length,
                sourcePath: sourcePath,
                containerClass: container.className
            });
            
            await MarkdownRenderer.render(
                this.app,
                text,
                container,
                sourcePath,
                this.component
            );
            
            this.logger.debug('Card', t().debug.card.markdownRendererComplete, {
                childrenCount: container.children.length,
                innerHTML: container.innerHTML.substring(0, 200)
            });
        } catch (error) {
            this.logger.error('Card', t().debug.card.markdownRenderError, error);
            this.renderPlainText(text, container);
        }
    }

    /**
     * 헤더를 렌더링합니다
     *
     * @deprecated 대신 renderCard 메서드를 사용하세요
     */
    renderHeader(section: CardSection): HTMLElement {
        const headerEl = document.createElement('div');
        headerEl.className = 'card-header';
        headerEl.textContent = section.content || t().uiLabels.view.noTitle;
        return headerEl;
    }

    /**
     * 바디를 렌더링합니다
     *
     * @deprecated 대신 renderCard 메서드를 사용하세요
     */
    renderBody(section: CardSection): HTMLElement {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'card-body';
        bodyEl.textContent = section.content || t().uiLabels.view.noContent;
        return bodyEl;
    }

    /**
     * 풋터를 렌더링합니다
     * 
     * @deprecated 대신 renderCard 메서드를 사용하세요
     */
    renderFooter(section: CardSection): HTMLElement {
        const footerEl = document.createElement('div');
        footerEl.className = 'card-footer';
        footerEl.textContent = section.content || '';
        return footerEl;
    }
}

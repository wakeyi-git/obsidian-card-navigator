import { App, Component, MarkdownRenderer, setIcon, TFile } from 'obsidian';
import { CardData, CardSection, RenderMode, CardNavigatorSettings, CardSettings, ImageThumbnailSettings } from '../types';
import { DebugLogger } from '../utils/DebugLogger';
import { StyleUtils } from '../utils/StyleUtils';
import { t } from '../i18n';
import type { SearchInput } from '../search/SearchInput';
import { CardDataExtractor } from './CardData';

/**
 * View 인터페이스 - 순환 참조 방지
 */
interface ViewWithSearch extends Component {
    searchInput?: SearchInput;
    searchInputContainer?: HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getPlugin?: () => any;
}

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
    private view: ViewWithSearch;

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
     * 카드 전체를 렌더링합니다 (Modified Strategy A: Hybrid Approach)
     *
     * @param data - 카드 데이터 (cardSettings 포함)
     * @param container - 카드를 추가할 컨테이너
     * @returns 생성된 카드 요소
     *
     * @remarks
     * - CSS 커스텀 속성과 CSS 클래스로 모든 스타일 처리
     * - 인라인 스타일 적용 제거됨
     * - 상태 변경은 CSS 클래스 토글만으로 처리
     */
    async renderCard(data: CardData, container: HTMLElement): Promise<HTMLElement> {
        const cardEl = container.createEl('div', {
            cls: 'card-item'
        });

        cardEl.setAttribute('data-path', data.file.path);
        cardEl.setAttribute('tabindex', '-1');

        // Add pinned card class if file is pinned
        const isPinned = this.settings.pinnedFiles?.includes(data.file.path) || false;
        if (isPinned) {
            cardEl.addClass('is-pinned-card');
            cardEl.setAttribute('data-pinned', 'true');
        }

        // Add hover actions if enabled
        if (this.settings.enableCardHoverActions !== false) {
            this.addHoverActions(cardEl, data.file);
        }

        const headerRenderMode = data.cardSettings.header.contentRenderMode || data.cardSettings.renderMode;
        const bodyRenderMode = data.cardSettings.body.contentRenderMode || data.cardSettings.renderMode;
        const footerRenderMode = data.cardSettings.footer.contentRenderMode || data.cardSettings.renderMode;

        // Modified Strategy A: CSS가 섹션 스타일을 자동으로 처리
        if (data.header.visible) {
            const headerEl = await this.renderSectionWithImageSupport(
                data.header,
                'card-header',
                data.file,
                headerRenderMode,
                data.cardSettings.header
            );
            cardEl.appendChild(headerEl);
        }

        if (data.body.visible) {
            const bodyEl = await this.renderSectionWithImageSupport(
                data.body,
                'card-body',
                data.file,
                bodyRenderMode,
                data.cardSettings.body
            );
            cardEl.appendChild(bodyEl);
        }

        if (data.footer.visible) {
            const footerEl = await this.renderSectionWithImageSupport(
                data.footer,
                'card-footer',
                data.file,
                footerRenderMode,
                data.cardSettings.footer
            );
            cardEl.appendChild(footerEl);
        }

        // Modified Strategy A: Apply section-specific CSS custom properties
        this.applySectionCustomProperties(cardEl, data.cardSettings);

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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                this.view.searchInputContainer.classList.remove('hidden');

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

    // ⭐ applySectionStyle, getContrastColor, parseColor 메서드 제거됨
    // Modified Strategy A: CSS가 모든 섹션 스타일과 텍스트 색상 대비를 자동 처리
    // StyleUtils.getContrastColor()를 통해 필요시 사용 가능

    /**
     * 이미지 지원을 포함한 섹션 렌더링
     *
     * @param section - 섹션 데이터
     * @param className - CSS 클래스명
     * @param file - 파일 객체
     * @param renderMode - 렌더링 모드
     * @param sectionSettings - 섹션 설정
     * @returns 섹션 요소
     */
    private async renderSectionWithImageSupport(
        section: CardSection,
        className: string,
        file: import('obsidian').TFile,
        renderMode: RenderMode,
        sectionSettings: import('../types').CardSectionSettings
    ): Promise<HTMLElement> {
        // 이미지 섬네일 타입인 경우 이미지 렌더링
        if (sectionSettings.contentType === 'image-thumbnail' && sectionSettings.imageThumbnail) {
            return await this.renderImageThumbnail(
                file,
                sectionSettings.imageThumbnail,
                className
            );
        }

        // 그 외의 경우 기존 섹션 렌더링
        return await this.renderSection(section, className, file.path, renderMode);
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

            // ⭐ 마크다운 렌더링을 setTimeout으로 분산 (reflow 방지)
            const content = section.content;
            setTimeout(() => {
                this.renderMarkdown(content, sectionEl, sourcePath).then(() => {
                    sectionEl.addClass('card-markdown-content');
                });
            }, 0);

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
                const filePath = match[1];
                const displayName = match[2];
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
                    const tagName = match[1];
                    const displayText = match[2];
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

            // ⭐ CSS로 <br> 뒤 줄바꿈 처리 (DOM 조작 대신 클래스 추가)
            // white-space: pre-wrap 대신 white-space: pre-line 사용으로 해결
            container.addClass('card-markdown-rendered');

            this.logger.debug('Card', t().debug.card.markdownRendererComplete, {
                childrenCount: container.children.length,
                innerHTML: container.innerHTML.substring(0, 500)
            });
        } catch (error) {
            this.logger.error('Card', t().debug.card.markdownRenderError, error);
            this.renderPlainText(text, container);
        }
    }

    /**
     * 카드에 호버 액션 버튼을 추가합니다
     *
     * @param cardEl - 카드 요소
     * @param file - 파일 객체
     */
    private addHoverActions(cardEl: HTMLElement, file: import('obsidian').TFile): void {
        const actionsContainer = cardEl.createEl('div', {
            cls: 'card-hover-actions'
        });

        // Pin action
        const pinBtn = actionsContainer.createEl('div', {
            cls: 'clickable-icon card-hover-action-btn',
            attr: {
                'aria-label': t().toolbar.hoverActions.pin
            }
        });

        // Check if file is already pinned
        const isPinned = this.settings.pinnedFiles?.includes(file.path) || false;

        setIcon(pinBtn, 'pin');
        if (isPinned) {
            pinBtn.addClass('is-pinned');
        }

        pinBtn.addEventListener('click', async (e) => {
            e.stopPropagation();

            const pinnedFiles = this.settings.pinnedFiles || [];
            const index = pinnedFiles.indexOf(file.path);

            if (index > -1) {
                // Unpin
                pinnedFiles.splice(index, 1);
            } else {
                // Pin
                pinnedFiles.push(file.path);
            }

            this.settings.pinnedFiles = pinnedFiles;

            // Save settings and refresh view
            if (this.view.getPlugin) {
                const plugin = this.view.getPlugin();
                if (plugin) {
                    // Save settings first to ensure new state is persisted
                    await plugin.saveSettings();

                    // Then refresh view to update sort order and re-render cards
                    const view = plugin.getView();
                    if (view) {
                        await view.refresh();
                    }
                }
            }
        });

        // Copy link action
        const copyLinkBtn = actionsContainer.createEl('div', {
            cls: 'clickable-icon card-hover-action-btn',
            attr: {
                'aria-label': t().toolbar.hoverActions.link
            }
        });
        setIcon(copyLinkBtn, 'link');
        copyLinkBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const link = this.app.fileManager.generateMarkdownLink(file, '');
            await navigator.clipboard.writeText(link);
        });

        // Star action (bookmark)
        const starBtn = actionsContainer.createEl('div', {
            cls: 'clickable-icon card-hover-action-btn',
            attr: {
                'aria-label': t().toolbar.hoverActions.star
            }
        });

        // Check if file is already bookmarked
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bookmarks = (this.app as any).internalPlugins?.plugins?.bookmarks;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isBookmarked = bookmarks?.instance?.items?.some((item: any) =>
            item.type === 'file' && item.path === file.path
        ) || false;

        setIcon(starBtn, 'star');
        if (isBookmarked) {
            starBtn.addClass('is-starred');
        }

        starBtn.addEventListener('click', async (e) => {
            e.stopPropagation();

            if (bookmarks?.instance) {
                const bookmarkPlugin = bookmarks.instance;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existingBookmark = bookmarkPlugin.items?.find((item: any) =>
                    item.type === 'file' && item.path === file.path
                );

                if (existingBookmark) {
                    // Remove bookmark
                    bookmarkPlugin.removeItem(existingBookmark);
                    starBtn.removeClass('is-starred');
                } else {
                    // Add bookmark
                    bookmarkPlugin.addItem({
                        type: 'file',
                        path: file.path,
                        title: file.basename
                    });
                    starBtn.addClass('is-starred');
                }
            }
        });

        // Delete action
        const deleteBtn = actionsContainer.createEl('div', {
            cls: 'clickable-icon card-hover-action-btn delete-action',
            attr: {
                'aria-label': t().toolbar.hoverActions.delete
            }
        });
        setIcon(deleteBtn, 'trash');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            // Confirm before delete
            const confirmed = confirm(`Delete "${file.basename}"?`);
            if (confirmed) {
                await this.app.vault.delete(file);
            }
        });
    }

    /**
     * 섹션별 CSS 커스텀 속성 적용 (Modified Strategy A)
     *
     * @param card - 카드 요소
     * @param cardSettings - 카드 설정
     *
     * @remarks
     * 헤더, 바디, 풋터의 normal/active/focused 상태별 스타일을 CSS 변수로 설정합니다.
     * inheritFromNormal이 true인 경우, active/focused 변수를 설정하지 않아
     * 자동으로 normal 값으로 폴백되도록 합니다.
     */
    private applySectionCustomProperties(
        card: HTMLElement,
        cardSettings: CardSettings
    ): void {
        // Header styles
        if (cardSettings.header) {
            // Normal 스타일은 항상 설정
            card.style.setProperty('--card-header-bg-normal', cardSettings.header.normalStyle.backgroundColor);
            card.style.setProperty('--card-header-font-size-normal', `${cardSettings.header.normalStyle.fontSize}px`);
            card.style.setProperty('--card-header-text-color-normal', StyleUtils.getContrastColor(cardSettings.header.normalStyle.backgroundColor));

            // Active 스타일: 상속 모드가 아닐 때만 설정
            if (!cardSettings.header.activeStyle.inheritFromNormal) {
                card.style.setProperty('--card-header-bg-active', cardSettings.header.activeStyle.backgroundColor);
                card.style.setProperty('--card-header-font-size-active', `${cardSettings.header.activeStyle.fontSize}px`);
                card.style.setProperty('--card-header-text-color-active', StyleUtils.getContrastColor(cardSettings.header.activeStyle.backgroundColor));
            }

            // Focused 스타일: 상속 모드가 아닐 때만 설정
            if (!cardSettings.header.focusedStyle.inheritFromNormal) {
                card.style.setProperty('--card-header-bg-focused', cardSettings.header.focusedStyle.backgroundColor);
                card.style.setProperty('--card-header-font-size-focused', `${cardSettings.header.focusedStyle.fontSize}px`);
                card.style.setProperty('--card-header-text-color-focused', StyleUtils.getContrastColor(cardSettings.header.focusedStyle.backgroundColor));
            }
        }

        // Body styles
        if (cardSettings.body) {
            // Normal 스타일은 항상 설정
            card.style.setProperty('--card-body-bg-normal', cardSettings.body.normalStyle.backgroundColor);
            card.style.setProperty('--card-body-font-size-normal', `${cardSettings.body.normalStyle.fontSize}px`);
            card.style.setProperty('--card-body-text-color-normal', StyleUtils.getContrastColor(cardSettings.body.normalStyle.backgroundColor));

            // Active 스타일: 상속 모드가 아닐 때만 설정
            if (!cardSettings.body.activeStyle.inheritFromNormal) {
                card.style.setProperty('--card-body-bg-active', cardSettings.body.activeStyle.backgroundColor);
                card.style.setProperty('--card-body-font-size-active', `${cardSettings.body.activeStyle.fontSize}px`);
                card.style.setProperty('--card-body-text-color-active', StyleUtils.getContrastColor(cardSettings.body.activeStyle.backgroundColor));
            }

            // Focused 스타일: 상속 모드가 아닐 때만 설정
            if (!cardSettings.body.focusedStyle.inheritFromNormal) {
                card.style.setProperty('--card-body-bg-focused', cardSettings.body.focusedStyle.backgroundColor);
                card.style.setProperty('--card-body-font-size-focused', `${cardSettings.body.focusedStyle.fontSize}px`);
                card.style.setProperty('--card-body-text-color-focused', StyleUtils.getContrastColor(cardSettings.body.focusedStyle.backgroundColor));
            }
        }

        // Footer styles
        if (cardSettings.footer) {
            // Normal 스타일은 항상 설정
            card.style.setProperty('--card-footer-bg-normal', cardSettings.footer.normalStyle.backgroundColor);
            card.style.setProperty('--card-footer-font-size-normal', `${cardSettings.footer.normalStyle.fontSize}px`);
            card.style.setProperty('--card-footer-text-color-normal', StyleUtils.getContrastColor(cardSettings.footer.normalStyle.backgroundColor));

            // Active 스타일: 상속 모드가 아닐 때만 설정
            if (!cardSettings.footer.activeStyle.inheritFromNormal) {
                card.style.setProperty('--card-footer-bg-active', cardSettings.footer.activeStyle.backgroundColor);
                card.style.setProperty('--card-footer-font-size-active', `${cardSettings.footer.activeStyle.fontSize}px`);
                card.style.setProperty('--card-footer-text-color-active', StyleUtils.getContrastColor(cardSettings.footer.activeStyle.backgroundColor));
            }

            // Focused 스타일: 상속 모드가 아닐 때만 설정
            if (!cardSettings.footer.focusedStyle.inheritFromNormal) {
                card.style.setProperty('--card-footer-bg-focused', cardSettings.footer.focusedStyle.backgroundColor);
                card.style.setProperty('--card-footer-font-size-focused', `${cardSettings.footer.focusedStyle.fontSize}px`);
                card.style.setProperty('--card-footer-text-color-focused', StyleUtils.getContrastColor(cardSettings.footer.focusedStyle.backgroundColor));
            }
        }
    }

    /**
     * 이미지 섬네일을 렌더링합니다
     *
     * @param file - 파일 객체
     * @param settings - 이미지 섬네일 설정
     * @param className - CSS 클래스명
     * @returns 섹션 요소
     */
    private async renderImageThumbnail(
        file: TFile,
        settings: ImageThumbnailSettings,
        className: string
    ): Promise<HTMLElement> {
        const sectionEl = document.createElement('div');
        sectionEl.className = className;

        if (!settings.enabled) {
            sectionEl.style.display = 'none';
            return sectionEl;
        }

        const imageUrl = await this.extractImageWithFallback(file, settings);

        if (!imageUrl) {
            // 폴백이 'none'이거나 모든 방법이 실패한 경우
            sectionEl.style.display = 'none';
            return sectionEl;
        }

        const imgContainer = sectionEl.createEl('div', {
            cls: 'card-thumbnail-container'
        });

        imgContainer.setAttribute('data-size', settings.size);
        imgContainer.setAttribute('data-aspect-ratio', settings.aspectRatio);

        const img = imgContainer.createEl('img', {
            cls: 'card-thumbnail-image',
            attr: {
                'loading': 'lazy',  // 지연 로딩
                'decoding': 'async' // 비동기 디코딩
            }
        });

        // 이미지 로딩 처리
        let retryCount = 0;
        const maxRetries = settings.retryCount || 2;

        const loadImage = () => {
            img.src = imageUrl;

            img.addEventListener('error', () => {
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(loadImage, 1000 * retryCount);
                } else {
                    // 최종 실패 시 폴백
                    this.applyFallbackImage(img, file, settings.fallback);
                }
            });
        };

        loadImage();

        // 클릭 이벤트
        if (settings.clickAction !== 'none') {
            imgContainer.style.cursor = 'pointer';
            imgContainer.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (settings.clickAction !== 'none') {
                    await this.handleImageClick(file, imageUrl, settings.clickAction);
                }
            });
        }

        return sectionEl;
    }

    /**
     * 이미지 추출 (폴백 포함)
     */
    private async extractImageWithFallback(
        file: TFile,
        settings: ImageThumbnailSettings
    ): Promise<string | null> {
        // 먼저 실제 이미지 시도
        const extractor = new CardDataExtractor(this.app, () => this.settings);
        let imageUrl = await extractor.extractFirstImage(file, settings.allowExternalImages);

        // 이미지가 없으면 폴백
        if (!imageUrl && settings.fallback !== 'none') {
            imageUrl = await extractor.extractFallbackImage(file, settings.fallback);
        }

        return imageUrl;
    }

    /**
     * 폴백 이미지 적용
     */
    private async applyFallbackImage(
        img: HTMLImageElement,
        file: TFile,
        fallbackType: import('../types').ThumbnailFallback
    ): Promise<void> {
        const extractor = new CardDataExtractor(this.app, () => this.settings);
        const fallbackUrl = await extractor.extractFallbackImage(file, fallbackType);

        if (fallbackUrl) {
            img.src = fallbackUrl;
        } else {
            // 완전히 실패한 경우 placeholder
            img.style.display = 'none';
        }
    }

    /**
     * 이미지 클릭 처리
     */
    private async handleImageClick(
        file: TFile,
        imageUrl: string,
        action: 'open-file' | 'open-image'
    ): Promise<void> {
        if (action === 'open-file') {
            await this.app.workspace.openLinkText(file.path, '', false);
        } else if (action === 'open-image') {
            // 이미지를 새 탭에서 열기
            window.open(imageUrl, '_blank');
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

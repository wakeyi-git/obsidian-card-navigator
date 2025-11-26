import { App, TFile } from 'obsidian';
import { CardContentType, CardNavigatorSettings } from '../types';
import { LRUCache } from '../utils/memoize';
import { DebugLogger } from '../utils/DebugLogger';
import { TIMING, CACHE } from '../constants';
import { t } from '../i18n';
import { EnhancedMetadataCache } from './MetadataCache';

/**
 * 파일에서 카드 콘텐츠를 추출합니다
 * 
 * 파일명, 헤더, 본문, 태그, 날짜, 프론트매터, 백링크 등의
 * 다양한 정보를 추출하고 LRU 캐시로 성능을 최적화합니다.
 */
export class CardDataExtractor {
    private app: App;
    private contentCache: LRUCache<string, string>;
    private logger: DebugLogger;

    /** ⭐ Phase 5.3: 향상된 메타데이터 캐시 */
    private metadataCache: EnhancedMetadataCache;

    /**
     * 파일별 이전 링크 정보를 저장하여 링크 삭제 감지에 사용합니다
     * Map<파일경로, Set<링크타겟경로>>
     */
    private previousLinks = new Map<string, Set<string>>();

    constructor(app: App, getSettings: () => CardNavigatorSettings) {
        this.app = app;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(getSettings);

        this.contentCache = new LRUCache<string, string>(CACHE.MAX_CONTENT_CACHE_SIZE);

        // ⭐ Phase 5.3: EnhancedMetadataCache 초기화
        this.metadataCache = new EnhancedMetadataCache(app, getSettings);

        this.setupCacheInvalidation();
    }
    
    /**
     * 캐싱이 필요한 모든 콘텐츠 타입을 반환합니다
     */
    private generateCacheKeyTypes(): CardContentType[] {
        return [
            'filename', 'file-path', 'first-header', 'content', 'tags',
            'created-date', 'modified-date', 'property',
            'backlinks', 'outgoing-links'
        ];
    }

    /**
     * 파일 변경 감지 및 캐시 무효화를 설정합니다
     * 
     * @remarks
     * vault.on('modify') 대신 metadataCache.on('changed')를 사용하는 이유:
     * - metadataCache 이벤트가 파싱 완료 후 발생하여 extractTags() 등의 타이밍과 일치
     * 
     * resolvedLinks 업데이트 대기:
     * - Obsidian의 resolvedLinks는 이벤트 직후 바로 업데이트되지 않을 수 있음
     * - 100ms 지연으로 resolvedLinks 업데이트를 기다린 후 previousLinks 갱신
     * - 캐시 무효화는 즉시 실행하여 빠른 응답 보장
     */
    private setupCacheInvalidation(): void {
        this.app.metadataCache.on('changed', (file) => {
            if (file instanceof TFile) {
                this.invalidateCache(file);
                
                setTimeout(() => {
                    const previousLinks = this.previousLinks.get(file.path) || new Set<string>();
                    const currentLinks = this.getCurrentLinks(file);
                    
                    const addedLinks = [...currentLinks].filter(x => !previousLinks.has(x));
                    const removedLinks = [...previousLinks].filter(x => !currentLinks.has(x));
                    
                    this.logger.debug('Card', t().debug.card.linkChangeDetected, {
                        file: file.path,
                        previousCount: previousLinks.size,
                        currentCount: currentLinks.size,
                        added: addedLinks,
                        removed: removedLinks
                    });
                    
                    if (addedLinks.length > 0 || removedLinks.length > 0) {
                        this.invalidateRelatedBacklinks(file, addedLinks, removedLinks);
                    }
                    
                    this.previousLinks.set(file.path, currentLinks);
                }, TIMING.METADATA_UPDATE_DELAY);
            }
        });
        
        this.app.vault.on('delete', (file) => {
            if (file instanceof TFile) {
                this.invalidateCache(file);
                this.previousLinks.delete(file.path);
            }
        });
        
        this.app.vault.on('rename', () => {
            this.clearCache();
            this.previousLinks.clear();
            this.initializePreviousLinks();
        });
        
        this.initializePreviousLinks();
    }
    
    /**
     * 모든 파일의 현재 링크 상태를 previousLinks에 초기화합니다
     * 
     * @remarks
     * Obsidian의 resolvedLinks를 직접 사용하여 성능 최적화:
     * - 각 파일을 순회하며 링크를 파싱하는 대신, 이미 계산된 데이터 활용
     * - 파일이 많을 때 (1000+) 효과적
     */
    private initializePreviousLinks(): void {
        this.logger.debug('Card', t().debug.card.previousLinksInit);
        
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        
        let fileCount = 0;
        let linkCount = 0;
        
        for (const sourcePath in resolvedLinks) {
            const links = resolvedLinks[sourcePath];
            const linkPaths = new Set<string>();
            
            for (const targetPath in links) {
                linkPaths.add(targetPath);
                linkCount++;
            }
            
            if (linkPaths.size > 0) {
                this.previousLinks.set(sourcePath, linkPaths);
                fileCount++;
            }
        }
        
        this.logger.debug('Card', t().debug.card.previousLinksInitComplete(fileCount, linkCount));
    }
    
    /**
     * 현재 파일의 링크 목록을 가져옵니다
     * 
     * @param file - 파일 객체
     * @returns 링크 타겟 파일 경로들의 Set
     */
    private getCurrentLinks(file: TFile): Set<string> {
        const links = new Set<string>();
        
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        const fileLinks = resolvedLinks[file.path];
        
        if (fileLinks) {
            for (const targetPath in fileLinks) {
                links.add(targetPath);
            }
        }
        
        return links;
    }
    
    /**
     * 특정 파일과 관련된 다른 파일들의 백링크 캐시를 무효화합니다
     * 
     * @param file - 변경된 파일
     * @param addedLinks - 추가된 링크의 타겟 파일 경로들
     * @param removedLinks - 삭제된 링크의 타겟 파일 경로들
     * 
     * @remarks
     * 문제: 파일 A의 메타데이터가 변경되면 A의 캐시만 무효화되고,
     * A와 링크 관계에 있는 파일 B의 백링크 캐시는 그대로 유지됨.
     * 
     * 해결: A의 링크 목록(추가/삭제)에 있는 모든 타겟 파일과
     * A를 백링크로 가진 모든 파일의 캐시를 무효화합니다.
     */
    private invalidateRelatedBacklinks(
        file: TFile,
        addedLinks: string[],
        removedLinks: string[]
    ): void {
        this.logger.debug('Card', t().debug.card.relatedCacheInvalidation, { file: file.path });
        
        const affectedFiles = new Set<TFile>();
        
        for (const linkPath of addedLinks) {
            const targetFile = this.app.vault.getAbstractFileByPath(linkPath);
            if (targetFile instanceof TFile) {
                affectedFiles.add(targetFile);
                this.logger.debug('Card', t().debug.card.addedLinkTarget, { linkPath });
            }
        }
        
        for (const linkPath of removedLinks) {
            const targetFile = this.app.vault.getAbstractFileByPath(linkPath);
            if (targetFile instanceof TFile) {
                affectedFiles.add(targetFile);
                this.logger.debug('Card', t().debug.card.removedLinkTarget, { linkPath });
            }
        }
        
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        for (const sourcePath in resolvedLinks) {
            const links = resolvedLinks[sourcePath];
            if (links[file.path]) {
                const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
                if (sourceFile instanceof TFile) {
                    affectedFiles.add(sourceFile);
                    this.logger.debug('Card', t().debug.card.backlinkSource, { sourcePath });
                }
            }
        }
        
        this.logger.debug('Card', t().debug.card.totalCacheInvalidation(affectedFiles.size));
        
        for (const affectedFile of affectedFiles) {
            this.invalidateCache(affectedFile);
            this.logger.debug('Card', t().debug.card.cacheInvalidationComplete, { path: affectedFile.path });
        }
    }
    
    /**
     * 특정 파일의 캐시를 무효화합니다
     * 
     * @param file - 캐시를 삭제할 파일
     * 
     * @remarks
     * extractFileContent는 커스텀 캐시 키 형식을 사용하므로
     * renderMode와 includeFirstHeader 조합별로 캐시를 삭제해야 합니다.
     */
    private invalidateCache(file: TFile): void {
        const types = this.generateCacheKeyTypes();

        types.forEach(type => {
            // 기본 캐시 키 삭제
            const cacheKey = this.generateCacheKey(file, type);
            if (this.contentCache.has(cacheKey)) {
                this.contentCache.delete(cacheKey);

                this.logger.debug('Card', t().debug.card.cacheDeleted, {
                    file: file.path,
                    type,
                    cacheKey
                });
            }

            // content 타입의 경우 renderMode와 includeFirstHeader 조합별 캐시도 삭제
            if (type === 'content') {
                const renderModes = ['plain', 'markdown-html'];
                const headerOptions = [true, false];

                for (const mode of renderModes) {
                    for (const includeHeader of headerOptions) {
                        const customCacheKey = `${file.path}-${file.stat.mtime}-content-${includeHeader ? 'with-header' : 'no-header'}-${mode}`;
                        if (this.contentCache.has(customCacheKey)) {
                            this.contentCache.delete(customCacheKey);

                            this.logger.debug('Card', t().debug.card.customCacheDeleted, {
                                file: file.path,
                                customCacheKey
                            });
                        }
                    }
                }
            }
        });

        // ⭐ Phase 5.3: EnhancedMetadataCache 무효화
        this.metadataCache.invalidateFile(file);
    }
    
    /**
     * 모든 캐시를 삭제합니다
     */
    clearCache(): void {
        this.contentCache.clear();
        this.previousLinks.clear();

        // ⭐ Phase 5.3: EnhancedMetadataCache 초기화
        this.metadataCache.clear();
    }
    
    /**
     * 캐시 키를 생성합니다
     * 
     * @param file - 파일 객체
     * @param contentType - 콘텐츠 타입
     * @param customProperty - 커스텀 속성 이름 (선택)
     * @returns 캐시 키
     */
    private generateCacheKey(
        file: TFile,
        contentType: CardContentType,
        customProperty?: string
    ): string {
        const base = `${file.path}-${file.stat.mtime}-${contentType}`;
        return customProperty ? `${base}-${customProperty}` : base;
    }

    /**
     * ⭐ 여러 파일의 콘텐츠를 배치로 추출합니다 (성능 최적화)
     *
     * @param files - 파일 목록
     * @param contentType - 추출할 콘텐츠 타입
     * @param maxLength - 최대 글자 수 (선택)
     * @param customProperty - 프론트매터 속성 이름 (contentType이 'property'일 때)
     * @param contentRenderMode - 본문 렌더링 모드 (contentType이 'content'일 때만 사용)
     * @param includeFirstHeader - 본문 내용 표시 시 첫 번째 헤더 포함 여부 (contentType이 'content'일 때만 사용)
     * @returns 파일 경로를 키로 하는 추출된 내용 맵
     *
     * @remarks
     * 개별 extractContent를 반복 호출하는 것보다 효율적입니다.
     * MetadataCache를 한 번만 조회하고, 파일 읽기를 병렬로 처리합니다.
     */
    async extractContentBatch(
        files: TFile[],
        contentType: CardContentType,
        maxLength?: number,
        customProperty?: string,
        contentRenderMode?: import('../types').RenderMode,
        includeFirstHeader?: boolean
    ): Promise<Map<string, string>> {
        const results = new Map<string, string>();

        // 동기 콘텐츠 타입 (캐시 기반)
        const syncTypes: CardContentType[] = [
            'filename', 'file-path', 'first-header', 'tags',
            'created-date', 'modified-date', 'property'
        ];

        if (syncTypes.includes(contentType)) {
            // 동기 처리: 캐시만 사용하므로 빠름
            for (const file of files) {
                const content = await this.extractContent(
                    file,
                    contentType,
                    maxLength,
                    customProperty,
                    contentRenderMode,
                    includeFirstHeader
                );
                results.set(file.path, content);
            }
        } else {
            // 비동기 처리: 파일 읽기가 필요한 경우 병렬로 처리
            const promises = files.map(async (file) => {
                const content = await this.extractContent(
                    file,
                    contentType,
                    maxLength,
                    customProperty,
                    contentRenderMode,
                    includeFirstHeader
                );
                return { path: file.path, content };
            });

            const extracted = await Promise.all(promises);
            for (const { path, content } of extracted) {
                results.set(path, content);
            }
        }

        return results;
    }

    /**
     * 콘텐츠 타입에 따라 적절한 내용을 추출합니다
     *
     * @param file - 파일 객체
     * @param contentType - 추출할 콘텐츠 타입
     * @param maxLength - 최대 글자 수 (선택)
     * @param customProperty - 프론트매터 속성 이름 (contentType이 'property'일 때)
     * @param contentRenderMode - 본문 렌더링 모드 (contentType이 'content'일 때만 사용)
     * @param includeFirstHeader - 본문 내용 표시 시 첫 번째 헤더 포함 여부 (contentType이 'content'일 때만 사용)
     * @returns 추출된 내용
     *
     * @remarks
     * HTML 태그가 포함된 콘텐츠(백링크, 나가는 링크, 태그, markdown-html 모드)는
     * maxLength를 무시하여 HTML 태그가 잘리는 것을 방지합니다.
     */
    async extractContent(
        file: TFile,
        contentType: CardContentType,
        maxLength?: number,
        customProperty?: string,
        contentRenderMode?: import('../types').RenderMode,
        includeFirstHeader?: boolean
    ): Promise<string> {
        let content = '';

        switch (contentType) {
            case 'filename':
                content = this.extractFilename(file);
                break;
            case 'file-path':
                content = this.extractFilePath(file);
                break;
            case 'first-header':
                content = this.extractFirstHeader(file);
                break;
            case 'content':
                content = await this.extractFileContent(file, contentRenderMode, includeFirstHeader);
                break;
            case 'tags':
                content = this.extractTags(file);
                break;
            case 'created-date':
                content = this.extractCreatedDate(file);
                break;
            case 'modified-date':
                content = this.extractModifiedDate(file);
                break;
            case 'property':
                content = this.extractProperty(file, customProperty || '');
                break;
            case 'backlinks':
                content = await this.extractBacklinks(file);
                break;
            case 'outgoing-links':
                content = await this.extractOutgoingLinks(file);
                break;
            case 'image-thumbnail':
                // 이미지는 별도 처리 (extractFirstImage 메서드 사용)
                content = '';
                break;
            default:
                content = '';
        }

        const shouldApplyMaxLength = !(
            (contentType === 'content' && contentRenderMode === 'markdown-html') ||
            contentType === 'backlinks' ||
            contentType === 'outgoing-links' ||
            contentType === 'tags'
        );
        
        if (shouldApplyMaxLength && maxLength && content.length > maxLength) {
            content = content.substring(0, maxLength) + '...';
        }

        return content;
    }

    /**
     * 파일명을 추출합니다
     * 
     * @param file - 파일 객체
     * @returns 확장자를 제외한 파일명
     */
    extractFilename(file: TFile): string {
        return file.basename;
    }

    /**
     * 파일 경로를 추출합니다
     * 
     * @param file - 파일 객체
     * @returns 볼트 루트로부터의 상대 경로
     * 
     * @example
     * ```typescript
     * // 파일이 "folder/subfolder/note.md"에 있다면
     * extractFilePath(file) // "folder/subfolder/note.md"
     * ```
     */
    extractFilePath(file: TFile): string {
        return file.path;
    }

    /**
     * 첫 번째 헤더를 추출합니다
     * 
     * @param file - 파일 객체
     * @returns 첫 번째 헤더 또는 빈 문자열
     * 
     * @remarks
     * Obsidian의 CachedMetadata를 사용하여 성능을 최적화합니다.
     */
    extractFirstHeader(file: TFile): string {
        try {
            const cache = this.app.metadataCache.getFileCache(file);
            
            if (!cache?.headings || cache.headings.length === 0) {
                return '';
            }
            
            return cache.headings[0].heading;
            
        } catch (error) {
            this.logger.error('Card', t().debug.card.headerExtractionError, error);
            return '';
        }
    }

    /**
     * 파일 본문을 추출합니다
     * 
     * @param file - 파일 객체
     * @param contentRenderMode - 렌더링 모드 (선택)
     * @param includeFirstHeader - 첫 번째 헤더 포함 여부 (선택, 기본값: false)
     * @returns 본문 내용
     * 
     * @remarks
     * frontmatter를 제거한 후, 맨 앞의 헤더를 제목으로 간주하고 제외합니다.
     * (includeFirstHeader가 true일 경우 제외하지 않음)
     * 중간에 있는 헤더는 본문의 일부로 포함됩니다.
     */
    async extractFileContent(
        file: TFile,
        contentRenderMode?: import('../types').RenderMode,
        includeFirstHeader?: boolean
    ): Promise<string> {
        try {
            // ⭐ 버그 수정 (2025-11-19): contentRenderMode를 cacheKey에 포함
            // 이전: plain 모드로 캐시된 내용이 markdown-html 모드에서도 재사용되는 문제
            // 해결: renderMode별로 별도 캐시 유지
            const renderModeSuffix = contentRenderMode || 'plain';
            const cacheKey = `${file.path}-${file.stat.mtime}-content-${includeFirstHeader ? 'with-header' : 'no-header'}-${renderModeSuffix}`;
            const cached = this.contentCache.get(cacheKey);

            // ⭐ Performance: 캐시 미스 시에만 로그 출력 (카드당 반복 호출됨)
            if (cached !== undefined) {
                return cached;
            }
            
            // ⭐ Phase 5.3: 캐시된 콘텐츠 읽기
            let content = await this.metadataCache.getContent(file);

            // frontmatter 제거 (빈 frontmatter도 포함)
            // ^---\n 로 시작하고 ---\n? 로 끝나는 부분을 제거
            // [\ \S]*?는 비탐욕적 매칭으로 최소한의 내용만 매칭
            // 빈 frontmatter(---\n---\n)와 일반 frontmatter(---\nkey: value\n---\n) 모두 처리
            content = content.replace(/^---\n[\s\S]*?---\n?/, '');
            
            const lines = content.split('\n');
            
            let firstContentIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (trimmed) {
                    firstContentIndex = i;
                    break;
                }
            }
            
            if (firstContentIndex === -1) {
                this.contentCache.set(cacheKey, '');
                return '';
            }
            
            const firstLine = lines[firstContentIndex].trim();
            const isFirstLineHeader = /^#+\s/.test(firstLine);
            
            const startIndex = (includeFirstHeader || !isFirstLineHeader) 
                ? firstContentIndex 
                : firstContentIndex + 1;
            
            const contentLines: string[] = [];
            let foundContent = false;
            
            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                
                if (!foundContent && !trimmed) {
                    continue;
                }
                
                if (trimmed || foundContent) {
                    foundContent = true;
                    contentLines.push(line);
                }
            }
            
            if (contentLines.length === 0) {
                this.contentCache.set(cacheKey, '');
                return '';
            }
            
            let result: string;
            
            if (contentRenderMode === 'markdown-html') {
                result = contentLines.join('\n').trim();
            } else {
                result = contentLines.join(' ').replace(/\s+/g, ' ').trim();
            }
            
            this.contentCache.set(cacheKey, result);
            
            return result;
            
        } catch (error) {
            this.logger.error('Card', t().debug.card.contentExtractionError, error);
            return '';
        }
    }

    /**
     * 태그를 추출합니다 (중복 제거)
     * 
     * @param file - 파일 객체
     * @returns 태그 목록 (클릭 가능한 span 태그로 감싼)
     * 
     * @remarks
     * 프론트매터의 tags와 본문의 #태그를 모두 포함합니다.
     * 중복은 자동으로 제거되며, 각 태그는 클릭 가능한 span 태그로 감싸집니다.
     * 
     * @example
     * ```
     * "<span class='tag-link' data-tag='프로젝트'>#프로젝트</span>, 
     *  <span class='tag-link' data-tag='아이디어'>#아이디어</span>"
     * ```
     */
    extractTags(file: TFile): string {
        const cache = this.app.metadataCache.getFileCache(file);
        const allTags = new Set<string>(); // Set으로 자동 중복 제거
        
        // Frontmatter 태그
        if (cache?.frontmatter?.tags) {
            const fmTags = Array.isArray(cache.frontmatter.tags) 
                ? cache.frontmatter.tags 
                : [cache.frontmatter.tags];
            fmTags.forEach(tag => {
                // '#' 제거하고 추가
                const cleanTag = String(tag).replace(/^#/, '');
                if (cleanTag) {
                    allTags.add(cleanTag);
                }
            });
        }
        
        // 인라인 태그
        if (cache?.tags) {
            cache.tags.forEach(tagInfo => {
                const cleanTag = tagInfo.tag.replace(/^#/, '');
                if (cleanTag) {
                    allTags.add(cleanTag);
                }
            });
        }
        
        // Set을 배열로 변환하고 정렬하여 span 태그로 감싸기
        const tagElements = Array.from(allTags)
            .sort()
            .map(tag => {
                return `<span class="tag-link" data-tag="${tag}">#${tag}</span>`;
            });
        
        return tagElements.join(', ');
    }

    /**
     * 생성일을 추출합니다
     * 
     * @param file - 파일 객체
     * @returns YYYY-MM-DD 형식의 생성일
     */
    extractCreatedDate(file: TFile): string {
        const date = new Date(file.stat.ctime);
        return this.formatDate(date);
    }

    /**
     * 수정일을 추출합니다
     * 
     * @param file - 파일 객체
     * @returns YYYY-MM-DD 형식의 수정일
     */
    extractModifiedDate(file: TFile): string {
        const date = new Date(file.stat.mtime);
        return this.formatDate(date);
    }

    /**
     * 프론트매터 속성값을 추출합니다
     * 
     * @param file - 파일 객체
     * @param propertyName - 속성 이름
     * @returns 속성값 (문자열로 변환)
     */
    extractProperty(file: TFile, propertyName: string): string {
        if (!propertyName) {
            return '';
        }

        const cache = this.app.metadataCache.getFileCache(file);
        
        if (!cache?.frontmatter) {
            return '';
        }

        const value = cache.frontmatter[propertyName];
        
        if (value == null) {
            return '';
        }

        if (Array.isArray(value)) {
            return value.join(', ');
        }

        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    }

    /**
     * 날짜를 YYYY-MM-DD 형식으로 포맷합니다
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 백링크를 추출합니다
     * 
     * @param file - 파일 객체
     * @returns 백링크 목록 (클릭 가능한 span 태그로 감싼)
     * 
     * @remarks
     * 이 파일을 링크하는 다른 파일들을 찾습니다.
     * 
     * @example
     * ```
     * "<span class='internal-link' data-file-path='note1.md'>Note 1</span>, 
     *  <span class='internal-link' data-file-path='note2.md'>Note 2</span>"
     * ```
     */
    async extractBacklinks(file: TFile): Promise<string> {
        try {
            const cacheKey = `${file.path}-${file.stat.mtime}-backlinks`;
            const cached = this.contentCache.get(cacheKey);

            // ⭐ Performance: 캐시 히트 시 로그 없이 즉시 반환
            if (cached !== undefined) {
                return cached;
            }

            const backlinks: string[] = [];
            const resolvedLinks = this.app.metadataCache.resolvedLinks;

            // ⭐ Performance: 개별 백링크 발견 로그 제거 (링크 수에 비례해 로그 폭발)
            for (const sourcePath in resolvedLinks) {
                const links = resolvedLinks[sourcePath];

                if (links[file.path]) {
                    backlinks.push(sourcePath);
                }
            }

            if (backlinks.length === 0) {
                this.contentCache.set(cacheKey, '');
                return '';
            }

            const linkElements: string[] = [];

            for (const sourcePath of backlinks) {
                const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);

                if (sourceFile instanceof TFile) {
                    const displayName = sourceFile.basename;
                    const encodedPath = this.htmlEncode(sourcePath);
                    const encodedName = this.htmlEncode(displayName);

                    linkElements.push(
                        `<span class="internal-link" data-file-path="${encodedPath}">${encodedName}</span>`
                    );
                }
            }

            const result = linkElements.join(', ');
            this.contentCache.set(cacheKey, result);

            return result;
            
        } catch (error) {
            this.logger.error('Card', t().debug.card.backlinkExtractionError, error);
            return '';
        }
    }

    /**
     * 나가는 링크를 추출합니다
     * 
     * @param file - 파일 객체
     * @returns 나가는 링크 목록 (클릭 가능한 span 태그로 감싼)
     * 
     * @remarks
     * 이 파일에서 링크하는 다른 파일들을 찾습니다.
     * 본문의 [[링크]]와 프론트매터의 링크를 모두 포함합니다.
     * 
     * @example
     * ```
     * "<span class='internal-link' data-file-path='note3.md'>Note 3</span>, 
     *  <span class='internal-link' data-file-path='note4.md'>Note 4</span>"
     * ```
     */
    async extractOutgoingLinks(file: TFile): Promise<string> {
        try {
            const cacheKey = `${file.path}-${file.stat.mtime}-outgoing-links`;
            const cached = this.contentCache.get(cacheKey);

            // ⭐ Performance: 캐시 히트 시 로그 없이 즉시 반환
            if (cached !== undefined) {
                return cached;
            }

            const cache = this.app.metadataCache.getFileCache(file);

            // ⭐ Performance: 개별 링크 처리 로그 제거 (링크 수에 비례해 로그 폭발)
            const allLinks = [
                ...(cache?.links || []),
                ...(cache?.frontmatterLinks || [])
            ];

            if (allLinks.length === 0) {
                this.contentCache.set(cacheKey, '');
                return '';
            }

            const linkElements: string[] = [];
            const processedPaths = new Set<string>();

            for (const link of allLinks) {
                const targetFile = this.app.metadataCache.getFirstLinkpathDest(
                    link.link,
                    file.path
                );

                if (targetFile instanceof TFile) {
                    if (processedPaths.has(targetFile.path)) {
                        continue;
                    }
                    processedPaths.add(targetFile.path);

                    const displayName = link.displayText || targetFile.basename;
                    const encodedPath = this.htmlEncode(targetFile.path);
                    const encodedName = this.htmlEncode(displayName);

                    linkElements.push(
                        `<span class="internal-link" data-file-path="${encodedPath}">${encodedName}</span>`
                    );
                }
            }

            const result = linkElements.join(', ');
            this.contentCache.set(cacheKey, result);

            return result;
            
        } catch (error) {
            this.logger.error('Card', t().debug.card.outgoingLinkExtractionError, error);
            return '';
        }
    }

    /**
     * HTML 특수문자를 엔티티로 인코딩합니다
     *
     * @param text - 인코딩할 텍스트
     * @returns HTML 엔티티로 인코딩된 텍스트
     *
     * @remarks
     * 한글이나 특수문자를 포함한 파일 경로를 안전하게 HTML 속성에 사용하기 위함
     * Node.js 환경에서도 작동하도록 순수 JavaScript 구현 사용
     */
    private htmlEncode(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 파일에서 첫 번째 이미지를 추출합니다
     *
     * @param file - 파일 객체
     * @param allowExternal - 외부 이미지 허용 여부
     * @returns 이미지 경로 또는 URL
     */
    async extractFirstImage(
        file: TFile,
        allowExternal: boolean = false
    ): Promise<string | null> {
        try {
            const cacheKey = `${file.path}-${file.stat.mtime}-first-image`;
            const cached = this.contentCache.get(cacheKey);

            if (cached !== undefined) {
                return cached;
            }

            // ⭐ Phase 5.3: 캐시된 콘텐츠 읽기
            const content = await this.metadataCache.getContent(file);
            const cache = this.app.metadataCache.getFileCache(file);

            // 1. Embedded images ![[image.png]]
            if (cache?.embeds && cache.embeds.length > 0) {
                for (const embed of cache.embeds) {
                    const linkFile = this.app.metadataCache.getFirstLinkpathDest(
                        embed.link,
                        file.path
                    );

                    if (linkFile && this.isImageFile(linkFile)) {
                        const imagePath = this.app.vault.getResourcePath(linkFile);
                        this.contentCache.set(cacheKey, imagePath);
                        return imagePath;
                    }
                }
            }

            // 2. Markdown images ![](image.jpg)
            const markdownImageRegex = /!\[.*?\]\((.+?)\)/;
            const match = content.match(markdownImageRegex);

            if (match) {
                const imagePath = match[1];

                // 외부 이미지 URL (http/https)
                if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                    if (allowExternal) {
                        this.contentCache.set(cacheKey, imagePath);
                        return imagePath;
                    }
                } else {
                    // 로컬 상대 경로
                    const linkFile = this.app.metadataCache.getFirstLinkpathDest(
                        imagePath,
                        file.path
                    );

                    if (linkFile && this.isImageFile(linkFile)) {
                        const resourcePath = this.app.vault.getResourcePath(linkFile);
                        this.contentCache.set(cacheKey, resourcePath);
                        return resourcePath;
                    }
                }
            }

            this.contentCache.set(cacheKey, '');
            return null;

        } catch (error) {
            this.logger.error('Card', 'Image extraction error', error);
            return null;
        }
    }

    /**
     * 파일이 이미지인지 확인합니다
     */
    private isImageFile(file: TFile): boolean {
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
        return imageExtensions.includes(file.extension.toLowerCase());
    }

    /**
     * 폴백 이미지를 생성합니다
     */
    async extractFallbackImage(
        file: TFile,
        fallbackType: import('../types').ThumbnailFallback
    ): Promise<string | null> {
        switch (fallbackType) {
            case 'none':
                return null;

            case 'icon':
                // 파일 타입 아이콘 반환 (SVG data URL)
                return this.getFileTypeIcon(file);

            case 'folder-color':
                // 폴더 경로 기반 색상 생성
                return this.generateColorPlaceholder(file.parent?.path || '');

            case 'tag-color': {
                // 첫 번째 태그 기반 색상 생성
                const tags = this.extractTags(file);
                return this.generateColorPlaceholder(tags);
            }

            case 'first-emoji':
                // 본문의 첫 번째 이모지 추출
                return await this.extractFirstEmoji(file);

            default:
                return null;
        }
    }

    /**
     * 파일 타입 아이콘을 SVG data URL로 반환
     */
    private getFileTypeIcon(_file: TFile): string {
        // 간단한 문서 아이콘 SVG
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
        `.trim();

        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    /**
     * 문자열 기반 색상 플레이스홀더 생성
     */
    private generateColorPlaceholder(seed: string): string {
        // seed 문자열을 해시하여 일관된 색상 생성
        const hash = this.hashString(seed);
        const hue = hash % 360;

        // SVG data URL로 단색 배경 생성
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <rect width="200" height="200" fill="hsl(${hue}, 60%, 70%)"/>
            </svg>
        `.trim();

        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    /**
     * 첫 번째 이모지 추출
     */
    private async extractFirstEmoji(file: TFile): Promise<string | null> {
        // ⭐ Phase 5.3: 캐시된 추출 데이터 사용
        return await this.metadataCache.getExtractedData(
            file,
            'first-emoji',
            async () => {
                const content = await this.metadataCache.getContent(file);
                const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
                const match = content.match(emojiRegex);

                if (match) {
                    // 이모지를 큰 텍스트로 표시한 SVG 생성
                    const emoji = match[0];
                    const svg = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                            <text x="50%" y="50%" font-size="120" text-anchor="middle" dominant-baseline="central">${emoji}</text>
                        </svg>
                    `.trim();
                    return `data:image/svg+xml;base64,${btoa(svg)}`;
                }

                return null;
            }
        );
    }

    /**
     * 문자열 해시 함수
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }
}

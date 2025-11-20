import { App, TFolder, AbstractInputSuggest, CachedMetadata } from 'obsidian';
import { t } from '../i18n';

/**
 * 검색 쿼리 파싱 결과
 */
interface ParsedQuery {
    prefix: string;
    lastToken: string;
    cursorPos: number;
}

/**
 * 검색 연산자 정보
 */
interface SearchOperator {
    operator: string;
    description: string;
}

/**
 * 검색 연산자 목록
 */
function getSearchOperators(): SearchOperator[] {
    return [
        { operator: 'path:', description: t().searchOperators.path },
        { operator: 'file:', description: t().searchOperators.file },
        { operator: 'tag:', description: t().searchOperators.tag },
        { operator: 'line:', description: t().searchOperators.line },
        { operator: 'section:', description: t().searchOperators.section },
        { operator: '[property]', description: t().searchOperators.property },
        { operator: 'created:', description: t().searchOperators.created },
        { operator: 'modified:', description: t().searchOperators.modified }
    ];
}

/**
 * 검색 입력 필드 자동완성
 * 
 * 검색 타입에 따라 적절한 제안을 제공합니다.
 * 중첩된 검색어에서도 마지막 단어를 기준으로 자동완성을 제공합니다.
 */
export class SearchSuggest extends AbstractInputSuggest<SearchOperator | string> {
    private inputEl: HTMLInputElement;
    private tagsCache: Set<string> | null = null;
    
    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.inputEl = inputEl;
    }
    
    /**
     * 쿼리를 파싱하여 마지막 토큰을 추출합니다
     * 
     * @param query - 전체 검색 쿼리
     * @returns 파싱된 쿼리 정보
     */
    private parseQuery(query: string): ParsedQuery {
        const cursorPos = this.inputEl.selectionStart || query.length;
        const textBeforeCursor = query.substring(0, cursorPos);
        const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
        
        if (lastSpaceIndex === -1) {
            return {
                prefix: '',
                lastToken: textBeforeCursor,
                cursorPos
            };
        }
        
        return {
            prefix: textBeforeCursor.substring(0, lastSpaceIndex + 1),
            lastToken: textBeforeCursor.substring(lastSpaceIndex + 1),
            cursorPos
        };
    }
    
    /**
     * 제안 목록을 생성합니다
     * 
     * @param query - 현재 입력된 검색어
     * @returns 제안 목록 배열
     */
    getSuggestions(query: string): (SearchOperator | string)[] {
        const trimmedQuery = query.trim();

        if (trimmedQuery === '') {
            return getSearchOperators();
        }

        const { lastToken } = this.parseQuery(query);

        if (lastToken.trim() === '') {
            return getSearchOperators();
        }
        
        if (lastToken.startsWith('path:')) {
            return this.getFolderSuggestions(lastToken);
        }
        
        if (lastToken.startsWith('file:')) {
            return this.getFileSuggestions(lastToken);
        }
        
        if (lastToken.startsWith('tag:')) {
            return this.getTagSuggestions(lastToken);
        }
        
        if (lastToken.includes('[') && !lastToken.includes(']')) {
            return this.getPropertySuggestions(lastToken);
        }
        
        return this.getGeneralSuggestions(lastToken);
    }
    
    /**
     * 폴더 경로 제안을 생성합니다
     */
    private getFolderSuggestions(query: string): string[] {
        const searchTerm = query.replace('path:', '').trim();
        
        const folders = this.app.vault.getAllLoadedFiles()
            .filter((file): file is TFolder => file instanceof TFolder)
            .map(folder => folder.path);
        
        if (searchTerm === '') {
            return folders.slice(0, 5).map(path => `path:${path}`);
        }
        
        return folders
            .filter(path => 
                path.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .slice(0, 5)
            .map(path => `path:${path}`);
    }
    
    /**
     * 파일명 제안을 생성합니다
     */
    private getFileSuggestions(query: string): string[] {
        const searchTerm = query.replace('file:', '').trim();
        const files = this.app.vault.getMarkdownFiles();
        
        if (searchTerm === '') {
            return files.slice(0, 5).map(file => `file:${file.basename}`);
        }
        
        return files
            .filter(file => 
                file.basename.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .slice(0, 5)
            .map(file => `file:${file.basename}`);
    }
    
    /**
     * Vault의 모든 태그를 수집합니다
     * 
     * @remarks
     * 결과를 캐싱하여 동일 세션에서 반복 호출 시 성능을 향상시킵니다.
     * 태그는 '#' 없이 저장됩니다 (표시 시에만 추가).
     * 
     * @returns 태그 Set (중복 제거됨)
     */
    private collectAllTags(): Set<string> {
        // 캐시가 있으면 재사용
        if (this.tagsCache) {
            return this.tagsCache;
        }
        
        const tagSet = new Set<string>();
        const files = this.app.vault.getMarkdownFiles();
        
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache) continue;
            
            // 인라인 태그 수집 (#tag 형식)
            this.collectInlineTags(cache, tagSet);
            
            // 프론트매터 태그 수집
            this.collectFrontmatterTags(cache, tagSet);
        }
        
        // 캐시 저장
        this.tagsCache = tagSet;
        
        return tagSet;
    }
    
    /**
     * 본문의 인라인 태그를 수집합니다 (#tag 형식)
     * 
     * @param cache - 파일의 캐시된 메타데이터
     * @param tagSet - 태그를 추가할 Set
     */
    private collectInlineTags(
        cache: CachedMetadata,
        tagSet: Set<string>
    ): void {
        if (!cache.tags) return;
        
        for (const tagCache of cache.tags) {
            if (!tagCache?.tag) continue;
            
            const normalizedTag = this.normalizeTag(tagCache.tag);
            if (normalizedTag) {
                tagSet.add(normalizedTag);
            }
        }
    }
    
    /**
     * 프론트매터의 태그를 수집합니다
     * 
     * @param cache - 파일의 캐시된 메타데이터
     * @param tagSet - 태그를 추가할 Set
     */
    private collectFrontmatterTags(
        cache: CachedMetadata,
        tagSet: Set<string>
    ): void {
        const frontmatterTags = cache.frontmatter?.tags;
        if (!frontmatterTags) return;
        
        // 배열이든 문자열이든 배열로 통일
        const tagsArray = Array.isArray(frontmatterTags)
            ? frontmatterTags
            : [frontmatterTags];
        
        for (const tag of tagsArray) {
            const normalizedTag = this.normalizeTag(tag);
            if (normalizedTag) {
                tagSet.add(normalizedTag);
            }
        }
    }
    
    /**
     * 태그를 정규화합니다
     * 
     * @remarks
     * - # 제거
     * - 앞뒤 공백 제거
     * - 유효성 검사
     * 
     * @param tag - 정규화할 태그
     * @returns 정규화된 태그 (# 없이) 또는 null (유효하지 않은 경우)
     * 
     * @example
     * normalizeTag('#example')   // 'example'
     * normalizeTag('example')    // 'example'
     * normalizeTag('  #tag  ')   // 'tag'
     * normalizeTag('')           // null
     * normalizeTag(123)          // null
     */
    private normalizeTag(tag: unknown): string | null {
        // 문자열이 아니면 null
        if (typeof tag !== 'string') {
            return null;
        }
        
        // 앞뒤 공백 제거 후 # 제거
        const cleaned = tag.trim().replace(/^#/, '');
        
        // 빈 문자열이면 null
        if (!cleaned) {
            return null;
        }
        
        return cleaned;
    }
    
    /**
     * 태그 제안을 생성합니다
     * 
     * @param query - 'tag:' 접두사가 포함된 쿼리
     * @returns 제안 목록 (형식: 'tag:#tagname')
     */
    private getTagSuggestions(query: string): string[] {
        const searchTerm = query.replace('tag:', '').replace(/^#/, '').trim().toLowerCase();
        const allTags = this.collectAllTags();
        
        // 검색어가 없으면 상위 5개
        if (searchTerm === '') {
            return Array.from(allTags)
                .slice(0, 5)
                .map(tag => `tag:#${tag}`);
        }
        
        // 검색어로 필터링
        return Array.from(allTags)
            .filter(tag => tag.toLowerCase().includes(searchTerm))
            .slice(0, 5)
            .map(tag => `tag:#${tag}`);
    }
    
    /**
     * 프론트매터 속성 제안을 생성합니다
     */
    private getPropertySuggestions(query: string): string[] {
        const match = query.match(/\[([^\]]*)/);
        if (!match) return [];
        
        const searchTerm = match[1].trim();
        const allProperties = new Set<string>();
        const files = this.app.vault.getMarkdownFiles();
        
        files.forEach(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache?.frontmatter) return;
            
            Object.keys(cache.frontmatter).forEach(key => {
                if (key !== 'position') {
                    allProperties.add(key);
                }
            });
        });
        
        const propertiesArray = Array.from(allProperties);
        
        const filtered = searchTerm === ''
            ? propertiesArray.slice(0, 5)
            : propertiesArray
                .filter(prop => 
                    prop.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .slice(0, 5);
        
        const prefix = query.substring(0, query.indexOf('['));
        return filtered.map(prop => `${prefix}[${prop}]:`);
    }
    
    /**
     * 일반 단어에 대한 제안을 생성합니다
     * 
     * 파일명과 태그를 기반으로 제안 목록을 생성합니다.
     * 
     * @param query - 검색어
     * @returns 제안 목록
     */
    private getGeneralSuggestions(query: string): string[] {
        if (!query || query.length < 2) {
            return [];
        }
        
        const searchTerm = query.toLowerCase();
        const suggestions: string[] = [];
        
        // 파일명 제안 (최대 3개)
        const files = this.app.vault.getMarkdownFiles();
        const matchingFiles = files
            .filter(file => 
                file.basename.toLowerCase().includes(searchTerm)
            )
            .slice(0, 3)
            .map(file => file.basename);
        
        suggestions.push(...matchingFiles);
        
        // 태그 제안 (최대 2개)
        const allTags = this.collectAllTags();
        const matchingTags = Array.from(allTags)
            .filter(tag => tag.toLowerCase().includes(searchTerm))
            .slice(0, 2)
            .map(tag => `#${tag}`);  // 표시 시에만 # 추가
        
        suggestions.push(...matchingTags);
        
        return suggestions.slice(0, 5);
    }
    
    /**
     * 태그 캐시를 무효화합니다
     * 
     * @remarks
     * 파일 변경 등으로 태그가 변경되었을 때 호출하여
     * 다음 검색 시 최신 태그를 가져오도록 합니다.
     */
    public invalidateTagsCache(): void {
        this.tagsCache = null;
    }
    
    /**
     * 제안 항목을 렌더링합니다
     * 
     * @param value - 제안 값
     * @param el - 렌더링할 HTML 요소
     */
    renderSuggestion(value: SearchOperator | string, el: HTMLElement): void {
        if (typeof value === 'object' && 'operator' in value) {
            const container = el.createEl('div', { 
                cls: 'search-suggestion-item'
            });
            container.addClass('search-operator-item');
            
            container.createEl('span', {
                text: value.operator,
                cls: 'search-operator'
            });
            
            container.createEl('span', {
                text: value.description,
                cls: 'search-operator-description'
            });
        } else {
            el.createEl('div', { 
                text: value,
                cls: 'search-suggestion-item'
            });
        }
    }
    
    /**
     * 제안 항목이 선택되었을 때 처리합니다
     * 
     * 중첩 검색어를 지원하기 위해 마지막 토큰만 교체합니다.
     * 일반 값 선택 시 공백 추가 후 검색 옵션을 자동으로 표시합니다.
     * 
     * @param value - 선택된 제안 값
     */
    selectSuggestion(value: SearchOperator | string): void {
        if (!this.inputEl) {
            return;
        }
        
        const currentValue = this.inputEl.value;
        const { prefix } = this.parseQuery(currentValue);
        
        const selectedValue = typeof value === 'object' && 'operator' in value 
            ? value.operator 
            : value;
        
        const newValue = prefix + selectedValue;
        this.inputEl.value = newValue;
        
        if (selectedValue.endsWith(':')) {
            this.inputEl.setSelectionRange(newValue.length, newValue.length);
            this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            this.close();
        } else {
            this.inputEl.value = newValue + ' ';
            const cursorPos = newValue.length + 1;
            this.inputEl.setSelectionRange(cursorPos, cursorPos);
            this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            this.open();
        }
    }
}
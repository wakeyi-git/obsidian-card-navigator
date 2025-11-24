import { TFile, App } from 'obsidian';
import { SearchQuery, ParsedQuery, CardNavigatorSettings } from '../types';
import { SearchParser } from './SearchParser';
import { PaginatedSearchResult } from './PaginatedSearchResult';
import { TieredCache } from './cache/TieredCache';
import { DebugLogger } from '../utils/DebugLogger';
import { t } from '../i18n';
import { fuzzyMatch } from '../utils/fuzzyMatch';

/**
 * 검색 엔진
 *
 * 파일명, 경로, 본문, 메타데이터를 검색하고 고급 검색 옵션을 제공합니다.
 *
 * @remarks
 * 검색 결과는 3단계 캐시(L1/L2/L3)에 저장되며, 파일 변경 시 자동으로 무효화됩니다.
 * 정규식 검색과 고급 검색(path:, tag:, line: 등)을 지원합니다.
 */
export class SearchEngine {
    private app: App;
    private logger: DebugLogger;
    private parser: SearchParser;
    private searchCache: TieredCache;
    private getSettings: () => CardNavigatorSettings;

    constructor(app: App, logger: DebugLogger, getSettings: () => CardNavigatorSettings) {
        this.app = app;
        this.logger = logger;
        this.getSettings = getSettings;
        this.parser = new SearchParser();
        this.searchCache = new TieredCache(app, logger);
        this.setupCacheInvalidation();
    }

    /**
     * ⭐ 파일 변경 시 선택적으로 캐시를 무효화합니다 (성능 최적화)
     *
     * @remarks
     * 이전: 모든 변경 시 전체 캐시 삭제
     * 개선: 변경된 파일을 포함하는 캐시 항목만 삭제
     *
     * vault.on('modify') 대신 metadataCache.on('changed')를 사용하는 이유:
     * - metadataCache 이벤트가 파싱 완료 후 발생하여 태그, 링크 등 메타데이터가 업데이트된 시점과 일치
     * - ColdCache(L3)가 metadataCache에 의존하므로, 메타데이터 업데이트 후 캐시 무효화가 필요
     */
    private setupCacheInvalidation(): void {
        try {
            // vault.on이 존재하는 경우에만 이벤트 리스너 등록
            if (this.app.vault && typeof this.app.vault.on === 'function') {
                // 파일 생성/삭제/이름 변경 시에는 전체 캐시 무효화 (파일 목록 변경)
                this.app.vault.on('create', () => this.clearCache());
                this.app.vault.on('delete', () => this.clearCache());
                this.app.vault.on('rename', () => this.clearCache());
            }

            // ⭐ 파일 메타데이터 변경 시 선택적 캐시 무효화
            // metadataCache.on('changed')는 파싱 완료 후 발생하므로 태그/링크 검색에 안전
            if (this.app.metadataCache && typeof this.app.metadataCache.on === 'function') {
                this.app.metadataCache.on('changed', (file) => {
                    if (file instanceof TFile) {
                        this.invalidateCacheForFile(file);
                    }
                });
            }
        } catch (error) {
            // 테스트 환경이나 특수한 상황에서 이벤트 리스너 등록 실패 시
            // 경고만 출력하고 계속 진행
            this.logger.warn('Search', t().searchEngine.cacheInvalidationFailed, error);
        }
    }

    /**
     * ⭐ 특정 파일과 관련된 캐시만 무효화합니다
     *
     * @param file - 변경된 파일
     */
    private invalidateCacheForFile(file: TFile): void {
        this.searchCache.invalidate(file.path);
    }

    /**
     * 검색 캐시를 지웁니다
     */
    clearCache(): void {
        this.searchCache.clear();
    }

    /**
     * 캐시 크기를 반환합니다 (테스트용)
     */
    getCacheSize(): number {
        return this.searchCache.size.total;
    }

    /**
     * 캐시 크기 상세 정보를 반환합니다
     */
    get size() {
        return this.searchCache.size;
    }

    /**
     * 캐시 통계를 반환합니다
     */
    getCacheStats() {
        return this.searchCache.getStats();
    }

    /**
     * 리소스 정리 (플러그인 언로드 시 호출)
     */
    destroy(): void {
        this.searchCache.destroy();
    }
    
    private generateSearchCacheKey(
        query: string,
        files: TFile[],
        caseSensitive: boolean
    ): string {
        const filesHash = files.slice(0, 10).map(f => f.path).join(',');
        return `${query}-${filesHash}-${caseSensitive}`;
    }
    
    /**
     * 파일을 검색합니다 (동기)
     * 
     * @param query - 검색어 또는 고급 검색 쿼리
     * @param files - 검색할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 검색 결과
     * 
     * @remarks
     * line: 검색은 지원하지 않습니다. 파일 본문 검색이 필요하면 async search()를 사용하세요.
     */
    searchSync(query: string, files: TFile[], caseSensitive: boolean = false): TFile[] {
        if (!query || query.trim() === '') {
            return files;
        }
        
        if (this.parser.isAdvancedSearch(query)) {
            return this.advancedSearchSync(query, files, caseSensitive);
        }
        
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        return files.filter(file => this.searchInFile(searchQuery, file, caseSensitive));
    }
    
    /**
     * ⭐ 파일을 검색하고 페이지네이션된 결과를 반환합니다 (Phase 3.4)
     *
     * @param query - 검색어 또는 고급 검색 쿼리
     * @param files - 검색할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @param pageSize - 페이지 크기 (기본: 100, 0이면 페이지네이션 사용 안 함)
     * @returns 페이지네이션된 검색 결과
     *
     * @remarks
     * pageSize > 0이면 PaginatedSearchResult를 반환하여 대량 결과를 효율적으로 처리합니다.
     * pageSize === 0이면 기존처럼 전체 결과를 한 번에 반환합니다.
     */
    async searchPaginated(
        query: string,
        files: TFile[],
        caseSensitive: boolean = false,
        pageSize: number = 100
    ): Promise<PaginatedSearchResult> {
        const results = await this.search(query, files, caseSensitive);
        return new PaginatedSearchResult(results, pageSize, this.logger);
    }

    /**
     * 파일을 검색합니다 (비동기)
     *
     * @param query - 검색어 또는 고급 검색 쿼리
     * @param files - 검색할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 검색 결과
     *
     * @remarks
     * 파일 본문을 직접 읽어서 검색하므로 동기 버전보다 정확하지만 느립니다.
     * 검색 결과는 3단계 캐시에 저장되어 재사용됩니다.
     */
    async search(query: string, files: TFile[], caseSensitive: boolean = false): Promise<TFile[]> {
        if (!query || query.trim() === '') {
            return files;
        }

        const cacheKey = this.generateSearchCacheKey(query, files, caseSensitive);

        // L3 캐시를 위한 SearchQuery 추출 (고급 검색인 경우)
        let searchQuery: SearchQuery | undefined;
        if (this.parser.isAdvancedSearch(query)) {
            const parsed = this.parser.parse(query);
            // 단순 검색 쿼리인 경우에만 L3 캐시 사용
            if (parsed.type === 'search' && parsed.search) {
                searchQuery = parsed.search;
            }
        }

        // 캐시 조회 (L1 → L2 → L3)
        const cached = this.searchCache.get(cacheKey, searchQuery, files);
        if (cached !== undefined) {
            return cached;
        }

        // 캐시 미스 - 실제 검색 실행
        let results: TFile[];

        if (this.isRegexQuery(query)) {
            try {
                results = await this.searchWithRegex(query, files);
            } catch (error) {
                this.logger.error('Search', t().searchEngine.regexError, error);
                results = [];
            }
        } else if (this.parser.isAdvancedSearch(query)) {
            results = await this.advancedSearch(query, files, caseSensitive);
        } else {
            const searchQueryStr = caseSensitive ? query : query.toLowerCase();
            results = [];

            for (const file of files) {
                const found = await this.searchInFileAsync(searchQueryStr, file, caseSensitive);
                if (found) {
                    results.push(file);
                }
            }
        }

        // 결과를 캐시에 저장
        this.searchCache.set(cacheKey, results);
        return results;
    }
    
    /**
     * 정규식 쿼리인지 확인합니다
     * 
     * @param query - 검색어
     * @returns /pattern/ 또는 /pattern/flags 형식이면 true
     */
    isRegexQuery(query: string): boolean {
        return /^\/(.+?)\/([gimuy]*)$/.test(query.trim());
    }
    
    private parseRegexQuery(query: string): { pattern: string, flags: string } {
        const match = query.trim().match(/^\/(.+?)\/([gimuy]*)$/);

        if (!match) {
            throw new Error(t().searchEngine.invalidRegexFormat);
        }

        return {
            pattern: match[1],
            flags: match[2] || ''
        };
    }
    
    /**
     * 정규식으로 파일을 검색합니다
     * 
     * @param query - 정규식 쿼리 (/pattern/flags)
     * @param files - 검색할 파일 목록
     * @returns 매칭된 파일
     * 
     * @example
     * ```typescript
     * // TODO로 시작하는 라인 찾기
     * await search('/^TODO/', files);
     * 
     * // 날짜 형식 찾기
     * await search('/\\d{4}-\\d{2}-\\d{2}/', files);
     * 
     * // 내부 링크 찾기
     * await search('/\\[\\[.*\\]\\]/', files);
     * ```
     */
    async searchWithRegex(query: string, files: TFile[]): Promise<TFile[]> {
        const { pattern, flags } = this.parseRegexQuery(query);
        
        let regex: RegExp;
        try {
            regex = new RegExp(pattern, flags);
        } catch (error) {
            throw new Error(t().searchEngine.regexCreateError(String(error)));
        }
        
        const results: TFile[] = [];
        
        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                
                if (regex.test(content)) {
                    results.push(file);
                }
            } catch (error) {
                this.logger.error('Search', t().searchEngine.regexSearchError, { path: file.path, error });
            }
        }
        
        return results;
    }
    
    /**
     * 고급 검색을 수행합니다 (동기)
     */
    private advancedSearchSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        const parsed = this.parser.parse(query);
        return this.evaluateQuerySync(files, parsed, caseSensitive);
    }

    /**
     * ParsedQuery 트리를 평가하여 파일을 필터링합니다 (동기)
     *
     * @param files - 필터링할 파일 목록
     * @param query - 파싱된 쿼리 트리
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 필터링된 파일
     */
    private evaluateQuerySync(
        files: TFile[],
        query: ParsedQuery,
        caseSensitive: boolean
    ): TFile[] {
        const effectiveCaseSensitive = query.caseSensitive ?? caseSensitive;

        if (query.type === 'operator') {
            switch (query.operator) {
                case 'AND': {
                    const leftResults = this.evaluateQuerySync(files, query.left!, effectiveCaseSensitive);
                    const rightResults = this.evaluateQuerySync(files, query.right!, effectiveCaseSensitive);
                    return this.intersect(leftResults, rightResults);
                }
                case 'OR': {
                    const leftResults = this.evaluateQuerySync(files, query.left!, effectiveCaseSensitive);
                    const rightResults = this.evaluateQuerySync(files, query.right!, effectiveCaseSensitive);
                    return this.union(leftResults, rightResults);
                }
                case 'NOT': {
                    const rightResults = this.evaluateQuerySync(files, query.right!, effectiveCaseSensitive);
                    return this.exclude(files, rightResults);
                }
                default:
                    return files;
            }
        }

        if (query.search) {
            return this.filterByQuerySync(files, query.search, effectiveCaseSensitive);
        }

        return files;
    }
    
    /**
     * 고급 검색을 수행합니다 (비동기)
     */
    private async advancedSearch(query: string, files: TFile[], caseSensitive: boolean): Promise<TFile[]> {
        const parsed = this.parser.parse(query);
        return await this.evaluateQuery(files, parsed, caseSensitive);
    }

    /**
     * ParsedQuery 트리를 평가하여 파일을 필터링합니다
     *
     * @param files - 필터링할 파일 목록
     * @param query - 파싱된 쿼리 트리
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 필터링된 파일
     */
    private async evaluateQuery(
        files: TFile[],
        query: ParsedQuery,
        caseSensitive: boolean
    ): Promise<TFile[]> {
        // 쿼리에 caseSensitive 플래그가 있으면 우선 사용
        const effectiveCaseSensitive = query.caseSensitive ?? caseSensitive;

        if (query.type === 'operator') {
            switch (query.operator) {
                case 'AND': {
                    const leftResults = await this.evaluateQuery(files, query.left!, effectiveCaseSensitive);
                    const rightResults = await this.evaluateQuery(files, query.right!, effectiveCaseSensitive);
                    return this.intersect(leftResults, rightResults);
                }
                case 'OR': {
                    const leftResults = await this.evaluateQuery(files, query.left!, effectiveCaseSensitive);
                    const rightResults = await this.evaluateQuery(files, query.right!, effectiveCaseSensitive);
                    return this.union(leftResults, rightResults);
                }
                case 'NOT': {
                    const rightResults = await this.evaluateQuery(files, query.right!, effectiveCaseSensitive);
                    return this.exclude(files, rightResults);
                }
                default:
                    return files;
            }
        }

        // 리프 노드: 실제 검색 수행
        if (query.search) {
            return await this.filterByQuery(files, query.search, effectiveCaseSensitive);
        }

        return files;
    }

    /**
     * 두 파일 목록의 교집합을 반환합니다 (AND 연산)
     *
     * @param a - 첫 번째 파일 목록
     * @param b - 두 번째 파일 목록
     * @returns 교집합
     */
    private intersect(a: TFile[], b: TFile[]): TFile[] {
        const bPaths = new Set(b.map(f => f.path));
        return a.filter(file => bPaths.has(file.path));
    }

    /**
     * 두 파일 목록의 합집합을 반환합니다 (OR 연산)
     *
     * @param a - 첫 번째 파일 목록
     * @param b - 두 번째 파일 목록
     * @returns 합집합 (중복 제거)
     */
    private union(a: TFile[], b: TFile[]): TFile[] {
        const pathSet = new Set(a.map(f => f.path));
        const result = [...a];

        for (const file of b) {
            if (!pathSet.has(file.path)) {
                result.push(file);
                pathSet.add(file.path);
            }
        }

        return result;
    }

    /**
     * 차집합을 반환합니다 (NOT 연산)
     *
     * @param all - 전체 파일 목록
     * @param exclude - 제외할 파일 목록
     * @returns all에서 exclude를 뺀 결과
     */
    private exclude(all: TFile[], exclude: TFile[]): TFile[] {
        const excludePaths = new Set(exclude.map(f => f.path));
        return all.filter(file => !excludePaths.has(file.path));
    }
    
    /**
     * 검색 쿼리로 파일을 필터링합니다 (동기)
     */
    private filterByQuerySync(files: TFile[], query: SearchQuery, caseSensitive: boolean): TFile[] {
        switch (query.type) {
            case 'path':
                return this.filterByPath(files, query.value, caseSensitive);

            case 'file':
                return this.filterByFile(files, query.value, caseSensitive);

            case 'tag':
                return this.filterByTag(files, query.value);

            case 'line':
                this.logger.warn('Search', t().searchEngine.lineSearchUnsupported);
                return files;

            case 'section':
                return this.filterBySection(files, query.value, caseSensitive);

            case 'property':
                return this.filterByProperty(files, query.propertyName!, query.value, caseSensitive);

            case 'created':
                return this.filterByCreatedDate(files, query.value);

            case 'modified':
                return this.filterByModifiedDate(files, query.value);

            case 'task':
            case 'task-todo':
            case 'task-done':
            case 'block':
            case 'content':
                this.logger.warn('Search', t().searchEngine.unsupportedSearchType(query.type));
                return files;

            case 'link':
                return this.filterByLink(files, query.value);

            case 'outgoing-link':
                return this.filterByOutgoingLink(files, query.value);

            case 'text':
            default: {
                const searchQuery = caseSensitive ? query.value : query.value.toLowerCase();
                return files.filter(file => this.searchInFile(searchQuery, file, caseSensitive));
            }
        }
    }
    
    /**
     * 검색 쿼리로 파일을 필터링합니다 (비동기)
     */
    private async filterByQuery(files: TFile[], query: SearchQuery, caseSensitive: boolean): Promise<TFile[]> {
        switch (query.type) {
            case 'path':
                return this.filterByPath(files, query.value, caseSensitive);

            case 'file':
                return this.filterByFile(files, query.value, caseSensitive);

            case 'tag':
                return this.filterByTag(files, query.value);

            case 'line':
                return await this.filterByLine(files, query.value, caseSensitive);

            case 'section':
                return this.filterBySection(files, query.value, caseSensitive);

            case 'property':
                return this.filterByProperty(files, query.propertyName!, query.value, caseSensitive);

            case 'created':
                return this.filterByCreatedDate(files, query.value);

            case 'modified':
                return this.filterByModifiedDate(files, query.value);

            case 'task':
                return await this.filterByTask(files, query.value, 'all', caseSensitive);

            case 'task-todo':
                return await this.filterByTask(files, query.value, 'todo', caseSensitive);

            case 'task-done':
                return await this.filterByTask(files, query.value, 'done', caseSensitive);

            case 'block':
                return await this.filterByBlock(files, query.value, caseSensitive);

            case 'content':
                return await this.filterByContent(files, query.value, caseSensitive);

            case 'link':
                return this.filterByLink(files, query.value);

            case 'outgoing-link':
                return this.filterByOutgoingLink(files, query.value);

            case 'text':
            default: {
                const searchQuery = caseSensitive ? query.value : query.value.toLowerCase();
                const results: TFile[] = [];

                for (const file of files) {
                    const found = await this.searchInFileAsync(searchQuery, file, caseSensitive);
                    if (found) {
                        results.push(file);
                    }
                }

                return results;
            }
        }
    }
    
    /**
     * 경로로 파일을 필터링합니다
     *
     * @param files - 필터링할 파일 목록
     * @param path - 검색할 폴더 경로 (Wildcard * 와 ? 지원)
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 필터링된 파일
     *
     * @remarks
     * - 파일의 폴더 경로만 검색하며 파일명은 제외됩니다
     * - Wildcard: * (0개 이상 문자), ? (정확히 1개 문자)
     * - 퍼지 검색이 활성화된 경우 유사한 경로도 매칭합니다
     */
    private filterByPath(files: TFile[], path: string, caseSensitive: boolean): TFile[] {
        // Wildcard 포함 여부 확인
        if (this.hasWildcard(path)) {
            const regex = this.wildcardToRegex(path, caseSensitive);
            return files.filter(file => {
                const folderPath = file.parent?.path || '';
                return regex.test(folderPath);
            });
        }

        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const searchPath = caseSensitive ? path : path.toLowerCase();

        return files.filter(file => {
            const folderPath = file.parent?.path || '';
            const comparePath = caseSensitive ? folderPath : folderPath.toLowerCase();

            if (useFuzzy) {
                const match = fuzzyMatch(searchPath, comparePath, {
                    caseSensitive,
                    threshold: fuzzyThreshold
                });
                return match.matched;
            } else {
                return comparePath.includes(searchPath);
            }
        });
    }
    
    /**
     * 파일명으로 파일을 필터링합니다
     *
     * @param files - 필터링할 파일 목록
     * @param filename - 검색할 파일명 (Wildcard * 와 ? 지원)
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 필터링된 파일
     *
     * @remarks
     * - Wildcard: * (0개 이상 문자), ? (정확히 1개 문자)
     * - 퍼지 검색이 활성화된 경우 유사한 파일명도 매칭합니다
     */
    private filterByFile(files: TFile[], filename: string, caseSensitive: boolean): TFile[] {
        // Wildcard 포함 여부 확인
        if (this.hasWildcard(filename)) {
            const regex = this.wildcardToRegex(filename, caseSensitive);
            return files.filter(file => regex.test(file.basename));
        }

        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const searchFilename = caseSensitive ? filename : filename.toLowerCase();

        return files.filter(file => {
            const basename = caseSensitive ? file.basename : file.basename.toLowerCase();

            if (useFuzzy) {
                const match = fuzzyMatch(searchFilename, basename, {
                    caseSensitive,
                    threshold: fuzzyThreshold
                });
                return match.matched;
            } else {
                return basename.includes(searchFilename);
            }
        });
    }
    
    /**
     * 태그로 파일을 필터링합니다
     *
     * @remarks
     * 프론트매터 태그와 인라인 태그를 모두 검색합니다.
     * 퍼지 검색이 활성화된 경우 유사한 태그도 매칭합니다.
     */
    private filterByTag(files: TFile[], tag: string): TFile[] {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;

        return files.filter(file => {
            // 에러 핸들링
            let cache;
            try {
                cache = this.app.metadataCache.getFileCache(file);
            } catch (error) {
                this.logger.error('Search', t().searchEngine.cacheAccessError, { path: file.path, error });
                return false;
            }
            if (!cache) return false;

            const frontmatterTags = cache.frontmatter?.tags ?? [];
            if (Array.isArray(frontmatterTags)) {
                if (frontmatterTags.some(t => {
                    const tagStr = String(t);
                    if (useFuzzy) {
                        // Try matching with and without #
                        const match1 = fuzzyMatch(tag, tagStr, {
                            caseSensitive: false,
                            threshold: fuzzyThreshold
                        });
                        const match2 = fuzzyMatch(tag.substring(1), tagStr, {
                            caseSensitive: false,
                            threshold: fuzzyThreshold
                        });
                        return match1.matched || match2.matched;
                    } else {
                        return tagStr === tag || tagStr === tag.substring(1);
                    }
                })) {
                    return true;
                }
            } else if (typeof frontmatterTags === 'string') {
                if (useFuzzy) {
                    const match1 = fuzzyMatch(tag, frontmatterTags, {
                        caseSensitive: false,
                        threshold: fuzzyThreshold
                    });
                    const match2 = fuzzyMatch(tag.substring(1), frontmatterTags, {
                        caseSensitive: false,
                        threshold: fuzzyThreshold
                    });
                    if (match1.matched || match2.matched) {
                        return true;
                    }
                } else {
                    if (frontmatterTags === tag || frontmatterTags === tag.substring(1)) {
                        return true;
                    }
                }
            }

            if (cache.tags) {
                return cache.tags.some(t => {
                    if (useFuzzy) {
                        const match = fuzzyMatch(tag, t.tag, {
                            caseSensitive: false,
                            threshold: fuzzyThreshold
                        });
                        return match.matched;
                    } else {
                        return t.tag === tag;
                    }
                });
            }

            return false;
        });
    }
    
    /**
     * 라인 내용으로 파일을 필터링합니다
     */
    private async filterByLine(files: TFile[], lineContent: string, caseSensitive: boolean): Promise<TFile[]> {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const results: TFile[] = [];
        const searchContent = caseSensitive ? lineContent : lineContent.toLowerCase();

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const lines = content.split('\n');

                const found = lines.some(line => {
                    const searchLine = caseSensitive ? line : line.toLowerCase();

                    // 퍼지 검색 적용
                    if (useFuzzy) {
                        const match = fuzzyMatch(searchContent, searchLine, {
                            caseSensitive,
                            threshold: fuzzyThreshold
                        });
                        if (match.matched) return true;
                    }

                    return searchLine.includes(searchContent);
                });

                if (found) {
                    results.push(file);
                }
            } catch (error) {
                this.logger.error('Search', t().searchEngine.lineSearchError, { path: file.path, error });
            }
        }

        return results;
    }
    
    /**
     * 섹션(헤더) 제목으로 파일을 필터링합니다
     *
     * @remarks
     * 퍼지 검색이 활성화된 경우 유사한 헤더도 매칭합니다.
     */
    private filterBySection(files: TFile[], sectionTitle: string, caseSensitive: boolean): TFile[] {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const searchTitle = caseSensitive ? sectionTitle : sectionTitle.toLowerCase();

        return files.filter(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache?.headings) return false;

            return cache.headings.some(heading => {
                const headingText = caseSensitive ? heading.heading : heading.heading.toLowerCase();

                if (useFuzzy) {
                    const match = fuzzyMatch(searchTitle, headingText, {
                        caseSensitive,
                        threshold: fuzzyThreshold
                    });
                    return match.matched;
                } else {
                    return headingText.includes(searchTitle);
                }
            });
        });
    }
    
    /**
     * 프론트매터 속성으로 파일을 필터링합니다
     */
    private filterByProperty(files: TFile[], propertyName: string, propertyValue: string, caseSensitive: boolean): TFile[] {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const searchValue = caseSensitive ? propertyValue : propertyValue.toLowerCase();

        return files.filter(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache?.frontmatter) return false;

            const value = cache.frontmatter[propertyName];
            if (value == null) return false;

            if (Array.isArray(value)) {
                return value.some(v => {
                    const strValue = caseSensitive ? String(v) : String(v).toLowerCase();

                    // 퍼지 검색 적용
                    if (useFuzzy) {
                        const match = fuzzyMatch(searchValue, strValue, {
                            caseSensitive,
                            threshold: fuzzyThreshold
                        });
                        if (match.matched) return true;
                    }

                    return strValue === searchValue || strValue.includes(searchValue);
                });
            }

            const strValue = caseSensitive ? String(value) : String(value).toLowerCase();

            // 퍼지 검색 적용
            if (useFuzzy) {
                const match = fuzzyMatch(searchValue, strValue, {
                    caseSensitive,
                    threshold: fuzzyThreshold
                });
                if (match.matched) return true;
            }

            return strValue === searchValue || strValue.includes(searchValue);
        });
    }
    
    /**
     * 생성일로 파일을 필터링합니다
     * 
     * @param dateStr - YYYY-MM-DD 또는 YYYY-MM-DD..YYYY-MM-DD (범위)
     */
    private filterByCreatedDate(files: TFile[], dateStr: string): TFile[] {
        if (dateStr.includes('..')) {
            const range = this.parser.parseDateRange(dateStr);
            if (!range) return files;
            
            const [start, end] = range;
            
            return files.filter(file => {
                const fileDate = new Date(file.stat.ctime);
                return fileDate >= start && fileDate <= end;
            });
        }
        
        const date = this.parser.parseDate(dateStr);
        if (!date) return files;
        
        return files.filter(file => {
            const fileDate = new Date(file.stat.ctime);
            return fileDate.toDateString() === date.toDateString();
        });
    }
    
    /**
     * 수정일로 파일을 필터링합니다
     *
     * @param dateStr - YYYY-MM-DD 또는 YYYY-MM-DD..YYYY-MM-DD (범위)
     */
    private filterByModifiedDate(files: TFile[], dateStr: string): TFile[] {
        if (dateStr.includes('..')) {
            const range = this.parser.parseDateRange(dateStr);
            if (!range) return files;

            const [start, end] = range;

            return files.filter(file => {
                const fileDate = new Date(file.stat.mtime);
                return fileDate >= start && fileDate <= end;
            });
        }

        const date = this.parser.parseDate(dateStr);
        if (!date) return files;

        return files.filter(file => {
            const fileDate = new Date(file.stat.mtime);
            return fileDate.toDateString() === date.toDateString();
        });
    }

    /**
     * 태스크로 파일을 필터링합니다
     *
     * @param files - 필터링할 파일 목록
     * @param taskContent - 태스크 내용 검색어 (선택적)
     * @param status - 태스크 상태 ('all' | 'todo' | 'done')
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 필터링된 파일
     *
     * @remarks
     * - [ ] 형식의 미완료 태스크
     * - [x] 또는 [X] 형식의 완료 태스크를 검색합니다
     */
    private async filterByTask(
        files: TFile[],
        taskContent: string,
        status: 'all' | 'todo' | 'done',
        caseSensitive: boolean
    ): Promise<TFile[]> {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const results: TFile[] = [];
        const searchContent = caseSensitive ? taskContent : taskContent.toLowerCase();

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const lines = content.split('\n');

                let hasMatch = false;
                for (const line of lines) {
                    if (this.isTask(line, status)) {
                        // taskContent가 비어있으면 모든 태스크 매칭
                        if (!taskContent || taskContent.trim() === '') {
                            hasMatch = true;
                            break;
                        }

                        // taskContent가 있으면 내용 검색
                        const lineToSearch = caseSensitive ? line : line.toLowerCase();

                        // 퍼지 검색 적용
                        if (useFuzzy) {
                            const match = fuzzyMatch(searchContent, lineToSearch, {
                                caseSensitive,
                                threshold: fuzzyThreshold
                            });
                            if (match.matched) {
                                hasMatch = true;
                                break;
                            }
                        }

                        if (lineToSearch.includes(searchContent)) {
                            hasMatch = true;
                            break;
                        }
                    }
                }

                if (hasMatch) {
                    results.push(file);
                }
            } catch (error) {
                this.logger.error('Search', t().searchEngine.taskSearchError, { path: file.path, error });
            }
        }

        return results;
    }

    /**
     * 라인이 태스크인지 확인합니다
     *
     * @param line - 검사할 라인
     * @param status - 태스크 상태
     * @returns 태스크이면 true
     */
    private isTask(line: string, status: 'all' | 'todo' | 'done'): boolean {
        // - [ ] 미완료 태스크
        // - [x] 완료 태스크
        // - [X] 완료 태스크
        const taskRegex = /^\s*-\s+\[([ xX])\]/;
        const match = line.match(taskRegex);

        if (!match) return false;

        const checkMark = match[1];
        const isDone = checkMark !== ' ';

        if (status === 'all') return true;
        if (status === 'todo') return !isDone;
        if (status === 'done') return isDone;

        return false;
    }

    /**
     * 블록으로 파일을 필터링합니다
     *
     * @param files - 필터링할 파일 목록
     * @param blockContent - 블록 내용 검색어
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 필터링된 파일
     *
     * @remarks
     * Obsidian의 블록 ID (^block-id) 기능을 활용합니다
     */
    private async filterByBlock(
        files: TFile[],
        blockContent: string,
        caseSensitive: boolean
    ): Promise<TFile[]> {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const results: TFile[] = [];
        const searchContent = caseSensitive ? blockContent : blockContent.toLowerCase();

        for (const file of files) {
            try {
                const cache = this.app.metadataCache.getFileCache(file);

                if (!cache?.blocks) continue;

                const content = await this.app.vault.read(file);
                const lines = content.split('\n');

                for (const blockId in cache.blocks) {
                    const block = cache.blocks[blockId];
                    const lineIndex = block.position.start.line;

                    if (lineIndex >= 0 && lineIndex < lines.length) {
                        const blockLine = lines[lineIndex];
                        const lineToSearch = caseSensitive ? blockLine : blockLine.toLowerCase();

                        // blockContent가 비어있으면 모든 블록 매칭
                        if (!blockContent || blockContent.trim() === '') {
                            results.push(file);
                            break;
                        }

                        // 퍼지 검색 적용
                        if (useFuzzy) {
                            const match = fuzzyMatch(searchContent, lineToSearch, {
                                caseSensitive,
                                threshold: fuzzyThreshold
                            });
                            if (match.matched) {
                                results.push(file);
                                break;
                            }
                        }

                        if (lineToSearch.includes(searchContent)) {
                            results.push(file);
                            break;
                        }
                    }
                }
            } catch (error) {
                this.logger.error('Search', t().searchEngine.blockSearchError, { path: file.path, error });
            }
        }

        return results;
    }

    /**
     * 본문 내용으로 파일을 필터링합니다
     *
     * @param files - 필터링할 파일 목록
     * @param content - 검색할 내용
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 필터링된 파일
     *
     * @remarks
     * 프론트매터를 제외한 본문만 검색합니다
     */
    private async filterByContent(
        files: TFile[],
        content: string,
        caseSensitive: boolean
    ): Promise<TFile[]> {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const results: TFile[] = [];
        const searchContent = caseSensitive ? content : content.toLowerCase();

        for (const file of files) {
            try {
                const fileContent = await this.app.vault.read(file);

                // 프론트매터 제거
                let bodyContent = fileContent;
                if (fileContent.startsWith('---')) {
                    const secondDelimiter = fileContent.indexOf('\n---', 1);
                    if (secondDelimiter !== -1) {
                        bodyContent = fileContent.substring(secondDelimiter + 4);
                    }
                }

                const contentToSearch = caseSensitive ? bodyContent : bodyContent.toLowerCase();

                // 퍼지 검색 적용
                if (useFuzzy) {
                    const match = fuzzyMatch(searchContent, contentToSearch, {
                        caseSensitive,
                        threshold: fuzzyThreshold
                    });
                    if (match.matched) {
                        results.push(file);
                        continue;
                    }
                }

                if (contentToSearch.includes(searchContent)) {
                    results.push(file);
                }
            } catch (error) {
                this.logger.error('Search', t().searchEngine.contentSearchError, { path: file.path, error });
            }
        }

        return results;
    }

    /**
     * 링크로 파일을 필터링합니다
     *
     * @param files - 필터링할 파일 목록
     * @param targetFile - 대상 파일명
     * @returns targetFile을 링크한 파일들
     *
     * @remarks
     * 파일이 targetFile로의 링크를 포함하는지 검사합니다
     */
    private filterByLink(files: TFile[], targetFile: string): TFile[] {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;

        return files.filter(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache?.links) return false;

            return cache.links.some(link => {
                const linkPath = link.link;

                // 퍼지 검색 적용
                if (useFuzzy) {
                    // 링크 경로에서 파일명만 추출
                    const linkFilename = linkPath.split('/').pop() || linkPath;
                    const match = fuzzyMatch(targetFile, linkFilename, {
                        caseSensitive: false,
                        threshold: fuzzyThreshold
                    });
                    if (match.matched) return true;
                }

                // 확장자 없이도 매칭
                return linkPath === targetFile ||
                       linkPath === targetFile + '.md' ||
                       linkPath.endsWith('/' + targetFile) ||
                       linkPath.endsWith('/' + targetFile + '.md');
            });
        });
    }

    /**
     * 역링크로 파일을 필터링합니다
     *
     * @param files - 필터링할 파일 목록
     * @param targetFile - 대상 파일명
     * @returns targetFile이 링크한 파일들 (backlinks)
     *
     * @remarks
     * targetFile에서 나가는 링크를 포함한 파일들을 찾습니다
     */
    private filterByOutgoingLink(files: TFile[], targetFile: string): TFile[] {
        // targetFile에 해당하는 TFile 찾기
        const target = this.app.vault.getAbstractFileByPath(targetFile);
        if (!(target instanceof TFile)) {
            // 확장자 없이 시도
            const targetWithExt = this.app.vault.getAbstractFileByPath(targetFile + '.md');
            if (!(targetWithExt instanceof TFile)) {
                return [];
            }
            return this.getBacklinks(targetWithExt as TFile, files);
        }

        return this.getBacklinks(target, files);
    }

    /**
     * 파일의 백링크를 가져옵니다
     */
    private getBacklinks(target: TFile, files: TFile[]): TFile[] {
        // Obsidian API의 resolvedLinks를 사용하여 백링크 찾기
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        const backlinkPaths = new Set<string>();

        // 모든 파일을 순회하면서 target을 링크하는 파일 찾기
        for (const sourcePath in resolvedLinks) {
            const links = resolvedLinks[sourcePath];
            if (links && links[target.path]) {
                backlinkPaths.add(sourcePath);
            }
        }

        return files.filter(file => backlinkPaths.has(file.path));
    }

    /**
     * Wildcard 문자 포함 여부 확인
     *
     * @param pattern - 검사할 패턴
     * @returns Wildcard 문자(* 또는 ?)가 포함되어 있으면 true
     */
    private hasWildcard(pattern: string): boolean {
        return pattern.includes('*') || pattern.includes('?');
    }

    /**
     * Wildcard 패턴을 정규식으로 변환합니다
     *
     * @param pattern - Wildcard 패턴
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 정규식 객체
     *
     * @remarks
     * - * → .* (0개 이상의 모든 문자)
     * - ? → . (정확히 1개의 문자)
     * - 정규식 특수 문자는 이스케이프됩니다
     *
     * @example
     * ```typescript
     * wildcardToRegex('2025*', false)    // /^2025.*$/i
     * wildcardToRegex('note-??', false)  // /^note-..$/i
     * wildcardToRegex('*.md', true)      // /^.*\.md$/
     * ```
     */
    private wildcardToRegex(pattern: string, caseSensitive: boolean): RegExp {
        // 정규식 특수 문자 이스케이프 (*, ? 제외)
        let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

        // Wildcard를 정규식으로 변환
        regexPattern = regexPattern
            .replace(/\*/g, '.*')   // * → .*
            .replace(/\?/g, '.');   // ? → .

        // 완전 매칭을 위해 ^ 와 $ 추가
        regexPattern = '^' + regexPattern + '$';

        const flags = caseSensitive ? '' : 'i';
        return new RegExp(regexPattern, flags);
    }
    
    /**
     * 파일을 검색합니다 (비동기, 본문 포함)
     *
     * @remarks
     * 파일명, 경로, 본문, 헤더, 태그, 링크를 모두 검색합니다.
     * 퍼지 검색이 활성화된 경우 유사 문자열도 매칭합니다.
     */
    private async searchInFileAsync(query: string, file: TFile, caseSensitive: boolean): Promise<boolean> {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;

        const filename = caseSensitive ? file.basename : file.basename.toLowerCase();
        if (useFuzzy) {
            const match = fuzzyMatch(query, filename, {
                caseSensitive,
                threshold: fuzzyThreshold
            });
            if (match.matched) {
                return true;
            }
        } else {
            if (filename.includes(query)) {
                return true;
            }
        }

        const filepath = caseSensitive ? file.path : file.path.toLowerCase();
        if (useFuzzy) {
            const match = fuzzyMatch(query, filepath, {
                caseSensitive,
                threshold: fuzzyThreshold
            });
            if (match.matched) {
                return true;
            }
        } else {
            if (filepath.includes(query)) {
                return true;
            }
        }

        try {
            const content = await this.app.vault.read(file);
            const searchContent = caseSensitive ? content : content.toLowerCase();

            if (useFuzzy) {
                const match = fuzzyMatch(query, searchContent, {
                    caseSensitive,
                    threshold: fuzzyThreshold
                });
                if (match.matched) {
                    return true;
                }
            } else {
                if (searchContent.includes(query)) {
                    return true;
                }
            }
        } catch (error) {
            this.logger.error('Search', t().searchEngine.fileReadError, { path: file.path, error });
        }

        const cache = this.app.metadataCache.getFileCache(file);

        if (cache?.headings) {
            for (const heading of cache.headings) {
                const headingText = caseSensitive ? heading.heading : heading.heading.toLowerCase();
                if (useFuzzy) {
                    const match = fuzzyMatch(query, headingText, {
                        caseSensitive,
                        threshold: fuzzyThreshold
                    });
                    if (match.matched) {
                        return true;
                    }
                } else {
                    if (headingText.includes(query)) {
                        return true;
                    }
                }
            }
        }

        if (cache?.tags) {
            for (const tag of cache.tags) {
                const tagText = caseSensitive ? tag.tag : tag.tag.toLowerCase();
                if (useFuzzy) {
                    const match = fuzzyMatch(query, tagText, {
                        caseSensitive,
                        threshold: fuzzyThreshold
                    });
                    if (match.matched) {
                        return true;
                    }
                } else {
                    if (tagText.includes(query)) {
                        return true;
                    }
                }
            }
        }

        if (cache?.links) {
            for (const link of cache.links) {
                const linkText = caseSensitive ? link.displayText || link.link : (link.displayText || link.link).toLowerCase();
                if (useFuzzy) {
                    const match = fuzzyMatch(query, linkText, {
                        caseSensitive,
                        threshold: fuzzyThreshold
                    });
                    if (match.matched) {
                        return true;
                    }
                } else {
                    if (linkText.includes(query)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
    
    /**
     * 파일을 검색합니다 (동기, 캐시만 사용)
     *
     * @remarks
     * 파일 본문은 검색하지 않고 파일명, 경로, 캐시된 메타데이터만 검색합니다.
     * 본문 검색이 필요하면 searchInFileAsync()를 사용하세요.
     * 퍼지 검색이 활성화된 경우 유사 문자열도 매칭합니다.
     */
    private searchInFile(query: string, file: TFile, caseSensitive: boolean): boolean {
        // null 체크
        if (!file) {
            return false;
        }

        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;

        const filename = caseSensitive ? file.basename : file.basename.toLowerCase();
        if (useFuzzy) {
            const match = fuzzyMatch(query, filename, {
                caseSensitive,
                threshold: fuzzyThreshold
            });
            if (match.matched) {
                return true;
            }
        } else {
            if (filename.includes(query)) {
                return true;
            }
        }

        const filepath = caseSensitive ? file.path : file.path.toLowerCase();
        if (useFuzzy) {
            const match = fuzzyMatch(query, filepath, {
                caseSensitive,
                threshold: fuzzyThreshold
            });
            if (match.matched) {
                return true;
            }
        } else {
            if (filepath.includes(query)) {
                return true;
            }
        }

        // 에러 핸들링
        let cache;
        try {
            cache = this.app.metadataCache.getFileCache(file);
        } catch (error) {
            this.logger.error('Search', t().searchEngine.cacheAccessError, { path: file.path, error });
            return false;
        }

        if (cache?.headings) {
            for (const heading of cache.headings) {
                const headingText = caseSensitive ? heading.heading : heading.heading.toLowerCase();
                if (useFuzzy) {
                    const match = fuzzyMatch(query, headingText, {
                        caseSensitive,
                        threshold: fuzzyThreshold
                    });
                    if (match.matched) {
                        return true;
                    }
                } else {
                    if (headingText.includes(query)) {
                        return true;
                    }
                }
            }
        }

        if (cache?.tags) {
            for (const tag of cache.tags) {
                const tagText = caseSensitive ? tag.tag : tag.tag.toLowerCase();
                if (useFuzzy) {
                    const match = fuzzyMatch(query, tagText, {
                        caseSensitive,
                        threshold: fuzzyThreshold
                    });
                    if (match.matched) {
                        return true;
                    }
                } else {
                    if (tagText.includes(query)) {
                        return true;
                    }
                }
            }
        }

        if (cache?.links) {
            for (const link of cache.links) {
                const linkText = caseSensitive ? link.displayText || link.link : (link.displayText || link.link).toLowerCase();
                if (useFuzzy) {
                    const match = fuzzyMatch(query, linkText, {
                        caseSensitive,
                        threshold: fuzzyThreshold
                    });
                    if (match.matched) {
                        return true;
                    }
                } else {
                    if (linkText.includes(query)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
    
    /**
     * 텍스트에서 검색어를 하이라이트합니다
     * 
     * @param text - 원본 텍스트
     * @param query - 검색어
     * @param caseSensitive - 대소문자 구분 여부
     * @returns `<mark>` 태그로 감싼 HTML
     * 
     * @remarks
     * XSS 방지를 위해 textContent를 사용하거나 마크다운 렌더링 후 하이라이트하세요.
     */
    highlightText(text: string, query: string, caseSensitive: boolean = false): string {
        if (!query || query.trim() === '') {
            return text;
        }
        
        const flags = caseSensitive ? 'g' : 'gi';
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedQuery, flags);
        
        return text.replace(regex, (match) => `<mark>${match}</mark>`);
    }
    
    /**
     * 검색어 주변 컨텍스트를 추출합니다
     * 
     * @param file - 파일
     * @param query - 검색어
     * @param contextLength - 전후 컨텍스트 길이
     * @returns 컨텍스트 문자열 (없으면 null)
     * 
     * @remarks
     * 검색 결과 미리보기에 사용됩니다.
     */
    async getSearchContext(file: TFile, query: string, contextLength: number = 100): Promise<string | null> {
        try {
            const content = await this.app.vault.read(file);
            const lowerContent = content.toLowerCase();
            const lowerQuery = query.toLowerCase();
            
            const index = lowerContent.indexOf(lowerQuery);
            if (index === -1) {
                return null;
            }
            
            const start = Math.max(0, index - contextLength);
            const end = Math.min(content.length, index + query.length + contextLength);
            
            let context = content.substring(start, end);
            
            if (start > 0) {
                context = '...' + context;
            }
            if (end < content.length) {
                context = context + '...';
            }


            return context;
        } catch (error) {
            this.logger.error('Search', t().searchEngine.contextExtractionError, error);
            return null;
        }
    }
}

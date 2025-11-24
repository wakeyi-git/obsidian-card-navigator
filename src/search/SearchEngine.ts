import { TFile, App } from 'obsidian';
import { SearchQuery, ParsedQuery, CardNavigatorSettings } from '../types';
import { SearchParser } from './SearchParser';
import { PaginatedSearchResult } from './PaginatedSearchResult';
import { TieredCache } from './cache/TieredCache';
import { DebugLogger } from '../utils/DebugLogger';
import { t } from '../i18n';
import { fuzzyMatch } from '../utils/fuzzyMatch';
import { SearchStrategy } from './strategies/types';
import { PathSearchStrategy } from './strategies/PathSearchStrategy';
import { ContentSearchStrategy } from './strategies/ContentSearchStrategy';
import { TagSearchStrategy } from './strategies/TagSearchStrategy';
import { PropertySearchStrategy } from './strategies/PropertySearchStrategy';
import { RegexSearchStrategy } from './strategies/RegexSearchStrategy';
import { LineSearchStrategy } from './strategies/LineSearchStrategy';
import { SectionSearchStrategy } from './strategies/SectionSearchStrategy';
import { FileSearchStrategy } from './strategies/FileSearchStrategy';
import { TaskSearchStrategy } from './strategies/TaskSearchStrategy';
import { CreatedDateSearchStrategy } from './strategies/CreatedDateSearchStrategy';
import { ModifiedDateSearchStrategy } from './strategies/ModifiedDateSearchStrategy';
import { LinkSearchStrategy } from './strategies/LinkSearchStrategy';
import { OutgoingLinkSearchStrategy } from './strategies/OutgoingLinkSearchStrategy';
import { BlockSearchStrategy } from './strategies/BlockSearchStrategy';

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

    /** 검색 전략 레지스트리 */
    private strategies: Map<string, SearchStrategy>;

    /** Property 검색 전략 (propertyName 파라미터 필요) */
    private propertyStrategy: PropertySearchStrategy;

    /** Regex 검색 전략 */
    private regexStrategy: RegexSearchStrategy;

    /** Task 검색 전략 (status 파라미터 필요) */
    private taskStrategy: TaskSearchStrategy;

    constructor(app: App, logger: DebugLogger, getSettings: () => CardNavigatorSettings) {
        this.app = app;
        this.logger = logger;
        this.getSettings = getSettings;
        this.parser = new SearchParser();
        this.searchCache = new TieredCache(app, logger);
        this.strategies = new Map();

        const config = { app, logger, getSettings };
        this.propertyStrategy = new PropertySearchStrategy(config);
        this.regexStrategy = new RegexSearchStrategy(config);
        this.taskStrategy = new TaskSearchStrategy(config);

        this.registerDefaultStrategies();
        this.setupCacheInvalidation();
    }

    /**
     * 기본 검색 전략 등록
     */
    private registerDefaultStrategies(): void {
        const config = {
            app: this.app,
            logger: this.logger,
            getSettings: this.getSettings
        };

        // 기본 검색 전략
        this.registerStrategy('path', new PathSearchStrategy(config));
        this.registerStrategy('content', new ContentSearchStrategy(config));
        this.registerStrategy('tag', new TagSearchStrategy(config));
        this.registerStrategy('line', new LineSearchStrategy(config));
        this.registerStrategy('section', new SectionSearchStrategy(config));
        this.registerStrategy('file', new FileSearchStrategy(config));

        // 날짜 검색 전략 (Phase 5)
        this.registerStrategy('created', new CreatedDateSearchStrategy(config, this.parser));
        this.registerStrategy('modified', new ModifiedDateSearchStrategy(config, this.parser));

        // 링크 검색 전략 (Phase 5)
        this.registerStrategy('link', new LinkSearchStrategy(config));
        this.registerStrategy('outgoing-link', new OutgoingLinkSearchStrategy(config));

        // 블록 검색 전략 (Phase 5)
        this.registerStrategy('block', new BlockSearchStrategy(config));
    }

    /**
     * 커스텀 검색 전략 등록 (확장성)
     *
     * @param type - 검색 타입 (예: 'path', 'content', 'tag')
     * @param strategy - 검색 전략 인스턴스
     */
    registerStrategy(type: string, strategy: SearchStrategy): void {
        this.strategies.set(type, strategy);
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

        // 결과를 캐시에 저장 (검색 대상 파일 목록도 전달)
        this.searchCache.set(cacheKey, results, files);
        return results;
    }
    
    /**
     * 정규식 쿼리인지 확인합니다
     *
     * @param query - 검색어
     * @returns /pattern/ 또는 /pattern/flags 형식이면 true
     *
     * @remarks
     * RegexSearchStrategy를 사용합니다 (Phase 2)
     */
    isRegexQuery(query: string): boolean {
        return RegexSearchStrategy.isRegexQuery(query);
    }
    
    /**
     * 정규식으로 파일을 검색합니다
     *
     * @param query - 정규식 쿼리 (/pattern/flags)
     * @param files - 검색할 파일 목록
     * @returns 매칭된 파일
     *
     * @remarks
     * RegexSearchStrategy를 사용합니다 (Phase 2)
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
        return await this.regexStrategy.executeAsync(query, files, false);
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
     *
     * @remarks
     * Strategy Pattern을 사용하여 각 검색 타입을 처리합니다 (Phase 4)
     */
    private filterByQuerySync(files: TFile[], query: SearchQuery, caseSensitive: boolean): TFile[] {
        // 전략 패턴 사용 - 대부분의 검색 타입
        const strategy = this.strategies.get(query.type);
        if (strategy) {
            return strategy.executeSync(query.value, files, caseSensitive);
        }

        // 특수 케이스: property는 propertyName이 필요함
        if (query.type === 'property') {
            return this.filterByProperty(files, query.propertyName!, query.value, caseSensitive);
        }

        // 비동기 검색이 필요한 타입들 (동기 버전에서는 경고)
        if (query.type === 'task' || query.type === 'task-todo' || query.type === 'task-done') {
            this.logger.warn('Search', t().searchEngine.unsupportedSearchType(query.type));
            return files;
        }

        // 기본 텍스트 검색
        if (query.type === 'text') {
            const searchQuery = caseSensitive ? query.value : query.value.toLowerCase();
            return files.filter(file => this.searchInFile(searchQuery, file, caseSensitive));
        }

        // 알 수 없는 검색 타입
        this.logger.warn('Search', `Unknown search type: ${query.type}`);
        return files;
    }
    
    /**
     * 검색 쿼리로 파일을 필터링합니다 (비동기)
     *
     * @remarks
     * Strategy Pattern을 사용하여 각 검색 타입을 처리합니다 (Phase 4)
     */
    private async filterByQuery(files: TFile[], query: SearchQuery, caseSensitive: boolean): Promise<TFile[]> {
        // 전략 패턴 사용 - 대부분의 검색 타입
        const strategy = this.strategies.get(query.type);
        if (strategy) {
            return await strategy.executeAsync(query.value, files, caseSensitive);
        }

        // 특수 케이스: property는 propertyName이 필요함
        if (query.type === 'property') {
            return this.filterByProperty(files, query.propertyName!, query.value, caseSensitive);
        }

        // 특수 케이스: task는 status가 필요함
        if (query.type === 'task') {
            return await this.filterByTask(files, query.value, 'all', caseSensitive);
        }
        if (query.type === 'task-todo') {
            return await this.filterByTask(files, query.value, 'todo', caseSensitive);
        }
        if (query.type === 'task-done') {
            return await this.filterByTask(files, query.value, 'done', caseSensitive);
        }

        // 기본 텍스트 검색
        if (query.type === 'text') {
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

        // 알 수 없는 검색 타입
        this.logger.warn('Search', `Unknown search type: ${query.type}`);
        return files;
    }
    
    
    /**
     * 프론트매터 속성으로 파일을 필터링합니다
     *
     * @remarks
     * PropertySearchStrategy를 사용합니다 (Phase 2)
     */
    private filterByProperty(files: TFile[], propertyName: string, propertyValue: string, caseSensitive: boolean): TFile[] {
        return this.propertyStrategy.filterByProperty(files, propertyName, propertyValue, caseSensitive);
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
     * TaskSearchStrategy를 사용합니다 (Phase 3)
     * - [ ] 형식의 미완료 태스크
     * - [x] 또는 [X] 형식의 완료 태스크를 검색합니다
     */
    private async filterByTask(
        files: TFile[],
        taskContent: string,
        status: 'all' | 'todo' | 'done',
        caseSensitive: boolean
    ): Promise<TFile[]> {
        return await this.taskStrategy.filterByTask(files, taskContent, status, caseSensitive);
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

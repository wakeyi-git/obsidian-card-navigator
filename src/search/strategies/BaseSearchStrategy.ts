import { TFile, App } from 'obsidian';
import { SearchStrategy, SearchStrategyConfig } from './types';
import { CardNavigatorSettings } from '../../types';
import { DebugLogger } from '../../utils/DebugLogger';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 검색 전략 추상 클래스
 *
 * @remarks
 * 모든 검색 전략 클래스의 기본 클래스입니다.
 * 공통 유틸리티 메서드를 제공하여 코드 중복을 방지합니다.
 */
export abstract class BaseSearchStrategy implements SearchStrategy {
    protected app: App;
    protected logger: DebugLogger;
    protected getSettings: () => CardNavigatorSettings;

    constructor(config: SearchStrategyConfig) {
        this.app = config.app;
        this.logger = config.logger;
        this.getSettings = config.getSettings;
    }

    /**
     * 동기 검색 실행
     *
     * @remarks
     * 하위 클래스에서 구체적인 검색 로직을 구현해야 합니다.
     */
    abstract executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[];

    /**
     * 비동기 검색 실행
     *
     * @remarks
     * 기본 구현: 동기 메서드를 Promise로 래핑합니다.
     * 파일 본문을 읽어야 하는 전략은 이 메서드를 오버라이드해야 합니다.
     */
    async executeAsync(query: string, files: TFile[], caseSensitive: boolean): Promise<TFile[]> {
        return this.executeSync(query, files, caseSensitive);
    }

    /**
     * 텍스트 매칭 검사
     *
     * @param text - 검사할 텍스트
     * @param query - 검색어
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 매칭되면 true
     *
     * @remarks
     * 퍼지 검색이 활성화된 경우 유사 문자열도 매칭합니다.
     */
    protected matchText(text: string, query: string, caseSensitive: boolean): boolean {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;

        const searchText = caseSensitive ? text : text.toLowerCase();
        const searchQuery = caseSensitive ? query : query.toLowerCase();

        if (useFuzzy) {
            const match = fuzzyMatch(searchQuery, searchText, {
                caseSensitive,
                threshold: fuzzyThreshold
            });
            return match.matched;
        } else {
            return searchText.includes(searchQuery);
        }
    }

    /**
     * Wildcard 문자 포함 여부 확인
     *
     * @param pattern - 검사할 패턴
     * @returns Wildcard 문자(* 또는 ?)가 포함되어 있으면 true
     */
    protected hasWildcard(pattern: string): boolean {
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
    protected wildcardToRegex(pattern: string, caseSensitive: boolean): RegExp {
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
     * 파일 본문을 읽습니다
     *
     * @param file - 읽을 파일
     * @returns 파일 내용 (읽기 실패 시 null)
     */
    protected async getFileContent(file: TFile): Promise<string | null> {
        try {
            return await this.app.vault.read(file);
        } catch (error) {
            this.logger.error('Search', `Failed to read file: ${file.path}`, error);
            return null;
        }
    }
}

import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 파일명 검색 전략
 *
 * @remarks
 * 파일의 basename(확장자 제외 파일명)을 검색합니다.
 * Wildcard (* 와 ?) 및 퍼지 검색을 지원합니다.
 *
 * @example
 * ```typescript
 * // 파일명 검색
 * file:meeting
 * file:"2025-01-*"
 * file:note-??
 * ```
 */
export class FileSearchStrategy extends BaseSearchStrategy {
    /**
     * 파일명으로 파일을 필터링합니다
     *
     * @param query - 검색할 파일명 (Wildcard * 와 ? 지원)
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 필터링된 파일
     *
     * @remarks
     * - Wildcard: * (0개 이상 문자), ? (정확히 1개 문자)
     * - 퍼지 검색이 활성화된 경우 유사한 파일명도 매칭합니다
     * - 확장자를 제외한 파일명(basename)만 검색합니다
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        // Wildcard 포함 여부 확인
        if (this.hasWildcard(query)) {
            const regex = this.wildcardToRegex(query, caseSensitive);
            return files.filter(file => regex.test(file.basename));
        }

        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const searchFilename = caseSensitive ? query : query.toLowerCase();

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
}

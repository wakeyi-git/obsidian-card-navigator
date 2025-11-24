import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 섹션(헤더) 검색 전략
 *
 * @remarks
 * 파일의 헤더(섹션) 제목을 검색합니다.
 * 메타데이터 캐시만 사용하므로 동기/비동기 모두 동일하게 작동합니다.
 *
 * @example
 * ```typescript
 * // 헤더 검색
 * section:Introduction
 * section:"Chapter 1"
 * section:Summary
 * ```
 */
export class SectionSearchStrategy extends BaseSearchStrategy {
    /**
     * 섹션(헤더) 제목으로 파일을 필터링합니다
     *
     * @param query - 검색할 헤더 제목
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 해당 헤더를 포함한 파일들
     *
     * @remarks
     * - 모든 헤딩 레벨(#, ##, ###, ...)을 검색합니다
     * - 퍼지 검색이 활성화된 경우 유사한 헤더도 매칭합니다
     * - 부분 문자열 매칭을 지원합니다
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const searchTitle = caseSensitive ? query : query.toLowerCase();

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
}

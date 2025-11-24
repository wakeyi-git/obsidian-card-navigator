import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 프론트매터 속성 검색 전략
 *
 * @remarks
 * 파일의 프론트매터 속성을 검색합니다.
 * 메타데이터 캐시만 사용하므로 동기/비동기 모두 동일하게 작동합니다.
 *
 * @example
 * ```typescript
 * // 속성 검색
 * property:status:done
 * property:author:Alice
 * property:priority:high
 * ```
 */
export class PropertySearchStrategy extends BaseSearchStrategy {
    /**
     * 프론트매터 속성으로 파일을 필터링합니다
     *
     * @param query - 검색 쿼리 (propertyName:propertyValue 형식, 내부적으로 파싱됨)
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 속성을 포함한 파일들
     *
     * @remarks
     * - 배열 속성의 경우 하나라도 매칭되면 포함됩니다
     * - 퍼지 검색이 활성화된 경우 유사한 값도 매칭합니다
     * - 정확히 일치하거나 부분 문자열 포함 시 매칭됩니다
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        // query는 SearchEngine에서 이미 propertyValue만 전달됨
        // propertyName은 SearchQuery.propertyName에서 전달되어야 하지만
        // 현재 인터페이스로는 불가능하므로 기존 방식 유지
        return this.filterByPropertyInternal(files, '', query, caseSensitive);
    }

    /**
     * 내부 구현: 속성 이름과 값으로 필터링
     *
     * @internal
     */
    filterByPropertyInternal(
        files: TFile[],
        propertyName: string,
        propertyValue: string,
        caseSensitive: boolean
    ): TFile[] {
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
     * 외부 API: 속성 이름과 값을 명시적으로 받는 메서드
     *
     * @remarks
     * SearchEngine.filterByProperty()에서 직접 호출할 수 있도록 제공합니다.
     */
    filterByProperty(
        files: TFile[],
        propertyName: string,
        propertyValue: string,
        caseSensitive: boolean
    ): TFile[] {
        return this.filterByPropertyInternal(files, propertyName, propertyValue, caseSensitive);
    }
}

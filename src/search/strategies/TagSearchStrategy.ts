import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { t } from '../../i18n';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 태그 검색 전략
 *
 * @remarks
 * 파일의 프론트매터 태그와 인라인 태그를 검색합니다.
 * 메타데이터 캐시만 사용하므로 동기/비동기 모두 동일하게 작동합니다.
 *
 * @example
 * ```typescript
 * // 태그 검색
 * tag:#project
 * tag:meeting
 * tag:#2025
 * ```
 */
export class TagSearchStrategy extends BaseSearchStrategy {
    /**
     * 태그로 파일을 필터링합니다
     *
     * @param query - 검색할 태그 (# 포함 여부 상관없음)
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부 (태그는 항상 대소문자 구분하지 않음)
     * @returns 태그를 포함한 파일들
     *
     * @remarks
     * - 프론트매터 태그와 인라인 태그를 모두 검색합니다
     * - # 기호 포함/미포함 모두 매칭합니다
     * - 퍼지 검색이 활성화된 경우 유사한 태그도 매칭합니다
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
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

            // 프론트매터 태그 검색
            const frontmatterTags = cache.frontmatter?.tags ?? [];
            if (Array.isArray(frontmatterTags)) {
                if (frontmatterTags.some(t => {
                    const tagStr = String(t);
                    if (useFuzzy) {
                        // Try matching with and without #
                        const match1 = fuzzyMatch(query, tagStr, {
                            caseSensitive: false,
                            threshold: fuzzyThreshold
                        });
                        const match2 = fuzzyMatch(query.substring(1), tagStr, {
                            caseSensitive: false,
                            threshold: fuzzyThreshold
                        });
                        return match1.matched || match2.matched;
                    } else {
                        return tagStr === query || tagStr === query.substring(1);
                    }
                })) {
                    return true;
                }
            } else if (typeof frontmatterTags === 'string') {
                if (useFuzzy) {
                    const match1 = fuzzyMatch(query, frontmatterTags, {
                        caseSensitive: false,
                        threshold: fuzzyThreshold
                    });
                    const match2 = fuzzyMatch(query.substring(1), frontmatterTags, {
                        caseSensitive: false,
                        threshold: fuzzyThreshold
                    });
                    if (match1.matched || match2.matched) {
                        return true;
                    }
                } else {
                    if (frontmatterTags === query || frontmatterTags === query.substring(1)) {
                        return true;
                    }
                }
            }

            // 인라인 태그 검색
            if (cache.tags) {
                return cache.tags.some(t => {
                    if (useFuzzy) {
                        const match = fuzzyMatch(query, t.tag, {
                            caseSensitive: false,
                            threshold: fuzzyThreshold
                        });
                        return match.matched;
                    } else {
                        return t.tag === query;
                    }
                });
            }

            return false;
        });
    }
}

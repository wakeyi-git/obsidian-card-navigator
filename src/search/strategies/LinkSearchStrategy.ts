import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 링크 검색 전략
 *
 * @remarks
 * 특정 파일을 링크하는 파일들을 검색합니다.
 * 메타데이터 캐시만 사용하므로 동기/비동기 모두 동일하게 작동합니다.
 *
 * @example
 * ```typescript
 * // "Meeting Notes"를 링크하는 파일들
 * link:"Meeting Notes"
 *
 * // 특정 경로의 파일을 링크하는 파일들
 * link:folder/document
 * ```
 */
export class LinkSearchStrategy extends BaseSearchStrategy {
    /**
     * 링크로 파일을 필터링합니다
     *
     * @param query - 대상 파일명 (링크될 파일)
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns query로 지정된 파일을 링크하는 파일들
     *
     * @remarks
     * - 파일이 query 파일로의 링크를 포함하는지 검사합니다
     * - 확장자 없이도 매칭됩니다 (예: "note" → "note.md")
     * - 퍼지 검색이 활성화된 경우 유사한 파일명도 매칭합니다
     * - 경로의 마지막 부분만 매칭할 수도 있습니다
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
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
                    const match = fuzzyMatch(query, linkFilename, {
                        caseSensitive: false,
                        threshold: fuzzyThreshold
                    });
                    if (match.matched) return true;
                }

                // 확장자 없이도 매칭
                return linkPath === query ||
                       linkPath === query + '.md' ||
                       linkPath.endsWith('/' + query) ||
                       linkPath.endsWith('/' + query + '.md');
            });
        });
    }
}

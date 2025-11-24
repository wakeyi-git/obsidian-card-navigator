import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { t } from '../../i18n';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 라인 검색 전략
 *
 * @remarks
 * 파일의 각 라인에서 특정 텍스트를 검색합니다.
 * 파일을 비동기로 읽어야 하므로 executeAsync()만 정확한 결과를 제공합니다.
 *
 * @example
 * ```typescript
 * // 특정 텍스트를 포함한 라인 검색
 * line:TODO
 * line:"important note"
 * line:FIXME
 * ```
 */
export class LineSearchStrategy extends BaseSearchStrategy {
    /**
     * 동기 검색 실행
     *
     * @remarks
     * line: 검색은 파일 본문을 읽어야 하므로 동기 버전에서는 지원하지 않습니다.
     * 경고를 출력하고 모든 파일을 그대로 반환합니다.
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        this.logger.warn('Search', t().searchEngine.lineSearchUnsupported);
        return files;
    }

    /**
     * 비동기 검색 실행
     *
     * @param query - 검색할 라인 내용
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 검색어를 포함한 라인이 있는 파일들
     *
     * @remarks
     * - 파일의 모든 라인을 검사합니다
     * - 퍼지 검색이 활성화된 경우 유사한 라인도 매칭합니다
     * - 하나의 라인이라도 매칭되면 파일이 결과에 포함됩니다
     */
    async executeAsync(query: string, files: TFile[], caseSensitive: boolean): Promise<TFile[]> {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const results: TFile[] = [];
        const searchContent = caseSensitive ? query : query.toLowerCase();

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
}

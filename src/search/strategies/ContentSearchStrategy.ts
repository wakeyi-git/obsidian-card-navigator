import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { t } from '../../i18n';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 본문 내용 검색 전략
 *
 * @remarks
 * 파일의 본문 내용을 검색합니다. 프론트매터는 제외됩니다.
 * 파일을 비동기로 읽어야 하므로 executeAsync()만 정확한 결과를 제공합니다.
 *
 * @example
 * ```typescript
 * // 본문에서 특정 텍스트 검색
 * content:meeting notes
 * content:"important task"
 * ```
 */
export class ContentSearchStrategy extends BaseSearchStrategy {
    /**
     * 동기 검색 실행
     *
     * @remarks
     * content: 검색은 파일 본문을 읽어야 하므로 동기 버전에서는 지원하지 않습니다.
     * 경고를 출력하고 모든 파일을 그대로 반환합니다.
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        this.logger.warn('Search', t().searchEngine.unsupportedSearchType('content'));
        return files;
    }

    /**
     * 비동기 검색 실행
     *
     * @param query - 검색할 내용
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 본문에 검색어가 포함된 파일들
     *
     * @remarks
     * - 프론트매터를 제외한 본문만 검색합니다
     * - 퍼지 검색이 활성화된 경우 유사 문자열도 매칭합니다
     */
    async executeAsync(query: string, files: TFile[], caseSensitive: boolean): Promise<TFile[]> {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const results: TFile[] = [];
        const searchContent = caseSensitive ? query : query.toLowerCase();

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
}

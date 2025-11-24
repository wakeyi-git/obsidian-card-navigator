import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { t } from '../../i18n';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 블록 검색 전략
 *
 * @remarks
 * Obsidian의 블록 ID (^block-id) 기능을 활용하여 블록을 검색합니다.
 * 파일을 비동기로 읽어야 하므로 executeAsync()만 정확한 결과를 제공합니다.
 *
 * @example
 * ```typescript
 * // 블록 내용 검색
 * block:"important note"
 * block:TODO
 *
 * // 빈 쿼리는 블록 ID가 있는 모든 파일 반환
 * block:
 * ```
 */
export class BlockSearchStrategy extends BaseSearchStrategy {
    /**
     * 동기 검색 실행
     *
     * @remarks
     * block: 검색은 파일 본문을 읽어야 하므로 동기 버전에서는 지원하지 않습니다.
     * 경고를 출력하고 모든 파일을 그대로 반환합니다.
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        this.logger.warn('Search', 'Block search requires async execution');
        return files;
    }

    /**
     * 비동기 검색 실행
     *
     * @param query - 검색할 블록 내용
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 블록을 포함한 파일들
     *
     * @remarks
     * - Obsidian의 블록 캐시를 사용하여 블록 ID가 있는 라인을 검색합니다
     * - query가 비어있으면 블록 ID가 있는 모든 파일을 반환합니다
     * - 퍼지 검색이 활성화된 경우 유사한 블록 내용도 매칭합니다
     * - 하나의 블록이라도 매칭되면 파일이 결과에 포함됩니다
     */
    async executeAsync(query: string, files: TFile[], caseSensitive: boolean): Promise<TFile[]> {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const results: TFile[] = [];
        const searchContent = caseSensitive ? query : query.toLowerCase();

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

                        // query가 비어있으면 모든 블록 매칭
                        if (!query || query.trim() === '') {
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
}

import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { t } from '../../i18n';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

/**
 * 태스크 검색 전략
 *
 * @remarks
 * 파일의 태스크(체크리스트) 항목을 검색합니다.
 * 파일을 비동기로 읽어야 하므로 executeAsync()만 정확한 결과를 제공합니다.
 *
 * @example
 * ```typescript
 * // 모든 태스크 검색
 * task:
 * task:meeting
 *
 * // 미완료 태스크만 검색
 * task-todo:review code
 *
 * // 완료된 태스크만 검색
 * task-done:submit report
 * ```
 */
export class TaskSearchStrategy extends BaseSearchStrategy {
    /**
     * 라인이 태스크인지 확인합니다
     *
     * @param line - 검사할 라인
     * @param status - 태스크 상태
     * @returns 태스크이면 true
     *
     * @remarks
     * - `- [ ]` 형식의 미완료 태스크
     * - `- [x]` 또는 `- [X]` 형식의 완료 태스크를 인식합니다
     */
    private isTask(line: string, status: 'all' | 'todo' | 'done'): boolean {
        // - [ ] 미완료 태스크
        // - [x] 완료 태스크
        // - [X] 완료 태스크
        const taskRegex = /^\s*-\s+\[([ xX])\]/;
        const match = line.match(taskRegex);

        if (!match) return false;

        const checkMark = match[1];
        const isDone = checkMark !== ' ';

        if (status === 'all') return true;
        if (status === 'todo') return !isDone;
        if (status === 'done') return isDone;

        return false;
    }

    /**
     * 동기 검색 실행
     *
     * @remarks
     * task: 검색은 파일 본문을 읽어야 하므로 동기 버전에서는 지원하지 않습니다.
     * 경고를 출력하고 모든 파일을 그대로 반환합니다.
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        this.logger.warn('Search', t().searchEngine.unsupportedSearchType('task'));
        return files;
    }

    /**
     * 비동기 검색 실행
     *
     * @param query - 검색할 태스크 내용 (비어있으면 모든 태스크)
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @param status - 태스크 상태 ('all' | 'todo' | 'done', 기본값: 'all')
     * @returns 태스크를 포함한 파일들
     *
     * @remarks
     * - 빈 쿼리인 경우 모든 태스크를 매칭합니다
     * - 퍼지 검색이 활성화된 경우 유사한 태스크 내용도 매칭합니다
     */
    async executeAsync(
        query: string,
        files: TFile[],
        caseSensitive: boolean,
        status: 'all' | 'todo' | 'done' = 'all'
    ): Promise<TFile[]> {
        const settings = this.getSettings();
        const useFuzzy = settings.enableFuzzySearch;
        const fuzzyThreshold = settings.fuzzySearchThreshold;
        const results: TFile[] = [];
        const searchContent = caseSensitive ? query : query.toLowerCase();

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const lines = content.split('\n');

                let hasMatch = false;
                for (const line of lines) {
                    if (this.isTask(line, status)) {
                        // query가 비어있으면 모든 태스크 매칭
                        if (!query || query.trim() === '') {
                            hasMatch = true;
                            break;
                        }

                        // query가 있으면 내용 검색
                        const lineToSearch = caseSensitive ? line : line.toLowerCase();

                        // 퍼지 검색 적용
                        if (useFuzzy) {
                            const match = fuzzyMatch(searchContent, lineToSearch, {
                                caseSensitive,
                                threshold: fuzzyThreshold
                            });
                            if (match.matched) {
                                hasMatch = true;
                                break;
                            }
                        }

                        if (lineToSearch.includes(searchContent)) {
                            hasMatch = true;
                            break;
                        }
                    }
                }

                if (hasMatch) {
                    results.push(file);
                }
            } catch (error) {
                this.logger.error('Search', t().searchEngine.taskSearchError, { path: file.path, error });
            }
        }

        return results;
    }

    /**
     * 외부 API: 태스크 상태를 명시적으로 받는 메서드
     *
     * @remarks
     * SearchEngine.filterByTask()에서 직접 호출할 수 있도록 제공합니다.
     */
    async filterByTask(
        files: TFile[],
        taskContent: string,
        status: 'all' | 'todo' | 'done',
        caseSensitive: boolean
    ): Promise<TFile[]> {
        return await this.executeAsync(taskContent, files, caseSensitive, status);
    }
}

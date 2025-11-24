import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { SearchParser } from '../SearchParser';
import { SearchStrategyConfig } from './types';

/**
 * 수정일 검색 전략
 *
 * @remarks
 * 파일의 수정일(mtime)을 기준으로 검색합니다.
 * 단일 날짜 또는 날짜 범위 검색을 지원합니다.
 *
 * @example
 * ```typescript
 * // 특정 날짜에 수정된 파일
 * modified:2025-01-15
 *
 * // 날짜 범위
 * modified:2025-01-01..2025-01-31
 * ```
 */
export class ModifiedDateSearchStrategy extends BaseSearchStrategy {
    private parser: SearchParser;

    constructor(config: SearchStrategyConfig, parser: SearchParser) {
        super(config);
        this.parser = parser;
    }

    /**
     * 수정일로 파일을 필터링합니다
     *
     * @param query - 날짜 문자열 (YYYY-MM-DD 또는 YYYY-MM-DD..YYYY-MM-DD)
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 사용되지 않음 (날짜 검색은 대소문자 구분 없음)
     * @returns 필터링된 파일
     *
     * @remarks
     * - 범위 검색: YYYY-MM-DD..YYYY-MM-DD 형식
     * - 단일 날짜: YYYY-MM-DD 형식
     * - 범위 검색은 시작일과 종료일을 포함합니다
     * - 단일 날짜는 해당 날짜의 00:00:00 ~ 23:59:59를 검색합니다
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        // 범위 검색
        if (query.includes('..')) {
            const range = this.parser.parseDateRange(query);
            if (!range) return files;

            const [start, end] = range;

            return files.filter(file => {
                const fileDate = new Date(file.stat.mtime);
                return fileDate >= start && fileDate <= end;
            });
        }

        // 단일 날짜 검색
        const date = this.parser.parseDate(query);
        if (!date) return files;

        return files.filter(file => {
            const fileDate = new Date(file.stat.mtime);
            return fileDate.toDateString() === date.toDateString();
        });
    }
}

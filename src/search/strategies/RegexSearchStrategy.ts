import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';
import { t } from '../../i18n';

/**
 * 정규식 검색 전략
 *
 * @remarks
 * 정규식을 사용하여 파일 본문을 검색합니다.
 * 파일을 비동기로 읽어야 하므로 executeAsync()만 정확한 결과를 제공합니다.
 *
 * @example
 * ```typescript
 * // TODO로 시작하는 라인 찾기
 * /^TODO/
 *
 * // 날짜 형식 찾기
 * /\d{4}-\d{2}-\d{2}/
 *
 * // 내부 링크 찾기
 * /\[\[.*\]\]/
 * ```
 */
export class RegexSearchStrategy extends BaseSearchStrategy {
    /**
     * 정규식 쿼리인지 확인합니다
     *
     * @param query - 검색어
     * @returns /pattern/ 또는 /pattern/flags 형식이면 true
     */
    static isRegexQuery(query: string): boolean {
        return /^\/(.+?)\/([gimuy]*)$/.test(query.trim());
    }

    /**
     * 정규식 쿼리를 파싱합니다
     *
     * @param query - 정규식 쿼리 (/pattern/flags)
     * @returns 패턴과 플래그
     * @throws 유효하지 않은 정규식 형식인 경우
     */
    private parseRegexQuery(query: string): { pattern: string; flags: string } {
        const match = query.trim().match(/^\/(.+?)\/([gimuy]*)$/);

        if (!match) {
            throw new Error(t().searchEngine.invalidRegexFormat);
        }

        return {
            pattern: match[1],
            flags: match[2] || ''
        };
    }

    /**
     * 동기 검색 실행
     *
     * @remarks
     * 정규식 검색은 파일 본문을 읽어야 하므로 동기 버전에서는 지원하지 않습니다.
     * 경고를 출력하고 모든 파일을 그대로 반환합니다.
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        this.logger.warn('Search', 'Regex search requires async execution');
        return files;
    }

    /**
     * 비동기 검색 실행
     *
     * @param query - 정규식 쿼리 (/pattern/flags)
     * @param files - 검색할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부 (정규식 플래그로 처리되므로 무시됨)
     * @returns 정규식에 매칭된 파일들
     *
     * @throws 유효하지 않은 정규식인 경우
     */
    async executeAsync(query: string, files: TFile[], caseSensitive: boolean): Promise<TFile[]> {
        const { pattern, flags } = this.parseRegexQuery(query);

        let regex: RegExp;
        try {
            regex = new RegExp(pattern, flags);
        } catch (error) {
            throw new Error(t().searchEngine.regexCreateError(String(error)));
        }

        const results: TFile[] = [];

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);

                if (regex.test(content)) {
                    results.push(file);
                }
            } catch (error) {
                this.logger.error('Search', t().searchEngine.regexSearchError, { path: file.path, error });
            }
        }

        return results;
    }
}

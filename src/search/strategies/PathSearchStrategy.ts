import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';

/**
 * 경로 검색 전략
 *
 * @remarks
 * 파일의 폴더 경로로 검색합니다. 파일명은 제외됩니다.
 * Wildcard (* 와 ?) 및 퍼지 검색을 지원합니다.
 *
 * @example
 * ```typescript
 * // 정확한 경로 매칭
 * path:folder/subfolder
 *
 * // Wildcard 사용
 * path:2025*
 * path:notes/202?
 *
 * // 퍼지 검색 (설정에서 활성화한 경우)
 * path:prject  // "project" 폴더 매칭
 * ```
 */
export class PathSearchStrategy extends BaseSearchStrategy {
    /**
     * 경로로 파일을 필터링합니다
     *
     * @param query - 검색할 폴더 경로 (Wildcard * 와 ? 지원)
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 필터링된 파일
     *
     * @remarks
     * - 파일의 폴더 경로만 검색하며 파일명은 제외됩니다
     * - Wildcard: * (0개 이상 문자), ? (정확히 1개 문자)
     * - 퍼지 검색이 활성화된 경우 유사한 경로도 매칭합니다
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        // Wildcard 포함 여부 확인
        if (this.hasWildcard(query)) {
            const regex = this.wildcardToRegex(query, caseSensitive);
            return files.filter(file => {
                const folderPath = file.parent?.path || '';
                return regex.test(folderPath);
            });
        }

        const searchPath = caseSensitive ? query : query.toLowerCase();

        return files.filter(file => {
            const folderPath = file.parent?.path || '';
            const comparePath = caseSensitive ? folderPath : folderPath.toLowerCase();

            return this.matchText(comparePath, searchPath, caseSensitive);
        });
    }
}

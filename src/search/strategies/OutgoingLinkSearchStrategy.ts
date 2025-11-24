import { TFile } from 'obsidian';
import { BaseSearchStrategy } from './BaseSearchStrategy';

/**
 * 역링크(백링크) 검색 전략
 *
 * @remarks
 * 특정 파일에서 나가는 링크를 포함하는 파일들을 검색합니다.
 * 즉, 특정 파일이 링크하는 파일들을 찾습니다.
 * 메타데이터 캐시만 사용하므로 동기/비동기 모두 동일하게 작동합니다.
 *
 * @example
 * ```typescript
 * // "Index"가 링크하는 파일들
 * outgoing-link:Index
 *
 * // 특정 경로의 파일이 링크하는 파일들
 * outgoing-link:folder/document
 * ```
 */
export class OutgoingLinkSearchStrategy extends BaseSearchStrategy {
    /**
     * 역링크로 파일을 필터링합니다
     *
     * @param query - 대상 파일명 (링크를 생성하는 파일)
     * @param files - 필터링할 파일 목록
     * @param caseSensitive - 사용되지 않음
     * @returns query로 지정된 파일이 링크하는 파일들 (백링크)
     *
     * @remarks
     * - Obsidian API의 resolvedLinks를 사용하여 백링크를 찾습니다
     * - query 파일에서 나가는 링크를 포함한 파일들을 반환합니다
     * - 확장자 없이도 파일을 찾을 수 있습니다
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[] {
        // query에 해당하는 TFile 찾기
        const target = this.app.vault.getAbstractFileByPath(query);
        if (!(target instanceof TFile)) {
            // 확장자 없이 시도
            const targetWithExt = this.app.vault.getAbstractFileByPath(query + '.md');
            if (!(targetWithExt instanceof TFile)) {
                return [];
            }
            return this.getBacklinks(targetWithExt as TFile, files);
        }

        return this.getBacklinks(target, files);
    }

    /**
     * 파일의 백링크를 가져옵니다
     *
     * @param target - 백링크를 찾을 대상 파일
     * @param files - 검색할 파일 목록
     * @returns target을 링크하는 파일들
     *
     * @remarks
     * Obsidian API의 resolvedLinks를 사용하여 모든 파일을 순회하면서
     * target을 링크하는 파일들을 찾습니다
     */
    private getBacklinks(target: TFile, files: TFile[]): TFile[] {
        // Obsidian API의 resolvedLinks를 사용하여 백링크 찾기
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        const backlinkPaths = new Set<string>();

        // 모든 파일을 순회하면서 target을 링크하는 파일 찾기
        for (const sourcePath in resolvedLinks) {
            const links = resolvedLinks[sourcePath];
            if (links && links[target.path]) {
                backlinkPaths.add(sourcePath);
            }
        }

        return files.filter(file => backlinkPaths.has(file.path));
    }
}

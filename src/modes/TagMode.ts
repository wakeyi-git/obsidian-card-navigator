import { TFile, App } from 'obsidian';
import { TagModeSettings } from '../types';
import type { CardNavigatorView } from '../view';
import { isValidFile, isDefined } from '../utils/typeGuards';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * 태그 기반 파일 필터링 모드
 * 
 * 지정된 태그 또는 활성 파일의 태그를 기준으로 파일 목록을 필터링합니다.
 * AND/OR 연산자를 지원하며, 프론트매터와 인라인 태그를 모두 처리합니다.
 * 
 * @example
 * ```typescript
 * const tagMode = new TagMode(app, view);
 * const files = tagMode.getFiles();
 * const allTags = tagMode.getAllTags();
 * ```
 */
export class TagMode {
    private app: App;
    private view: CardNavigatorView;
    private logger: DebugLogger;

    constructor(app: App, view: CardNavigatorView) {
        this.app = app;
        this.view = view;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(() => this.view.plugin.settingsManager.getSettings());
    }

    /**
     * 태그 모드 설정을 가져옵니다
     * 
     * @private
     */
    private get settings(): TagModeSettings {
        return this.view.plugin.settingsManager.getSettings().tagMode;
    }

    /**
     * 태그 모드에서 표시할 파일 목록을 가져옵니다
     * 
     * @returns 필터링된 파일 목록
     */
    getFiles(): TFile[] {
        const targetTags = this.getTargetTags();
        
        this.logger.debug('Mode', 'TagMode.getFiles() - Target tags', targetTags);
        this.logger.debug('Mode', 'TagMode.getFiles() - Settings', this.settings);
        
        if (targetTags.length === 0) {
            this.logger.debug('Mode', 'TagMode.getFiles() - No target tags, returning empty array');
            return [];
        }

        const files = this.getFilesByTags(targetTags);
        this.logger.debug('Mode', `TagMode.getFiles() - Found ${files.length} files`);
        return files;
    }

    /**
     * 대상 태그 목록을 가져옵니다
     * 
     * @private
     */
    private getTargetTags(): string[] {
        if (this.settings.useActiveFileTags) {
            return this.getActiveFileTags();
        } else {
            return this.settings.specifiedTags;
        }
    }

    /**
     * 활성 파일의 태그를 가져옵니다
     * 
     * @private
     */
    private getActiveFileTags(): string[] {
        const activeFile = this.app.workspace.getActiveFile();
        if (!isValidFile(activeFile)) {
            return [];
        }

        return this.getFileTags(activeFile);
    }

    /**
     * 파일의 모든 태그를 가져옵니다
     * 
     * 프론트매터 태그와 인라인 태그를 모두 수집합니다.
     * 
     * @param file - 대상 파일
     * @returns 태그 목록 (중복 제거됨)
     */
    getFileTags(file: TFile): string[] {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!isDefined(cache)) {
            return [];
        }

        const tags = new Set<string>();

        if (cache.frontmatter?.tags) {
            const frontmatterTags = cache.frontmatter.tags;
            if (Array.isArray(frontmatterTags)) {
                frontmatterTags.forEach(tag => {
                    const normalized = this.normalizeTag(tag);
                    if (normalized) {
                        tags.add(normalized);
                    }
                });
            } else if (typeof frontmatterTags === 'string') {
                const normalized = this.normalizeTag(frontmatterTags);
                if (normalized) {
                    tags.add(normalized);
                }
            }
        }

        if (cache.tags) {
            cache.tags.forEach(tagInfo => {
                const normalized = this.normalizeTag(tagInfo.tag);
                if (normalized) {
                    tags.add(normalized);
                }
            });
        }

        return Array.from(tags);
    }

    /**
     * 태그를 정규화합니다 (# 제거, 소문자 변환)
     * 
     * @private
     */
    private normalizeTag(tag: string | null | undefined): string {
        if (!tag || typeof tag !== 'string') {
            return '';
        }
        
        let normalized = tag.startsWith('#') ? tag.slice(1) : tag;
        normalized = normalized.toLowerCase().trim();
        return normalized;
    }

    /**
     * 태그로 파일을 필터링합니다
     * 
     * @private
     */
    private getFilesByTags(tags: string[]): TFile[] {
        const allFiles = this.app.vault.getMarkdownFiles();
        const normalizedTags = tags.map(tag => this.normalizeTag(tag));

        return allFiles.filter(file => {
            const fileTags = this.getFileTags(file);
            return this.matchesTags(fileTags, normalizedTags);
        });
    }

    /**
     * 파일 태그가 대상 태그와 매칭되는지 확인합니다
     * 
     * @remarks
     * - AND: 모든 대상 태그를 포함해야 함
     * - OR: 대상 태그 중 하나라도 포함하면 됨
     * 
     * @private
     */
    private matchesTags(fileTags: string[], targetTags: string[]): boolean {
        if (this.settings.tagOperator === 'AND') {
            return targetTags.every(tag => fileTags.includes(tag));
        } else {
            return targetTags.some(tag => fileTags.includes(tag));
        }
    }

    /**
     * Vault의 모든 태그를 가져옵니다
     * 
     * @returns 모든 태그 목록 (중복 제거됨, 정렬됨)
     */
    getAllTags(): string[] {
        const allFiles = this.app.vault.getMarkdownFiles();
        const tags = new Set<string>();

        for (const file of allFiles) {
            const fileTags = this.getFileTags(file);
            fileTags.forEach(tag => tags.add(tag));
        }

        return Array.from(tags).sort();
    }

    /**
     * 현재 대상 태그 목록을 가져옵니다
     * 
     * @returns 현재 대상 태그 목록
     */
    getCurrentTags(): string[] {
        return this.getTargetTags();
    }
}

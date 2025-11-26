import { TFile, TFolder, App } from 'obsidian';
import { FolderModeSettings } from '../types';
import type { CardNavigatorView } from '../view';
import { isValidFile, isDefined } from '../utils/typeGuards';
import { LRUCache } from '../utils/memoize';

/**
 * 폴더 기반 파일 필터링 모드
 *
 * 지정된 폴더 또는 활성 파일의 폴더를 기준으로 파일 목록을 필터링합니다.
 * 하위 폴더 포함 여부를 설정할 수 있습니다.
 *
 * @remarks
 * ⭐ Phase 4 최적화: LRU 캐시 도입
 * - 동일 폴더 반복 조회 시 캐시된 결과 반환
 * - 파일 변경 이벤트 발생 시 캐시 무효화
 *
 * @example
 * ```typescript
 * const folderMode = new FolderMode(app, view);
 * const files = folderMode.getFiles();
 * const path = folderMode.getCurrentFolderPath();
 * ```
 */
export class FolderMode {
    private app: App;
    private view: CardNavigatorView;

    /** ⭐ Phase 4 최적화: 파일 목록 캐시 */
    private fileCache: LRUCache<string, TFile[]>;
    private static readonly CACHE_SIZE = 50;

    constructor(app: App, view: CardNavigatorView) {
        this.app = app;
        this.view = view;
        this.fileCache = new LRUCache(FolderMode.CACHE_SIZE);
    }

    /**
     * 폴더 모드 설정을 가져옵니다
     * 
     * @private
     */
    private get settings(): FolderModeSettings {
        return this.view.plugin.settingsManager.getSettings().folderMode;
    }

    /**
     * 폴더 모드에서 표시할 파일 목록을 가져옵니다
     *
     * @remarks
     * ⭐ Phase 4 최적화: LRU 캐시 적용
     * - 캐시 키: 폴더 경로 + 하위 폴더 포함 여부
     * - 동일 조건 반복 조회 시 O(1) 캐시 히트
     *
     * @returns 필터링된 파일 목록
     */
    getFiles(): TFile[] {
        const folder = this.getCurrentFolder();
        if (!isDefined(folder)) {
            return [];
        }

        // ⭐ Phase 4 최적화: 캐시 키 생성 (폴더 경로 + 설정)
        const cacheKey = `${folder.path}:${this.settings.includeSubfolders}`;

        // 캐시 조회
        const cached = this.fileCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // 캐시 미스: 계산 후 저장
        const files = this.getFilesInFolder(folder);
        this.fileCache.set(cacheKey, files);
        return files;
    }

    /**
     * 현재 대상 폴더를 가져옵니다
     * 
     * @private
     */
    private getCurrentFolder(): TFolder | null {
        if (this.settings.useActiveFolder) {
            return this.getActiveFolderFromFile();
        } else if (this.settings.specifiedFolder) {
            return this.getFolderByPath(this.settings.specifiedFolder);
        }

        return this.app.vault.getRoot();
    }

    /**
     * 활성 파일의 폴더를 가져옵니다
     * 
     * @private
     */
    private getActiveFolderFromFile(): TFolder | null {
        const activeFile = this.app.workspace.getActiveFile();
        if (!isValidFile(activeFile)) {
            return this.app.vault.getRoot();
        }

        return activeFile.parent || this.app.vault.getRoot();
    }

    /**
     * 경로로 폴더를 찾습니다
     * 
     * @private
     */
    private getFolderByPath(path: string): TFolder | null {
        const folder = this.app.vault.getAbstractFileByPath(path);
        
        if (folder instanceof TFolder) {
            return folder;
        }

        return null;
    }

    /**
     * 폴더 내 파일을 가져옵니다
     * 
     * @private
     */
    private getFilesInFolder(folder: TFolder): TFile[] {
        if (this.settings.includeSubfolders) {
            return this.getFilesRecursively(folder);
        } else {
            return this.getDirectFiles(folder);
        }
    }

    /**
     * 폴더의 직접 자식 파일만 가져옵니다
     * 
     * @private
     */
    private getDirectFiles(folder: TFolder): TFile[] {
        const files: TFile[] = [];

        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            }
        }

        return files;
    }

    /**
     * 폴더와 모든 하위 폴더의 파일을 재귀적으로 가져옵니다
     * 
     * @private
     */
    private getFilesRecursively(folder: TFolder): TFile[] {
        const files: TFile[] = [];

        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            } else if (child instanceof TFolder) {
                files.push(...this.getFilesRecursively(child));
            }
        }

        return files;
    }

    /**
     * 현재 폴더 경로를 가져옵니다
     *
     * @returns 현재 폴더 경로
     */
    getCurrentFolderPath(): string {
        const folder = this.getCurrentFolder();
        return isDefined(folder) ? folder.path : '/';
    }

    /**
     * 파일 목록 캐시를 무효화합니다
     *
     * @remarks
     * ⭐ Phase 4 최적화: 파일 변경 이벤트 발생 시 호출
     * - 파일 생성/삭제/이동 시 캐시 전체 클리어
     * - 정확한 파일 목록 보장
     */
    invalidateCache(): void {
        this.fileCache.clear();
    }
}

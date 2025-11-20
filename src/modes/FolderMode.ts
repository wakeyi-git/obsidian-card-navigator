import { TFile, TFolder, App } from 'obsidian';
import { FolderModeSettings } from '../types';
import type { CardNavigatorView } from '../view';
import { isValidFile, isDefined } from '../utils/typeGuards';

/**
 * 폴더 기반 파일 필터링 모드
 * 
 * 지정된 폴더 또는 활성 파일의 폴더를 기준으로 파일 목록을 필터링합니다.
 * 하위 폴더 포함 여부를 설정할 수 있습니다.
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

    constructor(app: App, view: CardNavigatorView) {
        this.app = app;
        this.view = view;
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
     * @returns 필터링된 파일 목록
     */
    getFiles(): TFile[] {
        const folder = this.getCurrentFolder();
        if (!isDefined(folder)) {
            return [];
        }

        return this.getFilesInFolder(folder);
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
}

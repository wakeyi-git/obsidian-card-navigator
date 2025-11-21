import { TFile, App } from 'obsidian';
import { SortOptions, SortCriteria, SortOrder } from '../types';

/**
 * 파일 정렬 관리자
 * 
 * 다양한 기준으로 파일 목록을 정렬합니다.
 * 
 * @example
 * ```typescript
 * const sortManager = new SortManager(app);
 * 
 * // 수정일 기준 내림차순 정렬
 * const sorted = sortManager.sort(files, {
 *   criteria: 'modified',
 *   order: 'desc'
 * });
 * 
 * // 정렬 토글
 * const newOptions = sortManager.toggleSort(currentOptions, 'name');
 * ```
 */
export class SortManager {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * 파일 목록을 정렬합니다
     * 
     * @param files - 정렬할 파일 목록
     * @param options - 정렬 옵션
     * @returns 정렬된 새 배열
     */
    sort(files: TFile[], options: SortOptions): TFile[] {
        const sortedFiles = [...files];

        sortedFiles.sort((a, b) => {
            const comparison = this.compare(a, b, options);
            return options.order === 'asc' ? comparison : -comparison;
        });

        return sortedFiles;
    }

    /**
     * 두 파일을 비교합니다
     */
    private compare(a: TFile, b: TFile, options: SortOptions): number {
        switch (options.criteria) {
            case 'name':
                return this.compareName(a, b);
            case 'created':
                return this.compareCreated(a, b);
            case 'modified':
                return this.compareModified(a, b);
            case 'size':
                return this.compareSize(a, b);
            case 'property':
                return this.compareProperty(a, b, options.propertyName || '');
            default:
                return 0;
        }
    }

    /**
     * 파일명으로 비교합니다
     */
    private compareName(a: TFile, b: TFile): number {
        return a.basename.localeCompare(b.basename, undefined, {
            sensitivity: 'base',
            numeric: true
        });
    }

    /**
     * 생성일로 비교합니다
     */
    private compareCreated(a: TFile, b: TFile): number {
        return a.stat.ctime - b.stat.ctime;
    }

    /**
     * 수정일로 비교합니다
     */
    private compareModified(a: TFile, b: TFile): number {
        return a.stat.mtime - b.stat.mtime;
    }

    /**
     * 파일 크기로 비교합니다
     */
    private compareSize(a: TFile, b: TFile): number {
        return a.stat.size - b.stat.size;
    }

    /**
     * 프론트매터 속성값으로 비교합니다
     */
    private compareProperty(a: TFile, b: TFile, propertyName: string): number {
        const valueA = this.getPropertyValue(a, propertyName);
        const valueB = this.getPropertyValue(b, propertyName);

        // 속성값이 없으면 뒤로 배치
        if (valueA === null && valueB === null) return 0;
        if (valueA === null) return 1;
        if (valueB === null) return -1;

        // 두 값이 모두 Date 객체인 경우
        if (valueA instanceof Date && valueB instanceof Date) {
            return valueA.getTime() - valueB.getTime();
        }
        
        // 하나만 Date 객체인 경우: Date 객체를 우선순위로 (앞에 배치)
        if (valueA instanceof Date) return -1;
        if (valueB instanceof Date) return 1;
        
        // 두 값이 모두 숫자인 경우
        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return valueA - valueB;
        }
        
        // 두 값이 모두 문자열인 경우
        if (typeof valueA === 'string' && typeof valueB === 'string') {
            return valueA.localeCompare(valueB);
        }
        
        // 그 외의 경우: 문자열로 변환하여 비교
        return String(valueA).localeCompare(String(valueB));
    }

    /**
     * 프론트매터 속성값을 가져옵니다
     */
    private getPropertyValue(file: TFile, propertyName: string): unknown {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter) {
            return null;
        }

        const value = cache.frontmatter[propertyName];
        
        // 날짜 문자열을 Date 객체로 변환
        if (typeof value === 'string' && this.isDateString(value)) {
            return new Date(value);
        }

        return value ?? null;
    }

    /**
     * YYYY-MM-DD 형식의 날짜 문자열인지 확인합니다
     * 
     * @remarks
     * 정규식 패턴 매칭뿐만 아니라 실제 날짜 유효성도 검증합니다.
     * '2025-13-01'과 같은 잘못된 날짜는 false를 반환합니다.
     */
    private isDateString(str: string): boolean {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(str)) {
            return false;
        }

        const date = new Date(str);
        if (isNaN(date.getTime())) {
            return false;
        }
        
        // 파싱된 날짜를 다시 YYYY-MM-DD 형식으로 변환하여 원본과 비교
        // '2025-13-01'은 '2025-01-01'로 변환되므로 원본과 다름
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const reconstructed = `${year}-${month}-${day}`;
        
        return reconstructed === str;
    }

    /**
     * 정렬 옵션을 토글합니다
     * 
     * 같은 기준이면 순서를 반전하고, 다른 기준이면 새 기준으로 오름차순 정렬합니다.
     * 
     * @param currentOptions - 현재 정렬 옵션
     * @param newCriteria - 새 정렬 기준
     * @returns 새로운 정렬 옵션
     */
    toggleSort(currentOptions: SortOptions, newCriteria: SortCriteria): SortOptions {
        if (currentOptions.criteria === newCriteria) {
            return {
                ...currentOptions,
                order: currentOptions.order === 'asc' ? 'desc' : 'asc'
            };
        } else {
            return {
                criteria: newCriteria,
                order: 'asc',
                propertyName: newCriteria === 'property' ? currentOptions.propertyName : undefined
            };
        }
    }
}

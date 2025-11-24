import { TFile, App } from 'obsidian';
import { SortOptions, SortCriteria } from '../types';
import { PinManager } from '../grouping/PinManager';

/**
 * ⭐ Phase 2: 정렬 결과 캐시 엔트리
 */
interface SortCacheEntry {
	/** 정렬된 파일 경로 배열 */
	sortedPaths: string[];
	/** 캐시 생성 시간 */
	timestamp: number;
}

/**
 * 파일 정렬 관리자
 *
 * 다양한 기준으로 파일 목록을 정렬합니다.
 *
 * ⭐ Phase 2: 정렬 결과 캐싱 지원
 * - LRU 캐시로 최근 정렬 결과 저장
 * - 파일 변경 시 선택적 캐시 무효화
 *
 * ⭐ Section 3.3: PinManager 통합
 * - 핀 파일 우선순위 로직을 PinManager로 위임
 * - 중복 코드 제거 및 성능 향상
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

	/** ⭐ Phase 2: 정렬 결과 LRU 캐시 (최대 20개 항목) */
	private sortCache = new Map<string, SortCacheEntry>();
	private readonly MAX_CACHE_SIZE = 20;

    constructor(app: App) {
        this.app = app;
    }

	/**
	 * ⭐ Phase 2: 정렬 캐시 키를 생성합니다
	 *
	 * @param files - 파일 목록
	 * @param options - 정렬 옵션
	 * @param pinnedFiles - 핀된 파일 경로 목록
	 * @returns 캐시 키
	 *
	 * @remarks
	 * 파일 경로 목록, 정렬 옵션, 핀 파일 목록을 조합하여 고유 키 생성
	 */
	private generateCacheKey(files: TFile[], options: SortOptions, pinnedFiles?: string[]): string {
		// 파일 경로 목록 (정렬되지 않은 상태)
		const filePaths = files.map(f => f.path).sort().join('|');

		// 정렬 옵션 직렬화
		const optionsKey = JSON.stringify({
			criteria: options.criteria,
			order: options.order,
			propertyName: options.propertyName,
			enableMultiSort: options.enableMultiSort,
			levels: options.levels
		});

		// 핀 파일 목록
		const pinnedKey = pinnedFiles ? pinnedFiles.join('|') : '';

		return `${filePaths}::${optionsKey}::${pinnedKey}`;
	}

    /**
     * 파일 목록을 정렬합니다
     *
     * @param files - 정렬할 파일 목록
     * @param options - 정렬 옵션
     * @param pinnedFiles - 핀된 파일 경로 목록 (선택사항)
     * @returns 정렬된 새 배열
     *
     * @remarks
     * ⭐ Phase 2: 정렬 결과 캐싱 지원
     * - 동일한 입력에 대해 캐시된 결과 반환
     * - LRU 방식으로 캐시 관리
     */
    sort(files: TFile[], options: SortOptions, pinnedFiles?: string[]): TFile[] {
		// ⭐ Phase 2: 캐시 확인
		const cacheKey = this.generateCacheKey(files, options, pinnedFiles);
		const cached = this.sortCache.get(cacheKey);

		if (cached) {
			// 캐시 히트: LRU 업데이트 (삭제 후 재추가)
			this.sortCache.delete(cacheKey);
			this.sortCache.set(cacheKey, cached);

			// 캐시된 경로 순서대로 파일 배열 재구성
			const pathToFile = new Map(files.map(f => [f.path, f]));
			return cached.sortedPaths
				.map(path => pathToFile.get(path))
				.filter((f): f is TFile => f !== undefined);
		}

		// 캐시 미스: 정렬 수행
        const sortedFiles = [...files];

		// ⭐ Section 3.3: PinManager 생성
		const pinManager = new PinManager(pinnedFiles);

        sortedFiles.sort((a, b) => {
            // ⭐ Section 3.3: PinManager를 사용한 핀 우선순위 처리
            const pinComparison = pinManager.comparePinPriority(a, b);
            if (pinComparison !== 0) {
                return pinComparison;
            }

            // 다단계 정렬이 활성화되어 있고 levels가 정의되어 있으면 다단계 정렬 수행
            if (options.enableMultiSort && options.levels && options.levels.length > 0) {
                return this.compareMultiLevel(a, b, options.levels);
            }

            // 기본 단일 정렬
            const comparison = this.compare(a, b, options);
            return options.order === 'asc' ? comparison : -comparison;
        });

		// ⭐ Phase 2: 정렬 결과 캐싱
		this.addToCache(cacheKey, sortedFiles);

        return sortedFiles;
    }

	/**
	 * ⭐ Phase 2: 정렬 결과를 캐시에 추가합니다
	 *
	 * @param cacheKey - 캐시 키
	 * @param sortedFiles - 정렬된 파일 목록
	 *
	 * @remarks
	 * LRU 방식: 캐시 크기가 MAX_CACHE_SIZE를 초과하면 가장 오래된 항목 제거
	 */
	private addToCache(cacheKey: string, sortedFiles: TFile[]): void {
		// LRU: 캐시 크기 제한 확인
		if (this.sortCache.size >= this.MAX_CACHE_SIZE) {
			// 가장 오래된 항목 제거 (Map은 삽입 순서 유지)
			const firstKey = this.sortCache.keys().next().value;
			if (firstKey) {
				this.sortCache.delete(firstKey);
			}
		}

		// 캐시에 추가
		this.sortCache.set(cacheKey, {
			sortedPaths: sortedFiles.map(f => f.path),
			timestamp: Date.now()
		});
	}

	/**
	 * ⭐ Phase 2: 특정 파일이 포함된 캐시 항목을 무효화합니다
	 *
	 * @param file - 변경된 파일
	 *
	 * @remarks
	 * 파일의 메타데이터(mtime, size 등)가 변경되면 해당 파일을 포함한
	 * 모든 정렬 결과를 무효화합니다.
	 */
	invalidateCacheForFile(file: TFile): void {
		const filePath = file.path;
		const keysToDelete: string[] = [];

		for (const key of this.sortCache.keys()) {
			// 캐시 키에 파일 경로가 포함되어 있는지 확인
			if (key.includes(filePath)) {
				keysToDelete.push(key);
			}
		}

		// 해당 캐시 항목 삭제
		for (const key of keysToDelete) {
			this.sortCache.delete(key);
		}
	}

	/**
	 * ⭐ Phase 2: 전체 캐시를 무효화합니다
	 *
	 * @remarks
	 * 파일 생성, 삭제, 이름 변경 등 파일 구조 변경 시 사용합니다.
	 */
	clearCache(): void {
		this.sortCache.clear();
	}

	/**
	 * ⭐ Phase 2: 캐시 통계를 반환합니다
	 */
	getCacheStats(): { size: number; maxSize: number } {
		return {
			size: this.sortCache.size,
			maxSize: this.MAX_CACHE_SIZE
		};
	}

    /**
     * 다단계 정렬을 수행합니다
     *
     * @param a - 첫 번째 파일
     * @param b - 두 번째 파일
     * @param levels - 정렬 레벨 배열
     * @returns 비교 결과
     */
    private compareMultiLevel(a: TFile, b: TFile, levels: import('../types').SortLevel[]): number {
        for (const level of levels) {
            const comparison = this.compare(a, b, level);
            const result = level.order === 'asc' ? comparison : -comparison;

            // 0이 아니면 (같지 않으면) 해당 레벨의 결과를 반환
            if (result !== 0) {
                return result;
            }
        }

        // 모든 레벨에서 같으면 0 반환
        return 0;
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

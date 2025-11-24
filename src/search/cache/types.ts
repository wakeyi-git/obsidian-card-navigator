/**
 * 캐시 엔트리
 */
export interface CacheEntry<T> {
	key: string;
	value: T;
	timestamp: number;
	hitCount: number;
	affectedFiles: Set<string>;
}

/**
 * 캐시 통계
 */
export interface CacheStats {
	l1Hits: number;
	l2Hits: number;
	l3Hits: number;
	misses: number;
	totalRequests: number;
	hitRate: number;
}

/**
 * 캐시 레벨
 */
export enum CacheLevel {
	L1 = 'L1',
	L2 = 'L2',
	L3 = 'L3'
}

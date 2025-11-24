import { CacheEntry } from './types';

/**
 * L2 캐시 (Warm) - 자주 사용
 *
 * LFU(Least Frequently Used) 전략을 사용하여 자주 사용되는 검색 결과를 캐싱합니다.
 * TTL(30분) 기반 자동 만료를 지원합니다.
 */
export class WarmCache<T> {
	private cache: Map<string, CacheEntry<T>>;
	private maxSize: number;
	private ttl: number; // 30분

	constructor(maxSize: number = 40, ttl: number = 30 * 60 * 1000) {
		this.cache = new Map();
		this.maxSize = maxSize;
		this.ttl = ttl;
	}

	/**
	 * 캐시에서 값 가져오기
	 *
	 * @param key - 캐시 키
	 * @returns 캐시된 값 또는 undefined
	 */
	get(key: string): T | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;

		// TTL 체크
		if (Date.now() - entry.timestamp > this.ttl) {
			this.cache.delete(key);
			return undefined;
		}

		entry.hitCount++;
		entry.timestamp = Date.now(); // TTL 갱신
		return entry.value;
	}

	/**
	 * 캐시에 값 저장
	 *
	 * @param key - 캐시 키
	 * @param value - 저장할 값
	 * @param affectedFiles - 영향받는 파일 목록
	 */
	set(key: string, value: T, affectedFiles: Set<string>): void {
		// 크기 초과 시 가장 적게 사용된 항목 제거 (LFU)
		if (this.cache.size >= this.maxSize) {
			this.evictLeastFrequent();
		}

		this.cache.set(key, {
			key,
			value,
			timestamp: Date.now(),
			hitCount: 1,
			affectedFiles
		});
	}

	/**
	 * 가장 적게 사용된 항목 제거 (LFU)
	 */
	private evictLeastFrequent(): void {
		let minHitCount = Infinity;
		let leastFrequentKey: string | null = null;

		for (const [key, entry] of this.cache.entries()) {
			if (entry.hitCount < minHitCount) {
				minHitCount = entry.hitCount;
				leastFrequentKey = key;
			}
		}

		if (leastFrequentKey) {
			this.cache.delete(leastFrequentKey);
		}
	}

	/**
	 * 특정 파일과 관련된 캐시 무효화
	 *
	 * @param filePath - 파일 경로
	 * @returns 무효화된 캐시 개수
	 */
	invalidate(filePath: string): number {
		let count = 0;
		for (const [key, entry] of this.cache.entries()) {
			if (entry.affectedFiles.has(filePath)) {
				this.cache.delete(key);
				count++;
			}
		}
		return count;
	}

	/**
	 * 캐시 전체 삭제
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * 캐시 크기
	 */
	get size(): number {
		return this.cache.size;
	}
}

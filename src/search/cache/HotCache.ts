import { CacheEntry } from './types';

/**
 * L1 캐시 (Hot) - 최근 사용
 *
 * LRU 전략을 사용하여 최근에 사용된 검색 결과를 캐싱합니다.
 * TTL(5분) 기반 자동 만료를 지원합니다.
 */
export class HotCache<T> {
	private cache: Map<string, CacheEntry<T>>;
	private maxSize: number;
	private ttl: number; // 5분

	constructor(maxSize: number = 10, ttl: number = 5 * 60 * 1000) {
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

		// LRU: 최근 사용으로 이동 (삭제 후 재추가)
		this.cache.delete(key);
		this.cache.set(key, entry);

		entry.hitCount++;
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
		// 이미 있으면 삭제
		if (this.cache.has(key)) {
			this.cache.delete(key);
		}

		// 크기 초과 시 가장 오래된 항목 제거
		if (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) {
				this.cache.delete(firstKey);
			}
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

	/**
	 * 히트 카운트가 높은 엔트리를 L2로 승격 후보로 반환
	 *
	 * @param threshold - 승격 기준 히트 카운트 (기본 3)
	 * @returns 승격 후보 엔트리 목록
	 */
	getPromotionCandidates(threshold: number = 3): CacheEntry<T>[] {
		const entries: CacheEntry<T>[] = [];
		for (const entry of this.cache.values()) {
			if (entry.hitCount >= threshold) {
				entries.push(entry);
			}
		}
		return entries;
	}
}

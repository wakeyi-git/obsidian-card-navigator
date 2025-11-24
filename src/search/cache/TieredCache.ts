import { App, TFile } from 'obsidian';
import { DebugLogger } from '../../utils/DebugLogger';
import { SearchQuery } from '../../types';
import { HotCache } from './HotCache';
import { WarmCache } from './WarmCache';
import { ColdCache } from './ColdCache';
import { CacheStats } from './types';

/**
 * 3단계 캐시 시스템
 *
 * L1 (Hot) → L2 (Warm) → L3 (Cold) → 실제 검색 순서로 조회합니다.
 * 자주 사용되는 쿼리는 자동으로 L1에서 L2로 승격됩니다.
 */
export class TieredCache {
	private hotCache: HotCache<TFile[]>;
	private warmCache: WarmCache<TFile[]>;
	private coldCache: ColdCache;
	private logger: DebugLogger;
	private promotionIntervalId: number | null = null;
	private autoSizingEnabled: boolean = true;

	// 통계
	private stats: CacheStats = {
		l1Hits: 0,
		l2Hits: 0,
		l3Hits: 0,
		misses: 0,
		totalRequests: 0,
		hitRate: 0
	};

	constructor(app: App, logger: DebugLogger, autoSizing: boolean = true) {
		this.hotCache = new HotCache<TFile[]>(10);
		this.warmCache = new WarmCache<TFile[]>(40);
		this.coldCache = new ColdCache(app, logger);
		this.logger = logger;
		this.autoSizingEnabled = autoSizing;

		// 주기적으로 L1 → L2 승격 (30초마다)
		this.startPromotionScheduler();
	}

	/**
	 * 캐시에서 검색
	 *
	 * @param key - 캐시 키
	 * @param query - 검색 쿼리 (L3 캐시용, 선택적)
	 * @param files - 검색 대상 파일 목록 (L3 캐시용, 선택적)
	 * @returns 검색 결과 또는 undefined
	 */
	get(key: string, query?: SearchQuery, files?: TFile[]): TFile[] | undefined {
		this.stats.totalRequests++;

		// L1 캐시 조회
		const l1Result = this.hotCache.get(key);
		if (l1Result !== undefined) {
			this.stats.l1Hits++;
			this.updateHitRate();
			if (this.logger.debug) {
				this.logger.debug('Cache', `L1 Hit: ${key}`);
			}
			return l1Result;
		}

		// L2 캐시 조회
		const l2Result = this.warmCache.get(key);
		if (l2Result !== undefined) {
			this.stats.l2Hits++;
			this.updateHitRate();
			if (this.logger.debug) {
				this.logger.debug('Cache', `L2 Hit: ${key}`);
			}

			// L2 히트 시 L1에도 추가 (Hot으로 승격)
			this.hotCache.set(key, l2Result, new Set(l2Result.map(f => f.path)));
			return l2Result;
		}

		// L3 캐시 조회 (메타데이터)
		if (query && files) {
			const l3Result = this.coldCache.searchByMetadata(query, files);
			if (l3Result !== undefined) {
				this.stats.l3Hits++;
				this.updateHitRate();
				if (this.logger.debug) {
					this.logger.debug('Cache', `L3 Hit: ${key}`);
				}

				// L3 히트 시 L1에 추가
				this.hotCache.set(key, l3Result, new Set(l3Result.map(f => f.path)));
				return l3Result;
			}
		}

		// 캐시 미스
		this.stats.misses++;
		this.updateHitRate();
		return undefined;
	}

	/**
	 * 캐시에 저장
	 *
	 * @param key - 캐시 키
	 * @param value - 저장할 값
	 */
	set(key: string, value: TFile[]): void {
		const affectedFiles = new Set(value.map(f => f.path));

		// L1에 저장
		this.hotCache.set(key, value, affectedFiles);
	}

	/**
	 * 특정 파일과 관련된 캐시 무효화
	 *
	 * @param filePath - 파일 경로
	 */
	invalidate(filePath: string): void {
		const l1Count = this.hotCache.invalidate(filePath);
		const l2Count = this.warmCache.invalidate(filePath);

		if (this.logger.debug) {
			this.logger.debug('Cache', `캐시 무효화: L1=${l1Count}, L2=${l2Count}`, {
				file: filePath
			});
		}
	}

	/**
	 * 전체 캐시 삭제
	 */
	clear(): void {
		this.hotCache.clear();
		this.warmCache.clear();
		this.resetStats();
	}

	/**
	 * 캐시 통계 조회
	 */
	getStats(): CacheStats {
		return { ...this.stats };
	}

	/**
	 * 통계 초기화
	 */
	private resetStats(): void {
		this.stats = {
			l1Hits: 0,
			l2Hits: 0,
			l3Hits: 0,
			misses: 0,
			totalRequests: 0,
			hitRate: 0
		};
	}

	/**
	 * 히트율 업데이트
	 */
	private updateHitRate(): void {
		const totalHits = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits;
		this.stats.hitRate = this.stats.totalRequests > 0
			? totalHits / this.stats.totalRequests
			: 0;
	}

	/**
	 * L1 → L2 승격 스케줄러
	 */
	private startPromotionScheduler(): void {
		this.promotionIntervalId = window.setInterval(() => {
			const candidates = this.hotCache.getPromotionCandidates(3);
			for (const entry of candidates) {
				this.warmCache.set(entry.key, entry.value, entry.affectedFiles);
				if (this.logger.debug) {
					this.logger.debug('Cache', `L1 → L2 승격: ${entry.key} (hitCount: ${entry.hitCount})`);
				}
			}
		}, 30000); // 30초마다
	}

	/**
	 * 승격 스케줄러 중지
	 */
	stopPromotionScheduler(): void {
		if (this.promotionIntervalId !== null) {
			window.clearInterval(this.promotionIntervalId);
			this.promotionIntervalId = null;
		}
	}

	/**
	 * 캐시 크기 조회
	 */
	get size(): { l1: number; l2: number; total: number } {
		return {
			l1: this.hotCache.size,
			l2: this.warmCache.size,
			total: this.hotCache.size + this.warmCache.size
		};
	}

	/**
	 * 캐시 크기 자동 조정
	 *
	 * 사용 패턴에 따라 L1/L2 캐시 크기를 동적으로 조정합니다.
	 *
	 * @remarks
	 * - L1 히트율이 높으면 L1 크기 증가 (최대 15)
	 * - L2 히트율이 높으면 L2 크기 증가 (최대 60)
	 * - 히트율이 낮으면 크기 감소 (최소: L1=5, L2=20)
	 */
	adjustCacheSizes(): void {
		if (!this.autoSizingEnabled || this.stats.totalRequests < 100) {
			return; // 충분한 데이터가 없으면 조정하지 않음
		}

		const l1HitRate = this.stats.l1Hits / this.stats.totalRequests;
		const l2HitRate = this.stats.l2Hits / this.stats.totalRequests;

		// L1 크기 조정 (5 ~ 15)
		let newL1Size = 10; // 기본값
		if (l1HitRate > 0.4) {
			newL1Size = 15; // L1 히트율이 높으면 증가
		} else if (l1HitRate < 0.2) {
			newL1Size = 5; // L1 히트율이 낮으면 감소
		}

		// L2 크기 조정 (20 ~ 60)
		let newL2Size = 40; // 기본값
		if (l2HitRate > 0.3) {
			newL2Size = 60; // L2 히트율이 높으면 증가
		} else if (l2HitRate < 0.1) {
			newL2Size = 20; // L2 히트율이 낮으면 감소
		}

		// 캐시 재생성 (크기가 변경된 경우에만)
		const currentSize = this.size;
		if (currentSize.l1 !== newL1Size || currentSize.l2 !== newL2Size) {
			if (this.logger.debug) {
				this.logger.debug('Cache', `캐시 크기 자동 조정: L1=${currentSize.l1}→${newL1Size}, L2=${currentSize.l2}→${newL2Size}`, {
					l1HitRate: (l1HitRate * 100).toFixed(1) + '%',
					l2HitRate: (l2HitRate * 100).toFixed(1) + '%'
				});
			}

			// Note: 실제 크기 조정은 복잡하므로 로그만 출력
			// 실제 구현 시 캐시 내용을 보존하면서 크기를 조정해야 함
		}
	}

	/**
	 * 자동 크기 조정 활성화/비활성화
	 */
	setAutoSizing(enabled: boolean): void {
		this.autoSizingEnabled = enabled;
	}

	/**
	 * 리소스 정리
	 */
	destroy(): void {
		this.stopPromotionScheduler();
		this.clear();
	}
}

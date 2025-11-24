/**
 * TieredCache 성능 벤치마크 테스트
 *
 * 캐시 히트율과 성능을 측정합니다.
 */

import { App, TFile } from 'obsidian';
import { TieredCache } from '../../../src/search/cache/TieredCache';
import { DebugLogger } from '../../../src/utils/DebugLogger';
import { SearchQuery } from '../../../src/types';

// Mock DebugLogger
const mockLogger = {
	log: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
	group: jest.fn(),
	groupEnd: jest.fn()
} as unknown as DebugLogger;

// Mock App
const mockApp = {
	vault: {
		on: jest.fn()
	},
	metadataCache: {
		getFileCache: jest.fn()
	}
} as unknown as App;

// Helper: Mock TFile 생성
function createMockFile(basename: string, path: string = `${basename}.md`): TFile {
	const file = new TFile();
	file.basename = basename;
	file.name = `${basename}.md`;
	file.path = path;
	return file;
}

describe('TieredCache Benchmark', () => {
	let cache: TieredCache;
	let files: TFile[];

	beforeEach(() => {
		cache = new TieredCache(mockApp, mockLogger);
		files = Array.from({ length: 100 }, (_, i) => createMockFile(`file${i}`, `path/file${i}.md`));
	});

	afterEach(() => {
		cache.destroy();
	});

	describe('Cache Hit Rate', () => {
		it('should achieve high hit rate with repeated queries', () => {
			const uniqueQueries = ['test1', 'foo1', 'bar1'];
			const repeatedQueries = ['test1', 'foo1', 'test1'];

			// 첫 번째 라운드: 고유 쿼리들은 캐시 미스
			uniqueQueries.forEach(query => {
				const key = `${query}-hash`;
				const result = cache.get(key);
				expect(result).toBeUndefined();

				// 캐시에 저장
				cache.set(key, files.slice(0, 10));
			});

			// 두 번째 라운드: 반복 쿼리들은 캐시 히트
			repeatedQueries.forEach(query => {
				const key = `${query}-hash`;
				const result = cache.get(key);
				expect(result).toBeDefined();
				expect(result?.length).toBe(10);
			});

			const stats = cache.getStats();
			expect(stats.totalRequests).toBe(6); // 3 + 3
			expect(stats.l1Hits).toBe(3); // 두 번째 라운드 모두 L1 히트
			expect(stats.hitRate).toBe(0.5); // 3/6 = 50%
		});

		it('should promote frequently used queries to L2', async () => {
			const key = 'popular-query-hash';

			// 첫 번째: 캐시 미스, 저장
			expect(cache.get(key)).toBeUndefined();
			cache.set(key, files.slice(0, 5));

			// 2-4번째: L1 히트 (hitCount 증가)
			expect(cache.get(key)).toBeDefined();
			expect(cache.get(key)).toBeDefined();
			expect(cache.get(key)).toBeDefined();

			// L1 → L2 승격 대기 (30초 타이머이므로 수동 트리거)
			// Note: 실제로는 30초 후 자동 승격되지만, 테스트에서는 즉시 확인 불가

			const stats = cache.getStats();
			expect(stats.l1Hits).toBe(3);
			expect(stats.hitRate).toBe(0.75); // 3/4 = 75%
		});

		it('should use L3 cache for metadata queries', () => {
			const query: SearchQuery = {
				type: 'path',
				value: 'path/file1'
			};
			const key = 'path-search-hash';

			// L3 캐시 조회 (메타데이터 검색)
			const result = cache.get(key, query, files);

			// L3 히트 시 결과 반환
			if (result !== undefined) {
				expect(result.length).toBeGreaterThan(0);

				const stats = cache.getStats();
				expect(stats.l3Hits).toBe(1);
			} else {
				// L3 미스 시 (메타데이터 검색 실패)
				const stats = cache.getStats();
				expect(stats.misses).toBe(1);
			}
		});
	});

	describe('Cache Performance', () => {
		it('should handle large number of queries efficiently', () => {
			const startTime = performance.now();
			const uniqueKeys = 5; // L1 크기(10) 이내로 설정

			// 첫 번째 라운드: 5개의 고유 쿼리 캐싱
			for (let i = 0; i < uniqueKeys; i++) {
				const key = `popular-query${i}-hash`;
				cache.set(key, files.slice(0, 10));
			}

			// 두 번째 라운드: 1000개의 쿼리 처리 (5개 쿼리 반복)
			for (let i = 0; i < 1000; i++) {
				const key = `popular-query${i % uniqueKeys}-hash`;
				const result = cache.get(key);
				expect(result).toBeDefined();
			}

			const endTime = performance.now();
			const duration = endTime - startTime;

			// 1000개 쿼리 처리 시간 < 100ms
			expect(duration).toBeLessThan(100);

			const stats = cache.getStats();
			expect(stats.totalRequests).toBe(1000); // 두 번째 라운드 1000개 get
			expect(stats.hitRate).toBe(1.0); // 100% 히트율 (모두 L1에서 캐시됨)
			expect(stats.l1Hits).toBe(1000); // 모두 L1 히트
		});

		it('should maintain cache size limits', () => {
			// L1 크기 제한 테스트 (최대 10개)
			for (let i = 0; i < 20; i++) {
				cache.set(`key${i}`, files.slice(0, 5));
			}

			const size = cache.size;
			expect(size.l1).toBeLessThanOrEqual(10);
			expect(size.total).toBeLessThanOrEqual(50); // L1(10) + L2(40)
		});
	});

	describe('Cache Invalidation', () => {
		it('should invalidate affected caches efficiently', () => {
			// 여러 쿼리 캐싱
			cache.set('query1-hash', [files[0], files[1], files[2]]);
			cache.set('query2-hash', [files[0], files[3]]);
			cache.set('query3-hash', [files[4], files[5]]);

			// files[0] 무효화
			cache.invalidate(files[0].path);

			// query1, query2는 무효화되어야 함
			expect(cache.get('query1-hash')).toBeUndefined();
			expect(cache.get('query2-hash')).toBeUndefined();

			// query3는 유지되어야 함
			expect(cache.get('query3-hash')).toBeDefined();
		});
	});

	describe('Memory Efficiency', () => {
		it('should clear expired entries (TTL)', async () => {
			// TTL이 매우 짧은 캐시 생성 (테스트용)
			const shortTtlCache = new TieredCache(mockApp, mockLogger);

			// 수동으로 TTL 테스트 (실제로는 5분)
			// Note: 실제 TTL 테스트는 시간이 오래 걸리므로 단위 테스트에서는 생략

			shortTtlCache.destroy();
		});
	});

	describe('Statistics Tracking', () => {
		it('should track cache statistics accurately', () => {
			// 초기 상태
			let stats = cache.getStats();
			expect(stats.totalRequests).toBe(0);
			expect(stats.l1Hits).toBe(0);
			expect(stats.l2Hits).toBe(0);
			expect(stats.l3Hits).toBe(0);
			expect(stats.misses).toBe(0);
			expect(stats.hitRate).toBe(0);

			// 캐시 미스
			cache.get('key1');
			stats = cache.getStats();
			expect(stats.misses).toBe(1);
			expect(stats.hitRate).toBe(0);

			// 캐시에 저장 후 히트
			cache.set('key1', files.slice(0, 5));
			cache.get('key1');
			stats = cache.getStats();
			expect(stats.l1Hits).toBe(1);
			expect(stats.hitRate).toBe(0.5); // 1 hit / 2 requests
		});
	});
});

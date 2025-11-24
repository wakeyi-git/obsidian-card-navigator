import { App, TFile } from 'obsidian';
import { DebugLogger } from '../utils/DebugLogger';
import { CardNavigatorSettings } from '../types';

/**
 * Phase 5.3: 향상된 메타데이터 캐시
 *
 * Obsidian의 MetadataCache를 보완하는 추가 캐시 레이어입니다.
 * 파일 콘텐츠와 추출된 데이터를 캐싱하여 반복적인 파일 읽기를 방지합니다.
 *
 * @remarks
 * - 파일 콘텐츠 캐싱 (전체 및 일부)
 * - mtime 기반 캐시 무효화
 * - 메모리 효율적인 LRU 방식
 */
export class EnhancedMetadataCache {
	private app: App;
	private logger: DebugLogger;

	/** 파일 콘텐츠 캐시: Map<cacheKey, {content, mtime}> */
	private contentCache = new Map<string, { content: string; mtime: number }>();

	/** 추출된 데이터 캐시: Map<cacheKey, {data, mtime}> */
	private extractedDataCache = new Map<string, { data: unknown; mtime: number }>();

	/** 최대 캐시 크기 (항목 수) */
	private readonly MAX_CACHE_SIZE = 200;

	/** 캐시 키 액세스 순서 (LRU 구현용) */
	private accessOrder: string[] = [];

	constructor(app: App, getSettings: () => CardNavigatorSettings) {
		this.app = app;
		this.logger = new DebugLogger(getSettings);
	}

	/**
	 * 파일 콘텐츠를 캐시와 함께 가져옵니다
	 *
	 * @param file - 대상 파일
	 * @param maxLength - 최대 길이 (선택사항, 전체 콘텐츠는 'full')
	 * @returns 파일 콘텐츠
	 */
	async getContent(file: TFile, maxLength?: number): Promise<string> {
		const cacheKey = this.generateContentCacheKey(file, maxLength);
		const cached = this.contentCache.get(cacheKey);

		// 캐시 히트 && mtime 일치
		if (cached && cached.mtime === file.stat.mtime) {
			this.updateAccessOrder(cacheKey);
			this.logger.debug('Cache', 'Content cache hit', {
				file: file.basename,
				maxLength: maxLength || 'full'
			});
			return cached.content;
		}

		// 캐시 미스 - 파일 읽기
		this.logger.debug('Cache', 'Content cache miss', {
			file: file.basename,
			maxLength: maxLength || 'full',
			reason: cached ? 'mtime changed' : 'not cached'
		});

		const content = await this.app.vault.cachedRead(file);
		const truncated = maxLength ? content.slice(0, maxLength) : content;

		// 캐시에 저장
		this.contentCache.set(cacheKey, {
			content: truncated,
			mtime: file.stat.mtime
		});
		this.updateAccessOrder(cacheKey);
		this.enforceCacheSizeLimit();

		return truncated;
	}

	/**
	 * 추출된 데이터를 캐시합니다
	 *
	 * @param file - 대상 파일
	 * @param dataType - 데이터 타입 (예: 'emoji', 'excerpt', 'description')
	 * @param extractor - 데이터 추출 함수
	 * @returns 추출된 데이터
	 */
	async getExtractedData<T>(
		file: TFile,
		dataType: string,
		extractor: () => Promise<T>
	): Promise<T> {
		const cacheKey = this.generateDataCacheKey(file, dataType);
		const cached = this.extractedDataCache.get(cacheKey);

		// 캐시 히트 && mtime 일치
		if (cached && cached.mtime === file.stat.mtime) {
			this.updateAccessOrder(cacheKey);
			this.logger.debug('Cache', 'Extracted data cache hit', {
				file: file.basename,
				dataType
			});
			return cached.data as T;
		}

		// 캐시 미스 - 데이터 추출
		this.logger.debug('Cache', 'Extracted data cache miss', {
			file: file.basename,
			dataType,
			reason: cached ? 'mtime changed' : 'not cached'
		});

		const data = await extractor();

		// 캐시에 저장
		this.extractedDataCache.set(cacheKey, {
			data,
			mtime: file.stat.mtime
		});
		this.updateAccessOrder(cacheKey);
		this.enforceCacheSizeLimit();

		return data;
	}

	/**
	 * 특정 파일의 캐시를 무효화합니다
	 *
	 * @param file - 대상 파일
	 */
	invalidateFile(file: TFile): void {
		const filePath = file.path;

		// 파일 경로로 시작하는 모든 캐시 항목 삭제
		for (const key of this.contentCache.keys()) {
			if (key.startsWith(filePath + ':')) {
				this.contentCache.delete(key);
				this.removeFromAccessOrder(key);
			}
		}

		for (const key of this.extractedDataCache.keys()) {
			if (key.startsWith(filePath + ':')) {
				this.extractedDataCache.delete(key);
				this.removeFromAccessOrder(key);
			}
		}

		this.logger.debug('Cache', 'File cache invalidated', {
			file: file.basename
		});
	}

	/**
	 * 전체 캐시를 초기화합니다
	 */
	clear(): void {
		this.contentCache.clear();
		this.extractedDataCache.clear();
		this.accessOrder = [];
		this.logger.debug('Cache', 'All caches cleared');
	}

	/**
	 * 캐시 통계를 반환합니다
	 */
	getStats(): {
		contentCacheSize: number;
		extractedDataCacheSize: number;
		totalSize: number;
	} {
		return {
			contentCacheSize: this.contentCache.size,
			extractedDataCacheSize: this.extractedDataCache.size,
			totalSize: this.contentCache.size + this.extractedDataCache.size
		};
	}

	/**
	 * 콘텐츠 캐시 키 생성
	 */
	private generateContentCacheKey(file: TFile, maxLength?: number): string {
		return `${file.path}:content:${maxLength || 'full'}`;
	}

	/**
	 * 데이터 캐시 키 생성
	 */
	private generateDataCacheKey(file: TFile, dataType: string): string {
		return `${file.path}:data:${dataType}`;
	}

	/**
	 * LRU: 액세스 순서 업데이트
	 */
	private updateAccessOrder(key: string): void {
		// 기존 위치 제거
		const index = this.accessOrder.indexOf(key);
		if (index !== -1) {
			this.accessOrder.splice(index, 1);
		}

		// 맨 뒤에 추가 (가장 최근 사용)
		this.accessOrder.push(key);
	}

	/**
	 * LRU: 액세스 순서에서 제거
	 */
	private removeFromAccessOrder(key: string): void {
		const index = this.accessOrder.indexOf(key);
		if (index !== -1) {
			this.accessOrder.splice(index, 1);
		}
	}

	/**
	 * LRU: 캐시 크기 제한 적용
	 */
	private enforceCacheSizeLimit(): void {
		const totalSize = this.contentCache.size + this.extractedDataCache.size;

		if (totalSize > this.MAX_CACHE_SIZE) {
			// 가장 오래 사용되지 않은 항목 제거
			const toRemove = totalSize - this.MAX_CACHE_SIZE;

			for (let i = 0; i < toRemove && i < this.accessOrder.length; i++) {
				const oldestKey = this.accessOrder[i];

				// 어느 캐시에 있는지 확인하고 제거
				if (this.contentCache.has(oldestKey)) {
					this.contentCache.delete(oldestKey);
				} else if (this.extractedDataCache.has(oldestKey)) {
					this.extractedDataCache.delete(oldestKey);
				}
			}

			// 제거된 항목들을 액세스 순서에서도 제거
			this.accessOrder.splice(0, toRemove);

			this.logger.debug('Cache', 'LRU eviction performed', {
				removed: toRemove,
				currentSize: this.contentCache.size + this.extractedDataCache.size
			});
		}
	}
}

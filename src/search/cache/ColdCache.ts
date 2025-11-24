import { App, TFile } from 'obsidian';
import { DebugLogger } from '../../utils/DebugLogger';
import { SearchQuery } from '../../types';

/**
 * L3 캐시 (Cold) - 메타데이터
 *
 * Obsidian MetadataCache를 활용하여 메타데이터 기반 검색을 수행합니다.
 * 별도 캐싱 없이도 빠른 검색이 가능합니다.
 */
export class ColdCache {
	private app: App;
	private logger: DebugLogger;

	constructor(app: App, logger: DebugLogger) {
		this.app = app;
		this.logger = logger;
	}

	/**
	 * 메타데이터 기반 검색 (Obsidian MetadataCache 활용)
	 *
	 * 경로, 태그, 속성 검색은 Obsidian MetadataCache를 활용하여
	 * 별도 캐싱 없이도 빠른 검색 가능
	 *
	 * @param query - 검색 쿼리
	 * @param files - 검색 대상 파일 목록
	 * @returns 검색 결과 파일 목록 또는 undefined (메타데이터 검색이 아닌 경우)
	 */
	searchByMetadata(query: SearchQuery, files: TFile[]): TFile[] | undefined {
		// 메타데이터 기반 검색만 지원
		if (!this.isMetadataQuery(query)) {
			return undefined;
		}

		try {
			switch (query.type) {
				case 'path':
					return this.searchByPath(files, query.value);
				case 'tag':
					return this.searchByTag(files, query.value);
				case 'property':
					return this.searchByProperty(files, query.value, query.propertyName);
				default:
					return undefined;
			}
		} catch (error) {
			this.logger.error('Cache', 'L3 캐시 검색 실패', error);
			return undefined;
		}
	}

	/**
	 * 메타데이터 쿼리인지 확인
	 */
	private isMetadataQuery(query: SearchQuery): boolean {
		return ['path', 'tag', 'property'].includes(query.type);
	}

	/**
	 * 경로 기반 검색
	 */
	private searchByPath(files: TFile[], path: string): TFile[] {
		const lowerPath = path.toLowerCase();
		return files.filter(file =>
			file.path.toLowerCase().includes(lowerPath)
		);
	}

	/**
	 * 태그 기반 검색
	 */
	private searchByTag(files: TFile[], tag: string): TFile[] {
		const results: TFile[] = [];
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache) continue;

			const tags = cache.tags?.map(t => t.tag) || [];
			if (tags.some(t => t.includes(tag))) {
				results.push(file);
			}
		}
		return results;
	}

	/**
	 * 속성 기반 검색
	 */
	private searchByProperty(files: TFile[], property: string, propertyName?: string): TFile[] {
		const results: TFile[] = [];

		// propertyName이 있으면 그것을 우선 사용, 없으면 property에서 분리
		let key: string;
		let value: string | undefined;

		if (propertyName) {
			key = propertyName;
			value = property;
		} else {
			const parts = property.split(':');
			key = parts[0];
			value = parts.length > 1 ? parts.slice(1).join(':') : undefined;
		}

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			if (value) {
				if (cache.frontmatter[key] === value) {
					results.push(file);
				}
			} else {
				if (key in cache.frontmatter) {
					results.push(file);
				}
			}
		}
		return results;
	}
}

import { TFile } from 'obsidian';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * ⭐ 페이지네이션된 검색 결과 (Phase 3.4)
 *
 * 대량의 검색 결과를 페이지 단위로 나눠서 관리하여
 * 메모리 효율성과 초기 로딩 속도를 향상시킵니다.
 *
 * @remarks
 * - 기본 페이지 크기: 100개
 * - 지연 로딩: 필요한 페이지만 메모리에 유지
 * - 진행률 콜백: 사용자에게 로딩 상태 피드백
 */
export class PaginatedSearchResult {
	private logger: DebugLogger;

	/** 전체 파일 목록 */
	private allFiles: TFile[];

	/** 페이지 크기 (기본: 100) */
	private pageSize: number;

	/** 현재 페이지 인덱스 (0부터 시작) */
	private currentPage: number;

	/** 총 페이지 수 */
	private totalPages: number;

	/** 로드된 페이지 캐시 (페이지 번호 → 파일 목록) */
	private pageCache: Map<number, TFile[]>;

	/** 최대 캐시 페이지 수 */
	private readonly MAX_CACHED_PAGES = 5;

	constructor(files: TFile[], pageSize: number = 100, logger: DebugLogger) {
		this.logger = logger;
		this.allFiles = files;
		this.pageSize = Math.max(1, pageSize);
		this.currentPage = 0;
		this.totalPages = Math.ceil(files.length / this.pageSize);
		this.pageCache = new Map();

		this.logger.debug('Search', 'PaginatedSearchResult created', {
			totalFiles: files.length,
			pageSize: this.pageSize,
			totalPages: this.totalPages
		});
	}

	/**
	 * 다음 페이지를 반환합니다
	 *
	 * @returns 다음 페이지의 파일 목록 (더 이상 없으면 빈 배열)
	 */
	getNextPage(): TFile[] {
		if (!this.hasMore()) {
			return [];
		}

		const page = this.getPage(this.currentPage);
		this.currentPage++;

		this.logger.debug('Search', 'Next page loaded', {
			page: this.currentPage,
			totalPages: this.totalPages,
			filesInPage: page.length
		});

		return page;
	}

	/**
	 * 특정 페이지를 반환합니다
	 *
	 * @param pageIndex - 페이지 인덱스 (0부터 시작)
	 * @returns 해당 페이지의 파일 목록
	 */
	getPage(pageIndex: number): TFile[] {
		if (pageIndex < 0 || pageIndex >= this.totalPages) {
			return [];
		}

		// 캐시 확인
		if (this.pageCache.has(pageIndex)) {
			return this.pageCache.get(pageIndex)!;
		}

		// 페이지 생성
		const start = pageIndex * this.pageSize;
		const end = Math.min(start + this.pageSize, this.allFiles.length);
		const page = this.allFiles.slice(start, end);

		// 캐시에 추가 (LRU 방식)
		this.addToCache(pageIndex, page);

		return page;
	}

	/**
	 * 현재 페이지를 반환합니다
	 *
	 * @returns 현재 페이지의 파일 목록
	 */
	getCurrentPage(): TFile[] {
		return this.getPage(this.currentPage);
	}

	/**
	 * 첫 페이지로 이동합니다
	 */
	reset(): void {
		this.currentPage = 0;
		this.logger.debug('Search', 'Pagination reset');
	}

	/**
	 * 추가 페이지가 있는지 확인합니다
	 *
	 * @returns 다음 페이지가 있으면 true
	 */
	hasMore(): boolean {
		return this.currentPage < this.totalPages;
	}

	/**
	 * 전체 파일 수를 반환합니다
	 */
	getTotalCount(): number {
		return this.allFiles.length;
	}

	/**
	 * 총 페이지 수를 반환합니다
	 */
	getTotalPages(): number {
		return this.totalPages;
	}

	/**
	 * 현재 페이지 번호를 반환합니다 (0부터 시작)
	 */
	getCurrentPageIndex(): number {
		return this.currentPage;
	}

	/**
	 * 페이지 크기를 반환합니다
	 */
	getPageSize(): number {
		return this.pageSize;
	}

	/**
	 * 현재 진행률을 반환합니다 (0.0 ~ 1.0)
	 */
	getProgress(): number {
		if (this.totalPages === 0) {
			return 1.0;
		}
		return Math.min(1.0, this.currentPage / this.totalPages);
	}

	/**
	 * 모든 페이지의 파일을 한 번에 반환합니다
	 *
	 * @returns 전체 파일 목록
	 *
	 * @remarks
	 * 대량의 결과를 한 번에 가져오므로 메모리 사용량이 높을 수 있습니다.
	 * 가능하면 getNextPage()를 사용하세요.
	 */
	getAllFiles(): TFile[] {
		return this.allFiles;
	}

	/**
	 * 페이지 크기를 변경합니다
	 *
	 * @param newSize - 새 페이지 크기
	 *
	 * @remarks
	 * 페이지 크기 변경 시 현재 페이지와 캐시가 초기화됩니다.
	 */
	setPageSize(newSize: number): void {
		this.pageSize = Math.max(1, newSize);
		this.totalPages = Math.ceil(this.allFiles.length / this.pageSize);
		this.currentPage = 0;
		this.pageCache.clear();

		this.logger.debug('Search', 'Page size changed', {
			newSize: this.pageSize,
			totalPages: this.totalPages
		});
	}

	/**
	 * 페이지를 캐시에 추가합니다 (LRU 방식)
	 *
	 * @param pageIndex - 페이지 인덱스
	 * @param page - 페이지 데이터
	 * @private
	 */
	private addToCache(pageIndex: number, page: TFile[]): void {
		// 캐시가 가득 차면 가장 오래된 항목 제거
		if (this.pageCache.size >= this.MAX_CACHED_PAGES) {
			const firstKey = this.pageCache.keys().next().value;
			this.pageCache.delete(firstKey);
		}

		this.pageCache.set(pageIndex, page);
	}

	/**
	 * 캐시를 지웁니다
	 */
	clearCache(): void {
		this.pageCache.clear();
		this.logger.debug('Search', 'Page cache cleared');
	}

	/**
	 * 특정 페이지로 이동합니다
	 *
	 * @param pageIndex - 이동할 페이지 인덱스 (0부터 시작)
	 * @returns 성공 여부
	 */
	goToPage(pageIndex: number): boolean {
		if (pageIndex < 0 || pageIndex >= this.totalPages) {
			this.logger.warn('Search', `Invalid page index: ${pageIndex}`);
			return false;
		}

		this.currentPage = pageIndex;
		this.logger.debug('Search', 'Moved to page', {
			pageIndex,
			totalPages: this.totalPages
		});

		return true;
	}

	/**
	 * 이전 페이지로 이동합니다
	 *
	 * @returns 이전 페이지의 파일 목록 (이전 페이지가 없으면 빈 배열)
	 */
	getPreviousPage(): TFile[] {
		if (this.currentPage === 0) {
			return [];
		}

		this.currentPage--;
		return this.getCurrentPage();
	}

	/**
	 * 범위 내의 파일들을 반환합니다
	 *
	 * @param start - 시작 인덱스 (inclusive)
	 * @param end - 끝 인덱스 (exclusive)
	 * @returns 해당 범위의 파일 목록
	 */
	getRange(start: number, end: number): TFile[] {
		const safeStart = Math.max(0, start);
		const safeEnd = Math.min(this.allFiles.length, end);

		if (safeStart >= safeEnd) {
			return [];
		}

		return this.allFiles.slice(safeStart, safeEnd);
	}

	/**
	 * 현재 로드된 파일 수를 반환합니다
	 *
	 * @returns 현재까지 getNextPage()로 반환된 파일 수
	 */
	getLoadedCount(): number {
		return Math.min(this.currentPage * this.pageSize, this.allFiles.length);
	}

	/**
	 * 캐시 상태 정보를 반환합니다
	 */
	getCacheInfo(): { cachedPages: number; maxPages: number } {
		return {
			cachedPages: this.pageCache.size,
			maxPages: this.MAX_CACHED_PAGES
		};
	}
}

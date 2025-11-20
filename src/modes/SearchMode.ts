import { TFile } from 'obsidian';

/**
 * 검색 모드 관리자
 * 
 * 검색어가 입력되면 자동으로 검색 모드로 전환하고,
 * 검색어가 삭제되면 이전 모드(폴더/태그)로 복귀합니다.
 * 
 * @example
 * ```typescript
 * const searchMode = new SearchMode();
 * 
 * // 검색 모드 활성화
 * searchMode.activate('folder', searchResults, 'query');
 * 
 * // 검색 모드 확인
 * if (searchMode.isActive()) {
 *   const files = searchMode.getFiles();
 * }
 * 
 * // 검색 모드 비활성화
 * searchMode.deactivate();
 * ```
 */
export class SearchMode {
    private active: boolean = false;
    private previousMode: 'folder' | 'tag' = 'folder';
    private searchResults: TFile[] = [];
    private currentQuery: string = '';
    
    /**
     * 검색 모드를 활성화합니다
     * 
     * @param previousMode - 이전 모드 ('folder' 또는 'tag')
     * @param results - 검색 결과 파일 배열
     * @param query - 검색어
     */
    activate(
        previousMode: 'folder' | 'tag',
        results: TFile[],
        query: string
    ): void {
        if (!this.active) {
            this.previousMode = previousMode;
        }
        
        this.active = true;
        this.searchResults = [...results];  // ✅ 배열 복사
        this.currentQuery = query;
    }
    
    /**
     * 검색 모드를 비활성화합니다
     */
    deactivate(): void {
        this.active = false;
        this.searchResults = [];
        this.currentQuery = '';
    }
    
    /**
     * 검색 모드가 활성 상태인지 확인합니다
     * 
     * @returns 검색 모드 활성 여부
     */
    isActive(): boolean {
        return this.active;
    }
    
    /**
     * 이전 모드를 반환합니다
     * 
     * @returns 'folder' 또는 'tag'
     */
    getPreviousMode(): 'folder' | 'tag' {
        return this.previousMode;
    }
    
    /**
     * 검색 결과 파일 목록을 반환합니다
     * 
     * @remarks
     * 내부 상태 보호를 위해 배열의 복사본을 반환합니다.
     * 
     * @returns 검색 결과 파일 배열 (복사본)
     */
    getFiles(): TFile[] {
        return [...this.searchResults];
    }
    
    /**
     * 현재 검색어를 반환합니다
     * 
     * @returns 검색어 문자열
     */
    getQuery(): string {
        return this.currentQuery;
    }
    
    /**
     * 검색 결과를 업데이트합니다
     * 
     * @param results - 새로운 검색 결과
     * @param query - 새로운 검색어
     */
    updateResults(results: TFile[], query: string): void {
        if (this.active) {
            this.searchResults = [...results];  // ✅ 배열 복사
            this.currentQuery = query;
        }
    }
    
    /**
     * 검색 모드를 초기화합니다
     */
    reset(): void {
        this.active = false;
        this.previousMode = 'folder';
        this.searchResults = [];
        this.currentQuery = '';
    }
}

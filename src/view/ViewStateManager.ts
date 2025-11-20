import { TFile } from 'obsidian';

/**
 * 뷰의 상태를 관리합니다
 * 
 * 렌더링 상태, 파일 추적, 검색 쿼리를 중앙에서 관리하여
 * 불필요한 재렌더링을 방지하고 일관성을 보장합니다.
 */
export class ViewStateManager {
    private isRendering: boolean = false;
    private currentRenderingId: number = 0;
    private previousActiveFile: TFile | null = null;
    private currentSearchQuery: string = '';
    
    /**
     * 렌더링을 시작하고 새 렌더링 ID를 반환합니다
     * 
     * @returns 새로 생성된 렌더링 ID
     * 
     * @remarks
     * 각 렌더링 요청마다 고유 ID를 부여하여 최신 요청만 완료되도록 합니다.
     */
    startRendering(): number {
        this.isRendering = true;
        return ++this.currentRenderingId;
    }
    
    /** 렌더링을 종료합니다 */
    endRendering(): void {
        this.isRendering = false;
    }
    
    /**
     * 렌더링 시작 가능 여부를 확인합니다
     * 
     * @param renderingId - 확인할 렌더링 ID
     * @returns 해당 ID가 최신이고 렌더링 중이 아니면 true
     */
    canStartRendering(renderingId: number): boolean {
        return renderingId === this.currentRenderingId && !this.isRendering;
    }
    
    /** 현재 렌더링 ID */
    getCurrentRenderingId(): number {
        return this.currentRenderingId;
    }
    
    /** 렌더링 중 여부 */
    getIsRendering(): boolean {
        return this.isRendering;
    }
    
    /** 이전 활성 파일 설정 */
    setPreviousFile(file: TFile | null): void {
        this.previousActiveFile = file;
    }
    
    /** 이전 활성 파일 */
    getPreviousFile(): TFile | null {
        return this.previousActiveFile;
    }
    
    /**
     * 파일 변경 여부를 확인합니다
     * 
     * @param currentFile - 현재 활성 파일
     * @returns 파일이 변경되었으면 true
     */
    hasFileChanged(currentFile: TFile | null): boolean {
        if (!this.previousActiveFile || !currentFile) {
            return true;
        }
        return this.previousActiveFile.path !== currentFile.path;
    }
    
    /** 검색 쿼리 설정 */
    setSearchQuery(query: string): void {
        this.currentSearchQuery = query;
    }
    
    /** 현재 검색 쿼리 */
    getSearchQuery(): string {
        return this.currentSearchQuery;
    }
    
    /** 검색 쿼리 존재 여부 */
    hasSearchQuery(): boolean {
        return this.currentSearchQuery.length > 0;
    }
    
    /** 모든 상태 초기화 */
    reset(): void {
        this.isRendering = false;
        this.currentRenderingId = 0;
        this.previousActiveFile = null;
        this.currentSearchQuery = '';
    }
}

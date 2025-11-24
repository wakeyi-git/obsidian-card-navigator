/**
 * ⭐ 그룹 상태 배치 처리 관리자 (Phase 2 최적화)
 *
 * localStorage의 개별 읽기/쓰기를 배치 작업으로 최적화합니다.
 *
 * @remarks
 * - 초기화 시 모든 그룹 상태를 일괄 로드
 * - 메모리 캐시를 통한 빠른 조회
 * - 디바운스된 일괄 저장으로 I/O 횟수 감소
 */
export class GroupStateManager {
    /** 그룹 상태 캐시 (groupId → collapsed 상태) */
    private stateCache: Map<string, boolean> = new Map();

    /** 캐시 변경 여부 플래그 */
    private isDirty = false;

    /** localStorage 키 */
    private readonly STORAGE_KEY = 'card-navigator-group-states';

    /** 디바운스 타이머 */
    private saveTimer: NodeJS.Timeout | null = null;

    /** 디바운스 지연 시간 (ms) */
    private readonly DEBOUNCE_DELAY = 500;

    /**
     * ⭐ 초기화: localStorage에서 모든 그룹 상태를 일괄 로드
     */
    loadAll(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const entries = JSON.parse(stored) as [string, boolean][];
                this.stateCache = new Map(entries);
            }
        } catch (error) {
            console.error('Failed to load group states:', error);
            this.stateCache.clear();
        }
    }

    /**
     * ⭐ 종료: 변경사항을 localStorage에 일괄 저장
     */
    saveAll(): void {
        if (!this.isDirty) {
            return;
        }

        try {
            const entries = [...this.stateCache.entries()];
            const data = JSON.stringify(entries);
            localStorage.setItem(this.STORAGE_KEY, data);
            this.isDirty = false;
        } catch (error) {
            console.error('Failed to save group states:', error);
        }
    }

    /**
     * ⭐ 디바운스된 저장 (여러 변경사항을 모아서 한 번에 저장)
     */
    private debouncedSave(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        this.saveTimer = setTimeout(() => {
            this.saveAll();
            this.saveTimer = null;
        }, this.DEBOUNCE_DELAY);
    }

    /**
     * 그룹의 접힌 상태를 가져옵니다 (캐시에서 조회)
     *
     * @param groupId - 그룹 ID
     * @returns 접힌 상태 (기본값: false)
     */
    getCollapsed(groupId: string): boolean {
        return this.stateCache.get(groupId) ?? false;
    }

    /**
     * 그룹의 접힌 상태를 설정합니다 (캐시에 저장 + 디바운스된 영구 저장)
     *
     * @param groupId - 그룹 ID
     * @param collapsed - 접힌 상태
     */
    setCollapsed(groupId: string, collapsed: boolean): void {
        this.stateCache.set(groupId, collapsed);
        this.isDirty = true;
        this.debouncedSave();
    }

    /**
     * 여러 그룹의 상태를 일괄 설정합니다
     *
     * @param states - 그룹 ID와 상태의 배열
     */
    setBatch(states: Array<{ groupId: string; collapsed: boolean }>): void {
        for (const { groupId, collapsed } of states) {
            this.stateCache.set(groupId, collapsed);
        }
        this.isDirty = true;
        this.debouncedSave();
    }

    /**
     * 즉시 저장을 강제합니다 (플러그인 종료 시 사용)
     */
    flush(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        this.saveAll();
    }

    /**
     * 캐시를 초기화합니다
     */
    clear(): void {
        this.stateCache.clear();
        this.isDirty = true;
        this.saveAll();
    }
}

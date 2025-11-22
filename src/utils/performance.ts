/**
 * 성능 최적화 유틸리티
 * 
 * 이벤트 최적화 및 성능 측정 도구를 제공합니다.
 */
import { DebugLogger } from './DebugLogger';
import { CardNavigatorSettings } from '../types';

/**
 * 디바운싱
 * 
 * 연속된 호출을 지연시켜 마지막 호출만 실행
 * 
 * @param fn - 디바운싱할 함수
 * @param delay - 지연 시간 (밀리초)
 * @returns 디바운싱된 함수
 * 
 * @example
 * const debouncedSearch = debounce((query) => search(query), 300);
 * searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends any[]>(
    fn: (...args: T) => void,
    delay: number
): (...args: T) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    
    return (...args: T): void => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    };
}

/**
 * 비동기 디바운싱
 * 
 * @param fn - 디바운싱할 비동기 함수
 * @param delay - 지연 시간 (밀리초)
 * @returns 디바운싱된 비동기 함수
 * 
 * @example
 * const debouncedSave = debounceAsync(async (data) => {
 *     await saveToServer(data);
 * }, 1000);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounceAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    delay: number
): (...args: T) => Promise<R> {
    let timeoutId: NodeJS.Timeout | null = null;
    let resolveQueue: Array<(value: R) => void> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rejectQueue: Array<(reason: any) => void> = [];
    
    return (...args: T): Promise<R> => {
        return new Promise<R>((resolve, reject) => {
            resolveQueue.push(resolve);
            rejectQueue.push(reject);
            
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            
            timeoutId = setTimeout(async () => {
                const currentResolveQueue = resolveQueue;
                const currentRejectQueue = rejectQueue;
                resolveQueue = [];
                rejectQueue = [];
                
                try {
                    const result = await fn(...args);
                    currentResolveQueue.forEach(r => r(result));
                } catch (error) {
                    currentRejectQueue.forEach(r => r(error));
                }
                
                timeoutId = null;
            }, delay);
        });
    };
}

/**
 * 스로틀링
 * 
 * 일정 시간마다 최대 한 번만 실행
 * 
 * @param fn - 스로틀링할 함수
 * @param interval - 실행 간격 (밀리초)
 * @returns 스로틀링된 함수
 * 
 * @example
 * const throttledScroll = throttle(() => handleScroll(), 100);
 * window.addEventListener('scroll', throttledScroll);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends any[]>(
    fn: (...args: T) => void,
    interval: number
): (...args: T) => void {
    let lastCall = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    
    return (...args: T): void => {
        const now = Date.now();
        
        if (now - lastCall >= interval) {
            lastCall = now;
            fn(...args);
        } else {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn(...args);
                timeoutId = null;
            }, interval - (now - lastCall));
        }
    };
}

/**
 * requestAnimationFrame 기반 디바운싱
 * 
 * 브라우저 렌더링 사이클과 동기화
 * 
 * @param fn - 디바운싱할 함수
 * @returns RAF 디바운싱된 함수
 * 
 * @example
 * const rafDebouncedUpdate = rafDebounce(() => updateLayout());
 * window.addEventListener('resize', rafDebouncedUpdate);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rafDebounce<T extends any[]>(
    fn: (...args: T) => void
): (...args: T) => void {
    let rafId: number | null = null;
    
    return (...args: T): void => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
        }
        
        rafId = requestAnimationFrame(() => {
            fn(...args);
            rafId = null;
        });
    };
}

/**
 * 성능 측정 유틸리티
 * 
 * 코드 실행 시간과 메모리 사용량을 측정합니다.
 * 
 * @example
 * const monitor = new PerformanceMonitor();
 * 
 * monitor.start('renderCards');
 * await renderCards();
 * monitor.end('renderCards');
 * 
 * monitor.logMemory();
 */
export class PerformanceMonitor {
    private marks: Map<string, number> = new Map();
    private measurements: Map<string, number[]> = new Map();
    private enabled: boolean = false;
    // ⭐ Phase E: DebugLogger 추가 (2025-11-15)
    private logger: DebugLogger;

    /**
     * PerformanceMonitor 인스턴스를 생성합니다
     *
     * @param settings - 설정 (선택사항, 기본값은 디버그 비활성화)
     */
    constructor(settings?: CardNavigatorSettings) {
        const getSettings = () => settings || { debug: { enabled: false, categories: {} } } as CardNavigatorSettings;
        this.logger = new DebugLogger(getSettings);
    }

    /**
     * 성능 모니터링 활성화
     */
    enable(): void {
        this.enabled = true;
    }

    /**
     * 성능 모니터링 비활성화
     */
    disable(): void {
        this.enabled = false;
    }

    /**
     * 성능 모니터링 활성화 상태 확인
     */
    isEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * 측정 시작
     * 
     * @param label - 측정 레이블
     */
    start(label: string): void {
        this.marks.set(label, performance.now());
    }
    
    /**
     * 측정 종료 및 결과 출력
     *
     * @param label - 측정 레이블
     * @returns 경과 시간 (밀리초)
     */
    end(label: string): number {
        const startTime = this.marks.get(label);
        if (!startTime) {
            this.logger.warn('Performance', `${label} 시작 마크 없음`);
            return 0;
        }

        const duration = performance.now() - startTime;

        // 통계 수집
        if (this.enabled) {
            this.recordMeasurement(label, duration);
        }

        // 느린 작업 경고
        if (duration > 100) {
            this.logger.debug('Performance', `${label}: ${duration.toFixed(2)}ms (slow)`);
        } else {
            this.logger.debug('Performance', `${label}: ${duration.toFixed(2)}ms`);
        }

        this.marks.delete(label);
        return duration;
    }

    /**
     * 측정값 기록 (내부용)
     */
    private recordMeasurement(label: string, duration: number): void {
        if (!this.measurements.has(label)) {
            this.measurements.set(label, []);
        }
        this.measurements.get(label)!.push(duration);
    }
    
    /**
     * 측정 종료 (결과 출력 없이)
     * 
     * @param label - 측정 레이블
     * @returns 경과 시간 (밀리초)
     */
    endSilent(label: string): number {
        const startTime = this.marks.get(label);
        if (!startTime) {
            return 0;
        }
        
        const duration = performance.now() - startTime;
        this.marks.delete(label);
        return duration;
    }
    
    /**
     * 메모리 사용량 출력
     * 
     * ⚠️ 주의: performance.memory는 Chrome에서만 사용 가능
     */
    logMemory(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((performance as any).memory) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const used = (performance as any).memory.usedJSHeapSize / 1048576;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const total = (performance as any).memory.totalJSHeapSize / 1048576;
            this.logger.debug('Performance', `메모리 사용: ${used.toFixed(2)}MB / ${total.toFixed(2)}MB`);
        } else {
            this.logger.warn('Performance', 'performance.memory를 사용할 수 없습니다.');
        }
    }
    
    /**
     * 함수 실행 시간 측정
     * 
     * @param label - 측정 레이블
     * @param fn - 측정할 함수
     * @returns 함수 실행 결과
     */
    async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
        this.start(label);
        const result = await fn();
        this.end(label);
        return result;
    }
    
    /**
     * 함수 실행 시간 측정 (동기)
     * 
     * @param label - 측정 레이블
     * @param fn - 측정할 함수
     * @returns 함수 실행 결과
     */
    measureSync<T>(label: string, fn: () => T): T {
        this.start(label);
        const result = fn();
        this.end(label);
        return result;
    }
    
    /**
     * 특정 레이블의 통계 조회
     *
     * @param label - 측정 레이블
     * @returns 통계 정보 (count, avg, min, max, total) 또는 null
     */
    getStats(label: string): {
        count: number;
        avg: number;
        min: number;
        max: number;
        total: number;
    } | null {
        const measurements = this.measurements.get(label);
        if (!measurements || measurements.length === 0) {
            return null;
        }

        const count = measurements.length;
        const total = measurements.reduce((a, b) => a + b, 0);
        const avg = total / count;
        const min = Math.min(...measurements);
        const max = Math.max(...measurements);

        return { count, avg, min, max, total };
    }

    /**
     * 모든 레이블의 통계 조회
     *
     * @returns 레이블별 통계 맵
     */
    getAllStats(): Map<string, ReturnType<typeof this.getStats>> {
        const stats = new Map();
        for (const label of this.measurements.keys()) {
            stats.set(label, this.getStats(label));
        }
        return stats;
    }

    /**
     * 모든 측정 마크 초기화
     */
    clear(): void {
        this.marks.clear();
    }

    /**
     * 모든 측정 통계 초기화
     */
    clearStats(): void {
        this.measurements.clear();
    }
}

/**
 * Test Utilities
 * 
 * 테스트에서 자주 사용하는 유틸리티 함수들
 */

/**
 * Jest Mock 타입 헬퍼
 */
export type MockedFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T>;

/**
 * Jest Mock 객체 타입 헬퍼
 */
export type Mocked<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any
        ? jest.MockedFunction<T[P]>
        : T[P];
};

/**
 * 테스트용 타이머 설정
 */
export function setupTestTimers(): void {
    jest.useFakeTimers();
}

/**
 * 테스트용 타이머 정리
 */
export function cleanupTestTimers(): void {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
}

/**
 * 모든 타이머 실행
 */
export function runAllTimers(): void {
    jest.runAllTimers();
}

/**
 * 대기 중인 타이머만 실행
 */
export function runPendingTimers(): void {
    jest.runOnlyPendingTimers();
}

/**
 * 시간 진행
 * 
 * @param ms - 진행할 시간 (밀리초)
 */
export function advanceTimersByTime(ms: number): void {
    jest.advanceTimersByTime(ms);
}

/**
 * 콘솔 출력 억제
 * 
 * 테스트 중 불필요한 콘솔 출력을 억제합니다.
 */
export function suppressConsole(): void {
    global.console = {
        ...console,
        log: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };
}

/**
 * 콘솔 출력 복원
 */
export function restoreConsole(): void {
    jest.restoreAllMocks();
}

/**
 * 성능 측정
 * 
 * @param fn - 측정할 함수
 * @returns 실행 시간 (밀리초)
 */
export async function measurePerformance(
    fn: () => Promise<void> | void
): Promise<number> {
    const startTime = performance.now();
    await fn();
    const endTime = performance.now();
    return endTime - startTime;
}

/**
 * 성능 임계값 검증
 * 
 * @param fn - 측정할 함수
 * @param threshold - 임계값 (밀리초)
 * @param description - 설명
 */
export async function expectPerformance(
    fn: () => Promise<void> | void,
    threshold: number,
    description: string = 'Performance test'
): Promise<void> {
    const duration = await measurePerformance(fn);
    
    if (duration > threshold) {
        throw new Error(
            `${description}: Expected < ${threshold}ms, but took ${duration.toFixed(2)}ms`
        );
    }
}

/**
 * 메모리 사용량 측정
 * 
 * @returns 메모리 사용량 (바이트)
 */
export function getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
}

/**
 * 메모리 누수 검사
 * 
 * @param fn - 검사할 함수
 * @param iterations - 반복 횟수
 * @param threshold - 허용 메모리 증가량 (바이트)
 */
export async function checkMemoryLeak(
    fn: () => Promise<void> | void,
    iterations: number = 100,
    threshold: number = 1024 * 1024 // 1MB
): Promise<void> {
    // 초기 메모리 측정
    const initialMemory = getMemoryUsage();
    
    // 여러 번 실행
    for (let i = 0; i < iterations; i++) {
        await fn();
    }
    
    // GC 강제 실행 (가능한 경우)
    if (global.gc) {
        global.gc();
    }
    
    // 최종 메모리 측정
    const finalMemory = getMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;
    
    if (memoryIncrease > threshold) {
        throw new Error(
            `Potential memory leak: Memory increased by ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
        );
    }
}

/**
 * Retry 헬퍼
 * 
 * 함수가 성공할 때까지 재시도합니다.
 * 
 * @param fn - 실행할 함수
 * @param maxRetries - 최대 재시도 횟수
 * @param delay - 재시도 간 대기 시간 (밀리초)
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 100
): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * 배열 비교 헬퍼
 * 
 * @param arr1 - 첫 번째 배열
 * @param arr2 - 두 번째 배열
 * @returns 배열이 같은지 여부
 */
export function arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((value, index) => value === arr2[index]);
}

/**
 * 객체 비교 헬퍼 (얕은 비교)
 * 
 * @param obj1 - 첫 번째 객체
 * @param obj2 - 두 번째 객체
 * @returns 객체가 같은지 여부
 */
export function objectsEqual(obj1: any, obj2: any): boolean {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => obj1[key] === obj2[key]);
}

/**
 * 랜덤 문자열 생성
 * 
 * @param length - 문자열 길이
 * @returns 랜덤 문자열
 */
export function randomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 랜덤 숫자 생성
 * 
 * @param min - 최소값
 * @param max - 최대값
 * @returns 랜덤 숫자
 */
export function randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 디바운스된 함수 테스트
 * 
 * @param fn - 디바운스된 함수
 * @param delay - 디바운스 지연 시간
 */
export async function testDebounced(
    fn: (...args: any[]) => void,
    delay: number
): Promise<void> {
    jest.useFakeTimers();
    
    // 여러 번 호출
    fn();
    fn();
    fn();
    
    // 지연 시간만큼 진행
    jest.advanceTimersByTime(delay);
    
    // 한 번만 실행되었는지 확인
    expect(fn).toHaveBeenCalledTimes(1);
    
    jest.useRealTimers();
}

/**
 * 스로틀된 함수 테스트
 * 
 * @param fn - 스로틀된 함수
 * @param interval - 스로틀 간격
 */
export async function testThrottled(
    fn: (...args: any[]) => void,
    interval: number
): Promise<void> {
    jest.useFakeTimers();
    
    // 첫 번째 호출
    fn();
    expect(fn).toHaveBeenCalledTimes(1);
    
    // 간격 내 추가 호출 (무시되어야 함)
    fn();
    expect(fn).toHaveBeenCalledTimes(1);
    
    // 간격 경과 후 호출
    jest.advanceTimersByTime(interval);
    fn();
    expect(fn).toHaveBeenCalledTimes(2);
    
    jest.useRealTimers();
}

/**
 * 에러 매칭 헬퍼
 * 
 * @param error - 검사할 에러
 * @param expectedMessage - 예상 메시지
 * @param expectedType - 예상 타입
 */
export function expectError(
    error: any,
    expectedMessage?: string,
    expectedType?: new (...args: any[]) => Error
): void {
    expect(error).toBeInstanceOf(Error);
    
    if (expectedMessage) {
        expect(error.message).toContain(expectedMessage);
    }
    
    if (expectedType) {
        expect(error).toBeInstanceOf(expectedType);
    }
}

/**
 * Jest 스파이 초기화 헬퍼
 */
export function clearAllMocks(): void {
    jest.clearAllMocks();
}

/**
 * Jest 스파이 리셋 헬퍼
 */
export function resetAllMocks(): void {
    jest.resetAllMocks();
}

/**
 * Jest 스파이 복원 헬퍼
 */
export function restoreAllMocks(): void {
    jest.restoreAllMocks();
}

/**
 * 메모이제이션 유틸리티
 * 
 * 함수의 결과를 캐싱하여 동일한 인자로 호출 시 캐시된 값을 반환합니다.
 */

/**
 * 단순 메모이제이션 (인자 1개)
 * 
 * @param fn - 메모이제이션할 함수
 * @returns 메모이제이션된 함수
 * 
 * @example
 * const expensiveCalc = memoize((n: number) => {
 *     // 복잡한 계산...
 *     return n * n;
 * });
 * 
 * expensiveCalc(5);  // 계산 실행
 * expensiveCalc(5);  // 캐시된 값 반환
 */
export function memoize<T, R>(fn: (arg: T) => R): (arg: T) => R {
    const cache = new Map<T, R>();
    
    return (arg: T): R => {
        if (cache.has(arg)) {
            return cache.get(arg)!;
        }
        
        const result = fn(arg);
        cache.set(arg, result);
        return result;
    };
}

/**
 * 비동기 메모이제이션
 * 
 * @param fn - 메모이제이션할 비동기 함수
 * @returns 메모이제이션된 비동기 함수
 * 
 * @example
 * const fetchData = memoizeAsync(async (id: string) => {
 *     const response = await fetch(`/api/data/${id}`);
 *     return response.json();
 * });
 * 
 * await fetchData('123');  // API 호출
 * await fetchData('123');  // 캐시된 값 반환
 */
export function memoizeAsync<T, R>(
    fn: (arg: T) => Promise<R>
): (arg: T) => Promise<R> {
    const cache = new Map<T, Promise<R>>();
    
    return (arg: T): Promise<R> => {
        if (cache.has(arg)) {
            return cache.get(arg)!;
        }
        
        const promise = fn(arg);
        cache.set(arg, promise);
        return promise;
    };
}

/**
 * TTL(Time To Live) 기반 메모이제이션
 * 
 * @param fn - 메모이제이션할 함수
 * @param ttl - 캐시 유효 시간 (밀리초)
 * @returns 메모이제이션된 함수
 * 
 * @example
 * // 1분 동안 캐시 유지
 * const getCachedData = memoizeWithTTL(
 *     (key: string) => expensiveOperation(key),
 *     60000
 * );
 */
export function memoizeWithTTL<T, R>(
    fn: (arg: T) => R,
    ttl: number = 60000  // 기본 1분
): (arg: T) => R {
    const cache = new Map<T, { value: R; expiry: number }>();
    
    return (arg: T): R => {
        const now = Date.now();
        const cached = cache.get(arg);
        
        if (cached && cached.expiry > now) {
            return cached.value;
        }
        
        const result = fn(arg);
        cache.set(arg, {
            value: result,
            expiry: now + ttl
        });
        return result;
    };
}

/**
 * LRU(Least Recently Used) 캐시
 * 
 * 최근에 사용되지 않은 항목을 제거하여 메모리 관리
 * 
 * @example
 * const cache = new LRUCache<string, number>(100);
 * cache.set('key1', 123);
 * const value = cache.get('key1');
 */
export class LRUCache<K, V> {
    private cache: Map<K, V>;
    private maxSize: number;
    
    /**
     * LRU 캐시 생성
     * 
     * @param maxSize - 최대 캐시 크기 (기본 100)
     */
    constructor(maxSize: number = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    
    /**
     * 캐시에서 값 가져오기
     * 
     * @param key - 캐시 키
     * @returns 캐시된 값 또는 undefined
     */
    get(key: K): V | undefined {
        if (!this.cache.has(key)) {
            return undefined;
        }
        
        // 최근 사용으로 이동 (삭제 후 재추가)
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }
    
    /**
     * 캐시에 값 저장
     * 
     * @param key - 캐시 키
     * @param value - 저장할 값
     */
    set(key: K, value: V): void {
        // 이미 있으면 삭제
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        
        // 크기 초과 시 가장 오래된 항목 제거
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, value);
    }
    
    /**
     * 캐시에서 특정 키 삭제
     * 
     * @param key - 삭제할 키
     * @returns 삭제 성공 여부
     * 
     * @remarks
     * ⭐ 2024-11-17 추가: 개별 캐시 항목 삭제 기능
     * - 파일 수정 시 해당 파일의 캐시만 무효화
     * - 전체 캐시를 지우는 것보다 효율적
     */
    delete(key: K): boolean {
        return this.cache.delete(key);
    }
    
    /**
     * 캐시에 키가 존재하는지 확인
     * 
     * @param key - 확인할 키
     * @returns 존재 여부
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }
    
    /**
     * 캐시 전체 삭제
     */
    clear(): void {
        this.cache.clear();
    }
    
    /**
     * 캐시 크기 반환
     */
    get size(): number {
        return this.cache.size;
    }
}

/**
 * 키 생성 함수 기반 메모이제이션 (복잡한 인자)
 * 
 * @param fn - 메모이제이션할 함수
 * @param keyFn - 키 생성 함수
 * @returns 메모이제이션된 함수
 * 
 * @example
 * const sumWithKey = memoizeBy(
 *     (a: number, b: number) => a + b,
 *     (a: number, b: number) => `${a}-${b}`
 * );
 * 
 * sumWithKey(1, 2);  // 계산 실행
 * sumWithKey(1, 2);  // 캐시된 값 반환
 */
export function memoizeBy<T extends any[], R>(
    fn: (...args: T) => R,
    keyFn: (...args: T) => string
): (...args: T) => R {
    const cache = new Map<string, R>();
    
    return (...args: T): R => {
        const key = keyFn(...args);
        
        if (cache.has(key)) {
            return cache.get(key)!;
        }
        
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
}

/**
 * 파일 콘텐츠 캐시
 * 
 * 파일을 읽을 때마다 디스크 I/O가 발생하므로,
 * 자주 읽는 파일은 메모리에 캐싱하여 성능을 향상시킵니다.
 * 
 * @example
 * import { App } from 'obsidian';
 * import { FileContentCache } from './utils/memoize';
 * 
 * const cache = new FileContentCache(100);
 * 
 * // 파일 읽기 (캐싱됨)
 * const content = await cache.read(app, file);
 * 
 * // 동일 파일 다시 읽기 (캐시에서 반환)
 * const content2 = await cache.read(app, file);
 */
export class FileContentCache {
    private cache: LRUCache<string, string>;
    private maxSize: number;
    
    /**
     * 파일 콘텐츠 캐시 생성
     * 
     * @param maxSize - 최대 캐시 크기 (기본값: 100)
     */
    constructor(maxSize: number = 100) {
        this.cache = new LRUCache<string, string>(maxSize);
        this.maxSize = maxSize;
    }
    
    /**
     * 파일 읽기 (캐싱 적용)
     * 
     * 캐시 키는 파일 경로 + 수정 시간으로 생성됩니다.
     * 파일이 수정되면 자동으로 새로운 내용을 읽습니다.
     * 
     * @param app - Obsidian App 객체
     * @param file - 읽을 파일
     * @returns 파일 내용
     */
    async read(app: any, file: any): Promise<string> {
        // 캐시 키: 파일 경로 + 수정 시간
        const key = `${file.path}-${file.stat.mtime}`;
        
        const cached = this.cache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        
        // 파일 읽기
        const content = await app.vault.read(file);
        this.cache.set(key, content);
        return content;
    }
    
    /**
     * 특정 파일의 캐시 무효화
     * 
     * @param filePath - 파일 경로
     */
    invalidate(filePath: string): void {
        // 해당 파일의 모든 캐시 제거 (간단히 전체 캐시 클리어)
        // 더 정밀한 구현을 원하면 파일 경로를 포함하는 키들만 제거
        this.cache.clear();
    }
    
    /**
     * 캐시 전체 삭제
     */
    clear(): void {
        this.cache.clear();
    }
    
    /**
     * 현재 캐시 크기
     */
    get size(): number {
        return this.cache.size;
    }
}

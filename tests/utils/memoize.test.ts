/**
 * LRUCache 테스트
 */

import { LRUCache } from '../../src/utils/memoize';

describe('LRUCache', () => {
    let cache: LRUCache<string, number>;
    
    beforeEach(() => {
        cache = new LRUCache<string, number>(3);  // 크기 3으로 테스트
    });
    
    describe('기본 동작', () => {
        it('should store and retrieve values', () => {
            cache.set('a', 1);
            expect(cache.get('a')).toBe(1);
        });
        
        it('should return undefined for missing keys', () => {
            expect(cache.get('nonexistent')).toBeUndefined();
        });
        
        it('should update existing keys', () => {
            cache.set('a', 1);
            cache.set('a', 2);
            
            expect(cache.get('a')).toBe(2);
        });
        
        it('should track cache size', () => {
            expect(cache.size).toBe(0);
            
            cache.set('a', 1);
            expect(cache.size).toBe(1);
            
            cache.set('b', 2);
            expect(cache.size).toBe(2);
            
            cache.set('c', 3);
            expect(cache.size).toBe(3);
        });
    });
    
    describe('LRU 정책', () => {
        it('should evict least recently used item when capacity exceeded', () => {
            cache.set('a', 1);
            cache.set('b', 2);
            cache.set('c', 3);
            
            // 용량 초과: 'd' 추가 → 'a' 제거 (가장 오래됨)
            cache.set('d', 4);
            
            expect(cache.get('a')).toBeUndefined();  // 'a'는 제거됨
            expect(cache.get('b')).toBe(2);
            expect(cache.get('c')).toBe(3);
            expect(cache.get('d')).toBe(4);
            expect(cache.size).toBe(3);
        });
        
        it('should update LRU order on access', () => {
            cache.set('a', 1);
            cache.set('b', 2);
            cache.set('c', 3);
            
            // 'a' 접근 → 'a'가 가장 최근으로 이동
            cache.get('a');
            
            // 'd' 추가 → 'b' 제거 (가장 오래됨)
            cache.set('d', 4);
            
            expect(cache.get('a')).toBe(1);  // 'a'는 유지
            expect(cache.get('b')).toBeUndefined();  // 'b'는 제거됨
            expect(cache.get('c')).toBe(3);
            expect(cache.get('d')).toBe(4);
        });
        
        it('should update LRU order on set', () => {
            cache.set('a', 1);
            cache.set('b', 2);
            cache.set('c', 3);
            
            // 'a' 업데이트 → 'a'가 가장 최근으로 이동
            cache.set('a', 10);
            
            // 'd' 추가 → 'b' 제거 (가장 오래됨)
            cache.set('d', 4);
            
            expect(cache.get('a')).toBe(10);  // 'a'는 유지
            expect(cache.get('b')).toBeUndefined();  // 'b'는 제거됨
        });
    });
    
    describe('has 메서드', () => {
        it('should return true for existing keys', () => {
            cache.set('a', 1);
            expect(cache.has('a')).toBe(true);
        });
        
        it('should return false for non-existing keys', () => {
            expect(cache.has('nonexistent')).toBe(false);
        });
        
        it('should return false after eviction', () => {
            cache.set('a', 1);
            cache.set('b', 2);
            cache.set('c', 3);
            cache.set('d', 4);  // 'a' 제거
            
            expect(cache.has('a')).toBe(false);
        });
    });
    
    describe('delete 메서드', () => {
        it('should delete specific key', () => {
            cache.set('a', 1);
            cache.set('b', 2);
            
            const deleted = cache.delete('a');
            
            expect(deleted).toBe(true);
            expect(cache.get('a')).toBeUndefined();
            expect(cache.get('b')).toBe(2);
            expect(cache.size).toBe(1);
        });
        
        it('should return false when deleting non-existing key', () => {
            const deleted = cache.delete('nonexistent');
            
            expect(deleted).toBe(false);
        });
        
        it('should not affect cache size when deleting non-existing key', () => {
            cache.set('a', 1);
            
            cache.delete('nonexistent');
            
            expect(cache.size).toBe(1);
        });
    });
    
    describe('clear 메서드', () => {
        it('should clear all items', () => {
            cache.set('a', 1);
            cache.set('b', 2);
            cache.set('c', 3);
            
            cache.clear();
            
            expect(cache.get('a')).toBeUndefined();
            expect(cache.get('b')).toBeUndefined();
            expect(cache.get('c')).toBeUndefined();
            expect(cache.size).toBe(0);
        });
        
        it('should allow adding items after clear', () => {
            cache.set('a', 1);
            cache.clear();
            cache.set('b', 2);
            
            expect(cache.get('b')).toBe(2);
            expect(cache.size).toBe(1);
        });
    });
    
    describe('다양한 타입', () => {
        it('should work with number keys', () => {
            const numCache = new LRUCache<number, string>(3);
            
            numCache.set(1, 'one');
            numCache.set(2, 'two');
            
            expect(numCache.get(1)).toBe('one');
            expect(numCache.get(2)).toBe('two');
        });
        
        it('should work with object values', () => {
            const objCache = new LRUCache<string, { name: string; value: number }>(3);
            
            objCache.set('a', { name: 'test', value: 123 });
            
            const result = objCache.get('a');
            expect(result).toEqual({ name: 'test', value: 123 });
        });
        
        it('should handle null and undefined as values', () => {
            const nullCache = new LRUCache<string, any>(3);
            
            nullCache.set('null', null);
            nullCache.set('undefined', undefined);
            
            // null은 저장 가능
            expect(nullCache.has('null')).toBe(true);
            expect(nullCache.get('null')).toBeNull();
            
            // undefined는 "값이 없음"과 구분 안 됨
            expect(nullCache.has('undefined')).toBe(true);
            expect(nullCache.get('undefined')).toBeUndefined();
        });
    });
    
    describe('엣지 케이스', () => {
        it('should handle maxSize of 1', () => {
            const smallCache = new LRUCache<string, number>(1);
            
            smallCache.set('a', 1);
            expect(smallCache.get('a')).toBe(1);
            
            smallCache.set('b', 2);
            expect(smallCache.get('a')).toBeUndefined();
            expect(smallCache.get('b')).toBe(2);
        });
        
        it('should handle large maxSize', () => {
            const largeCache = new LRUCache<number, number>(1000);
            
            // 1000개 항목 추가
            for (let i = 0; i < 1000; i++) {
                largeCache.set(i, i * 2);
            }
            
            expect(largeCache.size).toBe(1000);
            expect(largeCache.get(500)).toBe(1000);
        });
        
        it('should handle rapid set/get operations', () => {
            for (let i = 0; i < 100; i++) {
                cache.set(`key${i}`, i);
                cache.get(`key${i}`);
            }
            
            // 크기 3이므로 마지막 3개만 남음
            expect(cache.size).toBe(3);
        });
    });
    
    describe('성능 특성', () => {
        it('should maintain O(1) access time', () => {
            const largeCache = new LRUCache<number, number>(10000);
            
            // 10000개 항목 추가
            for (let i = 0; i < 10000; i++) {
                largeCache.set(i, i);
            }
            
            // 접근 시간 측정
            const start = performance.now();
            for (let i = 0; i < 1000; i++) {
                largeCache.get(Math.floor(Math.random() * 10000));
            }
            const end = performance.now();
            
            // 1000번 접근이 100ms 이하여야 함 (평균 0.1ms/접근)
            expect(end - start).toBeLessThan(100);
        });
    });
});

/**
 * memoize.ts 확장 테스트
 * 
 * LRUCache 외의 메모이제이션 기능들을 테스트합니다.
 */

import {
    memoize,
    memoizeAsync,
    memoizeWithTTL,
    memoizeBy,
    FileContentCache
} from '../../src/utils/memoize';

describe('memoize', () => {
    it('should cache results for same argument', () => {
        let callCount = 0;
        const square = memoize((n: number) => {
            callCount++;
            return n * n;
        });
        
        expect(square(5)).toBe(25);
        expect(square(5)).toBe(25);
        expect(callCount).toBe(1); // 한 번만 실행
    });
    
    it('should compute different results for different arguments', () => {
        let callCount = 0;
        const square = memoize((n: number) => {
            callCount++;
            return n * n;
        });
        
        expect(square(5)).toBe(25);
        expect(square(6)).toBe(36);
        expect(callCount).toBe(2);
    });
    
    it('should work with string arguments', () => {
        let callCount = 0;
        const upper = memoize((s: string) => {
            callCount++;
            return s.toUpperCase();
        });
        
        expect(upper('hello')).toBe('HELLO');
        expect(upper('hello')).toBe('HELLO');
        expect(callCount).toBe(1);
    });
});

describe('memoizeAsync', () => {
    it('should cache async results', async () => {
        let callCount = 0;
        const asyncSquare = memoizeAsync(async (n: number) => {
            callCount++;
            await new Promise(resolve => setTimeout(resolve, 10));
            return n * n;
        });
        
        const result1 = await asyncSquare(5);
        const result2 = await asyncSquare(5);
        
        expect(result1).toBe(25);
        expect(result2).toBe(25);
        expect(callCount).toBe(1);
    });
    
    it('should handle concurrent requests', async () => {
        let callCount = 0;
        const asyncSquare = memoizeAsync(async (n: number) => {
            callCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
            return n * n;
        });
        
        // 동시에 여러 요청
        const results = await Promise.all([
            asyncSquare(5),
            asyncSquare(5),
            asyncSquare(5)
        ]);
        
        expect(results).toEqual([25, 25, 25]);
        expect(callCount).toBe(1); // Promise가 공유됨
    });
});

describe('memoizeWithTTL', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        jest.useRealTimers();
    });
    
    it('should cache results within TTL', () => {
        let callCount = 0;
        const cachedFn = memoizeWithTTL((n: number) => {
            callCount++;
            return n * n;
        }, 1000);
        
        cachedFn(5);
        jest.advanceTimersByTime(500);
        cachedFn(5);
        
        expect(callCount).toBe(1);
    });
    
    it('should recompute after TTL expires', () => {
        let callCount = 0;
        const cachedFn = memoizeWithTTL((n: number) => {
            callCount++;
            return n * n;
        }, 1000);
        
        cachedFn(5);
        jest.advanceTimersByTime(1001);
        cachedFn(5);
        
        expect(callCount).toBe(2);
    });
    
    it('should use default TTL of 60 seconds', () => {
        let callCount = 0;
        const cachedFn = memoizeWithTTL((n: number) => {
            callCount++;
            return n * n;
        });
        
        cachedFn(5);
        jest.advanceTimersByTime(59999);
        cachedFn(5);
        
        expect(callCount).toBe(1);
        
        jest.advanceTimersByTime(2);
        cachedFn(5);
        
        expect(callCount).toBe(2);
    });
});

describe('memoizeBy', () => {
    it('should cache based on custom key function', () => {
        let callCount = 0;
        const sum = memoizeBy(
            (a: number, b: number) => {
                callCount++;
                return a + b;
            },
            (a: number, b: number) => `${a}-${b}`
        );
        
        expect(sum(1, 2)).toBe(3);
        expect(sum(1, 2)).toBe(3);
        expect(callCount).toBe(1);
    });
    
    it('should compute different results for different key', () => {
        let callCount = 0;
        const sum = memoizeBy(
            (a: number, b: number) => {
                callCount++;
                return a + b;
            },
            (a: number, b: number) => `${a}-${b}`
        );
        
        expect(sum(1, 2)).toBe(3);
        expect(sum(2, 1)).toBe(3);
        expect(callCount).toBe(2); // 키가 다르므로 재계산
    });
    
    it('should work with complex arguments', () => {
        let callCount = 0;
        const concat = memoizeBy(
            (arr: number[], separator: string) => {
                callCount++;
                return arr.join(separator);
            },
            (arr: number[], separator: string) => `${arr.join(',')}-${separator}`
        );
        
        expect(concat([1, 2, 3], '-')).toBe('1-2-3');
        expect(concat([1, 2, 3], '-')).toBe('1-2-3');
        expect(callCount).toBe(1);
    });
});

describe('FileContentCache', () => {
    let cache: FileContentCache;
    let mockApp: any;
    let mockFile: any;
    
    beforeEach(() => {
        cache = new FileContentCache(10);
        
        mockApp = {
            vault: {
                read: jest.fn().mockResolvedValue('file content')
            }
        };
        
        mockFile = {
            path: 'test.md',
            stat: {
                mtime: 1000000
            }
        };
    });
    
    it('should cache file content', async () => {
        const content1 = await cache.read(mockApp, mockFile);
        const content2 = await cache.read(mockApp, mockFile);
        
        expect(content1).toBe('file content');
        expect(content2).toBe('file content');
        expect(mockApp.vault.read).toHaveBeenCalledTimes(1);
    });
    
    it('should reread when file is modified', async () => {
        await cache.read(mockApp, mockFile);
        
        // 파일 수정
        mockFile.stat.mtime = 2000000;
        mockApp.vault.read.mockResolvedValue('new content');
        
        const content = await cache.read(mockApp, mockFile);
        
        expect(content).toBe('new content');
        expect(mockApp.vault.read).toHaveBeenCalledTimes(2);
    });
    
    it('should cache different files independently', async () => {
        const file2 = {
            path: 'other.md',
            stat: { mtime: 1000000 }
        };
        
        await cache.read(mockApp, mockFile);
        await cache.read(mockApp, file2);
        
        expect(mockApp.vault.read).toHaveBeenCalledTimes(2);
    });
    
    it('should invalidate cache for specific file', async () => {
        await cache.read(mockApp, mockFile);
        
        cache.invalidate(mockFile.path);
        
        await cache.read(mockApp, mockFile);
        
        expect(mockApp.vault.read).toHaveBeenCalledTimes(2);
    });
    
    it('should track cache size', async () => {
        expect(cache.size).toBe(0);
        
        await cache.read(mockApp, mockFile);
        
        expect(cache.size).toBe(1);
    });
    
    it('should clear all cached content', async () => {
        await cache.read(mockApp, mockFile);
        
        cache.clear();
        
        expect(cache.size).toBe(0);
    });
});

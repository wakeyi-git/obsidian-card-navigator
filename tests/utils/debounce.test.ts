/**
 * Debounce 유틸리티 테스트
 */

import { debounce, debounceImmediate, debounceAsync } from '../../src/utils/debounce';

// 시간 조작을 위한 jest 타이머 사용
jest.useFakeTimers();

describe('debounce', () => {
    afterEach(() => {
        jest.clearAllTimers();
    });

describe('debounceAsync', () => {
    afterEach(() => {
        jest.clearAllTimers();
    });
    
    describe('기본 동작', () => {
        it('should delay async function execution', async () => {
            const mockFn = jest.fn().mockResolvedValue('result');
            const debouncedFn = debounceAsync(mockFn, 300);
            
            const promise = debouncedFn('test');
            
            // 즉시 실행되지 않음
            expect(mockFn).not.toHaveBeenCalled();
            
            // 300ms 후 실행됨
            jest.advanceTimersByTime(300);
            
            const result = await promise;
            
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('test');
            expect(result).toBe('result');
        });
        
        it('should cancel previous calls', async () => {
            const mockFn = jest.fn()
                .mockResolvedValueOnce('first')
                .mockResolvedValueOnce('second')
                .mockResolvedValueOnce('third');
            const debouncedFn = debounceAsync(mockFn, 300);
            
            const promise1 = debouncedFn('first');
            const promise2 = debouncedFn('second');
            const promise3 = debouncedFn('third');
            
            // 첫 번째와 두 번째는 취소되어야 함
            await expect(promise1).rejects.toThrow('Debounced call cancelled');
            await expect(promise2).rejects.toThrow('Debounced call cancelled');
            
            jest.advanceTimersByTime(300);
            
            // 마지막 호출만 성공
            const result = await promise3;
            expect(result).toBe('first'); // mockFn이 첫 번째 값을 반환
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('third');
        });
    });
    
    describe('에러 처리', () => {
        it('should handle rejected promises', async () => {
            const error = new Error('Test error');
            const mockFn = jest.fn().mockRejectedValue(error);
            const debouncedFn = debounceAsync(mockFn, 300);
            
            const promise = debouncedFn('test');
            
            jest.advanceTimersByTime(300);
            
            await expect(promise).rejects.toThrow('Test error');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });
        
        it('should handle errors in cancelled calls', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));
            const debouncedFn = debounceAsync(mockFn, 300);
            
            const promise1 = debouncedFn('first');
            const promise2 = debouncedFn('second');
            
            // 취소된 호출은 'Debounced call cancelled' 에러
            await expect(promise1).rejects.toThrow('Debounced call cancelled');
            
            jest.advanceTimersByTime(300);
            
            // 마지막 호출은 원래 에러
            await expect(promise2).rejects.toThrow('Test error');
        });
    });
    
    describe('연속 호출', () => {
        it('should handle rapid consecutive async calls', async () => {
            const mockFn = jest.fn()
                .mockImplementation((value: number) => 
                    Promise.resolve(`result-${value}`)
                );
            const debouncedFn = debounceAsync(mockFn, 300);
            
            const promises = [];
            
            // 빠르게 10번 호출
            for (let i = 0; i < 10; i++) {
                promises.push(debouncedFn(i));
            }
            
            // 처음 9개는 취소됨
            for (let i = 0; i < 9; i++) {
                await expect(promises[i]).rejects.toThrow('Debounced call cancelled');
            }
            
            jest.advanceTimersByTime(300);
            
            // 마지막 호출만 성공
            const result = await promises[9];
            expect(result).toBe('result-9');
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith(9);
        });
        
        it('should allow multiple executions with sufficient delay', async () => {
            const mockFn = jest.fn()
                .mockImplementation((value: string) => 
                    Promise.resolve(`result-${value}`)
                );
            const debouncedFn = debounceAsync(mockFn, 300);
            
            const promise1 = debouncedFn('first');
            jest.advanceTimersByTime(300);
            const result1 = await promise1;
            expect(result1).toBe('result-first');
            
            const promise2 = debouncedFn('second');
            jest.advanceTimersByTime(300);
            const result2 = await promise2;
            expect(result2).toBe('result-second');
            
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('인자 전달', () => {
        it('should pass all arguments to async function', async () => {
            const mockFn = jest.fn()
                .mockImplementation((a: string, b: number, c: boolean) => 
                    Promise.resolve({ a, b, c })
                );
            const debouncedFn = debounceAsync(mockFn, 300);
            
            const promise = debouncedFn('test', 123, true);
            
            jest.advanceTimersByTime(300);
            
            const result = await promise;
            
            expect(result).toEqual({ a: 'test', b: 123, c: true });
            expect(mockFn).toHaveBeenCalledWith('test', 123, true);
        });
    });
    
    describe('컨텍스트 유지', () => {
        it('should preserve this context in async functions', async () => {
            const obj = {
                value: 42,
                method: jest.fn(async function(this: any) {
                    return Promise.resolve(this.value);
                })
            };
            
            const debouncedMethod = debounceAsync(obj.method, 300);
            
            const promise = debouncedMethod.call(obj);
            
            jest.advanceTimersByTime(300);
            
            const result = await promise;
            
            expect(result).toBe(42);
            expect(obj.method).toHaveBeenCalled();
        });
    });
    
    describe('실용적인 사용 사례', () => {
        it('should optimize API calls', async () => {
            // API 호출 시뮬레이션
            let callCount = 0;
            const mockApi = jest.fn(async (query: string) => {
                callCount++;
                return { results: [`result for ${query}`], count: callCount };
            });
            
            const debouncedSearch = debounceAsync(mockApi, 300);
            
            // 빠르게 타이핑 시뮬레이션
            const p1 = debouncedSearch('a');
            const p2 = debouncedSearch('ab');
            const p3 = debouncedSearch('abc');
            
            // 처음 두 개는 취소됨
            await expect(p1).rejects.toThrow('Debounced call cancelled');
            await expect(p2).rejects.toThrow('Debounced call cancelled');
            
            jest.advanceTimersByTime(300);
            
            // 마지막만 실행됨
            const result = await p3;
            
            expect(result.results).toEqual(['result for abc']);
            expect(callCount).toBe(1); // API는 한 번만 호출됨
        });
    });
});
    
    describe('기본 동작', () => {
        it('should delay function execution', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 300);
            
            debouncedFn();
            
            // 즉시 실행되지 않음
            expect(mockFn).not.toHaveBeenCalled();
            
            // 300ms 후 실행됨
            jest.advanceTimersByTime(300);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });
        
        it('should execute only the last call when called multiple times', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 300);
            
            debouncedFn('first');
            debouncedFn('second');
            debouncedFn('third');
            
            // 아직 실행되지 않음
            expect(mockFn).not.toHaveBeenCalled();
            
            // 300ms 후 마지막 호출만 실행
            jest.advanceTimersByTime(300);
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('third');
        });
        
        it('should cancel previous timer on new call', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 300);
            
            debouncedFn('first');
            jest.advanceTimersByTime(200); // 200ms 경과
            
            debouncedFn('second'); // 타이머 리셋
            jest.advanceTimersByTime(200); // 200ms 더 경과 (총 400ms)
            
            // 첫 번째는 취소되었으므로 아직 실행 안 됨
            expect(mockFn).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(100); // 100ms 더 경과 (두 번째 호출 후 300ms)
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('second');
        });
    });
    
    describe('인자 전달', () => {
        it('should pass all arguments to the function', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 300);
            
            debouncedFn('arg1', 'arg2', 123);
            
            jest.advanceTimersByTime(300);
            
            expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
        });
        
        it('should handle no arguments', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 300);
            
            debouncedFn();
            
            jest.advanceTimersByTime(300);
            
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith();
        });
    });
    
    describe('컨텍스트 유지', () => {
        it('should preserve this context', () => {
            const obj = {
                value: 42,
                method: jest.fn(function(this: any) {
                    return this.value;
                })
            };
            
            const debouncedMethod = debounce(obj.method, 300);
            
            // 객체의 컨텍스트에서 호출
            debouncedMethod.call(obj);
            
            jest.advanceTimersByTime(300);
            
            expect(obj.method).toHaveBeenCalled();
        });
    });
    
    describe('타이밍', () => {
        it('should respect different wait times', () => {
            const mockFn1 = jest.fn();
            const mockFn2 = jest.fn();
            
            const debounced100 = debounce(mockFn1, 100);
            const debounced500 = debounce(mockFn2, 500);
            
            debounced100();
            debounced500();
            
            jest.advanceTimersByTime(100);
            expect(mockFn1).toHaveBeenCalledTimes(1);
            expect(mockFn2).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(400);
            expect(mockFn2).toHaveBeenCalledTimes(1);
        });
        
        it('should handle zero wait time', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 0);
            
            debouncedFn();
            
            jest.advanceTimersByTime(0);
            
            expect(mockFn).toHaveBeenCalledTimes(1);
        });
    });
    
    describe('연속 호출 시나리오', () => {
        it('should handle rapid consecutive calls', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 300);
            
            // 빠르게 10번 호출
            for (let i = 0; i < 10; i++) {
                debouncedFn(i);
            }
            
            expect(mockFn).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(300);
            
            // 마지막 호출만 실행
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith(9);
        });
        
        it('should allow multiple executions with sufficient delay', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 300);
            
            debouncedFn('first');
            jest.advanceTimersByTime(300);
            expect(mockFn).toHaveBeenCalledWith('first');
            
            debouncedFn('second');
            jest.advanceTimersByTime(300);
            expect(mockFn).toHaveBeenCalledWith('second');
            
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });
});

describe('debounceImmediate', () => {
    afterEach(() => {
        jest.clearAllTimers();
    });
    
    describe('immediate = false (기본)', () => {
        it('should behave like regular debounce', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounceImmediate(mockFn, 300, false);
            
            debouncedFn();
            
            expect(mockFn).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(300);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });
    });
    
    describe('immediate = true', () => {
        it('should execute immediately on first call', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounceImmediate(mockFn, 300, true);
            
            debouncedFn('first');
            
            // 즉시 실행됨
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('first');
        });
        
        it('should ignore subsequent calls within wait period', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounceImmediate(mockFn, 300, true);
            
            debouncedFn('first');
            expect(mockFn).toHaveBeenCalledTimes(1);
            
            debouncedFn('second');
            debouncedFn('third');
            
            jest.advanceTimersByTime(300);
            
            // 여전히 첫 번째 호출만
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('first');
        });
        
        it('should allow new execution after wait period', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounceImmediate(mockFn, 300, true);
            
            debouncedFn('first');
            expect(mockFn).toHaveBeenCalledWith('first');
            
            jest.advanceTimersByTime(300);
            
            debouncedFn('second');
            expect(mockFn).toHaveBeenCalledWith('second');
            
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
        
        it('should reset timer on rapid calls', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounceImmediate(mockFn, 300, true);
            
            debouncedFn('first');
            expect(mockFn).toHaveBeenCalledTimes(1);
            
            jest.advanceTimersByTime(200);
            debouncedFn('second'); // 타이머 리셋
            
            jest.advanceTimersByTime(200); // 총 400ms
            
            // 타이머가 리셋되었으므로 아직 새 실행 안 됨
            debouncedFn('third');
            expect(mockFn).toHaveBeenCalledTimes(1); // 여전히 첫 번째만
            
            jest.advanceTimersByTime(300);
            
            // 이제 새 실행 가능
            debouncedFn('fourth');
            expect(mockFn).toHaveBeenCalledTimes(2);
            expect(mockFn).toHaveBeenCalledWith('fourth');
        });
    });
    
    describe('실용적인 사용 사례', () => {
        it('should prevent double-click (immediate=true)', () => {
            const handleClick = jest.fn();
            const debouncedClick = debounceImmediate(handleClick, 1000, true);
            
            // 빠르게 여러 번 클릭
            debouncedClick();
            debouncedClick();
            debouncedClick();
            
            // 첫 클릭만 처리됨
            expect(handleClick).toHaveBeenCalledTimes(1);
            
            jest.advanceTimersByTime(1000);
            
            // 1초 후 다시 클릭 가능
            debouncedClick();
            expect(handleClick).toHaveBeenCalledTimes(2);
        });
        
        it('should optimize text input (immediate=false)', () => {
            const handleInput = jest.fn();
            const debouncedInput = debounceImmediate(handleInput, 300, false);
            
            // 빠르게 타이핑
            debouncedInput('a');
            debouncedInput('ab');
            debouncedInput('abc');
            
            // 타이핑 중에는 실행 안 됨
            expect(handleInput).not.toHaveBeenCalled();
            
            // 타이핑 멈춘 후 300ms 후 실행
            jest.advanceTimersByTime(300);
            expect(handleInput).toHaveBeenCalledTimes(1);
            expect(handleInput).toHaveBeenCalledWith('abc');
        });
    });
});

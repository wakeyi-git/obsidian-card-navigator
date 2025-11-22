import { throttle, rafDebounce, debounceAsync, PerformanceMonitor } from '../../src/utils/performance';
import { CardNavigatorSettings } from '../../src/types';
import { createMockSettings } from '../__mocks__/settings';

describe('Performance Utilities', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });
    
    describe('throttle', () => {
        it('should call function immediately on first call', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);
            
            throttled('test');
            
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('test');
        });
        
        it('should not call function again within interval', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);
            
            throttled('test1');
            throttled('test2');
            throttled('test3');
            
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('test1');
        });
        
        it('should call function after interval has passed', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);
            
            throttled('test1');
            
            jest.advanceTimersByTime(100);
            
            throttled('test2');
            
            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenNthCalledWith(1, 'test1');
            expect(fn).toHaveBeenNthCalledWith(2, 'test2');
        });
        
        it('should schedule trailing call', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);
            
            throttled('test1');
            
            jest.advanceTimersByTime(50);
            throttled('test2');
            
            expect(fn).toHaveBeenCalledTimes(1);
            
            jest.advanceTimersByTime(50);
            
            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenLastCalledWith('test2');
        });
        
        it('should cancel previous trailing call if new call comes', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);
            
            throttled('test1');
            jest.advanceTimersByTime(50);
            throttled('test2');
            jest.advanceTimersByTime(25);
            throttled('test3');
            
            jest.advanceTimersByTime(50);
            
            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenLastCalledWith('test3');
        });
        
        it('should work with multiple arguments', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);
            
            throttled('arg1', 'arg2', 'arg3');
            
            expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
        });
    });
    
    describe('debounceAsync', () => {
        it('should debounce async function', async () => {
            const fn = jest.fn().mockResolvedValue('result');
            const debounced = debounceAsync(fn, 100);
            
            const promise1 = debounced('test1');
            const promise2 = debounced('test2');
            const promise3 = debounced('test3');
            
            jest.advanceTimersByTime(100);
            await Promise.resolve(); // Let microtasks run
            
            const result1 = await promise1;
            const result2 = await promise2;
            const result3 = await promise3;
            
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('test3');
            expect(result1).toBe('result');
            expect(result2).toBe('result');
            expect(result3).toBe('result');
        });
        
        it('should resolve all pending promises with same result', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const debounced = debounceAsync(fn, 100);
            
            const promises = [
                debounced('test1'),
                debounced('test2'),
                debounced('test3')
            ];
            
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            
            const results = await Promise.all(promises);
            
            expect(results).toEqual(['success', 'success', 'success']);
            expect(fn).toHaveBeenCalledTimes(1);
        });
        
        it('should reject all pending promises on error', async () => {
            const error = new Error('Test error');
            const fn = jest.fn().mockRejectedValue(error);
            const debounced = debounceAsync(fn, 100);
            
            const promises = [
                debounced('test1'),
                debounced('test2'),
                debounced('test3')
            ];
            
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            
            await expect(promises[0]).rejects.toThrow('Test error');
            await expect(promises[1]).rejects.toThrow('Test error');
            await expect(promises[2]).rejects.toThrow('Test error');
            
            expect(fn).toHaveBeenCalledTimes(1);
        });
        
        it('should handle multiple debounce cycles', async () => {
            const fn = jest.fn()
                .mockResolvedValueOnce('result1')
                .mockResolvedValueOnce('result2');
            const debounced = debounceAsync(fn, 100);
            
            // First cycle
            const promise1 = debounced('test1');
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            const result1 = await promise1;
            
            // Second cycle
            const promise2 = debounced('test2');
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            const result2 = await promise2;
            
            expect(fn).toHaveBeenCalledTimes(2);
            expect(result1).toBe('result1');
            expect(result2).toBe('result2');
        });
    });
    
    describe('rafDebounce', () => {
        let rafMock: jest.Mock;
        let cancelRafMock: jest.Mock;
        
        beforeEach(() => {
            rafMock = jest.fn((callback) => {
                callback();
                return 1;
            });
            cancelRafMock = jest.fn();
            
            global.requestAnimationFrame = rafMock;
            global.cancelAnimationFrame = cancelRafMock;
        });
        
        it('should call function on requestAnimationFrame', () => {
            const fn = jest.fn();
            const debounced = rafDebounce(fn);
            
            debounced('test');
            
            expect(rafMock).toHaveBeenCalled();
            expect(fn).toHaveBeenCalledWith('test');
        });
        
        it('should cancel previous frame before scheduling new one', () => {
            const fn = jest.fn();
            const debounced = rafDebounce(fn);
            
            rafMock.mockImplementation((callback) => 1);
            
            debounced('test1');
            debounced('test2');
            
            expect(cancelRafMock).toHaveBeenCalledWith(1);
        });
        
        it('should work with multiple arguments', () => {
            const fn = jest.fn();
            const debounced = rafDebounce(fn);
            
            debounced('arg1', 'arg2', 'arg3');
            
            expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
        });
        
        it('should handle multiple calls and only execute once', () => {
            const fn = jest.fn();
            const debounced = rafDebounce(fn);
            const rafCallbacks: Function[] = [];
            
            rafMock.mockImplementation((callback) => {
                rafCallbacks.push(callback);
                return rafCallbacks.length;
            });
            
            debounced('test1');
            debounced('test2');
            debounced('test3');
            
            expect(cancelRafMock).toHaveBeenCalledTimes(2);
            expect(rafMock).toHaveBeenCalledTimes(3);
            
            // Execute only the last scheduled callback
            rafCallbacks[rafCallbacks.length - 1]();
            
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('test3');
        });
    });
    
    describe('PerformanceMonitor', () => {
        let monitor: PerformanceMonitor;
        let mockSettings: CardNavigatorSettings;
        
        beforeEach(() => {
            mockSettings = createMockSettings({
                debug: {
                    enabled: true,
                    categories: {
                        Performance: true
                    }
                }
            });
            
            monitor = new PerformanceMonitor(mockSettings);
            
            // Mock performance.now()
            let currentTime = 0;
            jest.spyOn(performance, 'now').mockImplementation(() => {
                currentTime += 10;
                return currentTime;
            });
        });
        
        describe('start() and end()', () => {
            it('should measure execution time', () => {
                monitor.start('test');
                const duration = monitor.end('test');
                
                expect(duration).toBeGreaterThan(0);
            });
            
            it('should return 0 if no start mark', () => {
                const duration = monitor.end('nonexistent');
                
                expect(duration).toBe(0);
            });
            
            it('should delete mark after end', () => {
                monitor.start('test');
                monitor.end('test');
                
                const duration2 = monitor.end('test');
                
                expect(duration2).toBe(0);
            });
        });
        
        describe('endSilent()', () => {
            it('should return duration without logging', () => {
                monitor.start('test');
                const duration = monitor.endSilent('test');
                
                expect(duration).toBeGreaterThan(0);
            });
            
            it('should return 0 if no start mark', () => {
                const duration = monitor.endSilent('nonexistent');
                
                expect(duration).toBe(0);
            });
        });
        
        describe('measure()', () => {
            it('should measure async function execution', async () => {
                const fn = jest.fn().mockResolvedValue('result');
                
                const result = await monitor.measure('test', fn);
                
                expect(result).toBe('result');
                expect(fn).toHaveBeenCalled();
            });
            
            it('should propagate errors', async () => {
                const error = new Error('Test error');
                const fn = jest.fn().mockRejectedValue(error);
                
                await expect(monitor.measure('test', fn)).rejects.toThrow('Test error');
            });
        });
        
        describe('measureSync()', () => {
            it('should measure sync function execution', () => {
                const fn = jest.fn().mockReturnValue('result');
                
                const result = monitor.measureSync('test', fn);
                
                expect(result).toBe('result');
                expect(fn).toHaveBeenCalled();
            });
            
            it('should propagate errors', () => {
                const fn = jest.fn().mockImplementation(() => {
                    throw new Error('Test error');
                });
                
                expect(() => monitor.measureSync('test', fn)).toThrow('Test error');
            });
        });
        
        describe('logMemory()', () => {
            it('should log memory if available', () => {
                (performance as any).memory = {
                    usedJSHeapSize: 10485760, // 10MB
                    totalJSHeapSize: 20971520  // 20MB
                };
                
                expect(() => monitor.logMemory()).not.toThrow();
            });
            
            it('should handle missing performance.memory', () => {
                delete (performance as any).memory;
                
                expect(() => monitor.logMemory()).not.toThrow();
            });
        });
        
        describe('clear()', () => {
            it('should clear all marks', () => {
                monitor.start('test1');
                monitor.start('test2');
                monitor.start('test3');
                
                monitor.clear();
                
                expect(monitor.end('test1')).toBe(0);
                expect(monitor.end('test2')).toBe(0);
                expect(monitor.end('test3')).toBe(0);
            });
        });
        
        describe('Constructor without settings', () => {
            it('should create instance without settings', () => {
                const monitorWithoutSettings = new PerformanceMonitor();
                
                expect(monitorWithoutSettings).toBeDefined();
                
                monitorWithoutSettings.start('test');
                const duration = monitorWithoutSettings.end('test');
                
                expect(duration).toBeGreaterThan(0);
            });
        });
    });
});
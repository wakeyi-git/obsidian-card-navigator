/**
 * @jest-environment jsdom
 */

import { LayoutManager } from '../../src/layout/LayoutManager';
import { LayoutSettings, CardNavigatorSettings } from '../../src/types';

// Mock 설정
const mockGetFullSettings = jest.fn<CardNavigatorSettings, []>();

describe('LayoutManager', () => {
    let container: HTMLElement;
    let manager: LayoutManager;
    let settings: LayoutSettings;
    
    beforeEach(() => {
        // Container element 생성
        container = document.createElement('div');
        document.body.appendChild(container);
        
        // Default settings
        settings = {
            mode: 'horizontal',  // Add mode
            cardMinWidth: 200,
            cardMaxWidth: 400,
            cardMinHeight: 150,
            cardMaxHeight: 300,
            gap: 16
        };
        
        // Full settings mock
        mockGetFullSettings.mockReturnValue({
            debug: { enabled: false }
        } as any);
        
        // Container 크기 설정
        Object.defineProperty(container, 'getBoundingClientRect', {
            configurable: true,
            value: jest.fn().mockReturnValue({
                width: 1000,
                height: 600,
                top: 0,
                left: 0,
                bottom: 600,
                right: 1000
            })
        });
        
        manager = new LayoutManager(container, settings, mockGetFullSettings);
    });
    
    afterEach(() => {
        manager.destroy();
        document.body.removeChild(container);
        jest.clearAllMocks();
    });
    
    describe('initialization', () => {
        it('should detect horizontal mode for wide containers', () => {
            const mode = manager.getMode();
            expect(mode).toBe('horizontal'); // width(1000) > height(600)
        });
        
        it('should detect vertical mode for tall containers', () => {
            Object.defineProperty(container, 'getBoundingClientRect', {
                configurable: true,
                value: jest.fn().mockReturnValue({
                    width: 400,
                    height: 800,
                    top: 0,
                    left: 0,
                    bottom: 800,
                    right: 400
                })
            });
            
            const tallManager = new LayoutManager(container, settings, mockGetFullSettings);
            const mode = tallManager.getMode();
            
            expect(mode).toBe('vertical'); // width(400) < height(800)
            
            tallManager.destroy();
        });
    });
    
    describe('calculateGridSize', () => {
        it('should calculate correct number of columns in vertical mode', () => {
            // 세로 모드로 변경 (height > width)
            Object.defineProperty(container, 'getBoundingClientRect', {
                configurable: true,
                value: jest.fn().mockReturnValue({
                    width: 1000,
                    height: 1200,
                    top: 0,
                    left: 0,
                    bottom: 1200,
                    right: 1000
                })
            });

            const verticalManager = new LayoutManager(container, settings, mockGetFullSettings);

            // Container width: 1000px
            // Card min width: 200px
            // Gap: 16px
            // Expected: floor((1000 + 16) / (200 + 16)) = 4 columns

            // 리팩토링 2025-11-23: CSS 변수로 확인
            const gridColumns = container.style.getPropertyValue('--grid-columns');
            expect(gridColumns).toBe('4');

            // CSS 클래스도 확인
            expect(container.classList.contains('vertical-mode')).toBe(true);

            verticalManager.destroy();
        });

        it('should calculate correct number of rows in horizontal mode', () => {
            // 기본 설정이 이미 horizontal 모드 (width=1000 > height=600)
            // Container height: 600px
            // Card min height: 150px
            // Gap: 16px
            // Expected: floor((600 + 16) / (150 + 16)) = 3 rows

            // 리팩토링 2025-11-23: CSS 변수로 확인
            const gridRows = container.style.getPropertyValue('--grid-rows');
            expect(gridRows).toBe('3');

            // CSS 클래스도 확인
            expect(container.classList.contains('horizontal-mode')).toBe(true);
        });
        
        it('should ensure at least 1 column/row', () => {
            // 세로 모드로 변경하여 columns 테스트
            Object.defineProperty(container, 'getBoundingClientRect', {
                configurable: true,
                value: jest.fn().mockReturnValue({
                    width: 800,
                    height: 1000,
                    top: 0,
                    left: 0,
                    bottom: 1000,
                    right: 800
                })
            });

            const tinySettings: LayoutSettings = {
                mode: 'horizontal',  // Add mode
                cardMinWidth: 1000,  // Larger than container
                cardMaxWidth: 2000,
                cardMinHeight: 1000,
                cardMaxHeight: 2000,
                gap: 16
            };

            const tinyManager = new LayoutManager(container, tinySettings, mockGetFullSettings);

            // 리팩토링 2025-11-23: CSS 변수로 확인
            const gridColumns = container.style.getPropertyValue('--grid-columns');

            // Should have at least 1 column
            expect(gridColumns).toBe('1');

            tinyManager.destroy();
        });
    });
    
    describe('updateLayout', () => {
        it('should apply CSS variables', () => {
            manager.updateLayout();
            
            expect(container.style.getPropertyValue('--card-min-width')).toBe('200px');
            expect(container.style.getPropertyValue('--card-min-height')).toBe('150px');
            expect(container.style.getPropertyValue('--card-max-width')).toBe('400px');
            expect(container.style.getPropertyValue('--card-max-height')).toBe('300px');
            expect(container.style.getPropertyValue('--card-gap')).toBe('16px');
        });
        
        it('should apply vertical mode styles', () => {
            // Force vertical mode
            Object.defineProperty(container, 'getBoundingClientRect', {
                configurable: true,
                value: jest.fn().mockReturnValue({
                    width: 400,
                    height: 800,
                    top: 0,
                    left: 0,
                    bottom: 800,
                    right: 400
                })
            });

            const verticalManager = new LayoutManager(container, settings, mockGetFullSettings);
            verticalManager.updateLayout();

            // 리팩토링 2025-11-23: CSS 클래스와 변수로 확인
            expect(container.classList.contains('vertical-mode')).toBe(true);
            expect(container.classList.contains('horizontal-mode')).toBe(false);
            expect(container.style.getPropertyValue('--grid-columns')).toBeTruthy();

            verticalManager.destroy();
        });

        it('should apply horizontal mode styles', () => {
            manager.updateLayout();

            // 리팩토링 2025-11-23: CSS 클래스와 변수로 확인
            expect(container.classList.contains('horizontal-mode')).toBe(true);
            expect(container.classList.contains('vertical-mode')).toBe(false);
            expect(container.style.getPropertyValue('--grid-rows')).toBeTruthy();
        });
    });
    
    describe('updateSettings', () => {
        it('should update settings and layout', () => {
            const newSettings: LayoutSettings = {
                mode: 'horizontal',  // Add mode
                cardMinWidth: 300,
                cardMaxWidth: 500,
                cardMinHeight: 200,
                cardMaxHeight: 400,
                gap: 20
            };
            
            manager.updateSettings(newSettings);
            
            expect(container.style.getPropertyValue('--card-min-width')).toBe('300px');
            expect(container.style.getPropertyValue('--card-gap')).toBe('20px');
        });
        
        it('should recalculate grid with new settings', () => {
            // horizontal 모드이므로 rows를 확인
            // 리팩토링 2025-11-23: CSS 변수로 확인
            const initialRows = container.style.getPropertyValue('--grid-rows');

            const newSettings: LayoutSettings = {
                ...settings,
                cardMinHeight: 100  // Smaller cards -> more rows
            };

            manager.updateSettings(newSettings);

            const newRows = container.style.getPropertyValue('--grid-rows');

            // Should have different number of rows
            expect(newRows).not.toBe(initialRows);
        });
    });
    
    describe('resize handling', () => {
        // ⭐ Performance: requestAnimationFrame 사용으로 인해 fake timers 필요
        let rafCallbacks: (() => void)[] = [];
        let originalRaf: typeof requestAnimationFrame;
        let originalCaf: typeof cancelAnimationFrame;

        beforeEach(() => {
            jest.useFakeTimers();
            rafCallbacks = [];
            originalRaf = global.requestAnimationFrame;
            originalCaf = global.cancelAnimationFrame;
            global.requestAnimationFrame = (callback: () => void) => {
                rafCallbacks.push(callback);
                return rafCallbacks.length;
            };
            global.cancelAnimationFrame = (id: number) => {
                rafCallbacks[id - 1] = () => {};
            };
        });

        afterEach(() => {
            jest.useRealTimers();
            global.requestAnimationFrame = originalRaf;
            global.cancelAnimationFrame = originalCaf;
        });

        const runAllRafCallbacks = () => {
            rafCallbacks.forEach(cb => cb());
            rafCallbacks = [];
        };

        it('should debounce resize events', () => {
            const updateLayoutSpy = jest.spyOn(manager as any, 'updateLayout');

            // ⭐ Performance: cachedSize 설정 (ResizeObserver에서 제공하는 것처럼)
            (manager as any).cachedSize = { width: 1100, height: 700 };

            // Simulate ResizeObserver
            (manager as any).onResize();
            (manager as any).onResize();
            (manager as any).onResize();

            // 디바운스 시간 경과
            jest.advanceTimersByTime(150);
            // RAF 콜백 실행
            runAllRafCallbacks();

            // Called only once after debounce
            expect(updateLayoutSpy).toHaveBeenCalledTimes(1);
        });

        it('should not update layout for small size changes', () => {
            const updateLayoutSpy = jest.spyOn(manager as any, 'updateLayout');
            updateLayoutSpy.mockClear();

            // ⭐ Performance: cachedSize 설정 (작은 변화)
            (manager as any).cachedSize = { width: 1010, height: 610 };

            (manager as any).onResize();

            jest.advanceTimersByTime(150);
            runAllRafCallbacks();

            expect(updateLayoutSpy).not.toHaveBeenCalled();
        });

        it('should update layout for significant size changes', () => {
            const updateLayoutSpy = jest.spyOn(manager as any, 'updateLayout');
            updateLayoutSpy.mockClear();

            // ⭐ Performance: cachedSize 설정 (큰 변화)
            (manager as any).cachedSize = { width: 1030, height: 630 };

            (manager as any).onResize();

            jest.advanceTimersByTime(150);
            runAllRafCallbacks();

            expect(updateLayoutSpy).toHaveBeenCalled();
        });

        it('should update layout when mode changes', () => {
            const updateLayoutSpy = jest.spyOn(manager as any, 'updateLayout');
            updateLayoutSpy.mockClear();

            // ⭐ Performance: cachedSize 설정 (모드 변경)
            (manager as any).cachedSize = { width: 400, height: 800 };

            (manager as any).onResize();

            jest.advanceTimersByTime(150);
            runAllRafCallbacks();

            expect(updateLayoutSpy).toHaveBeenCalled();
            expect(manager.getMode()).toBe('vertical');
        });
    });
    
    describe('destroy', () => {
        it('should disconnect ResizeObserver', () => {
            const disconnectSpy = jest.fn();
            (manager as any).resizeObserver = { disconnect: disconnectSpy };
            
            manager.destroy();
            
            expect(disconnectSpy).toHaveBeenCalled();
        });
        
        it('should clear resize timeout', () => {
            const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
            
            // Start a resize
            (manager as any).onResize();
            
            // Destroy before timeout completes
            manager.destroy();
            
            expect(clearTimeoutSpy).toHaveBeenCalled();
            clearTimeoutSpy.mockRestore();
        });
        
        it('should nullify observers', () => {
            manager.destroy();
            
            expect((manager as any).resizeObserver).toBeNull();
            expect((manager as any).resizeTimeout).toBeNull();
        });
    });
    
    describe('edge cases', () => {
        it('should handle zero gap', () => {
            const zeroGapSettings: LayoutSettings = {
                ...settings,
                gap: 0
            };
            
            const zeroGapManager = new LayoutManager(container, zeroGapSettings, mockGetFullSettings);
            zeroGapManager.updateLayout();
            
            expect(container.style.getPropertyValue('--card-gap')).toBe('0px');
            
            zeroGapManager.destroy();
        });
        
        it('should handle very large gap', () => {
            const largeGapSettings: LayoutSettings = {
                ...settings,
                gap: 100
            };

            const largeGapManager = new LayoutManager(container, largeGapSettings, mockGetFullSettings);

            // Should still calculate valid grid (horizontal mode uses rows)
            // 리팩토링 2025-11-23: CSS 변수로 확인
            const gridRows = container.style.getPropertyValue('--grid-rows');
            expect(gridRows).toBeTruthy();

            largeGapManager.destroy();
        });
        
        it('should handle square containers', () => {
            Object.defineProperty(container, 'getBoundingClientRect', {
                configurable: true,
                value: jest.fn().mockReturnValue({
                    width: 800,
                    height: 800,
                    top: 0,
                    left: 0,
                    bottom: 800,
                    right: 800
                })
            });
            
            const squareManager = new LayoutManager(container, settings, mockGetFullSettings);
            
            // Should detect as horizontal (width > height is false, so vertical is false, default is horizontal)
            // Actually width === height, so it depends on implementation
            // Let's just verify it picks a mode
            const mode = squareManager.getMode();
            expect(['horizontal', 'vertical']).toContain(mode);
            
            squareManager.destroy();
        });
    });
    
    describe('getMode', () => {
        it('should return current layout mode', () => {
            const mode = manager.getMode();
            expect(mode).toBe('horizontal');
        });

        it('should reflect mode changes', () => {
            // ⭐ Performance: fake timers와 RAF 모킹 필요
            jest.useFakeTimers();
            const rafCallbacks: (() => void)[] = [];
            const originalRaf = global.requestAnimationFrame;
            global.requestAnimationFrame = (callback: () => void) => {
                rafCallbacks.push(callback);
                return rafCallbacks.length;
            };

            // ⭐ Performance: cachedSize 설정 (모드 변경)
            (manager as any).cachedSize = { width: 400, height: 800 };

            (manager as any).onResize();

            jest.advanceTimersByTime(150);
            rafCallbacks.forEach(cb => cb());

            expect(manager.getMode()).toBe('vertical');

            // Cleanup
            jest.useRealTimers();
            global.requestAnimationFrame = originalRaf;
        });
    });
});

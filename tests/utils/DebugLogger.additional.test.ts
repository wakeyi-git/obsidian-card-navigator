import { DebugLogger } from '../../src/utils/DebugLogger';
import { CardNavigatorSettings, DebugCategory } from '../../src/types';

// 테스트용 설정 생성 헬퍼
function createSettings(categories: Partial<Record<DebugCategory, boolean>>): CardNavigatorSettings {
    return {
        debug: {
            enabled: true,
            categories
        }
    } as CardNavigatorSettings;
}

describe('DebugLogger - Additional Coverage', () => {
    let logger: DebugLogger;
    let originalConsole: typeof console;
    let settings: CardNavigatorSettings;
    
    beforeEach(() => {
        originalConsole = global.console;
        global.console = {
            ...originalConsole,
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            group: jest.fn(),
            groupCollapsed: jest.fn(),
            groupEnd: jest.fn(),
            table: jest.fn()
        };
    });
    
    afterEach(() => {
        global.console = originalConsole;
    });
    
    describe('Debug Categories', () => {
        test('logs View messages when View debugging enabled', () => {
            settings = createSettings({ View: true });
            logger = new DebugLogger(() => settings);
            
            logger.debug('View', 'Test view message');
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'Test view message');
        });
        
        test('logs Event messages when Event debugging enabled', () => {
            settings = createSettings({ Event: true });
            logger = new DebugLogger(() => settings);
            
            logger.debug('Event', 'Test event message');
            
            expect(console.log).toHaveBeenCalledWith('[Event]', 'Test event message');
        });
        
        test('logs Performance messages when Performance debugging enabled', () => {
            settings = createSettings({ Performance: true });
            logger = new DebugLogger(() => settings);
            
            logger.debug('Performance', 'Test performance message');
            
            expect(console.log).toHaveBeenCalledWith('[Performance]', 'Test performance message');
        });
        
        test('logs Layout messages when Layout debugging enabled', () => {
            settings = createSettings({ Layout: true });
            logger = new DebugLogger(() => settings);
            
            logger.debug('Layout', 'Test layout message');
            
            expect(console.log).toHaveBeenCalledWith('[Layout]', 'Test layout message');
        });
        
        test('does not log when category disabled', () => {
            settings = createSettings({ View: false });
            logger = new DebugLogger(() => settings);
            
            logger.debug('View', 'Should not log');
            
            expect(console.log).not.toHaveBeenCalled();
        });
        
        test('does not log when debugging globally disabled', () => {
            settings = {
                debug: {
                    enabled: false,
                    categories: { View: true }
                }
            } as CardNavigatorSettings;
            logger = new DebugLogger(() => settings);
            
            logger.debug('View', 'Should not log');
            
            expect(console.log).not.toHaveBeenCalled();
        });

        test('logs when category not specified (defaults to enabled)', () => {
            settings = createSettings({});
            logger = new DebugLogger(() => settings);
            
            logger.debug('View', 'Should log by default');
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'Should log by default');
        });
    });
    
    describe('Log Levels', () => {
        beforeEach(() => {
            settings = createSettings({ View: true });
            logger = new DebugLogger(() => settings);
        });
        
        test('logs debug messages', () => {
            logger.debug('View', 'Debug message');
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'Debug message');
        });
        
        test('logs warning messages', () => {
            logger.warn('View', 'Warning message');
            
            expect(console.warn).toHaveBeenCalledWith('[View]', 'Warning message');
        });
        
        test('logs error messages', () => {
            logger.error('View', 'Error message');
            
            expect(console.error).toHaveBeenCalledWith('[View]', 'Error message');
        });
        
        test('logs error messages with error object', () => {
            const error = new Error('Test error');
            logger.error('View', 'Error occurred', error);
            
            expect(console.error).toHaveBeenCalledWith('[View]', 'Error occurred', error);
        });

        test('error messages always log even when debugging disabled', () => {
            settings = {
                debug: {
                    enabled: false,
                    categories: {}
                }
            } as CardNavigatorSettings;
            logger = new DebugLogger(() => settings);
            
            logger.error('View', 'Error message');
            
            expect(console.error).toHaveBeenCalledWith('[View]', 'Error message');
        });
    });
    
    describe('Additional Data', () => {
        beforeEach(() => {
            settings = createSettings({ View: true });
            logger = new DebugLogger(() => settings);
        });
        
        test('logs with additional data object', () => {
            const data = { key: 'value', count: 42 };
            logger.debug('View', 'Message with data', data);
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'Message with data', data);
        });
        
        test('logs with array data', () => {
            const data = [1, 2, 3];
            logger.debug('View', 'Array data', data);
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'Array data', data);
        });
        
        test('logs with null data', () => {
            logger.debug('View', 'Message', null);
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'Message', null);
        });
        
        test('logs without additional data', () => {
            logger.debug('View', 'Message only');
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'Message only');
        });
    });
    
    describe('Performance Timing', () => {
        beforeEach(() => {
            settings = createSettings({ Performance: true });
            logger = new DebugLogger(() => settings);
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });
        
        test('measures time between time() and timeEnd()', () => {
            logger.time('Performance', 'test-operation');
            
            jest.advanceTimersByTime(100);
            
            const duration = logger.timeEnd('Performance', 'test-operation');
            
            expect(duration).toBeGreaterThanOrEqual(0);
            expect(console.log).toHaveBeenCalled();
        });
        
        test('warns when ending timer that was not started', () => {
            logger.timeEnd('Performance', 'nonexistent-timer');
            
            expect(console.warn).toHaveBeenCalledWith(
                '[Performance]',
                '타이머를 찾을 수 없습니다: nonexistent-timer'
            );
        });
        
        test('does not time when Performance debugging disabled', () => {
            settings = createSettings({ Performance: false });
            logger = new DebugLogger(() => settings);
            
            logger.time('Performance', 'test');
            logger.timeEnd('Performance', 'test');
            
            expect(console.log).not.toHaveBeenCalled();
        });

        test('handles multiple concurrent timers', () => {
            logger.time('Performance', 'timer1');
            logger.time('Performance', 'timer2');
            
            jest.advanceTimersByTime(50);
            logger.timeEnd('Performance', 'timer1');
            
            jest.advanceTimersByTime(50);
            logger.timeEnd('Performance', 'timer2');
            
            expect(console.log).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('Settings Updates', () => {
        test('respects updated settings through getSettings function', () => {
            let currentSettings = createSettings({ View: false });
            logger = new DebugLogger(() => currentSettings);
            
            logger.debug('View', 'Should not log');
            expect(console.log).not.toHaveBeenCalled();
            
            // Update settings
            currentSettings = createSettings({ View: true });
            
            logger.debug('View', 'Should log now');
            expect(console.log).toHaveBeenCalledWith('[View]', 'Should log now');
        });
        
        test('disables all logging when enabled set to false', () => {
            let currentSettings = createSettings({ View: true, Event: true });
            logger = new DebugLogger(() => currentSettings);
            
            logger.debug('View', 'Initial log');
            expect(console.log).toHaveBeenCalledTimes(1);
            
            currentSettings = {
                debug: {
                    enabled: false,
                    categories: { View: true, Event: true }
                }
            } as CardNavigatorSettings;
            
            logger.debug('View', 'Should not log');
            logger.debug('Event', 'Should not log');
            
            expect(console.log).toHaveBeenCalledTimes(1);
        });
    });

    describe('Grouping', () => {
        beforeEach(() => {
            settings = createSettings({ Layout: true });
            logger = new DebugLogger(() => settings);
        });

        test('creates log group', () => {
            logger.group('Layout', 'Test Group');
            
            expect(console.group).toHaveBeenCalledWith('[Layout] Test Group');
        });

        test('creates collapsed log group', () => {
            logger.groupCollapsed('Layout', 'Collapsed Group');
            
            expect(console.groupCollapsed).toHaveBeenCalledWith('[Layout] Collapsed Group');
        });

        test('ends log group', () => {
            logger.group('Layout', 'Test Group');
            logger.groupEnd();
            
            expect(console.groupEnd).toHaveBeenCalled();
        });

        test('does not create group when category disabled', () => {
            settings = createSettings({ Layout: false });
            logger = new DebugLogger(() => settings);
            
            logger.group('Layout', 'Test Group');
            
            expect(console.group).not.toHaveBeenCalled();
        });
    });

    describe('Table Output', () => {
        beforeEach(() => {
            settings = createSettings({ View: true });
            logger = new DebugLogger(() => settings);
        });

        test('outputs data as table', () => {
            const data = [
                { id: 1, name: 'Test 1' },
                { id: 2, name: 'Test 2' }
            ];
            
            logger.table('View', data);
            
            expect(console.log).toHaveBeenCalledWith('[View]');
            expect(console.table).toHaveBeenCalledWith(data);
        });

        test('does not output table when category disabled', () => {
            settings = createSettings({ View: false });
            logger = new DebugLogger(() => settings);
            
            const data = [{ id: 1 }];
            logger.table('View', data);
            
            expect(console.table).not.toHaveBeenCalled();
        });
    });
    
    describe('Edge Cases', () => {
        beforeEach(() => {
            settings = createSettings({ View: true });
            logger = new DebugLogger(() => settings);
        });

        test('handles empty message', () => {
            logger.debug('View', '');
            
            expect(console.log).toHaveBeenCalledWith('[View]', '');
        });
        
        test('handles very long message', () => {
            const longMessage = 'a'.repeat(10000);
            logger.debug('View', longMessage);
            
            expect(console.log).toHaveBeenCalledWith('[View]', longMessage);
        });
        
        test('handles special characters in message', () => {
            logger.debug('View', 'Message with\nnewlines\tand\ttabs');
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'Message with\nnewlines\tand\ttabs');
        });
        
        test('handles unicode characters', () => {
            logger.debug('View', '한글 メッセージ 🎉');
            
            expect(console.log).toHaveBeenCalledWith('[View]', '한글 メッセージ 🎉');
        });
    });
    
    describe('Multiple Categories', () => {
        test('each category can be independently controlled', () => {
            settings = createSettings({
                View: true,
                Event: false,
                Performance: true
            });
            logger = new DebugLogger(() => settings);
            
            logger.debug('View', 'View message');
            logger.debug('Event', 'Event message');
            logger.debug('Performance', 'Performance message');
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'View message');
            expect(console.log).not.toHaveBeenCalledWith('[Event]', 'Event message');
            expect(console.log).toHaveBeenCalledWith('[Performance]', 'Performance message');
        });

        test('supports all defined categories', () => {
            const allCategories: DebugCategory[] = [
                'Plugin', 'View', 'Layout', 'Search', 'Filter', 
                'Navigation', 'Card', 'Mode', 'Preset', 'Sort',
                'Selection', 'DragDrop', 'Settings', 'Event', 'UI', 'Performance'
            ];
            
            const categoriesEnabled: Partial<Record<DebugCategory, boolean>> = {};
            allCategories.forEach(cat => categoriesEnabled[cat] = true);
            
            settings = createSettings(categoriesEnabled);
            logger = new DebugLogger(() => settings);
            
            allCategories.forEach(category => {
                logger.debug(category, `${category} message`);
                expect(console.log).toHaveBeenCalledWith(`[${category}]`, `${category} message`);
            });
        });
    });
    
    describe('Multiple Loggers', () => {
        test('multiple loggers work independently', () => {
            const settings1 = createSettings({ View: true, Event: false });
            const settings2 = createSettings({ View: false, Event: true });
            
            const logger1 = new DebugLogger(() => settings1);
            const logger2 = new DebugLogger(() => settings2);
            
            logger1.debug('View', 'Logger 1 View message');
            logger1.debug('Event', 'Logger 1 Event message');
            logger2.debug('View', 'Logger 2 View message');
            logger2.debug('Event', 'Logger 2 Event message');
            
            expect(console.log).toHaveBeenCalledWith('[View]', 'Logger 1 View message');
            expect(console.log).not.toHaveBeenCalledWith('[Event]', 'Logger 1 Event message');
            expect(console.log).not.toHaveBeenCalledWith('[View]', 'Logger 2 View message');
            expect(console.log).toHaveBeenCalledWith('[Event]', 'Logger 2 Event message');
        });
    });
});

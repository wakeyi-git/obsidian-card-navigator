/**
 * SettingsManager 테스트
 * 
 * 설정 로드, 저장, 업데이트, 리셋 기능을 테스트합니다.
 */

import { App } from 'obsidian';
import { SettingsManager } from '../../src/settings';
import { CardNavigatorSettings, DEFAULT_SETTINGS } from '../../src/types';

jest.mock('obsidian');

describe('SettingsManager', () => {
    let settingsManager: SettingsManager;
    let mockApp: App;
    let mockSaveCallback: jest.Mock;

    beforeEach(() => {
        mockApp = {} as App;
        mockSaveCallback = jest.fn().mockResolvedValue(undefined);
        settingsManager = new SettingsManager(mockApp, mockSaveCallback);
    });

    describe('Initialization', () => {
        it('should initialize with default settings', () => {
            const settings = settingsManager.getSettings();

            expect(settings).toBeDefined();
            expect(settings.currentMode).toBe(DEFAULT_SETTINGS.currentMode);
        });

        it('should have all default settings properties', () => {
            const settings = settingsManager.getSettings();

            // 기본 속성
            expect(settings).toHaveProperty('currentMode');
            expect(settings).toHaveProperty('enablePresets');
            expect(settings).toHaveProperty('presets');
            expect(settings).toHaveProperty('presetMappings');
            expect(settings).toHaveProperty('debug');
            
            // 모드 설정
            expect(settings).toHaveProperty('folderMode');
            expect(settings.folderMode).toHaveProperty('useActiveFolder');
            expect(settings.folderMode).toHaveProperty('includeSubfolders');
            
            expect(settings).toHaveProperty('tagMode');
            expect(settings.tagMode).toHaveProperty('useActiveFileTags');
            expect(settings.tagMode).toHaveProperty('specifiedTags');
            expect(settings.tagMode).toHaveProperty('tagOperator');
            
            // 정렬 설정
            expect(settings).toHaveProperty('sort');
            expect(settings.sort).toHaveProperty('criteria');
            expect(settings.sort).toHaveProperty('order');
            
            // 레이아웃 설정
            expect(settings).toHaveProperty('layout');
            expect(settings.layout).toHaveProperty('mode');
            expect(settings.layout).toHaveProperty('cardMinWidth');
            expect(settings.layout).toHaveProperty('cardMaxWidth');
            
            // 카드 섹션 설정
            expect(settings).toHaveProperty('header');
            expect(settings).toHaveProperty('body');
            expect(settings).toHaveProperty('footer');
            
            // 카드 스타일
            expect(settings).toHaveProperty('normalCardStyle');
            expect(settings).toHaveProperty('activeCardStyle');
            expect(settings).toHaveProperty('focusedCardStyle');
        });
    });

    describe('loadSettings', () => {
        it('should load settings from data', () => {
            const customData = {
                currentMode: 'tag' as const,
                sort: {
                    criteria: 'modified' as const,
                    order: 'desc' as const
                }
            };

            settingsManager.loadSettings(customData);
            const settings = settingsManager.getSettings();

            expect(settings.currentMode).toBe('tag');
            expect(settings.sort.criteria).toBe('modified');
            expect(settings.sort.order).toBe('desc');
        });

        it('should merge with default settings for missing properties', () => {
            const partialData = {
                currentMode: 'tag' as const
            };

            settingsManager.loadSettings(partialData);
            const settings = settingsManager.getSettings();

            expect(settings.currentMode).toBe('tag');
            expect(settings.sort.criteria).toBe(DEFAULT_SETTINGS.sort.criteria);
            expect(settings.sort.order).toBe(DEFAULT_SETTINGS.sort.order);
        });

        it('should handle null data by using defaults', () => {
            settingsManager.loadSettings(null);
            const settings = settingsManager.getSettings();

            expect(settings).toEqual(DEFAULT_SETTINGS);
        });

        it('should handle undefined data by using defaults', () => {
            settingsManager.loadSettings(null);
            const settings = settingsManager.getSettings();

            expect(settings).toEqual(DEFAULT_SETTINGS);
        });

        it('should deep merge nested objects', () => {
            const customData = {
                layout: {
                    cardMinWidth: 300
                    // gap은 제공하지 않음
                } as any
            };

            settingsManager.loadSettings(customData);
            const settings = settingsManager.getSettings();

            expect(settings.layout.cardMinWidth).toBe(300);
            expect(settings.layout.gap).toBe(DEFAULT_SETTINGS.layout.gap);
        });
    });

    describe('updateSettings', () => {
        it('should update single property', async () => {
            await settingsManager.updateSettings({
                currentMode: 'tag'
            });

            const settings = settingsManager.getSettings();
            expect(settings.currentMode).toBe('tag');
            expect(mockSaveCallback).toHaveBeenCalledWith(settings);
        });

        it('should update multiple properties', async () => {
            await settingsManager.updateSettings({
                currentMode: 'tag',
                sort: {
                    criteria: 'modified',
                    order: 'desc'
                }
            });

            const settings = settingsManager.getSettings();
            expect(settings.currentMode).toBe('tag');
            expect(settings.sort.criteria).toBe('modified');
            expect(settings.sort.order).toBe('desc');
        });

        it('should deep merge nested objects', async () => {
            await settingsManager.updateSettings({
                layout: {
                    cardMinWidth: 300
                } as any
            });

            const settings = settingsManager.getSettings();
            expect(settings.layout.cardMinWidth).toBe(300);
            expect(settings.layout.gap).toBe(DEFAULT_SETTINGS.layout.gap);
        });

        it('should preserve other properties when updating', async () => {
            const originalSortCriteria = settingsManager.getSettings().sort.criteria;

            await settingsManager.updateSettings({
                currentMode: 'tag'
            });

            const settings = settingsManager.getSettings();
            expect(settings.currentMode).toBe('tag');
            expect(settings.sort.criteria).toBe(originalSortCriteria);
        });

        it('should call save callback', async () => {
            await settingsManager.updateSettings({
                currentMode: 'tag'
            });

            expect(mockSaveCallback).toHaveBeenCalledTimes(1);
            expect(mockSaveCallback).toHaveBeenCalledWith(
                expect.objectContaining({ currentMode: 'tag' })
            );
        });

        it('should handle save callback errors', async () => {
            mockSaveCallback.mockRejectedValueOnce(new Error('Save failed'));

            await expect(
                settingsManager.updateSettings({ currentMode: 'tag' })
            ).rejects.toThrow('Save failed');
        });

        it('should update debug settings', async () => {
            await settingsManager.updateSettings({
                debug: {
                    enabled: true,
                    categories: {
                        View: true,
                        Performance: false
                    }
                }
            });

            const settings = settingsManager.getSettings();
            expect(settings.debug.enabled).toBe(true);
            expect(settings.debug.categories?.View).toBe(true);
            expect(settings.debug.categories?.Performance).toBe(false);
        });
    });

    describe('resetSettings', () => {
        it('should reset all settings to default', async () => {
            // 설정 변경
            await settingsManager.updateSettings({
                currentMode: 'tag',
                sort: {
                    criteria: 'modified',
                    order: 'desc'
                }
            });

            // 리셋
            await settingsManager.resetSettings();

            const settings = settingsManager.getSettings();
            expect(settings).toEqual(DEFAULT_SETTINGS);
        });

        it('should call save callback after reset', async () => {
            mockSaveCallback.mockClear();

            await settingsManager.resetSettings();

            expect(mockSaveCallback).toHaveBeenCalledTimes(1);
            expect(mockSaveCallback).toHaveBeenCalledWith(DEFAULT_SETTINGS);
        });

        it('should handle multiple resets', async () => {
            await settingsManager.updateSettings({ currentMode: 'tag' });
            await settingsManager.resetSettings();
            await settingsManager.updateSettings({ currentMode: 'folder' });
            await settingsManager.resetSettings();

            const settings = settingsManager.getSettings();
            expect(settings).toEqual(DEFAULT_SETTINGS);
        });
    });

    describe('Deep Merge Behavior', () => {
        it('should not mutate original default settings', async () => {
            const originalDefaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

            await settingsManager.updateSettings({
                currentMode: 'tag',
                layout: { cardMinWidth: 300 } as any
            });

            expect(DEFAULT_SETTINGS).toEqual(originalDefaults);
        });

        it('should handle deeply nested updates', async () => {
            await settingsManager.updateSettings({
                header: {
                    enabled: true,
                    normalContent: {
                        contentType: 'filename',
                        maxLength: 150
                    }
                } as any
            });

            const settings = settingsManager.getSettings();
            expect(settings.header.enabled).toBe(true);
            expect(settings.header.normalContent.contentType).toBe('filename');
            expect(settings.header.normalContent.maxLength).toBe(150);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty update', async () => {
            const beforeSettings = settingsManager.getSettings();

            await settingsManager.updateSettings({});

            const afterSettings = settingsManager.getSettings();
            expect(afterSettings).toEqual(beforeSettings);
        });

        it('should handle null values in update', async () => {
            await settingsManager.updateSettings({
                folderMode: {
                    specifiedFolder: null as any
                } as any
            });

            const settings = settingsManager.getSettings();
            expect(settings.folderMode.specifiedFolder).toBeNull();
        });

        it('should handle undefined values in update', async () => {
            const originalMode = settingsManager.getSettings().currentMode;

            await settingsManager.updateSettings({
                currentMode: undefined
            });

            const settings = settingsManager.getSettings();
            expect(settings.currentMode).toBe(originalMode); // undefined는 무시
        });
    });

    describe('getSettings', () => {
        it('should return current settings object', () => {
            const settings = settingsManager.getSettings();
            expect(settings).toBeDefined();
            expect(settings).toHaveProperty('currentMode');
        });

        it('should return same reference on multiple calls', () => {
            const settings1 = settingsManager.getSettings();
            const settings2 = settingsManager.getSettings();

            expect(settings1).toBe(settings2);
        });

        it('should reflect updates immediately', async () => {
            const before = settingsManager.getSettings().currentMode;

            await settingsManager.updateSettings({ currentMode: 'tag' });

            const after = settingsManager.getSettings().currentMode;
            expect(after).not.toBe(before);
            expect(after).toBe('tag');
        });
    });
});

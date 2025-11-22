import { TFile, App } from 'obsidian';
import { PresetManager } from '../../src/preset/PresetManager';
import { CardNavigatorSettings, Preset, PresetMapping, DEFAULT_SETTINGS } from '../../src/types';
import CardNavigatorPlugin from '../../src/main';

describe('PresetManager', () => {
    let plugin: CardNavigatorPlugin;
    let manager: PresetManager;
    let mockSettings: CardNavigatorSettings;
    
    beforeEach(() => {
        // ✅ 완전한 CardNavigatorSettings 사용
        mockSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        
        // Mock plugin
        plugin = {
            app: {
                metadataCache: {
                    getFileCache: jest.fn()
                },
                vault: {}
            } as any,
            settings: mockSettings,
            settingsManager: {
                getSettings: jest.fn().mockReturnValue(mockSettings)
            },
            saveSettings: jest.fn().mockResolvedValue(undefined),
            refreshView: jest.fn()
        } as any;
        
        manager = new PresetManager(plugin);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await manager.initialize();
            
            expect(manager.getCurrentPresetId()).toBeNull();
        });
        
        it('should reset state', () => {
            // Set a preset ID
            (manager as any).currentPresetId = 'test-id';
            
            manager.reset();
            
            expect(manager.getCurrentPresetId()).toBeNull();
        });
    });
    
    describe('createPreset', () => {
        it('should create a new preset with current settings', () => {
            const preset = manager.createPreset('Test Preset', 'Description');
            
            expect(preset.name).toBe('Test Preset');
            expect(preset.description).toBe('Description');
            expect(preset.id).toBeTruthy();
            expect(preset.createdAt).toBeTruthy();
            expect(preset.settings).toBeDefined();
        });
        
        it('should add preset to settings', () => {
            manager.createPreset('Test');
            
            expect(mockSettings.presets.length).toBe(1);
            expect(plugin.saveSettings).toHaveBeenCalled();
        });
        
        it('should clone current settings deeply', () => {
            const original = { ...mockSettings };
            const preset = manager.createPreset('Test');
            
            // Modify preset settings
            preset.settings.currentMode = 'tag';
            
            // Original should not be affected
            expect(mockSettings.currentMode).toBe(original.currentMode);
        });
    });
    
    describe('deletePreset', () => {
        it('should delete existing preset', async () => {
            const preset = manager.createPreset('Test');
            
            await manager.deletePreset(preset.id);
            
            expect(mockSettings.presets.length).toBe(0);
            expect(plugin.saveSettings).toHaveBeenCalled();
        });
        
        it('should remove related mappings', async () => {
            const preset = manager.createPreset('Test');
            
            await manager.addMapping({
                type: 'folder',
                target: '/test',
                presetId: preset.id,
                priority: 1,
                includeSubfolders: false
            });
            
            await manager.deletePreset(preset.id);
            
            expect(mockSettings.presetMappings.length).toBe(0);
        });
        
        it('should clear current preset ID if deleted', async () => {
            const preset = manager.createPreset('Test');
            (manager as any).currentPresetId = preset.id;
            
            await manager.deletePreset(preset.id);
            
            expect(manager.getCurrentPresetId()).toBeNull();
        });
        
        it('should handle deleting non-existent preset', async () => {
            await manager.deletePreset('non-existent');
            
            expect(mockSettings.presets.length).toBe(0);
        });
    });
    
    describe('updatePreset', () => {
        it('should update preset name and description', async () => {
            const preset = manager.createPreset('Original', 'Original Desc');
            
            await manager.updatePreset(preset.id, 'Updated', 'Updated Desc');
            
            const updated = manager.getPreset(preset.id);
            expect(updated?.name).toBe('Updated');
            expect(updated?.description).toBe('Updated Desc');
        });
        
        it('should update preset settings with current settings', async () => {
            const preset = manager.createPreset('Test');
            
            // Change plugin settings
            mockSettings.currentMode = 'tag';
            
            await manager.updatePreset(preset.id, 'Test', 'Desc');
            
            const updated = manager.getPreset(preset.id);
            expect(updated?.settings.currentMode).toBe('tag');
        });
        
        it('should handle updating non-existent preset', async () => {
            await manager.updatePreset('non-existent', 'Test', 'Desc');
            
            // Should not throw error
            expect(true).toBe(true);
        });
    });
    
    describe('duplicatePreset', () => {
        it('should create a copy of preset', async () => {
            const original = manager.createPreset('Original', 'Desc');
            
            const duplicate = await manager.duplicatePreset(original.id);
            
            expect(duplicate).toBeTruthy();
            expect(duplicate?.name).toBe('Original (copy)');
            expect(duplicate?.description).toBe('Desc');
            expect(duplicate?.id).not.toBe(original.id);
        });
        
        it('should deep clone settings', async () => {
            const original = manager.createPreset('Original');
            
            const duplicate = await manager.duplicatePreset(original.id);
            
            // Modify duplicate
            if (duplicate) {
                duplicate.settings.currentMode = 'tag';
            }
            
            // Original should not be affected
            const originalPreset = manager.getPreset(original.id);
            expect(originalPreset?.settings.currentMode).not.toBe('tag');
        });
        
        it('should handle duplicating non-existent preset', async () => {
            const result = await manager.duplicatePreset('non-existent');
            
            expect(result).toBeNull();
        });
    });
    
    describe('getAllPresets', () => {
        it('should return all presets', () => {
            manager.createPreset('Preset 1');
            manager.createPreset('Preset 2');
            manager.createPreset('Preset 3');
            
            const presets = manager.getAllPresets();
            
            expect(presets.length).toBe(3);
        });
        
        it('should return empty array when no presets', () => {
            const presets = manager.getAllPresets();
            
            expect(presets).toEqual([]);
        });
    });
    
    describe('getPreset', () => {
        it('should return preset by ID', () => {
            const preset = manager.createPreset('Test');
            
            const found = manager.getPreset(preset.id);
            
            expect(found).toBe(preset);
        });
        
        it('should return undefined for non-existent ID', () => {
            const found = manager.getPreset('non-existent');
            
            expect(found).toBeUndefined();
        });
    });
    
    describe('applyPreset', () => {
        it('should apply preset settings', async () => {
            const preset = manager.createPreset('Test');
            preset.settings.currentMode = 'tag';
            
            await manager.applyPreset(preset.id);
            
            expect(mockSettings.currentMode).toBe('tag');
            expect(manager.getCurrentPresetId()).toBe(preset.id);
            expect(plugin.refreshView).toHaveBeenCalled();
        });
        
        it('should not overwrite presets and mappings', async () => {
            const preset1 = manager.createPreset('Preset 1');
            const preset2 = manager.createPreset('Preset 2');
            
            await manager.applyPreset(preset1.id);
            
            // Should still have both presets
            expect(mockSettings.presets.length).toBe(2);
        });
        
        it('should handle applying non-existent preset', async () => {
            await manager.applyPreset('non-existent');
            
            // Should not throw error
            expect(true).toBe(true);
        });
    });
    
    describe('autoApplyPreset', () => {
        it('should return false when presets disabled', async () => {
            mockSettings.enablePresets = false;
            
            const file = new TFile();
            const changed = await manager.autoApplyPreset(file);
            
            expect(changed).toBe(false);
        });
        
        it('should clear preset for null file', async () => {
            const preset = manager.createPreset('Test');
            (manager as any).currentPresetId = preset.id;
            
            const changed = await manager.autoApplyPreset(null);
            
            expect(changed).toBe(true);
            expect(manager.getCurrentPresetId()).toBeNull();
        });
        
        it('should not change when no matching preset', async () => {
            const file = new TFile();
            file.path = 'test.md';
            
            const changed = await manager.autoApplyPreset(file);
            
            expect(changed).toBe(false);
            expect(manager.getCurrentPresetId()).toBeNull();
        });
        
        it('should detect preset change', async () => {
            const preset = manager.createPreset('Test');
            await manager.addMapping({
                type: 'folder',
                target: 'test-folder',
                presetId: preset.id,
                priority: 1,
                includeSubfolders: false
            });
            
            const file = new TFile();
            file.path = 'test-folder/test.md';
            file.parent = { path: 'test-folder' } as any;
            
            const changed = await manager.autoApplyPreset(file);
            
            expect(changed).toBe(true);
            expect(manager.getCurrentPresetId()).toBe(preset.id);
        });
    });
    
    describe('preset mappings', () => {
        describe('addMapping', () => {
            it('should add new mapping', async () => {
                const preset = manager.createPreset('Test');
                
                await manager.addMapping({
                    type: 'folder',
                    target: '/test',
                    presetId: preset.id,
                    priority: 1,
                    includeSubfolders: false
                });
                
                expect(mockSettings.presetMappings.length).toBe(1);
            });
            
            it('should replace existing mapping for same type/target', async () => {
                const preset1 = manager.createPreset('Preset 1');
                const preset2 = manager.createPreset('Preset 2');
                
                await manager.addMapping({
                    type: 'folder',
                    target: '/test',
                    presetId: preset1.id,
                    priority: 1,
                    includeSubfolders: false
                });
                
                await manager.addMapping({
                    type: 'folder',
                    target: '/test',
                    presetId: preset2.id,
                    priority: 2,
                    includeSubfolders: true
                });
                
                expect(mockSettings.presetMappings.length).toBe(1);
                expect(mockSettings.presetMappings[0].presetId).toBe(preset2.id);
            });
        });
        
        describe('removeMapping', () => {
            it('should remove specific mapping', async () => {
                const preset = manager.createPreset('Test');
                
                await manager.addMapping({
                    type: 'folder',
                    target: '/test',
                    presetId: preset.id,
                    priority: 1,
                    includeSubfolders: false
                });
                
                await manager.removeMapping('folder', '/test');
                
                expect(mockSettings.presetMappings.length).toBe(0);
            });
            
            it('should not affect other mappings', async () => {
                const preset = manager.createPreset('Test');
                
                await manager.addMapping({
                    type: 'folder',
                    target: '/test1',
                    presetId: preset.id,
                    priority: 1,
                    includeSubfolders: false
                });
                
                await manager.addMapping({
                    type: 'folder',
                    target: '/test2',
                    presetId: preset.id,
                    priority: 2,
                    includeSubfolders: false
                });
                
                await manager.removeMapping('folder', '/test1');
                
                expect(mockSettings.presetMappings.length).toBe(1);
                expect(mockSettings.presetMappings[0].target).toBe('/test2');
            });
        });
        
        describe('getMappingsByType', () => {
            it('should return mappings of specified type', async () => {
                const preset = manager.createPreset('Test');
                
                await manager.addMapping({
                    type: 'folder',
                    target: '/folder1',
                    presetId: preset.id,
                    priority: 1,
                    includeSubfolders: false
                });
                
                await manager.addMapping({
                    type: 'tag',
                    target: '#tag1',
                    presetId: preset.id,
                    priority: 1,
                    includeSubfolders: false
                });
                
                const folderMappings = manager.getMappingsByType('folder');
                const tagMappings = manager.getMappingsByType('tag');
                
                expect(folderMappings.length).toBe(1);
                expect(tagMappings.length).toBe(1);
            });
        });
        
        describe('updateMappingPriority', () => {
            it('should update mapping priority', async () => {
                const preset = manager.createPreset('Test');
                
                await manager.addMapping({
                    type: 'folder',
                    target: '/test',
                    presetId: preset.id,
                    priority: 1,
                    includeSubfolders: false
                });
                
                await manager.updateMappingPriority('folder', '/test', 5);
                
                const mapping = mockSettings.presetMappings[0];
                expect(mapping.priority).toBe(5);
            });
        });
    });
    
    describe('findMatchingPreset', () => {
        let file: TFile;
        let preset: Preset;
        
        beforeEach(() => {
            file = new TFile();
            file.path = 'folder/test.md';
            file.parent = { path: 'folder' } as any;
            
            preset = manager.createPreset('Test');
        });
        
        it('should match folder without subfolders', async () => {
            await manager.addMapping({
                type: 'folder',
                target: 'folder',
                presetId: preset.id,
                priority: 1,
                includeSubfolders: false
            });
            
            const matched = manager.findMatchingPreset(file);
            
            expect(matched).toBe(preset);
        });
        
        it('should match folder with subfolders', async () => {
            file.path = 'folder/subfolder/test.md';
            file.parent = { path: 'folder/subfolder' } as any;
            
            await manager.addMapping({
                type: 'folder',
                target: 'folder',
                presetId: preset.id,
                priority: 1,
                includeSubfolders: true
            });
            
            const matched = manager.findMatchingPreset(file);
            
            expect(matched).toBe(preset);
        });
        
        it('should not match when subfolders not included', async () => {
            file.path = 'folder/subfolder/test.md';
            file.parent = { path: 'folder/subfolder' } as any;
            
            await manager.addMapping({
                type: 'folder',
                target: 'folder',
                presetId: preset.id,
                priority: 1,
                includeSubfolders: false
            });
            
            const matched = manager.findMatchingPreset(file);
            
            expect(matched).toBeNull();
        });
        
        it('should match tags', async () => {
            (plugin.app.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                tags: [{ tag: '#test-tag' }]
            });
            
            await manager.addMapping({
                type: 'tag',
                target: '#test-tag',
                presetId: preset.id,
                priority: 1,
                includeSubfolders: false
            });
            
            const matched = manager.findMatchingPreset(file);
            
            expect(matched).toBe(preset);
        });
        
        it('should normalize tag prefixes', async () => {
            (plugin.app.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                frontmatter: { tags: ['test-tag'] }  // No # prefix
            });
            
            await manager.addMapping({
                type: 'tag',
                target: '#test-tag',  // With # prefix
                presetId: preset.id,
                priority: 1,
                includeSubfolders: false
            });
            
            const matched = manager.findMatchingPreset(file);
            
            expect(matched).toBe(preset);
        });
        
        it('should respect priority order', async () => {
            const preset2 = manager.createPreset('High Priority');
            
            await manager.addMapping({
                type: 'folder',
                target: 'folder',
                presetId: preset.id,
                priority: 10,  // Lower priority
                includeSubfolders: false
            });
            
            await manager.addMapping({
                type: 'folder',
                target: 'folder',
                presetId: preset2.id,
                priority: 5,  // Higher priority (lower number)
                includeSubfolders: true
            });
            
            const matched = manager.findMatchingPreset(file);
            
            // Should match preset2 (higher priority)
            expect(matched).toBe(preset2);
        });
        
        it('should follow auto priority in folder mode', async () => {
            mockSettings.currentMode = 'folder';
            mockSettings.presetPriority.mode = 'auto';
            
            const folderPreset = manager.createPreset('Folder Preset');
            const tagPreset = manager.createPreset('Tag Preset');
            
            file.parent = { path: 'test-folder' } as any;
            
            (plugin.app.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                tags: [{ tag: '#test-tag' }]
            });
            
            await manager.addMapping({
                type: 'folder',
                target: 'test-folder',
                presetId: folderPreset.id,
                priority: 10,
                includeSubfolders: false
            });
            
            await manager.addMapping({
                type: 'tag',
                target: '#test-tag',
                presetId: tagPreset.id,
                priority: 1,
                includeSubfolders: false
            });
            
            const matched = manager.findMatchingPreset(file);
            
            // In folder mode, tags are more specific -> tag preset wins
            expect(matched).toBe(tagPreset);
        });
        
        it('should return null for no matches', () => {
            const matched = manager.findMatchingPreset(file);
            
            expect(matched).toBeNull();
        });
    });
    
    describe('import/export', () => {
        it('should export preset as JSON', () => {
            const preset = manager.createPreset('Test', 'Description');
            
            const json = manager.exportPreset(preset.id);
            
            expect(json).toBeTruthy();
            const parsed = JSON.parse(json);
            expect(parsed.name).toBe('Test');
            expect(parsed.description).toBe('Description');
        });
        
        it('should import preset from JSON', async () => {
            const preset = manager.createPreset('Test');
            const json = manager.exportPreset(preset.id);
            
            // Clear presets
            mockSettings.presets = [];
            
            const success = await manager.importPreset(json);
            
            expect(success).toBe(true);
            expect(mockSettings.presets.length).toBe(1);
        });
        
        it('should assign new ID on import', async () => {
            const preset = manager.createPreset('Test');
            const originalId = preset.id;
            const json = manager.exportPreset(originalId);
            
            const success = await manager.importPreset(json);
            
            const imported = mockSettings.presets[mockSettings.presets.length - 1];
            expect(imported.id).not.toBe(originalId);
        });
        
        it('should handle invalid JSON on import', async () => {
            const success = await manager.importPreset('invalid json');
            
            expect(success).toBe(false);
        });
    });
    
    describe('getCardSettingsForFile', () => {
        it('should return null when presets disabled', () => {
            mockSettings.enablePresets = false;
            
            const file = new TFile();
            const settings = manager.getCardSettingsForFile(file);
            
            expect(settings).toBeNull();
        });
        
        it('should return null for null file', () => {
            const settings = manager.getCardSettingsForFile(null);
            
            expect(settings).toBeNull();
        });
        
        it('should return card settings when preset matches', async () => {
            const preset = manager.createPreset('Test');
            const file = new TFile();
            file.path = 'test-folder/test.md';
            file.parent = { path: 'test-folder' } as any;
            
            await manager.addMapping({
                type: 'folder',
                target: 'test-folder',
                presetId: preset.id,
                priority: 1,
                includeSubfolders: false
            });
            
            const settings = manager.getCardSettingsForFile(file);
            
            expect(settings).toBeTruthy();
            expect(settings?.header).toBeDefined();
            expect(settings?.body).toBeDefined();
            expect(settings?.footer).toBeDefined();
        });
    });
});

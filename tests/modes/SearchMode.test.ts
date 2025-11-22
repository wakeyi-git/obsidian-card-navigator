/**
 * SearchMode 테스트
 * 
 * 검색 모드의 상태 관리 및 동작을 테스트합니다.
 */

import { TFile } from 'obsidian';
import { SearchMode } from '../../src/modes/SearchMode';

// Helper: Mock TFile 생성
function createMockFile(
    basename: string,
    path: string = `${basename}.md`
): TFile {
    const file = new TFile();
    file.basename = basename;
    file.name = `${basename}.md`;
    file.path = path;
    file.extension = 'md';
    
    file.stat = {
        ctime: Date.now(),
        mtime: Date.now(),
        size: 1000
    } as any;
    
    return file;
}

describe('SearchMode', () => {
    let searchMode: SearchMode;
    
    beforeEach(() => {
        searchMode = new SearchMode();
    });
    
    describe('Initial State', () => {
        it('should start inactive', () => {
            expect(searchMode.isActive()).toBe(false);
        });
        
        it('should have empty search results', () => {
            expect(searchMode.getFiles()).toEqual([]);
        });
        
        it('should have empty query', () => {
            expect(searchMode.getQuery()).toBe('');
        });
        
        it('should have folder as default previous mode', () => {
            expect(searchMode.getPreviousMode()).toBe('folder');
        });
    });
    
    describe('Activation', () => {
        it('should activate search mode', () => {
            const files = [createMockFile('file1'), createMockFile('file2')];
            
            searchMode.activate('folder', files, 'test query');
            
            expect(searchMode.isActive()).toBe(true);
        });
        
        it('should store search results', () => {
            const files = [createMockFile('file1'), createMockFile('file2')];
            
            searchMode.activate('folder', files, 'test query');
            
            expect(searchMode.getFiles()).toEqual(files);
        });
        
        it('should store search query', () => {
            const files = [createMockFile('file1')];
            
            searchMode.activate('folder', files, 'test query');
            
            expect(searchMode.getQuery()).toBe('test query');
        });
        
        it('should store previous mode', () => {
            const files = [createMockFile('file1')];
            
            searchMode.activate('tag', files, 'query');
            
            expect(searchMode.getPreviousMode()).toBe('tag');
        });
        
        it('should preserve previous mode on subsequent activations', () => {
            const files = [createMockFile('file1')];
            
            // First activation with 'folder'
            searchMode.activate('folder', files, 'query1');
            expect(searchMode.getPreviousMode()).toBe('folder');
            
            // Second activation with 'tag' (should keep 'folder')
            searchMode.activate('tag', files, 'query2');
            expect(searchMode.getPreviousMode()).toBe('folder');
        });
        
        it('should handle empty search results', () => {
            searchMode.activate('folder', [], 'no results');
            
            expect(searchMode.isActive()).toBe(true);
            expect(searchMode.getFiles()).toEqual([]);
        });
        
        it('should handle empty query', () => {
            const files = [createMockFile('file1')];
            
            searchMode.activate('folder', files, '');
            
            expect(searchMode.isActive()).toBe(true);
            expect(searchMode.getQuery()).toBe('');
        });
    });
    
    describe('Deactivation', () => {
        it('should deactivate search mode', () => {
            const files = [createMockFile('file1')];
            searchMode.activate('folder', files, 'query');
            
            searchMode.deactivate();
            
            expect(searchMode.isActive()).toBe(false);
        });
        
        it('should clear search results', () => {
            const files = [createMockFile('file1'), createMockFile('file2')];
            searchMode.activate('folder', files, 'query');
            
            searchMode.deactivate();
            
            expect(searchMode.getFiles()).toEqual([]);
        });
        
        it('should clear search query', () => {
            const files = [createMockFile('file1')];
            searchMode.activate('folder', files, 'test query');
            
            searchMode.deactivate();
            
            expect(searchMode.getQuery()).toBe('');
        });
        
        it('should preserve previous mode after deactivation', () => {
            const files = [createMockFile('file1')];
            searchMode.activate('tag', files, 'query');
            
            searchMode.deactivate();
            
            expect(searchMode.getPreviousMode()).toBe('tag');
        });
        
        it('should allow reactivation after deactivation', () => {
            const files1 = [createMockFile('file1')];
            const files2 = [createMockFile('file2')];
            
            // First activation
            searchMode.activate('folder', files1, 'query1');
            expect(searchMode.isActive()).toBe(true);
            
            // Deactivation
            searchMode.deactivate();
            expect(searchMode.isActive()).toBe(false);
            
            // Second activation
            searchMode.activate('tag', files2, 'query2');
            expect(searchMode.isActive()).toBe(true);
            expect(searchMode.getPreviousMode()).toBe('tag');
        });
    });
    
    describe('Update Results', () => {
        it('should update results when active', () => {
            const files1 = [createMockFile('file1')];
            const files2 = [createMockFile('file2'), createMockFile('file3')];
            
            searchMode.activate('folder', files1, 'query1');
            searchMode.updateResults(files2, 'query2');
            
            expect(searchMode.getFiles()).toEqual(files2);
            expect(searchMode.getQuery()).toBe('query2');
        });
        
        it('should not update results when inactive', () => {
            const files = [createMockFile('file1')];
            
            searchMode.updateResults(files, 'query');
            
            expect(searchMode.getFiles()).toEqual([]);
            expect(searchMode.getQuery()).toBe('');
        });
        
        it('should handle empty results update', () => {
            const files = [createMockFile('file1')];
            
            searchMode.activate('folder', files, 'query1');
            searchMode.updateResults([], 'query2');
            
            expect(searchMode.getFiles()).toEqual([]);
            expect(searchMode.getQuery()).toBe('query2');
        });
        
        it('should handle empty query update', () => {
            const files1 = [createMockFile('file1')];
            const files2 = [createMockFile('file2')];
            
            searchMode.activate('folder', files1, 'query');
            searchMode.updateResults(files2, '');
            
            expect(searchMode.getFiles()).toEqual(files2);
            expect(searchMode.getQuery()).toBe('');
        });
    });
    
    describe('Reset', () => {
        it('should reset to initial state', () => {
            const files = [createMockFile('file1')];
            
            searchMode.activate('tag', files, 'query');
            searchMode.reset();
            
            expect(searchMode.isActive()).toBe(false);
            expect(searchMode.getFiles()).toEqual([]);
            expect(searchMode.getQuery()).toBe('');
            expect(searchMode.getPreviousMode()).toBe('folder');
        });
        
        it('should reset when already inactive', () => {
            searchMode.reset();
            
            expect(searchMode.isActive()).toBe(false);
            expect(searchMode.getFiles()).toEqual([]);
            expect(searchMode.getQuery()).toBe('');
            expect(searchMode.getPreviousMode()).toBe('folder');
        });
        
        it('should allow activation after reset', () => {
            const files = [createMockFile('file1')];
            
            searchMode.activate('tag', files, 'query1');
            searchMode.reset();
            searchMode.activate('folder', [createMockFile('file2')], 'query2');
            
            expect(searchMode.isActive()).toBe(true);
            expect(searchMode.getPreviousMode()).toBe('folder');
        });
    });
    
    describe('State Transitions', () => {
        it('should handle activate → update → deactivate', () => {
            const files1 = [createMockFile('file1')];
            const files2 = [createMockFile('file2')];
            
            // Activate
            searchMode.activate('folder', files1, 'query1');
            expect(searchMode.isActive()).toBe(true);
            expect(searchMode.getQuery()).toBe('query1');
            
            // Update
            searchMode.updateResults(files2, 'query2');
            expect(searchMode.getQuery()).toBe('query2');
            
            // Deactivate
            searchMode.deactivate();
            expect(searchMode.isActive()).toBe(false);
        });
        
        it('should handle activate → reset → activate', () => {
            const files1 = [createMockFile('file1')];
            const files2 = [createMockFile('file2')];
            
            // First activation
            searchMode.activate('tag', files1, 'query1');
            expect(searchMode.getPreviousMode()).toBe('tag');
            
            // Reset
            searchMode.reset();
            expect(searchMode.getPreviousMode()).toBe('folder');
            
            // Second activation
            searchMode.activate('folder', files2, 'query2');
            expect(searchMode.getPreviousMode()).toBe('folder');
        });
        
        it('should handle multiple activations without deactivation', () => {
            const files1 = [createMockFile('file1')];
            const files2 = [createMockFile('file2')];
            const files3 = [createMockFile('file3')];
            
            searchMode.activate('folder', files1, 'query1');
            expect(searchMode.getQuery()).toBe('query1');
            
            searchMode.activate('tag', files2, 'query2');
            expect(searchMode.getQuery()).toBe('query2');
            expect(searchMode.getPreviousMode()).toBe('folder'); // Preserved
            
            searchMode.activate('folder', files3, 'query3');
            expect(searchMode.getQuery()).toBe('query3');
            expect(searchMode.getPreviousMode()).toBe('folder'); // Still preserved
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle files with special characters', () => {
            const files = [
                createMockFile('file!@#', 'folder/file!@#.md'),
                createMockFile('파일', '폴더/파일.md')
            ];
            
            searchMode.activate('folder', files, 'special');
            
            expect(searchMode.getFiles()).toEqual(files);
        });
        
        it('should handle very long query', () => {
            const longQuery = 'a'.repeat(1000);
            const files = [createMockFile('file1')];
            
            searchMode.activate('folder', files, longQuery);
            
            expect(searchMode.getQuery()).toBe(longQuery);
        });
        
        it('should handle large number of results', () => {
            const files = Array.from({ length: 1000 }, (_, i) =>
                createMockFile(`file${i}`)
            );
            
            searchMode.activate('folder', files, 'query');
            
            expect(searchMode.getFiles().length).toBe(1000);
        });
        
        it('should handle query with special characters', () => {
            const files = [createMockFile('file1')];
            const specialQuery = 'query with !@#$%^&*() chars';
            
            searchMode.activate('folder', files, specialQuery);
            
            expect(searchMode.getQuery()).toBe(specialQuery);
        });
        
        it('should handle whitespace-only query', () => {
            const files = [createMockFile('file1')];
            
            searchMode.activate('folder', files, '   ');
            
            expect(searchMode.getQuery()).toBe('   ');
        });
    });
    
    describe('Previous Mode Management', () => {
        it('should switch from folder to search and back', () => {
            const files = [createMockFile('file1')];
            
            // Start in folder mode
            searchMode.activate('folder', files, 'query');
            expect(searchMode.getPreviousMode()).toBe('folder');
            
            // Deactivate (back to folder mode)
            searchMode.deactivate();
            expect(searchMode.getPreviousMode()).toBe('folder');
        });
        
        it('should switch from tag to search and back', () => {
            const files = [createMockFile('file1')];
            
            // Start in tag mode
            searchMode.activate('tag', files, 'query');
            expect(searchMode.getPreviousMode()).toBe('tag');
            
            // Deactivate (back to tag mode)
            searchMode.deactivate();
            expect(searchMode.getPreviousMode()).toBe('tag');
        });
        
        it('should preserve mode through multiple search updates', () => {
            const files1 = [createMockFile('file1')];
            const files2 = [createMockFile('file2')];
            const files3 = [createMockFile('file3')];
            
            searchMode.activate('tag', files1, 'query1');
            searchMode.updateResults(files2, 'query2');
            searchMode.updateResults(files3, 'query3');
            
            expect(searchMode.getPreviousMode()).toBe('tag');
        });
    });
    
    describe('Immutability', () => {
        it('should not modify original files array', () => {
            const files = [createMockFile('file1'), createMockFile('file2')];
            const originalLength = files.length;
            
            searchMode.activate('folder', files, 'query');
            files.push(createMockFile('file3'));
            
            expect(searchMode.getFiles().length).toBe(originalLength);
        });
        
        it('should return independent files array', () => {
            const files = [createMockFile('file1')];
            
            searchMode.activate('folder', files, 'query');
            const retrieved = searchMode.getFiles();
            retrieved.push(createMockFile('file2'));
            
            expect(searchMode.getFiles().length).toBe(1);
        });
    });
});
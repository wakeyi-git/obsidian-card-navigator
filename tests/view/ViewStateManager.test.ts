/**
 * ViewStateManager 테스트
 */

import { ViewStateManager } from '../../src/view/ViewStateManager';
import { TFile } from 'obsidian';

// Mock TFile 헬퍼 함수
const createMockFile = (path: string): TFile => {
    const file = new TFile();
    file.path = path;
    return file;
};

describe('ViewStateManager', () => {
    let stateManager: ViewStateManager;
    
    beforeEach(() => {
        stateManager = new ViewStateManager();
    });
    
    describe('초기 상태', () => {
        it('should start with default state', () => {
            expect(stateManager.getIsRendering()).toBe(false);
            expect(stateManager.getCurrentRenderingId()).toBe(0);
            expect(stateManager.getPreviousFile()).toBeNull();
            expect(stateManager.getSearchQuery()).toBe('');
            expect(stateManager.hasSearchQuery()).toBe(false);
        });
    });
    
    describe('렌더링 상태 관리', () => {
        it('should start rendering and return ID', () => {
            const id = stateManager.startRendering();
            
            expect(id).toBe(1);
            expect(stateManager.getIsRendering()).toBe(true);
            expect(stateManager.getCurrentRenderingId()).toBe(1);
        });
        
        it('should increment rendering ID on each start', () => {
            const id1 = stateManager.startRendering();
            stateManager.endRendering();
            
            const id2 = stateManager.startRendering();
            stateManager.endRendering();
            
            const id3 = stateManager.startRendering();
            
            expect(id1).toBe(1);
            expect(id2).toBe(2);
            expect(id3).toBe(3);
        });
        
        it('should end rendering', () => {
            stateManager.startRendering();
            expect(stateManager.getIsRendering()).toBe(true);
            
            stateManager.endRendering();
            expect(stateManager.getIsRendering()).toBe(false);
        });
        
        it('should handle multiple start without end', () => {
            const id1 = stateManager.startRendering();
            const id2 = stateManager.startRendering();
            const id3 = stateManager.startRendering();
            
            expect(id1).toBe(1);
            expect(id2).toBe(2);
            expect(id3).toBe(3);
            expect(stateManager.getCurrentRenderingId()).toBe(3);
            expect(stateManager.getIsRendering()).toBe(true);
        });
    });
    
    describe('렌더링 시작 가능 여부', () => {
        it('should allow rendering when ID matches and not rendering', () => {
            const id = stateManager.startRendering();
            stateManager.endRendering();
            
            expect(stateManager.canStartRendering(id)).toBe(true);
        });
        
        it('should not allow rendering when already rendering', () => {
            const id = stateManager.startRendering();
            
            expect(stateManager.canStartRendering(id)).toBe(false);
        });
        
        it('should not allow rendering with old ID', () => {
            const id1 = stateManager.startRendering();
            stateManager.endRendering();
            
            const id2 = stateManager.startRendering();
            stateManager.endRendering();
            
            expect(stateManager.canStartRendering(id1)).toBe(false);
            expect(stateManager.canStartRendering(id2)).toBe(true);
        });
        
        it('should not allow rendering with future ID', () => {
            const id = stateManager.startRendering();
            stateManager.endRendering();
            
            expect(stateManager.canStartRendering(id + 1)).toBe(false);
        });
    });
    
    describe('파일 변경 감지', () => {
        it('should detect file change when previous file is null', () => {
            const file = createMockFile('path/to/file.md');
            
            expect(stateManager.hasFileChanged(file)).toBe(true);
        });
        
        it('should detect file change when current file is null', () => {
            const file = createMockFile('path/to/file.md');
            stateManager.setPreviousFile(file);
            
            expect(stateManager.hasFileChanged(null)).toBe(true);
        });
        
        it('should detect file change for different files', () => {
            const file1 = createMockFile('path/to/file1.md');
            const file2 = createMockFile('path/to/file2.md');
            
            stateManager.setPreviousFile(file1);
            
            expect(stateManager.hasFileChanged(file2)).toBe(true);
        });
        
        it('should detect no change for same file', () => {
            const file = createMockFile('path/to/file.md');
            
            stateManager.setPreviousFile(file);
            
            expect(stateManager.hasFileChanged(file)).toBe(false);
        });
        
        it('should detect no change for files with same path', () => {
            const file1 = createMockFile('path/to/file.md');
            const file2 = createMockFile('path/to/file.md');
            
            stateManager.setPreviousFile(file1);
            
            expect(stateManager.hasFileChanged(file2)).toBe(false);
        });
        
        it('should update previous file', () => {
            const file1 = createMockFile('path/to/file1.md');
            const file2 = createMockFile('path/to/file2.md');
            
            stateManager.setPreviousFile(file1);
            expect(stateManager.getPreviousFile()).toBe(file1);
            
            stateManager.setPreviousFile(file2);
            expect(stateManager.getPreviousFile()).toBe(file2);
        });
        
        it('should allow setting previous file to null', () => {
            const file = createMockFile('path/to/file.md');
            
            stateManager.setPreviousFile(file);
            stateManager.setPreviousFile(null);
            
            expect(stateManager.getPreviousFile()).toBeNull();
        });
    });
    
    describe('검색 쿼리 관리', () => {
        it('should store and retrieve search query', () => {
            stateManager.setSearchQuery('test query');
            
            expect(stateManager.getSearchQuery()).toBe('test query');
            expect(stateManager.hasSearchQuery()).toBe(true);
        });
        
        it('should detect empty query', () => {
            stateManager.setSearchQuery('');
            
            expect(stateManager.getSearchQuery()).toBe('');
            expect(stateManager.hasSearchQuery()).toBe(false);
        });
        
        it('should update search query', () => {
            stateManager.setSearchQuery('first query');
            expect(stateManager.getSearchQuery()).toBe('first query');
            
            stateManager.setSearchQuery('second query');
            expect(stateManager.getSearchQuery()).toBe('second query');
        });
        
        it('should handle special characters in query', () => {
            const specialQuery = 'test "quotes" and/or #tags @mentions';
            stateManager.setSearchQuery(specialQuery);
            
            expect(stateManager.getSearchQuery()).toBe(specialQuery);
        });
        
        it('should handle multi-line queries', () => {
            const multiLineQuery = 'line1\nline2\nline3';
            stateManager.setSearchQuery(multiLineQuery);
            
            expect(stateManager.getSearchQuery()).toBe(multiLineQuery);
            expect(stateManager.hasSearchQuery()).toBe(true);
        });
    });
    
    describe('reset 메서드', () => {
        it('should reset all state', () => {
            const file = createMockFile('path/to/file.md');
            
            // 모든 상태 설정
            stateManager.startRendering();
            stateManager.setPreviousFile(file);
            stateManager.setSearchQuery('test query');
            
            // 리셋
            stateManager.reset();
            
            // 모든 상태가 초기화됨
            expect(stateManager.getIsRendering()).toBe(false);
            expect(stateManager.getCurrentRenderingId()).toBe(0);
            expect(stateManager.getPreviousFile()).toBeNull();
            expect(stateManager.getSearchQuery()).toBe('');
            expect(stateManager.hasSearchQuery()).toBe(false);
        });
        
        it('should allow operations after reset', () => {
            stateManager.startRendering();
            stateManager.reset();
            
            const id = stateManager.startRendering();
            expect(id).toBe(1);
        });
    });
    
    describe('복잡한 시나리오', () => {
        it('should handle rapid file changes', () => {
            const files = [
                createMockFile('file1.md'),
                createMockFile('file2.md'),
                createMockFile('file3.md')
            ];
            
            stateManager.setPreviousFile(files[0]);
            expect(stateManager.hasFileChanged(files[1])).toBe(true);
            
            stateManager.setPreviousFile(files[1]);
            expect(stateManager.hasFileChanged(files[2])).toBe(true);
            
            stateManager.setPreviousFile(files[2]);
            expect(stateManager.hasFileChanged(files[2])).toBe(false);
        });
        
        it('should handle concurrent rendering attempts', () => {
            // 첫 번째 렌더링 시작
            const id1 = stateManager.startRendering();
            
            // 두 번째 렌더링 시도 (이전 렌더링 중)
            const id2 = stateManager.startRendering();
            
            // id1은 더 이상 유효하지 않음
            expect(stateManager.canStartRendering(id1)).toBe(false);
            expect(stateManager.getCurrentRenderingId()).toBe(id2);
        });
        
        it('should handle search query with file changes', () => {
            const file1 = createMockFile('file1.md');
            const file2 = createMockFile('file2.md');
            
            stateManager.setSearchQuery('query1');
            stateManager.setPreviousFile(file1);
            
            expect(stateManager.hasSearchQuery()).toBe(true);
            expect(stateManager.hasFileChanged(file2)).toBe(true);
            
            stateManager.setSearchQuery('query2');
            stateManager.setPreviousFile(file2);
            
            expect(stateManager.getSearchQuery()).toBe('query2');
            expect(stateManager.hasFileChanged(file2)).toBe(false);
        });
        
        it('should maintain state consistency across operations', () => {
            const file = createMockFile('test.md');
            
            // 복잡한 작업 시퀀스
            const id1 = stateManager.startRendering();
            stateManager.setPreviousFile(file);
            stateManager.setSearchQuery('query');
            stateManager.endRendering();
            
            const id2 = stateManager.startRendering();
            
            // 이전 상태는 유지됨
            expect(stateManager.getPreviousFile()).toBe(file);
            expect(stateManager.getSearchQuery()).toBe('query');
            
            // 렌더링 ID는 증가함
            expect(id2).toBe(id1 + 1);
            expect(stateManager.getCurrentRenderingId()).toBe(id2);
        });
    });
    
    describe('엣지 케이스', () => {
        it('should handle very long file paths', () => {
            const longPath = 'a/'.repeat(100) + 'file.md';
            const file = createMockFile(longPath);
            
            stateManager.setPreviousFile(file);
            
            expect(stateManager.hasFileChanged(file)).toBe(false);
        });
        
        it('should handle very long search queries', () => {
            const longQuery = 'a'.repeat(10000);
            
            stateManager.setSearchQuery(longQuery);
            
            expect(stateManager.getSearchQuery()).toBe(longQuery);
            expect(stateManager.hasSearchQuery()).toBe(true);
        });
        
        it('should handle many rendering ID increments', () => {
            for (let i = 0; i < 1000; i++) {
                stateManager.startRendering();
            }
            
            expect(stateManager.getCurrentRenderingId()).toBe(1000);
        });
        
        it('should handle end rendering without start', () => {
            stateManager.endRendering();
            
            expect(stateManager.getIsRendering()).toBe(false);
            expect(stateManager.getCurrentRenderingId()).toBe(0);
        });
    });
});

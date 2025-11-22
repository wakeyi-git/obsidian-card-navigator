/**
 * FilterManager 테스트
 * 
 * 파일 필터링 로직의 모든 케이스를 테스트합니다.
 */

import { TFile, App, CachedMetadata } from 'obsidian';
import { FilterManager } from '../../src/filter/FilterManager';
import { FilterOptions } from '../../src/types';

// Mock App
const mockApp = {
    metadataCache: {
        getFileCache: jest.fn()
    }
} as unknown as App;

// 헬퍼 함수: Mock TFile 생성
function createMockFile(
    basename: string,
    ctime: number,
    mtime: number,
    path: string = `${basename}.md`
): TFile {
    const file = new TFile();
    file.basename = basename;
    file.name = `${basename}.md`;
    file.path = path;
    file.stat = {
        ctime,
        mtime,
        size: 1000
    } as any;
    return file;
}

describe('FilterManager', () => {
    let filterManager: FilterManager;
    let files: TFile[];
    
    beforeEach(() => {
        filterManager = new FilterManager(mockApp);
        jest.clearAllMocks();
        
        // 테스트용 파일 목록 생성
        files = [
            createMockFile('File1', Date.parse('2024-01-01'), Date.parse('2024-01-15')),
            createMockFile('File2', Date.parse('2024-02-01'), Date.parse('2024-02-15')),
            createMockFile('File3', Date.parse('2024-03-01'), Date.parse('2024-03-15'))
        ];
    });
    
    describe('filterByTags', () => {
        beforeEach(() => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'File1') {
                    return {
                        frontmatter: { tags: ['important', 'work'] },
                        tags: [{ tag: '#project', position: {} as any }]
                    } as CachedMetadata;
                } else if (file.basename === 'File2') {
                    return {
                        frontmatter: { tags: 'personal' },
                        tags: [{ tag: '#hobby', position: {} as any }]
                    } as CachedMetadata;
                } else if (file.basename === 'File3') {
                    return {
                        frontmatter: { tags: ['work', 'urgent'] },
                        tags: []
                    } as CachedMetadata;
                }
                return null;
            });
        });
        
        it('should filter files by single tag', () => {
            const filtered = filterManager.filterByTags(files, ['work']);
            
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File1', 'File3']);
        });
        
        it('should filter files by multiple tags (OR operation)', () => {
            const filtered = filterManager.filterByTags(files, ['personal', 'urgent']);
            
            // personal (File2) OR urgent (File3)
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename).sort()).toEqual(['File2', 'File3']);
        });
        
        it('should handle inline tags', () => {
            const filtered = filterManager.filterByTags(files, ['project']);
            
            expect(filtered.length).toBe(1);
            expect(filtered[0].basename).toBe('File1');
        });
        
        it('should be case insensitive', () => {
            const filtered = filterManager.filterByTags(files, ['WORK']);
            
            expect(filtered.length).toBe(2);
        });
        
        it('should return empty array when no files match', () => {
            const filtered = filterManager.filterByTags(files, ['nonexistent']);
            
            expect(filtered).toEqual([]);
        });
        
        it('should return empty array when no tags provided', () => {
            const filtered = filterManager.filterByTags(files, []);
            
            expect(filtered).toEqual([]);
        });
        
        it('should handle files without tags', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const filtered = filterManager.filterByTags(files, ['work']);
            
            expect(filtered).toEqual([]);
        });
    });
    
    describe('filterByCreatedDate', () => {
        it('should filter files created after specific date', () => {
            const after = new Date('2024-01-15');
            const filtered = filterManager.filterByCreatedDate(files, after);
            
            // File2와 File3는 2024-02-01, 2024-03-01에 생성됨
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File2', 'File3']);
        });
        
        it('should filter files created before specific date', () => {
            const before = new Date('2024-02-15');
            const filtered = filterManager.filterByCreatedDate(files, undefined, before);
            
            // File1과 File2는 2024-01-01, 2024-02-01에 생성됨
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File1', 'File2']);
        });
        
        it('should filter files created within date range', () => {
            const after = new Date('2024-01-15');
            const before = new Date('2024-02-15');
            const filtered = filterManager.filterByCreatedDate(files, after, before);
            
            // File2만 범위 내 (2024-02-01)
            expect(filtered.length).toBe(1);
            expect(filtered[0].basename).toBe('File2');
        });
        
        it('should return all files when no dates provided', () => {
            const filtered = filterManager.filterByCreatedDate(files);
            
            expect(filtered).toEqual(files);
        });
        
        it('should handle exact boundary dates', () => {
            const after = new Date('2024-01-01');
            const filtered = filterManager.filterByCreatedDate(files, after);
            
            // 경계값 포함 (>=)
            expect(filtered.length).toBe(3);
        });
    });
    
    describe('filterByModifiedDate', () => {
        it('should filter files modified after specific date', () => {
            const after = new Date('2024-02-01');
            const filtered = filterManager.filterByModifiedDate(files, after);
            
            // File2와 File3는 2024-02-15, 2024-03-15에 수정됨
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File2', 'File3']);
        });
        
        it('should filter files modified before specific date', () => {
            const before = new Date('2024-02-20');
            const filtered = filterManager.filterByModifiedDate(files, undefined, before);
            
            // File1과 File2는 2024-01-15, 2024-02-15에 수정됨
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File1', 'File2']);
        });
        
        it('should filter files modified within date range', () => {
            const after = new Date('2024-02-01');
            const before = new Date('2024-03-01');
            const filtered = filterManager.filterByModifiedDate(files, after, before);
            
            // File2만 범위 내 (2024-02-15)
            expect(filtered.length).toBe(1);
            expect(filtered[0].basename).toBe('File2');
        });
    });
    
    describe('filterByProperties', () => {
        beforeEach(() => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'File1') {
                    return {
                        frontmatter: {
                            status: 'done',
                            priority: 'high',
                            count: 5
                        }
                    } as CachedMetadata;
                } else if (file.basename === 'File2') {
                    return {
                        frontmatter: {
                            status: 'inProgress',
                            priority: 'low',
                            count: 3
                        }
                    } as CachedMetadata;
                } else if (file.basename === 'File3') {
                    return {
                        frontmatter: {
                            status: 'done',
                            priority: 'medium',
                            count: 5
                        }
                    } as CachedMetadata;
                }
                return null;
            });
        });
        
        it('should filter files by single property', () => {
            const filtered = filterManager.filterByProperties(files, {
                status: 'done'
            });
            
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File1', 'File3']);
        });
        
        it('should filter files by multiple properties (AND operation)', () => {
            const filtered = filterManager.filterByProperties(files, {
                status: 'done',
                count: 5
            });
            
            // status='done' AND count=5
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File1', 'File3']);
        });
        
        it('should be case insensitive for string values', () => {
            const filtered = filterManager.filterByProperties(files, {
                status: 'DONE'
            });
            
            expect(filtered.length).toBe(2);
        });
        
        it('should handle numeric values', () => {
            const filtered = filterManager.filterByProperties(files, {
                count: 5
            });
            
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File1', 'File3']);
        });
        
        it('should return empty array when no files match all properties', () => {
            const filtered = filterManager.filterByProperties(files, {
                status: 'done',
                priority: 'low'
            });
            
            expect(filtered).toEqual([]);
        });
        
        it('should handle files without frontmatter', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const filtered = filterManager.filterByProperties(files, {
                status: 'done'
            });
            
            expect(filtered).toEqual([]);
        });
        
        it('should handle missing properties', () => {
            const filtered = filterManager.filterByProperties(files, {
                nonexistent: 'value'
            });
            
            expect(filtered).toEqual([]);
        });
    });
    
    describe('filterByPath', () => {
        beforeEach(() => {
            files = [
                createMockFile('File1', 1000, 1500, 'folder1/subfolder/File1.md'),
                createMockFile('File2', 2000, 2500, 'folder2/File2.md'),
                createMockFile('File3', 3000, 3500, 'folder1/File3.md')
            ];
        });
        
        it('should filter files by path', () => {
            const filtered = filterManager.filterByPath(files, 'folder1');
            
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File1', 'File3']);
        });
        
        it('should filter files by subfolder', () => {
            const filtered = filterManager.filterByPath(files, 'subfolder');
            
            expect(filtered.length).toBe(1);
            expect(filtered[0].basename).toBe('File1');
        });
        
        it('should return empty array when no files match', () => {
            const filtered = filterManager.filterByPath(files, 'nonexistent');
            
            expect(filtered).toEqual([]);
        });
    });
    
    describe('applyFilters', () => {
        beforeEach(() => {
            // 복합 필터링 테스트를 위한 Mock 설정
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'File1') {
                    return {
                        frontmatter: {
                            tags: ['work', 'important'],
                            status: 'done'
                        },
                        tags: []
                    } as CachedMetadata;
                } else if (file.basename === 'File2') {
                    return {
                        frontmatter: {
                            tags: ['personal'],
                            status: 'inProgress'
                        },
                        tags: []
                    } as CachedMetadata;
                } else if (file.basename === 'File3') {
                    return {
                        frontmatter: {
                            tags: ['work'],
                            status: 'done'
                        },
                        tags: []
                    } as CachedMetadata;
                }
                return null;
            });
        });
        
        it('should apply no filters when options are empty', () => {
            const options: FilterOptions = {
                tags: [],
                properties: {}
            };
            const filtered = filterManager.applyFilters(files, options);
            
            expect(filtered).toEqual(files);
        });
        
        it('should apply single filter', () => {
            const options: FilterOptions = {
                tags: ['work'],
                properties: {}
            };
            const filtered = filterManager.applyFilters(files, options);
            
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File1', 'File3']);
        });
        
        it('should apply multiple filters (AND operation)', () => {
            const options: FilterOptions = {
                tags: ['work'],
                properties: { status: 'done' }
            };
            const filtered = filterManager.applyFilters(files, options);
            
            // 'work' 태그 AND status='done'
            expect(filtered.length).toBe(2);
            expect(filtered.map(f => f.basename)).toEqual(['File1', 'File3']);
        });
        
        it('should apply all filter types together', () => {
            files = [
                createMockFile('File1', Date.parse('2024-01-01'), Date.parse('2024-01-15'), 'folder1/File1.md'),
                createMockFile('File2', Date.parse('2024-02-01'), Date.parse('2024-02-15'), 'folder2/File2.md'),
                createMockFile('File3', Date.parse('2024-03-01'), Date.parse('2024-03-15'), 'folder1/File3.md')
            ];
            
            const options: FilterOptions = {
                tags: ['work'],
                properties: { status: 'done' },
                createdAfter: new Date('2024-01-15'),
                path: 'folder1'
            };
            
            const filtered = filterManager.applyFilters(files, options);
            
            // File3만 모든 조건을 만족:
            // - 'work' 태그 ✓
            // - status='done' ✓
            // - 2024-01-15 이후 생성 ✓
            // - folder1 경로 ✓
            expect(filtered.length).toBe(1);
            expect(filtered[0].basename).toBe('File3');
        });
        
        it('should filter out files that do not match all conditions', () => {
            const options: FilterOptions = {
                tags: ['work'],
                properties: { status: 'inProgress' }
            };
            const filtered = filterManager.applyFilters(files, options);
            
            // 'work' 태그를 가지고 status가 'inProgress'인 파일은 없음
            expect(filtered).toEqual([]);
        });
    });
    
    describe('createEmptyFilter', () => {
        it('should create empty filter options', () => {
            const emptyFilter = FilterManager.createEmptyFilter();
            
            expect(emptyFilter).toEqual({
                tags: [],
                properties: {}
            });
        });
    });
    
    describe('edge cases', () => {
        it('should handle empty file array', () => {
            const options: FilterOptions = {
                tags: ['work'],
                properties: {}
            };
            const filtered = filterManager.applyFilters([], options);
            
            expect(filtered).toEqual([]);
        });
        
        it('should not modify original array', () => {
            const original = [...files];
            const options: FilterOptions = {
                tags: ['work'],
                properties: {}
            };
            
            filterManager.applyFilters(files, options);
            
            expect(files).toEqual(original);
        });
        
        it('should handle files with null cache', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const options: FilterOptions = {
                tags: ['work'],
                properties: {}
            };
            const filtered = filterManager.applyFilters(files, options);
            
            expect(filtered).toEqual([]);
        });
        
        it('should handle undefined filter values gracefully', () => {
            const options: FilterOptions = {
                tags: undefined as any,
                properties: undefined as any
            };
            const filtered = filterManager.applyFilters(files, options);
            
            // undefined 값은 무시되어야 함
            expect(filtered).toEqual(files);
        });
    });
});

/**
 * TagMode 테스트
 * 
 * 테스트 범위:
 * - 태그 기반 파일 가져오기
 * - 중첩 태그 포함/제외
 * - 태그 매칭 로직
 * - 엣지 케이스 처리
 */

import { TagMode } from '../../src/modes/TagMode';
import { App, TFile, CachedMetadata } from 'obsidian';

// Mock 설정
jest.mock('obsidian');

describe('TagMode', () => {
    let tagMode: TagMode;
    let mockApp: jest.Mocked<App>;
    let mockView: any;
    let mockSettings: any;
    let mockFiles: TFile[];
    let mockMetadataCache: Map<string, CachedMetadata>;
    
    beforeEach(() => {
        // Mock metadata cache 생성
        mockMetadataCache = new Map();
        
        // Mock 파일 생성
        mockFiles = [
            createMockFile('file1.md'),
            createMockFile('file2.md'),
            createMockFile('file3.md'),
            createMockFile('file4.md'),
            createMockFile('file5.md'),
            createMockFile('file6.md')
        ];
        
        // 파일별 태그 메타데이터 설정
        mockMetadataCache.set('file1.md', createMetadataWithTags(['project', 'important']));
        mockMetadataCache.set('file2.md', createMetadataWithTags(['project', 'archive']));
        mockMetadataCache.set('file3.md', createMetadataWithTags(['project/alpha', 'important']));
        mockMetadataCache.set('file4.md', createMetadataWithTags(['project/beta']));
        mockMetadataCache.set('file5.md', createMetadataWithTags(['personal']));
        mockMetadataCache.set('file6.md', createMetadataWithTags([])); // 태그 없음
        
        // Mock App 생성
        mockApp = {
            vault: {
                getMarkdownFiles: jest.fn(() => mockFiles)
            },
            metadataCache: {
                getFileCache: jest.fn((file: TFile) => {
                    return mockMetadataCache.get(file.path) || null;
                })
            },
            workspace: {
                getActiveFile: jest.fn(() => null)
            }
        } as any;
        
        // Mock Settings
        mockSettings = {
            tagMode: {
                specifiedTags: ['#project'],
                useActiveFileTags: false,
                tagOperator: 'OR'
            },
            debug: {
                enabled: false
            }
        };
        
        // Mock CardNavigatorView
        mockView = {
            plugin: {
                settingsManager: {
                    getSettings: jest.fn(() => mockSettings)
                }
            }
        };
        
        tagMode = new TagMode(mockApp, mockView);
    });
    
    describe('getFiles - 기본 기능', () => {
        it('should get files with specified tag', () => {
            mockSettings.tagMode.specifiedTags = ['#project'];
            
            const result = tagMode.getFiles();
            
            // #project 태그를 가진 파일들 (중첩 태그 제외)
            expect(result).toHaveLength(2);
            expect(result.some(f => f.path === 'file1.md')).toBe(true);
            expect(result.some(f => f.path === 'file2.md')).toBe(true);
        });
        
        it('should return empty array for non-existent tag', () => {
            mockSettings.tagMode.specifiedTags = ['#nonexistent'];
            
            const result = tagMode.getFiles();
            
            expect(result).toHaveLength(0);
        });
        
        it('should handle multiple specified tags with AND operator', () => {
            mockSettings.tagMode.specifiedTags = ['#project', '#important'];
            mockSettings.tagMode.tagOperator = 'AND';
            
            const result = tagMode.getFiles();
            
            // 두 태그를 모두 가진 파일 (file1만)
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('file1.md');
        });
        
        it('should handle multiple specified tags with OR operator', () => {
            mockSettings.tagMode.specifiedTags = ['#project', '#personal'];
            mockSettings.tagMode.tagOperator = 'OR';
            
            const result = tagMode.getFiles();
            
            // 둘 중 하나라도 가진 파일
            expect(result.length).toBeGreaterThanOrEqual(3);
        });
    });
    
    describe('getFiles - 중첩 태그 처리', () => {
        it('should only match exact tag', () => {
            mockSettings.tagMode.specifiedTags = ['#project'];
            
            const result = tagMode.getFiles();
            
            // #project만 매칭, #project/alpha는 제외
            expect(result).toHaveLength(2);
            expect(result.every(f => !f.path.includes('file3.md'))).toBe(true);
            expect(result.every(f => !f.path.includes('file4.md'))).toBe(true);
        });
        
        it('should match nested tag specifically', () => {
            mockSettings.tagMode.specifiedTags = ['#project/alpha'];
            
            const result = tagMode.getFiles();
            
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('file3.md');
        });
        
        it('should match multiple nested tags', () => {
            mockSettings.tagMode.specifiedTags = ['#project/alpha', '#project/beta'];
            mockSettings.tagMode.tagOperator = 'OR';
            
            const result = tagMode.getFiles();
            
            expect(result).toHaveLength(2);
            expect(result.some(f => f.path === 'file3.md')).toBe(true);
            expect(result.some(f => f.path === 'file4.md')).toBe(true);
        });
    });
    
    describe('useActiveFileTags 모드', () => {
        it('should use active file tags when enabled', () => {
            const activeFile = createMockFile('active.md');
            mockMetadataCache.set('active.md', createMetadataWithTags(['important']));
            mockApp.workspace.getActiveFile = jest.fn(() => activeFile);
            
            mockSettings.tagMode.useActiveFileTags = true;
            
            const result = tagMode.getFiles();
            
            // #important 태그를 가진 파일들
            expect(result.length).toBeGreaterThan(0);
            expect(result.some(f => f.path === 'file1.md')).toBe(true);
            expect(result.some(f => f.path === 'file3.md')).toBe(true);
        });
        
        it('should return empty array when no active file', () => {
            mockApp.workspace.getActiveFile = jest.fn(() => null);
            mockSettings.tagMode.useActiveFileTags = true;
            
            const result = tagMode.getFiles();
            
            expect(result).toHaveLength(0);
        });
        
        it('should return empty array when active file has no tags', () => {
            const activeFile = createMockFile('active.md');
            mockMetadataCache.set('active.md', createMetadataWithTags([]));
            mockApp.workspace.getActiveFile = jest.fn(() => activeFile);
            
            mockSettings.tagMode.useActiveFileTags = true;
            
            const result = tagMode.getFiles();
            
            expect(result).toHaveLength(0);
        });
    });
    
    describe('엣지 케이스', () => {
        it('should handle files without tags', () => {
            mockSettings.tagMode.specifiedTags = ['#any'];
            
            const result = tagMode.getFiles();
            
            // file6.md는 태그가 없으므로 제외
            expect(result.every(f => f.path !== 'file6.md')).toBe(true);
        });
        
        it('should handle empty specified tags', () => {
            mockSettings.tagMode.specifiedTags = [];
            
            const result = tagMode.getFiles();
            
            expect(result).toHaveLength(0);
        });
        
        it('should handle files without metadata cache', () => {
            mockMetadataCache.clear();
            
            mockSettings.tagMode.specifiedTags = ['#project'];
            
            const result = tagMode.getFiles();
            
            expect(result).toHaveLength(0);
        });
        
        it('should handle files without tags in metadata', () => {
            mockMetadataCache.set('file1.md', {} as CachedMetadata);
            
            mockSettings.tagMode.specifiedTags = ['#project'];
            
            const result = tagMode.getFiles();
            
            // file1.md는 tags 필드가 없으므로 제외
            expect(result.length).toBeLessThan(mockFiles.length);
        });
        
        it('should handle tag normalization', () => {
            // # 없이 지정
            mockSettings.tagMode.specifiedTags = ['project'];
            
            const result = tagMode.getFiles();
            
            // # 있든 없든 매칭되어야 함
            expect(result).toHaveLength(2);
        });
    });
    
    describe('getAllTags', () => {
        it('should return all unique tags from all files', () => {
            const allTags = tagMode.getAllTags();
            
            expect(allTags).toContain('project');
            expect(allTags).toContain('important');
            expect(allTags).toContain('personal');
            expect(allTags).toContain('project/alpha');
            expect(allTags).toContain('project/beta');
            expect(allTags).toContain('archive');
        });
        
        it('should return empty array when no files have tags', () => {
            mockMetadataCache.clear();
            mockFiles.forEach(file => {
                mockMetadataCache.set(file.path, createMetadataWithTags([]));
            });
            
            const allTags = tagMode.getAllTags();
            
            expect(allTags).toHaveLength(0);
        });
        
        it('should deduplicate tags', () => {
            // 모든 파일에 같은 태그 설정
            mockMetadataCache.clear();
            mockFiles.forEach(file => {
                mockMetadataCache.set(file.path, createMetadataWithTags(['common']));
            });
            
            const allTags = tagMode.getAllTags();
            
            expect(allTags).toHaveLength(1);
            expect(allTags[0]).toBe('common');
        });
    });
});

// Helper functions
function createMockFile(path: string): TFile {
    const file = new TFile();
    file.path = path;
    file.basename = path.replace('.md', '');
    file.extension = 'md';
    file.name = path;
    
    return file;
}

function createMetadataWithTags(tags: string[]): CachedMetadata {
    return {
        tags: tags.map(tag => ({
            tag: tag.startsWith('#') ? tag : `#${tag}`,
            position: {
                start: { line: 0, col: 0, offset: 0 },
                end: { line: 0, col: 0, offset: 0 }
            }
        }))
    } as CachedMetadata;
}

/**
 * SearchEngine 테스트
 * 
 * 검색 엔진의 주요 기능을 테스트합니다.
 */

import { TFile, App, CachedMetadata } from 'obsidian';
import { SearchEngine } from '../../src/search/SearchEngine';
import { DebugLogger } from '../../src/utils/DebugLogger';

// Mock DebugLogger
const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    group: jest.fn(),
    groupEnd: jest.fn()
} as unknown as DebugLogger;

// Mock App
let vaultEventHandlers: { [key: string]: Function } = {};
const mockApp = {
    vault: {
        on: jest.fn((event: string, handler: Function) => {
            vaultEventHandlers[event] = handler;
        }),
        read: jest.fn()
    },
    metadataCache: {
        getFileCache: jest.fn()
    }
} as unknown as App;

// 헬퍼 함수: Mock TFile 생성
function createMockFile(
    basename: string,
    ctime: number = Date.now(),
    mtime: number = Date.now(),
    path: string = `${basename}.md`
): TFile {
    const file = new TFile();
    file.basename = basename;
    file.name = `${basename}.md`;
    file.path = path;
    
    // parent 모킹: 경로에서 폴더 경로 추출
    const pathParts = path.split('/');
    if (pathParts.length > 1) {
        const parentPath = pathParts.slice(0, -1).join('/');
        file.parent = {
            path: parentPath,
            name: pathParts[pathParts.length - 2]
        } as any;
    } else {
        file.parent = null;
    }
    
    file.stat = {
        ctime,
        mtime,
        size: 1000
    } as any;
    return file;
}

describe('SearchEngine', () => {
    let searchEngine: SearchEngine;
    let files: TFile[];
    
    beforeEach(() => {
        vaultEventHandlers = {};
        searchEngine = new SearchEngine(mockApp, mockLogger, () => ({ enableFuzzySearch: false, fuzzySearchThreshold: 0.3 } as any));
        jest.clearAllMocks();
        
        // 테스트용 파일 목록 생성
        files = [
            createMockFile('Hello World', Date.parse('2024-01-01'), Date.parse('2024-01-15'), 'folder1/Hello World.md'),
            createMockFile('Test File', Date.parse('2024-02-01'), Date.parse('2024-02-15'), 'folder2/Test File.md'),
            createMockFile('Important Note', Date.parse('2024-03-01'), Date.parse('2024-03-15'), 'folder1/Important Note.md')
        ];
    });
    
    describe('basic search - searchSync', () => {
        it('should return all files for empty query', () => {
            const results = searchEngine.searchSync('', files);
            expect(results).toEqual(files);
        });
        
        it('should search by filename (case insensitive)', () => {
            const results = searchEngine.searchSync('hello', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
        
        it('should search by filename (case sensitive)', () => {
            const results = searchEngine.searchSync('hello', files, true);
            
            // 대소문자가 맞지 않으므로 결과 없음
            expect(results).toEqual([]);
        });
        
        it('should search by path', () => {
            const results = searchEngine.searchSync('folder1', files);
            
            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['Hello World', 'Important Note']);
        });
        
        it('should search in headings', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Test File') {
                    return {
                        headings: [
                            { level: 1, heading: 'Introduction', position: {} as any },
                            { level: 2, heading: 'Getting Started', position: {} as any }
                        ]
                    } as CachedMetadata;
                }
                return null;
            });
            
            const results = searchEngine.searchSync('introduction', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
        
        it('should search in tags', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Important Note') {
                    return {
                        tags: [
                            { tag: '#project', position: {} as any },
                            { tag: '#important', position: {} as any }
                        ]
                    } as CachedMetadata;
                }
                return null;
            });
            
            const results = searchEngine.searchSync('project', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Important Note');
        });
        
        it('should search in links', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Test File') {
                    return {
                        links: [
                            { link: 'Related Note', displayText: 'See Related', position: {} as any }
                        ]
                    } as CachedMetadata;
                }
                return null;
            });
            
            const results = searchEngine.searchSync('related', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
    });
    
    describe('basic search - async search', () => {
        beforeEach(() => {
            (mockApp.vault.read as jest.Mock).mockImplementation(async (file: TFile) => {
                if (file.basename === 'Hello World') {
                    return 'This is a test content with hello world.';
                } else if (file.basename === 'Test File') {
                    return 'This file contains test data.';
                } else {
                    return 'Important note content.';
                }
            });
        });
        
        it('should search in file content', async () => {
            const results = await searchEngine.search('test content', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
        
        it('should cache search results', async () => {
            // 첫 번째 검색
            await searchEngine.search('test', files);
            expect(mockApp.vault.read).toHaveBeenCalled();
            
            // 두 번째 검색 (캐시 사용)
            jest.clearAllMocks();
            await searchEngine.search('test', files);
            expect(mockApp.vault.read).not.toHaveBeenCalled();
        });
        
        it('should clear cache on file creation', async () => {
            // 'content'로 검색 (파일명에 없는 단어로 본문을 읽어야 함)
            await searchEngine.search('content', files);
            
            // 캐시 클리어 트리거
            const createCallback = vaultEventHandlers['create'];
            expect(createCallback).toBeDefined();
            createCallback();
            
            // 캐시가 지워졌으므로 다시 파일 읽기
            jest.clearAllMocks();
            await searchEngine.search('content', files);
            expect(mockApp.vault.read).toHaveBeenCalled();
        });
    });
    
    describe('regex search', () => {
        beforeEach(() => {
            (mockApp.vault.read as jest.Mock).mockImplementation(async (file: TFile) => {
                if (file.basename === 'Hello World') {
                    return 'TODO: Implement feature\nDONE: Fixed bug';
                } else if (file.basename === 'Test File') {
                    return 'Date: 2024-01-01\nModified: 2024-02-15';
                } else {
                    return 'Links: [[Note 1]] and [[Note 2]]';
                }
            });
        });
        
        it('should identify regex query', () => {
            expect(searchEngine.isRegexQuery('/test/')).toBe(true);
            expect(searchEngine.isRegexQuery('/test/gi')).toBe(true);
            expect(searchEngine.isRegexQuery('test')).toBe(false);
        });
        
        it('should search with simple regex', async () => {
            const results = await searchEngine.search('/TODO/', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
        
        it('should search with regex flags', async () => {
            const results = await searchEngine.search('/todo/i', files);
            
            // 대소문자 무시 (i 플래그)
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
        
        it('should search for date patterns', async () => {
            const results = await searchEngine.search('/\\d{4}-\\d{2}-\\d{2}/', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
        
        it('should search for internal links', async () => {
            const results = await searchEngine.search('/\\[\\[.*?\\]\\]/', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Important Note');
        });
        
        it('should handle invalid regex gracefully', async () => {
            const results = await searchEngine.search('/[invalid/', files);
            
            expect(results).toEqual([]);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
    
    describe('advanced search - path:', () => {
        it('should filter by path', () => {
            const results = searchEngine.searchSync('path:folder1', files);
            
            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['Hello World', 'Important Note']);
        });
        
        it('should be case insensitive by default', () => {
            const results = searchEngine.searchSync('path:FOLDER1', files);
            
            expect(results.length).toBe(2);
        });
        
        it('should be case sensitive when specified', () => {
            const results = searchEngine.searchSync('path:FOLDER1', files, true);
            
            expect(results).toEqual([]);
        });
    });
    
    describe('advanced search - file:', () => {
        it('should filter by filename', () => {
            const results = searchEngine.searchSync('file:test', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
        
        it('should handle partial matches', () => {
            const results = searchEngine.searchSync('file:world', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
    });
    
    describe('advanced search - tag:', () => {
        beforeEach(() => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Hello World') {
                    return {
                        frontmatter: { tags: ['work', 'important'] },
                        tags: [{ tag: '#project', position: {} as any }]
                    } as CachedMetadata;
                } else if (file.basename === 'Test File') {
                    return {
                        frontmatter: { tags: 'personal' },
                        tags: []
                    } as CachedMetadata;
                } else {
                    return null;
                }
            });
        });
        
        it('should filter by frontmatter tag', () => {
            const results = searchEngine.searchSync('tag:work', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
        
        it('should filter by inline tag', () => {
            const results = searchEngine.searchSync('tag:#project', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
        
        it('should handle single string tag', () => {
            const results = searchEngine.searchSync('tag:personal', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
    });
    
    describe('advanced search - section:', () => {
        beforeEach(() => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Test File') {
                    return {
                        headings: [
                            { level: 1, heading: 'Introduction', position: {} as any },
                            { level: 2, heading: 'Getting Started', position: {} as any }
                        ]
                    } as CachedMetadata;
                }
                return null;
            });
        });
        
        it('should filter by section heading', () => {
            const results = searchEngine.searchSync('section:Introduction', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
        
        it('should handle partial heading matches', () => {
            const results = searchEngine.searchSync('section:Getting', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
    });
    
    describe('advanced search - property:', () => {
        beforeEach(() => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Hello World') {
                    return {
                        frontmatter: {
                            status: 'done',
                            priority: ['high', 'urgent']
                        }
                    } as CachedMetadata;
                } else if (file.basename === 'Test File') {
                    return {
                        frontmatter: {
                            status: 'inProgress'
                        }
                    } as CachedMetadata;
                }
                return null;
            });
        });
        
        it('should filter by property value', () => {
            const results = searchEngine.searchSync('[status]:done', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
        
        it('should handle array property values', () => {
            const results = searchEngine.searchSync('[priority]:high', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
        
        it('should handle partial property value matches', () => {
            const results = searchEngine.searchSync('[status]:Progress', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
    });
    
    describe('advanced search - created: and modified:', () => {
        it('should filter by exact creation date', () => {
            const results = searchEngine.searchSync('created:2024-01-01', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Hello World');
        });
        
        it('should filter by creation date range', () => {
            const results = searchEngine.searchSync('created:2024-01-01..2024-02-01', files);
            
            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['Hello World', 'Test File']);
        });
        
        it('should filter by exact modification date', () => {
            const results = searchEngine.searchSync('modified:2024-02-15', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
        
        it('should filter by modification date range', () => {
            const results = searchEngine.searchSync('modified:2024-02-01..2024-03-01', files);
            
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
    });
    
    describe('highlightText', () => {
        it('should highlight search term', () => {
            const text = 'This is a test text with multiple test words';
            const highlighted = searchEngine.highlightText(text, 'test');
            
            expect(highlighted).toBe('This is a <mark>test</mark> text with multiple <mark>test</mark> words');
        });
        
        it('should be case insensitive by default', () => {
            const text = 'Test and TEST';
            const highlighted = searchEngine.highlightText(text, 'test');
            
            expect(highlighted).toBe('<mark>Test</mark> and <mark>TEST</mark>');
        });
        
        it('should be case sensitive when specified', () => {
            const text = 'Test and TEST';
            const highlighted = searchEngine.highlightText(text, 'test', true);
            
            expect(highlighted).toBe('Test and TEST');
        });
        
        it('should handle special regex characters', () => {
            const text = 'Price: $100.00';
            const highlighted = searchEngine.highlightText(text, '$100');
            
            expect(highlighted).toBe('Price: <mark>$100</mark>.00');
        });
        
        it('should return original text for empty query', () => {
            const text = 'Original text';
            const highlighted = searchEngine.highlightText(text, '');
            
            expect(highlighted).toBe('Original text');
        });
    });
    
    describe('getSearchContext', () => {
        beforeEach(() => {
            (mockApp.vault.read as jest.Mock).mockResolvedValue(
                'This is a longer text that contains the search term in the middle of the content. ' +
                'We want to extract some context around this search term for preview purposes.'
            );
        });
        
        it('should extract context around search term', async () => {
            const context = await searchEngine.getSearchContext(files[0], 'search term', 20);
            
            expect(context).toContain('search term');
            expect(context?.length).toBeLessThan(100);
        });
        
        it('should add ellipsis when not at start', async () => {
            const context = await searchEngine.getSearchContext(files[0], 'search term', 20);
            
            expect(context).toMatch(/^\.\.\./);
        });
        
        it('should add ellipsis when not at end', async () => {
            const context = await searchEngine.getSearchContext(files[0], 'search term', 20);
            
            expect(context).toMatch(/\.\.\.$/);
        });
        
        it('should return null if term not found', async () => {
            const context = await searchEngine.getSearchContext(files[0], 'nonexistent', 20);
            
            expect(context).toBeNull();
        });
        
        it('should handle read errors', async () => {
            (mockApp.vault.read as jest.Mock).mockRejectedValue(new Error('Read failed'));
            
            const context = await searchEngine.getSearchContext(files[0], 'test', 20);
            
            expect(context).toBeNull();
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
    
    describe('edge cases', () => {
        it('should handle empty file array', () => {
            const results = searchEngine.searchSync('test', []);
            expect(results).toEqual([]);
        });
        
        it('should handle null cache', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const results = searchEngine.searchSync('test', files);
            // 파일명과 경로로만 검색되어야 함
            expect(results).toBeDefined();
        });
        
        it('should not modify original file array', () => {
            const original = [...files];
            searchEngine.searchSync('test', files);
            
            expect(files).toEqual(original);
        });
    });
});

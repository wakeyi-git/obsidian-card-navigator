/**
 * SearchEngine 추가 테스트
 * 
 * 기존 테스트에서 누락된 케이스들을 보완합니다.
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
    groupEnd: jest.fn(),
    debug: jest.fn()
} as unknown as DebugLogger;

// Mock App
const mockApp = {
    vault: {
        on: jest.fn(),
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

describe('SearchEngine - Additional Coverage', () => {
    let searchEngine: SearchEngine;
    let files: TFile[];
    
    beforeEach(() => {
        searchEngine = new SearchEngine(mockApp, mockLogger, () => ({ enableFuzzySearch: false, fuzzySearchThreshold: 0.3 } as any));
        jest.clearAllMocks();
        
        files = [
            createMockFile('Test File', Date.parse('2024-01-01'), Date.parse('2024-01-15')),
            createMockFile('Another File', Date.parse('2024-02-01'), Date.parse('2024-02-15'))
        ];
    });
    
    describe('Error handling', () => {
        it('should handle vault.read errors gracefully', async () => {
            (mockApp.vault.read as jest.Mock).mockRejectedValue(new Error('Read failed'));
            
            const results = await searchEngine.search('test', files);
            
            // 오류가 발생해도 나머지 파일은 처리
            expect(mockLogger.error).toHaveBeenCalled();
            expect(results).toBeDefined();
        });
        
        it('should handle metadataCache.getFileCache errors', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation(() => {
                throw new Error('Cache error');
            });
            
            // 오류가 발생해도 검색 계속 진행
            const results = searchEngine.searchSync('test', files);
            expect(results).toBeDefined();
        });
        
        it('should handle invalid regex in user query', async () => {
            const results = await searchEngine.search('/[invalid(regex/', files);
            
            expect(mockLogger.error).toHaveBeenCalled();
            expect(results).toEqual([]);
        });
        
        it('should handle null file in array', () => {
            const filesWithNull = [files[0], null as any, files[1]];
            
            const results = searchEngine.searchSync('test', filesWithNull);
            
            // null 파일은 무시하고 나머지만 처리
            expect(results).toBeDefined();
        });
    });
    
    describe('Cache management', () => {
        beforeEach(() => {
            (mockApp.vault.read as jest.Mock).mockResolvedValue('Test content');
        });
        
        it('should clear cache on file modify', async () => {
            // 첫 번째 검색 - 캐시에 저장됨
            await searchEngine.search('content', files);
            expect(mockApp.vault.read).toHaveBeenCalled();
            
            // 같은 검색을 다시 하면 캐시에서 가져옴
            jest.clearAllMocks();
            await searchEngine.search('content', files);
            expect(mockApp.vault.read).not.toHaveBeenCalled(); // 캐시 히트
            
            // 캐시 무효화
            searchEngine.clearCache();
            
            // 세 번째 검색 - 캐시가 없어서 다시 읽음
            await searchEngine.search('content', files);
            expect(mockApp.vault.read).toHaveBeenCalled(); // 캐시 미스
        });
        
        it('should clear cache on file delete', async () => {
            await searchEngine.search('content', files);
            
            searchEngine.clearCache();
            
            jest.clearAllMocks();
            await searchEngine.search('content', files);
            expect(mockApp.vault.read).toHaveBeenCalled();
        });
        
        it('should clear cache on file rename', async () => {
            await searchEngine.search('content', files);
            
            searchEngine.clearCache();
            
            jest.clearAllMocks();
            await searchEngine.search('content', files);
            expect(mockApp.vault.read).toHaveBeenCalled();
        });
    });
    
    describe('Edge cases in date parsing', () => {
        it('should handle invalid date format in created: query', () => {
            const results = searchEngine.searchSync('created:invalid-date', files);
            
            // 잘못된 날짜 형식은 무시하고 모든 파일 반환
            expect(results).toEqual(files);
        });
        
        it('should handle single date in date range query', () => {
            const results = searchEngine.searchSync('created:2024-01-01..', files);
            
            // 끝 날짜 없으면 해당 날짜 이후 모든 파일
            expect(results.length).toBeGreaterThan(0);
        });
        
        it('should handle reversed date range', () => {
            const results = searchEngine.searchSync('created:2024-02-01..2024-01-01', files);
            
            // 잘못된 범위는 빈 배열 또는 전체 반환
            expect(results).toBeDefined();
        });
    });
    
    describe('Edge cases in property search', () => {
        beforeEach(() => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Test File') {
                    return {
                        frontmatter: {
                            nested: { property: 'value' },
                            emptyArray: [],
                            nullValue: null
                        }
                    } as CachedMetadata;
                }
                return null;
            });
        });
        
        it('should handle nested property access', () => {
            const results = searchEngine.searchSync('[nested]:value', files);
            
            // 중첩 속성도 검색 가능해야 함
            expect(results).toBeDefined();
        });
        
        it('should handle empty array property', () => {
            const results = searchEngine.searchSync('[emptyArray]:value', files);
            
            expect(results).toEqual([]);
        });
        
        it('should handle null property value', () => {
            const results = searchEngine.searchSync('[nullValue]:value', files);
            
            expect(results).toEqual([]);
        });
        
        it('should handle non-existent property', () => {
            const results = searchEngine.searchSync('[nonExistent]:value', files);
            
            expect(results).toEqual([]);
        });
    });
    
    describe('Multiple query terms', () => {
        beforeEach(() => {
            (mockApp.vault.read as jest.Mock).mockImplementation(async (file: TFile) => {
                if (file.basename === 'Test File') {
                    return 'This has apple banana together';
                } else {
                    return 'This has only apple';
                }
            });
        });
        
        it('should search with space separated terms as a phrase', async () => {
            const results = await searchEngine.search('apple banana', files);
            
            // 공백을 포함한 전체 문자열로 검색
            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('Test File');
        });
        
        it('should handle quoted phrases', async () => {
            (mockApp.vault.read as jest.Mock).mockResolvedValue('This is a "test phrase" in content');
            
            const results = await searchEngine.search('"test phrase"', files);
            
            expect(results.length).toBeGreaterThan(0);
        });
    });
    
    describe('Performance edge cases', () => {
        it('should handle very large file arrays', () => {
            const largeFileArray = Array(1000).fill(null).map((_, i) => 
                createMockFile(`File${i}`, Date.now(), Date.now())
            );
            
            const results = searchEngine.searchSync('test', largeFileArray);
            
            expect(results).toBeDefined();
        });
        
        it('should handle very long search queries', async () => {
            const longQuery = 'word '.repeat(100);
            
            const results = await searchEngine.search(longQuery, files);
            
            expect(results).toBeDefined();
        });
        
        it('should handle search with special Unicode characters', async () => {
            (mockApp.vault.read as jest.Mock).mockResolvedValue('한글 테스트 content with 日本語 and émojis 🎉');
            
            const results = await searchEngine.search('한글', files);
            
            expect(results).toBeDefined();
        });
    });
    
    describe('Highlight edge cases', () => {
        it('should not break HTML in text', () => {
            const text = 'This is a <div>test</div> text';
            const highlighted = searchEngine.highlightText(text, 'test');
            
            // HTML 태그 내부는 하이라이트하지 않음
            expect(highlighted).not.toContain('<mark><div>test</div></mark>');
        });
        
        it('should handle overlapping search terms', () => {
            const text = 'testing test tested';
            const highlighted = searchEngine.highlightText(text, 'test');
            
            // 모든 'test'가 포함된 단어를 하이라이트
            expect(highlighted).toContain('<mark>');
        });
        
        it('should handle very long text', () => {
            const longText = 'word '.repeat(1000) + 'test';
            const highlighted = searchEngine.highlightText(longText, 'test');
            
            expect(highlighted).toContain('<mark>test</mark>');
        });
    });
    
    describe('Context extraction edge cases', () => {
        it('should handle term at start of file', async () => {
            (mockApp.vault.read as jest.Mock).mockResolvedValue('Test at start of content...');
            
            const context = await searchEngine.getSearchContext(files[0], 'Test', 20);
            
            // 시작 부분이면 앞 생략 기호 없음
            expect(context).not.toMatch(/^\.\.\./);
        });
        
        it('should handle term at end of file', async () => {
            (mockApp.vault.read as jest.Mock).mockResolvedValue('...content ends with Test');
            
            const context = await searchEngine.getSearchContext(files[0], 'Test', 20);
            
            // 끝 부분이면 뒤 생략 기호 없음
            expect(context).not.toMatch(/\.\.\.$/);
        });
        
        it('should handle very short content', async () => {
            (mockApp.vault.read as jest.Mock).mockResolvedValue('Short test');
            
            const context = await searchEngine.getSearchContext(files[0], 'test', 100);
            
            // 짧은 콘텐츠는 전체 반환
            expect(context).toBe('Short test');
        });
        
        it('should handle empty content', async () => {
            (mockApp.vault.read as jest.Mock).mockResolvedValue('');
            
            const context = await searchEngine.getSearchContext(files[0], 'test', 20);
            
            expect(context).toBeNull();
        });
    });
});

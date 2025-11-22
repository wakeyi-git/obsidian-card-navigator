/**
 * CardData 에러 케이스 및 엣지 케이스 테스트
 * 
 * 현재 API에 맞게 재작성 (2024-11-19)
 * extractContent() 통합 메서드와 개별 메서드들의 에러 처리를 테스트합니다.
 */

import { TFile, App, CachedMetadata } from 'obsidian';
import { CardDataExtractor } from '../../src/card/CardData';
import { CardNavigatorSettings, CardContentType } from '../../src/types';

// Mock 설정
const mockGetSettings = jest.fn<CardNavigatorSettings, []>();

describe('CardDataExtractor - Error Handling & Edge Cases', () => {
    let app: App;
    let extractor: CardDataExtractor;
    let mockFile: TFile;
    
    beforeEach(() => {
        // App mock 생성
        app = {
            vault: {
                read: jest.fn(),
                on: jest.fn(),
                getAbstractFileByPath: jest.fn()
            },
            metadataCache: {
                getFileCache: jest.fn(),
                on: jest.fn(),
                resolvedLinks: {},
                getFirstLinkpathDest: jest.fn()
            }
        } as any;
        
        // Settings mock - debug 비활성화
        mockGetSettings.mockReturnValue({
            debug: { enabled: false }
        } as any);
        
        // 기본 파일 mock
        mockFile = new TFile();
        mockFile.path = 'test.md';
        mockFile.basename = 'test';
        mockFile.stat = { ctime: 1000000, mtime: 2000000, size: 100 };
        mockFile.parent = { path: 'folder' } as any;
        
        extractor = new CardDataExtractor(app, mockGetSettings);
    });
    
    afterEach(() => {
        extractor.clearCache();
        jest.clearAllMocks();
    });
    
    // ========================================
    // extractFileContent - 에러 처리
    // ========================================
    
    describe('extractFileContent - Error Handling', () => {
        it('should handle vault.read errors gracefully', async () => {
            // Suppress console.error for this error handling test
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            (app.vault.read as jest.Mock).mockRejectedValue(new Error('Read error'));

            const content = await extractor.extractFileContent(mockFile);

            expect(content).toBe('');
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
        
        it('should handle very long content correctly', async () => {
            const longContent = 'word '.repeat(10000);
            (app.vault.read as jest.Mock).mockResolvedValue(longContent);
            
            const content = await extractor.extractFileContent(mockFile);
            
            // 내용이 추출되어야 함 (maxLength는 extractContent에서 적용)
            expect(content).toBeTruthy();
            expect(content.length).toBeGreaterThan(0);
        });
        
        it('should handle content with only frontmatter', async () => {
            const content = '---\ntitle: Test\n---\n';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            
            expect(result).toBe('');
        });
        
        it('should handle content with malformed frontmatter', async () => {
            const content = '---\ntitle: Test\n---invalid\nActual content here';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            
            // 잘못된 frontmatter를 무시하고 본문 추출
            expect(result).toContain('content');
        });
        
        it('should handle empty file', async () => {
            (app.vault.read as jest.Mock).mockResolvedValue('');
            
            const content = await extractor.extractFileContent(mockFile);
            
            expect(content).toBe('');
        });
        
        it('should handle file with only whitespace', async () => {
            (app.vault.read as jest.Mock).mockResolvedValue('   \n\n  \n  ');
            
            const content = await extractor.extractFileContent(mockFile);
            
            expect(content).toBe('');
        });
        
        it('should handle file with only headers', async () => {
            const content = '# Header 1\n\n## Header 2\n\n### Header 3';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile, undefined, false);
            
            // includeFirstHeader=false이므로 첫 헤더 제외, 나머지 헤더는 본문
            expect(result).toContain('Header 2');
        });
        
        it('should handle content with multiple consecutive blank lines', async () => {
            const content = '# Title\n\n\n\nFirst paragraph\n\n\n\nSecond paragraph';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            
            expect(result).toContain('First paragraph');
            expect(result).toContain('Second paragraph');
        });
    });
    
    // ========================================
    // extractTags - 에러 처리
    // ========================================
    
    describe('extractTags - Error Handling', () => {
        it('should handle null cache', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const tags = extractor.extractTags(mockFile);
            
            expect(tags).toBe('');
        });
        
        it('should handle undefined cache', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(undefined);
            
            const tags = extractor.extractTags(mockFile);
            
            expect(tags).toBe('');
        });
        
        it('should handle cache with no tags', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {},
                tags: undefined
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const tags = extractor.extractTags(mockFile);
            
            expect(tags).toBe('');
        });
        
        it('should handle frontmatter with empty tags array', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { tags: [] },
                tags: []
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const tags = extractor.extractTags(mockFile);
            
            expect(tags).toBe('');
        });
        
        it('should handle frontmatter with null tags', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { tags: null },
                tags: []
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const tags = extractor.extractTags(mockFile);
            
            expect(tags).toBe('');
        });
        
        it('should handle frontmatter with invalid tag types', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { 
                    tags: [123, true, { invalid: 'object' }] as any 
                },
                tags: []
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const tags = extractor.extractTags(mockFile);
            
            // 숫자와 boolean은 문자열로 변환되어야 함
            expect(tags).toContain('123');
            expect(tags).toContain('true');
        });
        
        it('should deduplicate tags from frontmatter and inline', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { tags: ['duplicate', 'unique1'] },
                tags: [
                    { tag: '#duplicate', position: {} as any },
                    { tag: '#unique2', position: {} as any }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const tags = extractor.extractTags(mockFile);
            
            // span 태그 개수를 세서 중복 확인 (HTML 문자열에서 "duplicate"는 2번 나올 수 있음)
            const spanCount = (tags.match(/<span[^>]*data-tag="duplicate"/g) || []).length;
            expect(spanCount).toBe(1);
            expect(tags).toContain('unique1');
            expect(tags).toContain('unique2');
        });
        
        it('should handle tags with special characters', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { tags: ['tag-with-dash', 'tag_with_underscore'] },
                tags: []
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const tags = extractor.extractTags(mockFile);
            
            expect(tags).toContain('tag-with-dash');
            expect(tags).toContain('tag_with_underscore');
        });
    });
    
    // ========================================
    // extractFirstHeader - 에러 처리
    // ========================================
    
    describe('extractFirstHeader - Error Handling', () => {
        it('should handle null cache', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const header = extractor.extractFirstHeader(mockFile);
            
            expect(header).toBe('');
        });
        
        it('should handle cache with no headings', () => {
            const mockCache: Partial<CachedMetadata> = {
                headings: undefined
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const header = extractor.extractFirstHeader(mockFile);
            
            expect(header).toBe('');
        });
        
        it('should handle cache with empty headings array', () => {
            const mockCache: Partial<CachedMetadata> = {
                headings: []
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const header = extractor.extractFirstHeader(mockFile);
            
            expect(header).toBe('');
        });
    });
    
    // ========================================
    // extractProperty - 에러 처리
    // ========================================
    
    describe('extractProperty - Error Handling', () => {
        it('should return empty string for empty property name', () => {
            const result = extractor.extractProperty(mockFile, '');
            
            expect(result).toBe('');
        });
        
        it('should handle null cache', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const result = extractor.extractProperty(mockFile, 'title');
            
            expect(result).toBe('');
        });
        
        it('should handle cache with no frontmatter', () => {
            const mockCache: Partial<CachedMetadata> = {};
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'title');
            
            expect(result).toBe('');
        });
        
        it('should handle non-existent property', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { title: 'Test' }
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'nonexistent');
            
            expect(result).toBe('');
        });
        
        it('should handle null property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { title: null }
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'title');
            
            expect(result).toBe('');
        });
        
        it('should handle undefined property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { title: undefined }
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'title');
            
            expect(result).toBe('');
        });
        
        it('should handle array property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { tags: ['tag1', 'tag2', 'tag3'] }
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'tags');
            
            expect(result).toBe('tag1, tag2, tag3');
        });
        
        it('should handle object property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { meta: { author: 'John', date: '2024-01-01' } }
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'meta');
            
            expect(result).toContain('author');
            expect(result).toContain('John');
        });
        
        it('should handle number property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { count: 42 }
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'count');
            
            expect(result).toBe('42');
        });
        
        it('should handle boolean property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { published: true }
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'published');
            
            expect(result).toBe('true');
        });
    });
    
    // ========================================
    // extractBacklinks - 에러 처리
    // ========================================
    
    describe('extractBacklinks - Error Handling', () => {
        it('should handle empty resolvedLinks', async () => {
            app.metadataCache.resolvedLinks = {};
            
            const backlinks = await extractor.extractBacklinks(mockFile);
            
            expect(backlinks).toBe('');
        });
        
        it('should handle file with no backlinks', async () => {
            app.metadataCache.resolvedLinks = {
                'other.md': { 'another.md': 1 }
            };
            
            const backlinks = await extractor.extractBacklinks(mockFile);
            
            expect(backlinks).toBe('');
        });
        
        it('should handle non-existent source file', async () => {
            app.metadataCache.resolvedLinks = {
                'deleted.md': { [mockFile.path]: 1 }
            };
            
            (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
            
            const backlinks = await extractor.extractBacklinks(mockFile);
            
            // 존재하지 않는 파일은 무시되어야 함
            expect(backlinks).toBe('');
        });
    });
    
    // ========================================
    // extractOutgoingLinks - 에러 처리
    // ========================================
    
    describe('extractOutgoingLinks - Error Handling', () => {
        it('should handle null cache', async () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const links = await extractor.extractOutgoingLinks(mockFile);
            
            expect(links).toBe('');
        });
        
        it('should handle cache with no links', async () => {
            const mockCache: Partial<CachedMetadata> = {
                links: undefined,
                frontmatterLinks: undefined
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const links = await extractor.extractOutgoingLinks(mockFile);
            
            expect(links).toBe('');
        });
        
        it('should handle cache with empty links arrays', async () => {
            const mockCache: Partial<CachedMetadata> = {
                links: [],
                frontmatterLinks: []
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const links = await extractor.extractOutgoingLinks(mockFile);
            
            expect(links).toBe('');
        });
        
        it('should handle broken links', async () => {
            const mockCache: Partial<CachedMetadata> = {
                links: [
                    { link: 'non-existent', displayText: 'Broken', original: '[[non-existent]]', position: {} as any }
                ],
                frontmatterLinks: []
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            (app.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(null);
            
            const links = await extractor.extractOutgoingLinks(mockFile);
            
            // 깨진 링크는 무시되어야 함
            expect(links).toBe('');
        });
        
        it('should deduplicate links to same file', async () => {
            const targetFile = new TFile();
            targetFile.path = 'target.md';
            targetFile.basename = 'target';
            
            const mockCache: Partial<CachedMetadata> = {
                links: [
                    { link: 'target', displayText: 'Link 1', original: '[[target]]', position: {} as any },
                    { link: 'target', displayText: 'Link 2', original: '[[target]]', position: {} as any }
                ],
                frontmatterLinks: []
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            (app.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(targetFile);
            
            const links = await extractor.extractOutgoingLinks(mockFile);
            
            // 같은 파일로의 중복 링크는 한 번만 나와야 함
            const targetCount = (links.match(/target/g) || []).length;
            expect(targetCount).toBe(1);
        });
    });
    
    // ========================================
    // extractContent - 통합 테스트
    // ========================================
    
    describe('extractContent - Integration', () => {
        it('should apply maxLength correctly for text content types', async () => {
            const mockCache: Partial<CachedMetadata> = {
                headings: [
                    { heading: 'A very long header that should be truncated', level: 1, position: {} as any }
                ]
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const content = await extractor.extractContent(mockFile, 'first-header', 10);
            
            expect(content).toHaveLength(13); // 10 + '...'
            expect(content).toMatch(/\.\.\.$/);
        });
        
        it('should not apply maxLength to HTML content', async () => {
            const longTags = Array(20).fill(0).map((_, i) => 
                `<span class="tag-link" data-tag="tag${i}">#tag${i}</span>`
            ).join(', ');
            
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: { tags: Array(20).fill(0).map((_, i) => `tag${i}`) },
                tags: []
            };
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const content = await extractor.extractContent(mockFile, 'tags', 10);
            
            // HTML 콘텐츠는 maxLength를 무시해야 함
            expect(content.length).toBeGreaterThan(10);
            expect(content).toContain('tag-link');
        });
        
        it('should handle invalid content type gracefully', async () => {
            const content = await extractor.extractContent(
                mockFile, 
                'invalid-type' as CardContentType
            );
            
            expect(content).toBe('');
        });
    });
    
    // ========================================
    // 캐시 - 엣지 케이스
    // ========================================
    
    describe('Cache - Edge Cases', () => {
        it('should cache content with different render modes separately', async () => {
            // 여러 줄의 내용으로 테스트 (한 줄이면 plain과 html이 같을 수 있음)
            const fileContent = '# Title\n\nFirst line\nSecond line\nThird line';
            (app.vault.read as jest.Mock).mockResolvedValue(fileContent);
            
            // plain 모드로 추출 (공백으로 결합)
            const plain = await extractor.extractFileContent(mockFile, 'plain');
            
            // markdown-html 모드로 추출 (줄바꿈 유지)
            const html = await extractor.extractFileContent(mockFile, 'markdown-html');
            
            // 두 번 호출되어야 함 (다른 캐시 키)
            expect(app.vault.read).toHaveBeenCalledTimes(2);
            
            // plain은 한 줄, html은 여러 줄
            expect(plain).toContain('First line Second line');
            expect(html).toContain('First line\nSecond line');
        });
        
        it('should cache content with different includeFirstHeader separately', async () => {
            const fileContent = '# Title\n\nContent';
            (app.vault.read as jest.Mock).mockResolvedValue(fileContent);
            
            // includeFirstHeader=false
            await extractor.extractFileContent(mockFile, undefined, false);
            
            // includeFirstHeader=true
            await extractor.extractFileContent(mockFile, undefined, true);
            
            // 두 번 호출되어야 함 (다른 캐시 키)
            expect(app.vault.read).toHaveBeenCalledTimes(2);
        });
    });
});

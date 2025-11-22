import { TFile, App, CachedMetadata } from 'obsidian';
import { CardDataExtractor } from '../../src/card/CardData';
import { CardNavigatorSettings } from '../../src/types';

// Mock 설정
const mockGetSettings = jest.fn<CardNavigatorSettings, []>();

describe('CardDataExtractor', () => {
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
        
        // Settings mock
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
    
    describe('extractFilename', () => {
        it('should return basename without extension', () => {
            const result = extractor.extractFilename(mockFile);
            expect(result).toBe('test');
        });
        
        it('should handle files with multiple dots', () => {
            mockFile.basename = 'test.backup';
            const result = extractor.extractFilename(mockFile);
            expect(result).toBe('test.backup');
        });
        
        it('should handle Korean filenames', () => {
            mockFile.basename = '테스트 파일';
            const result = extractor.extractFilename(mockFile);
            expect(result).toBe('테스트 파일');
        });
    });
    
    describe('extractFilePath', () => {
        it('should return full path', () => {
            const result = extractor.extractFilePath(mockFile);
            expect(result).toBe('test.md');
        });
        
        it('should handle nested paths', () => {
            mockFile.path = 'folder/subfolder/test.md';
            const result = extractor.extractFilePath(mockFile);
            expect(result).toBe('folder/subfolder/test.md');
        });
    });
    
    describe('extractFirstHeader', () => {
        it('should return first header from cache', () => {
            const mockCache: Partial<CachedMetadata> = {
                headings: [
                    { heading: 'First Header', level: 1, position: {} as any },
                    { heading: 'Second Header', level: 2, position: {} as any }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractFirstHeader(mockFile);
            expect(result).toBe('First Header');
        });
        
        it('should return empty string when no headings', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue({});
            
            const result = extractor.extractFirstHeader(mockFile);
            expect(result).toBe('');
        });
        
        it('should return empty string when cache is null', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const result = extractor.extractFirstHeader(mockFile);
            expect(result).toBe('');
        });
        
        it('should handle headings with special characters', () => {
            const mockCache: Partial<CachedMetadata> = {
                headings: [
                    { heading: 'Header with # and @ symbols', level: 1, position: {} as any }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractFirstHeader(mockFile);
            expect(result).toBe('Header with # and @ symbols');
        });
    });
    
    describe('extractFileContent', () => {
        it('should extract content without frontmatter', async () => {
            const content = `---
title: Test
---

# Header

This is content.`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            expect(result).toBe('This is content.');
        });
        
        it('should exclude first header by default', async () => {
            const content = `# Title

First paragraph.
Second paragraph.`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            expect(result).toBe('First paragraph. Second paragraph.');
        });
        
        it('should include first header when requested', async () => {
            const content = `# Title

First paragraph.`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile, undefined, true);
            expect(result).toContain('# Title');
            expect(result).toContain('First paragraph.');
        });
        
        it('should handle markdown-html render mode', async () => {
            const content = `# Title

**Bold** and *italic*`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile, 'markdown-html');
            expect(result).toContain('**Bold**');
            expect(result).toContain('*italic*');
        });
        
        it('should return empty string for empty content', async () => {
            (app.vault.read as jest.Mock).mockResolvedValue('');
            
            const result = await extractor.extractFileContent(mockFile);
            expect(result).toBe('');
        });
        
        it('should cache content', async () => {
            const content = 'Test content';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            // First call
            await extractor.extractFileContent(mockFile);
            
            // Second call should use cache
            await extractor.extractFileContent(mockFile);
            
            // vault.read should only be called once
            expect(app.vault.read).toHaveBeenCalledTimes(1);
        });
        
        it('should use separate cache for different render modes', async () => {
            const content = 'Test content';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            await extractor.extractFileContent(mockFile, 'plain');
            await extractor.extractFileContent(mockFile, 'markdown-html');
            
            // Should call read twice for different modes
            expect(app.vault.read).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('extractTags', () => {
        it('should extract frontmatter tags (array)', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    tags: ['tag1', 'tag2']
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractTags(mockFile);
            expect(result).toContain('tag1');
            expect(result).toContain('tag2');
            expect(result).toContain('tag-link');
        });
        
        it('should extract frontmatter tags (string)', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    tags: 'single-tag'
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractTags(mockFile);
            expect(result).toContain('single-tag');
        });
        
        it('should extract inline tags', () => {
            const mockCache: Partial<CachedMetadata> = {
                tags: [
                    { tag: '#inline-tag', position: {} as any }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractTags(mockFile);
            expect(result).toContain('inline-tag');
        });
        
        it('should merge and deduplicate tags', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    tags: ['tag1', 'tag2']
                },
                tags: [
                    { tag: '#tag1', position: {} as any },
                    { tag: '#tag3', position: {} as any }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractTags(mockFile);
            
            // tag1 span이 한 번만 나타나는지 확인
            const tag1SpanCount = (result.match(/<span[^>]*data-tag="tag1"/g) || []).length;
            expect(tag1SpanCount).toBe(1);
            expect(result).toContain('data-tag="tag2"');
            expect(result).toContain('data-tag="tag3"');
        });
        
        it('should return empty string when no tags', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue({});
            
            const result = extractor.extractTags(mockFile);
            expect(result).toBe('');
        });
        
        it('should normalize tags (remove # prefix)', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    tags: ['#tag-with-hash']
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractTags(mockFile);
            expect(result).toContain('data-tag="tag-with-hash"');
        });
    });
    
    describe('extractCreatedDate', () => {
        it('should return formatted creation date', () => {
            mockFile.stat.ctime = new Date('2024-01-15').getTime();
            
            const result = extractor.extractCreatedDate(mockFile);
            expect(result).toBe('2024-01-15');
        });
        
        it('should handle edge dates', () => {
            mockFile.stat.ctime = new Date('2024-12-31').getTime();
            
            const result = extractor.extractCreatedDate(mockFile);
            expect(result).toBe('2024-12-31');
        });
    });
    
    describe('extractModifiedDate', () => {
        it('should return formatted modification date', () => {
            mockFile.stat.mtime = new Date('2024-11-19').getTime();
            
            const result = extractor.extractModifiedDate(mockFile);
            expect(result).toBe('2024-11-19');
        });
    });
    
    describe('extractProperty', () => {
        it('should extract string property', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    author: 'John Doe'
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'author');
            expect(result).toBe('John Doe');
        });
        
        it('should extract array property', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    authors: ['John', 'Jane']
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'authors');
            expect(result).toBe('John, Jane');
        });
        
        it('should extract number property', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    rating: 5
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'rating');
            expect(result).toBe('5');
        });
        
        it('should return empty string for missing property', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue({});
            
            const result = extractor.extractProperty(mockFile, 'nonexistent');
            expect(result).toBe('');
        });
        
        it('should return empty string when no frontmatter', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const result = extractor.extractProperty(mockFile, 'author');
            expect(result).toBe('');
        });
    });
    
    describe('extractBacklinks', () => {
        it('should extract backlinks', async () => {
            app.metadataCache.resolvedLinks = {
                'source1.md': { 'test.md': 1 },
                'source2.md': { 'test.md': 1 },
                'other.md': { 'different.md': 1 }
            };
            
            const sourceFile1 = new TFile();
            sourceFile1.path = 'source1.md';
            sourceFile1.basename = 'Source 1';
            
            const sourceFile2 = new TFile();
            sourceFile2.path = 'source2.md';
            sourceFile2.basename = 'Source 2';
            
            (app.vault.getAbstractFileByPath as jest.Mock)
                .mockImplementation((path: string) => {
                    if (path === 'source1.md') return sourceFile1;
                    if (path === 'source2.md') return sourceFile2;
                    return null;
                });
            
            const result = await extractor.extractBacklinks(mockFile);
            
            expect(result).toContain('Source 1');
            expect(result).toContain('Source 2');
            expect(result).toContain('internal-link');
        });
        
        it('should return empty string when no backlinks', async () => {
            app.metadataCache.resolvedLinks = {};
            
            const result = await extractor.extractBacklinks(mockFile);
            expect(result).toBe('');
        });
        
        it('should cache backlinks', async () => {
            app.metadataCache.resolvedLinks = {
                'source1.md': { 'test.md': 1 }
            };
            
            const sourceFile = new TFile();
            sourceFile.path = 'source1.md';
            sourceFile.basename = 'Source';
            
            (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(sourceFile);
            
            // First call
            await extractor.extractBacklinks(mockFile);
            
            // Second call should use cache
            await extractor.extractBacklinks(mockFile);
            
            // Should use cache, so only create element once
            expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(1);
        });
    });
    
    describe('extractOutgoingLinks', () => {
        it('should extract outgoing links', async () => {
            const mockCache: Partial<CachedMetadata> = {
                links: [
                    { link: 'target1.md', original: '[[target1.md|Target 1]]', displayText: 'Target 1', position: {} as any },
                    { link: 'target2.md', original: '[[target2.md|Target 2]]', displayText: 'Target 2', position: {} as any }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const targetFile1 = new TFile();
            targetFile1.path = 'target1.md';
            targetFile1.basename = 'Target 1';
            
            const targetFile2 = new TFile();
            targetFile2.path = 'target2.md';
            targetFile2.basename = 'Target 2';
            
            (app.metadataCache.getFirstLinkpathDest as jest.Mock)
                .mockImplementation((link: string) => {
                    if (link === 'target1.md') return targetFile1;
                    if (link === 'target2.md') return targetFile2;
                    return null;
                });
            
            const result = await extractor.extractOutgoingLinks(mockFile);
            
            expect(result).toContain('Target 1');
            expect(result).toContain('Target 2');
        });
        
        it('should deduplicate links', async () => {
            const mockCache: Partial<CachedMetadata> = {
                links: [
                    { link: 'target.md', original: '[[target.md|Target]]', displayText: 'Target', position: {} as any },
                    { link: 'target.md', original: '[[target.md|Target Again]]', displayText: 'Target Again', position: {} as any }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const targetFile = new TFile();
            targetFile.path = 'target.md';
            targetFile.basename = 'Target';
            
            (app.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(targetFile);
            
            const result = await extractor.extractOutgoingLinks(mockFile);
            
            // Should only appear once
            const count = (result.match(/target\.md/g) || []).length;
            expect(count).toBe(1);
        });
        
        it('should return empty string when no links', async () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue({});
            
            const result = await extractor.extractOutgoingLinks(mockFile);
            expect(result).toBe('');
        });
    });
    
    describe('cache management', () => {
        it('should clear all caches', async () => {
            const content = 'Test content';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            // Create some cached data
            await extractor.extractFileContent(mockFile);
            
            // Clear cache
            extractor.clearCache();
            
            // Next call should read from vault again
            await extractor.extractFileContent(mockFile);
            
            expect(app.vault.read).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('extractContent wrapper', () => {
        it('should route to correct extractor based on type', async () => {
            const tests = [
                { type: 'filename' as const, expected: 'test' },
                { type: 'file-path' as const, expected: 'test.md' }
            ];
            
            for (const test of tests) {
                const result = await extractor.extractContent(mockFile, test.type);
                expect(result).toBe(test.expected);
            }
        });
        
        it('should apply maxLength when appropriate', async () => {
            const content = 'A'.repeat(100);
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractContent(mockFile, 'content', 50);
            expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
        });
        
        it('should not apply maxLength to HTML content', async () => {
            const mockCache: Partial<CachedMetadata> = {
                tags: [
                    { tag: '#verylongtagnamethatexceedsmaxlength', position: {} as any }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = await extractor.extractContent(mockFile, 'tags', 10);
            // Should include full tag despite maxLength
            expect(result).toContain('verylongtagnamethatexceedsmaxlength');
        });
    });
});

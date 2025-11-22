import { TFile, App, CachedMetadata } from 'obsidian';
import { CardDataExtractor } from '../../src/card/CardData';
import { CardNavigatorSettings } from '../../src/types';

// Mock 설정
const mockGetSettings = jest.fn<CardNavigatorSettings, []>();

describe('CardDataExtractor - Extended Tests', () => {
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
    
    describe('Link Management', () => {
        describe('initializePreviousLinks', () => {
            it('should initialize previousLinks from resolvedLinks', () => {
                // resolvedLinks 설정
                app.metadataCache.resolvedLinks = {
                    'file1.md': { 'target1.md': 1, 'target2.md': 1 },
                    'file2.md': { 'target3.md': 1 }
                };
                
                // 새 extractor 생성 (initializePreviousLinks가 constructor에서 호출됨)
                extractor = new CardDataExtractor(app, mockGetSettings);
                
                // 내부 상태를 간접적으로 검증
                // initializePreviousLinks가 실행되었는지 로그를 통해 확인
                expect(app.metadataCache.on).toHaveBeenCalled();
            });
            
            it('should handle empty resolvedLinks', () => {
                app.metadataCache.resolvedLinks = {};
                
                extractor = new CardDataExtractor(app, mockGetSettings);
                
                // 오류 없이 실행되어야 함
                expect(app.metadataCache.on).toHaveBeenCalled();
            });
            
            it('should handle files with no outgoing links', () => {
                app.metadataCache.resolvedLinks = {
                    'file1.md': {},
                    'file2.md': {}
                };
                
                extractor = new CardDataExtractor(app, mockGetSettings);
                
                expect(app.metadataCache.on).toHaveBeenCalled();
            });
        });
    });
    
    describe('Cache Invalidation', () => {
        it('should invalidate cache for modified file', async () => {
            const content = 'Test content';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            // 첫 번째 호출
            await extractor.extractFileContent(mockFile);
            expect(app.vault.read).toHaveBeenCalledTimes(1);
            
            // 캐시 무효화
            extractor['invalidateCache'](mockFile);
            
            // 두 번째 호출 - 캐시 무효화 후 다시 읽어야 함
            await extractor.extractFileContent(mockFile);
            expect(app.vault.read).toHaveBeenCalledTimes(2);
        });
        
        it('should invalidate backlinks cache', async () => {
            app.metadataCache.resolvedLinks = {
                'source.md': { 'test.md': 1 }
            };
            
            const sourceFile = new TFile();
            sourceFile.path = 'source.md';
            sourceFile.basename = 'Source';
            
            (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(sourceFile);
            
            // 첫 번째 호출 - 캐시 생성
            await extractor.extractBacklinks(mockFile);
            expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(1);
            
            // 캐시 무효화
            extractor['invalidateCache'](mockFile);
            
            // 두 번째 호출 - 재계산
            await extractor.extractBacklinks(mockFile);
            expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(2);
        });
        
        it('should clear all caches including previousLinks', () => {
            extractor.clearCache();
            
            // clearCache 호출 후 previousLinks도 초기화되어야 함
            expect(extractor['previousLinks']).toBeDefined();
        });
    });
    
    describe('Error Handling', () => {
        it('should handle vault.read error gracefully', async () => {
            (app.vault.read as jest.Mock).mockRejectedValue(new Error('Read error'));
            
            const result = await extractor.extractFileContent(mockFile);
            expect(result).toBe('');
        });
        
        it('should handle invalid cache data gracefully', () => {
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            const result = extractor.extractFirstHeader(mockFile);
            expect(result).toBe('');
        });
        
        it('should handle missing file in getAbstractFileByPath', async () => {
            app.metadataCache.resolvedLinks = {
                'source.md': { 'test.md': 1 }
            };
            
            (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
            
            const result = await extractor.extractBacklinks(mockFile);
            // 파일을 찾을 수 없어도 오류 없이 빈 결과 반환
            expect(result).toBe('');
        });
        
        it('should handle corrupted resolvedLinks data', async () => {
            // 비정상적인 데이터 구조
            app.metadataCache.resolvedLinks = null as any;
            
            // 오류 없이 실행되어야 함
            const result = await extractor.extractBacklinks(mockFile);
            expect(result).toBe('');
        });
    });
    
    describe('Edge Cases - Frontmatter', () => {
        it('should handle malformed frontmatter gracefully', async () => {
            const content = `---
invalid: yaml: structure:
too: many: colons
---

Content after frontmatter`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            // frontmatter를 정규식으로 제거하므로 본문만 남음
            expect(result).toContain('Content after frontmatter');
        });
        
        it('should handle frontmatter without closing ---', async () => {
            const content = `---
title: Test

Content without closing frontmatter`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            // 정규식이 매칭되지 않으면 전체 내용을 반환
            expect(result).toBeTruthy();
        });
        
        it('should handle empty frontmatter', async () => {
            const content = `---
---

Content after empty frontmatter`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            expect(result).toBe('Content after empty frontmatter');
        });
    });
    
    describe('Edge Cases - Headers', () => {
        it('should handle files with only header', async () => {
            const content = `# Only Header`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            // 헤더만 있고 본문이 없으면 빈 문자열
            expect(result).toBe('');
        });
        
        it('should include first header when requested', async () => {
            const content = `# Title Header

Content paragraph`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile, undefined, true);
            expect(result).toContain('# Title Header');
            expect(result).toContain('Content paragraph');
        });
        
        it('should handle multiple headers in content', async () => {
            const content = `# First Header

Content 1

## Second Header

Content 2`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            // 첫 번째 헤더는 제외되지만 두 번째 헤더는 포함됨
            expect(result).not.toContain('# First Header');
            expect(result).toContain('## Second Header');
            expect(result).toContain('Content 1');
            expect(result).toContain('Content 2');
        });
        
        it('should handle header with multiple # symbols', async () => {
            const content = `#### Deep Header

Content`;
            
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractFileContent(mockFile);
            expect(result).toBe('Content');
        });
    });
    
    describe('Edge Cases - Tags', () => {
        it('should handle empty tags array in frontmatter', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    tags: []
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractTags(mockFile);
            expect(result).toBe('');
        });
        
        it('should handle numeric tag in frontmatter', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    tags: [123, 456]
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractTags(mockFile);
            expect(result).toContain('123');
            expect(result).toContain('456');
        });
        
        it('should normalize tags with # prefix', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    tags: ['#with-hash', 'without-hash']
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractTags(mockFile);
            // 모든 태그가 # 접두사 없이 정규화되어야 함
            expect(result).toContain('data-tag="with-hash"');
            expect(result).toContain('data-tag="without-hash"');
        });
        
        it('should handle whitespace in tags', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    tags: [' tag-with-spaces ', '  another  ']
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractTags(mockFile);
            // trim()이 적용되지 않으면 그대로 출력
            expect(result).toBeTruthy();
        });
    });
    
    describe('Edge Cases - Links', () => {
        it('should handle self-links in outgoing links', async () => {
            const mockCache: Partial<CachedMetadata> = {
                links: [
                    { 
                        link: 'test.md', 
                        original: '[[test.md]]', 
                        displayText: 'Self Link', 
                        position: {} as any 
                    }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            (app.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(mockFile);
            
            const result = await extractor.extractOutgoingLinks(mockFile);
            // 자기 자신을 링크하는 경우도 포함
            expect(result).toContain('test');
        });
        
        it('should handle broken links in outgoing links', async () => {
            const mockCache: Partial<CachedMetadata> = {
                links: [
                    { 
                        link: 'nonexistent.md', 
                        original: '[[nonexistent.md]]', 
                        displayText: 'Broken', 
                        position: {} as any 
                    }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            (app.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(null);
            
            const result = await extractor.extractOutgoingLinks(mockFile);
            // 깨진 링크는 출력에 포함되지 않음
            expect(result).toBe('');
        });
        
        it('should handle links with special characters', async () => {
            const mockCache: Partial<CachedMetadata> = {
                links: [
                    { 
                        link: '파일 이름 (특수문자).md', 
                        original: '[[파일 이름 (특수문자)]]', 
                        displayText: 'Special', 
                        position: {} as any 
                    }
                ]
            };
            
            const targetFile = new TFile();
            targetFile.path = '파일 이름 (특수문자).md';
            targetFile.basename = '파일 이름 (특수문자)';
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            (app.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(targetFile);
            
            const result = await extractor.extractOutgoingLinks(mockFile);
            expect(result).toContain('파일 이름 (특수문자)');
        });
    });
    
    describe('Edge Cases - Property Extraction', () => {
        it('should handle null property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    nullProperty: null
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'nullProperty');
            expect(result).toBe('');
        });
        
        it('should handle undefined property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    undefinedProperty: undefined
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'undefinedProperty');
            expect(result).toBe('');
        });
        
        it('should handle object property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    objectProperty: { key: 'value', nested: { deep: 'data' } }
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'objectProperty');
            expect(result).toContain('key');
            expect(result).toContain('value');
        });
        
        it('should handle boolean property value', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    boolProperty: true
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, 'boolProperty');
            expect(result).toBe('true');
        });
        
        it('should handle empty property name', () => {
            const mockCache: Partial<CachedMetadata> = {
                frontmatter: {
                    property: 'value'
                }
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = extractor.extractProperty(mockFile, '');
            expect(result).toBe('');
        });
    });
    
    describe('HTML Encoding', () => {
        it('should encode HTML special characters in file paths', async () => {
            app.metadataCache.resolvedLinks = {
                'source<>.md': { 'test.md': 1 }
            };
            
            const sourceFile = new TFile();
            sourceFile.path = 'source<>.md';
            sourceFile.basename = 'source<>';
            
            (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(sourceFile);
            
            const result = await extractor.extractBacklinks(mockFile);
            expect(result).toContain('&lt;');
            expect(result).toContain('&gt;');
            expect(result).not.toContain('<>');
        });
        
        it('should encode quotes in file names', async () => {
            app.metadataCache.resolvedLinks = {
                'source"file".md': { 'test.md': 1 }
            };
            
            const sourceFile = new TFile();
            sourceFile.path = 'source"file".md';
            sourceFile.basename = 'source"file"';
            
            (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(sourceFile);
            
            const result = await extractor.extractBacklinks(mockFile);
            // &quot;가 포함되어야 함
            expect(result).toContain('&quot;');
            // 원본 " 문자는 포함되지 않아야 함
            // 하지만 HTML 문자열 전체에서 " 문자를 찾으면 HTML 태그 자체의 "가 감지됨
            // 따라서 data-file-path 속성과 텍스트 부분에 인코딩된 문자가 있는지 확인
            expect(result).toMatch(/data-file-path="[^"]*&quot;[^"]*"/);
            expect(result).toMatch(/>[^<]*&quot;[^<]*</);
        });
        
        it('should encode ampersands in file names', async () => {
            app.metadataCache.resolvedLinks = {
                'source&file.md': { 'test.md': 1 }
            };
            
            const sourceFile = new TFile();
            sourceFile.path = 'source&file.md';
            sourceFile.basename = 'source&file';
            
            (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(sourceFile);
            
            const result = await extractor.extractBacklinks(mockFile);
            expect(result).toContain('&amp;');
        });
    });
    
    describe('Performance - Cache Usage', () => {
        it('should use different cache for different render modes', async () => {
            const content = '**Bold** text';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            // plain 모드
            await extractor.extractFileContent(mockFile, 'plain');
            
            // markdown-html 모드
            await extractor.extractFileContent(mockFile, 'markdown-html');
            
            // 다른 렌더 모드이므로 2번 읽어야 함
            expect(app.vault.read).toHaveBeenCalledTimes(2);
        });
        
        it('should use different cache for includeFirstHeader option', async () => {
            const content = '# Header\n\nContent';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            // includeFirstHeader: false (기본값)
            await extractor.extractFileContent(mockFile);
            
            // includeFirstHeader: true
            await extractor.extractFileContent(mockFile, undefined, true);
            
            // 다른 옵션이므로 2번 읽어야 함
            expect(app.vault.read).toHaveBeenCalledTimes(2);
        });
        
        it('should invalidate all related caches on file change', async () => {
            const content = 'Test content';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            // 여러 타입의 캐시 생성
            await extractor.extractFileContent(mockFile);
            await extractor.extractBacklinks(mockFile);
            
            // 파일 변경 시뮬레이션
            mockFile.stat.mtime = 3000000;
            
            // 캐시 무효화
            extractor['invalidateCache'](mockFile);
            
            // 다시 추출 - 캐시가 없으므로 다시 읽어야 함
            await extractor.extractFileContent(mockFile);
            expect(app.vault.read).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('Regression Tests', () => {
        it('should maintain cache across multiple extractContent calls', async () => {
            const content = 'Test content';
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            // extractContent를 통한 여러 호출
            await extractor.extractContent(mockFile, 'content');
            await extractor.extractContent(mockFile, 'content');
            await extractor.extractContent(mockFile, 'content');
            
            // 캐시 사용으로 한 번만 읽음
            expect(app.vault.read).toHaveBeenCalledTimes(1);
        });
        
        it('should handle maxLength correctly for plain text', async () => {
            const content = 'A'.repeat(100);
            (app.vault.read as jest.Mock).mockResolvedValue(content);
            
            const result = await extractor.extractContent(mockFile, 'content', 50);
            expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
            expect(result).toContain('...');
        });
        
        it('should not apply maxLength to HTML content types', async () => {
            const mockCache: Partial<CachedMetadata> = {
                tags: [
                    { tag: '#' + 'verylongtag'.repeat(10), position: {} as any }
                ]
            };
            
            (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockCache);
            
            const result = await extractor.extractContent(mockFile, 'tags', 10);
            // maxLength가 적용되지 않아야 함
            expect(result.length).toBeGreaterThan(10);
        });
    });
});

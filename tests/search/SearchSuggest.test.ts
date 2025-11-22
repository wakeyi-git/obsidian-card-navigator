import { SearchSuggest } from '../../src/search/SearchSuggest';
import { App, TFolder, TFile, CachedMetadata } from 'obsidian';

describe('SearchSuggest', () => {
    let searchSuggest: SearchSuggest;
    let mockApp: App;
    let mockInputEl: HTMLInputElement;
    let mockFiles: TFile[];
    let mockFolders: TFolder[];
    
    beforeEach(() => {
        // Create mock input element
        mockInputEl = document.createElement('input');
        mockInputEl.type = 'text';
        document.body.appendChild(mockInputEl);
        
        // Create mock files
        mockFiles = [
            {
                path: 'test1.md',
                basename: 'test1',
                name: 'test1.md',
                extension: 'md'
            },
            {
                path: 'folder/test2.md',
                basename: 'test2',
                name: 'test2.md',
                extension: 'md'
            },
            {
                path: 'notes/example.md',
                basename: 'example',
                name: 'example.md',
                extension: 'md'
            }
        ] as TFile[];
        
        // Create mock folders
        mockFolders = [
            { 
                path: 'folder', 
                name: 'folder', 
                children: [],
                parent: null,
                vault: null,
                isRoot: () => false
            },
            { 
                path: 'notes', 
                name: 'notes', 
                children: [],
                parent: null,
                vault: null,
                isRoot: () => false
            },
            { 
                path: 'archive', 
                name: 'archive', 
                children: [],
                parent: null,
                vault: null,
                isRoot: () => false
            }
        ] as unknown as TFolder[];
        
        // Mock TFolder constructor for instanceof check
        Object.setPrototypeOf(mockFolders[0], TFolder.prototype);
        Object.setPrototypeOf(mockFolders[1], TFolder.prototype);
        Object.setPrototypeOf(mockFolders[2], TFolder.prototype);
        
        // Mock metadata cache
        const mockMetadataCache = {
            getFileCache: jest.fn((file: TFile) => {
                if (file.basename === 'test1') {
                    return {
                        tags: [
                            { 
                                tag: '#important',
                                position: {
                                    start: { line: 0, col: 0, offset: 0 },
                                    end: { line: 0, col: 10, offset: 10 }
                                }
                            },
                            { 
                                tag: '#project',
                                position: {
                                    start: { line: 0, col: 11, offset: 11 },
                                    end: { line: 0, col: 19, offset: 19 }
                                }
                            }
                        ],
                        frontmatter: {
                            tags: ['work', 'personal'],
                            status: 'active',
                            position: {
                                start: { line: 0, col: 0, offset: 0 },
                                end: { line: 3, col: 0, offset: 50 }
                            }
                        }
                    } as CachedMetadata;
                }
                
                if (file.basename === 'test2') {
                    return {
                        tags: [{ 
                            tag: '#archived',
                            position: {
                                start: { line: 0, col: 0, offset: 0 },
                                end: { line: 0, col: 9, offset: 9 }
                            }
                        }],
                        frontmatter: {
                            tags: 'todo',
                            priority: 'high'
                        }
                    } as CachedMetadata;
                }
                
                return null;
            })
        };
        
        // Mock App
        mockApp = {
            vault: {
                getMarkdownFiles: jest.fn().mockReturnValue(mockFiles),
                getAllLoadedFiles: jest.fn().mockReturnValue([...mockFiles, ...mockFolders])
            },
            metadataCache: mockMetadataCache
        } as any;
        
        searchSuggest = new SearchSuggest(mockApp, mockInputEl);
    });
    
    afterEach(() => {
        document.body.removeChild(mockInputEl);
    });
    
    describe('Initialization', () => {
        it('should create search suggest instance', () => {
            expect(searchSuggest).toBeDefined();
        });
        
        it('should have input element reference', () => {
            expect((searchSuggest as any).inputEl).toBe(mockInputEl);
        });
    });
    
    describe('Query Parsing', () => {
        it('should parse query with no spaces', () => {
            mockInputEl.value = 'test';
            mockInputEl.selectionStart = 4;
            
            const parsed = (searchSuggest as any).parseQuery('test');
            
            expect(parsed).toEqual({
                prefix: '',
                lastToken: 'test',
                cursorPos: 4
            });
        });
        
        it('should parse query with spaces', () => {
            mockInputEl.value = 'path:folder tag:';
            mockInputEl.selectionStart = 16;
            
            const parsed = (searchSuggest as any).parseQuery('path:folder tag:');
            
            expect(parsed).toEqual({
                prefix: 'path:folder ',
                lastToken: 'tag:',
                cursorPos: 16
            });
        });
        
        it('should parse query with cursor in middle', () => {
            mockInputEl.value = 'path:folder tag:test';
            mockInputEl.selectionStart = 11;
            
            const parsed = (searchSuggest as any).parseQuery('path:folder tag:test');
            
            expect(parsed.prefix).toBe('');
            expect(parsed.lastToken).toBe('path:folder');
            expect(parsed.cursorPos).toBe(11);
        });
    });
    
    describe('General Suggestions', () => {
        it('should return search operators for empty query', () => {
            const suggestions = searchSuggest.getSuggestions('');
            
            expect(suggestions).toHaveLength(8);
            expect(suggestions[0]).toHaveProperty('operator', 'path:');
            expect(suggestions[1]).toHaveProperty('operator', 'file:');
        });
        
        it('should return search operators for whitespace query', () => {
            mockInputEl.value = 'path:folder ';
            mockInputEl.selectionStart = 12;
            
            const suggestions = searchSuggest.getSuggestions('path:folder ');
            
            expect(suggestions.length).toBeGreaterThan(0);
            // Should still show operators
        });
        
        it('should return empty for very short general query', () => {
            const suggestions = (searchSuggest as any).getGeneralSuggestions('a');
            
            expect(suggestions).toEqual([]);
        });
        
        it('should return file and tag suggestions for general query', () => {
            const suggestions = (searchSuggest as any).getGeneralSuggestions('test');
            
            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions).toContain('test1');
            expect(suggestions).toContain('test2');
        });
    });
    
    describe('Path Suggestions', () => {
        it('should return folder suggestions for path: operator', () => {
            const suggestions = searchSuggest.getSuggestions('path:');
            
            expect(suggestions).toContain('path:folder');
            expect(suggestions).toContain('path:notes');
            expect(suggestions).toContain('path:archive');
        });
        
        it('should filter folder suggestions by search term', () => {
            const suggestions = searchSuggest.getSuggestions('path:fold');
            
            expect(suggestions).toContain('path:folder');
            expect(suggestions).not.toContain('path:notes');
        });
        
        it('should limit folder suggestions to 5', () => {
            // Add more folders
            const manyFolders = Array.from({ length: 10 }, (_, i) => ({
                path: `folder${i}`,
                name: `folder${i}`
            })) as TFolder[];
            
            (mockApp.vault.getAllLoadedFiles as jest.Mock).mockReturnValue([
                ...mockFiles,
                ...manyFolders
            ]);
            
            const suggestions = searchSuggest.getSuggestions('path:');
            
            expect(suggestions.length).toBeLessThanOrEqual(5);
        });
    });
    
    describe('File Suggestions', () => {
        it('should return file suggestions for file: operator', () => {
            const suggestions = searchSuggest.getSuggestions('file:');
            
            expect(suggestions).toContain('file:test1');
            expect(suggestions).toContain('file:test2');
            expect(suggestions).toContain('file:example');
        });
        
        it('should filter file suggestions by search term', () => {
            const suggestions = searchSuggest.getSuggestions('file:exam');
            
            expect(suggestions).toContain('file:example');
            expect(suggestions).not.toContain('file:test1');
        });
        
        it('should limit file suggestions to 5', () => {
            const manyFiles = Array.from({ length: 10 }, (_, i) => ({
                path: `test${i}.md`,
                basename: `test${i}`,
                name: `test${i}.md`,
                extension: 'md'
            })) as TFile[];
            
            (mockApp.vault.getMarkdownFiles as jest.Mock).mockReturnValue(manyFiles);
            
            const suggestions = searchSuggest.getSuggestions('file:');
            
            expect(suggestions.length).toBeLessThanOrEqual(5);
        });
    });
    
    describe('Tag Collection and Normalization', () => {
        it('should collect tags from inline and frontmatter', () => {
            const allTags = (searchSuggest as any).collectAllTags();
            
            expect(allTags).toContain('important');
            expect(allTags).toContain('project');
            expect(allTags).toContain('work');
            expect(allTags).toContain('personal');
            expect(allTags).toContain('archived');
            expect(allTags).toContain('todo');
        });
        
        it('should cache tags after first collection', () => {
            const firstCall = (searchSuggest as any).collectAllTags();
            const secondCall = (searchSuggest as any).collectAllTags();
            
            expect(firstCall).toBe(secondCall); // Same reference
            expect(mockApp.vault.getMarkdownFiles).toHaveBeenCalledTimes(1);
        });
        
        it('should invalidate tags cache', () => {
            // Collect tags once
            (searchSuggest as any).collectAllTags();
            
            // Invalidate cache
            searchSuggest.invalidateTagsCache();
            
            // Collect again
            (searchSuggest as any).collectAllTags();
            
            // Should have called getMarkdownFiles twice
            expect(mockApp.vault.getMarkdownFiles).toHaveBeenCalledTimes(2);
        });
        
        it('should normalize tags correctly', () => {
            const normalize = (searchSuggest as any).normalizeTag.bind(searchSuggest);
            
            expect(normalize('#example')).toBe('example');
            expect(normalize('example')).toBe('example');
            expect(normalize('  #tag  ')).toBe('tag');
            expect(normalize('')).toBe(null);
            expect(normalize('   ')).toBe(null);
            expect(normalize(123)).toBe(null);
            expect(normalize(null)).toBe(null);
            expect(normalize(undefined)).toBe(null);
        });
        
        it('should handle files without cache', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
            
            expect(() => {
                (searchSuggest as any).collectAllTags();
            }).not.toThrow();
        });
        
        it('should handle files without tags', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                frontmatter: {}
            });
            
            expect(() => {
                (searchSuggest as any).collectAllTags();
            }).not.toThrow();
        });
        
        it('should handle array of tags in frontmatter', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                frontmatter: {
                    tags: ['tag1', 'tag2', 'tag3']
                }
            });
            
            const allTags = (searchSuggest as any).collectAllTags();
            
            expect(allTags).toContain('tag1');
            expect(allTags).toContain('tag2');
            expect(allTags).toContain('tag3');
        });
        
        it('should handle single tag string in frontmatter', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                frontmatter: {
                    tags: 'single-tag'
                }
            });
            
            const allTags = (searchSuggest as any).collectAllTags();
            
            expect(allTags).toContain('single-tag');
        });
        
        it('should handle invalid tags in frontmatter', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                frontmatter: {
                    tags: [123, null, '', '  ', 'valid-tag']
                }
            });
            
            const allTags = (searchSuggest as any).collectAllTags();
            
            expect(allTags).toContain('valid-tag');
            expect(allTags).not.toContain('123');
        });
    });
    
    describe('Tag Suggestions', () => {
        it('should return tag suggestions for tag: operator', () => {
            const suggestions = searchSuggest.getSuggestions('tag:');
            
            expect(suggestions.length).toBeGreaterThan(0);
            suggestions.forEach((s: string) => {
                expect(s).toMatch(/^tag:#/);
            });
        });
        
        it('should handle tag: with # prefix', () => {
            const suggestions = searchSuggest.getSuggestions('tag:#');
            
            expect(suggestions.length).toBeGreaterThan(0);
        });
        
        it('should filter tag suggestions by search term', () => {
            const suggestions = searchSuggest.getSuggestions('tag:import');
            
            expect(suggestions).toContain('tag:#important');
        });
        
        it('should limit tag suggestions to 5', () => {
            // Create many tags
            const manyTagsCache = {
                tags: Array.from({ length: 10 }, (_, i) => ({
                    tag: `#tag${i}`,
                    position: {
                        start: { line: 0, col: i * 10, offset: i * 10 },
                        end: { line: 0, col: i * 10 + 5, offset: i * 10 + 5 }
                    }
                }))
            };
            
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(manyTagsCache);
            
            // Invalidate cache to force re-collection
            searchSuggest.invalidateTagsCache();
            
            const suggestions = searchSuggest.getSuggestions('tag:');
            
            expect(suggestions.length).toBeLessThanOrEqual(5);
        });
    });
    
    describe('Property Suggestions', () => {
        it('should return property suggestions for [ operator', () => {
            const suggestions = searchSuggest.getSuggestions('[');
            
            expect(suggestions).toContain('[status]:');
            expect(suggestions).toContain('[priority]:');
        });
        
        it('should filter property suggestions by search term', () => {
            const suggestions = searchSuggest.getSuggestions('[sta');
            
            expect(suggestions).toContain('[status]:');
            expect(suggestions).not.toContain('[priority]:');
        });
        
        it('should exclude position property', () => {
            const suggestions = searchSuggest.getSuggestions('[');
            
            suggestions.forEach((s: string) => {
                expect(s).not.toContain('position');
            });
        });
        
        it('should handle nested queries with properties', () => {
            // Set up input element with the full query
            mockInputEl.value = 'file:test [';
            mockInputEl.selectionStart = 11; // End of 'file:test ['
            
            const suggestions = searchSuggest.getSuggestions('file:test [');
            
            // When lastToken is just '[', it might return operators if no properties found
            // or property suggestions if properties exist
            expect(suggestions.length).toBeGreaterThan(0);
            
            // Check if suggestions are property format or operators
            suggestions.forEach((s: any) => {
                if (typeof s === 'string') {
                    // Should be property suggestion format: '[property]:'
                    expect(s).toMatch(/^\[.*\]:$/);
                } else {
                    // Or could be operators if no properties found
                    expect(s).toHaveProperty('operator');
                }
            });
        });
        
        it('should limit property suggestions to 5', () => {
            const manyPropsCache = {
                frontmatter: Object.fromEntries(
                    Array.from({ length: 10 }, (_, i) => [`prop${i}`, `value${i}`])
                )
            };
            
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(manyPropsCache);
            
            const suggestions = searchSuggest.getSuggestions('[');
            
            expect(suggestions.length).toBeLessThanOrEqual(5);
        });
        
        it('should handle empty property search', () => {
            const suggestions = (searchSuggest as any).getPropertySuggestions('[abc');
            
            expect(suggestions).toBeDefined();
        });
        
        it('should handle invalid property query', () => {
            const suggestions = (searchSuggest as any).getPropertySuggestions('invalid');
            
            expect(suggestions).toEqual([]);
        });
    });
    
    describe('Suggestion Rendering', () => {
        it('should render operator suggestion', () => {
            const mockEl = document.createElement('div');
            const operator = { operator: 'path:', description: 'test description' };
            
            searchSuggest.renderSuggestion(operator, mockEl);
            
            // The container is created with multiple classes
            const containerEl = mockEl.querySelector('.search-suggestion-item');
            const operatorEl = mockEl.querySelector('.search-operator');
            const descEl = mockEl.querySelector('.search-operator-description');
            
            expect(containerEl).toBeTruthy();
            expect(operatorEl).toBeTruthy();
            expect(operatorEl?.textContent).toBe('path:');
            expect(descEl?.textContent).toBe('test description');
            
            // Verify the container has the correct classes
            expect(containerEl?.classList.contains('search-suggestion-item')).toBe(true);
        });
        
        it('should render string suggestion', () => {
            const mockEl = document.createElement('div');
            
            searchSuggest.renderSuggestion('test suggestion', mockEl);
            
            const suggestionEl = mockEl.querySelector('.search-suggestion-item');
            
            expect(suggestionEl).toBeTruthy();
            expect(suggestionEl?.textContent).toBe('test suggestion');
        });
    });
    
    describe('Suggestion Selection', () => {
        it('should replace last token on operator selection', () => {
            mockInputEl.value = 'test ';
            mockInputEl.selectionStart = 5;
            
            const operator = { operator: 'path:', description: 'test' };
            searchSuggest.selectSuggestion(operator);
            
            expect(mockInputEl.value).toBe('test path:');
        });
        
        it('should add space after non-operator selection', () => {
            mockInputEl.value = '';
            mockInputEl.selectionStart = 0;
            
            searchSuggest.selectSuggestion('test');
            
            expect(mockInputEl.value).toBe('test ');
        });
        
        it('should handle selection with nested queries', () => {
            mockInputEl.value = 'path:folder file:';
            mockInputEl.selectionStart = 17;
            
            searchSuggest.selectSuggestion('file:test');
            
            expect(mockInputEl.value).toBe('path:folder file:test ');
        });
        
        it('should trigger input event after selection', () => {
            const inputSpy = jest.fn();
            mockInputEl.addEventListener('input', inputSpy);
            
            mockInputEl.value = '';
            mockInputEl.selectionStart = 0;
            
            searchSuggest.selectSuggestion('test');
            
            expect(inputSpy).toHaveBeenCalled();
        });
        
        it('should set cursor position after selection', () => {
            mockInputEl.value = '';
            mockInputEl.selectionStart = 0;
            
            searchSuggest.selectSuggestion('test');
            
            expect(mockInputEl.selectionStart).toBe(5); // 'test '.length
        });
        
        it('should handle null input element gracefully', () => {
            (searchSuggest as any).inputEl = null;
            
            expect(() => {
                searchSuggest.selectSuggestion('test');
            }).not.toThrow();
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle empty file list', () => {
            (mockApp.vault.getMarkdownFiles as jest.Mock).mockReturnValue([]);
            
            expect(() => {
                searchSuggest.getSuggestions('file:');
            }).not.toThrow();
        });
        
        it('should handle empty folder list', () => {
            (mockApp.vault.getAllLoadedFiles as jest.Mock).mockReturnValue([]);
            
            expect(() => {
                searchSuggest.getSuggestions('path:');
            }).not.toThrow();
        });
        
        it('should handle malformed tag in cache', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                tags: [
                    { 
                        tag: null,
                        position: {
                            start: { line: 0, col: 0, offset: 0 },
                            end: { line: 0, col: 0, offset: 0 }
                        }
                    },
                    { 
                        tag: '',
                        position: {
                            start: { line: 0, col: 0, offset: 0 },
                            end: { line: 0, col: 0, offset: 0 }
                        }
                    },
                    { 
                        tag: '   ',
                        position: {
                            start: { line: 0, col: 0, offset: 0 },
                            end: { line: 0, col: 3, offset: 3 }
                        }
                    },
                    { 
                        tag: '#valid',
                        position: {
                            start: { line: 0, col: 0, offset: 0 },
                            end: { line: 0, col: 6, offset: 6 }
                        }
                    }
                ]
            });
            
            searchSuggest.invalidateTagsCache();
            const allTags = (searchSuggest as any).collectAllTags();
            
            expect(allTags).toContain('valid');
            expect(allTags.size).toBe(1);
        });
        
        it('should handle unicode in queries', () => {
            expect(() => {
                searchSuggest.getSuggestions('file:한글');
            }).not.toThrow();
        });
        
        it('should handle very long queries', () => {
            const longQuery = 'a'.repeat(1000);
            
            expect(() => {
                searchSuggest.getSuggestions(longQuery);
            }).not.toThrow();
        });
        
        it('should handle special characters in queries', () => {
            expect(() => {
                searchSuggest.getSuggestions('file:test@#$%');
            }).not.toThrow();
        });
    });
});

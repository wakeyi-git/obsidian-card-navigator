/**
 * SearchEngine 고급 기능 테스트
 *
 * Boolean 연산자, Task 검색, Block 검색, Wildcard 등 새로 추가된 기능을 테스트합니다.
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
        read: jest.fn(),
        getAbstractFileByPath: jest.fn()
    },
    metadataCache: {
        getFileCache: jest.fn(),
        getBacklinksForFile: jest.fn()
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

describe('SearchEngine - Enhanced Features', () => {
    let searchEngine: SearchEngine;
    let files: TFile[];

    beforeEach(() => {
        vaultEventHandlers = {};
        searchEngine = new SearchEngine(mockApp, mockLogger, () => ({ enableFuzzySearch: false, fuzzySearchThreshold: 0.3 } as any));
        jest.clearAllMocks();

        files = [
            createMockFile('project-2024', Date.parse('2024-01-01'), Date.parse('2024-01-15'), 'Projects/project-2024.md'),
            createMockFile('note-01', Date.parse('2024-02-01'), Date.parse('2024-02-15'), 'Notes/note-01.md'),
            createMockFile('note-02', Date.parse('2024-03-01'), Date.parse('2024-03-15'), 'Notes/note-02.md'),
            createMockFile('archive', Date.parse('2024-04-01'), Date.parse('2024-04-15'), 'Archive/archive.md')
        ];
    });

    describe('Boolean Operators', () => {
        it('should support OR operator', async () => {
            // Mock metadataCache for tags
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'project-2024') {
                    return { tags: [{ tag: '#work' }] } as CachedMetadata;
                }
                if (file.basename === 'note-01') {
                    return { tags: [{ tag: '#personal' }] } as CachedMetadata;
                }
                return null;
            });

            const results = await searchEngine.search('tag:#work OR tag:#personal', files);

            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['note-01', 'project-2024']);
        });

        it('should support NOT operator', async () => {
            const results = await searchEngine.search('path:Notes -file:note-02', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });

        it('should support parentheses grouping', async () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'project-2024') {
                    return { tags: [{ tag: '#work' }] } as CachedMetadata;
                }
                if (file.basename === 'note-01') {
                    return { tags: [{ tag: '#personal' }] } as CachedMetadata;
                }
                return null;
            });

            const results = await searchEngine.search('(tag:#work OR tag:#personal) path:Notes', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });

        it('should handle complex boolean query', async () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'project-2024') {
                    return { tags: [{ tag: '#work' }] } as CachedMetadata;
                }
                if (file.basename === 'archive') {
                    return { tags: [{ tag: '#archived' }] } as CachedMetadata;
                }
                return null;
            });

            const results = await searchEngine.search('(path:Projects OR path:Notes) -tag:#archived', files);

            expect(results.length).toBe(3);
            expect(results.map(f => f.basename).sort()).toEqual(['note-01', 'note-02', 'project-2024']);
        });
    });

    describe('Task Search', () => {
        it('should find files with any tasks', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('# Todo\n- [ ] Buy milk\n- [x] Done task');
                }
                if (file.basename === 'note-02') {
                    return Promise.resolve('# Notes\n- [ ] Important task');
                }
                return Promise.resolve('No tasks here');
            });

            const results = await searchEngine.search('task:', files);

            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['note-01', 'note-02']);
        });

        it('should find files with uncompleted tasks', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('- [ ] Buy milk\n- [x] Done task');
                }
                if (file.basename === 'note-02') {
                    return Promise.resolve('- [x] All done');
                }
                return Promise.resolve('No tasks');
            });

            const results = await searchEngine.search('task-todo:', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });

        it('should find files with completed tasks', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('- [ ] Buy milk');
                }
                if (file.basename === 'note-02') {
                    return Promise.resolve('- [x] Done task');
                }
                return Promise.resolve('No tasks');
            });

            const results = await searchEngine.search('task-done:', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-02');
        });

        it('should search task content', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('- [ ] Buy milk\n- [ ] Buy bread');
                }
                if (file.basename === 'note-02') {
                    return Promise.resolve('- [ ] Write report');
                }
                return Promise.resolve('No tasks');
            });

            const results = await searchEngine.search('task:Buy', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });
    });

    describe('Block Search', () => {
        it('should find files with matching block content', async () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return {
                        blocks: {
                            'block1': {
                                id: 'block1',
                                position: {
                                    start: { line: 0, col: 0, offset: 0 },
                                    end: { line: 0, col: 20, offset: 20 }
                                }
                            }
                        }
                    } as CachedMetadata;
                }
                return null;
            });

            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('Important content ^block1\nOther content');
                }
                return Promise.resolve('No blocks');
            });

            const results = await searchEngine.search('block:Important', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });
    });

    describe('Content Search', () => {
        it('should search only in body content (excluding frontmatter)', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('---\ntitle: Test\nkeyword: excluded\n---\n\nBody content with keyword');
                }
                if (file.basename === 'note-02') {
                    return Promise.resolve('---\ntitle: Another\nkeyword: match\n---\n\nNo match here');
                }
                return Promise.resolve('Just text');
            });

            const results = await searchEngine.search('content:keyword', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });
    });

    describe('Wildcard Search', () => {
        it('should support * wildcard in file names', () => {
            const results = searchEngine.searchSync('file:note-*', files);

            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['note-01', 'note-02']);
        });

        it('should support ? wildcard in file names', () => {
            const results = searchEngine.searchSync('file:note-0?', files);

            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['note-01', 'note-02']);
        });

        it('should support * wildcard in paths', () => {
            const results = searchEngine.searchSync('path:*otes', files);

            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['note-01', 'note-02']);
        });

        it('should combine wildcards with other operators', () => {
            const results = searchEngine.searchSync('file:*2024*', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('project-2024');
        });
    });

    describe('Link Search', () => {
        it('should find files that link to target file', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return {
                        links: [
                            { link: 'project-2024' }
                        ]
                    } as CachedMetadata;
                }
                if (file.basename === 'note-02') {
                    return {
                        links: [
                            { link: 'archive' }
                        ]
                    } as CachedMetadata;
                }
                return null;
            });

            const results = searchEngine.searchSync('link:project-2024', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });

        it('should find backlinks (outgoing-link)', () => {
            const targetFile = files[0]; // project-2024

            (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(targetFile);

            // resolvedLinks를 사용하도록 Mock 수정
            (mockApp.metadataCache as any).resolvedLinks = {
                'Notes/note-01.md': {
                    'Projects/project-2024.md': 1
                },
                'Notes/note-02.md': {
                    'Projects/project-2024.md': 1
                },
                'Archive/archive.md': {
                    'other-file.md': 1
                }
            };

            const results = searchEngine.searchSync('outgoing-link:project-2024', files);

            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['note-01', 'note-02']);
        });
    });

    describe('Case Sensitivity Control', () => {
        it('should handle case-insensitive search by default', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('Hello World');
                }
                return Promise.resolve('Other content');
            });

            // 기본적으로 대소문자 무시
            const results = await searchEngine.search('hello', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });

        it('should handle case-sensitive search via parameter', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('Hello World');
                }
                return Promise.resolve('Other content');
            });

            // 세 번째 파라미터로 대소문자 구분 (caseSensitive = true)
            const results = await searchEngine.search('hello', files, true);

            // 대소문자가 안 맞으므로 매칭 안 됨
            expect(results.length).toBe(0);
        });

        it('should find exact case match when case-sensitive', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('Hello World');
                }
                return Promise.resolve('Other content');
            });

            // 대소문자 구분 + 정확한 매칭
            const results = await searchEngine.search('Hello', files, true);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });
    });

    describe('Combined Advanced Queries', () => {
        it('should combine task search with boolean operators', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('- [ ] Buy milk');
                }
                if (file.basename === 'note-02') {
                    return Promise.resolve('- [ ] Write report');
                }
                if (file.basename === 'archive') {
                    return Promise.resolve('- [ ] Archive task');
                }
                return Promise.resolve('No tasks');
            });

            const results = await searchEngine.search('task: path:Notes', files);

            expect(results.length).toBe(2);
            expect(results.map(f => f.basename).sort()).toEqual(['note-01', 'note-02']);
        });

        it('should combine wildcard with NOT operator', () => {
            const results = searchEngine.searchSync('file:note-* -file:note-02', files);

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });

        it('should handle very complex query', async () => {
            (mockApp.vault.read as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'note-01') {
                    return Promise.resolve('- [ ] Important task');
                }
                return Promise.resolve('No tasks');
            });

            const results = await searchEngine.search(
                '(file:note-* OR file:project-*) task: -file:note-02',
                files
            );

            expect(results.length).toBe(1);
            expect(results[0].basename).toBe('note-01');
        });
    });
});

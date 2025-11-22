/**
 * FolderMode 테스트
 * 
 * 테스트 범위:
 * - 폴더 기반 파일 가져오기
 * - 하위 폴더 포함/제외
 * - 경로 필터링
 * - 엣지 케이스 처리
 */

import { FolderMode } from '../../src/modes/FolderMode';
import { App, TFile, TFolder } from 'obsidian';

// Mock 설정
jest.mock('obsidian');

describe('FolderMode', () => {
    let folderMode: FolderMode;
    let mockApp: jest.Mocked<App>;
    let mockView: any;
    let mockSettings: any;
    let mockRoot: TFolder;
    let mockFolder1: TFolder;
    let mockFolder2: TFolder;
    let mockSubfolder: TFolder;
    
    beforeEach(() => {
        // Mock Folders 생성
        mockRoot = createMockFolder('/', []);
        mockFolder1 = createMockFolder('folder1', []);
        mockFolder2 = createMockFolder('folder2', []);
        mockSubfolder = createMockFolder('folder1/subfolder', []);
        
        // Mock Files 생성
        const file1 = createMockFile('folder1/file1.md', mockFolder1);
        const file2 = createMockFile('folder1/file2.md', mockFolder1);
        const file3 = createMockFile('folder1/subfolder/file3.md', mockSubfolder);
        const file4 = createMockFile('folder2/file4.md', mockFolder2);
        const rootFile = createMockFile('root.md', mockRoot);
        
        // 폴더에 파일 추가
        mockFolder1.children = [file1, file2, mockSubfolder];
        mockSubfolder.children = [file3];
        mockFolder2.children = [file4];
        mockRoot.children = [rootFile, mockFolder1, mockFolder2];
        
        // Mock App 생성
        mockApp = {
            vault: {
                getRoot: jest.fn(() => mockRoot),
                getAbstractFileByPath: jest.fn((path: string) => {
                    if (path === 'folder1') return mockFolder1;
                    if (path === 'folder2') return mockFolder2;
                    if (path === 'folder1/subfolder') return mockSubfolder;
                    if (path === '/') return mockRoot;
                    return null;
                }),
                getMarkdownFiles: jest.fn(() => [file1, file2, file3, file4, rootFile])
            },
            workspace: {
                getActiveFile: jest.fn(() => null)
            }
        } as any;
        
        // Mock Settings
        mockSettings = {
            folderMode: {
                specifiedFolder: 'folder1',
                includeSubfolders: false,
                useActiveFolder: false
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
        
        folderMode = new FolderMode(mockApp, mockView);
    });
    
    describe('getFiles - 기본 기능', () => {
        it('should get files from specified folder', () => {
            mockSettings.folderMode.specifiedFolder = 'folder1';
            mockSettings.folderMode.includeSubfolders = false;
            
            const result = folderMode.getFiles();
            
            // folder1의 직접 파일만 (하위 폴더 제외)
            expect(result).toHaveLength(2);
            expect(result[0].path).toBe('folder1/file1.md');
            expect(result[1].path).toBe('folder1/file2.md');
        });
        
        it('should include subfolders when enabled', () => {
            mockSettings.folderMode.specifiedFolder = 'folder1';
            mockSettings.folderMode.includeSubfolders = true;
            
            const result = folderMode.getFiles();
            
            // folder1의 모든 파일 (하위 폴더 포함)
            expect(result).toHaveLength(3);
            expect(result.some(f => f.path === 'folder1/subfolder/file3.md')).toBe(true);
        });
        
        it('should return empty array for non-existent folder', () => {
            mockSettings.folderMode.specifiedFolder = 'nonexistent';
            
            const result = folderMode.getFiles();
            
            expect(result).toHaveLength(0);
        });
        
        it('should handle root folder (\"/\")', () => {
            mockSettings.folderMode.specifiedFolder = '';
            mockSettings.folderMode.useActiveFolder = false;
            mockSettings.folderMode.includeSubfolders = true;
            
            const result = folderMode.getFiles();
            
            // 모든 파일 반환
            expect(result.length).toBeGreaterThan(0);
        });
    });
    
    describe('getFiles - 하위 폴더 처리', () => {
        it('should not include subfolders when disabled', () => {
            mockSettings.folderMode.specifiedFolder = 'folder1';
            mockSettings.folderMode.includeSubfolders = false;
            
            const result = folderMode.getFiles();
            
            // subfolder의 파일은 제외
            expect(result.every(f => !f.path.includes('subfolder'))).toBe(true);
        });
        
        it('should include all nested subfolders when enabled', () => {
            mockSettings.folderMode.specifiedFolder = 'folder1';
            mockSettings.folderMode.includeSubfolders = true;
            
            const result = folderMode.getFiles();
            
            expect(result.some(f => f.path.includes('subfolder'))).toBe(true);
        });
    });
    
    describe('getCurrentFolderPath', () => {
        it('should return specified folder path', () => {
            mockSettings.folderMode.specifiedFolder = 'folder1';
            
            const path = folderMode.getCurrentFolderPath();
            
            expect(path).toBe('folder1');
        });
        
        it('should return root path when no folder specified', () => {
            mockSettings.folderMode.specifiedFolder = '';
            mockSettings.folderMode.useActiveFolder = false;
            
            const path = folderMode.getCurrentFolderPath();
            
            expect(path).toBe('/');
        });
    });
    
    describe('useActiveFolder 모드', () => {
        it('should use active file folder when enabled', () => {
            const activeFile = createMockFile('folder2/active.md', mockFolder2);
            mockApp.workspace.getActiveFile = jest.fn(() => activeFile);
            
            mockSettings.folderMode.useActiveFolder = true;
            mockSettings.folderMode.includeSubfolders = false;
            
            const result = folderMode.getFiles();
            
            // folder2의 파일들
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('folder2/file4.md');
        });
        
        it('should fallback to root when no active file', () => {
            mockApp.workspace.getActiveFile = jest.fn(() => null);
            mockSettings.folderMode.useActiveFolder = true;
            
            const path = folderMode.getCurrentFolderPath();
            
            expect(path).toBe('/');
        });
    });
    
    describe('엣지 케이스', () => {
        it('should handle empty folder', () => {
            const emptyFolder = createMockFolder('empty', []);
            mockApp.vault.getAbstractFileByPath = jest.fn((path: string) => {
                if (path === 'empty') return emptyFolder;
                return null;
            });
            
            mockSettings.folderMode.specifiedFolder = 'empty';
            
            const result = folderMode.getFiles();
            
            expect(result).toHaveLength(0);
        });
    });
});

// Helper functions
function createMockFolder(path: string, children: any[]): TFolder {
    const folder = new TFolder();
    folder.path = path;
    folder.children = children;
    return folder;
}

function createMockFile(path: string, parent: TFolder): TFile {
    const file = new TFile();
    file.path = path;
    file.basename = path.split('/').pop()?.replace('.md', '') || '';
    file.extension = 'md';
    file.parent = parent;
    return file;
}

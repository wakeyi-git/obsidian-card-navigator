/**
 * Toolbar 확장 테스트
 * 
 * 미커버 영역 (35.02% → 70% 목표):
 * - 버튼 클릭 처리
 * - 상태 변경 반영
 * - 툴팁 표시
 * - 모드 전환
 */

import { Toolbar } from '../../src/ui/Toolbar';
import { createMockApp, createMockView, createMockPlugin } from '../helpers/mockFactory';
import { App } from 'obsidian';
import { CardNavigatorView } from '../../src/view';
import CardNavigatorPlugin from '../../src/main';

describe('Toolbar - Extended Tests', () => {
    let toolbar: Toolbar;
    let mockApp: any;
    let mockView: any;
    let mockPlugin: any;
    let container: HTMLElement;
    
    beforeEach(() => {
        mockApp = createMockApp();
        mockView = createMockView();
        mockPlugin = createMockPlugin();
        container = document.createElement('div');
        
        // Mock settings
        mockPlugin.settingsManager.getSettings = jest.fn().mockReturnValue({
            currentMode: 'folder',
            folderMode: {
                useActiveFolder: true,
                specifiedFolder: ''
            },
            tagMode: {
                useActiveFileTags: false,
                specifiedTags: []
            },
            sort: {
                criteria: 'name',
                order: 'asc'
            },
            debug: {
                enabled: false
            }
        });
        
        // Create toolbar with proper arguments
        toolbar = new Toolbar(
            mockApp as App,
            mockView as CardNavigatorView,
            mockPlugin as CardNavigatorPlugin
        );
        
        document.body.appendChild(container);
    });
    
    afterEach(() => {
        document.body.removeChild(container);
    });
    
    describe('툴바 렌더링', () => {
        it('툴바가 렌더링되어야 함', () => {
            toolbar.render(container);
            
            const toolbarEl = container.querySelector('.card-navigator-toolbar');
            expect(toolbarEl).toBeTruthy();
        });
        
        it('모드 표시 영역이 렌더링되어야 함', () => {
            toolbar.render(container);
            
            const modeDisplay = container.querySelector('.toolbar-mode-display');
            expect(modeDisplay).toBeTruthy();
        });
        
        it('아이콘 그룹이 렌더링되어야 함', () => {
            toolbar.render(container);
            
            const iconGroup = container.querySelector('.toolbar-icon-group');
            expect(iconGroup).toBeTruthy();
        });
        
        it('모든 필수 아이콘이 렌더링되어야 함', () => {
            toolbar.render(container);
            
            const icons = container.querySelectorAll('.clickable-icon');
            // 모드 토글, 모드 전환, 정렬, 검색 = 최소 4개
            expect(icons.length).toBeGreaterThanOrEqual(4);
        });
    });
    
    describe('폴더 모드 표시', () => {
        it('폴더 모드일 때 폴더 아이콘이 표시되어야 함', () => {
            mockPlugin.settingsManager.getSettings = jest.fn().mockReturnValue({
                currentMode: 'folder',
                folderMode: {
                    useActiveFolder: false,
                    specifiedFolder: 'TestFolder'
                },
                debug: { enabled: false }
            });

            // Mock the vault method to return a folder
            mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue({
                name: 'TestFolder',
                path: 'TestFolder'
            });

            toolbar.render(container);

            const modeDisplay = container.querySelector('.toolbar-mode-display');
            expect(modeDisplay).toBeTruthy();
            expect(modeDisplay?.textContent).toContain('TestFolder');
        });
        
        it('활성 폴더 모드일 때 현재 폴더가 표시되어야 함', () => {
            const mockFile = {
                parent: {
                    name: 'CurrentFolder'
                }
            };
            
            mockApp.workspace.getActiveFile = jest.fn().mockReturnValue(mockFile);
            
            mockPlugin.settingsManager.getSettings = jest.fn().mockReturnValue({
                currentMode: 'folder',
                folderMode: {
                    useActiveFolder: true,
                    specifiedFolder: ''
                },
                debug: { enabled: false }
            });
            
            toolbar.render(container);
            
            const modeDisplay = container.querySelector('.toolbar-mode-display');
            expect(modeDisplay?.textContent).toContain('CurrentFolder');
        });
    });
    
    describe('태그 모드 표시', () => {
        it('태그 모드일 때 태그 아이콘이 표시되어야 함', () => {
            mockPlugin.settingsManager.getSettings = jest.fn().mockReturnValue({
                currentMode: 'tag',
                tagMode: {
                    useActiveFileTags: false,
                    specifiedTags: ['#test']
                },
                debug: { enabled: false }
            });
            
            toolbar.render(container);
            
            const modeDisplay = container.querySelector('.toolbar-mode-display');
            expect(modeDisplay).toBeTruthy();
        });
        
        it('활성 파일 태그 모드일 때 태그가 표시되어야 함', () => {
            const mockCache = {
                tags: [{ tag: '#tag1' }, { tag: '#tag2' }],
                frontmatter: {}
            };
            
            mockApp.workspace.getActiveFile = jest.fn().mockReturnValue({
                basename: 'test.md'
            });
            
            mockApp.metadataCache.getFileCache = jest.fn().mockReturnValue(mockCache);
            
            mockPlugin.settingsManager.getSettings = jest.fn().mockReturnValue({
                currentMode: 'tag',
                tagMode: {
                    useActiveFileTags: true,
                    specifiedTags: []
                },
                debug: { enabled: false }
            });
            
            toolbar.render(container);
            
            const modeDisplay = container.querySelector('.toolbar-mode-display');
            expect(modeDisplay?.textContent).toContain('#tag1');
        });
    });
    
    describe('모드 토글 아이콘', () => {
        it('모드 토글 아이콘이 업데이트되어야 함', () => {
            toolbar.render(container);
            
            const modeToggleIcon = container.querySelector('.mode-toggle-icon');
            expect(modeToggleIcon).toBeTruthy();
        });
        
        it('활성 모드에 따라 아이콘이 변경되어야 함', () => {
            mockPlugin.settingsManager.getSettings = jest.fn().mockReturnValue({
                currentMode: 'folder',
                folderMode: {
                    useActiveFolder: true,
                    specifiedFolder: ''
                },
                debug: { enabled: false }
            });
            
            toolbar.render(container);
            toolbar.updateModeToggleIcon();
            
            const modeToggleIcon = container.querySelector('.mode-toggle-icon');
            expect(modeToggleIcon).toBeTruthy();
            expect(modeToggleIcon?.classList.contains('mode-active')).toBe(true);
        });
    });
    
    describe('검색 토글', () => {
        it('검색 입력창 컨테이너를 설정할 수 있어야 함', () => {
            const searchContainer = document.createElement('div');
            
            expect(() => {
                toolbar.setSearchInputContainer(searchContainer);
            }).not.toThrow();
        });
        
        it('검색 버튼이 렌더링되어야 함', () => {
            toolbar.render(container);
            
            const searchButton = Array.from(container.querySelectorAll('.clickable-icon'))
                .find(el => el.getAttribute('aria-label')?.includes('Search'));
            
            expect(searchButton).toBeTruthy();
        });
    });
    
    describe('정렬 메뉴', () => {
        it('정렬 버튼이 렌더링되어야 함', () => {
            toolbar.render(container);
            
            const sortButton = Array.from(container.querySelectorAll('.clickable-icon'))
                .find(el => el.getAttribute('aria-label')?.toLowerCase().includes('sort'));
            
            expect(sortButton).toBeTruthy();
        });
    });
    
    describe('모드 전환 버튼', () => {
        it('모드 전환 버튼이 렌더링되어야 함', () => {
            toolbar.render(container);
            
            const switchButton = Array.from(container.querySelectorAll('.clickable-icon'))
                .find(el => el.getAttribute('aria-label')?.includes('Switch mode'));
            
            expect(switchButton).toBeTruthy();
        });
    });
    
    describe('업데이트 메서드', () => {
        it('updateModeDisplay를 호출할 수 있어야 함', () => {
            toolbar.render(container);
            
            expect(() => {
                toolbar.updateModeDisplay();
            }).not.toThrow();
        });
        
        it('updateModeToggleIcon을 호출할 수 있어야 함', () => {
            toolbar.render(container);
            
            expect(() => {
                toolbar.updateModeToggleIcon();
            }).not.toThrow();
        });
    });
    
    describe('정리', () => {
        it('destroy 메서드가 작동해야 함', () => {
            toolbar.render(container);
            
            expect(() => {
                toolbar.destroy();
            }).not.toThrow();
        });
    });
    
    describe('에러 처리', () => {
        it('settings가 없어도 렌더링이 실패하지 않아야 함', () => {
            mockPlugin.settingsManager.getSettings = jest.fn().mockReturnValue(null);
            
            expect(() => {
                toolbar.render(container);
            }).not.toThrow();
        });
        
        it('활성 파일이 없어도 렌더링이 실패하지 않아야 함', () => {
            mockApp.workspace.getActiveFile = jest.fn().mockReturnValue(null);
            
            mockPlugin.settingsManager.getSettings = jest.fn().mockReturnValue({
                currentMode: 'folder',
                folderMode: {
                    useActiveFolder: true,
                    specifiedFolder: ''
                },
                debug: { enabled: false }
            });
            
            expect(() => {
                toolbar.render(container);
            }).not.toThrow();
        });
    });
    
    describe('접근성', () => {
        it('모든 버튼에 aria-label이 있어야 함', () => {
            toolbar.render(container);
            
            const buttons = container.querySelectorAll('.clickable-icon');
            
            buttons.forEach(button => {
                const hasLabel = button.getAttribute('aria-label') !== null;
                expect(hasLabel).toBe(true);
            });
        });
        
        it('모드 표시가 클릭 가능해야 함', () => {
            toolbar.render(container);
            
            const modeDisplay = container.querySelector('.toolbar-mode-display');
            expect(modeDisplay?.classList.contains('clickable')).toBe(true);
        });
    });
});

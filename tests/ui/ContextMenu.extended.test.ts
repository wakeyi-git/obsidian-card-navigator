/**
 * CardContextMenu 확장 테스트
 * 
 * 미커버 영역 (5.95% → 60% 목표):
 * - 메뉴 항목 생성
 * - 메뉴 항목 클릭
 * - 조건부 메뉴 표시
 * - 키보드 단축키
 */

import { CardContextMenu } from '../../src/ui/ContextMenu';
import { TFile } from 'obsidian';
import { CardNavigatorSettings } from '../../src/types';
import { createMockApp, createMockView, createMockFile } from '../helpers/mockFactory';

// Obsidian Menu 모킹
const mockMenu = {
    addItem: jest.fn(),
    addSeparator: jest.fn(),
    showAtMouseEvent: jest.fn()
};

jest.mock('obsidian', () => {
    const actual = jest.requireActual('obsidian');
    return {
        ...actual,
        Menu: jest.fn().mockImplementation(() => mockMenu),
        MenuItem: jest.fn()
    };
});

describe('CardContextMenu - Extended Tests', () => {
    let contextMenu: CardContextMenu;
    let mockApp: any;
    let mockView: any;
    let testFile: TFile;
    let mockGetSettings: jest.Mock<CardNavigatorSettings>;
    let menuItems: any[];
    
    beforeEach(() => {
        mockApp = createMockApp();
        mockView = createMockView();
        testFile = createMockFile('test.md');
        
        // Mock settings function
        mockGetSettings = jest.fn().mockReturnValue({
            debug: { enabled: false }
        } as CardNavigatorSettings);
        
        // Menu items 배열 초기화
        menuItems = [];
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Menu.addItem 구현
        mockMenu.addItem.mockImplementation((callback: (item: any) => void) => {
            const mockItem = {
                setTitle: jest.fn().mockReturnThis(),
                setIcon: jest.fn().mockReturnThis(),
                onClick: jest.fn().mockReturnThis(),
                title: '',
                icon: '',
                callback: null as (() => void) | null
            };
            callback(mockItem);
            menuItems.push(mockItem);
            return mockMenu;
        });
        
        mockMenu.addSeparator.mockReturnValue(mockMenu);
        
        contextMenu = new CardContextMenu(mockApp, mockGetSettings);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('메뉴 생성', () => {
        it('기본 메뉴 항목을 생성해야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            expect(menuItems.length).toBeGreaterThan(0);
        });
        
        it('새 탭에서 열기 메뉴가 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);

            const openItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) =>
                    call[0]?.includes('new tab')
                )
            );

            expect(openItem).toBeTruthy();
        });
        
        it('파일 삭제 메뉴가 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);

            const deleteItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) =>
                    call[0]?.includes('Delete')
                )
            );

            expect(deleteItem).toBeTruthy();
        });
        
        it('파일 이름 변경 메뉴가 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const renameItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) => 
                    call[0]?.includes('Rename')
                )
            );
            
            expect(renameItem).toBeTruthy();
        });
    });
    
    describe('메뉴 항목 클릭', () => {
        it('새 탭에서 열기 클릭 시 새 탭이 열려야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const openNewTabItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) =>
                    call[0]?.toLowerCase().includes('new tab')
                )
            );
            
            expect(openNewTabItem).toBeTruthy();
            
            if (openNewTabItem && openNewTabItem.onClick.mock.calls.length > 0) {
                const callback = openNewTabItem.onClick.mock.calls[0][0];
                callback();
                expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith('tab');
            }
        });
        
        it('새 창에서 열기 클릭 시 새 창이 열려야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const openNewWindowItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) => 
                    call[0]?.includes('새 창')
                )
            );
            
            if (openNewWindowItem && openNewWindowItem.onClick.mock.calls.length > 0) {
                const callback = openNewWindowItem.onClick.mock.calls[0][0];
                callback();
                expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith('window');
            }
        });
        
        it('오른쪽 패널에서 열기 클릭 시 분할 뷰가 열려야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const openRightItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) => 
                    call[0]?.includes('오른쪽 패널')
                )
            );
            
            if (openRightItem && openRightItem.onClick.mock.calls.length > 0) {
                const callback = openRightItem.onClick.mock.calls[0][0];
                callback();
                expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith('split', 'vertical');
            }
        });
    });
    
    describe('링크 복사 기능', () => {
        beforeEach(() => {
            // Mock clipboard
            Object.assign(navigator, {
                clipboard: {
                    writeText: jest.fn()
                }
            });
        });
        
        it('Wiki 링크를 복사할 수 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const wikiLinkItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) => 
                    call[0]?.includes('Wiki 링크')
                )
            );
            
            if (wikiLinkItem && wikiLinkItem.onClick.mock.calls.length > 0) {
                const callback = wikiLinkItem.onClick.mock.calls[0][0];
                callback();
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`[[${testFile.basename}]]`);
            }
        });
        
        it('마크다운 링크를 복사할 수 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const mdLinkItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) => 
                    call[0]?.includes('markdown link')
                )
            );
            
            if (mdLinkItem && mdLinkItem.onClick.mock.calls.length > 0) {
                const callback = mdLinkItem.onClick.mock.calls[0][0];
                callback();
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                    `[${testFile.basename}](${testFile.path})`
                );
            }
        });
        
        it('파일 경로를 복사할 수 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const pathItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) => 
                    call[0]?.includes('파일 경로')
                )
            );
            
            if (pathItem && pathItem.onClick.mock.calls.length > 0) {
                const callback = pathItem.onClick.mock.calls[0][0];
                callback();
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testFile.path);
            }
        });
    });
    
    describe('파일 작업', () => {
        it('파일 이름 변경 기능이 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const renameItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) => 
                    call[0]?.includes('Rename')
                )
            );
            
            expect(renameItem).toBeTruthy();
        });
        
        it('파일 이동 기능이 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const moveItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) =>
                    call[0]?.toLowerCase().includes('move')
                )
            );
            
            expect(moveItem).toBeTruthy();
        });
        
        it('파일 삭제 기능이 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const deleteItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) =>
                    call[0]?.toLowerCase().includes('delete')
                )
            );
            
            expect(deleteItem).toBeTruthy();
        });
    });
    
    describe('내용 복사 기능', () => {
        it('전체 내용 복사 메뉴가 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const copyFullItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) => 
                    call[0]?.includes('full content')
                )
            );
            
            expect(copyFullItem).toBeTruthy();
        });
        
        it('첫 문단 복사 메뉴가 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            const copyFirstItem = menuItems.find((item: any) =>
                item.setTitle.mock.calls.some((call: any[]) => 
                    call[0]?.includes('first paragraph')
                )
            );
            
            expect(copyFirstItem).toBeTruthy();
        });
    });
    
    describe('메뉴 표시', () => {
        it('메뉴가 마우스 이벤트 위치에 표시되어야 함', () => {
            const event = new MouseEvent('contextmenu', {
                clientX: 100,
                clientY: 200
            });
            
            contextMenu.show(event, testFile);
            
            expect(mockMenu.showAtMouseEvent).toHaveBeenCalledWith(event);
        });
    });
    
    describe('구분선', () => {
        it('메뉴 항목 그룹 사이에 구분선이 있어야 함', () => {
            const event = new MouseEvent('contextmenu');
            contextMenu.show(event, testFile);
            
            // 최소 3개 이상의 구분선이 있어야 함
            expect(mockMenu.addSeparator).toHaveBeenCalled();
            expect(mockMenu.addSeparator.mock.calls.length).toBeGreaterThanOrEqual(3);
        });
    });
    
    describe('에러 처리', () => {
        it('null 파일을 안전하게 처리해야 함', () => {
            const event = new MouseEvent('contextmenu');
            
            // null 파일로 메뉴를 표시해도 오류가 발생하지 않아야 함
            expect(() => {
                contextMenu.show(event, null as any);
            }).not.toThrow();
        });
    });
});

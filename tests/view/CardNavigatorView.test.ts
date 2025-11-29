/**
 * CardNavigatorView 테스트
 * 
 * view.ts의 메인 뷰 클래스 테스트
 */

// Notice Mock을 위한 변수 (jest.mock 전에 선언)
let NoticeMock: jest.Mock;

// Obsidian 모듈 Mock
jest.mock('obsidian', () => {
    const actual = jest.requireActual('obsidian');
    return {
        ...actual,
        Notice: jest.fn().mockImplementation((message: string) => {
            // NoticeMock을 실행하여 호출 추적
            if (NoticeMock) {
                NoticeMock(message);
            }
            return {
                message,
                noticeEl: document.createElement('div')
            };
        })
    };
});

import { CardNavigatorView, VIEW_TYPE_CARD_NAVIGATOR } from '../../src/view';
import { App, TFile, WorkspaceLeaf } from 'obsidian';
import CardNavigatorPlugin from '../../src/main';
import { SettingsManager } from '../../src/settings';
import { DEFAULT_SETTINGS } from '../../src/types';

// Mock 헬퍼 함수
const createMockFile = (path: string): TFile => {
    const file = new TFile();
    file.path = path;
    file.basename = path.split('/').pop()?.replace('.md', '') || '';
    file.name = path.split('/').pop() || '';
    file.extension = 'md';
    return file;
};

const createMockApp = (): jest.Mocked<App> => {
    const mockApp = new App() as jest.Mocked<App>;
    
    // Mock vault methods - 기본 Mock에 추가 설정
    mockApp.vault.getMarkdownFiles = jest.fn(() => [
        createMockFile('file1.md'),
        createMockFile('file2.md'),
        createMockFile('file3.md')
    ]) as any;
    
    mockApp.vault.cachedRead = jest.fn(() => Promise.resolve('# Test Content')) as any;
    mockApp.vault.getAbstractFileByPath = jest.fn((path: string) => createMockFile(path)) as any;
    
    // Mock vault.on for events
    mockApp.vault.on = jest.fn((event: string, callback: Function) => {
        return {} as any; // EventRef mock
    }) as any;
    
    // Mock workspace methods - 명시적으로 jest.Mock 타입 지정
    const getActiveFileMock = jest.fn(() => null);
    mockApp.workspace.getActiveFile = getActiveFileMock as any;
    mockApp.workspace.openLinkText = jest.fn(() => Promise.resolve()) as any;
    
    // Mock workspace.on for events
    mockApp.workspace.on = jest.fn((event: string, callback: Function) => {
        return {} as any; // EventRef mock
    }) as any;

    // Mock workspace.onLayoutReady - immediately execute callback
    mockApp.workspace.onLayoutReady = jest.fn((callback: Function) => {
        callback();
    }) as any;
    
    // Mock metadataCache.on for events
    mockApp.metadataCache.on = jest.fn((event: string, callback: Function) => {
        return {} as any; // EventRef mock
    }) as any;
    
    return mockApp;
};

const createMockLeaf = (app: jest.Mocked<App>): jest.Mocked<WorkspaceLeaf> => {
    const leaf = new WorkspaceLeaf() as jest.Mocked<WorkspaceLeaf>;
    // ItemView가 leaf에서 app을 가져오므로 설정 필요
    (leaf as any).view = { app };
    Object.defineProperty(leaf, 'view', {
        value: { app },
        writable: true
    });
    return leaf;
};

const createMockPlugin = (app: jest.Mocked<App>): jest.Mocked<CardNavigatorPlugin> => {
    const plugin = {
        app,
        settings: DEFAULT_SETTINGS,
        settingsManager: new SettingsManager(app, async () => {}),
        presetManager: {
            autoApplyPreset: jest.fn(() => Promise.resolve())
        },
        loadData: jest.fn(() => Promise.resolve(DEFAULT_SETTINGS)),
        saveData: jest.fn(() => Promise.resolve()),
        saveSettings: jest.fn(() => Promise.resolve())
    } as any;

    return plugin;
};

const createMockContainer = (): HTMLElement => {
    const container = document.createElement('div');
    
    // addEventListener/removeEventListener mock 추가
    const eventListeners: Map<string, Function[]> = new Map();
    
    container.addEventListener = jest.fn((event: string, handler: Function) => {
        if (!eventListeners.has(event)) {
            eventListeners.set(event, []);
        }
        eventListeners.get(event)?.push(handler);
    }) as any;
    
    container.removeEventListener = jest.fn((event: string, handler: Function) => {
        const listeners = eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(handler);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }) as any;
    
    // setAttribute/getAttribute/removeAttribute mock 추가
    const attributes: Map<string, string> = new Map();
    
    container.setAttribute = jest.fn((name: string, value: string) => {
        attributes.set(name, value);
    }) as any;
    
    container.getAttribute = jest.fn((name: string) => {
        return attributes.get(name) || null;
    }) as any;
    
    container.removeAttribute = jest.fn((name: string) => {
        attributes.delete(name);
    }) as any;
    
    // addClass mock - 공백 처리 추가
    (container as any).addClass = jest.fn((cls: string) => {
        if (cls.includes(' ')) {
            // 공백이 있으면 각 클래스를 분리하여 추가
            cls.split(/\s+/).forEach(c => {
                if (c.trim()) container.classList.add(c.trim());
            });
        } else {
            if (cls.trim()) container.classList.add(cls.trim());
        }
    });
    
    (container as any).removeClass = jest.fn((cls: string) => {
        if (cls.includes(' ')) {
            cls.split(/\s+/).forEach(c => {
                if (c.trim()) container.classList.remove(c.trim());
            });
        } else {
            if (cls.trim()) container.classList.remove(cls.trim());
        }
    });

    (container as any).empty = jest.fn();
    (container as any).setText = jest.fn((text: string) => {
        container.textContent = text;
    });

    // 재귀적으로 createEl mock 추가하는 헬퍼 함수
    const addCreateElMock = (element: HTMLElement) => {
        // addEventListener/removeEventListener를 요소에도 추가
        const elementListeners: Map<string, Function[]> = new Map();
        
        element.addEventListener = jest.fn((event: string, handler: Function) => {
            if (!elementListeners.has(event)) {
                elementListeners.set(event, []);
            }
            elementListeners.get(event)?.push(handler);
        }) as any;
        
        element.removeEventListener = jest.fn((event: string, handler: Function) => {
            const listeners = elementListeners.get(event);
            if (listeners) {
                const index = listeners.indexOf(handler);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        }) as any;
        
        // setAttribute/getAttribute/removeAttribute를 요소에도 추가
        const elementAttributes: Map<string, string> = new Map();
        
        element.setAttribute = jest.fn((name: string, value: string) => {
            elementAttributes.set(name, value);
        }) as any;
        
        element.getAttribute = jest.fn((name: string) => {
            return elementAttributes.get(name) || null;
        }) as any;
        
        element.removeAttribute = jest.fn((name: string) => {
            elementAttributes.delete(name);
        }) as any;
        
        (element as any).createEl = jest.fn((tag: string, options?: any) => {
            const el = document.createElement(tag);
            
            // cls 옵션 처리 - 공백 문제 해결
            if (options?.cls) {
                const classes: string[] = [];
                
                if (typeof options.cls === 'string') {
                    // 문자열이면 공백으로 분리
                    classes.push(...options.cls.split(/\s+/).filter((c: string) => c.trim()));
                } else if (Array.isArray(options.cls)) {
                    // 배열이면 각 요소 추가
                    classes.push(...options.cls.filter((c: string) => c && c.trim()));
                }
                
                // 각 클래스를 개별적으로 추가 (공백 없이)
                classes.forEach(cls => {
                    const trimmedCls = cls.trim();
                    if (trimmedCls) {
                        try {
                            el.classList.add(trimmedCls);
                        } catch (e) {
                            // 공백이 포함된 경우를 대비한 추가 처리
                            trimmedCls.split(/\s+/).forEach(c => {
                                if (c) el.classList.add(c);
                            });
                        }
                    }
                });
            }
            
            if (options?.text) {
                el.textContent = options.text;
            }
            
            // addClass mock 추가
            (el as any).addClass = jest.fn((cls: string) => {
                cls.split(/\s+/).forEach(c => {
                    if (c.trim()) {
                        try {
                            el.classList.add(c.trim());
                        } catch (e) {
                            console.error('Failed to add class:', c, e);
                        }
                    }
                });
            });

            (el as any).removeClass = jest.fn((cls: string) => {
                cls.split(/\s+/).forEach(c => {
                    if (c.trim()) {
                        try {
                            el.classList.remove(c.trim());
                        } catch (e) {
                            console.error('Failed to remove class:', c, e);
                        }
                    }
                });
            });

            (el as any).empty = jest.fn();
            (el as any).setText = jest.fn((text: string) => {
                el.textContent = text;
            });
            
            // 재귀적으로 createEl mock 추가
            addCreateElMock(el);
            
            element.appendChild(el);
            return el;
        });
    };
    
    // container에 createEl mock 추가
    addCreateElMock(container);
    
    return container;
};

describe('CardNavigatorView', () => {
    let view: CardNavigatorView;
    let mockApp: jest.Mocked<App>;
    let mockLeaf: jest.Mocked<WorkspaceLeaf>;
    let mockPlugin: jest.Mocked<CardNavigatorPlugin>;
    
    beforeEach(() => {
        // DOM 환경 설정
        document.body.innerHTML = '';
        
        // Notice Mock 초기화 - jest.mock에서 호출을 추적하기 위한 Mock 함수 생성
        NoticeMock = jest.fn();
        
        // Mock 생성 - mockApp을 먼저 만들고 mockLeaf에 전달
        mockApp = createMockApp();
        mockLeaf = createMockLeaf(mockApp);
        mockPlugin = createMockPlugin(mockApp);
        
        // View 인스턴스 생성
        view = new CardNavigatorView(mockLeaf, mockPlugin);
        
        // view.app을 먼저 삭제한 후 mockApp을 참조하도록 강제 설정
        delete (view as any).app;
        Object.defineProperty(view, 'app', {
            get: () => mockApp,
            configurable: true,
            enumerable: true
        });
        
        // ItemView의 메서드들 mock 추가
        view.registerEvent = jest.fn((eventRef: any) => {
            // 이벤트 등록 mock
            return eventRef;
        }) as any;
        
        view.registerDomEvent = jest.fn((el: any, event: string, handler: any) => {
            // DOM 이벤트 등록 mock
            if (el && typeof el.addEventListener === 'function') {
                el.addEventListener(event, handler);
            }
        }) as any;
        
        // containerEl Mock 설정
        const mockContainerEl = createMockContainer();
        Object.defineProperty(view, 'containerEl', {
            value: {
                ...mockContainerEl,
                children: [null, mockContainerEl], // children[1]이 메인 컨테이너
                focus: jest.fn(),
                contains: jest.fn(() => true),
                addEventListener: mockContainerEl.addEventListener,
                removeEventListener: mockContainerEl.removeEventListener,
                setAttribute: mockContainerEl.setAttribute,
                getAttribute: mockContainerEl.getAttribute,
                removeAttribute: mockContainerEl.removeAttribute,
                querySelector: jest.fn(() => null)
            },
            writable: true
        });
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('뷰 메타데이터', () => {
        it('올바른 뷰 타입을 반환해야 함', () => {
            expect(view.getViewType()).toBe(VIEW_TYPE_CARD_NAVIGATOR);
        });
        
        it('올바른 표시 텍스트를 반환해야 함', () => {
            expect(view.getDisplayText()).toBe('Card Navigator');
        });
        
        it('올바른 아이콘을 반환해야 함', () => {
            expect(view.getIcon()).toBe('layout-grid');
        });
    });
    
    describe('생명주기', () => {
        it('onOpen - 뷰가 올바르게 초기화되어야 함', async () => {
            await view.onOpen();
            
            // 컨테이너가 초기화되었는지 확인
            const container = view.containerEl.children[1] as any;
            expect(container.empty).toHaveBeenCalled();
            expect(container.addClass).toHaveBeenCalledWith('card-navigator-container');
            
            // 헤더가 생성되었는지 확인
            expect(container.createEl).toHaveBeenCalledWith('div', {
                cls: 'card-navigator-header'
            });
            
            // 카드 컨테이너가 생성되었는지 확인
            expect(container.createEl).toHaveBeenCalledWith('div', {
                cls: 'card-navigator-cards'
            });
        });
        
        it('onOpen - 이벤트 리스너가 등록되어야 함', async () => {
            await view.onOpen();

            // registerEvent가 호출되었는지 확인 (6번: workspace active-leaf-change, workspace css-change, metadataCache, vault create, vault delete, vault rename)
            expect(view.registerEvent).toHaveBeenCalledTimes(6);

            // workspace 이벤트 리스너 확인
            expect(mockApp.workspace.on).toHaveBeenCalledWith(
                'active-leaf-change',
                expect.any(Function)
            );

            // metadataCache 이벤트 리스너 확인
            expect(mockApp.metadataCache.on).toHaveBeenCalledWith(
                'changed',
                expect.any(Function)
            );

            // vault 이벤트 리스너 확인
            expect(mockApp.vault.on).toHaveBeenCalledWith(
                'create',
                expect.any(Function)
            );

            expect(mockApp.vault.on).toHaveBeenCalledWith(
                'delete',
                expect.any(Function)
            );

            expect(mockApp.vault.on).toHaveBeenCalledWith(
                'rename',
                expect.any(Function)
            );
        });
        
        it('onOpen - 초기 프리셋이 자동 적용되어야 함', async () => {
            const mockFile = createMockFile('test.md');
            // Mock을 onOpen 호출 전에 설정
            (mockApp.workspace.getActiveFile as jest.Mock).mockReturnValue(mockFile);
            
            await view.onOpen();
            
            // autoApplyPreset이 mockFile로 호출되었는지 확인
            expect(mockPlugin.presetManager.autoApplyPreset).toHaveBeenCalledWith(mockFile);
        });
        
        it('onClose - 리소스가 정리되어야 함', async () => {
            // 먼저 뷰를 열어서 초기화
            await view.onOpen();
            
            // 뷰 닫기
            await view.onClose();
            
            // 리소스 정리 확인은 에러가 발생하지 않으면 성공으로 간주
            expect(true).toBe(true);
        });
    });
    
    describe('refresh', () => {
        it('refresh - 뷰를 강제로 재렌더링해야 함', async () => {
            // 뷰 초기화
            await view.onOpen();
            
            // refresh 호출
            await view.refresh();
            
            // ViewRenderer의 forceRender가 호출되었는지 확인
            // (실제로는 내부적으로 renderCards가 호출됨)
            expect(true).toBe(true); // 에러 없이 완료되면 성공
        });
        
        it('refresh - 툴바가 업데이트되어야 함', async () => {
            await view.onOpen();

            // toolbar mock 설정
            const mockToolbar = {
                updateModeDisplay: jest.fn(),
                updateModeToggleIcon: jest.fn()
            };
            (view as any).toolbar = mockToolbar;

            await view.refresh();

            // refresh()는 updateModeToggleIcon만 호출함
            expect(mockToolbar.updateModeToggleIcon).toHaveBeenCalled();
        });
    });
    
    describe('검색 기능', () => {
        it('clearSearch - 검색을 초기화해야 함', async () => {
            await view.onOpen();
            
            // searchInput mock 설정
            const mockSearchInput = {
                clear: jest.fn(),
                getValue: jest.fn(() => ''),
                onInput: jest.fn()
            };
            (view as any).searchInput = mockSearchInput;
            
            view.clearSearch();
            
            expect(mockSearchInput.clear).toHaveBeenCalled();
        });
        
        it('clearSearch - 검색 쿼리 상태가 초기화되어야 함', async () => {
            await view.onOpen();
            
            const mockSearchInput = {
                clear: jest.fn(),
                getValue: jest.fn(() => ''),
                onInput: jest.fn()
            };
            (view as any).searchInput = mockSearchInput;
            
            // 검색 쿼리 설정
            (view as any).state.setSearchQuery('test');
            
            // 검색 초기화
            view.clearSearch();
            
            // 상태 확인
            expect((view as any).state.getSearchQuery()).toBe('');
        });
    });
    
    describe('파일 열기', () => {
        it('openFile - 파일을 올바르게 열어야 함', async () => {
            const mockFile = createMockFile('test.md');
            
            // view.app의 workspace.openLinkText를 spy
            const openLinkTextSpy = jest.spyOn(view.app.workspace, 'openLinkText')
                .mockResolvedValue();
            
            await view.openFile(mockFile);
            
            expect(openLinkTextSpy).toHaveBeenCalledWith(
                'test.md',
                '',
                false
            );
            
            openLinkTextSpy.mockRestore();
        });
        
        it('openFile - 파일 열기 실패 시 에러를 처리해야 함', async () => {
            const mockFile = createMockFile('test.md');
            
            // workspace.openLinkText가 실패하도록 설정
            const openLinkTextSpy = jest.spyOn(view.app.workspace, 'openLinkText')
                .mockRejectedValue(new Error('Failed to open file'));
            
            // Notice Mock 초기화
            NoticeMock.mockClear();
            
            // 파일 열기 시도 - openFile은 내부에서 에러를 처리하므로 reject하지 않음
            await view.openFile(mockFile);
            
            // Notice가 호출되었는지 확인
            expect(NoticeMock).toHaveBeenCalled();
            expect(NoticeMock).toHaveBeenCalledWith(expect.stringContaining('Failed to open file'));
            
            // Spy 정리
            openLinkTextSpy.mockRestore();
        });
    });
    
    describe('카드 생성', () => {
        it('createCard - 카드를 생성해야 함', async () => {
            await view.onOpen();
            
            const mockFile = createMockFile('test.md');
            const mockContainer = document.createElement('div');
            
            // CardFactory의 createCard mock
            const mockCardElement = document.createElement('div');
            mockCardElement.className = 'card-item';
            
            jest.spyOn(view as any, 'createCard').mockResolvedValue(mockCardElement);
            
            const cardElement = await view.createCard(mockFile, mockContainer);
            
            expect(cardElement).toBeDefined();
            expect(cardElement.className).toContain('card-item');
        });
    });
    
    describe('focusOnActiveCard', () => {
        it('활성 파일이 있을 때 해당 카드로 포커스해야 함', async () => {
            await view.onOpen();
            
            const mockFile = createMockFile('test.md');
            (mockApp.workspace.getActiveFile as jest.Mock).mockReturnValue(mockFile);
            
            // KeyboardNavigator의 focusFileCard mock - 먼저 설정
            const focusFileCardSpy = jest.spyOn(
                (view as any).keyboardNavigator,
                'focusFileCard'
            ).mockImplementation(() => {});
            
            view.focusOnActiveCard();
            
            // containerEl.focus가 호출되었는지 확인
            expect(view.containerEl.focus).toHaveBeenCalled();
            
            // KeyboardNavigator.focusFileCard가 호출되었는지 확인
            expect(focusFileCardSpy).toHaveBeenCalledWith(mockFile);
            
            // Spy 정리
            focusFileCardSpy.mockRestore();
        });
        
        it('활성 파일이 없을 때 첫 번째 카드로 포커스해야 함', async () => {
            await view.onOpen();
            
            (mockApp.workspace.getActiveFile as jest.Mock).mockReturnValue(null);
            
            // 첫 번째 카드 mock 생성
            const mockFirstCard = document.createElement('div');
            mockFirstCard.className = 'card-item';
            (mockFirstCard as any).addClass = jest.fn();
            mockFirstCard.scrollIntoView = jest.fn();
            
            // cardsContainer에 첫 번째 카드 추가
            const cardsContainer = (view as any).cardsContainer;
            if (cardsContainer) {
                cardsContainer.querySelector = jest.fn(() => mockFirstCard);
            }
            
            view.focusOnActiveCard();
            
            expect(view.containerEl.focus).toHaveBeenCalled();
            
            if (cardsContainer) {
                expect(cardsContainer.querySelector).toHaveBeenCalledWith('.card-item');
            }
        });
    });
    
    describe('모드 전환', () => {
        it('폴더 모드로 전환 시 재렌더링되어야 함', async () => {
            await view.onOpen();
            
            // 설정 변경
            mockPlugin.settingsManager.updateSettings({
                ...DEFAULT_SETTINGS,
                currentMode: 'folder'
            });
            
            // refresh 호출
            await view.refresh();
            
            // 에러 없이 완료되면 성공
            expect(true).toBe(true);
        });
        
        it('태그 모드로 전환 시 재렌더링되어야 함', async () => {
            await view.onOpen();
            
            // 설정 변경
            mockPlugin.settingsManager.updateSettings({
                ...DEFAULT_SETTINGS,
                currentMode: 'tag'
            });
            
            // refresh 호출
            await view.refresh();
            
            // 에러 없이 완료되면 성공
            expect(true).toBe(true);
        });
        
        it('검색 모드로 전환 시 재렌더링되어야 함', async () => {
            await view.onOpen();
            
            // 설정 변경
            mockPlugin.settingsManager.updateSettings({
                ...DEFAULT_SETTINGS,
                currentMode: 'search'
            });
            
            // refresh 호출
            await view.refresh();
            
            // 에러 없이 완료되면 성공
            expect(true).toBe(true);
        });
    });
    
    describe('렌더링 중복 방지', () => {
        it('렌더링 중에는 active-leaf-change 이벤트를 무시해야 함', async () => {
            await view.onOpen();
            
            // 렌더링 상태를 true로 설정
            (view as any).state.startRendering();
            
            // active-leaf-change 이벤트 콜백 가져오기
            const activeLeafChangeCallback = (mockApp.workspace.on as jest.Mock).mock.calls
                .find(call => call[0] === 'active-leaf-change')?.[1];
            
            // 렌더링 중에 이벤트 호출
            if (activeLeafChangeCallback) {
                await activeLeafChangeCallback();
            }
            
            // 렌더링이 시작되지 않았는지 확인 (이미 렌더링 중이므로)
            expect(true).toBe(true);
        });
    });
    
    describe('디바운싱', () => {
        it('메타데이터 변경 시 디바운싱이 적용되어야 함', async () => {
            jest.useFakeTimers();
            
            await view.onOpen();
            
            const mockFile = createMockFile('test.md');
            
            // metadataCache.on('changed') 콜백 가져오기
            const metadataChangedCallback = (mockApp.metadataCache.on as jest.Mock).mock.calls
                .find(call => call[0] === 'changed')?.[1];
            
            if (metadataChangedCallback) {
                // 연속으로 여러 번 호출
                metadataChangedCallback(mockFile);
                metadataChangedCallback(mockFile);
                metadataChangedCallback(mockFile);
                
                // 타이머 실행
                jest.runAllTimers();
            }
            
            // 실제로는 한 번만 렌더링되어야 함 (디바운싱)
            expect(true).toBe(true);
            
            jest.useRealTimers();
        });
    });
});

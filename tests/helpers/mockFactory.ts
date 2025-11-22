/**
 * Mock Factory
 * 
 * 테스트에서 사용하는 Mock 객체들을 생성하는 헬퍼 함수 모음
 */

import { TFile, App, Vault, MetadataCache, Workspace, FileManager } from 'obsidian';
import { ICardView } from '../../src/interfaces/ICardView';
import { CardData, CardSettings, DEFAULT_SETTINGS, CardNavigatorSettings } from '../../src/types';

/**
 * Mock TFile 생성
 * 
 * @param basename - 파일 이름 (확장자 제외)
 * @param options - 추가 옵션
 * @returns Mock TFile
 */
export function createMockFile(
    basename: string,
    options: {
        path?: string;
        content?: string;
        tags?: string[];
        metadata?: Record<string, any>;
        isReadOnly?: boolean;
        ctime?: number;
        mtime?: number;
        size?: number;
    } = {}
): TFile {
    const file = new TFile();
    
    file.basename = basename;
    file.name = `${basename}.md`;
    file.path = options.path || `${basename}.md`;
    file.extension = 'md';
    
    file.stat = {
        ctime: options.ctime || Date.parse('2024-01-01'),
        mtime: options.mtime || Date.parse('2024-01-15'),
        size: options.size || 1000
    } as any;
    
    // parent 설정
    if (file.path.includes('/')) {
        const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
        (file as any).parent = {
            path: parentPath,
            name: parentPath.split('/').pop() || ''
        };
    }
    
    return file;
}

/**
 * Mock CardData 생성
 * 
 * @param file - 파일 (선택)
 * @param options - 추가 옵션
 * @returns Mock CardData
 */
export function createMockCardData(
    file?: TFile,
    options: {
        headerContent?: string;
        bodyContent?: string;
        footerContent?: string;
        headerVisible?: boolean;
        bodyVisible?: boolean;
        footerVisible?: boolean;
    } = {}
): CardData {
    return {
        file: file || createMockFile('test'),
        header: {
            type: 'header',
            content: options.headerContent || '<div class="card-title">Test File</div>',
            visible: options.headerVisible !== undefined ? options.headerVisible : true
        },
        body: {
            type: 'body',
            content: options.bodyContent || '<p>Test content</p>',
            visible: options.bodyVisible !== undefined ? options.bodyVisible : true
        },
        footer: {
            type: 'footer',
            content: options.footerContent || '<div class="card-meta">Modified: 2024-01-15</div>',
            visible: options.footerVisible !== undefined ? options.footerVisible : true
        },
        cardSettings: DEFAULT_SETTINGS as any
    };
}

/**
 * Mock App 생성
 * 
 * @returns Mock App
 */
export function createMockApp(): jest.Mocked<App> {
    const mockVault = {
        getAbstractFileByPath: jest.fn(),
        getMarkdownFiles: jest.fn().mockReturnValue([]),
        read: jest.fn().mockResolvedValue(''),
        modify: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        rename: jest.fn().mockResolvedValue(undefined),
        on: jest.fn().mockReturnValue(undefined), // 이벤트 리스너 등록 (SearchEngine용)
        off: jest.fn().mockReturnValue(undefined), // 이벤트 리스너 해제
        adapter: {
            exists: jest.fn().mockResolvedValue(true),
            read: jest.fn().mockResolvedValue(''),
            write: jest.fn().mockResolvedValue(undefined)
        }
    } as any;
    
    const mockMetadataCache = {
        getFileCache: jest.fn().mockReturnValue({
            frontmatter: {},
            tags: [],
            links: [],
            headings: []
        }),
        getCache: jest.fn().mockReturnValue(null),
        on: jest.fn()
    } as any;
    
    const mockWorkspace = {
        getActiveFile: jest.fn().mockReturnValue(null),
        getLeaf: jest.fn().mockReturnValue({
            openFile: jest.fn().mockResolvedValue(undefined)
        }),
        activeLeaf: {
            openFile: jest.fn().mockResolvedValue(undefined)
        },
        on: jest.fn()
    } as any;
    
    const mockFileManager = {
        processFrontMatter: jest.fn()
    } as any;
    
    const app = {
        vault: mockVault,
        metadataCache: mockMetadataCache,
        workspace: mockWorkspace,
        fileManager: mockFileManager
    } as jest.Mocked<App>;
    
    return app;
}

/**
 * Mock Plugin 생성
 * 
 * @returns Mock CardNavigatorPlugin
 */
export function createMockPlugin(): any {
    const mockLogger = {
        log: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };
    
    const mockPresetManager = {
        getCardSettingsForFile: jest.fn().mockReturnValue(null),
        getActivePreset: jest.fn().mockReturnValue(null),
        getAllPresets: jest.fn().mockReturnValue([]),
        savePreset: jest.fn().mockResolvedValue(undefined),
        deletePreset: jest.fn().mockResolvedValue(undefined)
    };
    
    const mockSettingsManager = {
        getSettings: jest.fn().mockReturnValue(DEFAULT_SETTINGS),
        updateSettings: jest.fn().mockResolvedValue(undefined),
        getCardSettings: jest.fn().mockReturnValue(null),
        saveSettings: jest.fn().mockResolvedValue(undefined),
        loadSettings: jest.fn().mockResolvedValue(undefined)
    };
    
    return {
        settingsManager: mockSettingsManager,
        presetManager: mockPresetManager,
        logger: mockLogger,
        openSettings: jest.fn(),
        manifest: {
            version: '1.0.0'
        }
    };
}

/**
 * Mock ICardView 생성
 * 
 * @returns Mock ICardView
 */
export function createMockView(): jest.Mocked<ICardView> {
    const mockPlugin = createMockPlugin();
    
    return {
        plugin: mockPlugin as any,
        openFile: jest.fn().mockResolvedValue(undefined),
        changeMode: jest.fn().mockResolvedValue(undefined),
        changeSortMethod: jest.fn().mockResolvedValue(undefined),
        openFilterModal: jest.fn(),
        refresh: jest.fn().mockResolvedValue(undefined),
        clearSearch: jest.fn()
    } as any;
}

/**
 * Mock Settings 생성
 * 
 * @param overrides - 기본값 오버라이드
 * @returns Mock Settings
 */
export function createMockSettings(
    overrides: Partial<CardNavigatorSettings> = {}
): CardNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        ...overrides
    } as CardNavigatorSettings;
}

/**
 * Mock CardSettings 생성
 * 
 * @param overrides - 기본값 오버라이드
 * @returns Mock CardSettings
 */
export function createMockCardSettings(
    overrides: Partial<CardSettings> = {}
): CardSettings {
    return {
        renderMode: 'full',
        showHeader: true,
        showBody: true,
        showFooter: true,
        bodyLines: 3,
        ...overrides
    } as CardSettings;
}

/**
 * 여러 Mock 파일 생성
 * 
 * @param count - 생성할 파일 수
 * @param prefix - 파일명 접두사
 * @returns Mock 파일 배열
 */
export function createMockFiles(
    count: number,
    prefix: string = 'file'
): TFile[] {
    return Array.from({ length: count }, (_, i) =>
        createMockFile(`${prefix}${i}`, {
            path: `folder/${prefix}${i}.md`,
            mtime: Date.now() - (count - i) * 1000
        })
    );
}

/**
 * Mock Container 생성
 * 
 * @returns HTMLElement
 */
export function createMockContainer(): HTMLElement {
    const container = document.createElement('div');
    container.classList.add('card-navigator-container');
    document.body.appendChild(container);
    return container;
}

/**
 * Mock Container 정리
 * 
 * @param container - 정리할 컨테이너
 */
export function cleanupMockContainer(container: HTMLElement): void {
    if (container.parentElement) {
        container.parentElement.removeChild(container);
    }
}

/**
 * 비동기 대기 헬퍼
 * 
 * @param ms - 대기 시간 (밀리초)
 */
export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Promise 플러시
 * 
 * 대기 중인 모든 Promise가 완료될 때까지 대기
 */
export async function flushPromises(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

/**
 * DOM 요소 대기
 * 
 * @param selector - CSS 선택자
 * @param timeout - 타임아웃 (밀리초)
 * @returns 찾은 요소
 */
export async function waitForElement(
    selector: string,
    timeout: number = 5000
): Promise<Element> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await wait(50);
    }
    
    throw new Error(`Element ${selector} not found within ${timeout}ms`);
}

/**
 * 클릭 이벤트 트리거
 * 
 * @param element - 클릭할 요소
 */
export function triggerClick(element: Element): void {
    const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    element.dispatchEvent(event);
}

/**
 * 키보드 이벤트 트리거
 * 
 * @param element - 이벤트를 발생시킬 요소
 * @param key - 키 이름
 * @param options - 추가 옵션
 */
export function triggerKeyboard(
    element: Element,
    key: string,
    options: {
        ctrlKey?: boolean;
        shiftKey?: boolean;
        altKey?: boolean;
        metaKey?: boolean;
    } = {}
): void {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...options
    });
    element.dispatchEvent(event);
}

/**
 * 마우스 이벤트 트리거
 * 
 * @param element - 이벤트를 발생시킬 요소
 * @param type - 이벤트 타입
 * @param options - 마우스 좌표 등
 */
export function triggerMouse(
    element: Element,
    type: string,
    options: {
        clientX?: number;
        clientY?: number;
        button?: number;
    } = {}
): void {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        ...options
    });
    element.dispatchEvent(event);
}

/**
 * 조건 대기
 * 
 * @param condition - 조건 함수
 * @param timeout - 타임아웃 (밀리초)
 */
export async function waitFor(
    condition: () => boolean,
    timeout: number = 5000
): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (condition()) {
            return;
        }
        await wait(50);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
}

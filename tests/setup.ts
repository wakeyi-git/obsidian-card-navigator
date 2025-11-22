/**
 * Jest 글로벌 Setup
 * 모든 테스트 실행 전에 로드됨
 */

import { setupObsidianDomMocks } from './__mocks__/obsidian-dom';
import { setupBrowserApiMocks } from './__mocks__/browser-api';
import { setupTestLocale } from './utils/i18nTestHelper';

// DataTransfer Mock
class MockDataTransfer {
    data: Record<string, string> = {};
    dropEffect: string = 'none';
    effectAllowed: string = 'all';
    files: FileList = [] as any;
    items: DataTransferItemList = [] as any;
    types: string[] = [];

    clearData(format?: string): void {
        if (format) {
            delete this.data[format];
            this.types = this.types.filter(t => t !== format);
        } else {
            this.data = {};
            this.types = [];
        }
    }

    getData(format: string): string {
        return this.data[format] || '';
    }

    setData(format: string, data: string): void {
        this.data[format] = data;
        if (!this.types.includes(format)) {
            this.types.push(format);
        }
    }

    setDragImage(image: Element, x: number, y: number): void {
        // Mock implementation
    }
}

// DragEvent Mock
class MockDragEvent extends Event {
    dataTransfer: DataTransfer | null;

    constructor(type: string, eventInitDict?: DragEventInit) {
        super(type, eventInitDict);
        
        // dataTransfer는 명시적으로 설정되지 않으면 새로운 MockDataTransfer 생성
        // 단, 테스트에서 Object.defineProperty로 덮어쓸 수 있도록 null로 시작
        this.dataTransfer = eventInitDict?.dataTransfer || null;
    }
}

// 전역에 DragEvent와 DataTransfer 등록
if (typeof global.DragEvent === 'undefined') {
    global.DragEvent = MockDragEvent as any;
}

if (typeof global.DataTransfer === 'undefined') {
    global.DataTransfer = MockDataTransfer as any;
}

// TypeScript 타입 선언
declare global {
    interface DragEventInit extends EventInit {
        dataTransfer?: DataTransfer | null;
    }

    var DragEvent: {
        new(type: string, eventInitDict?: DragEventInit): DragEvent;
        prototype: DragEvent;
    };

    var DataTransfer: {
        new(): DataTransfer;
        prototype: DataTransfer;
    };
}

// Obsidian DOM API 모킹 설정
setupObsidianDomMocks();

// Browser API 모킹 설정
setupBrowserApiMocks();

// Performance API Mock (추가 보완)
if (typeof performance === 'undefined') {
    global.performance = {
        now: () => Date.now(),
        mark: () => {},
        measure: () => {},
        clearMarks: () => {},
        clearMeasures: () => {},
        getEntriesByType: () => [],
        getEntriesByName: () => []
    } as any;
}

// Console 메서드 보완 (jsdom에 없을 수 있음)
if (!console.group) {
    console.group = (...args: any[]) => console.log(...args);
}
if (!console.groupEnd) {
    console.groupEnd = () => {};
}
if (!console.groupCollapsed) {
    console.groupCollapsed = (...args: any[]) => console.log(...args);
}

// i18n 설정: 모든 테스트를 영어로 기본 설정
setupTestLocale('en');

// Suppress console.error in tests to reduce noise from intentional error handling tests
// Tests that specifically need to verify console.error was called should spy on it
const originalConsoleError = console.error;
beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
        // Optionally filter out specific expected errors or suppress all
        // For now, suppress all console.error in tests
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

export {};
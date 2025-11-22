/**
 * Browser API Mocking
 * 
 * jsdom에서 지원하지 않는 브라우저 API를 모킹합니다.
 */

/**
 * IntersectionObserver Mock
 */
export class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    
    private callback: IntersectionObserverCallback;
    private observedElements: Set<Element> = new Set();
    
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback;
        if (options) {
            this.root = options.root || null;
            this.rootMargin = options.rootMargin || '';
            this.thresholds = Array.isArray(options.threshold) 
                ? options.threshold 
                : [options.threshold || 0];
        }
    }
    
    observe(target: Element): void {
        this.observedElements.add(target);
        
        // 즉시 intersection 이벤트 트리거 (테스트용)
        const entry: IntersectionObserverEntry = {
            target,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
            time: Date.now()
        };
        
        this.callback([entry], this);
    }
    
    unobserve(target: Element): void {
        this.observedElements.delete(target);
    }
    
    disconnect(): void {
        this.observedElements.clear();
    }
    
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
    
    /**
     * 테스트 헬퍼: 특정 요소의 intersection 상태를 시뮬레이션
     */
    triggerIntersection(target: Element, isIntersecting: boolean): void {
        if (!this.observedElements.has(target)) {
            return;
        }
        
        const entry: IntersectionObserverEntry = {
            target,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: isIntersecting ? target.getBoundingClientRect() : new DOMRect(),
            rootBounds: null,
            time: Date.now()
        };
        
        this.callback([entry], this);
    }
}

/**
 * ResizeObserver Mock
 */
export class MockResizeObserver implements ResizeObserver {
    private callback: ResizeObserverCallback;
    private observedElements: Set<Element> = new Set();
    
    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
    }
    
    observe(target: Element, options?: ResizeObserverOptions): void {
        this.observedElements.add(target);
        
        // 즉시 resize 이벤트 트리거 (테스트용)
        const entry: ResizeObserverEntry = {
            target,
            contentRect: target.getBoundingClientRect(),
            borderBoxSize: [{
                blockSize: 100,
                inlineSize: 100
            }],
            contentBoxSize: [{
                blockSize: 100,
                inlineSize: 100
            }],
            devicePixelContentBoxSize: [{
                blockSize: 100,
                inlineSize: 100
            }]
        };
        
        this.callback([entry], this);
    }
    
    unobserve(target: Element): void {
        this.observedElements.delete(target);
    }
    
    disconnect(): void {
        this.observedElements.clear();
    }
}

/**
 * MutationObserver Mock (기본적인 구현)
 */
export class MockMutationObserver implements MutationObserver {
    private callback: MutationCallback;
    
    constructor(callback: MutationCallback) {
        this.callback = callback;
    }
    
    observe(target: Node, options?: MutationObserverInit): void {
        // 기본 구현
    }
    
    disconnect(): void {
        // 기본 구현
    }
    
    takeRecords(): MutationRecord[] {
        return [];
    }
}

/**
 * Browser API 모킹 설정
 */
export function setupBrowserApiMocks(): void {
    // IntersectionObserver
    (global as any).IntersectionObserver = MockIntersectionObserver;
    
    // ResizeObserver
    (global as any).ResizeObserver = MockResizeObserver;
    
    // MutationObserver (이미 jsdom에 있지만 덮어쓰기)
    (global as any).MutationObserver = MockMutationObserver;
    
    // requestAnimationFrame
    if (!global.requestAnimationFrame) {
        (global as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
            return setTimeout(callback, 0) as unknown as number;
        };
    }
    
    // cancelAnimationFrame
    if (!global.cancelAnimationFrame) {
        (global as any).cancelAnimationFrame = (id: number) => {
            clearTimeout(id);
        };
    }
    
    // getComputedStyle (기본 구현)
    if (!global.getComputedStyle) {
        (global as any).getComputedStyle = (element: Element) => {
            return window.getComputedStyle(element);  // ✅ 중복 제거
        };
    }
    
    // scrollIntoView (JSDOM에 없는 메서드)
    if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = function(arg?: boolean | ScrollIntoViewOptions): void {
            // Mock implementation - 아무것도 하지 않음
            // 테스트에서 jest.spyOn으로 감시 가능
        };
    }
    
    // scrollBy (JSDOM에 없는 메서드)
    if (!Element.prototype.scrollBy) {
        Element.prototype.scrollBy = function(
            optionsOrX?: ScrollToOptions | number,
            y?: number
        ): void {
            // Mock implementation - 아무것도 하지 않음
            // 테스트에서 jest.spyOn으로 감시 가능
        };
    }
    
    // scrollTo (JSDOM에 없는 메서드 - 추가 보완)
    if (!Element.prototype.scrollTo) {
        Element.prototype.scrollTo = function(
            optionsOrX?: ScrollToOptions | number,
            y?: number
        ): void {
            // Mock implementation
        };
    }
}

/**
 * 테스트 헬퍼: IntersectionObserver 접근
 */
export function getIntersectionObserver(): typeof MockIntersectionObserver {
    return (global as any).IntersectionObserver;
}

/**
 * 테스트 헬퍼: ResizeObserver 접근
 */
export function getResizeObserver(): typeof MockResizeObserver {
    return (global as any).ResizeObserver;
}
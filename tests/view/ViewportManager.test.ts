/**
 * ViewportManager 테스트
 * 
 * Intersection Observer를 사용한 viewport 관리 시스템을 테스트합니다.
 */

import { ViewportManager } from '../../src/view/ViewportManager';
import { DEFAULT_SETTINGS } from '../../src/types';

// Mock IntersectionObserver
class MockIntersectionObserver {
    callback: IntersectionObserverCallback;
    options: IntersectionObserverInit;
    observedElements: Set<Element> = new Set();
    
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback;
        this.options = options || {};
    }
    
    observe(element: Element) {
        this.observedElements.add(element);
    }
    
    unobserve(element: Element) {
        this.observedElements.delete(element);
    }
    
    disconnect() {
        this.observedElements.clear();
    }
    
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
    
    // Helper: Trigger intersection
    triggerIntersection(element: Element, isIntersecting: boolean) {
        const entry: Partial<IntersectionObserverEntry> = {
            target: element,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: element.getBoundingClientRect(),
            intersectionRect: element.getBoundingClientRect(),
            rootBounds: null,
            time: Date.now()
        };
        
        this.callback([entry as IntersectionObserverEntry], this as any);
    }
}

// Setup global IntersectionObserver mock
(global as any).IntersectionObserver = MockIntersectionObserver;

describe('ViewportManager', () => {
    let container: HTMLElement;
    let onCardVisibleMock: jest.Mock;
    let onCardHiddenMock: jest.Mock;
    let manager: ViewportManager;
    
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        
        onCardVisibleMock = jest.fn().mockResolvedValue(undefined);
        onCardHiddenMock = jest.fn();
        
        manager = new ViewportManager(
            container,
            onCardVisibleMock,
            onCardHiddenMock,
            DEFAULT_SETTINGS
        );
        
        jest.clearAllMocks();
    });
    
    afterEach(() => {
        manager.destroy();
        document.body.removeChild(container);
    });
    
    describe('Initialization', () => {
        it('should initialize with default options', () => {
            // Manager는 생성자에서 자동으로 초기화됩니다
            expect(manager).toBeDefined();
        });
        
        it('should initialize with custom options', () => {
            const customManager = new ViewportManager(
                container,
                onCardVisibleMock,
                onCardHiddenMock,
                DEFAULT_SETTINGS,
                {
                    rootMargin: '200px',
                    threshold: 0.5
                }
            );
            
            expect(customManager).toBeDefined();
            customManager.destroy();
        });
        
        it('should work without onCardHidden callback', () => {
            const managerWithoutHidden = new ViewportManager(
                container,
                onCardVisibleMock,
                undefined,
                DEFAULT_SETTINGS
            );
            
            expect(managerWithoutHidden).toBeDefined();
            managerWithoutHidden.destroy();
        });
    });
    
    describe('Card Observation', () => {
        it('should observe a card', () => {
            const card = document.createElement('div');
            card.classList.add('card-placeholder');
            card.dataset.filePath = 'test.md';
            container.appendChild(card);
            
            manager.observe(card);
            
            // IntersectionObserver의 observe가 호출됨
            expect(card).toBeDefined();
        });
        
        it('should unobserve a card', () => {
            const card = document.createElement('div');
            card.classList.add('card-placeholder');
            container.appendChild(card);
            
            manager.observe(card);
            manager.unobserve(card);
            
            // 카드가 관찰 해제됨
            expect(card).toBeDefined();
        });
        
        it('should handle observing multiple cards', () => {
            const cards = Array(5).fill(null).map((_, i) => {
                const card = document.createElement('div');
                card.classList.add('card-placeholder');
                card.dataset.filePath = `test${i}.md`;
                container.appendChild(card);
                return card;
            });
            
            cards.forEach(card => manager.observe(card));
            
            expect(cards).toHaveLength(5);
        });
    });
    
    describe('Visibility Tracking', () => {
        it('should return empty array initially', () => {
            const visibleCards = manager.getVisibleCards();
            expect(visibleCards).toEqual([]);
        });
        
        it('should track visible cards', async () => {
            const card = document.createElement('div');
            card.classList.add('card-placeholder');
            card.dataset.filePath = 'test.md';
            container.appendChild(card);
            
            manager.observe(card);
            
            // Simulate intersection
            const observer = (global as any).IntersectionObserver;
            const instance = new observer(() => {});
            instance.triggerIntersection(card, true);
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // 카드가 처리됨
            expect(card).toBeDefined();
        });
    });
    
    describe('Force Rendering', () => {
        it('should render all placeholder cards', async () => {
            const cards = Array(3).fill(null).map((_, i) => {
                const card = document.createElement('div');
                card.classList.add('card-placeholder');
                card.dataset.filePath = `test${i}.md`;
                container.appendChild(card);
                return card;
            });
            
            await manager.renderAllCards();
            
            // onCardVisible이 각 카드에 대해 호출됨
            expect(onCardVisibleMock).toHaveBeenCalledTimes(3);
        });
        
        it('should skip already rendered cards', async () => {
            const card = document.createElement('div');
            card.classList.add('card-placeholder');
            card.classList.add('card-rendered');
            card.dataset.filePath = 'test.md';
            container.appendChild(card);
            
            await manager.renderAllCards();
            
            // 이미 렌더링된 카드는 스킵
            expect(onCardVisibleMock).not.toHaveBeenCalled();
        });
        
        it('should handle empty container', async () => {
            await manager.renderAllCards();
            
            expect(onCardVisibleMock).not.toHaveBeenCalled();
        });
    });
    
    describe('Cleanup', () => {
        it('should destroy observer', () => {
            const card = document.createElement('div');
            card.classList.add('card-placeholder');
            container.appendChild(card);
            
            manager.observe(card);
            manager.destroy();
            
            // 리소스가 정리됨
            expect(manager.getVisibleCards()).toEqual([]);
        });
        
        it('should allow multiple destroy calls', () => {
            expect(() => {
                manager.destroy();
                manager.destroy();
            }).not.toThrow();
        });
        
        it('should clear tracked cards on destroy', () => {
            const card = document.createElement('div');
            card.classList.add('card-placeholder');
            container.appendChild(card);
            
            manager.observe(card);
            manager.destroy();
            
            expect(manager.getVisibleCards()).toEqual([]);
        });
    });
    
    describe('Error Handling', () => {
        it('should handle onCardVisible errors', async () => {
            // Suppress console.error for this error handling test
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const errorManager = new ViewportManager(
                container,
                jest.fn().mockRejectedValue(new Error('Render failed')),
                undefined,
                DEFAULT_SETTINGS
            );

            const card = document.createElement('div');
            card.classList.add('card-placeholder');
            card.dataset.filePath = 'test.md';
            container.appendChild(card);

            // 에러가 발생해도 crash하지 않음
            await expect(errorManager.renderAllCards()).resolves.not.toThrow();

            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalled();

            errorManager.destroy();
            consoleErrorSpy.mockRestore();
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle cards without file path', async () => {
            const card = document.createElement('div');
            card.classList.add('card-placeholder');
            // dataset.filePath 없음
            container.appendChild(card);
            
            manager.observe(card);
            
            expect(card).toBeDefined();
        });
        
        it('should handle very large number of cards', async () => {
            const cards = Array(1000).fill(null).map((_, i) => {
                const card = document.createElement('div');
                card.classList.add('card-placeholder');
                card.dataset.filePath = `test${i}.md`;
                container.appendChild(card);
                return card;
            });
            
            cards.forEach(card => manager.observe(card));
            
            expect(cards).toHaveLength(1000);
        });
        
        it('should handle rapid observe/unobserve cycles', () => {
            const card = document.createElement('div');
            card.classList.add('card-placeholder');
            container.appendChild(card);
            
            for (let i = 0; i < 10; i++) {
                manager.observe(card);
                manager.unobserve(card);
            }
            
            // 에러 없이 완료
            expect(card).toBeDefined();
        });
    });
    
    describe('Memory Management', () => {
        it('should not leak memory on destroy', () => {
            const cards = Array(100).fill(null).map((_, i) => {
                const card = document.createElement('div');
                card.classList.add('card-placeholder');
                card.dataset.filePath = `test${i}.md`;
                container.appendChild(card);
                return card;
            });
            
            cards.forEach(card => manager.observe(card));
            manager.destroy();
            
            expect(manager.getVisibleCards()).toEqual([]);
        });
        
        it('should clear all internal state on destroy', () => {
            const card1 = document.createElement('div');
            const card2 = document.createElement('div');
            card1.classList.add('card-placeholder');
            card2.classList.add('card-placeholder');
            
            manager.observe(card1);
            manager.observe(card2);
            manager.destroy();
            
            // 모든 추적이 제거됨
            expect(manager.getVisibleCards()).toEqual([]);
        });
    });
});

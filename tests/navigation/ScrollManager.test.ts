import { ScrollManager } from '../../src/navigation/ScrollManager';
import { CardNavigatorView } from '../../src/view';
import { TFile } from 'obsidian';

describe('ScrollManager', () => {
    let scrollManager: ScrollManager;
    let mockView: CardNavigatorView;
    let mockContainerEl: HTMLElement;
    let mockCardsContainer: HTMLElement;
    
    beforeEach(() => {
        // Setup container
        mockContainerEl = document.createElement('div');
        mockCardsContainer = document.createElement('div');
        mockCardsContainer.className = 'card-navigator-cards';
        mockCardsContainer.style.height = '500px';
        mockCardsContainer.style.overflow = 'auto';
        mockContainerEl.appendChild(mockCardsContainer);
        document.body.appendChild(mockContainerEl);
        
        // Mock CardNavigatorView
        mockView = {
            containerEl: mockContainerEl,
            plugin: {
                settings: {
                    scrollBehavior: 'center',
                    debug: { enabled: false }
                },
                settingsManager: {
                    getSettings: jest.fn().mockReturnValue({
                        debug: { enabled: false }
                    })
                }
            },
            openFile: jest.fn()
        } as any;
        
        scrollManager = new ScrollManager(mockView);
    });
    
    afterEach(() => {
        document.body.removeChild(mockContainerEl);
    });
    
    describe('Initialization', () => {
        it('should create scroll manager instance', () => {
            expect(scrollManager).toBeDefined();
        });
        
        it('should have access to view', () => {
            expect((scrollManager as any).view).toBe(mockView);
        });
    });
    
    describe('Card Visibility', () => {
        it('should detect visible card', () => {
            const card = document.createElement('div');
            card.className = 'card-item';
            card.style.position = 'relative';
            card.style.top = '50px';
            mockCardsContainer.appendChild(card);
            
            // Mock getBoundingClientRect for card and container
            Object.defineProperty(mockCardsContainer, 'clientHeight', {
                configurable: true,
                value: 500
            });
            
            jest.spyOn(card, 'getBoundingClientRect').mockReturnValue({
                top: 50,
                bottom: 150,
                left: 0,
                right: 100,
                width: 100,
                height: 100,
                x: 0,
                y: 50,
                toJSON: () => {}
            } as DOMRect);
            
            jest.spyOn(mockCardsContainer, 'getBoundingClientRect').mockReturnValue({
                top: 0,
                bottom: 500,
                left: 0,
                right: 300,
                width: 300,
                height: 500,
                x: 0,
                y: 0,
                toJSON: () => {}
            } as DOMRect);
            
            const isVisible = (scrollManager as any).isCardVisible(card);
            
            expect(isVisible).toBe(true);
        });
        
        it('should detect invisible card (above viewport)', () => {
            const card = document.createElement('div');
            card.className = 'card-item';
            card.style.position = 'relative';
            card.style.top = '-600px';
            mockCardsContainer.appendChild(card);
            
            // Mock getBoundingClientRect - card is above viewport
            Object.defineProperty(mockCardsContainer, 'clientHeight', {
                configurable: true,
                value: 500
            });
            
            jest.spyOn(card, 'getBoundingClientRect').mockReturnValue({
                top: -600,
                bottom: -500,
                left: 0,
                right: 100,
                width: 100,
                height: 100,
                x: 0,
                y: -600,
                toJSON: () => {}
            } as DOMRect);
            
            jest.spyOn(mockCardsContainer, 'getBoundingClientRect').mockReturnValue({
                top: 0,
                bottom: 500,
                left: 0,
                right: 300,
                width: 300,
                height: 500,
                x: 0,
                y: 0,
                toJSON: () => {}
            } as DOMRect);
            
            const isVisible = (scrollManager as any).isCardVisible(card);
            
            expect(isVisible).toBe(false);
        });
        
        it('should detect invisible card (below viewport)', () => {
            const card = document.createElement('div');
            card.className = 'card-item';
            card.style.position = 'relative';
            card.style.top = '1000px';
            mockCardsContainer.appendChild(card);
            
            // Mock getBoundingClientRect - card is below viewport
            Object.defineProperty(mockCardsContainer, 'clientHeight', {
                configurable: true,
                value: 500
            });
            
            jest.spyOn(card, 'getBoundingClientRect').mockReturnValue({
                top: 1000,
                bottom: 1100,
                left: 0,
                right: 100,
                width: 100,
                height: 100,
                x: 0,
                y: 1000,
                toJSON: () => {}
            } as DOMRect);
            
            jest.spyOn(mockCardsContainer, 'getBoundingClientRect').mockReturnValue({
                top: 0,
                bottom: 500,
                left: 0,
                right: 300,
                width: 300,
                height: 500,
                x: 0,
                y: 0,
                toJSON: () => {}
            } as DOMRect);
            
            const isVisible = (scrollManager as any).isCardVisible(card);
            
            expect(isVisible).toBe(false);
        });
        
        it('should return false when container not found', () => {
            // Remove container
            mockContainerEl.removeChild(mockCardsContainer);
            
            const card = document.createElement('div');
            const isVisible = (scrollManager as any).isCardVisible(card);
            
            expect(isVisible).toBe(false);
            
            // Restore
            mockContainerEl.appendChild(mockCardsContainer);
        });
    });
    
    describe('Center Card', () => {
        let testCard: HTMLElement;
        
        beforeEach(() => {
            testCard = document.createElement('div');
            testCard.className = 'card-item';
            testCard.setAttribute('data-file-path', 'test.md');
            mockCardsContainer.appendChild(testCard);
        });
        
        it('should scroll to center when scrollBehavior is center', () => {
            mockView.plugin.settings.scrollBehavior = 'center';
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            scrollManager.centerCard(testCard, 'test');
            
            expect(scrollIntoViewSpy).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        });
        
        it('should not scroll when scrollBehavior is none', () => {
            mockView.plugin.settings.scrollBehavior = 'none';
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            scrollManager.centerCard(testCard, 'test');
            
            expect(scrollIntoViewSpy).not.toHaveBeenCalled();
        });
        
        it('should not scroll when scrollBehavior is nearest and card is visible', () => {
            mockView.plugin.settings.scrollBehavior = 'nearest';
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            // Make card visible with proper mocks
            Object.defineProperty(mockCardsContainer, 'clientHeight', {
                configurable: true,
                value: 500
            });
            
            jest.spyOn(testCard, 'getBoundingClientRect').mockReturnValue({
                top: 50,
                bottom: 150,
                left: 0,
                right: 100,
                width: 100,
                height: 100,
                x: 0,
                y: 50,
                toJSON: () => {}
            } as DOMRect);
            
            jest.spyOn(mockCardsContainer, 'getBoundingClientRect').mockReturnValue({
                top: 0,
                bottom: 500,
                left: 0,
                right: 300,
                width: 300,
                height: 500,
                x: 0,
                y: 0,
                toJSON: () => {}
            } as DOMRect);
            
            scrollManager.centerCard(testCard, 'test');
            
            expect(scrollIntoViewSpy).not.toHaveBeenCalled();
        });
        
        it('should scroll when scrollBehavior is nearest and card is not visible', () => {
            mockView.plugin.settings.scrollBehavior = 'nearest';
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            // Make card invisible
            testCard.getBoundingClientRect = jest.fn().mockReturnValue({
                top: 1000,
                bottom: 1200,
                left: 0,
                right: 200
            });
            
            scrollManager.centerCard(testCard, 'test');
            
            expect(scrollIntoViewSpy).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        });
    });
    
    describe('Ensure Visible', () => {
        let testCard: HTMLElement;
        
        beforeEach(() => {
            testCard = document.createElement('div');
            testCard.className = 'card-item';
            mockCardsContainer.appendChild(testCard);
        });
        
        it('should scroll when card is not visible', () => {
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            // Make card invisible
            testCard.getBoundingClientRect = jest.fn().mockReturnValue({
                top: -100,
                bottom: 0,
                left: 0,
                right: 200
            });
            
            scrollManager.ensureVisible(testCard, 'test');
            
            expect(scrollIntoViewSpy).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        });
        
        it('should not scroll when card is visible', () => {
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            // Make card visible with proper mocks
            Object.defineProperty(mockCardsContainer, 'clientHeight', {
                configurable: true,
                value: 500
            });
            
            jest.spyOn(testCard, 'getBoundingClientRect').mockReturnValue({
                top: 50,
                bottom: 150,
                left: 0,
                right: 100,
                width: 100,
                height: 100,
                x: 0,
                y: 50,
                toJSON: () => {}
            } as DOMRect);
            
            jest.spyOn(mockCardsContainer, 'getBoundingClientRect').mockReturnValue({
                top: 0,
                bottom: 500,
                left: 0,
                right: 300,
                width: 300,
                height: 500,
                x: 0,
                y: 0,
                toJSON: () => {}
            } as DOMRect);
            
            scrollManager.ensureVisible(testCard, 'test');
            
            expect(scrollIntoViewSpy).not.toHaveBeenCalled();
        });
        
        it('should handle null card element', () => {
            expect(() => {
                scrollManager.ensureVisible(null as any, 'test');
            }).not.toThrow();
        });
    });
    
    describe('Scroll to Active File', () => {
        let testCard: HTMLElement;
        let testFile: TFile;
        
        beforeEach(() => {
            testCard = document.createElement('div');
            testCard.className = 'card-item';
            testCard.setAttribute('data-file-path', 'test.md');
            mockCardsContainer.appendChild(testCard);
            
            testFile = {
                path: 'test.md',
                name: 'test.md',
                basename: 'test',
                extension: 'md'
            } as TFile;
        });
        
        it('should scroll to card for active file', async () => {
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            await scrollManager.scrollToActiveFile(testFile, 'test');
            
            expect(scrollIntoViewSpy).toHaveBeenCalled();
        });
        
        it('should scroll instantly (no animation) when scrollBehavior is none', async () => {
            mockView.plugin.settings.scrollBehavior = 'none';
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');

            await scrollManager.scrollToActiveFile(testFile, 'test');

            expect(scrollIntoViewSpy).toHaveBeenCalledWith({
                behavior: 'instant',
                block: 'center',
                inline: 'nearest'
            });
        });
        
        it('should prevent duplicate scrolls within 200ms', async () => {
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            // First scroll
            await scrollManager.scrollToActiveFile(testFile, 'test1');
            expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
            
            // Second scroll within 200ms
            await scrollManager.scrollToActiveFile(testFile, 'test2');
            expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1); // Should still be 1
        });
        
        it('should allow scroll after 200ms', async () => {
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            // First scroll
            await scrollManager.scrollToActiveFile(testFile, 'test1');
            expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
            
            // Wait 200ms
            await new Promise(resolve => setTimeout(resolve, 210));
            
            // Second scroll after 200ms
            await scrollManager.scrollToActiveFile(testFile, 'test2');
            expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2); // Should be 2 now
        }, 500);
        
        it('should allow force scroll even within 200ms', async () => {
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            // First scroll
            await scrollManager.scrollToActiveFile(testFile, 'test1');
            expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
            
            // Force scroll within 200ms
            await scrollManager.scrollToActiveFile(testFile, 'test2', true);
            expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2); // Should be 2 now
        });
        
        it('should handle placeholder card', async () => {
            testCard.classList.add('card-placeholder');
            
            const mockCardFactory = {
                renderPlaceholder: jest.fn().mockResolvedValue(undefined)
            };
            
            const mockViewRenderer = {
                viewportManager: {}
            };
            
            (mockView as any).cardFactory = mockCardFactory;
            (mockView as any).viewRenderer = mockViewRenderer;
            
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            await scrollManager.scrollToActiveFile(testFile, 'test');
            
            expect(mockCardFactory.renderPlaceholder).toHaveBeenCalled();
            expect(scrollIntoViewSpy).toHaveBeenCalled();
        });
        
        it('should handle card not found', async () => {
            const nonExistentFile = {
                path: 'nonexistent.md',
                name: 'nonexistent.md',
                basename: 'nonexistent',
                extension: 'md'
            } as TFile;
            
            await expect(
                scrollManager.scrollToActiveFile(nonExistentFile, 'test')
            ).resolves.not.toThrow();
        });
        
        it('should handle missing card container', async () => {
            mockContainerEl.removeChild(mockCardsContainer);
            
            await expect(
                scrollManager.scrollToActiveFile(testFile, 'test')
            ).resolves.not.toThrow();
            
            mockContainerEl.appendChild(mockCardsContainer);
        });
    });
    
    describe('Visible Card Count', () => {
        it('should count visible cards', () => {
            // Setup container dimensions
            Object.defineProperty(mockCardsContainer, 'clientHeight', {
                configurable: true,
                value: 500
            });
            
            jest.spyOn(mockCardsContainer, 'getBoundingClientRect').mockReturnValue({
                top: 0,
                bottom: 500,
                left: 0,
                right: 300,
                width: 300,
                height: 500,
                x: 0,
                y: 0,
                toJSON: () => {}
            } as DOMRect);
            
            // Add 3 visible cards
            for (let i = 0; i < 3; i++) {
                const card = document.createElement('div');
                card.className = 'card-item';
                mockCardsContainer.appendChild(card);
                
                // Mock each card as visible
                jest.spyOn(card, 'getBoundingClientRect').mockReturnValue({
                    top: i * 100 + 10,
                    bottom: i * 100 + 90,
                    left: 0,
                    right: 100,
                    width: 100,
                    height: 80,
                    x: 0,
                    y: i * 100 + 10,
                    toJSON: () => {}
                } as DOMRect);
            }
            
            const count = scrollManager.getVisibleCardCount();
            
            expect(count).toBeGreaterThan(0);
        });
        
        it('should return 0 when container not found', () => {
            mockContainerEl.removeChild(mockCardsContainer);
            
            const count = scrollManager.getVisibleCardCount();
            
            expect(count).toBe(0);
            
            mockContainerEl.appendChild(mockCardsContainer);
        });
        
        it('should not count cards outside viewport', () => {
            // Setup container dimensions
            Object.defineProperty(mockCardsContainer, 'clientHeight', {
                configurable: true,
                value: 500
            });
            
            jest.spyOn(mockCardsContainer, 'getBoundingClientRect').mockReturnValue({
                top: 0,
                bottom: 500,
                left: 0,
                right: 300,
                width: 300,
                height: 500,
                x: 0,
                y: 0,
                toJSON: () => {}
            } as DOMRect);
            
            // Add visible card
            const visibleCard = document.createElement('div');
            visibleCard.className = 'card-item';
            mockCardsContainer.appendChild(visibleCard);
            
            jest.spyOn(visibleCard, 'getBoundingClientRect').mockReturnValue({
                top: 50,
                bottom: 130,
                left: 0,
                right: 100,
                width: 100,
                height: 80,
                x: 0,
                y: 50,
                toJSON: () => {}
            } as DOMRect);
            
            // Add invisible card
            const invisibleCard = document.createElement('div');
            invisibleCard.className = 'card-item';
            mockCardsContainer.appendChild(invisibleCard);
            
            jest.spyOn(invisibleCard, 'getBoundingClientRect').mockReturnValue({
                top: 1000,
                bottom: 1100,
                left: 0,
                right: 100,
                width: 100,
                height: 100,
                x: 0,
                y: 1000,
                toJSON: () => {}
            } as DOMRect);
            
            const count = scrollManager.getVisibleCardCount();
            
            // Should only count visible card
            expect(count).toBe(1);
        });
    });
    
    describe('Page Scroll', () => {
        beforeEach(() => {
            // Make container scrollable
            mockCardsContainer.style.height = '500px';
            mockCardsContainer.style.overflowY = 'scroll';
            
            // Add content that exceeds viewport
            const tallContent = document.createElement('div');
            tallContent.style.height = '2000px';
            mockCardsContainer.appendChild(tallContent);
        });
        
        it('should scroll down by page', () => {
            // Mock clientHeight for page scroll calculation
            Object.defineProperty(mockCardsContainer, 'clientHeight', {
                configurable: true,
                value: 500
            });
            
            const scrollBySpy = jest.spyOn(mockCardsContainer, 'scrollBy');
            
            scrollManager.pageScroll(1);
            
            expect(scrollBySpy).toHaveBeenCalledWith({
                top: 400, // 500 * 0.8
                behavior: 'smooth'
            });
        });
        
        it('should scroll up by page', () => {
            // Mock clientHeight for page scroll calculation
            Object.defineProperty(mockCardsContainer, 'clientHeight', {
                configurable: true,
                value: 500
            });
            
            const scrollBySpy = jest.spyOn(mockCardsContainer, 'scrollBy');
            
            scrollManager.pageScroll(-1);
            
            expect(scrollBySpy).toHaveBeenCalledWith({
                top: -400, // 500 * 0.8 * -1
                behavior: 'smooth'
            });
        });
        
        it('should handle missing container', () => {
            mockContainerEl.removeChild(mockCardsContainer);
            
            expect(() => {
                scrollManager.pageScroll(1);
            }).not.toThrow();
            
            mockContainerEl.appendChild(mockCardsContainer);
        });
    });
    
    describe('Scroll to Top/Bottom', () => {
        beforeEach(() => {
            mockCardsContainer.style.height = '500px';
            mockCardsContainer.style.overflowY = 'scroll';
            
            const tallContent = document.createElement('div');
            tallContent.style.height = '2000px';
            mockCardsContainer.appendChild(tallContent);
        });
        
        it('should scroll to top', () => {
            const scrollToSpy = jest.spyOn(mockCardsContainer, 'scrollTo');
            
            scrollManager.scrollToTop();
            
            expect(scrollToSpy).toHaveBeenCalledWith({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        it('should scroll to bottom', () => {
            const scrollToSpy = jest.spyOn(mockCardsContainer, 'scrollTo');
            
            scrollManager.scrollToBottom();
            
            expect(scrollToSpy).toHaveBeenCalledWith({
                top: mockCardsContainer.scrollHeight,
                behavior: 'smooth'
            });
        });
        
        it('should handle missing container on scrollToTop', () => {
            mockContainerEl.removeChild(mockCardsContainer);
            
            expect(() => {
                scrollManager.scrollToTop();
            }).not.toThrow();
            
            mockContainerEl.appendChild(mockCardsContainer);
        });
        
        it('should handle missing container on scrollToBottom', () => {
            mockContainerEl.removeChild(mockCardsContainer);
            
            expect(() => {
                scrollManager.scrollToBottom();
            }).not.toThrow();
            
            mockContainerEl.appendChild(mockCardsContainer);
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle scrollToCard with null element', () => {
            expect(() => {
                (scrollManager as any).scrollToCard(null, 'smooth', 'center', 'test');
            }).not.toThrow();
        });
        
        it('should handle scrollToCard without data-file-path', () => {
            const card = document.createElement('div');
            mockCardsContainer.appendChild(card);
            
            expect(() => {
                (scrollManager as any).scrollToCard(card, 'smooth', 'center', 'test');
            }).not.toThrow();
        });
        
        it('should handle multiple rapid scroll requests', async () => {
            const testCard = document.createElement('div');
            testCard.className = 'card-item';
            testCard.setAttribute('data-file-path', 'test.md');
            mockCardsContainer.appendChild(testCard);
            
            const testFile = {
                path: 'test.md',
                name: 'test.md',
                basename: 'test',
                extension: 'md'
            } as TFile;
            
            const scrollIntoViewSpy = jest.spyOn(testCard, 'scrollIntoView');
            
            // Multiple rapid requests
            await Promise.all([
                scrollManager.scrollToActiveFile(testFile, 'test1'),
                scrollManager.scrollToActiveFile(testFile, 'test2'),
                scrollManager.scrollToActiveFile(testFile, 'test3')
            ]);
            
            // Should only scroll once due to duplicate prevention
            expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
        });
        
        it('should handle scrolls to different files', async () => {
            const card1 = document.createElement('div');
            card1.className = 'card-item';
            card1.setAttribute('data-file-path', 'test1.md');
            mockCardsContainer.appendChild(card1);
            
            const card2 = document.createElement('div');
            card2.className = 'card-item';
            card2.setAttribute('data-file-path', 'test2.md');
            mockCardsContainer.appendChild(card2);
            
            const file1 = { path: 'test1.md' } as TFile;
            const file2 = { path: 'test2.md' } as TFile;
            
            const spy1 = jest.spyOn(card1, 'scrollIntoView');
            const spy2 = jest.spyOn(card2, 'scrollIntoView');
            
            await scrollManager.scrollToActiveFile(file1, 'test1');
            await scrollManager.scrollToActiveFile(file2, 'test2');
            
            expect(spy1).toHaveBeenCalledTimes(1);
            expect(spy2).toHaveBeenCalledTimes(1);
        });
    });
});

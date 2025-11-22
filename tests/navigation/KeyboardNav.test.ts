import { KeyboardNavigator } from '../../src/navigation/KeyboardNav';
import { CardNavigatorView } from '../../src/view';
import { TFile } from 'obsidian';

describe('KeyboardNavigator', () => {
    let navigator: KeyboardNavigator;
    let mockView: CardNavigatorView;
    let mockCards: HTMLElement[];
    let mockFiles: TFile[];
    let mockContainerEl: HTMLElement;
    
    beforeEach(() => {
        // Mock container element
        mockContainerEl = document.createElement('div');
        
        // Mock CardNavigatorView
        mockView = {
            containerEl: mockContainerEl,
            openFile: jest.fn(),
            plugin: {
                settingsManager: {
                    getSettings: jest.fn().mockReturnValue({
                        header: {},
                        body: {},
                        footer: {},
                        renderMode: 'normal',
                        normalCardStyle: {},
                        activeCardStyle: {},
                        focusedCardStyle: {}
                    })
                }
            }
        } as any;
        
        // Create mock cards and files
        mockCards = [];
        mockFiles = [];
        
        for (let i = 0; i < 6; i++) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.position = 'absolute';
            card.style.left = `${(i % 3) * 200}px`;
            card.style.top = `${Math.floor(i / 3) * 200}px`;
            
            // Add dataset for style management
            card.dataset.normalBg = '#ffffff';
            card.dataset.activeBg = '#e0e0e0';
            card.dataset.focusedBg = '#c0c0c0';
            card.dataset.normalFontSize = '14px';
            card.dataset.activeFontSize = '14px';
            card.dataset.focusedFontSize = '16px';
            
            // Add sections
            const header = document.createElement('div');
            header.className = 'card-header';
            card.appendChild(header);
            
            const body = document.createElement('div');
            body.className = 'card-body';
            card.appendChild(body);
            
            const footer = document.createElement('div');
            footer.className = 'card-footer';
            card.appendChild(footer);
            
            document.body.appendChild(card);
            mockCards.push(card);
            
            const file = {
                path: `test${i}.md`,
                name: `Test ${i}`,
                basename: `Test ${i}`,
                extension: 'md'
            } as TFile;
            mockFiles.push(file);
        }
        
        navigator = new KeyboardNavigator(mockView);
    });
    
    afterEach(() => {
        // Clean up DOM
        mockCards.forEach(card => {
            document.body.removeChild(card);
        });
    });
    
    describe('Initialization', () => {
        it('should create navigator instance', () => {
            expect(navigator).toBeDefined();
        });
        
        it('should register keyboard listeners', () => {
            const addEventListenerSpy = jest.spyOn(mockContainerEl, 'addEventListener');
            
            navigator.registerKeyboardListeners();
            
            expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
            expect(mockContainerEl.getAttribute('tabindex')).toBe('0');
        });
    });
    
    describe('Card Management', () => {
        it('should update cards and files', () => {
            navigator.updateCards(mockCards, mockFiles);
            
            // Should not throw
            expect(() => {
                navigator.updateCards(mockCards, mockFiles);
            }).not.toThrow();
        });
        
        it('should handle empty card list', () => {
            navigator.updateCards([], []);
            
            expect(() => {
                navigator.updateCards([], []);
            }).not.toThrow();
        });
        
        it('should reset focused index when cards are updated with fewer cards', () => {
            navigator.updateCards(mockCards, mockFiles);
            
            // Focus last card
            const event = new KeyboardEvent('keydown', { key: 'End' });
            mockContainerEl.dispatchEvent(event);
            
            // Update with fewer cards
            navigator.updateCards(mockCards.slice(0, 2), mockFiles.slice(0, 2));
            
            // Should not throw when trying to navigate
            const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            expect(() => {
                mockContainerEl.dispatchEvent(rightEvent);
            }).not.toThrow();
        });
    });
    
    describe('Keyboard Navigation - Basic Keys', () => {
        beforeEach(() => {
            navigator.registerKeyboardListeners();
            navigator.updateCards(mockCards, mockFiles);
        });
        
        it('should focus first card on initial arrow key press', () => {
            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event);
            
            expect(mockCards[0].classList.contains('focused')).toBe(true);
        });
        
        it('should move focus right with ArrowRight', () => {
            // Focus first card
            const firstEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(firstEvent);
            
            // Move right
            const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(rightEvent);
            
            expect(mockCards[0].classList.contains('focused')).toBe(false);
            expect(mockCards[1].classList.contains('focused')).toBe(true);
        });
        
        it('should move focus left with ArrowLeft', () => {
            // Focus second card
            navigator.updateCards(mockCards, mockFiles);
            const event1 = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event1);
            const event2 = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event2);
            
            // Move left
            const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            mockContainerEl.dispatchEvent(leftEvent);
            
            expect(mockCards[1].classList.contains('focused')).toBe(false);
            expect(mockCards[0].classList.contains('focused')).toBe(true);
        });
        
        it('should not move left past first card', () => {
            // Focus first card
            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event);
            
            // Try to move left
            const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            mockContainerEl.dispatchEvent(leftEvent);
            
            expect(mockCards[0].classList.contains('focused')).toBe(true);
        });
        
        it('should not move right past last card', () => {
            // Focus last card
            const endEvent = new KeyboardEvent('keydown', { key: 'End' });
            mockContainerEl.dispatchEvent(endEvent);
            
            // Try to move right
            const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(rightEvent);
            
            const lastIndex = mockCards.length - 1;
            expect(mockCards[lastIndex].classList.contains('focused')).toBe(true);
        });
    });
    
    describe('Keyboard Navigation - Grid Movement', () => {
        beforeEach(() => {
            navigator.registerKeyboardListeners();
            navigator.updateCards(mockCards, mockFiles);
        });
        
        it('should move focus down with ArrowDown', () => {
            // Mock getBoundingClientRect for all cards to simulate 3-column grid
            mockCards.forEach((card, i) => {
                const col = i % 3;
                const row = Math.floor(i / 3);
                
                Object.defineProperty(card, 'clientWidth', {
                    configurable: true,
                    value: 200
                });
                
                jest.spyOn(card, 'getBoundingClientRect').mockReturnValue({
                    left: col * 200,
                    top: row * 200,
                    right: col * 200 + 200,
                    bottom: row * 200 + 200,
                    width: 200,
                    height: 200,
                    x: col * 200,
                    y: row * 200,
                    toJSON: () => {}
                } as DOMRect);
            });
            
            // Focus first card (0, 0)
            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event);
            
            // Move down (should go to card 3)
            const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            mockContainerEl.dispatchEvent(downEvent);
            
            // With 3 columns, down from card 0 should go to card 3
            expect(mockCards[3].classList.contains('focused')).toBe(true);
        });
        
        it('should move focus up with ArrowUp', () => {
            // Focus card 3 (second row)
            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event);
            const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            mockContainerEl.dispatchEvent(downEvent);
            
            // Move up (should go back to card 0)
            const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
            mockContainerEl.dispatchEvent(upEvent);
            
            expect(mockCards[0].classList.contains('focused')).toBe(true);
        });
        
        it('should not move up past first row', () => {
            // Focus first card
            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event);
            
            // Try to move up
            const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
            mockContainerEl.dispatchEvent(upEvent);
            
            expect(mockCards[0].classList.contains('focused')).toBe(true);
        });
        
        it('should not move down past last row', () => {
            // Focus card in last row
            const endEvent = new KeyboardEvent('keydown', { key: 'End' });
            mockContainerEl.dispatchEvent(endEvent);
            
            // Try to move down
            const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            mockContainerEl.dispatchEvent(downEvent);
            
            const lastIndex = mockCards.length - 1;
            expect(mockCards[lastIndex].classList.contains('focused')).toBe(true);
        });
    });
    
    describe('Special Keys', () => {
        beforeEach(() => {
            navigator.registerKeyboardListeners();
            navigator.updateCards(mockCards, mockFiles);
        });
        
        it('should open focused card on Enter', () => {
            // Focus first card
            const focusEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(focusEvent);
            
            // Press Enter
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            mockContainerEl.dispatchEvent(enterEvent);
            
            expect(mockView.openFile).toHaveBeenCalledWith(mockFiles[0]);
        });
        
        it('should focus first card on Home', () => {
            // Focus middle card
            const event1 = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event1);
            const event2 = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event2);
            
            // Press Home
            const homeEvent = new KeyboardEvent('keydown', { key: 'Home' });
            mockContainerEl.dispatchEvent(homeEvent);
            
            expect(mockCards[0].classList.contains('focused')).toBe(true);
        });
        
        it('should focus last card on End', () => {
            const endEvent = new KeyboardEvent('keydown', { key: 'End' });
            mockContainerEl.dispatchEvent(endEvent);
            
            const lastIndex = mockCards.length - 1;
            expect(mockCards[lastIndex].classList.contains('focused')).toBe(true);
        });
        
        it('should clear focus on Escape (when no selection)', () => {
            // Focus a card
            const focusEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(focusEvent);
            
            expect(mockCards[0].classList.contains('focused')).toBe(true);
            
            // Press Escape
            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            mockContainerEl.dispatchEvent(escapeEvent);
            
            expect(mockCards[0].classList.contains('focused')).toBe(false);
        });
        
        it('should clear selection on Escape when selection exists', () => {
            const mockSelectionManager = {
                getSelectionCount: jest.fn().mockReturnValue(2),
                clearSelection: jest.fn()
            };
            
            (mockView as any).selectionManager = mockSelectionManager;
            
            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            mockContainerEl.dispatchEvent(escapeEvent);
            
            expect(mockSelectionManager.clearSelection).toHaveBeenCalled();
        });
    });
    
    describe('Style Management', () => {
        beforeEach(() => {
            navigator.registerKeyboardListeners();
            navigator.updateCards(mockCards, mockFiles);
        });
        
        it('should apply focused style when card is focused', () => {
            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event);
            
            const card = mockCards[0];
            expect(card.classList.contains('focused')).toBe(true);
            expect(card.style.backgroundColor).toBe('rgb(192, 192, 192)'); // #c0c0c0
        });
        
        it('should restore normal style when focus moves away', () => {
            // Focus first card
            const event1 = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event1);
            
            // Move to second card
            const event2 = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event2);
            
            const card = mockCards[0];
            expect(card.classList.contains('focused')).toBe(false);
            expect(card.style.backgroundColor).toBe('rgb(255, 255, 255)'); // #ffffff
        });
        
        it('should restore active style when active card loses focus', () => {
            const card = mockCards[0];
            card.classList.add('active');
            
            // Focus card
            const event1 = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event1);
            
            // Move away
            const event2 = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event2);
            
            expect(card.style.backgroundColor).toBe('rgb(224, 224, 224)'); // #e0e0e0
        });
    });
    
    describe('Public Methods', () => {
        beforeEach(() => {
            navigator.updateCards(mockCards, mockFiles);
        });
        
        it('should focus card by file', () => {
            navigator.focusFileCard(mockFiles[2]);
            
            expect(mockCards[2].classList.contains('focused')).toBe(true);
        });
        
        it('should handle focusing non-existent file', () => {
            const fakeFile = { path: 'nonexistent.md' } as TFile;
            
            expect(() => {
                navigator.focusFileCard(fakeFile);
            }).not.toThrow();
        });
        
        it('should focus card by element', () => {
            navigator.focusCardElement(mockCards[3]);
            
            expect(mockCards[3].classList.contains('focused')).toBe(true);
        });
        
        it('should handle focusing element not in list', () => {
            const fakeCard = document.createElement('div');
            
            expect(() => {
                navigator.focusCardElement(fakeCard);
            }).not.toThrow();
        });
    });
    
    describe('Edge Cases', () => {
        beforeEach(() => {
            navigator.registerKeyboardListeners();
        });
        
        it('should handle keyboard events with no cards', () => {
            navigator.updateCards([], []);
            
            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            
            expect(() => {
                mockContainerEl.dispatchEvent(event);
            }).not.toThrow();
        });
        
        it('should handle Enter with no focused card', () => {
            navigator.updateCards(mockCards, mockFiles);
            
            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            mockContainerEl.dispatchEvent(event);
            
            expect(mockView.openFile).not.toHaveBeenCalled();
        });
        
        it('should handle placeholder cards', () => {
            const placeholder = document.createElement('div');
            placeholder.className = 'card card-placeholder';
            document.body.appendChild(placeholder);
            
            const cardsWithPlaceholder = [...mockCards, placeholder];
            const filesWithExtra = [...mockFiles, mockFiles[0]];
            
            navigator.updateCards(cardsWithPlaceholder, filesWithExtra);
            
            // Focus placeholder
            const endEvent = new KeyboardEvent('keydown', { key: 'End' });
            mockContainerEl.dispatchEvent(endEvent);
            
            expect(placeholder.classList.contains('focused')).toBe(true);
            
            document.body.removeChild(placeholder);
        });
        
        it('should prevent default on all navigation keys', () => {
            navigator.updateCards(mockCards, mockFiles);
            
            const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Home', 'End', 'PageUp', 'PageDown'];
            
            keys.forEach(key => {
                const event = new KeyboardEvent('keydown', { key });
                const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
                
                mockContainerEl.dispatchEvent(event);
                
                expect(preventDefaultSpy).toHaveBeenCalled();
            });
        });
    });
    
    describe('Scroll Behavior', () => {
        beforeEach(() => {
            navigator.registerKeyboardListeners();
            navigator.updateCards(mockCards, mockFiles);
        });
        
        it('should scroll card into view when focused', () => {
            const scrollIntoViewSpy = jest.spyOn(mockCards[0], 'scrollIntoView');
            
            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockContainerEl.dispatchEvent(event);
            
            expect(scrollIntoViewSpy).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        });
        
        it('should handle PageDown', () => {
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'card-navigator-cards';
            mockContainerEl.appendChild(cardsContainer);
            
            const scrollBySpy = jest.spyOn(cardsContainer, 'scrollBy');
            
            const event = new KeyboardEvent('keydown', { key: 'PageDown' });
            mockContainerEl.dispatchEvent(event);
            
            expect(scrollBySpy).toHaveBeenCalled();
            
            mockContainerEl.removeChild(cardsContainer);
        });
        
        it('should handle PageUp', () => {
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'card-navigator-cards';
            mockContainerEl.appendChild(cardsContainer);
            
            const scrollBySpy = jest.spyOn(cardsContainer, 'scrollBy');
            
            const event = new KeyboardEvent('keydown', { key: 'PageUp' });
            mockContainerEl.dispatchEvent(event);
            
            expect(scrollBySpy).toHaveBeenCalled();
            
            mockContainerEl.removeChild(cardsContainer);
        });
    });
});

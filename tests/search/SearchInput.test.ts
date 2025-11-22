import { App } from 'obsidian';
import { SearchInput } from '../../src/search/SearchInput';

// Mock modules
jest.mock('../../src/search/SearchSuggest');
jest.mock('../../src/utils/performance', () => ({
    debounce: (fn: Function, delay: number) => fn
}));

describe('SearchInput', () => {
    let app: App;
    let containerEl: HTMLElement;
    let searchInput: SearchInput;
    
    beforeEach(() => {
        // Mock App
        app = {} as App;
        
        // Create container element
        containerEl = document.createElement('div');
        
        // Create SearchInput instance
        searchInput = new SearchInput(app, containerEl);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Constructor', () => {
        it('should create instance with app and container', () => {
            expect(searchInput).toBeDefined();
        });
    });
    
    describe('render()', () => {
        it('should create search input elements', () => {
            searchInput.render();
            
            const searchContainer = containerEl.querySelector('.search-input-container');
            expect(searchContainer).toBeTruthy();
            
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            expect(inputEl).toBeTruthy();
            expect(inputEl.tagName).toBe('INPUT');
            expect(inputEl.placeholder).toBe('Search cards...');
            
            const clearButton = containerEl.querySelector('.search-input-clear-button');
            expect(clearButton).toBeTruthy();
        });
        
        it('should hide clear button initially', () => {
            searchInput.render();
            
            const clearButton = containerEl.querySelector('.search-input-clear-button') as HTMLElement;
            expect(clearButton.style.display).toBe('none');
        });
    });
    
    describe('getValue()', () => {
        it('should return empty string before render', () => {
            expect(searchInput.getValue()).toBe('');
        });
        
        it('should return current input value', () => {
            searchInput.render();
            
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            inputEl.value = 'test query';
            
            expect(searchInput.getValue()).toBe('test query');
        });
    });
    
    describe('setValue()', () => {
        beforeEach(() => {
            searchInput.render();
        });
        
        it('should set input value', () => {
            searchInput.setValue('new value');
            
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            expect(inputEl.value).toBe('new value');
        });
        
        it('should show clear button when value is not empty', () => {
            searchInput.setValue('test');
            
            const clearButton = containerEl.querySelector('.search-input-clear-button') as HTMLElement;
            expect(clearButton.style.display).toBe('flex');
        });
        
        it('should hide clear button when value is empty', () => {
            searchInput.setValue('test');
            searchInput.setValue('');
            
            const clearButton = containerEl.querySelector('.search-input-clear-button') as HTMLElement;
            expect(clearButton.style.display).toBe('none');
        });
        
        it('should not trigger callback', () => {
            const callback = jest.fn();
            searchInput.onInput(callback);
            
            searchInput.setValue('test');
            
            expect(callback).not.toHaveBeenCalled();
        });
    });
    
    describe('setValueAndSearch()', () => {
        beforeEach(() => {
            searchInput.render();
        });
        
        it('should set value and dispatch input event', () => {
            const callback = jest.fn();
            searchInput.onInput(callback);
            
            searchInput.setValueAndSearch('search query');
            
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            expect(inputEl.value).toBe('search query');
            expect(callback).toHaveBeenCalledWith('search query');
        });
        
        it('should show clear button', () => {
            searchInput.setValueAndSearch('test');
            
            const clearButton = containerEl.querySelector('.search-input-clear-button') as HTMLElement;
            expect(clearButton.style.display).toBe('flex');
        });
    });
    
    describe('clear()', () => {
        beforeEach(() => {
            searchInput.render();
            searchInput.setValue('test value');
        });
        
        it('should clear input value', () => {
            searchInput.clear();
            
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            expect(inputEl.value).toBe('');
        });
        
        it('should hide clear button', () => {
            searchInput.clear();
            
            const clearButton = containerEl.querySelector('.search-input-clear-button') as HTMLElement;
            expect(clearButton.style.display).toBe('none');
        });
        
        it('should trigger callback with empty string', () => {
            const callback = jest.fn();
            searchInput.onInput(callback);
            
            searchInput.clear();
            
            expect(callback).toHaveBeenCalledWith('');
        });
    });
    
    describe('focus()', () => {
        beforeEach(() => {
            searchInput.render();
        });
        
        it('should focus input element', () => {
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            const focusSpy = jest.spyOn(inputEl, 'focus');
            
            searchInput.focus();
            
            expect(focusSpy).toHaveBeenCalled();
        });
        
        it('should handle focus before render', () => {
            const newSearchInput = new SearchInput(app, containerEl);
            
            expect(() => newSearchInput.focus()).not.toThrow();
        });
    });
    
    describe('onInput()', () => {
        beforeEach(() => {
            searchInput.render();
        });
        
        it('should register callback', () => {
            const callback = jest.fn();
            
            searchInput.onInput(callback);
            searchInput.setValueAndSearch('test');
            
            expect(callback).toHaveBeenCalledWith('test');
        });
        
        it('should use debounced callback', () => {
            const callback = jest.fn();
            searchInput.onInput(callback);
            
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            
            // Simulate user typing
            inputEl.value = 't';
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            
            inputEl.value = 'te';
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            
            inputEl.value = 'test';
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            
            // With mocked debounce (which is identity function), 
            // callback should be called for each input
            expect(callback).toHaveBeenCalledTimes(3);
        });
    });
    
    describe('Event Handlers', () => {
        beforeEach(() => {
            searchInput.render();
        });
        
        it('should show/hide clear button on input', () => {
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            const clearButton = containerEl.querySelector('.search-input-clear-button') as HTMLElement;
            
            // Type some text
            inputEl.value = 'test';
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            
            expect(clearButton.style.display).toBe('flex');
            
            // Clear text
            inputEl.value = '';
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            
            expect(clearButton.style.display).toBe('none');
        });
        
        it('should clear on clear button click', () => {
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            const clearButton = containerEl.querySelector('.search-input-clear-button') as HTMLElement;
            
            inputEl.value = 'test';
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            
            clearButton.click();
            
            expect(inputEl.value).toBe('');
            expect(clearButton.style.display).toBe('none');
        });
        
        it('should clear on Escape key', () => {
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            
            inputEl.value = 'test';
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            
            const escapeEvent = new KeyboardEvent('keydown', { 
                key: 'Escape', 
                bubbles: true,
                cancelable: true
            });
            
            inputEl.dispatchEvent(escapeEvent);
            
            expect(inputEl.value).toBe('');
        });
        
        it('should prevent default on Escape key', () => {
            const inputEl = containerEl.querySelector('.search-input') as HTMLInputElement;
            
            const escapeEvent = new KeyboardEvent('keydown', { 
                key: 'Escape', 
                bubbles: true,
                cancelable: true
            });
            
            const preventDefaultSpy = jest.spyOn(escapeEvent, 'preventDefault');
            
            inputEl.dispatchEvent(escapeEvent);
            
            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });
    
    describe('destroy()', () => {
        it('should clean up resources', () => {
            searchInput.render();
            
            searchInput.destroy();
            
            // Should not throw when calling methods after destroy
            expect(() => searchInput.getValue()).not.toThrow();
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle multiple render calls', () => {
            searchInput.render();
            const firstInput = containerEl.querySelector('.search-input');
            
            searchInput.render();
            const secondInput = containerEl.querySelector('.search-input');
            
            expect(secondInput).toBeTruthy();
        });
        
        it('should handle setValue without render', () => {
            expect(() => searchInput.setValue('test')).not.toThrow();
        });
        
        it('should handle clear without render', () => {
            expect(() => searchInput.clear()).not.toThrow();
        });
        
        it('should handle getValue without render', () => {
            expect(searchInput.getValue()).toBe('');
        });
        
        it('should handle callback without input element', () => {
            const callback = jest.fn();
            
            searchInput.onInput(callback);
            searchInput.clear();
            
            // Should not crash
            expect(callback).not.toHaveBeenCalled();
        });
    });
});
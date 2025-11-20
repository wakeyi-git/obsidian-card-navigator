import { App } from 'obsidian';
import { SearchSuggest } from './SearchSuggest';
import { debounce } from '../utils/performance';
import { TIMING } from '../constants';

/**
 * 검색 입력 필드 관리자
 * 
 * 검색 입력 필드 생성, 디바운싱, 자동완성을 제공합니다.
 * 
 * @example
 * ```typescript
 * const searchInput = new SearchInput(app, containerEl);
 * searchInput.render();
 * searchInput.onInput((query) => console.log(query));
 * ```
 */
export class SearchInput {
    private app: App;
    private containerEl: HTMLElement;
    private inputEl: HTMLInputElement | null = null;
    private clearButtonEl: HTMLElement | null = null;
    private onInputCallback: ((query: string) => void) | null = null;
    private searchSuggest: SearchSuggest | null = null;
    private debouncedCallback: ((value: string) => void) | null = null;
    
    constructor(app: App, containerEl: HTMLElement) {
        this.app = app;
        this.containerEl = containerEl;
    }
    
    /**
     * 검색 입력 UI를 렌더링합니다
     */
    render(): void {
        const searchContainer = this.containerEl.createEl('div', {
            cls: 'search-input-container'
        });
        
        this.inputEl = searchContainer.createEl('input', {
            cls: 'search-input',
            attr: {
                type: 'text',
                placeholder: 'Search cards...'
            }
        }) as HTMLInputElement;
        
        this.searchSuggest = new SearchSuggest(this.app, this.inputEl);
        
        this.clearButtonEl = searchContainer.createEl('div', {
            cls: 'search-input-clear-button',
            attr: {
                'aria-label': 'Clear search'
            }
        });
        
        this.clearButtonEl.style.display = 'none';
        
        this.setupEventListeners();
    }
    
    /**
     * 이벤트 리스너를 설정합니다
     */
    private setupEventListeners(): void {
        if (!this.inputEl || !this.clearButtonEl) {
            return;
        }
        
        this.inputEl.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const value = target.value;
            
            if (this.clearButtonEl) {
                this.clearButtonEl.style.display = value ? 'flex' : 'none';
            }
            
            if (this.debouncedCallback) {
                this.debouncedCallback(value);
            }
        });
        
        this.clearButtonEl.addEventListener('click', () => {
            this.clear();
        });
        
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clear();
                e.preventDefault();
            }
        });
    }
    
    /**
     * 입력 콜백을 설정합니다
     * 
     * @param callback - 검색어가 변경될 때 호출될 함수 (디바운싱 적용)
     */
    onInput(callback: (query: string) => void): void {
        this.onInputCallback = callback;
        this.debouncedCallback = debounce(callback, TIMING.SEARCH_DEBOUNCE_DELAY);
    }
    
    /**
     * 검색 입력을 지웁니다
     */
    clear(): void {
        if (this.inputEl) {
            this.inputEl.value = '';
            
            if (this.clearButtonEl) {
                this.clearButtonEl.style.display = 'none';
            }
            
            if (this.onInputCallback) {
                this.onInputCallback('');
            }
        }
    }
    
    /**
     * 검색 입력 필드에 포커스를 설정합니다
     */
    focus(): void {
        if (this.inputEl) {
            this.inputEl.focus();
        }
    }
    
    /**
     * 현재 검색어를 반환합니다
     * 
     * @returns 현재 검색어
     */
    getValue(): string {
        return this.inputEl?.value || '';
    }
    
    /**
     * 검색어를 설정합니다
     * 
     * @param value - 설정할 검색어
     */
    setValue(value: string): void {
        if (this.inputEl) {
            this.inputEl.value = value;
            
            if (this.clearButtonEl) {
                this.clearButtonEl.style.display = value ? 'flex' : 'none';
            }
        }
    }
    
    /**
     * 검색어를 설정하고 검색을 실행합니다
     * 
     * @param value - 설정할 검색어
     * 
     * @remarks
     * setValue()와 달리 input 이벤트를 발생시켜 즉시 검색을 실행합니다.
     */
    setValueAndSearch(value: string): void {
        if (this.inputEl) {
            this.inputEl.value = value;
            
            if (this.clearButtonEl) {
                this.clearButtonEl.style.display = value ? 'flex' : 'none';
            }
            
            const event = new Event('input', { bubbles: true });
            this.inputEl.dispatchEvent(event);
        }
    }
    
    /**
     * 정리 작업
     */
    destroy(): void {
        this.searchSuggest = null;
        this.debouncedCallback = null;
    }
}

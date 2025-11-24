import { App, setIcon } from 'obsidian';
import { SearchSuggest } from './SearchSuggest';
import { debounce } from '../utils/performance';
import { TIMING } from '../constants';
import { CardNavigatorSettings } from '../types';

/**
 * 검색 입력 필드 관리자
 *
 * 검색 입력 필드 생성, 디바운싱, 자동완성을 제공합니다.
 *
 * @example
 * ```typescript
 * const searchInput = new SearchInput(app, containerEl, settings, saveSettings);
 * searchInput.render();
 * searchInput.onInput((query) => console.log(query));
 * ```
 */
export class SearchInput {
    private app: App;
    private containerEl: HTMLElement;
    private inputEl: HTMLInputElement | null = null;
    private clearButtonEl: HTMLElement | null = null;
    private caseSensitiveToggleEl: HTMLElement | null = null;
    private onInputCallback: ((query: string) => void) | null = null;
    private searchSuggest: SearchSuggest | null = null;
    private debouncedCallback: ((value: string) => void) | null = null;
    private settings: CardNavigatorSettings;
    private saveSettings: () => Promise<void>;

    constructor(
        app: App,
        containerEl: HTMLElement,
        settings: CardNavigatorSettings,
        saveSettings: () => Promise<void>
    ) {
        this.app = app;
        this.containerEl = containerEl;
        this.settings = settings;
        this.saveSettings = saveSettings;
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

        // 대소문자 구분 토글 버튼 (Obsidian 표준 clickable-icon 스타일)
        this.caseSensitiveToggleEl = searchContainer.createEl('div', {
            cls: 'clickable-icon search-input-case-sensitive-toggle',
            attr: {
                'aria-label': 'Toggle case sensitive search'
            }
        });

        setIcon(this.caseSensitiveToggleEl, 'case-sensitive');
        this.updateCaseSensitiveIcon();

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
        if (!this.inputEl || !this.clearButtonEl || !this.caseSensitiveToggleEl) {
            return;
        }

        this.inputEl.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const value = target.value;

            if (this.clearButtonEl && this.caseSensitiveToggleEl) {
                if (value) {
                    this.clearButtonEl.style.display = 'flex';
                    this.caseSensitiveToggleEl.classList.add('shifted');
                } else {
                    this.clearButtonEl.style.display = 'none';
                    this.caseSensitiveToggleEl.classList.remove('shifted');
                }
            }

            if (this.debouncedCallback) {
                this.debouncedCallback(value);
            }
        });

        this.clearButtonEl.addEventListener('click', () => {
            this.clear();
        });

        this.caseSensitiveToggleEl.addEventListener('click', async () => {
            this.settings.caseSensitiveSearch = !this.settings.caseSensitiveSearch;
            await this.saveSettings();
            this.updateCaseSensitiveIcon();

            // 검색어가 있으면 즉시 재검색
            if (this.inputEl && this.inputEl.value && this.onInputCallback) {
                this.onInputCallback(this.inputEl.value);
            }
        });

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clear();
                e.preventDefault();
            }
        });
    }

    /**
     * 대소문자 구분 아이콘 상태를 업데이트합니다
     */
    private updateCaseSensitiveIcon(): void {
        if (!this.caseSensitiveToggleEl) {
            return;
        }

        if (this.settings.caseSensitiveSearch) {
            this.caseSensitiveToggleEl.classList.add('is-active');
        } else {
            this.caseSensitiveToggleEl.classList.remove('is-active');
        }
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

            if (this.caseSensitiveToggleEl) {
                this.caseSensitiveToggleEl.classList.remove('shifted');
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

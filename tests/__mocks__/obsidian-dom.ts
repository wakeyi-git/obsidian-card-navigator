/**
 * Obsidian DOM API Mocking
 * 
 * HTMLElement에 Obsidian 확장 메서드를 추가합니다.
 */

// HTMLElement 확장 메서드
declare global {
    interface HTMLElement {
        createEl<K extends keyof HTMLElementTagNameMap>(
            tag: K,
            options?: {
                cls?: string | string[];
                text?: string;
                attr?: Record<string, string>;
                prepend?: boolean;
            }
        ): HTMLElementTagNameMap[K];
        
        createDiv(options?: {
            cls?: string | string[];
            text?: string;
            attr?: Record<string, string>;
            prepend?: boolean;
        }): HTMLDivElement;
        
        createSpan(options?: {
            cls?: string | string[];
            text?: string;
            attr?: Record<string, string>;
            prepend?: boolean;
        }): HTMLSpanElement;
        
        addClass(...classes: string[]): void;
        removeClass(...classes: string[]): void;
        toggleClass(classes: string | string[], force?: boolean): void;
        hasClass(cls: string): boolean;
        empty(): void;
        detach(): void;
    }
}

/**
 * Obsidian HTMLElement 확장 메서드 구현
 */
export function setupObsidianDomMocks(): void {
    // createEl 구현
    HTMLElement.prototype.createEl = function<K extends keyof HTMLElementTagNameMap>(
        tag: K,
        options?: {
            cls?: string | string[];
            text?: string;
            attr?: Record<string, string>;
            prepend?: boolean;
        }
    ): HTMLElementTagNameMap[K] {
        const el = document.createElement(tag);
        
        if (options?.cls) {
            const classes = Array.isArray(options.cls) ? options.cls : [options.cls];
            el.classList.add(...classes);
        }
        
        if (options?.text) {
            el.textContent = options.text;
        }
        
        if (options?.attr) {
            Object.entries(options.attr).forEach(([key, value]) => {
                el.setAttribute(key, value);
            });
        }
        
        if (options?.prepend) {
            this.prepend(el);
        } else {
            this.appendChild(el);
        }
        
        return el;
    };
    
    // createDiv 구현
    HTMLElement.prototype.createDiv = function(options?) {
        return this.createEl('div', options);
    };
    
    // createSpan 구현
    HTMLElement.prototype.createSpan = function(options?) {
        return this.createEl('span', options);
    };
    
    // addClass 구현
    HTMLElement.prototype.addClass = function(...classes: string[]) {
        this.classList.add(...classes.filter(c => c && c.trim()));
    };
    
    // removeClass 구현
    HTMLElement.prototype.removeClass = function(...classes: string[]) {
        this.classList.remove(...classes.filter(c => c && c.trim()));
    };
    
    // toggleClass 구현
    HTMLElement.prototype.toggleClass = function(classes: string | string[], force?: boolean) {
        const classList = Array.isArray(classes) ? classes : [classes];
        classList.forEach(cls => {
            if (cls && cls.trim()) {
                if (force !== undefined) {
                    this.classList.toggle(cls, force);
                } else {
                    this.classList.toggle(cls);
                }
            }
        });
    };
    
    // hasClass 구현
    HTMLElement.prototype.hasClass = function(cls: string): boolean {
        return this.classList.contains(cls);
    };
    
    // empty 구현
    HTMLElement.prototype.empty = function() {
        while (this.firstChild) {
            this.removeChild(this.firstChild);
        }
    };
    
    // detach 구현
    HTMLElement.prototype.detach = function() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    };
}
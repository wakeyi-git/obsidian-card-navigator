/**
 * Obsidian API Mock
 * 테스트를 위한 최소한의 Obsidian API 모킹
 */

// TFile Mock
export class TFile {
    path: string;
    basename: string;
    extension: string;
    name: string;
    parent: any;
    stat: any;
    
    constructor(path?: string) {
        this.path = path || '';
        this.name = this.path ? this.path.split('/').pop() || '' : '';
        this.basename = this.name.replace(/\.[^/.]+$/, '');
        this.extension = this.name.includes('.') ? this.name.split('.').pop() || '' : '';
        this.parent = null;
        this.stat = {
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0
        };
    }
}

// TFolder Mock
export class TFolder {
    path: string;
    name: string;
    children: any[];
    parent: any;
    
    constructor(path?: string) {
        this.path = path || '';
        this.name = this.path ? this.path.split('/').pop() || '' : '';
        this.children = [];
        this.parent = null;
    }
}

// TAbstractFile Mock (base class)
export class TAbstractFile {
    path: string;
    name: string;
    parent: any;
    
    constructor(path?: string) {
        this.path = path || '';
        this.name = this.path ? this.path.split('/').pop() || '' : '';
        this.parent = null;
    }
}

// App Mock
export class App {
    vault: any;
    workspace: any;
    metadataCache: any;
    fileManager: any;
    
    constructor() {
        // Mock root folder
        const rootFolder = new TFolder('');
        rootFolder.name = '/';
        rootFolder.path = '/';
        
        this.vault = {
            read: jest.fn(),
            modify: jest.fn(),
            getAbstractFileByPath: jest.fn(),
            getRoot: jest.fn(() => rootFolder),
            getMarkdownFiles: jest.fn(() => []),
            getAllLoadedFiles: jest.fn(() => []),
            on: jest.fn(() => ({ unload: jest.fn() }))
        };
        this.workspace = {
            getActiveFile: jest.fn(),
            openLinkText: jest.fn(),
            on: jest.fn(() => ({ unload: jest.fn() }))
        };
        this.metadataCache = {
            getFirstLinkpathDest: jest.fn(),
            getFileCache: jest.fn(() => ({
                links: [],
                tags: [],
                headings: []
            })),
            on: jest.fn(() => ({ unload: jest.fn() }))
        };
        this.fileManager = {
            renameFile: jest.fn(),
            processFrontMatter: jest.fn((file, fn) => {
                // Mock processFrontMatter - just call the callback with empty frontmatter
                fn({});
                return Promise.resolve();
            })
        };
    }
}

// Notice Mock
export class Notice {
    message: string;
    timeout: number;
    
    constructor(message: string, timeout?: number) {
        this.message = message;
        this.timeout = timeout || 5000;
    }
}

// PluginSettingTab Mock
export class PluginSettingTab {
    containerEl: any;
    app: App;
    plugin: any;
    
    constructor(app: App, plugin: any) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = {
            empty: jest.fn(),
            createEl: jest.fn(),
            createDiv: jest.fn()
        };
    }
    
    display(): void {
        // Mock implementation
    }
    
    hide(): void {
        // Mock implementation
    }
}

// ItemView Mock
export class ItemView {
    app: App;
    containerEl: any;
    leaf: any;
    
    constructor(leaf: any) {
        this.leaf = leaf;
        this.app = new App();
        this.containerEl = {
            empty: jest.fn(),
            createEl: jest.fn(),
            createDiv: jest.fn(),
            appendChild: jest.fn()
        };
    }
    
    getViewType(): string {
        return 'mock-view';
    }
    
    getDisplayText(): string {
        return 'Mock View';
    }
    
    async onOpen(): Promise<void> {
        // Mock implementation
    }
    
    async onClose(): Promise<void> {
        // Mock implementation
    }
}

// Modal Mock
export class Modal {
    app: App;
    containerEl: any;
    titleEl: any;
    contentEl: any;
    
    constructor(app: App) {
        this.app = app;
        this.containerEl = {
            empty: jest.fn(),
            createEl: jest.fn(),
            createDiv: jest.fn(),
            appendChild: jest.fn()
        };
        this.titleEl = {
            setText: jest.fn()
        };
        this.contentEl = {
            empty: jest.fn(),
            createEl: jest.fn(),
            createDiv: jest.fn(),
            appendChild: jest.fn()
        };
    }
    
    open(): void {
        // Mock implementation
    }
    
    close(): void {
        // Mock implementation
    }
    
    onOpen(): void {
        // Mock implementation
    }
    
    onClose(): void {
        // Mock implementation
    }
}

// Setting Mock
export class Setting {
    settingEl: any;
    containerEl: any;
    
    constructor(containerEl: any) {
        this.containerEl = containerEl;
        this.settingEl = {
            empty: jest.fn(),
            createEl: jest.fn()
        };
    }
    
    setName(name: string): this {
        return this;
    }
    
    setDesc(desc: string): this {
        return this;
    }
    
    setHeading(): this {
        return this;
    }
    
    addText(cb: (text: any) => void): this {
        const textComponent = {
            setPlaceholder: jest.fn().mockReturnThis(),
            setValue: jest.fn().mockReturnThis(),
            onChange: jest.fn().mockReturnThis(),
            inputEl: {}
        };
        cb(textComponent);
        return this;
    }
    
    addToggle(cb: (toggle: any) => void): this {
        const toggleComponent = {
            setValue: jest.fn().mockReturnThis(),
            onChange: jest.fn().mockReturnThis(),
            toggleEl: {}
        };
        cb(toggleComponent);
        return this;
    }
    
    addDropdown(cb: (dropdown: any) => void): this {
        const dropdownComponent = {
            addOption: jest.fn().mockReturnThis(),
            setValue: jest.fn().mockReturnThis(),
            onChange: jest.fn().mockReturnThis(),
            selectEl: {}
        };
        cb(dropdownComponent);
        return this;
    }
    
    addButton(cb: (button: any) => void): this {
        const buttonComponent = {
            setButtonText: jest.fn().mockReturnThis(),
            setCta: jest.fn().mockReturnThis(),
            onClick: jest.fn().mockReturnThis(),
            buttonEl: {}
        };
        cb(buttonComponent);
        return this;
    }
}

// Plugin Mock
export class Plugin {
    app: App;
    manifest: any;
    
    constructor(app: App, manifest: any) {
        this.app = app;
        this.manifest = manifest || {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0'
        };
    }
    
    async loadData(): Promise<any> {
        return null;
    }
    
    async saveData(data: any): Promise<void> {
        // Mock implementation
    }
    
    addRibbonIcon(icon: string, title: string, callback: () => void): any {
        return { remove: jest.fn() };
    }
    
    addCommand(command: any): void {
        // Mock implementation
    }
    
    registerView(type: string, viewCreator: any): void {
        // Mock implementation
    }
    
    addSettingTab(tab: any): void {
        // Mock implementation
    }
}

// FuzzySuggestModal Mock
export class FuzzySuggestModal<T> {
    app: App;
    inputEl: any;
    resultContainerEl: any;
    
    constructor(app: App) {
        this.app = app;
        this.inputEl = {
            value: '',
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };
        this.resultContainerEl = {
            empty: jest.fn(),
            createEl: jest.fn(),
            createDiv: jest.fn()
        };
    }
    
    open(): void {
        // Mock implementation
    }
    
    close(): void {
        // Mock implementation
    }
    
    setPlaceholder(placeholder: string): void {
        // Mock implementation
    }
    
    getItems(): T[] {
        return [];
    }
    
    getItemText(item: T): string {
        return String(item);
    }
    
    onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void {
        // Mock implementation
    }
}

// WorkspaceLeaf Mock
export class WorkspaceLeaf {
    view: any;
    
    constructor() {
        this.view = null;
    }
    
    getViewState(): any {
        return {};
    }
    
    setViewState(state: any): Promise<void> {
        return Promise.resolve();
    }
}

// AbstractInputSuggest Mock
export class AbstractInputSuggest<T> {
    app: App;
    inputEl: HTMLInputElement;
    
    constructor(app: App, inputEl: HTMLInputElement) {
        this.app = app;
        this.inputEl = inputEl;
    }
    
    getSuggestions(query: string): T[] {
        return [];
    }
    
    renderSuggestion(value: T, el: HTMLElement): void {
        // Mock implementation
    }
    
    selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void {
        // Mock implementation
    }
    
    open(): void {
        // Mock implementation
    }
    
    close(): void {
        // Mock implementation
    }
}

// setIcon Mock - Obsidian utility function
export function setIcon(parent: HTMLElement, iconId: string, size?: number): void {
    // Mock implementation - just set a data attribute for testing
    parent.setAttribute('data-icon', iconId);
    if (size) {
        parent.setAttribute('data-icon-size', String(size));
    }
}

// Export all mocks
export default {
    TFile,
    TFolder,
    TAbstractFile,
    App,
    Notice,
    PluginSettingTab,
    ItemView,
    Modal,
    FuzzySuggestModal,
    Setting,
    Plugin,
    WorkspaceLeaf,
    AbstractInputSuggest,
    setIcon
};

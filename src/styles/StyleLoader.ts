/**
 * StyleLoader - Conditional CSS Loading System
 *
 * Provides lazy loading of feature-specific CSS to reduce initial load time.
 * Critical CSS is loaded on plugin startup, while feature CSS is loaded on demand.
 *
 * Architecture:
 * - Critical CSS: variables, container, toolbar, cards, search (~17KB)
 * - Feature CSS: settings, presets, modals, selection, etc. (lazy loaded)
 */

export type FeatureStyleModule =
    | 'settings'       // Settings tab UI
    | 'presets'        // Preset management UI
    | 'modals'         // All modal dialogs
    | 'selection'      // Multi-selection system
    | 'dragdrop'       // Drag & drop interactions
    | 'filter'         // Filter modal and UI
    | 'grouping'       // Grouping and folder styles
    | 'contextmenu'    // Context menu styles
    | 'hoveractions'   // Card hover action buttons
    | 'multisort';     // Multi-level sort UI

/**
 * CSS content for each feature module
 * These will be populated from the build process or inline
 */
const FEATURE_STYLES: Record<FeatureStyleModule, string> = {
    settings: '',
    presets: '',
    modals: '',
    selection: '',
    dragdrop: '',
    filter: '',
    grouping: '',
    contextmenu: '',
    hoveractions: '',
    multisort: ''
};

/**
 * StyleLoader manages conditional loading of CSS modules
 */
export class StyleLoader {
    private loadedModules: Set<FeatureStyleModule> = new Set();
    private styleElements: Map<FeatureStyleModule, HTMLStyleElement> = new Map();
    private criticalStyleEl: HTMLStyleElement | null = null;

    /**
     * Initialize the StyleLoader
     * Critical CSS should be loaded immediately on plugin load
     */
    constructor() {
        // Constructor - critical CSS is loaded via styles.css by Obsidian
    }

    /**
     * Check if a module is already loaded
     */
    isLoaded(module: FeatureStyleModule): boolean {
        return this.loadedModules.has(module);
    }

    /**
     * Load a feature CSS module
     * Returns immediately if already loaded
     */
    async loadModule(module: FeatureStyleModule): Promise<void> {
        if (this.loadedModules.has(module)) {
            return;
        }

        const cssContent = FEATURE_STYLES[module];
        if (!cssContent) {
            // Module has no CSS content (might be bundled with critical CSS)
            this.loadedModules.add(module);
            return;
        }

        // Create and inject style element
        const styleEl = document.createElement('style');
        styleEl.id = `card-navigator-feature-${module}`;
        styleEl.setAttribute('data-module', module);
        styleEl.textContent = cssContent;

        document.head.appendChild(styleEl);

        this.styleElements.set(module, styleEl);
        this.loadedModules.add(module);
    }

    /**
     * Load multiple modules at once
     */
    async loadModules(modules: FeatureStyleModule[]): Promise<void> {
        await Promise.all(modules.map(m => this.loadModule(m)));
    }

    /**
     * Unload a feature CSS module
     */
    unloadModule(module: FeatureStyleModule): void {
        const styleEl = this.styleElements.get(module);
        if (styleEl) {
            styleEl.remove();
            this.styleElements.delete(module);
        }
        this.loadedModules.delete(module);
    }

    /**
     * Unload all feature modules
     */
    unloadAll(): void {
        for (const [, styleEl] of this.styleElements) {
            styleEl.remove();
        }
        this.styleElements.clear();
        this.loadedModules.clear();
    }

    /**
     * Get list of currently loaded modules
     */
    getLoadedModules(): FeatureStyleModule[] {
        return Array.from(this.loadedModules);
    }

    /**
     * Preload common feature modules
     * Call this after initial render to prepare frequently used features
     */
    async preloadCommonModules(): Promise<void> {
        // Preload modules that are frequently accessed
        await this.loadModules(['selection', 'contextmenu']);
    }

    /**
     * Load settings-related styles
     * Call when opening settings tab
     */
    async loadSettingsStyles(): Promise<void> {
        await this.loadModules(['settings', 'presets']);
    }

    /**
     * Load modal-related styles
     * Call before opening any modal
     */
    async loadModalStyles(): Promise<void> {
        await this.loadModule('modals');
    }

    /**
     * Load selection system styles
     * Call when multi-selection is enabled
     */
    async loadSelectionStyles(): Promise<void> {
        await this.loadModules(['selection', 'dragdrop']);
    }

    /**
     * Load filter UI styles
     * Call when filter modal is opened
     */
    async loadFilterStyles(): Promise<void> {
        await this.loadModules(['filter', 'modals']);
    }

    /**
     * Load grouping styles
     * Call when grouping mode is enabled
     */
    async loadGroupingStyles(): Promise<void> {
        await this.loadModule('grouping');
    }

    /**
     * Load hover actions styles
     * Call when hover actions feature is enabled in settings
     */
    async loadHoverActionsStyles(): Promise<void> {
        await this.loadModule('hoveractions');
    }

    /**
     * Load multi-sort UI styles
     * Call when multi-sort modal is opened
     */
    async loadMultiSortStyles(): Promise<void> {
        await this.loadModules(['multisort', 'modals']);
    }

    /**
     * Register CSS content for a module
     * Used by build system to inject CSS content
     */
    static registerModuleCSS(module: FeatureStyleModule, css: string): void {
        FEATURE_STYLES[module] = css;
    }

    /**
     * Register multiple module CSS contents at once
     */
    static registerAllModuleCSS(modules: Partial<Record<FeatureStyleModule, string>>): void {
        Object.assign(FEATURE_STYLES, modules);
    }
}

// Singleton instance for global access
let styleLoaderInstance: StyleLoader | null = null;

/**
 * Get the singleton StyleLoader instance
 */
export function getStyleLoader(): StyleLoader {
    if (!styleLoaderInstance) {
        styleLoaderInstance = new StyleLoader();
    }
    return styleLoaderInstance;
}

/**
 * Reset the StyleLoader instance (for testing or cleanup)
 */
export function resetStyleLoader(): void {
    if (styleLoaderInstance) {
        styleLoaderInstance.unloadAll();
        styleLoaderInstance = null;
    }
}

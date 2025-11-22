import { CardNavigatorSettings, LayoutMode, RenderMode, ScrollBehaviorMode, TagClickAction } from '../../src/types';

/**
 * 테스트용 기본 설정을 생성합니다
 * 
 * 필요한 속성만 오버라이드하여 사용할 수 있습니다.
 * 
 * @example
 * const settings = createMockSettings({
 *   dragDrop: {
 *     contentType: 'full-content'
 *   }
 * });
 */
export function createMockSettings(overrides?: Partial<CardNavigatorSettings>): CardNavigatorSettings {
    const defaultSettings: CardNavigatorSettings = {
        language: 'en',
        enablePresets: false,
        header: {
            enabled: true,
            contentType: 'filename',
            maxLength: 50,
            contentRenderMode: 'plain' as RenderMode,
            includeFirstHeader: false,
            normalStyle: {
                fontSize: 14,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0
            },
            activeStyle: {
                fontSize: 14,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0
            },
            focusedStyle: {
                fontSize: 14,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0
            }
        },
        body: {
            enabled: true,
            contentType: 'content',
            maxLength: 200,
            contentRenderMode: 'plain' as RenderMode,
            includeFirstHeader: false,
            normalStyle: {
                fontSize: 12,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0
            },
            activeStyle: {
                fontSize: 12,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0
            },
            focusedStyle: {
                fontSize: 12,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0
            }
        },
        footer: {
            enabled: true,
            contentType: 'modified-date',
            contentRenderMode: 'plain' as RenderMode,
            includeFirstHeader: false,
            normalStyle: {
                fontSize: 10,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0
            },
            activeStyle: {
                fontSize: 10,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0
            },
            focusedStyle: {
                fontSize: 10,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0
            }
        },
        renderMode: 'plain' as RenderMode,
        normalCardStyle: {
            backgroundColor: '#ffffff',
            fontSize: 12,
            borderColor: '#cccccc',
            borderWidth: 1,
            borderRadius: 4
        },
        activeCardStyle: {
            backgroundColor: '#f0f8ff',
            fontSize: 12,
            borderColor: '#0066cc',
            borderWidth: 2,
            borderRadius: 4
        },
        focusedCardStyle: {
            backgroundColor: '#e6f2ff',
            fontSize: 12,
            borderColor: '#0066cc',
            borderWidth: 2,
            borderRadius: 4
        },
        currentMode: 'folder',
        folderMode: {
            useActiveFolder: true,
            includeSubfolders: false
        },
        tagMode: {
            useActiveFileTags: true,
            specifiedTags: [],
            tagOperator: 'OR'
        },
        layout: {
            mode: 'vertical' as LayoutMode,
            cardMinWidth: 200,
            cardMinHeight: 100,
            cardMaxWidth: 400,
            cardMaxHeight: 600,
            gap: 16
        },
        sort: {
            criteria: 'modified',
            order: 'desc'
        },
        scrollBehavior: 'nearest' as ScrollBehaviorMode,
        tagClickAction: 'plugin-search' as TagClickAction,
        dragDrop: {
            contentType: 'link',
            fullContentOptions: {
                includeFrontmatter: false,
                enableLengthLimit: true,
                maxLength: 1000
            }
        },
        debug: {
            enabled: false,
            categories: {}
        },
        presets: [],
        presetMappings: [],
        presetPriority: {
            mode: 'auto',
            manualType: 'tag-first'
        },
        savedSearches: [],
        enableFuzzySearch: false,
        fuzzySearchThreshold: 0.3
    };
    
    // Deep merge overrides
    return deepMerge(defaultSettings, overrides || {});
}

/**
 * Deep merge utility for settings
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };
    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            const sourceValue = source[key];
            const targetValue = result[key];
            
            if (sourceValue !== undefined) {
                if (isObject(sourceValue) && isObject(targetValue)) {
                    result[key] = deepMerge(targetValue, sourceValue as any) as any;
                } else {
                    result[key] = sourceValue as any;
                }
            }
        }
    }
    
    return result;
}

function isObject(value: any): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
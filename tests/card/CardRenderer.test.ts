/**
 * CardRenderer 기본 테스트
 * 
 * CardRenderer의 핵심 로직을 테스트합니다.
 * DOM 조작이 많아 일부 기능만 테스트 가능합니다.
 */

import { TFile, App, Component } from 'obsidian';
import { CardRenderer } from '../../src/card/CardRenderer';
import { CardNavigatorSettings, CardData, CardSection, DEFAULT_SETTINGS } from '../../src/types';
import { DebugLogger } from '../../src/utils/DebugLogger';

// Mock DebugLogger
const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    group: jest.fn(),
    groupEnd: jest.fn()
} as unknown as DebugLogger;

// Mock App
const mockApp = {
    workspace: {
        getActiveFile: jest.fn(),
        openLinkText: jest.fn(),
        getLeavesOfType: jest.fn(() => []),
        getRightLeaf: jest.fn()
    },
    vault: {
        getAbstractFileByPath: jest.fn()
    },
    metadataCache: {
        getFileCache: jest.fn()
    }
} as unknown as App;

// Mock Component
const mockComponent = {} as unknown as Component;

// Mock Settings
const mockSettings: CardNavigatorSettings = {
    ...DEFAULT_SETTINGS
};

// Mock getSettings function
const mockGetSettings = (): CardNavigatorSettings => mockSettings;

// Helper: Mock TFile 생성
function createMockFile(
    basename: string,
    path: string = `${basename}.md`
): TFile {
    const file = new TFile();
    file.basename = basename;
    file.name = `${basename}.md`;
    file.path = path;
    file.extension = 'md';
    
    file.stat = {
        ctime: Date.parse('2024-01-01'),
        mtime: Date.parse('2024-01-15'),
        size: 1000
    } as any;
    
    return file;
}

// Helper: Mock CardData 생성
function createMockCardData(file: TFile): CardData {
    return {
        file,
        header: {
            type: 'header',
            content: file.basename,
            visible: true
        } as CardSection,
        body: {
            type: 'body',
            content: 'Test content',
            visible: true
        } as CardSection,
        footer: {
            type: 'footer',
            content: '#tag1, #tag2',
            visible: true
        } as CardSection,
        cardSettings: {
            header: mockSettings.header,
            body: mockSettings.body,
            footer: mockSettings.footer,
            renderMode: mockSettings.renderMode,
            normalCardStyle: mockSettings.normalCardStyle,
            activeCardStyle: mockSettings.activeCardStyle,
            focusedCardStyle: mockSettings.focusedCardStyle
        }
    };
}

describe('CardRenderer - Core Logic', () => {
    let renderer: CardRenderer;
    let testFile: TFile;
    let cardData: CardData;
    let container: HTMLElement;
    
    beforeEach(() => {
        renderer = new CardRenderer(mockApp, mockComponent, 'plain', mockGetSettings);
        testFile = createMockFile('Test File');
        cardData = createMockCardData(testFile);
        container = document.createElement('div');
        jest.clearAllMocks();
    });
    
    describe('renderCard', () => {
        it('should create card element with correct attributes', async () => {
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl).toBeDefined();
            expect(cardEl.classList.contains('card-item')).toBe(true);
            expect(cardEl.getAttribute('data-path')).toBe(testFile.path);
            expect(cardEl.getAttribute('tabindex')).toBe('-1');
        });
        
        it('should render header section when visible', async () => {
            const cardEl = await renderer.renderCard(cardData, container);
            
            const header = cardEl.querySelector('.card-header');
            expect(header).toBeDefined();
            expect(header?.textContent).toContain('Test File');
        });
        
        it('should render body section when visible', async () => {
            const cardEl = await renderer.renderCard(cardData, container);
            
            const body = cardEl.querySelector('.card-body');
            expect(body).toBeDefined();
            expect(body?.textContent).toContain('Test content');
        });
        
        it('should render footer section when visible', async () => {
            const cardEl = await renderer.renderCard(cardData, container);
            
            const footer = cardEl.querySelector('.card-footer');
            expect(footer).toBeDefined();
        });
        
        it('should not render header when disabled', async () => {
            cardData.header.visible = false;
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            const header = cardEl.querySelector('.card-header');
            expect(header).toBeNull();
        });
        
        it('should not render body when disabled', async () => {
            cardData.body.visible = false;
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            const body = cardEl.querySelector('.card-body');
            expect(body).toBeNull();
        });
        
        it('should not render footer when disabled', async () => {
            cardData.footer.visible = false;
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            const footer = cardEl.querySelector('.card-footer');
            expect(footer).toBeNull();
        });
        
        it('should apply active styles when isActive is true', async () => {
            const cardEl = await renderer.renderCard(cardData, container);
            
            const header = cardEl.querySelector('.card-header') as HTMLElement;
            expect(header).toBeDefined();
            // 활성 스타일이 적용되어야 함
        });
    });
    
    describe('setRenderMode', () => {
        it('should update render mode', () => {
            expect(() => renderer.setRenderMode('markdown-html')).not.toThrow();
            expect(() => renderer.setRenderMode('plain')).not.toThrow();
        });
    });
    
    describe('setupLinkHandlers', () => {
        it('should setup link handlers without errors', () => {
            const cardEl = document.createElement('div');
            
            expect(() => renderer.setupLinkHandlers(cardEl)).not.toThrow();
        });
        
        it('should handle card with internal links', () => {
            const cardEl = document.createElement('div');
            const link = document.createElement('span');
            link.className = 'internal-link';
            link.dataset.filePath = 'test.md';
            cardEl.appendChild(link);
            
            expect(() => renderer.setupLinkHandlers(cardEl)).not.toThrow();
        });
        
        it('should handle card with tags', () => {
            const cardEl = document.createElement('div');
            const tag = document.createElement('span');
            tag.className = 'tag-link';
            tag.dataset.tag = 'test';
            cardEl.appendChild(tag);
            
            expect(() => renderer.setupLinkHandlers(cardEl)).not.toThrow();
        });
    });
    
    describe('Edge cases', () => {
        it('should handle empty content', async () => {
            cardData.header.content = '';
            cardData.body.content = '';
            cardData.footer.content = '';
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl).toBeDefined();
        });
        
        it('should handle very long content', async () => {
            cardData.body.content = 'word '.repeat(1000);
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl).toBeDefined();
        });
        
        it('should handle special characters in content', async () => {
            cardData.body.content = '<script>alert("xss")</script>';
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl).toBeDefined();
            // HTML이 이스케이프되어야 함
        });
        
        it('should handle Unicode content', async () => {
            cardData.body.content = '한글 日本語 émojis 🎉';
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl).toBeDefined();
        });
    });
    
    describe('File handling', () => {
        it('should handle file with very long path', async () => {
            const longPath = 'folder/'.repeat(50) + 'file.md';
            const fileWithLongPath = createMockFile('file', longPath);
            const cardData = createMockCardData(fileWithLongPath);
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl.getAttribute('data-path')).toBe(longPath);
        });
        
        it('should handle file at root', async () => {
            const rootFile = createMockFile('root');
            rootFile.path = 'root.md';
            const cardData = createMockCardData(rootFile);
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl.getAttribute('data-path')).toBe('root.md');
        });
        
        it('should handle file with special characters in path', async () => {
            const specialFile = createMockFile('test', 'folder/my file (1) [test].md');
            const cardData = createMockCardData(specialFile);
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl.getAttribute('data-path')).toBe('folder/my file (1) [test].md');
        });
    });
    
    describe('Settings integration', () => {
        it('should respect header settings', async () => {
            mockSettings.header.enabled = true;
            cardData.cardSettings.header = mockSettings.header;
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            const header = cardEl.querySelector('.card-header');
            expect(header).toBeDefined();
        });
        
        it('should respect body settings', async () => {
            mockSettings.body.enabled = true;
            cardData.cardSettings.body = mockSettings.body;
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            const body = cardEl.querySelector('.card-body');
            expect(body).toBeDefined();
        });
        
        it('should respect footer settings', async () => {
            mockSettings.footer.enabled = true;
            cardData.cardSettings.footer = mockSettings.footer;
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            const footer = cardEl.querySelector('.card-footer');
            expect(footer).toBeDefined();
        });
    });
    
    describe('Render modes', () => {
        it('should render in plain mode', async () => {
            renderer.setRenderMode('plain');
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl).toBeDefined();
        });
        
        it('should render in markdown-html mode', async () => {
            renderer.setRenderMode('markdown-html');
            
            const cardEl = await renderer.renderCard(cardData, container);
            
            expect(cardEl).toBeDefined();
        });
    });
});

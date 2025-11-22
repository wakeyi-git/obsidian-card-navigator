/**
 * CardRenderer 확장 테스트
 * 
 * 미커버 영역 (56.87% → 85% 목표):
 * - 다양한 렌더링 모드
 * - 스타일 조합
 * - 메타데이터 렌더링
 * - 엣지 케이스
 */

import { CardRenderer } from '../../src/card/CardRenderer';
import { CardData, CardSection, RenderMode, DEFAULT_SETTINGS } from '../../src/types';
import { Component, MarkdownRenderer } from 'obsidian';

// Mock MarkdownRenderer
jest.mock('obsidian', () => ({
    Component: jest.fn(),
    MarkdownRenderer: {
        render: jest.fn().mockResolvedValue(undefined)
    }
}));

// Mock 데이터 생성 헬퍼
function createMockCardData(
    filename: string,
    header: Partial<CardSection> = {},
    body: Partial<CardSection> = {},
    footer: Partial<CardSection> = {}
): CardData {
    return {
        file: {
            path: `${filename}.md`,
            name: `${filename}.md`,
            basename: filename
        } as any,
        header: {
            type: 'header',
            content: header.content !== undefined ? header.content : filename,
            visible: header.visible !== false
        },
        body: {
            type: 'body',
            content: body.content !== undefined ? body.content : 'Test content',
            visible: body.visible !== false
        },
        footer: {
            type: 'footer',
            content: footer.content !== undefined ? footer.content : '',
            visible: footer.visible !== false
        },
        cardSettings: {
            header: DEFAULT_SETTINGS.header,
            body: DEFAULT_SETTINGS.body,
            footer: DEFAULT_SETTINGS.footer,
            renderMode: 'plain',
            normalCardStyle: DEFAULT_SETTINGS.normalCardStyle,
            activeCardStyle: DEFAULT_SETTINGS.activeCardStyle,
            focusedCardStyle: DEFAULT_SETTINGS.focusedCardStyle
        }
    };
}

describe('CardRenderer - Extended Tests', () => {
    let renderer: CardRenderer;
    let mockApp: any;
    let mockComponent: any;
    let container: HTMLElement;
    let mockSettings: any;
    
    beforeEach(() => {
        // Mock Obsidian App
        mockApp = {
            vault: {
                getAbstractFileByPath: jest.fn(),
                adapter: {
                    read: jest.fn().mockResolvedValue('test content')
                }
            },
            metadataCache: {
                getFileCache: jest.fn()
            },
            workspace: {
                openLinkText: jest.fn(),
                getLeavesOfType: jest.fn().mockReturnValue([]),
                getRightLeaf: jest.fn()
            }
        };
        
        // Mock Component
        mockComponent = {
            unload: jest.fn(),
            load: jest.fn(),
            onload: jest.fn(),
            addChild: jest.fn(),
            removeChild: jest.fn(),
            register: jest.fn(),
            registerEvent: jest.fn(),
            registerDomEvent: jest.fn(),
            registerInterval: jest.fn()
        } as unknown as Component;
        
        // Mock Settings
        mockSettings = {
            ...DEFAULT_SETTINGS,
            debug: { enabled: false, categories: {} }
        };
        
        // Container 생성 및 DOM에 추가
        container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);
        
        // CardRenderer 생성
        renderer = new CardRenderer(
            mockApp,
            mockComponent,
            'plain',
            () => mockSettings
        );
    });
    
    afterEach(() => {
        // Container가 DOM에 있으면 제거
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        // Container 내부의 자식 요소들 정리
        if (container) {
            container.innerHTML = '';
        }
    });
    
    describe('렌더링 모드', () => {
        it('plain 모드에서 모든 섹션을 렌더링해야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: 'Test Title' },
                { content: 'Test content line 1\nTest content line 2\nTest content line 3' },
                { content: 'Created: 2024-01-01' }
            );
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            expect(cardEl).toBeTruthy();
            expect(cardEl.querySelector('.card-header')).toBeTruthy();
            expect(cardEl.querySelector('.card-body')).toBeTruthy();
            expect(cardEl.querySelector('.card-footer')).toBeTruthy();
        });
        
        it('markdown-html 모드에서 마크다운을 렌더링해야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: '**Bold** *Italic*' },
                { content: '- Item 1\n- Item 2' },
                { content: '#tag1 #tag2' }
            );
            
            // body의 contentRenderMode를 markdown-html로 설정
            cardData.cardSettings.body.contentRenderMode = 'markdown-html';
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            expect(cardEl).toBeTruthy();
            const body = cardEl.querySelector('.card-body');
            expect(body?.classList.contains('markdown-preview-view')).toBe(true);
        });
        
        it('섹션별로 다른 렌더링 모드를 적용해야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: 'Plain Header' },
                { content: '**Markdown Body**' },
                { content: 'Plain Footer' }
            );
            
            // 바디만 markdown-html 모드
            cardData.cardSettings.body.contentRenderMode = 'markdown-html';
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            const body = cardEl.querySelector('.card-body');
            expect(body?.classList.contains('markdown-preview-view')).toBe(true);
        });
    });
    
    describe('스타일 적용', () => {
        it('활성 카드에 activeStyle을 적용해야 함', async () => {
            const cardData = createMockCardData('test');
            
            const cardEl = await renderer.renderCard(cardData, container, true);
            
            expect(cardEl).toBeTruthy();
            const header = cardEl.querySelector('.card-header') as HTMLElement;
            
            // activeStyle이 적용되었는지 확인 (fontSize 등)
            expect(header.style.fontSize).toBeTruthy();
        });
        
        it('비활성 카드에 normalStyle을 적용해야 함', async () => {
            const cardData = createMockCardData('test');
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            expect(cardEl).toBeTruthy();
            const header = cardEl.querySelector('.card-header') as HTMLElement;
            
            // normalStyle이 적용되었는지 확인
            expect(header.style.fontSize).toBeTruthy();
        });
        
        it('섹션별 스타일을 개별적으로 적용해야 함', async () => {
            const cardData = createMockCardData('test');
            
            // 각 섹션의 스타일 커스터마이즈
            cardData.cardSettings.header.normalStyle.fontSize = 16;
            cardData.cardSettings.body.normalStyle.fontSize = 14;
            cardData.cardSettings.footer.normalStyle.fontSize = 12;
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            const header = cardEl.querySelector('.card-header') as HTMLElement;
            const body = cardEl.querySelector('.card-body') as HTMLElement;
            const footer = cardEl.querySelector('.card-footer') as HTMLElement;
            
            expect(header.style.fontSize).toBe('16px');
            expect(body.style.fontSize).toBe('14px');
            expect(footer.style.fontSize).toBe('12px');
        });
    });
    
    describe('엣지 케이스', () => {
        it('빈 헤더를 처리해야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: '' },
                { content: 'Content' },
                { content: '' }
            );
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            const header = cardEl.querySelector('.card-header');
            expect(header).toBeTruthy();
            expect(header?.textContent).toContain('(No title)');
        });
        
        it('빈 본문을 처리해야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: 'Test' },
                { content: '' },
                { content: '' }
            );
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            const body = cardEl.querySelector('.card-body');
            expect(body).toBeTruthy();
            expect(body?.textContent).toContain('(No content)');
        });
        
        it('매우 긴 내용을 처리해야 함', async () => {
            const longContent = 'A'.repeat(10000);
            const cardData = createMockCardData(
                'test',
                { content: 'Test' },
                { content: longContent },
                { content: '' }
            );
            
            await expect(
                renderer.renderCard(cardData, container, false)
            ).resolves.not.toThrow();
        });
        
        it('특수 문자를 안전하게 처리해야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: '<script>alert("XSS")</script>' },
                { content: '& < > " \' `' },
                { content: '' }
            );
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            // textContent를 사용하므로 XSS 안전
            expect(cardEl.innerHTML).not.toContain('<script>');
        });
        
        it('보이지 않는 섹션은 렌더링하지 않아야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: 'Header', visible: false },
                { content: 'Body', visible: true },
                { content: 'Footer', visible: false }
            );
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            expect(cardEl.querySelector('.card-header')).toBeFalsy();
            expect(cardEl.querySelector('.card-body')).toBeTruthy();
            expect(cardEl.querySelector('.card-footer')).toBeFalsy();
        });
    });
    
    describe('링크 처리', () => {
        it('internal-link를 클릭 가능하게 만들어야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: 'Test' },
                { content: '' },
                { content: '<span class="internal-link" data-file-path="note.md">Note</span>' }
            );
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            const link = cardEl.querySelector('.internal-link') as HTMLElement;
            expect(link).toBeTruthy();
            expect(link.style.cursor).toBe('pointer');
        });
        
        it('tag-link를 클릭 가능하게 만들어야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: 'Test' },
                { content: '' },
                { content: '<span class="tag-link" data-tag="important">important</span>' }
            );
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            const tag = cardEl.querySelector('.tag-link') as HTMLElement;
            expect(tag).toBeTruthy();
            expect(tag.style.cursor).toBe('pointer');
        });
        
        it('여러 개의 링크를 처리해야 함', async () => {
            const cardData = createMockCardData(
                'test',
                { content: 'Test' },
                { content: '' },
                { 
                    content: '<span class="internal-link" data-file-path="note1.md">Note1</span>, <span class="internal-link" data-file-path="note2.md">Note2</span>'
                }
            );
            
            const cardEl = await renderer.renderCard(cardData, container, false);
            
            const links = cardEl.querySelectorAll('.internal-link');
            expect(links.length).toBe(2);
        });
    });
    
    describe('성능', () => {
        it('100개 카드를 빠르게 렌더링해야 함', async () => {
            const startTime = performance.now();
            
            for (let i = 0; i < 100; i++) {
                const cardData = createMockCardData(`test-${i}`);
                await renderer.renderCard(cardData, container, false);
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // 100개 카드 렌더링이 1초 이내여야 함
            expect(duration).toBeLessThan(1000);
        });
        
        it('복잡한 마크다운을 효율적으로 렌더링해야 함', async () => {
            const complexMarkdown = `
# Header 1
## Header 2
### Header 3

**Bold** *Italic* ~~Strikethrough~~

- List item 1
- List item 2
  - Nested item

1. Numbered 1
2. Numbered 2

\`\`\`javascript
const code = "test";
\`\`\`

> Blockquote

[Link](https://example.com)

#tag1 #tag2 #tag3
            `.trim();
            
            const cardData = createMockCardData(
                'complex',
                { content: 'Complex Document' },
                { content: complexMarkdown },
                { content: '' }
            );
            
            cardData.cardSettings.body.contentRenderMode = 'markdown-html';
            
            const startTime = performance.now();
            await renderer.renderCard(cardData, container, false);
            const endTime = performance.now();
            
            // 복잡한 마크다운도 100ms 이내 렌더링
            expect(endTime - startTime).toBeLessThan(100);
        });
    });
});

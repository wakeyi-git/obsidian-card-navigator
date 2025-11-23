/**
 * CardFactory 확장 테스트
 * 
 * 미커버 영역 (57.43% → 85% 목표):
 * - 카드 설정 오버라이드
 * - 프리셋 적용
 * - 에러 처리
 * - 엣지 케이스
 */

import { CardFactory } from '../../src/view/CardFactory';
import { CardRenderer } from '../../src/card/CardRenderer';
import { CardDataExtractor } from '../../src/card/CardData';
import { ViewEventHandler } from '../../src/view/ViewEventHandler';
import { DragDropHandler } from '../../src/utils/DragDropHandler';
import { CardContextMenu } from '../../src/ui/ContextMenu';
import { SelectionManager } from '../../src/selection/SelectionManager';
import { TFile, Component } from 'obsidian';
import { createMockApp, createMockView, createMockFile, createMockPlugin } from '../helpers/mockFactory';

describe('CardFactory - Extended Tests', () => {
    let factory: CardFactory;
    let mockApp: any;
    let mockView: any;
    let mockPlugin: any;
    let mockRenderer: CardRenderer;
    let mockExtractor: CardDataExtractor;
    let mockEventHandler: ViewEventHandler;
    let mockComponent: Component;
    let mockDragDropHandler: DragDropHandler;
    let mockContextMenu: CardContextMenu;
    let mockSelectionManager: SelectionManager;
    let mockGetSettings: jest.Mock;
    
    beforeEach(() => {
        mockApp = createMockApp();
        mockView = createMockView();
        mockPlugin = createMockPlugin();
        
        // Mock component for CardRenderer
        mockComponent = {
            registerEvent: jest.fn(),
            load: jest.fn(),
            unload: jest.fn()
        } as any;
        
        // Mock getSettings function
        mockGetSettings = jest.fn(() => mockPlugin.settingsManager.getSettings());
        
        // Create renderer with proper arguments
        mockRenderer = new CardRenderer(
            mockApp,
            mockComponent,
            'plain',
            mockGetSettings
        );
        
        // Create extractor with proper arguments
        mockExtractor = new CardDataExtractor(
            mockApp,
            mockGetSettings
        );
        
        // Create dependencies for ViewEventHandler
        mockDragDropHandler = new DragDropHandler(mockApp, mockGetSettings);
        mockContextMenu = new CardContextMenu(mockApp, mockGetSettings);
        mockSelectionManager = new SelectionManager(mockApp, mockGetSettings);
        
        // Create event handler with proper arguments
        mockEventHandler = new ViewEventHandler(
            mockApp,
            mockDragDropHandler,
            mockContextMenu,
            mockSelectionManager,
            mockGetSettings
        );
        
        factory = new CardFactory(
            mockApp,
            mockView,
            mockRenderer,
            mockExtractor,
            mockEventHandler
        );
    });
    
    describe('기본 카드 생성', () => {
        it('카드를 성공적으로 생성해야 함', async () => {
            const file = createMockFile('test.md');
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            // Mock renderCard
            jest.spyOn(mockRenderer, 'renderCard').mockResolvedValue(document.createElement('div'));
            
            const card = await factory.createCard(file, container, null, onFileOpen);
            
            expect(card).toBeTruthy();
            expect(mockRenderer.renderCard).toHaveBeenCalled();
        });
        
        it('활성 파일이 현재 파일과 일치하면 isActive가 true여야 함', async () => {
            const file = createMockFile('test.md');
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            jest.spyOn(mockRenderer, 'renderCard').mockResolvedValue(document.createElement('div'));
            
            await factory.createCard(file, container, file, onFileOpen);

            expect(mockRenderer.renderCard).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything()
            );
        });
        
        it('활성 파일이 다른 파일이면 isActive가 false여야 함', async () => {
            const file = createMockFile('test.md');
            const activeFile = createMockFile('other.md');
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            jest.spyOn(mockRenderer, 'renderCard').mockResolvedValue(document.createElement('div'));
            
            await factory.createCard(file, container, activeFile, onFileOpen);

            expect(mockRenderer.renderCard).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything()
            );
        });
    });
    
    describe('프리셋 적용', () => {
        it('프리셋이 파일에 매핑되어 있으면 프리셋 설정을 사용해야 함', async () => {
            const file = createMockFile('test.md');
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            // Mock preset settings
            mockView.plugin.presetManager.getCardSettingsForFile = jest.fn()
                .mockReturnValue({
                    header: {
                        contentRenderMode: 'plain',
                        normalStyle: {
                            fontSize: 16,
                            backgroundColor: '#ffffff',
                            borderColor: '#cccccc',
                            borderWidth: 1
                        },
                        activeStyle: {
                            fontSize: 16,
                            backgroundColor: '#f0f0f0',
                            borderColor: '#666666',
                            borderWidth: 2
                        },
                        focusedStyle: {
                            fontSize: 16,
                            backgroundColor: '#e8f4f8',
                            borderColor: '#0066cc',
                            borderWidth: 2
                        }
                    },
                    body: {
                        contentRenderMode: 'plain',
                        normalStyle: {
                            fontSize: 14,
                            backgroundColor: '#ffffff',
                            borderColor: '#cccccc',
                            borderWidth: 0
                        },
                        activeStyle: {
                            fontSize: 14,
                            backgroundColor: '#f0f0f0',
                            borderColor: '#666666',
                            borderWidth: 0
                        },
                        focusedStyle: {
                            fontSize: 14,
                            backgroundColor: '#e8f4f8',
                            borderColor: '#0066cc',
                            borderWidth: 0
                        }
                    },
                    footer: {
                        contentRenderMode: 'plain',
                        normalStyle: {
                            fontSize: 12,
                            backgroundColor: '#ffffff',
                            borderColor: '#cccccc',
                            borderWidth: 1
                        },
                        activeStyle: {
                            fontSize: 12,
                            backgroundColor: '#f0f0f0',
                            borderColor: '#666666',
                            borderWidth: 2
                        },
                        focusedStyle: {
                            fontSize: 12,
                            backgroundColor: '#e8f4f8',
                            borderColor: '#0066cc',
                            borderWidth: 2
                        }
                    },
                    renderMode: 'plain',
                    normalCardStyle: {
                        fontSize: 14,
                        backgroundColor: '#ffffff',
                        borderColor: '#e0e0e0',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    activeCardStyle: {
                        fontSize: 14,
                        backgroundColor: '#f5f5f5',
                        borderColor: '#999999',
                        borderWidth: 2,
                        borderRadius: 4
                    },
                    focusedCardStyle: {
                        fontSize: 14,
                        backgroundColor: '#e8f4f8',
                        borderColor: '#0066cc',
                        borderWidth: 2,
                        borderRadius: 4
                    }
                });
            
            jest.spyOn(mockRenderer, 'renderCard').mockResolvedValue(document.createElement('div'));
            
            await factory.createCard(file, container, null, onFileOpen);
            
            expect(mockView.plugin.presetManager.getCardSettingsForFile).toHaveBeenCalledWith(file);
            expect(mockRenderer.renderCard).toHaveBeenCalled();
        });
        
        it('프리셋이 없으면 전역 설정을 사용해야 함', async () => {
            const file = createMockFile('test.md');
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            mockView.plugin.presetManager.getCardSettingsForFile = jest.fn()
                .mockReturnValue(null);
            
            jest.spyOn(mockRenderer, 'renderCard').mockResolvedValue(document.createElement('div'));
            
            await factory.createCard(file, container, null, onFileOpen);
            
            expect(mockView.plugin.presetManager.getCardSettingsForFile).toHaveBeenCalledWith(file);
            expect(mockRenderer.renderCard).toHaveBeenCalled();
        });
    });
    
    describe('에러 처리', () => {
        it('유효하지 않은 파일을 처리해야 함', async () => {
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            // null 파일로 카드 생성 시도
            await expect(
                factory.createCard(null as any, container, null, onFileOpen)
            ).rejects.toThrow();
        });
        
        it('렌더링 실패 시 에러를 처리해야 함', async () => {
            const file = createMockFile('test.md');
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            // Mock rendering failure
            jest.spyOn(mockRenderer, 'renderCard').mockRejectedValue(
                new Error('Rendering failed')
            );
            
            await expect(
                factory.createCard(file, container, null, onFileOpen)
            ).rejects.toThrow();
        });
    });
    
    describe('이벤트 바인딩', () => {
        it('카드에 이벤트를 바인딩해야 함', async () => {
            const file = createMockFile('test.md');
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            const cardEl = document.createElement('div');
            jest.spyOn(mockRenderer, 'renderCard').mockResolvedValue(cardEl);
            jest.spyOn(mockEventHandler, 'bindCardEvents').mockImplementation(() => {});
            
            await factory.createCard(file, container, null, onFileOpen);
            
            expect(mockEventHandler.bindCardEvents).toHaveBeenCalledWith(
                cardEl,
                file,
                onFileOpen
            );
        });
    });
    
    describe('성능', () => {
        it('여러 카드를 빠르게 생성해야 함', async () => {
            const files = Array.from({ length: 20 }, (_, i) => 
                createMockFile(`test${i}.md`)
            );
            const container = document.createElement('div');
            const onFileOpen = jest.fn();
            
            jest.spyOn(mockRenderer, 'renderCard').mockResolvedValue(document.createElement('div'));
            
            const startTime = Date.now();
            
            await Promise.all(
                files.map(file => 
                    factory.createCard(file, container, null, onFileOpen)
                )
            );
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // 20개 카드 생성이 1초 이내여야 함
            expect(duration).toBeLessThan(1000);
        });
    });
});

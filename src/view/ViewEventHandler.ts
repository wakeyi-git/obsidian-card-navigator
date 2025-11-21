import { TFile, App } from 'obsidian';
import { DragDropHandler } from '../utils/DragDropHandler';
import { CardContextMenu } from '../ui/ContextMenu';
import { SelectionManager } from '../selection/SelectionManager';
import { DebugLogger } from '../utils/DebugLogger';
import { CardNavigatorSettings } from '../types';

/**
 * 뷰 이벤트 핸들러
 * 
 * 카드 클릭, 호버, 드래그앤드롭, 컨텍스트 메뉴 등
 * 모든 사용자 인터랙션을 중앙에서 관리합니다.
 */
export class ViewEventHandler {
	private app: App;
	private dragDropHandler: DragDropHandler;
	private contextMenu: CardContextMenu;
	private selectionManager: SelectionManager;
	private logger: DebugLogger;
	
	constructor(
		app: App,
		dragDropHandler: DragDropHandler,
		contextMenu: CardContextMenu,
		selectionManager: SelectionManager,
		getSettings?: () => CardNavigatorSettings
	) {
		this.app = app;
		this.dragDropHandler = dragDropHandler;
		this.contextMenu = contextMenu;
		this.selectionManager = selectionManager;
		// ✅ 함수를 전달하여 항상 최신 settings를 참조
		this.logger = new DebugLogger(
			getSettings || (() => ({ debug: { enabled: false, categories: {} } } as CardNavigatorSettings))
		);
	}
	
	/**
	 * 카드 이벤트 바인딩
	 * 
	 * 카드에 클릭, 호버, 드래그앤드롭, 컨텍스트 메뉴 등의
	 * 이벤트 리스너를 등록합니다.
	 * 
	 * @param card - 카드 DOM 요소
	 * @param file - 파일
	 * @param onFileOpen - 파일 열기 콜백
	 */
	bindCardEvents(
		card: HTMLElement,
		file: TFile,
		onFileOpen: (file: TFile) => void
	): void {
		const dragState = this.dragDropHandler.setupDraggable(card, file);
		
		card.addEventListener('mouseenter', () => {
			card.addClass('card-item-hover');
		});
		
		card.addEventListener('mouseleave', () => {
			card.removeClass('card-item-hover');
		});
		
		card.addEventListener('click', (e: MouseEvent) => {
			this.handleCardClick(e, file, dragState, onFileOpen);
		});
		
		card.addEventListener('contextmenu', (e: MouseEvent) => {
			e.preventDefault();
			this.contextMenu.show(e, file);
		});
	}
	
	/**
	 * 카드 클릭 처리
	 * 
	 * 드래그 중이거나 수정 키가 눌린 경우를 처리하고,
	 * 일반 클릭인 경우 파일을 엽니다.
	 * 
	 * ⭐ 버그 수정 (2025-11-18):
	 * 태그나 내부 링크를 클릭한 경우 카드 클릭으로 처리하지 않습니다.
	 * 이벤트 버블링을 통해 카드까지 전파된 경우를 필터링합니다.
	 * 
	 * @param e - 마우스 이벤트
	 * @param file - 클릭된 파일
	 * @param dragState - 드래그 상태 객체
	 * @param onFileOpen - 파일 열기 콜백
	 */
	private handleCardClick(
		e: MouseEvent,
		file: TFile,
		dragState: { isDragging: () => boolean },
		onFileOpen: (file: TFile) => void
	): void {
		this.logger.debug('Event', '카드 클릭됨', {
			filePath: file.path,
			isDragging: dragState.isDragging(),
			hasModifierKey: e.ctrlKey || e.metaKey || e.shiftKey,
			timestamp: Date.now()
		});
		
		// ⭐ 버그 수정: 태그나 내부 링크 클릭은 무시
		// 이벤트가 버블링되어 카드까지 전파된 경우를 필터링
		const target = e.target as HTMLElement;
		if (target.classList.contains('tag-link') || 
			target.classList.contains('internal-link')) {
			this.logger.debug('Event', '클릭 무시: 태그 또는 링크 클릭', {
				className: target.className
			});
			return;
		}
		
		e.preventDefault();
		e.stopPropagation();
		
		if (dragState.isDragging()) {
			this.logger.debug('Event', '클릭 무시: 드래그 작업 중');
			return;
		}
		
		if (e.ctrlKey || e.metaKey || e.shiftKey) {
			this.logger.debug('Event', '다중 선택 처리');
			this.selectionManager.toggleSelection(file, e);
			return;
		}
		
		this.logger.debug('Event', '파일 열기 시작');
		onFileOpen(file);
	}
}

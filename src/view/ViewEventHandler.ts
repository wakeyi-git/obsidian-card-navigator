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

	/** 이벤트 위임이 설정된 컨테이너 */
	private delegatedContainers = new WeakSet<HTMLElement>();

	/** 이벤트 핸들러 참조 저장 (cleanup용) */
	private eventHandlers = new WeakMap<HTMLElement, {
		mouseover: (e: MouseEvent) => void;
		mouseout: (e: MouseEvent) => void;
		click: (e: MouseEvent) => void;
		contextmenu: (e: MouseEvent) => void;
	}>();

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
	 * ⭐ 컨테이너 레벨에서 이벤트 위임 설정 (최적화)
	 *
	 * 각 카드에 개별 이벤트 리스너를 등록하는 대신,
	 * 컨테이너 하나에만 리스너를 등록하여 메모리 사용량을 줄입니다.
	 *
	 * @param container - 카드 컨테이너
	 * @param onFileOpen - 파일 열기 콜백
	 */
	setupDelegatedEvents(
		container: HTMLElement,
		onFileOpen: (file: TFile) => void
	): void {
		// 이미 설정된 컨테이너는 스킵
		if (this.delegatedContainers.has(container)) {
			return;
		}

		this.delegatedContainers.add(container);

		// 마우스 호버 이벤트 위임
		// 각 카드의 진입/이탈을 추적
		let currentHoveredCard: HTMLElement | null = null;

		const mouseoverHandler = (e: MouseEvent) => {
			try {
				const target = e.target as HTMLElement;
				const card = target.closest('.card-item') as HTMLElement;

				if (!card || !container.contains(card)) {
					return;
				}

				// 이미 호버 중인 카드와 동일하면 무시
				if (card === currentHoveredCard) {
					return;
				}

				// 이전 카드의 호버 제거
				if (currentHoveredCard) {
					currentHoveredCard.removeClass('card-item-hover');
				}

				// 새 카드에 호버 추가
				card.addClass('card-item-hover');
				currentHoveredCard = card;
			} catch (error) {
				this.logger.debug('Event', 'Mouseover handler error', { error });
			}
		};

		const mouseoutHandler = (e: MouseEvent) => {
			try {
				const target = e.target as HTMLElement;
				const card = target.closest('.card-item') as HTMLElement;

				if (!card || !container.contains(card)) {
					return;
				}

				// relatedTarget이 카드 외부로 나간 경우만 호버 제거
				const relatedTarget = e.relatedTarget as HTMLElement;
				if (!relatedTarget || !card.contains(relatedTarget)) {
					card.removeClass('card-item-hover');
					if (currentHoveredCard === card) {
						currentHoveredCard = null;
					}
				}
			} catch (error) {
				this.logger.debug('Event', 'Mouseout handler error', { error });
			}
		};

		const clickHandler = (e: MouseEvent) => {
			try {
				const target = e.target as HTMLElement;

				// ⭐ 버그 수정: 태그나 내부 링크 클릭은 카드 클릭으로 처리하지 않음
				// 이벤트 위임이 먼저 실행되므로, 여기서 조기에 필터링해야 함
				if (target.classList.contains('tag-link') ||
					target.classList.contains('internal-link') ||
					target.closest('.tag-link') ||
					target.closest('.internal-link')) {
					// 태그/링크의 자체 핸들러가 처리하도록 허용
					return;
				}

				// 호버 액션 버튼 클릭은 무시 (버튼 자체에서 처리)
				if (target.closest('.card-hover-actions')) {
					return;
				}

				const card = target.closest('.card-item') as HTMLElement;
				if (!card || !container.contains(card)) {
					return;
				}

				const filePath = card.dataset.filePath;
				if (!filePath) {
					return;
				}

				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile)) {
					return;
				}

				// 드래그 상태는 카드별로 관리되므로 여기서는 간단히 처리
				this.handleCardClick(e, file, { isDragging: () => false }, onFileOpen);
			} catch (error) {
				this.logger.debug('Event', 'Click handler error', { error });
			}
		};

		const contextmenuHandler = (e: MouseEvent) => {
			try {
				const card = (e.target as HTMLElement).closest('.card-item') as HTMLElement;
				if (!card || !container.contains(card)) {
					return;
				}

				const filePath = card.dataset.filePath;
				if (!filePath) {
					return;
				}

				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile)) {
					return;
				}

				e.preventDefault();
				this.contextMenu.show(e, file);
			} catch (error) {
				this.logger.debug('Event', 'Context menu handler error', { error });
			}
		};

		container.addEventListener('mouseover', mouseoverHandler);
		container.addEventListener('mouseout', mouseoutHandler);
		container.addEventListener('click', clickHandler);
		container.addEventListener('contextmenu', contextmenuHandler);

		// 핸들러 참조 저장 (cleanup용)
		this.eventHandlers.set(container, {
			mouseover: mouseoverHandler,
			mouseout: mouseoutHandler,
			click: clickHandler,
			contextmenu: contextmenuHandler
		});

		this.logger.debug('Event', '이벤트 위임 설정 완료', {
			container: container.className
		});
	}

	/**
	 * 컨테이너의 이벤트 리스너를 제거합니다
	 *
	 * @param container - 카드 컨테이너
	 */
	cleanupDelegatedEvents(container: HTMLElement): void {
		const handlers = this.eventHandlers.get(container);
		if (!handlers) {
			return;
		}

		try {
			container.removeEventListener('mouseover', handlers.mouseover);
			container.removeEventListener('mouseout', handlers.mouseout);
			container.removeEventListener('click', handlers.click);
			container.removeEventListener('contextmenu', handlers.contextmenu);

			this.eventHandlers.delete(container);
			this.delegatedContainers.delete(container);

			this.logger.debug('Event', '이벤트 위임 정리 완료', {
				container: container.className
			});
		} catch (error) {
			this.logger.debug('Event', 'Cleanup error', { error });
		}
	}

	/**
	 * 모든 이벤트 리스너를 제거합니다 (뷰 종료 시)
	 */
	destroy(): void {
		// WeakMap이므로 자동으로 가비지 컬렉션됨
		// 추가 정리 작업이 필요한 경우 여기에 추가
		this.logger.debug('Event', 'ViewEventHandler destroyed');
	}

	/**
	 * 카드 이벤트 바인딩 (개별 방식)
	 *
	 * 드래그앤드롭만 개별 카드에 설정합니다.
	 * 호버, 클릭, 컨텍스트 메뉴는 setupDelegatedEvents에서 처리합니다.
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
		try {
			// 드래그앤드롭만 개별 카드에 설정 (카드별 상태 관리 필요)
			this.dragDropHandler.setupDraggable(card, file);

			// 호버, 클릭, 컨텍스트 메뉴는 setupDelegatedEvents에서 위임 처리됨
			// (중복 이벤트 리스너 제거하여 호버 문제 해결)
		} catch (error) {
			this.logger.debug('Event', 'Bind card events error', {
				file: file.path,
				error
			});
		}
	}

	/**
	 * 카드 클릭 처리
	 *
	 * 드래그 중이거나 수정 키가 눌린 경우를 처리하고,
	 * 일반 클릭인 경우 파일을 엽니다.
	 *
	 * ⭐ 버그 수정 (2025-11-24):
	 * 태그나 내부 링크 클릭은 clickHandler에서 조기 필터링되므로
	 * 이 메서드는 실제 카드 클릭만 처리합니다.
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
		try {
			this.logger.debug('Event', '카드 클릭됨', {
				filePath: file.path,
				isDragging: dragState.isDragging(),
				hasModifierKey: e.ctrlKey || e.metaKey || e.shiftKey,
				timestamp: Date.now()
			});

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
		} catch (error) {
			this.logger.debug('Event', 'Card click handler error', {
				file: file.path,
				error
			});
		}
	}
}

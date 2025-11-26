import { DebugLogger } from '../utils/DebugLogger';
import { CardNavigatorSettings } from '../types';

/**
 * Phase 3.5: 뷰포트 기반 레이아웃 관리자
 *
 * 현재 뷰포트에 보이는 카드만 레이아웃 계산을 수행하여 성능을 향상시킵니다.
 * 스크롤 시 보이는 범위가 변경되면 해당 카드들만 레이아웃을 업데이트합니다.
 *
 * @remarks
 * - IntersectionObserver를 사용하여 뷰포트 진입/이탈 감지
 * - 스크롤 디바운싱으로 과도한 재계산 방지
 * - 보이는 카드에만 레이아웃 관련 CSS 변수 적용
 */
export class ViewportLayoutManager {
	private containerEl: HTMLElement;
	private logger: DebugLogger;
	private observer: IntersectionObserver | null = null;

	/** 현재 뷰포트에 보이는 카드 범위 */
	private visibleRange: { start: number; end: number } = { start: 0, end: 0 };

	/** 모든 카드 요소 목록 */
	private cards: HTMLElement[] = [];

	/** 뷰포트 변경 감지 디바운스 타이머 */
	private updateTimeout: NodeJS.Timeout | null = null;

	/** ⭐ Performance Phase 2: requestAnimationFrame ID */
	private rafId: number | null = null;

	/** 디바운스 지연 시간 (ms) */
	private readonly DEBOUNCE_MS = 50;

	/** IntersectionObserver 옵션 */
	private readonly OBSERVER_OPTIONS: IntersectionObserverInit = {
		root: null, // viewport를 기준으로
		rootMargin: '200px', // 뷰포트 밖 200px까지 미리 감지
		threshold: 0 // 1px이라도 보이면 감지
	};

	constructor(
		containerEl: HTMLElement,
		getSettings: () => CardNavigatorSettings
	) {
		this.containerEl = containerEl;
		this.logger = new DebugLogger(getSettings);

		this.setupObserver();
	}

	/**
	 * IntersectionObserver를 설정합니다
	 */
	private setupObserver(): void {
		this.observer = new IntersectionObserver((entries) => {
			this.onIntersection(entries);
		}, this.OBSERVER_OPTIONS);
	}

	/**
	 * IntersectionObserver 콜백
	 *
	 * @param entries - 관찰 대상 요소들의 교차 상태
	 *
	 * @remarks
	 * ⭐ Performance Phase 2: requestAnimationFrame 활용
	 * - 뷰포트 계산을 다음 프레임으로 지연
	 * - 브라우저의 렌더링 사이클과 동기화
	 */
	private onIntersection(entries: IntersectionObserverEntry[]): void {
		// 디바운스 처리
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
		}

		this.updateTimeout = setTimeout(() => {
			// ⭐ Performance Phase 2: 이전 RAF 취소
			if (this.rafId !== null) {
				cancelAnimationFrame(this.rafId);
			}

			// ⭐ Performance Phase 2: 다음 프레임에서 범위 계산 수행
			this.rafId = requestAnimationFrame(() => {
				this.rafId = null;
				this.updateVisibleRange();
			});
		}, this.DEBOUNCE_MS);
	}

	/**
	 * 보이는 카드 범위를 업데이트합니다
	 *
	 * @remarks
	 * ⭐ Performance: DOM 읽기/쓰기 분리 최적화
	 * - 모든 getBoundingClientRect() 호출을 먼저 일괄 수행 (읽기 단계)
	 * - 그 후 계산 및 상태 업데이트 수행 (쓰기 단계)
	 * - Forced reflow 방지
	 */
	private updateVisibleRange(): void {
		if (this.cards.length === 0) {
			return;
		}

		// ⭐ Performance: 모든 DOM 읽기를 먼저 일괄 수행 (읽기 단계)
		const viewportTop = this.containerEl.scrollTop;
		const viewportHeight = this.containerEl.clientHeight;
		const viewportBottom = viewportTop + viewportHeight;
		const containerRect = this.containerEl.getBoundingClientRect();

		// 모든 카드의 rect를 한 번에 읽기
		const cardRects = this.cards.map(card => card.getBoundingClientRect());

		// ⭐ Performance: 읽기 완료 후 계산 수행 (처리 단계)
		let newStart = -1;
		let newEnd = -1;

		for (let i = 0; i < this.cards.length; i++) {
			const rect = cardRects[i];

			// 카드의 컨테이너 상대 위치 계산
			const cardTop = rect.top - containerRect.top + viewportTop;
			const cardBottom = cardTop + rect.height;

			// 뷰포트와 교차하는지 확인
			const isVisible = cardBottom > viewportTop && cardTop < viewportBottom;

			if (isVisible) {
				if (newStart === -1) {
					newStart = i;
				}
				newEnd = i;
			}
		}

		// 범위가 변경되었는지 확인
		if (newStart === -1 || newEnd === -1) {
			// 보이는 카드가 없음
			return;
		}

		const rangeChanged =
			newStart !== this.visibleRange.start ||
			newEnd !== this.visibleRange.end;

		if (rangeChanged) {
			this.logger.debug('Layout', 'Viewport range changed', {
				oldRange: `${this.visibleRange.start}-${this.visibleRange.end}`,
				newRange: `${newStart}-${newEnd}`,
				visibleCount: newEnd - newStart + 1,
				totalCards: this.cards.length
			});

			this.visibleRange = { start: newStart, end: newEnd };
			this.layoutVisibleCards();
		}
	}

	/**
	 * 보이는 카드들만 레이아웃을 적용합니다
	 *
	 * @remarks
	 * 현재 구현에서는 CSS 변수가 컨테이너 레벨에서 적용되므로
	 * 실제로는 개별 카드별 레이아웃 계산이 필요 없습니다.
	 *
	 * 이 메서드는 향후 카드별 동적 크기 조정이나
	 * 복잡한 레이아웃 계산이 필요한 경우를 위해 준비되었습니다.
	 */
	private layoutVisibleCards(): void {
		const { start, end } = this.visibleRange;

		this.logger.debug('Layout', 'Laying out visible cards', {
			start,
			end,
			count: end - start + 1
		});

		// 현재는 CSS Grid가 자동으로 레이아웃을 처리하므로
		// 별도의 계산이 필요 없음
		//
		// 향후 최적화가 필요한 경우:
		// - 보이는 카드에만 transform 적용
		// - 보이지 않는 카드는 visibility: hidden 처리
		// - 동적 카드 크기 계산 등
	}

	/**
	 * 관찰할 카드 목록을 업데이트합니다
	 *
	 * @param cards - 카드 요소 배열
	 */
	updateCards(cards: HTMLElement[]): void {
		// 기존 관찰 중단
		if (this.observer) {
			this.observer.disconnect();
		}

		this.cards = cards;

		// 새 카드들 관찰 시작
		if (this.observer) {
			cards.forEach(card => {
				this.observer?.observe(card);
			});
		}

		this.logger.debug('Layout', 'Updated viewport layout cards', {
			cardCount: cards.length
		});

		// 초기 범위 계산
		this.updateVisibleRange();
	}

	/**
	 * 현재 보이는 카드 범위를 반환합니다
	 */
	getVisibleRange(): { start: number; end: number } {
		return { ...this.visibleRange };
	}

	/**
	 * 스크롤 위치가 변경되었을 때 호출됩니다
	 *
	 * @param scrollTop - 새로운 스크롤 위치
	 * @param viewportHeight - 뷰포트 높이
	 *
	 * @remarks
	 * 외부에서 스크롤 이벤트를 직접 감지하는 경우 사용할 수 있습니다.
	 * IntersectionObserver를 사용하는 경우 자동으로 감지되므로 호출 불필요합니다.
	 */
	updateVisibleRangeByScroll(scrollTop: number, viewportHeight: number): void {
		// IntersectionObserver가 자동으로 처리하므로
		// 이 메서드는 fallback용으로만 사용
		this.updateVisibleRange();
	}

	/**
	 * 리소스를 정리합니다
	 */
	destroy(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
			this.updateTimeout = null;
		}

		// ⭐ Performance Phase 2: requestAnimationFrame 정리
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}

		this.cards = [];
	}
}

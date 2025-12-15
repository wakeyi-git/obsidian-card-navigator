import { LayoutSettings, LayoutMode, CardNavigatorSettings } from '../types';
import { DebugLogger } from '../utils/DebugLogger';
import { ViewportLayoutManager } from './ViewportLayoutManager';

/**
 * ⭐ Section 7.1: 레이아웃 상태 인터페이스
 */
interface LayoutState {
	cardMinWidth: number;
	cardMinHeight: number;
	cardMaxWidth: number;
	cardMaxHeight: number;
	gap: number;
	mode: LayoutMode;
	containerWidth: number;
	containerHeight: number;
}

/**
 * 카드 레이아웃을 관리합니다
 *
 * 화면 크기에 따라 가로/세로 모드를 자동 전환하고,
 * 반응형 그리드를 계산하여 최적의 카드 배치를 제공합니다.
 *
 * @remarks
 * 성능 최적화:
 * - CSS 변수 일괄 업데이트로 리페인트 최소화
 * - 읽기/쓰기 작업 분리로 레이아웃 thrashing 방지
 * - ResizeObserver와 디바운싱으로 불필요한 재계산 방지
 * - Phase 3.5: ViewportLayoutManager로 보이는 카드만 레이아웃 계산
 * - Section 7.1: 레이아웃 변경 감지로 불필요한 재계산 방지
 * - Section 7.2: CSS 변수 배치 업데이트로 리페인트 최소화
 */
export class LayoutManager {
    private containerEl: HTMLElement;
    private settings: LayoutSettings;
    private currentMode: LayoutMode;
    private resizeObserver: ResizeObserver | null = null;
    private resizeTimeout: NodeJS.Timeout | null = null;
    private previousSize: { width: number; height: number } | null = null;
    private logger: DebugLogger;

	/** ⭐ Section 7.1: 마지막 적용된 레이아웃 상태 */
	private lastLayoutState: LayoutState | null = null;

    /** ⭐ Phase 3.5: 뷰포트 기반 레이아웃 관리자 */
    private viewportLayoutManager: ViewportLayoutManager | null = null;

    /** 전체 설정 가져오기 함수 (ViewportLayoutManager용) */
    private getFullSettings: () => CardNavigatorSettings;

    /** ⭐ Performance: ResizeObserver에서 캐싱된 크기 (getBoundingClientRect 호출 최소화) */
    private cachedSize: { width: number; height: number } | null = null;

    /** ⭐ Performance Phase 2: requestAnimationFrame ID (중복 호출 방지) */
    private rafId: number | null = null;

    private readonly RESIZE_DEBOUNCE_MS = 100;
    private readonly SIZE_CHANGE_THRESHOLD = 20;

    constructor(containerEl: HTMLElement, settings: LayoutSettings, getFullSettings: () => CardNavigatorSettings) {
        this.containerEl = containerEl;
        this.settings = settings;
        this.getFullSettings = getFullSettings;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(getFullSettings);

        const rect = this.containerEl.getBoundingClientRect();
        this.previousSize = {
            width: rect.width,
            height: rect.height
        };

        // ⚠️ 초기 모드 감지를 지연시켜 컨테이너가 올바른 크기를 갖도록 함
        // 컨테이너가 0x0이거나 매우 작은 경우 기본값을 'vertical'로 설정
        if (rect.width < 10 || rect.height < 10) {
            this.currentMode = 'vertical'; // 기본값
            this.logger.debug('Layout', 'LayoutManager 초기화 (컨테이너 크기 미확정, 기본 모드 사용)', {
                mode: this.currentMode,
                width: rect.width,
                height: rect.height,
                reason: '컨테이너 크기가 너무 작음'
            });
        } else {
            this.currentMode = this.detectLayoutMode();
            this.logger.debug('Layout', 'LayoutManager 초기화', {
                mode: this.currentMode,
                width: rect.width,
                height: rect.height
            });
        }

        this.setupResizeObserver();

        // ⭐ Phase 3.5: ViewportLayoutManager 초기화
        this.viewportLayoutManager = new ViewportLayoutManager(
            containerEl,
            getFullSettings
        );

        // ⭐ 초기 레이아웃 적용: 컨테이너 크기가 확정된 경우에만
        // 크기가 0이면 ResizeObserver가 크기 변경 시 자동으로 updateLayout() 호출
        if (rect.width >= 10 && rect.height >= 10) {
            this.updateLayout();
        }
    }

    /**
     * 현재 레이아웃 모드를 감지합니다
     *
     * @returns width > height이면 'horizontal', 아니면 'vertical'
     *
     * @remarks
     * ⭐ Performance: 캐싱된 크기를 우선 사용합니다.
     */
    private detectLayoutMode(): LayoutMode {
        const size = this.getContainerSize();
        return this.detectLayoutModeFromSize(size);
    }

    /**
     * 주어진 크기로 레이아웃 모드를 감지합니다
     *
     * @param size - 컨테이너 크기
     * @returns width > height이면 'horizontal', 아니면 'vertical'
     *
     * @remarks
     * ⭐ Performance: 크기를 파라미터로 받아 getBoundingClientRect 호출 방지
     * ⭐ orientationMode 설정에 따라 강제 모드 적용 가능
     */
    private detectLayoutModeFromSize(size: { width: number; height: number }): LayoutMode {
        const orientationMode = this.getFullSettings().layout.orientationMode;

        // 강제 모드 설정 확인
        if (orientationMode === 'always-vertical') {
            return 'vertical';
        }
        if (orientationMode === 'always-horizontal') {
            return 'horizontal';
        }

        // 'auto' - 컨테이너 크기에 따라 자동 결정
        return size.width > size.height ? 'horizontal' : 'vertical';
    }

    /**
     * ResizeObserver를 설정합니다
     *
     * @remarks
     * ⭐ Performance: ResizeObserver 콜백에서 크기를 캐싱하여
     * getBoundingClientRect() 호출을 최소화합니다.
     */
    private setupResizeObserver(): void {
        this.resizeObserver = new ResizeObserver((entries) => {
            // ⭐ Performance: ResizeObserver에서 직접 크기를 캐싱
            const entry = entries[0];
            if (entry) {
                this.cachedSize = {
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                };
            }
            this.onResize();
        });
        this.resizeObserver.observe(this.containerEl);
    }

    /**
     * ⭐ Performance: 캐싱된 컨테이너 크기를 반환합니다
     *
     * @returns 컨테이너 크기 (캐시가 없으면 getBoundingClientRect 호출)
     *
     * @remarks
     * ResizeObserver 콜백에서 캐싱된 크기를 우선 사용하여
     * 불필요한 getBoundingClientRect() 호출을 방지합니다.
     */
    private getContainerSize(): { width: number; height: number } {
        if (this.cachedSize) {
            return this.cachedSize;
        }
        // 캐시가 없는 경우에만 직접 조회 (초기화 시)
        const rect = this.containerEl.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }

    /**
     * 창 크기 변경 시 호출됩니다
     *
     * @remarks
     * 디바운싱을 적용하여 과도한 재계산을 방지합니다.
     * 크기가 임계값(20px) 이상 변경되거나 모드가 바뀔 때만 레이아웃을 업데이트합니다.
     *
     * ⭐ Performance Phase 2: requestAnimationFrame 활용
     * - 레이아웃 업데이트를 다음 프레임으로 지연
     * - 브라우저의 렌더링 사이클과 동기화하여 forced reflow 방지
     */
    private onResize(): void {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            // ⭐ Performance Phase 2: 이전 RAF 취소
            if (this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
            }

            // ⭐ Performance Phase 2: 다음 프레임에서 레이아웃 계산 수행
            this.rafId = requestAnimationFrame(() => {
                this.rafId = null;

                // ⭐ Performance: 캐싱된 크기 사용 (getBoundingClientRect 호출 방지)
                const size = this.getContainerSize();
                const newMode = this.detectLayoutModeFromSize(size);

                const widthChange = this.previousSize
                    ? Math.abs(size.width - this.previousSize.width)
                    : Infinity;
                const heightChange = this.previousSize
                    ? Math.abs(size.height - this.previousSize.height)
                    : Infinity;

                const modeChanged = newMode !== this.currentMode;
                const significantSizeChange =
                    widthChange >= this.SIZE_CHANGE_THRESHOLD ||
                    heightChange >= this.SIZE_CHANGE_THRESHOLD;

                // ⭐ 모드 변경은 크기 변화와 무관하게 항상 우선 처리
                if (modeChanged || significantSizeChange) {
                    this.logger.debug('Layout', '레이아웃 업데이트 트리거', {
                        modeChanged,
                        oldMode: this.currentMode,
                        newMode,
                        widthChange: widthChange.toFixed(1),
                        heightChange: heightChange.toFixed(1),
                        threshold: this.SIZE_CHANGE_THRESHOLD,
                        containerSize: `${size.width.toFixed(0)}×${size.height.toFixed(0)}`
                    });

                    this.currentMode = newMode;
                    this.previousSize = {
                        width: size.width,
                        height: size.height
                    };
                    this.updateLayout();
                } else {
                    // 디버깅: 업데이트가 건너뛰어진 경우
                    this.logger.debug('Layout', '레이아웃 업데이트 건너뜀', {
                        widthChange: widthChange.toFixed(1),
                        heightChange: heightChange.toFixed(1),
                        threshold: this.SIZE_CHANGE_THRESHOLD,
                        reason: '변화량이 임계값 미만'
                    });
                }
            });

            this.resizeTimeout = null;
        }, this.RESIZE_DEBOUNCE_MS);
    }

	/**
	 * ⭐ Section 7.1: 현재 레이아웃 상태를 생성합니다
	 *
	 * @returns 현재 레이아웃 상태 객체
	 *
	 * @remarks
	 * ⭐ Performance: 캐싱된 크기를 사용하여 getBoundingClientRect 호출 방지
	 */
	private getCurrentLayoutState(): LayoutState {
		const size = this.getContainerSize();
		return {
			cardMinWidth: this.settings.cardMinWidth,
			cardMinHeight: this.settings.cardMinHeight,
			cardMaxWidth: this.settings.cardMaxWidth,
			cardMaxHeight: this.settings.cardMaxHeight,
			gap: this.settings.gap,
			mode: this.currentMode,
			containerWidth: Math.floor(size.width),
			containerHeight: Math.floor(size.height)
		};
	}

	/**
	 * ⭐ Section 7.1: 레이아웃 상태가 변경되었는지 확인합니다
	 *
	 * @param oldState - 이전 레이아웃 상태
	 * @param newState - 새 레이아웃 상태
	 * @returns 변경 여부
	 *
	 * @remarks
	 * 설정 변경, 모드 변경, 또는 컨테이너 크기 변경을 감지합니다.
	 * 컨테이너 크기는 정수로 내림하여 비교하므로 1px 미만의 변화는 무시됩니다.
	 */
	private hasLayoutChanged(oldState: LayoutState | null, newState: LayoutState): boolean {
		if (!oldState) {
			return true; // 최초 렌더링
		}

		// 설정 변경 확인
		if (oldState.cardMinWidth !== newState.cardMinWidth ||
			oldState.cardMinHeight !== newState.cardMinHeight ||
			oldState.cardMaxWidth !== newState.cardMaxWidth ||
			oldState.cardMaxHeight !== newState.cardMaxHeight ||
			oldState.gap !== newState.gap) {
			this.logger.debug('Layout', '레이아웃 설정 변경 감지', {
				old: {
					cardMinWidth: oldState.cardMinWidth,
					cardMinHeight: oldState.cardMinHeight,
					cardMaxWidth: oldState.cardMaxWidth,
					cardMaxHeight: oldState.cardMaxHeight,
					gap: oldState.gap
				},
				new: {
					cardMinWidth: newState.cardMinWidth,
					cardMinHeight: newState.cardMinHeight,
					cardMaxWidth: newState.cardMaxWidth,
					cardMaxHeight: newState.cardMaxHeight,
					gap: newState.gap
				}
			});
			return true;
		}

		// 모드 변경 확인
		if (oldState.mode !== newState.mode) {
			this.logger.debug('Layout', '레이아웃 모드 변경 감지', {
				oldMode: oldState.mode,
				newMode: newState.mode
			});
			return true;
		}

		// 컨테이너 크기 변경 확인 (정수 단위)
		if (oldState.containerWidth !== newState.containerWidth ||
			oldState.containerHeight !== newState.containerHeight) {
			this.logger.debug('Layout', '컨테이너 크기 변경 감지', {
				oldSize: `${oldState.containerWidth}×${oldState.containerHeight}`,
				newSize: `${newState.containerWidth}×${newState.containerHeight}`
			});
			return true;
		}

		return false;
	}

    /**
     * 레이아웃을 업데이트합니다
     *
     * @remarks
     * 리팩토링 2025-11-23: CSS 변수만 업데이트하고 레이아웃은 CSS 클래스에 위임
     * - JavaScript: CSS 변수 업데이트 (--grid-columns, --grid-rows 등)
     * - CSS: 클래스 기반 레이아웃 정의 (.vertical-mode, .horizontal-mode)
     * 성능을 위해 모든 읽기 작업을 먼저 수행하고 쓰기 작업을 일괄 적용합니다.
     *
     * ⭐ Section 7.1: 레이아웃 변경 감지 추가
     * - 레이아웃 상태가 변경되지 않았으면 업데이트 건너뜀
     *
     * ⭐ Section 7.2: CSS 변수 배치 업데이트
     * - cssText를 사용한 한 번의 DOM 조작으로 모든 CSS 변수 설정
     * - 리페인트 최소화로 성능 향상
     *
     * ⭐ 2D Matrix 모드: matrix-view 클래스가 있으면 레이아웃 업데이트 건너뜀
     * - Matrix 모드는 자체 CSS 레이아웃을 사용하므로 기존 레이아웃과 독립
     */
    updateLayout(): void {
        // ⭐ 2D Matrix 모드 확인 - matrix-view 클래스가 있으면 건너뜀
        if (this.containerEl.classList.contains('matrix-view')) {
            this.logger.debug('Layout', 'Matrix 모드 활성화됨, 레이아웃 업데이트 건너뜀');
            return;
        }

		// ⭐ Section 7.1: 레이아웃 변경 감지
		const currentState = this.getCurrentLayoutState();

		if (!this.hasLayoutChanged(this.lastLayoutState, currentState)) {
			this.logger.debug('Layout', '레이아웃 상태 변경 없음, 업데이트 건너뜀', {
				mode: currentState.mode,
				containerSize: `${currentState.containerWidth}×${currentState.containerHeight}`,
				cardMinSize: `${currentState.cardMinWidth}×${currentState.cardMinHeight}`
			});
			return;
		}

        // ⭐ Performance: 캐싱된 크기 사용 (getBoundingClientRect 호출 방지)
        const size = this.getContainerSize();
        const mode = this.currentMode;

        // 그리드 크기 계산 (그룹화 여부와 무관하게 항상 계산)
        const gridSize = mode === 'vertical'
            ? this.calculateGridSize(size.width, this.settings.cardMinWidth)
            : this.calculateGridSize(size.height, this.settings.cardMinHeight);

        this.logger.debug('Layout', '레이아웃 업데이트', {
            mode,
            gridSize,
            width: size.width,
            height: size.height,
            cardMinWidth: this.settings.cardMinWidth,
            cardMinHeight: this.settings.cardMinHeight
        });

        // ⭐ Section 7.2: 모든 CSS 변수를 배치로 업데이트
        this.batchUpdateCSSVariables(gridSize, mode);

        // 모드 클래스는 항상 적용 (그룹화 여부와 무관)
        if (mode === 'vertical') {
            this.containerEl.classList.remove('horizontal-mode');
            this.containerEl.classList.add('vertical-mode');
        } else {
            this.containerEl.classList.remove('vertical-mode');
            this.containerEl.classList.add('horizontal-mode');
        }

        // 그룹화가 활성화된 경우 추가 설정 생략
        const hasGroups = this.containerEl.querySelector('.card-group-section') !== null;

        // ⭐ 디버깅: 최종 적용된 상태 로깅
        this.logger.debug('Layout', '레이아웃 적용 완료', {
            mode,
            gridSize,
            hasGroups,
            appliedClasses: this.containerEl.className,
            cssVariables: {
                '--grid-columns': this.containerEl.style.getPropertyValue('--grid-columns'),
                '--grid-rows': this.containerEl.style.getPropertyValue('--grid-rows'),
                '--card-min-width': this.containerEl.style.getPropertyValue('--card-min-width'),
                '--card-min-height': this.containerEl.style.getPropertyValue('--card-min-height')
            }
        });

		// ⭐ Section 7.1: 레이아웃 상태 저장
		this.lastLayoutState = currentState;

        if (hasGroups) {
            this.logger.debug('Layout', '그룹화 모드: CSS에 레이아웃 위임');
            return;
        }

        // 그룹 컨테이너에 CSS 변수 전파
        this.applyGridToGroupContents();
    }

	/**
	 * ⭐ Section 7.2: 모든 CSS 변수를 배치로 업데이트합니다
	 *
	 * @param gridSize - 그리드 크기 (열 또는 행 개수)
	 * @param mode - 레이아웃 모드
	 *
	 * @remarks
	 * 성능 최적화를 위해 모든 CSS 변수를 한 번에 설정합니다.
	 * 개별 setProperty 호출 대신 cssText를 사용하여 리페인트를 최소화합니다.
	 */
	private batchUpdateCSSVariables(gridSize: number, mode: LayoutMode): void {
		// 기존 인라인 스타일 보존 (다른 코드에서 설정한 스타일이 있을 수 있음)
		const existingStyles = this.containerEl.style.cssText;

		// 새로운 CSS 변수 문자열 생성
		const cssVarString = [
			`--card-min-width: ${this.settings.cardMinWidth}px`,
			`--card-min-height: ${this.settings.cardMinHeight}px`,
			`--card-max-width: ${this.settings.cardMaxWidth}px`,
			`--card-max-height: ${this.settings.cardMaxHeight}px`,
			`--card-gap: ${this.settings.gap}px`,
			mode === 'vertical'
				? `--grid-columns: ${gridSize}`
				: `--grid-rows: ${gridSize}`
		].join('; ');

		// ⭐ 배치 업데이트: 한 번의 DOM 조작으로 모든 변수 설정
		// 기존 스타일과 병합하여 설정
		if (existingStyles) {
			// 기존 스타일에서 우리가 관리하는 CSS 변수 제거
			const filteredStyles = existingStyles
				.split(';')
				.filter(style => {
					const trimmed = style.trim();
					return trimmed &&
						!trimmed.startsWith('--card-min-width') &&
						!trimmed.startsWith('--card-min-height') &&
						!trimmed.startsWith('--card-max-width') &&
						!trimmed.startsWith('--card-max-height') &&
						!trimmed.startsWith('--card-gap') &&
						!trimmed.startsWith('--grid-columns') &&
						!trimmed.startsWith('--grid-rows');
				})
				.join('; ');

			this.containerEl.style.cssText = filteredStyles
				? `${filteredStyles}; ${cssVarString}`
				: cssVarString;
		} else {
			this.containerEl.style.cssText = cssVarString;
		}
	}

    /**
     * CSS 변수를 업데이트합니다
     *
     * @remarks
     * @deprecated Section 7.2에서 batchUpdateCSSVariables()로 대체됨
     * 카드 크기 관련 CSS 변수만 업데이트합니다.
     */
    private updateCSSVariables(): void {
        const cssVars = {
            '--card-min-width': `${this.settings.cardMinWidth}px`,
            '--card-min-height': `${this.settings.cardMinHeight}px`,
            '--card-max-width': `${this.settings.cardMaxWidth}px`,
            '--card-max-height': `${this.settings.cardMaxHeight}px`,
            '--card-gap': `${this.settings.gap}px`
        };

        Object.entries(cssVars).forEach(([key, value]) => {
            this.containerEl.style.setProperty(key, value);
        });
    }

    /**
     * 그룹화된 카드 컨테이너에 CSS 변수를 전파합니다
     *
     * @remarks
     * 리팩토링 2025-11-23: 인라인 스타일 대신 CSS 클래스 상속 사용
     * 그룹 컨테이너는 부모의 CSS 변수를 상속받으므로 추가 작업 불필요
     */
    private applyGridToGroupContents(): void {
        // CSS 변수는 자동으로 상속되므로 별도 처리 불필요
        // 그룹 컨테이너의 레이아웃은 styles.css의 .card-group-content에서 관리
    }

    /**
     * 그리드 크기를 계산합니다
     *
     * @param containerSize - 컨테이너 크기 (너비 또는 높이)
     * @param cardSize - 카드 크기 (최소 너비 또는 최소 높이)
     * @returns 그리드 개수 (열 수 또는 행 수)
     *
     * @remarks
     * 간격을 고려하여 정확한 개수를 계산합니다.
     * 계산된 크기가 컨테이너를 초과하면 1개를 줄여 반환합니다.
     */
    private calculateGridSize(containerSize: number, cardSize: number): number {
        const preliminaryCount = Math.floor(
            (containerSize + this.settings.gap) / 
            (cardSize + this.settings.gap)
        );
        
        const count = Math.max(1, preliminaryCount);
        
        const totalGapSize = (count - 1) * this.settings.gap;
        const requiredSize = cardSize * count + totalGapSize;
        
        if (requiredSize > containerSize) {
            return Math.max(1, count - 1);
        }
        
        return count;
    }

    /**
     * 설정을 업데이트합니다
     *
     * @param settings - 새로운 레이아웃 설정
     *
     * @remarks
     * ⭐ orientationMode 변경 시 현재 모드를 재감지하여 즉시 적용합니다.
     */
    updateSettings(settings: LayoutSettings): void {
        this.settings = settings;

        // orientationMode 변경 시 현재 모드 재감지
        const size = this.getContainerSize();
        const newMode = this.detectLayoutModeFromSize(size);
        if (newMode !== this.currentMode) {
            this.currentMode = newMode;
            this.logger.debug('Layout', 'orientationMode 변경으로 모드 전환', {
                newMode,
                orientationMode: this.getFullSettings().layout.orientationMode
            });
        }

        // 상태 무효화하여 강제 업데이트
        this.lastLayoutState = null;
        this.updateLayout();
    }

	/**
	 * ⭐ Section 7.1: 레이아웃을 강제로 업데이트합니다
	 *
	 * @remarks
	 * 변경 감지를 무시하고 무조건 레이아웃을 다시 계산합니다.
	 * 주로 디버깅이나 특정 상황에서 레이아웃 리셋이 필요한 경우 사용합니다.
	 */
	forceUpdateLayout(): void {
		this.lastLayoutState = null;
		this.updateLayout();
	}

	/**
	 * ⭐ 레이아웃 상태를 무효화합니다 (즉시 업데이트 없이)
	 *
	 * @remarks
	 * 다음 updateLayout() 호출 시 상태 비교를 건너뛰고 레이아웃을 다시 적용합니다.
	 * forceRender 등에서 container.style.cssText가 초기화될 때 사용합니다.
	 */
	invalidateState(): void {
		this.lastLayoutState = null;
		this.logger.debug('Layout', '레이아웃 상태 무효화됨');
	}

    /**
     * 현재 레이아웃 모드를 반환합니다
     *
     * @returns 현재 레이아웃 모드
     */
    getMode(): LayoutMode {
        return this.currentMode;
    }

    /**
     * ⭐ Phase 3.5: 뷰포트 레이아웃 관리자에 카드 목록을 업데이트합니다
     *
     * @param cards - 카드 요소 배열
     */
    updateViewportCards(cards: HTMLElement[]): void {
        if (this.viewportLayoutManager) {
            this.viewportLayoutManager.updateCards(cards);
        }
    }

    /**
     * ⭐ Phase 3.5: ViewportLayoutManager 인스턴스를 반환합니다
     */
    getViewportLayoutManager(): ViewportLayoutManager | null {
        return this.viewportLayoutManager;
    }

    /**
     * 리소스를 정리합니다
     */
    destroy(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        // ⭐ Performance Phase 2: requestAnimationFrame 정리
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // ⭐ Phase 3.5: ViewportLayoutManager 정리
        if (this.viewportLayoutManager) {
            this.viewportLayoutManager.destroy();
            this.viewportLayoutManager = null;
        }
    }
}

import { LayoutSettings, LayoutMode, CardNavigatorSettings } from '../types';
import { DebugLogger } from '../utils/DebugLogger';
import { ViewportLayoutManager } from './ViewportLayoutManager';

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
 */
export class LayoutManager {
    private containerEl: HTMLElement;
    private settings: LayoutSettings;
    private currentMode: LayoutMode;
    private resizeObserver: ResizeObserver | null = null;
    private resizeTimeout: NodeJS.Timeout | null = null;
    private previousSize: { width: number; height: number } | null = null;
    private logger: DebugLogger;

    /** ⭐ Phase 3.5: 뷰포트 기반 레이아웃 관리자 */
    private viewportLayoutManager: ViewportLayoutManager | null = null;

    /** 전체 설정 가져오기 함수 (ViewportLayoutManager용) */
    private getFullSettings: () => CardNavigatorSettings;

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

        // 초기 레이아웃 적용
        this.updateLayout();
    }

    /**
     * 현재 레이아웃 모드를 감지합니다
     * 
     * @returns width > height이면 'horizontal', 아니면 'vertical'
     */
    private detectLayoutMode(): LayoutMode {
        const rect = this.containerEl.getBoundingClientRect();
        return rect.width > rect.height ? 'horizontal' : 'vertical';
    }

    /**
     * ResizeObserver를 설정합니다
     */
    private setupResizeObserver(): void {
        this.resizeObserver = new ResizeObserver(() => {
            this.onResize();
        });
        this.resizeObserver.observe(this.containerEl);
    }

    /**
     * 창 크기 변경 시 호출됩니다
     *
     * @remarks
     * 디바운싱을 적용하여 과도한 재계산을 방지합니다.
     * 크기가 임계값(20px) 이상 변경되거나 모드가 바뀔 때만 레이아웃을 업데이트합니다.
     */
    private onResize(): void {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            const rect = this.containerEl.getBoundingClientRect();
            const newMode = this.detectLayoutMode();

            const widthChange = this.previousSize
                ? Math.abs(rect.width - this.previousSize.width)
                : Infinity;
            const heightChange = this.previousSize
                ? Math.abs(rect.height - this.previousSize.height)
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
                    containerSize: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}`
                });

                this.currentMode = newMode;
                this.previousSize = {
                    width: rect.width,
                    height: rect.height
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

            this.resizeTimeout = null;
        }, this.RESIZE_DEBOUNCE_MS);
    }

    /**
     * 레이아웃을 업데이트합니다
     *
     * @remarks
     * 리팩토링 2025-11-23: CSS 변수만 업데이트하고 레이아웃은 CSS 클래스에 위임
     * - JavaScript: CSS 변수 업데이트 (--grid-columns, --grid-rows 등)
     * - CSS: 클래스 기반 레이아웃 정의 (.vertical-mode, .horizontal-mode)
     * 성능을 위해 모든 읽기 작업을 먼저 수행하고 쓰기 작업을 일괄 적용합니다.
     */
    updateLayout(): void {
        const rect = this.containerEl.getBoundingClientRect();
        const mode = this.currentMode;

        // 그리드 크기 계산 (그룹화 여부와 무관하게 항상 계산)
        const gridSize = mode === 'vertical'
            ? this.calculateGridSize(rect.width, this.settings.cardMinWidth)
            : this.calculateGridSize(rect.height, this.settings.cardMinHeight);

        this.logger.debug('Layout', '레이아웃 업데이트', {
            mode,
            gridSize,
            width: rect.width,
            height: rect.height,
            cardMinWidth: this.settings.cardMinWidth,
            cardMinHeight: this.settings.cardMinHeight
        });

        // CSS 변수 업데이트
        this.updateCSSVariables();

        // 그리드 크기 변수 업데이트
        if (mode === 'vertical') {
            this.containerEl.style.setProperty('--grid-columns', gridSize.toString());
        } else {
            this.containerEl.style.setProperty('--grid-rows', gridSize.toString());
        }

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

        if (hasGroups) {
            this.logger.debug('Layout', '그룹화 모드: CSS에 레이아웃 위임');
            return;
        }

        // 그룹 컨테이너에 CSS 변수 전파
        this.applyGridToGroupContents();
    }

    /**
     * CSS 변수를 업데이트합니다
     *
     * @remarks
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
     */
    updateSettings(settings: LayoutSettings): void {
        this.settings = settings;
        this.updateLayout();
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

        // ⭐ Phase 3.5: ViewportLayoutManager 정리
        if (this.viewportLayoutManager) {
            this.viewportLayoutManager.destroy();
            this.viewportLayoutManager = null;
        }
    }
}

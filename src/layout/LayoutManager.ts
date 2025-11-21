import { LayoutSettings, LayoutMode, CardNavigatorSettings } from '../types';
import { DebugLogger } from '../utils/DebugLogger';

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
 */
export class LayoutManager {
    private containerEl: HTMLElement;
    private settings: LayoutSettings;
    private currentMode: LayoutMode;
    private resizeObserver: ResizeObserver | null = null;
    private resizeTimeout: NodeJS.Timeout | null = null;
    private previousSize: { width: number; height: number } | null = null;
    private logger: DebugLogger;
    
    private readonly RESIZE_DEBOUNCE_MS = 100;
    private readonly SIZE_CHANGE_THRESHOLD = 20;

    constructor(containerEl: HTMLElement, settings: LayoutSettings, getFullSettings: () => CardNavigatorSettings) {
        this.containerEl = containerEl;
        this.settings = settings;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(getFullSettings);
        
        const rect = this.containerEl.getBoundingClientRect();
        this.previousSize = {
            width: rect.width,
            height: rect.height
        };
        
        this.currentMode = this.detectLayoutMode();
        this.setupResizeObserver();
        
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
            
            if (modeChanged || significantSizeChange) {
                this.logger.debug('Layout', '레이아웃 업데이트', {
                    modeChanged,
                    widthChange: widthChange.toFixed(1),
                    heightChange: heightChange.toFixed(1),
                    threshold: this.SIZE_CHANGE_THRESHOLD
                });
                
                this.currentMode = newMode;
                this.previousSize = {
                    width: rect.width,
                    height: rect.height
                };
                this.updateLayout();
            }
            
            this.resizeTimeout = null;
        }, this.RESIZE_DEBOUNCE_MS);
    }

    /**
     * 레이아웃을 업데이트합니다
     * 
     * @remarks
     * CSS 변수와 Grid 속성을 업데이트하여 카드 배치를 조정합니다.
     * 성능을 위해 모든 읽기 작업을 먼저 수행하고 쓰기 작업을 일괄 적용합니다.
     */
    updateLayout(): void {
        const rect = this.containerEl.getBoundingClientRect();
        const mode = this.currentMode;
        
        const gridSize = mode === 'vertical'
            ? this.calculateGridSize(rect.width, this.settings.cardMinWidth)
            : this.calculateGridSize(rect.height, this.settings.cardMinHeight);
        
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
        
        if (mode === 'vertical') {
            this.applyVerticalMode(gridSize);
        } else {
            this.applyHorizontalMode(gridSize);
        }
    }

    /**
     * 세로 모드 레이아웃을 적용합니다
     * 
     * @param columns - 열 수
     */
    private applyVerticalMode(columns: number): void {
        const styles = {
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gridAutoRows: `minmax(${this.settings.cardMinHeight}px, auto)`,
            gridTemplateRows: '',
            gridAutoColumns: '',
            gridAutoFlow: 'row',
            overflowX: 'hidden',
            overflowY: 'auto'
        };

        Object.entries(styles).forEach(([key, value]) => {
            (this.containerEl.style as any)[key] = value;
        });

        // 모드 클래스 적용
        this.containerEl.classList.remove('horizontal-mode');
        this.containerEl.classList.add('vertical-mode');
    }

    /**
     * 가로 모드 레이아웃을 적용합니다
     * 
     * @param rows - 행 수
     */
    private applyHorizontalMode(rows: number): void {
        const styles = {
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gridAutoColumns: `minmax(${this.settings.cardMinWidth}px, auto)`,
            gridTemplateColumns: '',
            gridAutoRows: '',
            gridAutoFlow: 'column',
            overflowX: 'auto',
            overflowY: 'hidden'
        };

        Object.entries(styles).forEach(([key, value]) => {
            (this.containerEl.style as any)[key] = value;
        });

        // 모드 클래스 적용
        this.containerEl.classList.remove('vertical-mode');
        this.containerEl.classList.add('horizontal-mode');
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
    }
}

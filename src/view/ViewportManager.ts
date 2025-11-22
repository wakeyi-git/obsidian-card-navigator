import { DebugLogger } from '../utils/DebugLogger';
import { CardNavigatorSettings } from '../types';

/**
 * Intersection Observer를 사용한 viewport 관리
 * 
 * @remarks
 * 브라우저의 Intersection Observer API를 래핑하여
 * 카드의 가시성을 추적하고 효율적인 렌더링을 지원합니다.
 * 
 * @example
 * ```typescript
 * const viewport = new ViewportManager(
 *     container,
 *     (card) => renderCard(card),
 *     (card) => cleanupCard(card),
 *     settings
 * );
 * viewport.observe(cardElement);
 * ```
 */
export class ViewportManager {
    private logger: DebugLogger;
    private observer: IntersectionObserver | null = null;
    private visibleCards = new Set<HTMLElement>();
    private pendingRenders = new Map<HTMLElement, boolean>();
    private settings: CardNavigatorSettings;

    /**
     * @param container - 관찰할 컨테이너 요소
     * @param onCardVisible - 카드가 viewport에 들어올 때 실행할 콜백
     * @param onCardHidden - 카드가 viewport에서 나갈 때 실행할 콜백 (선택)
     * @param settings - 설정 객체 (디버그 로깅용)
     * @param options - Intersection Observer 옵션
     */
    constructor(
        private container: HTMLElement,
        private onCardVisible: (card: HTMLElement) => Promise<void>,
        private onCardHidden: ((card: HTMLElement) => void) | undefined,
        settings: CardNavigatorSettings,
        options?: {
            rootMargin?: string;
            threshold?: number;
        }
    ) {
        this.settings = settings;
        this.logger = new DebugLogger(() => settings);
        this.initialize(options);
    }
    
    /**
     * Intersection Observer 초기화
     * 
     * @private
     */
    private initialize(options?: {
        rootMargin?: string;
        threshold?: number;
    }): void {
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                root: this.container,
                rootMargin: options?.rootMargin ?? '400px', // 미리 로드
                threshold: options?.threshold ?? 0.01
            }
        );
        
        this.logger.debug('View', 'Initialized', {
        rootMargin: options?.rootMargin ?? '400px',
        threshold: options?.threshold ?? 0.01
        });
    }
    
    /**
     * 카드 관찰 시작
     * 
     * @param card - 관찰할 카드 요소
     */
    observe(card: HTMLElement): void {
        if (!this.observer) {
        this.logger.error('View', 'Observer not initialized');
        return;
        }
        
        this.observer.observe(card);
    }
    
    /**
     * 카드 관찰 중지
     * 
     * @param card - 관찰을 중지할 카드 요소
     */
    unobserve(card: HTMLElement): void {
        if (!this.observer) {
            return;
        }
        
        this.observer.unobserve(card);
        this.visibleCards.delete(card);
        this.pendingRenders.delete(card);
    }
    
    /**
     * viewport 진입/이탈 처리
     * 
     * @private
     */
    private async handleIntersection(
        entries: IntersectionObserverEntry[]
    ): Promise<void> {
        for (const entry of entries) {
            const card = entry.target as HTMLElement;
            
            if (entry.isIntersecting) {
                // viewport 진입
                await this.handleCardVisible(card);
            } else {
                // viewport 이탈
                this.handleCardHidden(card);
            }
        }
    }
    
    /**
     * 카드가 viewport에 진입했을 때 처리
     * 
     * @private
     */
    private async handleCardVisible(card: HTMLElement): Promise<void> {
        // 이미 렌더링 중이거나 완료된 경우 스킵
        if (this.pendingRenders.get(card) || card.classList.contains('card-rendered')) {
            return;
        }
        
        this.visibleCards.add(card);
        this.pendingRenders.set(card, true);
        
        this.logger.debug('View', 'Card visible', {
        path: card.dataset.filePath
        });
        
        try {
            await this.onCardVisible(card);
        } catch (error) {
            this.logger.error('View', 'Failed to render visible card', {
            path: card.dataset.filePath,
            error
            });
        } finally {
            this.pendingRenders.delete(card);
        }
    }
    
    /**
     * 카드가 viewport에서 나갔을 때 처리
     *
     * @private
     */
    private handleCardHidden(card: HTMLElement): void {
        // 핀된 파일 항상 표시 옵션이 활성화되어 있고, 이 카드가 핀된 파일이면 숨기지 않음
        const filePath = card.dataset.filePath;
        if (this.settings.alwaysShowPinnedFiles &&
            filePath &&
            this.settings.pinnedFiles?.includes(filePath)) {
            this.logger.debug('View', 'Pinned card - keeping visible', {
                path: filePath
            });
            return;
        }

        this.visibleCards.delete(card);

        if (this.onCardHidden) {
            this.onCardHidden(card);
        }

        this.logger.debug('View', 'Card hidden', {
            path: card.dataset.filePath
        });
    }
    
    /**
     * 현재 보이는 카드 목록 반환
     */
    getVisibleCards(): HTMLElement[] {
        return Array.from(this.visibleCards);
    }
    
    /**
     * 모든 카드 강제 렌더링 (폴백용)
     * 
     * @remarks
     * 개별 카드 렌더링 에러는 로그에 기록하고 계속 진행합니다.
     */
    async renderAllCards(): Promise<void> {
        this.logger.debug('View', 'Force rendering all cards');
        
        const allCards = this.container.querySelectorAll('.card-placeholder');
        const errors: Error[] = [];
        
        for (const card of Array.from(allCards)) {
            if (!card.classList.contains('card-rendered')) {
                try {
                    await this.onCardVisible(card as HTMLElement);
                } catch (error) {
                    // 개별 카드 렌더링 실패는 로그하고 계속 진행
                    this.logger.error('View', 'Failed to render card', {
                        path: (card as HTMLElement).dataset.filePath,
                        error
                    });
                    if (error instanceof Error) {
                        errors.push(error);
                    }
                }
            }
        }
        
        // 에러가 있어도 일부 카드가 성공했다면 계속 진행
        // (모든 카드 렌더링 실패 시에도 에러를 던지지 않고 로그만 남김)
        if (errors.length > 0) {
            this.logger.error('View', `${errors.length} card(s) failed to render out of ${allCards.length} total`);
        }
    }
    
    /**
     * 정리
     */
    destroy(): void {
        this.logger.debug('View', 'Destroying');
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        this.visibleCards.clear();
        this.pendingRenders.clear();
    }
}

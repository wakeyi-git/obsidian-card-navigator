import { TFile } from 'obsidian';
import { CardNavigatorView } from '../view';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * 스크롤 관리자
 * 
 * 카드 뷰의 스크롤 동작을 제어하고 활성 파일 추적 시 자동 스크롤을 제공합니다.
 * center, nearest, none 세 가지 스크롤 모드를 지원합니다.
 */
export class ScrollManager {
    private view: CardNavigatorView;
    private lastScrollTime: number = 0;
    private lastScrollFile: string = '';
    private logger: DebugLogger;
    
    constructor(view: CardNavigatorView) {
        this.view = view;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(() => this.view.plugin.settingsManager.getSettings());
    }
    
    /**
     * 카드가 화면에 보이는지 확인합니다
     * 
     * @private
     */
    private isCardVisible(cardElement: HTMLElement): boolean {
        const container = this.view.containerEl.querySelector('.card-navigator-cards');
        if (!container) return false;
        
        const containerRect = container.getBoundingClientRect();
        const cardRect = cardElement.getBoundingClientRect();
        
        return (
            cardRect.top < containerRect.bottom &&
            cardRect.bottom > containerRect.top &&
            cardRect.left < containerRect.right &&
            cardRect.right > containerRect.left
        );
    }
    
    /**
     * 특정 카드로 스크롤합니다
     * 
     * @private
     */
    private scrollToCard(
        cardElement: HTMLElement,
        behavior: ScrollBehavior = 'smooth',
        block: ScrollLogicalPosition = 'center',
        source: string = 'unknown'
    ): void {
        if (!cardElement) {
            this.logger.debug('Navigation', 'scrollToCard: 카드 요소 없음');
            return;
        }

        const filePath = cardElement.getAttribute('data-file-path') || 'unknown';

        // ⭐ 가로 모드 감지: 컨테이너가 horizontal-mode 클래스를 가지고 있는지 확인
        const container = this.view.containerEl.querySelector('.card-navigator-cards');
        const isHorizontalMode = container?.classList.contains('horizontal-mode');

        // ⭐ 가로 모드에서는 inline/block 방향이 바뀜
        // - 세로 모드: block='center' (상하 스크롤), inline='nearest' (좌우는 최소)
        // - 가로 모드: block='nearest' (상하는 최소), inline='center' (좌우 스크롤)
        const finalBlock: ScrollLogicalPosition = isHorizontalMode ? 'nearest' : block;
        const finalInline: ScrollLogicalPosition = isHorizontalMode ? 'center' : 'nearest';

        this.logger.debug('Navigation', 'scrollToCard 호출', {
            source,
            filePath,
            behavior,
            originalBlock: block,
            finalBlock,
            finalInline,
            isHorizontalMode,
            timestamp: Date.now()
        });

        cardElement.scrollIntoView({
            behavior: behavior,
            block: finalBlock,
            inline: finalInline
        });
    }
    
    /**
     * 카드를 화면에 보이도록 스크롤합니다
     * 
     * @param cardElement - 스크롤할 카드 요소
     * @param source - 스크롤 출처 (디버깅용)
     * 
     * @remarks
     * scrollBehavior 설정에 따라 동작이 달라집니다:
     * - center: 항상 화면 중앙으로 스크롤
     * - nearest: 카드가 보이지 않을 때만 최소 스크롤
     * - none: 스크롤하지 않음
     */
    centerCard(cardElement: HTMLElement, source: string = 'unknown'): void {
        const settings = this.view.plugin.settings;
        const scrollBehavior = settings.scrollBehavior;
        
        this.logger.debug('Navigation', 'centerCard 호출', {
            source,
            scrollBehavior,
            timestamp: Date.now()
        });
        
        if (scrollBehavior === 'none') {
            this.logger.debug('Navigation', 'centerCard: scrollBehavior가 none이므로 스크롤 안 함');
            return;
        }
        
        const isVisible = this.isCardVisible(cardElement);
        
        if (scrollBehavior === 'nearest' && isVisible) {
            this.logger.debug('Navigation', 'centerCard: 카드가 이미 보이므로 스크롤 안 함');
            return;
        }
        
        const block = scrollBehavior === 'center' ? 'center' : 'nearest';
        this.scrollToCard(cardElement, 'smooth', block, source);
    }
    
    /**
     * 카드가 화면에 보이도록 합니다
     * 
     * @param cardElement - 보이게 할 카드 요소
     * @param source - 스크롤 출처 (디버깅용)
     * 
     * @remarks
     * 키보드 네비게이션에서 사용되며, scrollBehavior 설정과 관계없이
     * 포커스된 카드는 항상 보이도록 최소 스크롤합니다.
     */
    ensureVisible(cardElement: HTMLElement, source: string = 'unknown'): void {
        if (!cardElement) return;
        
        this.logger.debug('Navigation', 'ensureVisible 호출', {
            source,
            timestamp: Date.now()
        });
        
        const isVisible = this.isCardVisible(cardElement);
        
        if (!isVisible) {
            this.scrollToCard(cardElement, 'smooth', 'nearest', source);
        }
    }
    
    /**
     * 활성 파일의 카드로 스크롤합니다
     * 
     * @param file - 활성 파일
     * @param source - 스크롤 출처 (디버깅용)
     * @param forceScroll - 중복 방지를 무시하고 강제 스크롤
     * 
     * @remarks
     * 200ms 내에 같은 파일로의 중복 스크롤을 방지합니다.
     * ⭐ Phase 4 추가 2025-11-18: 플레이스홀더 강제 렌더링
     */
    async scrollToActiveFile(
        file: TFile, 
        source: string = 'unknown',
        forceScroll: boolean = false
    ): Promise<void> {
        const now = Date.now();
        const settings = this.view.plugin.settings;
        
        if (settings.scrollBehavior === 'none') {
            this.logger.debug('Navigation', 'scrollToActiveFile: scrollBehavior가 none → 애니메이션 없이 중앙으로 이동');
            // 애니메이션 없이 즉시 중앙으로 스크롤
            const container = this.view.containerEl.querySelector('.card-navigator-cards');
            if (!container) return;

            const cards = Array.from(container.querySelectorAll('.card-item')) as HTMLElement[];
            for (const card of cards) {
                if (card.getAttribute('data-file-path') === file.path) {
                    // ⭐ 가로 모드 감지
                    const isHorizontalMode = container.classList.contains('horizontal-mode');

                    // 가로 모드에서는 inline/block 방향이 바뀜
                    const finalBlock: ScrollLogicalPosition = isHorizontalMode ? 'nearest' : 'center';
                    const finalInline: ScrollLogicalPosition = isHorizontalMode ? 'center' : 'nearest';

                    card.scrollIntoView({
                        behavior: 'instant',
                        block: finalBlock,
                        inline: finalInline
                    });
                    return;
                }
            }
            return;
        }
        
        if (!forceScroll && 
            now - this.lastScrollTime < 200 && 
            this.lastScrollFile === file.path) {
            this.logger.debug('Navigation', 'scrollToActiveFile: 중복 스크롤 방지됨', {
                source,
                filePath: file.path,
                timeSinceLastScroll: now - this.lastScrollTime
            });
            return;
        }
        
        this.logger.debug('Navigation', 'scrollToActiveFile 호출', {
            source,
            filePath: file.path,
            forceScroll,
            scrollBehavior: settings.scrollBehavior,
            timestamp: now
        });
        
        this.lastScrollTime = now;
        this.lastScrollFile = file.path;
        
        const container = this.view.containerEl.querySelector('.card-navigator-cards');
        if (!container) {
            this.logger.debug('Navigation', 'scrollToActiveFile: 카드 컨테이너 없음');
            return;
        }
        
        const cards = Array.from(container.querySelectorAll('.card-item')) as HTMLElement[];
        
        for (const card of cards) {
            const path = card.getAttribute('data-file-path');
            if (path === file.path) {
                this.logger.debug('Navigation', 'scrollToActiveFile: 카드 찾음, 스크롤 시작');
                
                // 플레이스홀더인 경우 먼저 렌더링
                if (card.classList.contains('card-placeholder')) {
                    this.logger.debug('Navigation', '플레이스홀더 감지, 강제 렌더링 실행');
                    
                    // ViewRenderer를 통해 렌더링
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const viewRenderer = (this.view as any).viewRenderer;
                    if (viewRenderer && viewRenderer.viewportManager) {
                        // CardFactory를 통해 플레이스홀더 렌더링
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const cardFactory = (this.view as any).cardFactory;
                        if (cardFactory && cardFactory.renderPlaceholder) {
                            await cardFactory.renderPlaceholder(
                                card,
                                (f: TFile) => this.view.openFile(f)
                            );
                        }
                    }
                }
                
                this.centerCard(card, source);
                return;
            }
        }
        
        this.logger.debug('Navigation', 'scrollToActiveFile: 카드를 찾지 못함', {
            filePath: file.path,
            totalCards: cards.length,
            availablePaths: cards.map(c => c.getAttribute('data-path'))
        });
    }
    
    /**
     * 현재 뷰포트에 보이는 카드 개수를 계산합니다
     * 
     * @returns 보이는 카드 개수
     */
    getVisibleCardCount(): number {
        const container = this.view.containerEl.querySelector('.card-navigator-cards');
        if (!container) return 0;
        
        const containerRect = container.getBoundingClientRect();
        const cards = Array.from(container.querySelectorAll('.card-item')) as HTMLElement[];
        
        let visibleCount = 0;
        for (const card of cards) {
            const cardRect = card.getBoundingClientRect();
            
            const isVisible = (
                cardRect.top < containerRect.bottom &&
                cardRect.bottom > containerRect.top
            );
            
            if (isVisible) {
                visibleCount++;
            }
        }
        
        return visibleCount;
    }
    
    /**
     * 페이지 단위로 스크롤합니다
     * 
     * @param direction - 스크롤 방향 (-1: 위, 1: 아래)
     */
    pageScroll(direction: number): void {
        const container = this.view.containerEl.querySelector('.card-navigator-cards') as HTMLElement;
        if (!container) return;
        
        const viewportHeight = container.clientHeight;
        const scrollAmount = viewportHeight * 0.8;
        
        container.scrollBy({
            top: scrollAmount * direction,
            behavior: 'smooth'
        });
    }
    
    /**
     * 맨 위로 스크롤합니다
     */
    scrollToTop(): void {
        const container = this.view.containerEl.querySelector('.card-navigator-cards') as HTMLElement;
        if (!container) return;
        
        container.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
    
    /**
     * 맨 아래로 스크롤합니다
     */
    scrollToBottom(): void {
        const container = this.view.containerEl.querySelector('.card-navigator-cards') as HTMLElement;
        if (!container) return;
        
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }
}

import { TFile } from 'obsidian';
import { CardNavigatorView } from '../view';
import { CardSettings } from '../types';

/**
 * 키보드 네비게이션
 * 
 * 방향키, Enter, Home/End 등을 사용한 카드 탐색을 제공합니다.
 * 
 * @remarks
 * 그리드 레이아웃을 감지하여 상하좌우 이동을 지원하며,
 * 포커스된 카드는 자동으로 화면에 보이도록 스크롤됩니다.
 */
export class KeyboardNavigator {
    private view: CardNavigatorView;
    private focusedIndex: number = -1;
    private cards: HTMLElement[] = [];
    private files: TFile[] = [];
    
    constructor(view: CardNavigatorView) {
        this.view = view;
    }
    
    /**
     * 키보드 이벤트 리스너를 등록합니다
     */
    registerKeyboardListeners(): void {
        this.view.containerEl.addEventListener('keydown', (e: KeyboardEvent) => {
            this.handleKeyDown(e);
        });
        
        this.view.containerEl.setAttribute('tabindex', '0');
    }
    
    /**
     * 현재 카드 목록을 업데이트합니다
     * 
     * @param cards - 렌더링된 카드 요소
     * @param files - 해당 파일
     */
    updateCards(cards: HTMLElement[], files: TFile[]): void {
        this.cards = cards;
        this.files = files;
        
        if (this.focusedIndex >= this.cards.length) {
            this.focusedIndex = -1;
        }
    }
    
    /**
     * 키 입력을 처리합니다
     */
    private handleKeyDown(event: KeyboardEvent): void {
        if (this.cards.length === 0) {
            return;
        }

        // 검색 입력창에 포커스가 있을 때는 키보드 네비게이션 무시
        const target = event.target as HTMLElement;
        if (target && (target.classList.contains('search-input') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
            return;
        }

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.moveFocus('up');
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.moveFocus('down');
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.moveFocus('left');
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.moveFocus('right');
                break;
            case 'Enter':
                event.preventDefault();
                this.openFocusedCard();
                break;
            case 'Escape': {
                event.preventDefault();
                const selectionManager = this.view.selectionManager;
                if (selectionManager && selectionManager.getSelectionCount() > 0) {
                    selectionManager.clearSelection();
                } else {
                    this.clearFocus();
                }
                break;
            }
            case 'Home':
                event.preventDefault();
                this.focusCard(0);
                break;
            case 'End':
                event.preventDefault();
                this.focusCard(this.cards.length - 1);
                break;
            case 'PageUp':
                event.preventDefault();
                this.pageScroll(-1);
                break;
            case 'PageDown':
                event.preventDefault();
                this.pageScroll(1);
                break;
        }
    }
    
    /**
     * 방향키에 따라 포커스를 이동합니다
     * 
     * @param direction - 이동 방향
     * 
     * @remarks
     * 그리드 레이아웃의 열 수를 계산하여 상하좌우 이동을 처리합니다.
     */
    private moveFocus(direction: 'up' | 'down' | 'left' | 'right'): void {
        if (this.focusedIndex === -1) {
            this.focusCard(0);
            return;
        }
        
        const columns = this.calculateColumns();
        let newIndex = this.focusedIndex;
        
        switch (direction) {
            case 'left':
                newIndex = Math.max(0, this.focusedIndex - 1);
                break;
            case 'right':
                newIndex = Math.min(this.cards.length - 1, this.focusedIndex + 1);
                break;
            case 'up':
                newIndex = Math.max(0, this.focusedIndex - columns);
                break;
            case 'down':
                newIndex = Math.min(this.cards.length - 1, this.focusedIndex + columns);
                break;
        }
        
        this.focusCard(newIndex);
    }
    
    /**
     * 그리드의 열 수를 계산합니다
     * 
     * @returns 열 수
     * 
     * @remarks
     * 첫 번째 행의 카드들을 분석하여 현재 그리드의 열 수를 동적으로 계산합니다.
     */
    private calculateColumns(): number {
        if (this.cards.length === 0) return 1;
        
        const firstCard = this.cards[0];
        const firstLeft = firstCard.getBoundingClientRect().left;
        
        let columns = 1;
        for (let i = 1; i < this.cards.length; i++) {
            const card = this.cards[i];
            const left = card.getBoundingClientRect().left;
            
            if (Math.abs(left - firstLeft) > 5) {
                columns++;
            } else {
                break;
            }
        }
        
        return columns;
    }
    
    /**
     * 특정 인덱스의 카드에 포커스를 설정합니다
     * 
     * @param index - 카드 인덱스
     * 
     * ⭐ 버그 수정 2025-11-16: 섹션별 스타일 적용 및 active 상태 고려
     * ⭐ Phase 4 추가 2025-11-18: 플레이스홀더 자동 렌더링
     */
    private focusCard(index: number): void {
        if (index < 0 || index >= this.cards.length) {
            return;
        }
        
        // 이전 focused 카드 제거 및 스타일 복원
        if (this.focusedIndex >= 0 && this.focusedIndex < this.cards.length) {
            const prevCard = this.cards[this.focusedIndex];
            prevCard.removeClass('focused');
            
            // active 상태를 고려하여 복원
            const isActive = prevCard.hasClass('active');
            this.restoreCardStyle(prevCard, isActive);
        }
        
        this.focusedIndex = index;
        const card = this.cards[index];
        card.addClass('focused');
        
        // focused 스타일 적용
        this.applyFocusedStyle(card);
        
        // 플레이스홀더인 경우 자동 렌더링
        // scrollIntoView가 ViewportManager에 의해 자동으로 실행됨
        if (card.classList.contains('card-placeholder')) {
            card.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        } else {
            card.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    }
    
    /**
     * 포커스를 해제합니다
     * 
     * ⭐ 버그 수정 2025-11-16: active 상태를 고려하여 스타일 복원
     */
    private clearFocus(): void {
        if (this.focusedIndex >= 0 && this.focusedIndex < this.cards.length) {
            const card = this.cards[this.focusedIndex];
            card.removeClass('focused');
            
            // active 상태를 고려하여 복원
            const isActive = card.hasClass('active');
            this.restoreCardStyle(card, isActive);
        }
        this.focusedIndex = -1;
    }
    
    /**
     * ⭐ focused 스타일을 적용합니다 (섹션별 스타일 포함)
     * 
     * @private
     * @param card - 카드 DOM 요소
     */
    private applyFocusedStyle(card: HTMLElement): void {
        // 카드 전체 스타일
        const cardBg = card.dataset.focusedBg;
        const cardFontSize = card.dataset.focusedFontSize;
        const cardBorderColor = card.dataset.focusedBorderColor;
        const cardBorderWidth = card.dataset.focusedBorderWidth;
        const cardBorderRadius = card.dataset.focusedBorderRadius;
        
        if (cardBg) card.style.backgroundColor = cardBg;
        if (cardFontSize) card.style.fontSize = cardFontSize;
        if (cardBorderColor) card.style.borderColor = cardBorderColor;
        if (cardBorderWidth) card.style.borderWidth = cardBorderWidth;
        if (cardBorderRadius) card.style.borderRadius = cardBorderRadius;
        
        // 헤더 스타일
        const header = card.querySelector('.card-header') as HTMLElement;
        if (header) {
            const headerBg = card.dataset.headerFocusedBg;
            const headerFontSize = card.dataset.headerFocusedFontSize;
            const headerBorderColor = card.dataset.headerFocusedBorderColor;
            const headerBorderWidth = card.dataset.headerFocusedBorderWidth;
            
            if (headerBg) header.style.backgroundColor = headerBg;
            if (headerFontSize) header.style.fontSize = headerFontSize;
            if (headerBorderColor) header.style.borderBottomColor = headerBorderColor;
            if (headerBorderWidth) {
                header.style.borderBottomWidth = headerBorderWidth;
                header.style.borderBottomStyle = parseInt(headerBorderWidth) > 0 ? 'solid' : 'none';
            }
        }
        
        // 바디 스타일
        const body = card.querySelector('.card-body') as HTMLElement;
        if (body) {
            const bodyBg = card.dataset.bodyFocusedBg;
            const bodyFontSize = card.dataset.bodyFocusedFontSize;
            
            if (bodyBg) body.style.backgroundColor = bodyBg;
            if (bodyFontSize) body.style.fontSize = bodyFontSize;
        }
        
        // 풋터 스타일
        const footer = card.querySelector('.card-footer') as HTMLElement;
        if (footer) {
            const footerBg = card.dataset.footerFocusedBg;
            const footerFontSize = card.dataset.footerFocusedFontSize;
            const footerBorderColor = card.dataset.footerFocusedBorderColor;
            const footerBorderWidth = card.dataset.footerFocusedBorderWidth;
            
            if (footerBg) footer.style.backgroundColor = footerBg;
            if (footerFontSize) footer.style.fontSize = footerFontSize;
            if (footerBorderColor) footer.style.borderTopColor = footerBorderColor;
            if (footerBorderWidth) {
                footer.style.borderTopWidth = footerBorderWidth;
                footer.style.borderTopStyle = parseInt(footerBorderWidth) > 0 ? 'solid' : 'none';
            }
        }
    }
    
    /**
     * ⭐ 카드 스타일을 복원합니다 (섹션별 스타일 포함)
     * 
     * @private
     * @param card - 카드 DOM 요소
     * @param isActive - active 상태 여부
     */
    private restoreCardStyle(card: HTMLElement, isActive: boolean): void {
        const statePrefix = isActive ? 'Active' : 'Normal';
        
        // 카드 전체 스타일
        const cardBg = card.dataset[`${isActive ? 'active' : 'normal'}Bg`];
        const cardFontSize = card.dataset[`${isActive ? 'active' : 'normal'}FontSize`];
        const cardBorderColor = card.dataset[`${isActive ? 'active' : 'normal'}BorderColor`];
        const cardBorderWidth = card.dataset[`${isActive ? 'active' : 'normal'}BorderWidth`];
        const cardBorderRadius = card.dataset[`${isActive ? 'active' : 'normal'}BorderRadius`];
        
        if (cardBg) card.style.backgroundColor = cardBg;
        if (cardFontSize) card.style.fontSize = cardFontSize;
        if (cardBorderColor) card.style.borderColor = cardBorderColor;
        if (cardBorderWidth) card.style.borderWidth = cardBorderWidth;
        if (cardBorderRadius) card.style.borderRadius = cardBorderRadius;
        
        // 헤더 스타일
        const header = card.querySelector('.card-header') as HTMLElement;
        if (header) {
            const headerBg = card.dataset[`header${statePrefix}Bg`];
            const headerFontSize = card.dataset[`header${statePrefix}FontSize`];
            const headerBorderColor = card.dataset[`header${statePrefix}BorderColor`];
            const headerBorderWidth = card.dataset[`header${statePrefix}BorderWidth`];
            
            if (headerBg) header.style.backgroundColor = headerBg;
            if (headerFontSize) header.style.fontSize = headerFontSize;
            if (headerBorderColor) header.style.borderBottomColor = headerBorderColor;
            if (headerBorderWidth) {
                header.style.borderBottomWidth = headerBorderWidth;
                header.style.borderBottomStyle = parseInt(headerBorderWidth) > 0 ? 'solid' : 'none';
            }
        }
        
        // 바디 스타일
        const body = card.querySelector('.card-body') as HTMLElement;
        if (body) {
            const bodyBg = card.dataset[`body${statePrefix}Bg`];
            const bodyFontSize = card.dataset[`body${statePrefix}FontSize`];
            
            if (bodyBg) body.style.backgroundColor = bodyBg;
            if (bodyFontSize) body.style.fontSize = bodyFontSize;
        }
        
        // 풋터 스타일
        const footer = card.querySelector('.card-footer') as HTMLElement;
        if (footer) {
            const footerBg = card.dataset[`footer${statePrefix}Bg`];
            const footerFontSize = card.dataset[`footer${statePrefix}FontSize`];
            const footerBorderColor = card.dataset[`footer${statePrefix}BorderColor`];
            const footerBorderWidth = card.dataset[`footer${statePrefix}BorderWidth`];
            
            if (footerBg) footer.style.backgroundColor = footerBg;
            if (footerFontSize) footer.style.fontSize = footerFontSize;
            if (footerBorderColor) footer.style.borderTopColor = footerBorderColor;
            if (footerBorderWidth) {
                footer.style.borderTopWidth = footerBorderWidth;
                footer.style.borderTopStyle = parseInt(footerBorderWidth) > 0 ? 'solid' : 'none';
            }
        }
    }
    
    /**
     * 전역 설정에서 CardSettings 추출
     * 
     * @private
     */
    private getGlobalCardSettings(): CardSettings {
        const settings = this.view.plugin.settingsManager.getSettings();
        return {
            header: settings.header,
            body: settings.body,
            footer: settings.footer,
            renderMode: settings.renderMode,
            normalCardStyle: settings.normalCardStyle,
            activeCardStyle: settings.activeCardStyle,
            focusedCardStyle: settings.focusedCardStyle
        };
    }
    
    /**
     * 포커스된 카드의 파일을 엽니다
     */
    private openFocusedCard(): void {
        if (this.focusedIndex < 0 || this.focusedIndex >= this.files.length) {
            return;
        }
        
        const file = this.files[this.focusedIndex];
        this.view.openFile(file);
    }
    
    /**
     * 페이지 단위로 스크롤합니다
     * 
     * @param direction - 스크롤 방향 (-1: 위, 1: 아래)
     */
    private pageScroll(direction: number): void {
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
     * 특정 파일의 카드에 포커스를 설정합니다
     * 
     * @param file - 포커스할 파일
     */
    public focusFileCard(file: TFile): void {
        const index = this.files.findIndex(f => f.path === file.path);
        if (index >= 0) {
            this.focusCard(index);
        }
    }
    
    /**
     * 카드 요소에 포커스를 설정합니다
     * 
     * @param cardEl - 카드 요소
     * 
     * @remarks
     * 마우스 오버 시 포커스를 설정할 때 사용됩니다.
     */
    public focusCardElement(cardEl: HTMLElement): void {
        const index = this.cards.indexOf(cardEl);
        if (index >= 0) {
            this.focusCard(index);
        }
    }
}

import { App, Setting } from 'obsidian';
import { FilterOptions } from '../types';

/**
 * FilterUI 클래스
 * 
 * 주요 기능:
 * - 필터 팝업 생성
 * - 태그, 날짜, 속성 필터 UI
 * - 필터 적용/취소
 * 
 * 사용 예:
 * ```typescript
 * const filterUI = new FilterUI(app, containerEl, (filters) => {
 *   console.log('필터 적용:', filters);
 * });
 * filterUI.show();
 * ```
 */
export class FilterUI {
    private app: App;
    private containerEl: HTMLElement;
    private onApplyCallback: ((filters: FilterOptions) => void) | null = null;
    private modalEl: HTMLElement | null = null;
    private currentFilters: FilterOptions;
    
    /**
     * 생성자
     * 
     * @param app - Obsidian App 인스턴스
     * @param containerEl - 필터 UI를 추가할 컨테이너
     * @param onApply - 필터 적용 시 콜백
     */
    constructor(
        app: App,
        containerEl: HTMLElement,
        onApply?: (filters: FilterOptions) => void
    ) {
        this.app = app;
        this.containerEl = containerEl;
        this.onApplyCallback = onApply || null;
        this.currentFilters = this.createEmptyFilters();
    }
    
    /**
     * 빈 필터 옵션을 생성합니다
     * 
     * @returns 빈 FilterOptions 객체
     */
    private createEmptyFilters(): FilterOptions {
        return {
            tags: [],
            properties: {}
        };
    }
    
    /**
     * 필터 UI를 표시합니다
     * 
     * 모달 형태의 팝업으로 필터 설정 UI를 보여줍니다.
     */
    show(): void {
        // 기존 모달이 있으면 제거
        this.hide();
        
        // 모달 배경
        const backdrop = document.body.createEl('div', {
            cls: 'filter-modal-backdrop'
        });
        
        // 모달 컨테이너
        this.modalEl = backdrop.createEl('div', {
            cls: 'filter-modal'
        });
        
        // 모달 헤더
        const header = this.modalEl.createEl('div', {
            cls: 'filter-modal-header'
        });
        
        header.createEl('h3', { text: '필터 옵션' });
        
        const closeBtn = header.createEl('button', {
            cls: 'filter-modal-close',
            text: '×'
        });
        
        closeBtn.addEventListener('click', () => this.hide());
        
        // 모달 본문
        const body = this.modalEl.createEl('div', {
            cls: 'filter-modal-body'
        });
        
        // 필터 옵션 렌더링
        this.renderTagFilter(body);
        this.renderDateFilters(body);
        this.renderPropertyFilter(body);
        
        // 모달 푸터 (버튼)
        const footer = this.modalEl.createEl('div', {
            cls: 'filter-modal-footer'
        });
        
        const applyBtn = footer.createEl('button', {
            cls: 'mod-cta',
            text: '적용'
        });
        
        applyBtn.addEventListener('click', () => {
            this.applyFilters();
        });
        
        const cancelBtn = footer.createEl('button', {
            text: '취소'
        });
        
        cancelBtn.addEventListener('click', () => this.hide());
        
        const resetBtn = footer.createEl('button', {
            text: '초기화'
        });
        
        resetBtn.addEventListener('click', () => {
            this.currentFilters = this.createEmptyFilters();
            this.hide();
            this.show(); // 재렌더링
        });
        
        // 배경 클릭 시 닫기
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                this.hide();
            }
        });
    }
    
    /**
     * 태그 필터 UI를 렌더링합니다
     * 
     * @param container - 렌더링할 컨테이너
     */
    private renderTagFilter(container: HTMLElement): void {
        const section = container.createEl('div', {
            cls: 'filter-section'
        });
        
        section.createEl('h4', { text: '태그 필터' });
        
        // 태그 입력
        const tagInput = section.createEl('input', {
            cls: 'filter-input',
            attr: {
                type: 'text',
                placeholder: '태그 입력 (쉼표로 구분)'
            }
        }) as HTMLInputElement;
        
        // 현재 필터 값 설정
        if (this.currentFilters.tags.length > 0) {
            tagInput.value = this.currentFilters.tags.join(', ');
        }
        
        tagInput.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const tags = target.value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
            
            this.currentFilters.tags = tags;
        });
    }
    
    /**
     * 날짜 필터 UI를 렌더링합니다
     * 
     * @param container - 렌더링할 컨테이너
     */
    private renderDateFilters(container: HTMLElement): void {
        const section = container.createEl('div', {
            cls: 'filter-section'
        });
        
        section.createEl('h4', { text: '날짜 필터' });
        
        // 생성일 필터
        const createdGroup = section.createEl('div', {
            cls: 'filter-date-group'
        });
        
        createdGroup.createEl('label', { text: '생성일:' });
        
        const createdFrom = createdGroup.createEl('input', {
            cls: 'filter-date-input',
            attr: {
                type: 'date'
            }
        }) as HTMLInputElement;
        
        createdGroup.createEl('span', { text: '~' });
        
        const createdTo = createdGroup.createEl('input', {
            cls: 'filter-date-input',
            attr: {
                type: 'date'
            }
        }) as HTMLInputElement;
        
        // 수정일 필터
        const modifiedGroup = section.createEl('div', {
            cls: 'filter-date-group'
        });
        
        modifiedGroup.createEl('label', { text: '수정일:' });
        
        const modifiedFrom = modifiedGroup.createEl('input', {
            cls: 'filter-date-input',
            attr: {
                type: 'date'
            }
        }) as HTMLInputElement;
        
        modifiedGroup.createEl('span', { text: '~' });
        
        const modifiedTo = modifiedGroup.createEl('input', {
            cls: 'filter-date-input',
            attr: {
                type: 'date'
            }
        }) as HTMLInputElement;
        
        // 이벤트 리스너
        createdFrom.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.value) {
                this.currentFilters.createdAfter = new Date(target.value);
            } else {
                delete this.currentFilters.createdAfter;
            }
        });
        
        createdTo.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.value) {
                this.currentFilters.createdBefore = new Date(target.value);
            } else {
                delete this.currentFilters.createdBefore;
            }
        });
        
        modifiedFrom.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.value) {
                this.currentFilters.modifiedAfter = new Date(target.value);
            } else {
                delete this.currentFilters.modifiedAfter;
            }
        });
        
        modifiedTo.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.value) {
                this.currentFilters.modifiedBefore = new Date(target.value);
            } else {
                delete this.currentFilters.modifiedBefore;
            }
        });
    }
    
    /**
     * 프론트매터 속성 필터 UI를 렌더링합니다
     * 
     * @param container - 렌더링할 컨테이너
     */
    private renderPropertyFilter(container: HTMLElement): void {
        const section = container.createEl('div', {
            cls: 'filter-section'
        });
        
        section.createEl('h4', { text: '속성 필터' });
        
        const desc = section.createEl('p', {
            cls: 'filter-description',
            text: '프론트매터 속성을 key:value 형태로 입력하세요 (한 줄에 하나씩)'
        });
        
        // 속성 입력
        const propertyInput = section.createEl('textarea', {
            cls: 'filter-textarea',
            attr: {
                placeholder: '예:\nstatus:완료\npriority:high'
            }
        }) as HTMLTextAreaElement;
        
        propertyInput.addEventListener('input', (e) => {
            const target = e.target as HTMLTextAreaElement;
            const lines = target.value.split('\n');
            const properties: Record<string, any> = {};
            
            lines.forEach(line => {
                const [key, value] = line.split(':').map(s => s.trim());
                if (key && value) {
                    properties[key] = value;
                }
            });
            
            this.currentFilters.properties = properties;
        });
    }
    
    /**
     * 필터를 적용합니다
     */
    private applyFilters(): void {
        if (this.onApplyCallback) {
            this.onApplyCallback(this.currentFilters);
        }
        this.hide();
    }
    
    /**
     * 필터 UI를 숨깁니다
     */
    hide(): void {
        // 모달 제거
        const backdrop = document.querySelector('.filter-modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
        
        this.modalEl = null;
    }
    
    /**
     * 필터 적용 콜백을 설정합니다
     * 
     * @param callback - 필터 적용 시 호출될 함수
     */
    onApply(callback: (filters: FilterOptions) => void): void {
        this.onApplyCallback = callback;
    }
    
    /**
     * 현재 필터를 반환합니다
     * 
     * @returns 현재 FilterOptions
     */
    getCurrentFilters(): FilterOptions {
        return this.currentFilters;
    }
    
    /**
     * 필터를 설정합니다
     * 
     * @param filters - 설정할 FilterOptions
     */
    setFilters(filters: FilterOptions): void {
        this.currentFilters = filters;
    }
}

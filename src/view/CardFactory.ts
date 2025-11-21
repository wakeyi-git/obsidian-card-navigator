import { TFile, App } from 'obsidian';
import { CardRenderer } from '../card/CardRenderer';
import { CardDataExtractor } from '../card/CardData';
import { CardData, CardSettings, CardSectionStyleSettings } from '../types';
import { ViewEventHandler } from './ViewEventHandler';
import { ICardView } from '../interfaces/ICardView';
import { isValidFile } from '../utils/typeGuards';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * 카드를 생성하는 팩토리 클래스
 * 
 * CardData 추출부터 DOM 생성, 이벤트 바인딩까지 카드 생성의
 * 전체 프로세스를 담당합니다.
 * 
 * @remarks
 * CardData 추출은 CardDataExtractor에, 렌더링은 CardRenderer에,
 * 이벤트 처리는 ViewEventHandler에 각각 위임하여 단일 책임 원칙을 따릅니다.
 */
export class CardFactory {
	private app: App;
	private view: ICardView;
	private renderer: CardRenderer;
	private extractor: CardDataExtractor;
	private eventHandler: ViewEventHandler;
	private logger: DebugLogger;

	/** 현재 설정 */
	private get settings() {
		return this.view.plugin.settingsManager.getSettings();
	}
	
	/**
	 * @param app - Obsidian App 인스턴스
	 * @param view - ICardView 인터페이스를 구현한 뷰 (순환 참조 방지)
	 * @param renderer - 카드 렌더러
	 * @param extractor - 카드 데이터 추출기
	 * @param eventHandler - 이벤트 핸들러
	 */
	constructor(
		app: App,
		view: ICardView,
		renderer: CardRenderer,
		extractor: CardDataExtractor,
		eventHandler: ViewEventHandler
	) {
		this.app = app;
		this.view = view;
		this.renderer = renderer;
		this.extractor = extractor;
		this.eventHandler = eventHandler;
		this.logger = new DebugLogger(() => view.plugin.settingsManager.getSettings());
	}
	
	/**
	 * 카드를 생성합니다 (파일별 설정 지원)
	 * 
	 * @param file - 카드로 표시할 파일
	 * @param container - 카드를 추가할 컨테이너
	 * @param activeFile - 현재 활성 파일 (active 클래스 추가용)
	 * @param onFileOpen - 파일 열기 콜백
	 * @returns 생성된 카드 DOM 요소
	 */
	async createCard(
		file: TFile,
		container: HTMLElement,
		activeFile: TFile | null,
		onFileOpen: (file: TFile) => void
	): Promise<HTMLElement> {
		// 1. 이 파일에 매핑된 프리셋 설정 가져오기
		const presetCardSettings = this.view.plugin.presetManager
			.getCardSettingsForFile(file);
		
		// 2. 프리셋 설정이 있으면 사용, 없으면 전역 설정 사용
		const cardSettings = presetCardSettings 
			? presetCardSettings 
			: this.getGlobalCardSettings();
		
		// 3. CardData 생성 (카드별 설정 포함)
		const cardData = await this.createCardData(file, cardSettings);
		
		// active 여부 판단
		const isActive = isValidFile(activeFile) && activeFile.path === file.path;
		
		// 4. 카드 렌더링
		const card = await this.renderer.renderCard(cardData, container, isActive);
		
		card.dataset.filePath = file.path;
		
		// 5. active 클래스 추가
		if (isActive) {
			card.addClass('active');
		}
		
		// 6. 이벤트 바인딩
		this.eventHandler.bindCardEvents(card, file, onFileOpen);
		
		// 7. 카드별 인라인 스타일 적용
		this.applyCardStyles(card, cardSettings, isActive);
		
		return card;
	}
	
	/**
	 * 전역 설정에서 CardSettings 추출
	 * 
	 * @private
	 */
	private getGlobalCardSettings(): CardSettings {
		return {
			header: this.settings.header,
			body: this.settings.body,
			footer: this.settings.footer,
			renderMode: this.settings.renderMode,
			normalCardStyle: this.settings.normalCardStyle,
			activeCardStyle: this.settings.activeCardStyle,
			focusedCardStyle: this.settings.focusedCardStyle
		};
	}
	
	/**
	 * CardData를 생성합니다 (카드별 설정 사용)
	 * 
	 * @private
	 */
	private async createCardData(
		file: TFile, 
		cardSettings: CardSettings
	): Promise<CardData> {
		const headerContent = cardSettings.header.enabled
			? await this.extractor.extractContent(
				file,
				cardSettings.header.contentType,
				cardSettings.header.maxLength,
				cardSettings.header.customProperty,
				cardSettings.header.contentRenderMode,
				cardSettings.header.includeFirstHeader
			)
			: '';
		
		const bodyContent = cardSettings.body.enabled
			? await this.extractor.extractContent(
				file,
				cardSettings.body.contentType,
				cardSettings.body.maxLength,
				cardSettings.body.customProperty,
				cardSettings.body.contentRenderMode,
				cardSettings.body.includeFirstHeader
			)
			: '';
		
		const footerContent = cardSettings.footer.enabled
			? await this.extractor.extractContent(
				file,
				cardSettings.footer.contentType,
				cardSettings.footer.maxLength,
				cardSettings.footer.customProperty,
				cardSettings.footer.contentRenderMode,
				cardSettings.footer.includeFirstHeader
			)
			: '';
		
		return {
			file: file,
			header: {
				type: 'header',
				content: headerContent || '(내용 없음)',
				visible: cardSettings.header.enabled
			},
			body: {
				type: 'body',
				content: bodyContent || '(내용 없음)',
				visible: cardSettings.body.enabled
			},
			footer: {
				type: 'footer',
				content: footerContent,
				visible: cardSettings.footer.enabled
			},
			cardSettings: cardSettings
		};
	}
	
	/**
	 * 카드에 인라인 스타일을 적용합니다
	 * 
	 * focused 스타일은 data attributes로 저장하여
	 * KeyboardNavigator가 동적으로 적용할 수 있도록 합니다.
	 * 
	 * @private
	 */
	private applyCardStyles(
		card: HTMLElement,
		cardSettings: CardSettings,
		isActive: boolean
	): void {
		// normal/active 카드 전체 스타일 적용
		const cardStyle = isActive 
			? cardSettings.activeCardStyle 
			: cardSettings.normalCardStyle;
		
		card.style.backgroundColor = cardStyle.backgroundColor;
		card.style.fontSize = `${cardStyle.fontSize}px`;
		card.style.borderColor = cardStyle.borderColor;
		card.style.borderWidth = `${cardStyle.borderWidth}px`;
		card.style.borderRadius = `${cardStyle.borderRadius}px`;
		
		// ⚠️ 주의: 섹션별 스타일은 CardRenderer가 이미 적용했으므로 여기서는 건드리지 않음
		// CardRenderer의 applySectionStyle 메서드가 각 섹션의 스타일을 올바르게 적용함
		
		// focused 카드 전체 스타일을 data attributes로 저장
		card.dataset.focusedBg = cardSettings.focusedCardStyle.backgroundColor;
		card.dataset.focusedFontSize = `${cardSettings.focusedCardStyle.fontSize}px`;
		card.dataset.focusedBorderColor = cardSettings.focusedCardStyle.borderColor;
		card.dataset.focusedBorderWidth = `${cardSettings.focusedCardStyle.borderWidth}px`;
		card.dataset.focusedBorderRadius = `${cardSettings.focusedCardStyle.borderRadius}px`;
		
		// active 카드 전체 스타일을 data attributes로 저장
		card.dataset.activeBg = cardSettings.activeCardStyle.backgroundColor;
		card.dataset.activeFontSize = `${cardSettings.activeCardStyle.fontSize}px`;
		card.dataset.activeBorderColor = cardSettings.activeCardStyle.borderColor;
		card.dataset.activeBorderWidth = `${cardSettings.activeCardStyle.borderWidth}px`;
		card.dataset.activeBorderRadius = `${cardSettings.activeCardStyle.borderRadius}px`;
		
		// normal 카드 전체 스타일을 data attributes로 저장
		card.dataset.normalBg = cardSettings.normalCardStyle.backgroundColor;
		card.dataset.normalFontSize = `${cardSettings.normalCardStyle.fontSize}px`;
		card.dataset.normalBorderColor = cardSettings.normalCardStyle.borderColor;
		card.dataset.normalBorderWidth = `${cardSettings.normalCardStyle.borderWidth}px`;
		card.dataset.normalBorderRadius = `${cardSettings.normalCardStyle.borderRadius}px`;
		
		// 섹션별 스타일을 data attributes로 저장 (동적 상태 변경용)
		// 헤더
		const headerNormal = cardSettings.header.normalStyle;
		const headerActive = cardSettings.header.activeStyle;
		const headerFocused = cardSettings.header.focusedStyle;
		card.dataset.headerNormalBg = headerNormal.backgroundColor;
		card.dataset.headerNormalFontSize = `${headerNormal.fontSize}px`;
		card.dataset.headerNormalBorderColor = headerNormal.borderColor;
		card.dataset.headerNormalBorderWidth = `${headerNormal.borderWidth}px`;
		card.dataset.headerActiveBg = headerActive.backgroundColor;
		card.dataset.headerActiveFontSize = `${headerActive.fontSize}px`;
		card.dataset.headerActiveBorderColor = headerActive.borderColor;
		card.dataset.headerActiveBorderWidth = `${headerActive.borderWidth}px`;
		card.dataset.headerFocusedBg = headerFocused.backgroundColor;
		card.dataset.headerFocusedFontSize = `${headerFocused.fontSize}px`;
		card.dataset.headerFocusedBorderColor = headerFocused.borderColor;
		card.dataset.headerFocusedBorderWidth = `${headerFocused.borderWidth}px`;
		
		// 바디
		const bodyNormal = cardSettings.body.normalStyle;
		const bodyActive = cardSettings.body.activeStyle;
		const bodyFocused = cardSettings.body.focusedStyle;
		card.dataset.bodyNormalBg = bodyNormal.backgroundColor;
		card.dataset.bodyNormalFontSize = `${bodyNormal.fontSize}px`;
		card.dataset.bodyActiveBg = bodyActive.backgroundColor;
		card.dataset.bodyActiveFontSize = `${bodyActive.fontSize}px`;
		card.dataset.bodyFocusedBg = bodyFocused.backgroundColor;
		card.dataset.bodyFocusedFontSize = `${bodyFocused.fontSize}px`;
		
		// 풋터
		const footerNormal = cardSettings.footer.normalStyle;
		const footerActive = cardSettings.footer.activeStyle;
		const footerFocused = cardSettings.footer.focusedStyle;
		card.dataset.footerNormalBg = footerNormal.backgroundColor;
		card.dataset.footerNormalFontSize = `${footerNormal.fontSize}px`;
		card.dataset.footerNormalBorderColor = footerNormal.borderColor;
		card.dataset.footerNormalBorderWidth = `${footerNormal.borderWidth}px`;
		card.dataset.footerActiveBg = footerActive.backgroundColor;
		card.dataset.footerActiveFontSize = `${footerActive.fontSize}px`;
		card.dataset.footerActiveBorderColor = footerActive.borderColor;
		card.dataset.footerActiveBorderWidth = `${footerActive.borderWidth}px`;
		card.dataset.footerFocusedBg = footerFocused.backgroundColor;
		card.dataset.footerFocusedFontSize = `${footerFocused.fontSize}px`;
		card.dataset.footerFocusedBorderColor = footerFocused.borderColor;
		card.dataset.footerFocusedBorderWidth = `${footerFocused.borderWidth}px`;
	}
	
	/**
	 * 경량 카드 플레이스홀더 생성
	 * 
	 * @remarks
	 * 실제 내용 없이 레이아웃 공간만 차지하는 빈 카드를 생성합니다.
	 * viewport에 진입하면 실제 내용이 렌더링됩니다.
	 * 
	 * @param file - 파일 객체
	 * @param container - 카드를 추가할 컨테이너
	 * @param isActive - 현재 활성 파일 여부
	 * @returns 생성된 플레이스홀더 요소
	 */
	createPlaceholder(
		file: TFile,
		container: HTMLElement,
		isActive: boolean
	): HTMLElement {
		const card = container.createEl('div', {
			cls: 'card-item card-placeholder'
		});
		
		// 활성 카드 표시
		if (isActive) {
			card.addClass('active');
		}
		
		// 파일 정보 저장 (나중에 렌더링할 때 사용)
		card.dataset.filePath = file.path;
		card.dataset.fileName = file.basename;
		
		// 레이아웃 공간 확보
		const PLACEHOLDER_MIN_HEIGHT = 200; // VIEWPORT.PLACEHOLDER_MIN_HEIGHT 사용
		card.style.minHeight = `${PLACEHOLDER_MIN_HEIGHT}px`;
		
		// tabindex 설정 (키보드 네비게이션용)
		card.setAttribute('tabindex', '-1');
		
		// 로딩 인디케이터
		const loadingEl = card.createEl('div', {
			cls: 'card-loading-indicator'
		});
		
		loadingEl.createEl('div', {
			cls: 'loading-spinner'
		});
		
		loadingEl.createEl('div', {
			cls: 'loading-text',
			text: file.basename
		});
		
		return card;
	}
	
	/**
	 * 플레이스홀더를 실제 카드로 렌더링
	 * 
	 * @param placeholder - 플레이스홀더 요소
	 * @param onFileOpen - 파일 열기 콜백
	 */
	async renderPlaceholder(
		placeholder: HTMLElement,
		onFileOpen: (file: TFile) => void
	): Promise<void> {
		const filePath = placeholder.dataset.filePath;

		if (!filePath) {
			this.logger.error('Card', 'Placeholder missing file path');
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			this.logger.error('Card', 'File not found', { filePath });
			return;
		}
		
		// 로딩 인디케이터 제거
		const loadingEl = placeholder.querySelector('.card-loading-indicator');
		if (loadingEl) {
			loadingEl.remove();
		}
		
		// active 상태 확인
		const isActive = placeholder.classList.contains('active');
		
		// CardData 생성 및 렌더링
		const presetCardSettings = this.view.plugin.presetManager
			.getCardSettingsForFile(file);
		
		const cardSettings = presetCardSettings 
			? presetCardSettings 
			: this.getGlobalCardSettings();
		
		const cardData = await this.createCardData(file, cardSettings);
		
		// 플레이스홀더 내부에 카드 내용 추가
		placeholder.empty(); // 기존 내용 제거
		
		// ⭐ 중요: CardRenderer를 사용하지 않고 직접 생성하므로
		// 섹션별 스타일을 명시적으로 적용해야 함
		
		// 헤더 생성 및 스타일 적용
		if (cardData.header.visible) {
			const headerEl = placeholder.createEl('div', { cls: 'card-header' });
			headerEl.innerHTML = cardData.header.content;
			
			// 헤더 스타일 적용
			const headerStyle = isActive 
				? cardSettings.header.activeStyle 
				: cardSettings.header.normalStyle;
			this.applySectionStyle(headerEl, headerStyle, 'header');
		}
		
		// 바디 생성 및 스타일 적용
		if (cardData.body.visible) {
			const bodyEl = placeholder.createEl('div', { cls: 'card-body' });
			bodyEl.innerHTML = cardData.body.content;
			
			// 바디 스타일 적용
			const bodyStyle = isActive 
				? cardSettings.body.activeStyle 
				: cardSettings.body.normalStyle;
			this.applySectionStyle(bodyEl, bodyStyle, 'body');
		}
		
		// 풋터 생성 및 스타일 적용
		if (cardData.footer.visible) {
			const footerEl = placeholder.createEl('div', { cls: 'card-footer' });
			footerEl.innerHTML = cardData.footer.content;
			
			// 풋터 스타일 적용
			const footerStyle = isActive 
				? cardSettings.footer.activeStyle 
				: cardSettings.footer.normalStyle;
			this.applySectionStyle(footerEl, footerStyle, 'footer');
		}
		
		// 플레이스홀더 클래스 제거하고 렌더링 완료 표시
		placeholder.removeClass('card-placeholder');
		placeholder.addClass('card-rendered');
		
		// ⚠️ 중요: 플레이스홀더 관련 인라인 스타일 제거
		// minHeight, background, border 등 플레이스홀더에서 설정한 스타일 제거
		placeholder.style.minHeight = '';
		// display, flexDirection, alignItems, justifyContent 등도 초기화
		placeholder.style.display = '';
		placeholder.style.flexDirection = '';
		placeholder.style.alignItems = '';
		placeholder.style.justifyContent = '';
		
		// ⭐ 중요: 태그/링크 클릭 이벤트 설정
		// CardRenderer.setupLinkHandlers를 호출해야 태그 클릭이 작동함
		this.renderer.setupLinkHandlers(placeholder);
		
		// 이벤트 바인딩
		this.eventHandler.bindCardEvents(placeholder, file, onFileOpen);
		
		// 스타일 적용
		this.applyCardStyles(placeholder, cardSettings, isActive);
	}
	
	/**
	 * 섹션에 스타일을 적용합니다 (CardRenderer의 applySectionStyle 복제)
	 * 
	 * @remarks
	 * 헤더: border-bottom만 적용
	 * 풋터: border-top만 적용
	 * 바디: 테두리 없음
	 * 
	 * @private
	 */
	private applySectionStyle(
		element: HTMLElement,
		style: CardSectionStyleSettings,
		sectionType: 'header' | 'body' | 'footer'
	): void {
		element.style.fontSize = `${style.fontSize}px`;
		element.style.backgroundColor = style.backgroundColor;
		
		if (sectionType === 'header') {
			element.style.borderBottomColor = style.borderColor;
			element.style.borderBottomWidth = `${style.borderWidth}px`;
			element.style.borderBottomStyle = style.borderWidth > 0 ? 'solid' : 'none';
		} else if (sectionType === 'footer') {
			element.style.borderTopColor = style.borderColor;
			element.style.borderTopWidth = `${style.borderWidth}px`;
			element.style.borderTopStyle = style.borderWidth > 0 ? 'solid' : 'none';
		}
	}
}

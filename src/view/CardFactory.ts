import { TFile, App, setIcon } from 'obsidian';
import { CardRenderer } from '../card/CardRenderer';
import { CardDataExtractor } from '../card/CardData';
import { CardData, CardSettings } from '../types';
import { ViewEventHandler } from './ViewEventHandler';
import { ICardView } from '../interfaces/ICardView';
import { isValidFile } from '../utils/typeGuards';
import { DebugLogger } from '../utils/DebugLogger';
import { StylePresets } from '../utils/StylePresets';
import { t } from '../i18n';

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

	/** ⭐ Phase 2: 렌더링 메모이제이션 캐시 */
	private cardCache = new Map<string, {
		element: HTMLElement;
		settingsHash: string;
		mtime: number;
	}>();

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
	 * ⭐ 카드를 생성합니다 (Phase 2: 메모이제이션 기반 캐싱)
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

		// ⭐ Phase 2: 캐시 확인
		const cacheKey = file.path;
		const settingsHash = this.hashSettings(cardSettings);
		const cached = this.cardCache.get(cacheKey);
		const fileMtime = file.stat?.mtime || 0;

		// 캐시 유효성 검사: 수정 시간과 설정이 동일한지 확인
		if (cached &&
			cached.mtime === fileMtime &&
			cached.settingsHash === settingsHash) {
			this.logger.debug('Card', `Cache hit for: ${file.path}`);

			// 캐시된 요소 복제
			const card = cached.element.cloneNode(true) as HTMLElement;

			// active 여부 판단
			const isActive = isValidFile(activeFile) && activeFile.path === file.path;

			// active 클래스 추가
			if (isActive) {
				card.addClass('active');
			} else {
				card.removeClass('active');
			}

			// 이벤트 바인딩 (복제된 요소이므로 다시 바인딩 필요)
			this.eventHandler.bindCardEvents(card, file, onFileOpen);

			// ⭐ 호버 액션 버튼 이벤트 재바인딩 (cloneNode는 이벤트 리스너를 복사하지 않음)
			if (this.settings.enableCardHoverActions !== false) {
				this.rebindHoverActions(card, file);
			}

			// ⭐ 버그 수정 (2025-11-24): 태그/링크 이벤트 재바인딩
			// cloneNode는 이벤트 리스너를 복사하지 않으므로 태그/링크 클릭 핸들러도 다시 설정해야 함
			this.renderer.setupLinkHandlers(card);

			// ⭐ 컨테이너에 카드 추가 (캐시 미스 경로와 동일하게)
			container.appendChild(card);

			return card;
		}

		this.logger.debug('Card', `Cache miss for: ${file.path}`);

		// 3. CardData 생성 (카드별 설정 포함)
		const cardData = await this.createCardData(file, cardSettings);

		// active 여부 판단
		const isActive = isValidFile(activeFile) && activeFile.path === file.path;

		// 4. 카드 렌더링 (Modified Strategy A: isActive 파라미터 제거됨)
		const card = await this.renderer.renderCard(cardData, container);

		card.dataset.filePath = file.path;

		// 5. active 클래스 추가
		if (isActive) {
			card.addClass('active');
		}

		// 6. 이벤트 바인딩
		this.eventHandler.bindCardEvents(card, file, onFileOpen);

		// 7. 카드별 CSS 커스텀 속성 적용
		this.applyCardStyles(card, cardSettings);

		// ⭐ Phase 2: 캐시에 저장 (active 클래스 제거 후 저장)
		const cacheElement = card.cloneNode(true) as HTMLElement;
		cacheElement.removeClass('active');
		this.cardCache.set(cacheKey, {
			element: cacheElement,
			settingsHash: settingsHash,
			mtime: fileMtime
		});

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
	 * 카드에 CSS 커스텀 속성 적용 (Modified Strategy A: Hybrid Approach)
	 *
	 * @remarks
	 * ⭐ Phase 2 최적화: StylePresets 캐싱 사용
	 * - 이전: 매번 개별 setProperty() 호출 (느림)
	 * - 현재: 사전 계산된 CSS 문자열 캐싱 (빠름)
	 * - CSS가 상태 변경(normal/active/focused)을 자동으로 처리
	 *
	 * @private
	 */
	private applyCardStyles(
		card: HTMLElement,
		cardSettings: CardSettings
	): void {
		// ⭐ Phase 2: StylePresets 사용 (캐싱된 CSS 문자열)
		StylePresets.applyCardStyles(card, cardSettings);

		// CSS 클래스만으로 상태 전환 가능
		// 예: card.addClass('active') → CSS가 --card-bg-active 자동 적용
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

		// 핀된 카드 표시
		const isPinned = this.settings.pinnedFiles?.includes(file.path) || false;
		if (isPinned) {
			card.addClass('is-pinned-card');
			card.setAttribute('data-pinned', 'true');
		}

		// 파일 정보 저장 (나중에 렌더링할 때 사용)
		card.dataset.filePath = file.path;
		card.dataset.fileName = file.basename;

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

		// CardData 생성 및 렌더링
		const presetCardSettings = this.view.plugin.presetManager
			.getCardSettingsForFile(file);
		
		const cardSettings = presetCardSettings 
			? presetCardSettings 
			: this.getGlobalCardSettings();
		
		const cardData = await this.createCardData(file, cardSettings);
		
		// 플레이스홀더 내부에 카드 내용 추가
		placeholder.empty(); // 기존 내용 제거

		// ⚠️ 중요: 플레이스홀더 관련 인라인 스타일 제거
		// minHeight는 유지 (레이아웃 시프트 방지)
		placeholder.style.display = '';
		placeholder.style.flexDirection = '';
		placeholder.style.alignItems = '';
		placeholder.style.justifyContent = '';

		// ⭐ 직접 섹션을 렌더링하여 placeholder 내부에 추가
		// CardRenderer.renderCard는 새로운 card-item을 생성하므로 사용하지 않음

		// Add hover actions if enabled
		if (this.settings.enableCardHoverActions !== false) {
			this.addHoverActionsToPlaceholder(placeholder, file);
		}

		// 헤더 생성 (CSS가 스타일 자동 적용)
		if (cardData.header.visible) {
			const headerEl = placeholder.createEl('div', { cls: 'card-header' });
			headerEl.innerHTML = cardData.header.content;
		}

		// 바디 생성 (CSS가 스타일 자동 적용)
		if (cardData.body.visible) {
			const bodyEl = placeholder.createEl('div', { cls: 'card-body' });
			bodyEl.innerHTML = cardData.body.content;
		}

		// 풋터 생성 (CSS가 스타일 자동 적용)
		if (cardData.footer.visible) {
			const footerEl = placeholder.createEl('div', { cls: 'card-footer' });
			footerEl.innerHTML = cardData.footer.content;
		}

		// 플레이스홀더 클래스 제거하고 렌더링 완료 표시
		placeholder.removeClass('card-placeholder');
		placeholder.addClass('card-rendered');
		
		// ⭐ 중요: 태그/링크 클릭 이벤트 설정
		// CardRenderer.setupLinkHandlers를 호출해야 태그 클릭이 작동함
		this.renderer.setupLinkHandlers(placeholder);
		
		// 이벤트 바인딩
		this.eventHandler.bindCardEvents(placeholder, file, onFileOpen);

		// CSS 커스텀 속성 적용
		this.applyCardStyles(placeholder, cardSettings);
	}
	
	// ⭐ applySectionStyle, getContrastColor, parseColor 메서드 제거됨
	// Modified Strategy A: CSS가 모든 섹션 스타일과 텍스트 색상 대비를 자동 처리
	// StyleUtils.getContrastColor()를 통해 필요시 사용 가능

	/**
	 * 캐시된 카드의 호버 액션 버튼 이벤트를 재바인딩합니다
	 *
	 * @private
	 */
	private rebindHoverActions(cardEl: HTMLElement, file: TFile): void {
		const actionsContainer = cardEl.querySelector('.card-hover-actions');
		if (!actionsContainer) {
			return;
		}

		// 모든 버튼을 순서대로 가져오기
		const buttons = Array.from(actionsContainer.querySelectorAll('.card-hover-action-btn')) as HTMLElement[];

		if (buttons.length < 4) {
			this.logger.error('Card', 'Hover action buttons not found', {
				expected: 4,
				found: buttons.length
			});
			return;
		}

		const [pinBtn, copyLinkBtn, starBtn, deleteBtn] = buttons;

		// 각 버튼을 복제하고 이벤트 핸들러 재바인딩
		if (pinBtn) {
			const newPinBtn = pinBtn.cloneNode(true) as HTMLElement;
			pinBtn.replaceWith(newPinBtn);
			this.bindPinButtonHandler(newPinBtn, cardEl, file);
		}

		if (copyLinkBtn) {
			const newCopyLinkBtn = copyLinkBtn.cloneNode(true) as HTMLElement;
			copyLinkBtn.replaceWith(newCopyLinkBtn);
			this.bindCopyLinkButtonHandler(newCopyLinkBtn, file);
		}

		if (starBtn) {
			const newStarBtn = starBtn.cloneNode(true) as HTMLElement;
			starBtn.replaceWith(newStarBtn);
			this.bindStarButtonHandler(newStarBtn, file);
		}

		if (deleteBtn) {
			const newDeleteBtn = deleteBtn.cloneNode(true) as HTMLElement;
			deleteBtn.replaceWith(newDeleteBtn);
			this.bindDeleteButtonHandler(newDeleteBtn, file);
		}
	}

	/**
	 * 핀 버튼 이벤트 핸들러를 바인딩합니다
	 * @private
	 */
	private bindPinButtonHandler(pinBtn: HTMLElement, cardEl: HTMLElement, file: TFile): void {
		pinBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			e.preventDefault();

			const pinnedFiles = this.settings.pinnedFiles || [];
			const index = pinnedFiles.indexOf(file.path);

			if (index > -1) {
				pinnedFiles.splice(index, 1);
				pinBtn.removeClass('is-pinned');
				cardEl.removeClass('is-pinned-card');
				cardEl.removeAttribute('data-pinned');
			} else {
				pinnedFiles.push(file.path);
				pinBtn.addClass('is-pinned');
				cardEl.addClass('is-pinned-card');
				cardEl.setAttribute('data-pinned', 'true');
			}

			this.settings.pinnedFiles = pinnedFiles;
			this.invalidateCache(file);

			if (this.view.plugin) {
				await this.view.plugin.saveSettings();
				const view = this.view.plugin.getView();
				if (view) {
					await view.refresh();
				}
			}
		});
	}

	/**
	 * 링크 복사 버튼 이벤트 핸들러를 바인딩합니다
	 * @private
	 */
	private bindCopyLinkButtonHandler(copyLinkBtn: HTMLElement, file: TFile): void {
		copyLinkBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			e.preventDefault();
			const link = this.app.fileManager.generateMarkdownLink(file, '');
			await navigator.clipboard.writeText(link);
		});
	}

	/**
	 * 북마크 버튼 이벤트 핸들러를 바인딩합니다
	 * @private
	 */
	private bindStarButtonHandler(starBtn: HTMLElement, file: TFile): void {
		starBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			e.preventDefault();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const bookmarks = (this.app as any).internalPlugins?.plugins?.bookmarks;
			if (bookmarks?.instance) {
				const bookmarkPlugin = bookmarks.instance;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const existingBookmark = bookmarkPlugin.items?.find((item: any) =>
					item.type === 'file' && item.path === file.path
				);

				if (existingBookmark) {
					bookmarkPlugin.removeItem(existingBookmark);
					starBtn.removeClass('is-starred');
				} else {
					bookmarkPlugin.addItem({
						type: 'file',
						path: file.path,
						title: file.basename
					});
					starBtn.addClass('is-starred');
				}
			}
		});
	}

	/**
	 * 삭제 버튼 이벤트 핸들러를 바인딩합니다
	 * @private
	 */
	private bindDeleteButtonHandler(deleteBtn: HTMLElement, file: TFile): void {
		deleteBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			e.preventDefault();
			const confirmed = confirm(`Delete "${file.basename}"?`);
			if (confirmed) {
				await this.app.vault.delete(file);
			}
		});
	}

	/**
	 * 플레이스홀더에 호버 액션 버튼을 추가합니다
	 *
	 * @private
	 */
	private addHoverActionsToPlaceholder(cardEl: HTMLElement, file: TFile): void {
		const actionsContainer = cardEl.createEl('div', {
			cls: 'card-hover-actions'
		});

		// Pin button
		const pinBtn = actionsContainer.createEl('div', {
			cls: 'clickable-icon card-hover-action-btn',
			attr: {
				'aria-label': t().toolbar.hoverActions.pin
			}
		});
		const isPinned = this.settings.pinnedFiles?.includes(file.path) || false;
		setIcon(pinBtn, 'pin');
		if (isPinned) {
			pinBtn.addClass('is-pinned');
		}
		this.bindPinButtonHandler(pinBtn, cardEl, file);

		// Copy link button
		const copyLinkBtn = actionsContainer.createEl('div', {
			cls: 'clickable-icon card-hover-action-btn',
			attr: {
				'aria-label': t().toolbar.hoverActions.link
			}
		});
		setIcon(copyLinkBtn, 'link');
		this.bindCopyLinkButtonHandler(copyLinkBtn, file);

		// Star button
		const starBtn = actionsContainer.createEl('div', {
			cls: 'clickable-icon card-hover-action-btn',
			attr: {
				'aria-label': t().toolbar.hoverActions.star
			}
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const bookmarks = (this.app as any).internalPlugins?.plugins?.bookmarks;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const isBookmarked = bookmarks?.instance?.items?.some((item: any) =>
			item.type === 'file' && item.path === file.path
		) || false;
		setIcon(starBtn, 'star');
		if (isBookmarked) {
			starBtn.addClass('is-starred');
		}
		this.bindStarButtonHandler(starBtn, file);

		// Delete button
		const deleteBtn = actionsContainer.createEl('div', {
			cls: 'clickable-icon card-hover-action-btn delete-action',
			attr: {
				'aria-label': t().toolbar.hoverActions.delete
			}
		});
		setIcon(deleteBtn, 'trash');
		this.bindDeleteButtonHandler(deleteBtn, file);
	}

	/**
	 * ⭐ Phase 2: 설정 해시 생성 (캐시 유효성 검증용)
	 */
	private hashSettings(cardSettings: CardSettings): string {
		return JSON.stringify({
			normalCardStyle: cardSettings.normalCardStyle,
			activeCardStyle: cardSettings.activeCardStyle,
			focusedCardStyle: cardSettings.focusedCardStyle,
			header: cardSettings.header,
			body: cardSettings.body,
			footer: cardSettings.footer
		});
	}

	/**
	 * ⭐ Phase 2: 캐시 무효화 (파일 변경 또는 설정 변경 시)
	 *
	 * @param file - 무효화할 파일 (선택사항, 없으면 전체 캐시 클리어)
	 */
	invalidateCache(file?: TFile): void {
		if (file) {
			this.cardCache.delete(file.path);
			this.logger.debug('Card', `Cache invalidated for: ${file.path}`);
		} else {
			this.cardCache.clear();
			this.logger.debug('Card', 'All card cache cleared');
		}
	}

	/**
	 * ⭐ Phase 2: 캐시 통계 (디버깅용)
	 */
	getCacheStats(): { size: number; keys: string[] } {
		return {
			size: this.cardCache.size,
			keys: Array.from(this.cardCache.keys())
		};
	}
}

import { App, PluginSettingTab, setIcon } from 'obsidian';
import { getLanguage, setLanguageAsync } from '../i18n';
import CardNavigatorPlugin from '../main';
import { GroupingSettings } from './settings/GroupingSettings';
import { InteractionSettings } from './settings/InteractionSettings';
import { CardSettingsUI } from './settings/CardSettings';
import { LayoutSettings } from './settings/LayoutSettings';
import { OtherSettings } from './settings/OtherSettings';
import { PresetSettings } from './settings/PresetSettings';
import { SourceSettings } from './settings/SourceSettings';

/**
 * 설정 탭 타입
 */
type SettingTabType = 'source' | 'grouping' | 'card' | 'layout' | 'interaction' | 'presets' | 'other';

/**
 * CardNavigatorSettingTab
 *
 * 플러그인 설정 UI를 탭 기반으로 제공합니다.
 *
 * 탭 구성:
 * 1. 모드 및 검색 - 폴더/태그/검색 모드 설정
 * 2. 그룹화 및 정렬 - 카드 그룹화, 정렬, 핀 설정
 * 3. 카드 설정 - 카드 내용(데이터) 및 스타일링 (통합)
 * 4. 레이아웃 - 그리드/메이슨리 레이아웃 설정
 * 5. 상호작용 - 네비게이션, 클릭, 드래그 앤 드롭 설정
 * 6. 프리셋 - 프리셋 관리
 * 7. 기타 - 언어, 디버그 모드, 설정 관리
 */
export class CardNavigatorSettingTab extends PluginSettingTab {
    plugin: CardNavigatorPlugin;

    // 설정 섹션 인스턴스
    private sourceSettings: SourceSettings;
    private groupingSettings: GroupingSettings;
    private layoutSettings: LayoutSettings;
    private presetSettings: PresetSettings;
    private cardSettingsUI: CardSettingsUI;
    private interactionSettings: InteractionSettings;
    private otherSettings: OtherSettings;

    // 현재 활성 탭
    private activeTab: SettingTabType = 'source';

    // 탭 컨테이너들
    private tabContainers: Map<SettingTabType, HTMLElement> = new Map();

    // ⭐ Phase 4.3: Track if rendering is in progress to prevent duplicate renders
    private isRendering = false;

    constructor(app: App, plugin: CardNavigatorPlugin) {
        super(app, plugin);
        this.plugin = plugin;

        // 설정 섹션 초기화
        this.sourceSettings = new SourceSettings(plugin, this);
        this.groupingSettings = new GroupingSettings(plugin, this);
        this.layoutSettings = new LayoutSettings(plugin, this);
        this.presetSettings = new PresetSettings(plugin, this);
        this.cardSettingsUI = new CardSettingsUI(plugin);
        this.interactionSettings = new InteractionSettings(plugin, this);
        this.otherSettings = new OtherSettings(plugin, this, app);
    }

    /**
     * 설정 UI를 표시합니다
     *
     * ⭐ Phase 4.3: Ensure translations are loaded before rendering
     */
    display(): void {
        const { containerEl } = this;

        // ⭐ Prevent duplicate rendering if already in progress
        if (this.isRendering) {
            return;
        }

        containerEl.empty();
        containerEl.addClass('card-navigator-settings');

        this.isRendering = true;

        // ⭐ Ensure current language translation is loaded before rendering
        // This prevents crashes when settings tab opens after language change
        const currentLang = getLanguage();
        setLanguageAsync(currentLang).then(() => {
            // Double-check we're still rendering (in case display() was called again)
            if (!this.isRendering) {
                return;
            }
            this.renderSettingsUI(containerEl);
        }).catch(error => {
            console.error('Failed to load translations for settings tab:', error);
            // Fallback: render anyway (deep fallback Proxy will handle missing keys)
            if (this.isRendering) {
                this.renderSettingsUI(containerEl);
            }
        }).finally(() => {
            this.isRendering = false;
        });
    }

    /**
     * 설정 UI를 실제로 렌더링합니다
     */
    private renderSettingsUI(containerEl: HTMLElement): void {
        // 탭 버튼 컨테이너
        const tabBar = containerEl.createDiv({ cls: 'setting-tab-bar' });
        this.createTabButtons(tabBar);

        // 탭 콘텐츠 컨테이너
        const contentContainer = containerEl.createDiv({ cls: 'setting-tab-content' });
        this.createTabContents(contentContainer);

        // 탭 콘텐츠만 초기화 (버튼은 createTabButtons에서 이미 처리됨)
        this.showTabContent(this.activeTab);

        // DOM 렌더링 완료 후 활성 탭 버튼에 포커스
        setTimeout(() => {
            const activeButton = containerEl.querySelector(`.setting-tab-button[data-tab="${this.activeTab}"]`) as HTMLElement;
            if (activeButton) {
                activeButton.focus();
                activeButton.blur();
            }
        }, 0);
    }

    /**
     * 탭 버튼들을 생성합니다
     */
    private createTabButtons(container: HTMLElement): void {
        const t = this.plugin.t();
        const tabs: { id: SettingTabType; label: string; icon: string }[] = [
            { id: 'source', label: t.settingsTab.tabs.source, icon: 'folder-open' },
            { id: 'grouping', label: t.settingsTab.tabs.grouping, icon: 'layers' },
            { id: 'card', label: t.settingsTab.tabs.card, icon: 'credit-card' },
            { id: 'layout', label: t.settingsTab.tabs.layout, icon: 'layout-grid' },
            { id: 'interaction', label: t.settingsTab.tabs.interaction, icon: 'mouse-pointer' },
            { id: 'presets', label: t.settingsTab.tabs.presets, icon: 'save' },
            { id: 'other', label: t.settingsTab.tabs.other, icon: 'more-horizontal' }
        ];

        tabs.forEach(tab => {
            const button = container.createEl('button', {
                cls: 'setting-tab-button'
            });
            button.dataset.tab = tab.id;

            // Lucide 아이콘 추가
            const iconEl = button.createSpan({ cls: 'setting-tab-icon' });
            setIcon(iconEl, tab.icon);

            // 텍스트 추가
            button.createEl('span', { cls: 'setting-tab-label', text: tab.label });

            button.addEventListener('click', () => {
                this.switchTab(tab.id);
            });

            // 현재 활성 탭이면 active 클래스 추가
            if (tab.id === this.activeTab) {
                button.addClass('is-active');
            }
        });

        // ⭐ 마우스 움직임에 따른 자동 스크롤 기능 추가
        this.setupAutoScroll(container);
    }

    /**
     * 마우스 움직임에 따른 탭 바 자동 스크롤을 설정합니다
     */
    private setupAutoScroll(container: HTMLElement): void {
        let animationFrameId: number | null = null;
        let isScrolling = false;
        let currentMouseX = 0;
        let currentContainerRect: DOMRect | null = null;

        // 연속 스크롤 함수
        const continuousScroll = () => {
            if (!isScrolling || !currentContainerRect) {
                animationFrameId = null;
                return;
            }

            const mouseX = currentMouseX - currentContainerRect.left;
            const containerWidth = currentContainerRect.width;

            // 좌우 가장자리 영역 (25% 영역)
            const edgeThreshold = containerWidth * 0.3;

            // 스크롤 가능 여부 확인
            const canScrollLeft = container.scrollLeft > 0;
            const canScrollRight = container.scrollLeft < (container.scrollWidth - containerWidth);

            let scrolled = false;

            // 좌측 가장자리에서 왼쪽으로 스크롤
            if (mouseX < edgeThreshold && canScrollLeft) {
                const intensity = 1 - (mouseX / edgeThreshold); // 0~1
                const scrollSpeed = intensity * 6; // 프레임당 최대 6px
                container.scrollLeft -= scrollSpeed;
                scrolled = true;
            }
            // 우측 가장자리에서 오른쪽으로 스크롤
            else if (mouseX > containerWidth - edgeThreshold && canScrollRight) {
                const intensity = (mouseX - (containerWidth - edgeThreshold)) / edgeThreshold; // 0~1
                const scrollSpeed = intensity * 6; // 프레임당 최대 6px
                container.scrollLeft += scrollSpeed;
                scrolled = true;
            }

            // 스크롤이 발생했으면 다음 프레임 예약
            if (scrolled && isScrolling) {
                animationFrameId = requestAnimationFrame(continuousScroll);
            } else {
                animationFrameId = null;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            currentMouseX = e.clientX;
            currentContainerRect = container.getBoundingClientRect();

            const mouseX = currentMouseX - currentContainerRect.left;
            const containerWidth = currentContainerRect.width;
            const edgeThreshold = containerWidth * 0.25;

            // 가장자리 영역에 있는지 확인
            const isInScrollZone = mouseX < edgeThreshold || mouseX > containerWidth - edgeThreshold;

            if (isInScrollZone && !isScrolling) {
                // 스크롤 시작
                isScrolling = true;
                if (animationFrameId === null) {
                    animationFrameId = requestAnimationFrame(continuousScroll);
                }
            } else if (!isInScrollZone && isScrolling) {
                // 스크롤 중지
                isScrolling = false;
            }
        };

        const handleMouseLeave = () => {
            // 마우스가 컨테이너를 벗어나면 스크롤 중지
            isScrolling = false;
            currentContainerRect = null;
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);
    }

    /**
     * 탭 콘텐츠들을 생성합니다
     */
    private createTabContents(container: HTMLElement): void {
        // 1. 모드 및 검색 탭 (폴더/태그/검색 모드)
        const sourceTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.sourceSettings.render(sourceTab);
        this.tabContainers.set('source', sourceTab);

        // 2. 그룹화 및 정렬 탭
        const groupingTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.groupingSettings.render(groupingTab);
        this.tabContainers.set('grouping', groupingTab);

        // 3. 카드 설정 탭 (내용 + 스타일링 통합)
        const cardTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.cardSettingsUI.render(cardTab);
        this.tabContainers.set('card', cardTab);

        // 4. 레이아웃 탭
        const layoutTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.layoutSettings.render(layoutTab);
        this.tabContainers.set('layout', layoutTab);

        // 5. 상호작용 탭 (네비게이션, 클릭, 드래그 앤 드롭)
        const interactionTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.interactionSettings.render(interactionTab);
        this.tabContainers.set('interaction', interactionTab);

        // 6. 프리셋 탭
        const presetsTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.presetSettings.render(presetsTab);
        this.tabContainers.set('presets', presetsTab);

        // 7. 기타 탭 (언어, 성능, 디버그, 설정 관리)
        const otherTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.otherSettings.render(otherTab);
        this.tabContainers.set('other', otherTab);
    }

    /**
     * 탭 콘텐츠만 표시합니다 (버튼 상태 변경 없음)
     */
    private showTabContent(tabId: SettingTabType): void {
        // 모든 탭 콘텐츠 숨기기
        this.tabContainers.forEach((container) => {
            container.style.display = 'none';
        });

        // 선택한 탭 콘텐츠만 표시
        const selectedContainer = this.tabContainers.get(tabId);
        if (selectedContainer) {
            selectedContainer.style.display = 'block';
        }
    }

    /**
     * 탭을 전환합니다
     */
    private switchTab(tabId: SettingTabType): void {
        this.activeTab = tabId;

        // 모든 탭 버튼의 active 클래스 제거 및 선택된 탭에 추가
        const buttons = this.containerEl.querySelectorAll('.setting-tab-button');
        buttons.forEach(button => {
            button.removeClass('is-active');
            if ((button as HTMLElement).dataset.tab === tabId) {
                button.addClass('is-active');
            }
        });

        this.showTabContent(tabId);
    }
}

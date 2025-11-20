import { App, PluginSettingTab, Setting, setIcon, Notice } from 'obsidian';
import CardNavigatorPlugin from '../main';
import { DebugCategory } from '../types';
import { RenderingSettings } from './settings/RenderingSettings';
import { LayoutSettings } from './settings/LayoutSettings';
import { ModeSettings } from './settings/ModeSettings';
import { SortSettings } from './settings/SortSettings';
import { PresetSettings } from './settings/PresetSettings';
import { InteractiveCardSettings } from './settings/InteractiveCardSettings';

/**
 * 설정 탭 타입
 */
type SettingTabType = 'mode' | 'card' | 'layout' | 'presets' | 'other';

/**
 * CardNavigatorSettingTab
 * 
 * 플러그인 설정 UI를 탭 기반으로 제공합니다.
 * 
 * 탭 구성:
 * 1. 모드 & 정렬 - 폴더/태그 모드, 정렬 설정
 * 2. 카드 설정 - 내용, 렌더링, 스타일
 * 3. 레이아웃 - 그리드/메이슨리 레이아웃 설정
 * 4. 프리셋 - 프리셋 관리
 * 5. 기타 - 설정 초기화 등
 */
export class CardNavigatorSettingTab extends PluginSettingTab {
    plugin: CardNavigatorPlugin;
    
    // 설정 섹션 인스턴스
    private modeSettings: ModeSettings;
    private sortSettings: SortSettings;
    private renderingSettings: RenderingSettings;
    private layoutSettings: LayoutSettings;
    private presetSettings: PresetSettings;
    private interactiveCardSettings: InteractiveCardSettings;

    // 현재 활성 탭
    private activeTab: SettingTabType = 'mode';

    // 탭 컨테이너들
    private tabContainers: Map<SettingTabType, HTMLElement> = new Map();

    constructor(app: App, plugin: CardNavigatorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        
        // 설정 섹션 초기화
        this.modeSettings = new ModeSettings(plugin);
        this.sortSettings = new SortSettings(plugin);
        this.renderingSettings = new RenderingSettings(plugin);
        this.layoutSettings = new LayoutSettings(plugin);
        this.presetSettings = new PresetSettings(plugin);
        this.interactiveCardSettings = new InteractiveCardSettings(plugin);
    }

    /**
     * 설정 UI를 표시합니다
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('card-navigator-settings');

        // 탭 버튼 컨테이너
        const tabBar = containerEl.createDiv({ cls: 'setting-tab-bar' });
        this.createTabButtons(tabBar);

        // 탭 콘텐츠 컨테이너
        const contentContainer = containerEl.createDiv({ cls: 'setting-tab-content' });
        this.createTabContents(contentContainer);

        // 첫 번째 탭 활성화
        this.switchTab(this.activeTab);
    }

    /**
     * 탭 버튼들을 생성합니다
     */
    private createTabButtons(container: HTMLElement): void {
        const tabs: { id: SettingTabType; label: string; icon: string }[] = [
            { id: 'mode', label: '모드 & 정렬', icon: 'settings' },
            { id: 'card', label: '카드 설정', icon: 'credit-card' },
            { id: 'layout', label: '레이아웃', icon: 'layout-grid' },
            { id: 'presets', label: '프리셋', icon: 'save' },
            { id: 'other', label: '기타', icon: 'more-horizontal' }
        ];

        tabs.forEach(tab => {
            const button = container.createEl('button', {
                cls: 'setting-tab-button'
            });

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
    }

    /**
     * 탭 콘텐츠들을 생성합니다
     */
    private createTabContents(container: HTMLElement): void {
        // 1. 모드 & 정렬 탭
        const modeTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.modeSettings.render(modeTab);
        this.sortSettings.render(modeTab);
        this.tabContainers.set('mode', modeTab);

        // 2. 카드 설정 탭
        const cardTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.interactiveCardSettings.render(cardTab);
        this.tabContainers.set('card', cardTab);

        // 3. 레이아웃 탭
        const layoutTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.layoutSettings.render(layoutTab);
        this.tabContainers.set('layout', layoutTab);

        // 4. 프리셋 탭
        const presetsTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.presetSettings.render(presetsTab);
        this.tabContainers.set('presets', presetsTab);

        // 5. 기타 탭
        const otherTab = container.createDiv({ cls: 'setting-tab-pane' });
        this.addScrollBehaviorSettings(otherTab);
        this.addTagClickActionSettings(otherTab);
        this.addDragDropSettings(otherTab);
        this.addDebugSettings(otherTab);
        this.addResetButton(otherTab);
        this.tabContainers.set('other', otherTab);
    }

    /**
     * 탭을 전환합니다
     */
    private switchTab(tabId: SettingTabType): void {
        this.activeTab = tabId;

        // 모든 탭 버튼의 active 클래스 제거
        const buttons = this.containerEl.querySelectorAll('.setting-tab-button');
        buttons.forEach(button => button.removeClass('is-active'));

        // 클릭한 탭 버튼에 active 클래스 추가
        const tabButtons = Array.from(buttons);
        const tabOrder: SettingTabType[] = ['mode', 'card', 'layout', 'presets', 'other'];
        const index = tabOrder.indexOf(tabId);
        if (index !== -1 && tabButtons[index]) {
            tabButtons[index].addClass('is-active');
        }

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
     * 스크롤 동작 설정을 추가합니다
     */
    private addScrollBehaviorSettings(containerEl: HTMLElement): void {
        // 섹션 헤더 (Obsidian 표준 스타일)
        new Setting(containerEl).setHeading().setName('스크롤 동작');

        new Setting(containerEl)
            .setName('활성 카드 스크롤')
            .setDesc('카드를 클릭하여 파일을 열 때 활성 카드를 어떻게 스크롤할지 선택합니다.\n\n• 최소 스크롤: 카드가 이미 화면에 보이면 스크롤하지 않습니다. 보이지 않을 때만 최소한의 스크롤로 카드를 표시합니다. (권장)\n• 항상 화면 중앙: 카드를 항상 화면 중앙에 배치합니다. 스크롤 거리가 길 수 있습니다.\n• 자동 스크롤 안 함: 카드를 클릭해도 자동으로 스크롤하지 않습니다.')
            .addDropdown(dropdown => dropdown
                .addOption('nearest', '최소 스크롤 (카드가 보이지 않을 때만)')
                .addOption('center', '항상 화면 중앙')
                .addOption('none', '자동 스크롤 안 함')
                .setValue(this.plugin.settings.scrollBehavior)
                .onChange(async (value: 'center' | 'nearest' | 'none') => {
                    this.plugin.settings.scrollBehavior = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    /**
     * 태그 클릭 동작 설정을 추가합니다
     */
    private addTagClickActionSettings(containerEl: HTMLElement): void {
        // 섹션 헤더
        new Setting(containerEl).setHeading().setName('태그 클릭 동작');

        new Setting(containerEl)
            .setName('태그 클릭 시 동작')
            .setDesc('카드 내 태그를 클릭했을 때 어떤 동작을 수행할지 선택합니다.\n\n• 플러그인 검색: Card Navigator의 검색 모드로 전환하여 해당 태그로 검색합니다 (권장)\n• Obsidian 검색: Obsidian의 기본 검색 패널을 열고 해당 태그로 검색합니다')
            .addDropdown(dropdown => dropdown
                .addOption('plugin-search', '플러그인 검색')
                .addOption('obsidian-search', 'Obsidian 검색')
                .setValue(this.plugin.settings.tagClickAction)
                .onChange(async (value: 'obsidian-search' | 'plugin-search') => {
                    this.plugin.settings.tagClickAction = value;
                    await this.plugin.saveSettings();
                    new Notice(`태그 클릭 동작: ${value === 'plugin-search' ? '플러그인 검색' : 'Obsidian 검색'}`);
                })
            );
    }

    /**
     * 드래그 앤 드롭 설정을 추가합니다
     */
    private addDragDropSettings(containerEl: HTMLElement): void {
        // 섹션 헤더
        new Setting(containerEl).setHeading().setName('드래그 앤 드롭');

        new Setting(containerEl)
            .setName('에디터에 삽입할 내용')
            .setDesc('카드를 에디터로 드래그 앤 드롭할 때 삽입되는 내용을 선택합니다.\n\n• 링크: [[파일명]] 형식의 내부 링크를 삽입합니다\n• 파일 내용: 파일의 전체 내용을 삽입합니다 (추가 옵션에서 세부 설정 가능)')
            .addDropdown(dropdown => dropdown
                .addOption('link', '링크')
                .addOption('full-content', '파일 내용')
                .setValue(this.plugin.settings.dragDrop.contentType)
                .onChange(async (value: 'link' | 'full-content') => {
                    this.plugin.settings.dragDrop.contentType = value;
                    await this.plugin.saveSettings();
                    // UI 업데이트
                    this.display();
                })
            );

        // '파일 내용'을 선택한 경우에만 추가 옵션 표시
        if (this.plugin.settings.dragDrop.contentType === 'full-content') {
            // 설명 텍스트
            const descEl = containerEl.createDiv({ cls: 'setting-item-description' });
            descEl.setText('파일 내용을 삽입할 때 세부 옵션을 설정하세요.');
            descEl.style.marginTop = '10px';
            descEl.style.marginBottom = '10px';
            descEl.style.fontSize = '0.9em';
            descEl.style.color = 'var(--text-muted)';

            // 프론트매터 포함 여부
            new Setting(containerEl)
                .setName('프론트매터 포함')
                .setDesc('파일 내용을 삽입할 때 프론트매터(---로 감싼 메타데이터)를 포함할지 선택합니다.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.dragDrop.fullContentOptions.includeFrontmatter)
                    .onChange(async (value) => {
                        this.plugin.settings.dragDrop.fullContentOptions.includeFrontmatter = value;
                        await this.plugin.saveSettings();
                    })
                );

            // 최대 길이 제한 활성화
            new Setting(containerEl)
                .setName('최대 길이 제한')
                .setDesc('파일 내용이 너무 길 경우 지정한 글자 수만큼만 삽입합니다. 비활성화하면 전체 내용을 모두 삽입합니다.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.dragDrop.fullContentOptions.enableLengthLimit)
                    .onChange(async (value) => {
                        this.plugin.settings.dragDrop.fullContentOptions.enableLengthLimit = value;
                        await this.plugin.saveSettings();
                        // UI 업데이트
                        this.display();
                    })
                );

            // 최대 글자 수 (최대 길이 제한이 활성화되었을 때만 표시)
            if (this.plugin.settings.dragDrop.fullContentOptions.enableLengthLimit) {
                new Setting(containerEl)
                    .setName('최대 글자 수')
                    .setDesc('삽입할 최대 글자 수를 입력하세요. 파일 내용의 처음부터 이 글자 수만큼만 삽입됩니다.')
                    .addText(text => text
                        .setValue(String(this.plugin.settings.dragDrop.fullContentOptions.maxLength))
                        .setPlaceholder('1000')
                        .onChange(async (value) => {
                            const num = parseInt(value);
                            if (!isNaN(num) && num > 0) {
                                this.plugin.settings.dragDrop.fullContentOptions.maxLength = num;
                                await this.plugin.saveSettings();
                            }
                        })
                    );
            }
        }
    }

    /**
     * 디버그 모드 설정을 추가합니다
     */
    private addDebugSettings(containerEl: HTMLElement): void {
        // 섹션 헤더
        new Setting(containerEl).setHeading().setName('디버그 모드');

        // 디버그 모드 활성화/비활성화
        new Setting(containerEl)
            .setName('디버그 모드 활성화')
            .setDesc('개발자 콘솔에 디버그 로그를 표시합니다. 문제 해결에 도움이 됩니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debug.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.debug.enabled = value;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        // 디버그 모드가 활성화되어 있을 때만 카테고리 설정 표시
        if (this.plugin.settings.debug.enabled) {
            // 카테고리 설명
            const descEl = containerEl.createDiv({ cls: 'setting-item-description' });
            descEl.setText('표시하고자 하는 로그 카테고리를 선택하세요. 각 카테고리는 [카테고리명] prefix로 콘솔에 표시됩니다.');
            descEl.style.marginBottom = '10px';
            descEl.style.fontSize = '0.9em';
            descEl.style.color = 'var(--text-muted)';

            // 카테고리별 설정
            const categories: { name: DebugCategory; label: string; description: string }[] = [
                { 
                    name: 'Plugin', 
                    label: '플러그인', 
                    description: '플러그인 로딩, 언로딩, 초기화 등' 
                },
                { 
                    name: 'View', 
                    label: '뷰 렌더링', 
                    description: '뷰 초기화, 렌더링 상태, 파일 변경 처리 등' 
                },
                { 
                    name: 'Layout', 
                    label: '레이아웃', 
                    description: '그리드 레이아웃, 카드 크기 계산 등' 
                },
                { 
                    name: 'Card', 
                    label: '카드 렌더링', 
                    description: '카드 생성, 내용 추출, 스타일 적용 등' 
                },
                { 
                    name: 'Search', 
                    label: '검색', 
                    description: '검색 쿼리, 결과 필터링 등' 
                },
                { 
                    name: 'Filter', 
                    label: '필터', 
                    description: '태그, 날짜, 속성 필터링 등' 
                },
                { 
                    name: 'Navigation', 
                    label: '내비게이션', 
                    description: '키보드 탐색, 스크롤 이동 등' 
                },
                { 
                    name: 'Preset', 
                    label: '프리셋', 
                    description: '프리셋 생성, 적용, 매핑 등' 
                },
                { 
                    name: 'Sort', 
                    label: '정렬', 
                    description: '카드 정렬, 정렬 옵션 적용 등' 
                },
                { 
                    name: 'Selection', 
                    label: '선택', 
                    description: '다중 선택, 일괄 작업 등' 
                },
                { 
                    name: 'DragDrop', 
                    label: '드래그앤드롭', 
                    description: '드래그 시작/종료, 드롭 처리 등' 
                },
                { 
                    name: 'Mode', 
                    label: '모드 전환', 
                    description: '폴더/태그/검색 모드 전환 등' 
                },
                { 
                    name: 'Settings', 
                    label: '설정', 
                    description: '설정 로드/저장, 변경 사항 적용 등' 
                },
                { 
                    name: 'Event', 
                    label: '이벤트', 
                    description: '클릭, 키보드, 파일 변경 이벤트 등' 
                },
                { 
                    name: 'UI', 
                    label: 'UI 관련', 
                    description: '툴바, 컨텍스트 메뉴, 모달 등' 
                },
                { 
                    name: 'Performance', 
                    label: '성능 측정', 
                    description: '실행 시간, 메모리 사용량 측정 등' 
                }
            ];

            categories.forEach(category => {
                const currentValue = this.plugin.settings.debug.categories?.[category.name] ?? true;
                
                new Setting(containerEl)
                    .setName(`[${category.name}] ${category.label}`)
                    .setDesc(category.description)
                    .addToggle(toggle => toggle
                        .setValue(currentValue)
                        .onChange(async (value) => {
                            // categories가 undefined면 빈 객체로 초기화
                            if (!this.plugin.settings.debug.categories) {
                                this.plugin.settings.debug.categories = {};
                            }
                            this.plugin.settings.debug.categories[category.name] = value;
                            await this.plugin.saveSettings();
                        })
                    );
            });

            // 전체 선택/해제 버튼
            new Setting(containerEl)
                .setName('전체 카테고리 제어')
                .setDesc('모든 디버그 카테고리를 한 번에 활성화하거나 비활성화합니다')
                .addButton(button => button
                    .setButtonText('전체 선택')
                    .onClick(async () => {
                        if (!this.plugin.settings.debug.categories) {
                            this.plugin.settings.debug.categories = {};
                        }
                        categories.forEach(category => {
                            this.plugin.settings.debug.categories![category.name] = true;
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    })
                )
                .addButton(button => button
                    .setButtonText('전체 해제')
                    .onClick(async () => {
                        if (!this.plugin.settings.debug.categories) {
                            this.plugin.settings.debug.categories = {};
                        }
                        categories.forEach(category => {
                            this.plugin.settings.debug.categories![category.name] = false;
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    })
                );
        }
    }

    /**
     * 설정 초기화 버튼을 추가합니다
     */
    private addResetButton(containerEl: HTMLElement): void {
        // 섹션 헤더 (Obsidian 표준 스타일)
        new Setting(containerEl).setHeading().setName('설정 관리');

        new Setting(containerEl)
            .setName('설정 초기화')
            .setDesc('모든 설정을 기본값으로 되돌립니다 (프리셋과 매핑도 모두 삭제됩니다)')
            .addButton(button => button
                .setButtonText('초기화')
                .setWarning()
                .onClick(async () => {
                    if (confirm('정말 모든 설정을 초기화하시겠습니까?\n\n⚠️ 프리셋과 프리셋 매핑도 모두 삭제됩니다.')) {
                        this.plugin.logger.debug('Settings', '설정 초기화 시작');
                        
                        // 1. 설정 초기화 (프리셋과 매핑도 기본값인 빈 배열로)
                        await this.plugin.settingsManager.resetSettings();
                        this.plugin.logger.debug('Settings', 'settingsManager.resetSettings() 완료');
                        
                        // 2. PresetManager 상태 리셋 (currentPresetId 초기화)
                        this.plugin.presetManager.reset();
                        this.plugin.logger.debug('Settings', 'presetManager.reset() 완료');
                        
                        // 3. 스타일 다시 적용 (기본 스타일로)
                        const defaultSettings = this.plugin.settingsManager.getSettings();
                        this.plugin.styleManager.applyStyles(defaultSettings);
                        this.plugin.logger.debug('Settings', 'styleManager.applyStyles() 완료');
                        
                        // 4. 뷰 새로고침
                        this.plugin.refreshView();
                        this.plugin.logger.debug('Settings', 'refreshView() 완료');
                        
                        // 5. 설정 UI 새로고침
                        this.display();
                        this.plugin.logger.debug('Settings', 'display() 완료');
                        
                        this.plugin.logger.debug('Settings', '설정 초기화 완료!');
                        new Notice('모든 설정이 초기화되었습니다');
                    }
                })
            );

        // 설정 내보내기/가져오기
        new Setting(containerEl)
            .setName('설정 내보내기')
            .setDesc('현재 설정을 JSON 파일로 내보냅니다')
            .addButton(button => button
                .setButtonText('내보내기')
                .onClick(() => {
                    this.exportSettings();
                })
            );

        new Setting(containerEl)
            .setName('설정 가져오기')
            .setDesc('JSON 파일에서 설정을 가져옵니다')
            .addButton(button => button
                .setButtonText('가져오기')
                .onClick(() => {
                    this.importSettings();
                })
            );
    }

    /**
     * 설정을 JSON으로 내보냅니다
     */
    private exportSettings(): void {
        const settings = this.plugin.settings;
        const json = JSON.stringify(settings, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'card-navigator-settings.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }

    /**
     * JSON 파일에서 설정을 가져옵니다
     */
    private importSettings(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const settings = JSON.parse(text);
                
                // 설정 검증 (간단한 타입 체크)
                if (typeof settings === 'object' && settings !== null) {
                    Object.assign(this.plugin.settings, settings);
                    await this.plugin.saveSettings();
                    this.plugin.refreshView();
                    this.display();
                    alert('설정을 성공적으로 가져왔습니다.');
                } else {
                    throw new Error('유효하지 않은 설정 파일입니다.');
                }
            } catch (error) {
                this.plugin.logger.error('Settings', '설정 가져오기 오류', error);
                alert('설정 가져오기에 실패했습니다.');
            }
        });
        
        input.click();
    }
}

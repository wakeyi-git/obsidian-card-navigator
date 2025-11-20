import { Setting } from 'obsidian';
import { BaseSettings } from './BaseSettings';

/**
 * SortSettings
 * 
 * 정렬 설정 UI
 */
export class SortSettings extends BaseSettings {
    /**
     * 정렬 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.createHeader(
            containerEl,
            '정렬',
            '카드를 정렬하는 기준을 설정합니다.'
        );

        const settings = this.plugin.settingsManager.getSettings();
        const sortSettings = settings.sort;

        // 정렬 기준 선택
        new Setting(containerEl)
            .setName('정렬 기준')
            .setDesc('카드를 정렬할 기준을 선택합니다')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('name', '파일명')
                    .addOption('created', '생성일')
                    .addOption('modified', '수정일')
                    .addOption('size', '파일 크기')
                    .addOption('property', '프론트매터 속성')
                    .setValue(sortSettings.criteria)
                    .onChange(async (value) => {
                        sortSettings.criteria = value as any;
                        await this.plugin.saveSettings();
                        this.plugin.settingsTab.display();
                    });
            });

        // 프론트매터 속성 입력 (criteria가 'property'일 때만 표시)
        if (sortSettings.criteria === 'property') {
            new Setting(containerEl)
                .setName('속성 이름')
                .setDesc('정렬에 사용할 프론트매터 속성의 이름을 입력하세요 (예: priority, status)')
                .addText(text => text
                    .setPlaceholder('속성 이름')
                    .setValue(sortSettings.propertyName || '')
                    .onChange(async (value) => {
                        sortSettings.propertyName = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // 정렬 순서 선택
        new Setting(containerEl)
            .setName('정렬 순서')
            .setDesc('오름차순 또는 내림차순을 선택합니다')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('asc', '오름차순 (A-Z, 작은것→큰것, 오래됨→최신)')
                    .addOption('desc', '내림차순 (Z-A, 큰것→작은것, 최신→오래됨)')
                    .setValue(sortSettings.order)
                    .onChange(async (value) => {
                        sortSettings.order = value as 'asc' | 'desc';
                        await this.plugin.saveSettings();
                    });
            });

        // 정렬 예시 안내
        this.addSortExamples(containerEl, sortSettings);
    }

    /**
     * 정렬 예시를 추가합니다
     * 
     * @param containerEl - 컨테이너 요소
     * @param sortSettings - 정렬 설정 객체
     */
    private addSortExamples(containerEl: HTMLElement, sortSettings: any): void {
        const examples: Record<string, string> = {
            'name': '파일명 기준: "A.md, B.md, C.md" (오름차순) 또는 "C.md, B.md, A.md" (내림차순)',
            'created': '생성일 기준: 오래된 파일부터 (오름차순) 또는 최신 파일부터 (내림차순)',
            'modified': '수정일 기준: 오래전 수정된 파일부터 (오름차순) 또는 최근 수정된 파일부터 (내림차순)',
            'size': '파일 크기 기준: 작은 파일부터 (오름차순) 또는 큰 파일부터 (내림차순)',
            'property': '프론트매터 속성 기준: 속성값에 따라 정렬 (숫자, 문자열, 날짜 등)'
        };

        const currentExample = examples[sortSettings.criteria];
        
        if (currentExample) {
            const exampleEl = containerEl.createEl('div', {
                cls: 'setting-item-description card-navigator-sort-example'
            });
            exampleEl.createEl('strong', { text: '예시: ' });
            exampleEl.appendText(currentExample);
        }
    }
}

import { Setting, setIcon } from 'obsidian';
import { MATRIX_LIMITS } from '../../constants';
import { t } from '../../i18n';
import CardNavigatorPlugin from '../../main';
import { GroupCriteria, GroupSortCriteria, SortCriteria, SortLevel, SortOptions, SortOrder } from '../../types';
import type { CardNavigatorSettingTab } from '../SettingsTab';

/**
 * GroupingSettings
 *
 * 그룹화 탭 설정 UI (그룹화 + 핀 + 정렬 + 2D Matrix)
 */
export class GroupingSettings {
    private draggedIndex: number | null = null;
    private levelsContainerEl: HTMLElement | null = null;

    constructor(
        private plugin: CardNavigatorPlugin,
        private settingsTab: CardNavigatorSettingTab
    ) {}

    /**
     * 그룹화 설정을 렌더링합니다
     */
    render(containerEl: HTMLElement): void {
        this.addGroupingSettings(containerEl);
        this.addPinSettings(containerEl);
        this.addSortSettings(containerEl);
    }

    /**
     * 그룹화 설정을 추가합니다
     */
    private addGroupingSettings(containerEl: HTMLElement): void {
        const trans = t().settings.grouping;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        // 그룹화 활성화
        new Setting(itemsEl)
            .setName(trans.enableGrouping)
            .setDesc(trans.enableGroupingDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.grouping.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.grouping.enabled = value;
                    // 그룹화를 활성화하면서 기준이 'none'이면 기본값으로 'folder' 설정
                    if (value && this.plugin.settings.grouping.criteria === 'none') {
                        this.plugin.settings.grouping.criteria = 'folder';
                    }
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                    this.settingsTab.display();
                })
            );

        // 그룹화가 비활성화되어도 2D Matrix 설정은 표시 (프리셋 자동 적용 지원)
        if (!this.plugin.settings.grouping.enabled) {
            this.addMatrix2DSettings(containerEl);
            return;
        }

        // 그룹화 기준 ('none' 옵션 제거)
        new Setting(itemsEl)
            .setName(trans.groupBy)
            .setDesc(trans.groupByDescription)
            .addDropdown(dropdown => dropdown
                .addOption('folder', trans.criteria.folder)
                .addOption('tag', trans.criteria.tag)
                .addOption('date-year', trans.criteria.dateYear)
                .addOption('date-month', trans.criteria.dateMonth)
                .addOption('date-week', trans.criteria.dateWeek)
                .addOption('property', trans.criteria.property)
                .addOption('size', trans.criteria.size)
                .addOption('first-letter', trans.criteria.firstLetter)
                .setValue(this.plugin.settings.grouping.criteria === 'none' ? 'folder' : this.plugin.settings.grouping.criteria)
                .onChange(async (value: GroupCriteria) => {
                    this.plugin.settings.grouping.criteria = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                    this.settingsTab.display();
                })
            );

        // 날짜 기준 (date-* 타입일 때만 표시)
        if (this.plugin.settings.grouping.criteria.startsWith('date-')) {
            new Setting(itemsEl)
                .setName(trans.dateBasis)
                .setDesc(trans.dateBasisDescription)
                .addDropdown(dropdown => dropdown
                    .addOption('created', trans.dateBasisOptions.created)
                    .addOption('modified', trans.dateBasisOptions.modified)
                    .setValue(this.plugin.settings.grouping.dateBasis)
                    .onChange(async (value: 'created' | 'modified') => {
                        this.plugin.settings.grouping.dateBasis = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshView();
                    })
                );
        }

        // 태그 모드 (tag 타입일 때만 표시)
        if (this.plugin.settings.grouping.criteria === 'tag') {
            new Setting(itemsEl)
                .setName(trans.tagMode)
                .setDesc(trans.tagModeDescription)
                .addDropdown(dropdown => dropdown
                    .addOption('first', trans.tagModeOptions.first)
                    .addOption('all', trans.tagModeOptions.all)
                    .setValue(this.plugin.settings.grouping.tagMode)
                    .onChange(async (value: 'first' | 'all') => {
                        this.plugin.settings.grouping.tagMode = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshView();
                    })
                );
        }

        // 속성명 (property 타입일 때만 표시)
        if (this.plugin.settings.grouping.criteria === 'property') {
            new Setting(itemsEl)
                .setName(trans.propertyName)
                .setDesc(trans.propertyNameDescription)
                .addText(text => text
                    .setPlaceholder(trans.propertyNamePlaceholder)
                    .setValue(this.plugin.settings.grouping.propertyName || '')
                    .onChange(async (value) => {
                        this.plugin.settings.grouping.propertyName = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshView();
                    })
                );
        }

        // 폴더 계층 구조 (folder 타입일 때만 표시)
        if (this.plugin.settings.grouping.criteria === 'folder') {
            new Setting(itemsEl)
                .setName(trans.showFullFolderPath)
                .setDesc(trans.showFullFolderPathDescription)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.grouping.folderHierarchical)
                    .onChange(async (value) => {
                        this.plugin.settings.grouping.folderHierarchical = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshView();
                    })
                );
        }

        // 그룹 정렬
        new Setting(itemsEl)
            .setName(trans.sortGroupsBy)
            .setDesc(trans.sortGroupsByDescription)
            .addDropdown(dropdown => dropdown
                .addOption('name', trans.sortGroupsOptions.name)
                .addOption('file-count', trans.sortGroupsOptions.fileCount)
                .addOption('latest-file', trans.sortGroupsOptions.latestFile)
                .addOption('hierarchy', trans.sortGroupsOptions.hierarchy)
                .setValue(this.plugin.settings.grouping.groupSort)
                .onChange(async (value: GroupSortCriteria) => {
                    this.plugin.settings.grouping.groupSort = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // 그룹 정렬 순서
        new Setting(itemsEl)
            .setName(trans.groupSortOrder)
            .setDesc(trans.groupSortOrderDescription)
            .addDropdown(dropdown => dropdown
                .addOption('asc', trans.groupSortOrderOptions.asc)
                .addOption('desc', trans.groupSortOrderOptions.desc)
                .setValue(this.plugin.settings.grouping.groupSortOrder)
                .onChange(async (value: 'asc' | 'desc') => {
                    this.plugin.settings.grouping.groupSortOrder = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // 2D Matrix Grouping 설정
        this.addMatrix2DSettings(containerEl);
    }

    /**
     * 2D 매트릭스 그룹화 설정을 추가합니다
     */
    private addMatrix2DSettings(containerEl: HTMLElement): void {
        const matrixTrans = t().settings.matrix2D;
        const matrixSettings = this.plugin.settings.grouping.matrix2D;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(matrixTrans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        // 2D 매트릭스 활성화
        new Setting(itemsEl)
            .setName(matrixTrans.enabled)
            .setDesc(matrixTrans.enabledDescription)
            .addToggle(toggle => toggle
                .setValue(matrixSettings.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.enabled = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                    this.settingsTab.display();
                })
            );

        // 2D 매트릭스가 활성화되어 있을 때만 추가 설정 표시
        if (!matrixSettings.enabled) {
            return;
        }

        // === 프리셋 선택 ===
        new Setting(itemsEl)
            .setName(matrixTrans.presets.title)
            .addDropdown(dropdown => dropdown
                .addOption('eisenhower', matrixTrans.presets.eisenhowerMatrix)
                .addOption('custom', matrixTrans.presets.custom)
                .setValue(this.getMatrixPresetType())
                .onChange(async (value) => {
                    if (value === 'eisenhower') {
                        this.applyEisenhowerPreset();
                    } else if (value === 'custom') {
                        this.applyCustomPreset();
                    }
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                    this.settingsTab.display();
                })
            );

        // === Primary Axis (X축) 설정 ===
        const primaryGroupEl = containerEl.createDiv({ cls: 'setting-group' });
        new Setting(primaryGroupEl)
            .setHeading()
            .setName(matrixTrans.primaryAxis)
            .setDesc(matrixTrans.primaryAxisDescription);
        const primaryItemsEl = primaryGroupEl.createDiv({ cls: 'setting-items' });

        // Primary 속성 이름
        new Setting(primaryItemsEl)
            .setName(matrixTrans.propertyName)
            .addText(text => text
                .setPlaceholder(matrixTrans.propertyNamePlaceholder)
                .setValue(matrixSettings.primaryAxis.propertyName)
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.primaryAxis.propertyName = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // Primary 속성 값들
        new Setting(primaryItemsEl)
            .setName(matrixTrans.propertyValues)
            .setDesc(matrixTrans.propertyValuesDescription)
            .addText(text => text
                .setPlaceholder(matrixTrans.propertyValuesPlaceholder)
                .setValue(matrixSettings.primaryAxis.values.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.primaryAxis.values =
                        value.split(',').map(v => v.trim()).filter(v => v.length > 0);
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // Primary 축 레이블 (선택적)
        new Setting(primaryItemsEl)
            .setName(matrixTrans.axisLabel)
            .addText(text => text
                .setPlaceholder(matrixTrans.axisLabelPlaceholder)
                .setValue(matrixSettings.primaryAxis.label || '')
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.primaryAxis.label = value || undefined;
                    await this.plugin.saveSettings();
                })
            );

        // === Secondary Axis (Y축) 설정 ===
        const secondaryGroupEl = containerEl.createDiv({ cls: 'setting-group' });
        new Setting(secondaryGroupEl)
            .setHeading()
            .setName(matrixTrans.secondaryAxis)
            .setDesc(matrixTrans.secondaryAxisDescription);
        const secondaryItemsEl = secondaryGroupEl.createDiv({ cls: 'setting-items' });

        // Secondary 속성 이름
        new Setting(secondaryItemsEl)
            .setName(matrixTrans.propertyName)
            .addText(text => text
                .setPlaceholder(matrixTrans.propertyNamePlaceholder)
                .setValue(matrixSettings.secondaryAxis.propertyName)
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.secondaryAxis.propertyName = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // Secondary 속성 값들
        new Setting(secondaryItemsEl)
            .setName(matrixTrans.propertyValues)
            .setDesc(matrixTrans.propertyValuesDescription)
            .addText(text => text
                .setPlaceholder(matrixTrans.propertyValuesPlaceholder)
                .setValue(matrixSettings.secondaryAxis.values.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.secondaryAxis.values =
                        value.split(',').map(v => v.trim()).filter(v => v.length > 0);
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // Secondary 축 레이블 (선택적)
        new Setting(secondaryItemsEl)
            .setName(matrixTrans.axisLabel)
            .addText(text => text
                .setPlaceholder(matrixTrans.axisLabelPlaceholder)
                .setValue(matrixSettings.secondaryAxis.label || '')
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.secondaryAxis.label = value || undefined;
                    await this.plugin.saveSettings();
                })
            );

        // === 추가 옵션 ===
        const otherGroupEl = containerEl.createDiv({ cls: 'setting-group' });
        new Setting(otherGroupEl)
            .setHeading()
            .setName(t().settingsTab.tabs.other);
        const otherItemsEl = otherGroupEl.createDiv({ cls: 'setting-items' });

        // 미분류 섹션 표시
        new Setting(otherItemsEl)
            .setName(matrixTrans.showUnclassifiedSection)
            .setDesc(matrixTrans.showUnclassifiedSectionDescription)
            .addToggle(toggle => toggle
                .setValue(matrixSettings.showUnclassifiedSection)
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.showUnclassifiedSection = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                    this.settingsTab.display();
                })
            );

        // 미분류 섹션 제목 (표시할 때만)
        if (matrixSettings.showUnclassifiedSection) {
            new Setting(otherItemsEl)
                .setName(matrixTrans.unclassifiedSectionTitle)
                .addText(text => text
                    .setPlaceholder(matrixTrans.unclassifiedSectionTitlePlaceholder)
                    .setValue(matrixSettings.unclassifiedSectionTitle)
                    .onChange(async (value) => {
                        this.plugin.settings.grouping.matrix2D.unclassifiedSectionTitle = value || 'Unclassified';
                        await this.plugin.saveSettings();
                        await this.plugin.refreshView();
                    })
                );
        }

        // 드래그 앤 드롭 속성 변경
        new Setting(otherItemsEl)
            .setName(matrixTrans.enableDragDropPropertyChange)
            .setDesc(matrixTrans.enableDragDropPropertyChangeDescription)
            .addToggle(toggle => toggle
                .setValue(matrixSettings.enableDragDropPropertyChange)
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.enableDragDropPropertyChange = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // 셀 최소 너비
        new Setting(otherItemsEl)
            .setName(matrixTrans.cellMinWidth)
            .setDesc(matrixTrans.cellMinWidthDescription)
            .addSlider(slider => slider
                .setLimits(
                    MATRIX_LIMITS.cellMinWidth.min,
                    MATRIX_LIMITS.cellMinWidth.max,
                    MATRIX_LIMITS.cellMinWidth.step
                )
                .setValue(matrixSettings.cellMinWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.cellMinWidth = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // 셀 최소 높이
        new Setting(otherItemsEl)
            .setName(matrixTrans.cellMinHeight)
            .setDesc(matrixTrans.cellMinHeightDescription)
            .addSlider(slider => slider
                .setLimits(
                    MATRIX_LIMITS.cellMinHeight.min,
                    MATRIX_LIMITS.cellMinHeight.max,
                    MATRIX_LIMITS.cellMinHeight.step
                )
                .setValue(matrixSettings.cellMinHeight)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.cellMinHeight = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // 카드 최소 너비
        new Setting(otherItemsEl)
            .setName(matrixTrans.cardMinWidth)
            .setDesc(matrixTrans.cardMinWidthDescription)
            .addSlider(slider => slider
                .setLimits(
                    MATRIX_LIMITS.cardMinWidth.min,
                    MATRIX_LIMITS.cardMinWidth.max,
                    MATRIX_LIMITS.cardMinWidth.step
                )
                .setValue(matrixSettings.cardMinWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.grouping.matrix2D.cardMinWidth = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );
    }

    /**
     * 현재 매트릭스 설정이 어떤 프리셋인지 확인합니다
     */
    private getMatrixPresetType(): string {
        const settings = this.plugin.settings.grouping.matrix2D;

        // 아이젠하워 매트릭스 패턴 확인
        if (
            settings.primaryAxis.propertyName === 'urgency' &&
            settings.secondaryAxis.propertyName === 'importance' &&
            settings.primaryAxis.values.length === 2 &&
            settings.secondaryAxis.values.length === 2
        ) {
            return 'eisenhower';
        }

        return 'custom';
    }

    /**
     * 아이젠하워 매트릭스 프리셋을 적용합니다
     */
    private applyEisenhowerPreset(): void {
        this.plugin.settings.grouping.matrix2D.primaryAxis = {
            propertyName: 'urgency',
            values: ['Urgent', 'Not Urgent'],
            label: 'Urgency'
        };
        this.plugin.settings.grouping.matrix2D.secondaryAxis = {
            propertyName: 'importance',
            values: ['Important', 'Not Important'],
            label: 'Importance'
        };
    }

    /**
     * 사용자 정의 매트릭스 프리셋을 적용합니다 (빈 값으로 초기화)
     */
    private applyCustomPreset(): void {
        this.plugin.settings.grouping.matrix2D.primaryAxis = {
            propertyName: '',
            values: [],
            label: ''
        };
        this.plugin.settings.grouping.matrix2D.secondaryAxis = {
            propertyName: '',
            values: [],
            label: ''
        };
    }

    /**
     * 핀 설정을 추가합니다
     */
    private addPinSettings(containerEl: HTMLElement): void {
        const trans = t().settingsTab.pinSettings;
        const groupTrans = t().settings.grouping;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans?.title || 'Pin Settings');

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        // 핀된 파일 항상 표시 토글
        new Setting(itemsEl)
            .setName(trans?.alwaysShowPinned || 'Always show pinned files')
            .setDesc(trans?.alwaysShowPinnedDescription || 'Show pinned files even when scrolling or changing modes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.alwaysShowPinnedFiles || false)
                .onChange(async (value) => {
                    this.plugin.settings.alwaysShowPinnedFiles = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );

        // 핀된 파일을 별도 그룹으로 표시
        new Setting(itemsEl)
            .setName(groupTrans.showPinnedAsGroup)
            .setDesc(groupTrans.showPinnedAsGroupDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.grouping.showPinnedAsGroup ?? true)
                .onChange(async (value) => {
                    this.plugin.settings.grouping.showPinnedAsGroup = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshView();
                })
            );
    }

    /**
     * 정렬 설정을 추가합니다
     */
    private addSortSettings(containerEl: HTMLElement): void {
        const trans = t().settingsTab.sortSettings;

        // setting-group 컨테이너
        const groupEl = containerEl.createDiv({ cls: 'setting-group' });

        // 섹션 헤더
        new Setting(groupEl)
            .setHeading()
            .setName(trans.title);

        // setting-items 컨테이너
        const itemsEl = groupEl.createDiv({ cls: 'setting-items' });

        const settings = this.plugin.settingsManager.getSettings();
        const sortSettings = settings.sort;

        // 정렬 기준 선택
        new Setting(itemsEl)
            .setName(trans.sortBy)
            .setDesc(trans.sortByDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('name', trans.criteriaOptions.name)
                    .addOption('created', trans.criteriaOptions.created)
                    .addOption('modified', trans.criteriaOptions.modified)
                    .addOption('size', trans.criteriaOptions.size)
                    .addOption('property', trans.criteriaOptions.property)
                    .setValue(sortSettings.criteria)
                    .onChange(async (value) => {
                        sortSettings.criteria = value as SortCriteria;
                        await this.plugin.saveSettings();
                        this.settingsTab.display();
                    });
            });

        // 프론트매터 속성 입력 (criteria가 'property'일 때만 표시)
        if (sortSettings.criteria === 'property') {
            new Setting(itemsEl)
                .setName(trans.propertyName)
                .setDesc(trans.propertyNameDescription)
                .addText(text => text
                    .setPlaceholder(trans.propertyNamePlaceholder)
                    .setValue(sortSettings.propertyName || '')
                    .onChange(async (value) => {
                        sortSettings.propertyName = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // 정렬 순서 선택
        new Setting(itemsEl)
            .setName(trans.sortOrder)
            .setDesc(trans.sortOrderDescription)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('asc', trans.orderOptions.asc)
                    .addOption('desc', trans.orderOptions.desc)
                    .setValue(sortSettings.order)
                    .onChange(async (value) => {
                        sortSettings.order = value as 'asc' | 'desc';
                        await this.plugin.saveSettings();
                    });
            });

        // 다단계 정렬 활성화
        new Setting(itemsEl)
            .setName(trans.enableMultiSort || 'Enable Multi-level Sort')
            .setDesc(trans.enableMultiSortDescription || 'Sort files by multiple criteria in sequence')
            .addToggle(toggle => toggle
                .setValue(sortSettings.enableMultiSort || false)
                .onChange(async (value) => {
                    sortSettings.enableMultiSort = value;
                    if (value && (!sortSettings.levels || sortSettings.levels.length === 0)) {
                        // Initialize with current sort as first level only if no levels exist
                        sortSettings.levels = [{
                            criteria: sortSettings.criteria,
                            order: sortSettings.order,
                            propertyName: sortSettings.propertyName
                        }];
                    }
                    // Don't delete levels when disabling, keep them to restore later
                    await this.plugin.saveSettings();
                    this.settingsTab.display();
                })
            );

        // 다단계 정렬 레벨 구성 (인라인)
        if (sortSettings.enableMultiSort) {
            this.renderMultiSortLevels(itemsEl, sortSettings);
        }

        // 정렬 예시 안내
        this.addSortExamples(itemsEl, sortSettings);
    }

    /**
     * 다단계 정렬 레벨을 렌더링합니다
     */
    private renderMultiSortLevels(containerEl: HTMLElement, sortSettings: SortOptions): void {
        const trans = t().settingsTab.sortSettings;
        const toolbarTrans = t().toolbar;

        // Description section
        const descriptionEl = containerEl.createEl('div', {
            cls: 'setting-item-description',
            attr: { style: 'margin-bottom: 12px;' }
        });
        descriptionEl.innerHTML = (toolbarTrans.multiSortModalDescription ||
            'Drag and drop to reorder sort levels. Files will be sorted by Level 1 first, then Level 2, and so on.').replace('\n', '<br>');

        // Levels container
        this.levelsContainerEl = containerEl.createEl('div', {
            cls: 'multi-sort-levels-container',
            attr: { style: 'margin-bottom: 12px;' }
        });

        if (!sortSettings.levels) {
            sortSettings.levels = [{
                criteria: sortSettings.criteria,
                order: sortSettings.order,
                propertyName: sortSettings.propertyName
            }];
        }

        this.renderLevels(sortSettings);

        // Add level button (max 3 levels)
        if (sortSettings.levels.length < 3) {
            new Setting(containerEl)
                .addButton(button => button
                    .setButtonText(trans.addLevel || '+ Add Sort Level')
                    .onClick(async () => {
                        sortSettings.levels = sortSettings.levels || [];
                        sortSettings.levels.push({
                            criteria: 'name',
                            order: 'asc'
                        });
                        await this.plugin.saveSettings();
                        this.renderLevels(sortSettings);
                    })
                );
        }
    }

    /**
     * 레벨 리스트를 렌더링합니다
     */
    private renderLevels(sortSettings: SortOptions): void {
        if (!this.levelsContainerEl) return;
        this.levelsContainerEl.empty();

        const levels = sortSettings.levels || [];
        levels.forEach((level, index) => {
            const levelEl = this.createLevelElement(level, index, sortSettings);
            this.levelsContainerEl!.appendChild(levelEl);
        });
    }

    /**
     * 개별 레벨 요소를 생성합니다
     */
    private createLevelElement(level: SortLevel, index: number, sortSettings: SortOptions): HTMLElement {
        const trans = t().settingsTab.sortSettings;

        const levelEl = document.createElement('div');
        levelEl.className = 'multi-sort-level-item';
        levelEl.draggable = true;

        // Drag handle
        const dragHandle = levelEl.createEl('div', {
            cls: 'multi-sort-drag-handle',
            attr: { 'aria-label': 'Drag to reorder' }
        });
        setIcon(dragHandle, 'grip-vertical');

        // Level number
        levelEl.createEl('div', {
            cls: 'multi-sort-level-number',
            text: String(index + 1)
        });

        // Content container
        const contentContainer = levelEl.createEl('div', {
            cls: 'multi-sort-level-content'
        });

        // Criteria dropdown
        const criteriaContainer = contentContainer.createEl('div', {
            cls: 'multi-sort-field'
        });
        const criteriaSelect = criteriaContainer.createEl('select', {
            cls: 'dropdown'
        }) as HTMLSelectElement;

        const criteriaOptions: Array<{ value: SortCriteria; label: string }> = [
            { value: 'name', label: trans.criteriaOptions.name },
            { value: 'created', label: trans.criteriaOptions.created },
            { value: 'modified', label: trans.criteriaOptions.modified },
            { value: 'size', label: trans.criteriaOptions.size },
            { value: 'property', label: trans.criteriaOptions.property }
        ];

        criteriaOptions.forEach(option => {
            const optionEl = criteriaSelect.createEl('option', {
                text: option.label
            }) as HTMLOptionElement;
            optionEl.value = option.value;
            if (option.value === level.criteria) {
                optionEl.selected = true;
            }
        });

        criteriaSelect.addEventListener('change', async () => {
            level.criteria = criteriaSelect.value as SortCriteria;
            await this.plugin.saveSettings();
            // Re-render to show/hide property input
            this.renderLevels(sortSettings);
        });

        // Property name input (if criteria is 'property')
        if (level.criteria === 'property') {
            const propertyContainer = contentContainer.createEl('div', {
                cls: 'multi-sort-field'
            });
            const propertyInput = propertyContainer.createEl('input', {
                cls: 'multi-sort-property-input',
                attr: {
                    placeholder: trans.propertyNamePlaceholder
                }
            }) as HTMLInputElement;
            propertyInput.type = 'text';
            propertyInput.value = level.propertyName || '';
            propertyInput.addEventListener('change', async () => {
                level.propertyName = propertyInput.value;
                await this.plugin.saveSettings();
            });
        }

        // Order dropdown
        const orderContainer = contentContainer.createEl('div', {
            cls: 'multi-sort-field'
        });
        const orderSelect = orderContainer.createEl('select', {
            cls: 'dropdown'
        }) as HTMLSelectElement;

        const orderOptions: Array<{ value: SortOrder; label: string }> = [
            { value: 'asc', label: '↑ ' + trans.orderOptions.asc },
            { value: 'desc', label: '↓ ' + trans.orderOptions.desc }
        ];

        orderOptions.forEach(option => {
            const optionEl = orderSelect.createEl('option', {
                text: option.label
            }) as HTMLOptionElement;
            optionEl.value = option.value;
            if (option.value === level.order) {
                optionEl.selected = true;
            }
        });

        orderSelect.addEventListener('change', async () => {
            level.order = orderSelect.value as SortOrder;
            await this.plugin.saveSettings();
        });

        // Delete button
        const deleteBtn = levelEl.createEl('div', {
            cls: 'clickable-icon multi-sort-delete-btn',
            attr: { 'aria-label': trans.removeLevel || 'Remove' }
        });
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.addEventListener('click', async () => {
            sortSettings.levels = sortSettings.levels || [];
            sortSettings.levels.splice(index, 1);
            await this.plugin.saveSettings();
            this.renderLevels(sortSettings);
        });

        // Drag and drop events
        levelEl.addEventListener('dragstart', (e) => {
            this.draggedIndex = index;
            levelEl.addClass('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        levelEl.addEventListener('dragend', () => {
            levelEl.removeClass('dragging');
            this.draggedIndex = null;
        });

        levelEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.draggedIndex !== null && this.draggedIndex !== index) {
                levelEl.addClass('drag-over');
            }
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
        });

        levelEl.addEventListener('dragleave', () => {
            levelEl.removeClass('drag-over');
        });

        levelEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            levelEl.removeClass('drag-over');

            if (this.draggedIndex !== null && this.draggedIndex !== index) {
                // Reorder levels
                const levels = sortSettings.levels || [];
                const draggedLevel = levels[this.draggedIndex];
                levels.splice(this.draggedIndex, 1);
                levels.splice(index, 0, draggedLevel);
                sortSettings.levels = levels;

                await this.plugin.saveSettings();
                this.renderLevels(sortSettings);
            }
        });

        return levelEl;
    }

    /**
     * 정렬 예시를 추가합니다
     */
    private addSortExamples(containerEl: HTMLElement, sortSettings: SortOptions): void {
        const trans = t().settingsTab.sortSettings;
        const examples = trans.examples;
        const examplesMap: Record<string, string> = {
            'name': examples.name,
            'created': examples.created,
            'modified': examples.modified,
            'size': examples.size,
            'property': examples.property
        };

        const currentExample = examplesMap[sortSettings.criteria];

        if (currentExample) {
            const exampleEl = containerEl.createEl('div', {
                cls: 'setting-item-description card-navigator-sort-example'
            });
            exampleEl.createEl('strong', { text: trans.exampleLabel });
            exampleEl.appendText(currentExample);
        }
    }
}

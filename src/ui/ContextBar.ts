import { setIcon } from 'obsidian';

/**
 * 경로 세그먼트 정보
 */
export interface PathSegment {
    /** 세그먼트 이름 (표시용) */
    name: string;
    /** 전체 경로 (클릭 시 이동용) */
    fullPath: string;
    /** 깊이 레벨 */
    level: number;
    /** 아이콘 (옵션) */
    icon?: string;
}

/**
 * 그룹 목록 아이템 정보
 */
export interface GroupListItem {
    /** 그룹 ID */
    id: string;
    /** 그룹명 */
    name: string;
    /** 아이콘 */
    icon: string;
    /** 파일 개수 */
    fileCount: number;
    /** 현재 활성 그룹 여부 */
    isActive: boolean;
    /** 계층 레벨 (들여쓰기용, 0부터 시작) */
    level?: number;
    /** 자식 항목 여부 (토글 아이콘 표시용) */
    hasChildren?: boolean;
    /** 부모 ID (계층 구조 추적용) */
    parentId?: string;
}

/**
 * Context Bar 컴포넌트
 *
 * 현재 위치를 표시하고 클릭 시 드롭다운으로 그룹 목록을 보여줍니다.
 * 그룹화가 활성화되어 있을 때만 표시됩니다.
 *
 * @example
 * 📁 현재 폴더명 ▼    (클릭 시 폴더 목록 드롭다운)
 */
export class ContextBar {
    private container: HTMLElement;
    private barElement: HTMLElement | null = null;
    private currentGroupName: HTMLElement | null = null;
    private dropdownContainer: HTMLElement | null = null;
    private collapseToggleIcon: HTMLElement | null = null;
    private currentPath: PathSegment[] = [];
    private groupList: GroupListItem[] = [];
    private isDropdownOpen: boolean = false;
    private isAllCollapsed: boolean = false;
    private onGroupSelect: ((groupId: string) => void) | null = null;
    private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
    /** 접힌 그룹 ID 세트 (드롭다운 내 계층 접기용) */
    private collapsedGroups: Set<string> = new Set();
    /** ⭐ Phase 1 최적화: 그룹 ID → 그룹 객체 맵 (O(1) 조회용) */
    private groupListMap: Map<string, GroupListItem> = new Map();

    constructor(container: HTMLElement) {
        this.container = container;
    }

    /**
     * Context Bar를 렌더링합니다
     *
     * @param onGroupSelect - 그룹 선택 콜백
     */
    render(onGroupSelect?: (groupId: string) => void): HTMLElement {
        this.onGroupSelect = onGroupSelect || null;

        const bar = this.container.createEl('div', {
            cls: 'card-navigator-context-bar'
        });
        this.barElement = bar;

        // 클릭 가능한 현재 위치 표시 영역
        const clickableArea = bar.createEl('div', {
            cls: 'context-bar-clickable'
        });

        // 아이콘
        const iconEl = clickableArea.createEl('span', {
            cls: 'context-bar-icon'
        });
        setIcon(iconEl, 'folder');

        // 현재 그룹명
        this.currentGroupName = clickableArea.createEl('span', {
            cls: 'context-bar-current-name',
            text: ''
        });

        // 드롭다운 화살표
        const arrowEl = clickableArea.createEl('span', {
            cls: 'context-bar-arrow'
        });
        setIcon(arrowEl, 'chevron-down');

        // 클릭 이벤트
        clickableArea.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // 모두 접기/펼치기 토글 아이콘 (오른쪽)
        this.collapseToggleIcon = bar.createEl('span', {
            cls: 'context-bar-collapse-toggle clickable-icon hidden',
            attr: { 'aria-label': 'Toggle collapse all' }
        });
        setIcon(this.collapseToggleIcon, 'chevrons-down-up');
        this.collapseToggleIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCollapseAll();
        });

        // 드롭다운 컨테이너
        this.dropdownContainer = bar.createEl('div', {
            cls: 'context-bar-dropdown hidden'
        });

        // 외부 클릭 핸들러 설정
        this.outsideClickHandler = (e: MouseEvent) => {
            if (this.isDropdownOpen && !bar.contains(e.target as Node)) {
                this.closeDropdown();
            }
        };
        document.addEventListener('click', this.outsideClickHandler);

        // 초기에는 숨김
        bar.addClass('hidden');

        return bar;
    }

    /**
     * 드롭다운을 토글합니다
     */
    private toggleDropdown(): void {
        if (this.isDropdownOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    /**
     * 드롭다운을 엽니다
     */
    private openDropdown(): void {
        if (!this.dropdownContainer) return;

        this.dropdownContainer.removeClass('hidden');
        this.barElement?.addClass('dropdown-open');
        this.isDropdownOpen = true;

        // 드롭다운 내용 렌더링
        this.renderDropdownContent();

        // 현재 활성 그룹으로 스크롤
        this.scrollToActiveItem();
    }

    /**
     * 활성 아이템으로 스크롤합니다
     */
    private scrollToActiveItem(): void {
        if (!this.dropdownContainer) return;

        const activeItem = this.dropdownContainer.querySelector('.context-bar-dropdown-item.is-active');
        if (activeItem) {
            // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 스크롤
            requestAnimationFrame(() => {
                activeItem.scrollIntoView({
                    block: 'center',
                    behavior: 'instant'
                });
            });
        }
    }

    /**
     * 드롭다운을 닫습니다
     */
    private closeDropdown(): void {
        if (!this.dropdownContainer) return;

        this.dropdownContainer.addClass('hidden');
        this.barElement?.removeClass('dropdown-open');
        this.isDropdownOpen = false;
    }

    /**
     * 자식이 있는 그룹이 존재하는지 확인합니다
     */
    private hasAnyGroupWithChildren(): boolean {
        return this.groupList.some(g => g.hasChildren);
    }

    /**
     * 모든 그룹의 접기/펼치기를 토글합니다
     */
    private toggleCollapseAll(): void {
        if (this.isAllCollapsed) {
            // 모두 펼치기
            this.collapsedGroups.clear();
            this.isAllCollapsed = false;
        } else {
            // 모두 접기
            this.groupList.forEach(group => {
                if (group.hasChildren) {
                    this.collapsedGroups.add(group.id);
                }
            });
            this.isAllCollapsed = true;
        }
        this.updateCollapseToggleIcon();
        this.renderDropdownContent();
    }

    /**
     * 접기/펼치기 토글 아이콘을 업데이트합니다
     */
    private updateCollapseToggleIcon(): void {
        if (!this.collapseToggleIcon) return;
        this.collapseToggleIcon.empty();
        setIcon(this.collapseToggleIcon, this.isAllCollapsed ? 'chevrons-down-up' : 'chevrons-up-down');
    }

    /**
     * 드롭다운 내용을 렌더링합니다
     */
    private renderDropdownContent(): void {
        if (!this.dropdownContainer) return;

        this.dropdownContainer.empty();

        if (this.groupList.length === 0) {
            this.dropdownContainer.createEl('div', {
                cls: 'context-bar-dropdown-empty',
                text: 'No groups available'
            });
            return;
        }

        // 그룹 목록 컨테이너
        const listContainer = this.dropdownContainer.createEl('div', {
            cls: 'context-bar-dropdown-list'
        });

        // 그룹 목록 렌더링
        this.groupList.forEach(group => {
            const level = group.level || 0;
            const isCollapsed = this.collapsedGroups.has(group.id);
            const hasChildren = group.hasChildren || false;

            // 부모가 접혀있으면 이 항목도 숨김
            if (this.isParentCollapsed(group)) {
                return;
            }

            const item = listContainer.createEl('div', {
                cls: `context-bar-dropdown-item${group.isActive ? ' is-active' : ''}${isCollapsed ? ' is-collapsed' : ''}`,
                attr: { 'data-level': String(level) }
            });
            item.dataset.groupId = group.id;

            // 레벨에 따른 들여쓰기 (토글 아이콘 공간 포함)
            const baseIndent = 8;
            const levelIndent = level * 16;
            item.style.paddingLeft = `${baseIndent + levelIndent}px`;

            // 토글 아이콘 (자식이 있는 경우에만)
            const toggleEl = item.createEl('span', {
                cls: `dropdown-item-toggle${hasChildren ? '' : ' no-children'}`
            });
            if (hasChildren) {
                setIcon(toggleEl, isCollapsed ? 'chevron-right' : 'chevron-down');
                toggleEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleGroupCollapse(group.id);
                });
            }

            // 아이콘
            const iconEl = item.createEl('span', {
                cls: 'dropdown-item-icon'
            });
            setIcon(iconEl, group.icon);

            // 그룹명
            item.createEl('span', {
                cls: 'dropdown-item-name',
                text: group.name
            });

            // 파일 개수
            item.createEl('span', {
                cls: 'dropdown-item-count',
                text: `(${group.fileCount})`
            });

            // 그룹 선택 클릭 이벤트 (토글 영역 외)
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeDropdown();
                if (this.onGroupSelect) {
                    this.onGroupSelect(group.id);
                }
            });
        });
    }

    /**
     * 부모 그룹이 접혀있는지 확인합니다
     *
     * @remarks
     * ⭐ Phase 1 최적화: Array.find() → Map.get()으로 변경
     * - 기존: O(n × h) - 매번 전체 배열 순회
     * - 개선: O(h) - Map을 통한 O(1) 조회
     */
    private isParentCollapsed(group: GroupListItem): boolean {
        if (!group.parentId) return false;

        // 부모가 접혀있으면 true
        if (this.collapsedGroups.has(group.parentId)) {
            return true;
        }

        // ⭐ Phase 1 최적화: Map을 통한 O(1) 조회
        const parent = this.groupListMap.get(group.parentId);
        if (parent) {
            return this.isParentCollapsed(parent);
        }

        return false;
    }

    /**
     * 그룹의 접힘 상태를 토글합니다
     */
    private toggleGroupCollapse(groupId: string): void {
        if (this.collapsedGroups.has(groupId)) {
            this.collapsedGroups.delete(groupId);
        } else {
            this.collapsedGroups.add(groupId);
        }
        this.renderDropdownContent();
        // 스크롤 위치 유지를 위해 활성 아이템으로 스크롤하지 않음
    }

    /**
     * 그룹 목록을 업데이트합니다
     *
     * @param groups - 그룹 목록
     * @param activeGroupId - 현재 활성 그룹 ID
     */
    updateGroupList(groups: GroupListItem[], activeGroupId?: string): void {
        this.groupList = groups.map(g => ({
            ...g,
            isActive: g.id === activeGroupId
        }));

        // ⭐ Phase 1 최적화: Map 생성 (O(1) 조회용)
        this.groupListMap = new Map(this.groupList.map(g => [g.id, g]));

        // 토글 버튼 표시 상태 업데이트 (계층 구조가 있는 경우에만 표시)
        this.updateToggleButtonsVisibility();

        // 드롭다운이 열려있으면 내용 갱신
        if (this.isDropdownOpen) {
            this.renderDropdownContent();
        }
    }

    /**
     * 토글 아이콘의 표시 상태를 업데이트합니다
     */
    private updateToggleButtonsVisibility(): void {
        if (!this.collapseToggleIcon) return;

        if (this.hasAnyGroupWithChildren()) {
            this.collapseToggleIcon.removeClass('hidden');
        } else {
            this.collapseToggleIcon.addClass('hidden');
        }
    }

    /**
     * 경로를 업데이트합니다
     *
     * @param segments - 경로 세그먼트 배열
     */
    update(segments: PathSegment[]): void {
        this.currentPath = segments;

        if (segments.length === 0) {
            this.hide();
            return;
        }

        // 현재 그룹명 업데이트 (전체 경로 표시)
        const currentSegment = segments[segments.length - 1];
        if (this.currentGroupName) {
            // 모든 세그먼트의 이름을 " / "로 연결하여 전체 경로 표시
            const fullPathDisplay = segments.map(s => s.name).join(' / ');
            this.currentGroupName.textContent = fullPathDisplay;
        }

        // 아이콘 업데이트
        const iconEl = this.barElement?.querySelector('.context-bar-icon') as HTMLElement | null;
        if (iconEl && currentSegment.icon) {
            // 기존 아이콘 내용 제거
            iconEl.innerHTML = '';
            setIcon(iconEl, currentSegment.icon);
        }

        this.show();
    }

    /**
     * 현재 경로를 반환합니다
     */
    getCurrentPath(): PathSegment[] {
        return this.currentPath;
    }

    /**
     * Context Bar를 표시합니다
     */
    show(): void {
        if (this.barElement) {
            this.barElement.removeClass('hidden');
        }
    }

    /**
     * Context Bar를 숨깁니다
     */
    hide(): void {
        if (this.barElement) {
            this.barElement.addClass('hidden');
        }
        this.closeDropdown();
    }

    /**
     * 그룹화 상태에 따라 표시 여부를 업데이트합니다
     *
     * @param groupingEnabled - 그룹화 활성화 여부
     */
    setGroupingEnabled(groupingEnabled: boolean): void {
        if (!groupingEnabled) {
            this.hide();
            this.currentPath = [];
            this.groupList = [];
        }
    }

    /**
     * 리소스를 정리합니다
     */
    destroy(): void {
        // 외부 클릭 핸들러 제거
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
            this.outsideClickHandler = null;
        }

        if (this.barElement) {
            this.barElement.remove();
        }
        this.barElement = null;
        this.currentGroupName = null;
        this.dropdownContainer = null;
        this.collapseToggleIcon = null;
        this.currentPath = [];
        this.groupList = [];
        this.groupListMap.clear(); // ⭐ Phase 1 최적화: Map 정리
        this.collapsedGroups.clear();
        this.onGroupSelect = null;
    }
}

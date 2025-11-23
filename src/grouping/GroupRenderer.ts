import { CardGroup } from '../types';
import { setIcon } from 'obsidian';

/**
 * 그룹 섹션 헤더를 렌더링합니다
 *
 * 그룹 섹션의 UI 요소를 생성하고 관리합니다.
 */
export class GroupRenderer {
    private isHorizontalMode: boolean = false;

    /**
     * 가로 모드 설정
     * @param isHorizontal - 가로 모드 여부
     */
    setHorizontalMode(isHorizontal: boolean): void {
        this.isHorizontalMode = isHorizontal;
    }

    /**
     * 그룹 섹션을 생성합니다
     *
     * @param group - 그룹 데이터
     * @param container - 그룹을 추가할 컨테이너
     * @param onToggle - 접기/펼치기 콜백
     * @param onSelectAll - 전체 선택 콜백
     * @returns 생성된 섹션 요소
     */
    createGroupSection(
        group: CardGroup,
        container: HTMLElement,
        onToggle: (groupId: string, collapsed: boolean) => void,
        onSelectAll: (groupId: string) => void
    ): HTMLElement {
        const section = container.createEl('div', {
            cls: 'card-group-section'
        });
        section.dataset.groupId = group.id;

        if (group.collapsed) {
            section.addClass('is-collapsed');
        }

        // 섹션 헤더 (이름이 비어있으면 헤더 숨김)
        if (group.name) {
            const header = this.createGroupHeader(group, onToggle, onSelectAll);
            section.appendChild(header);
        }

        // 카드 컨테이너
        const cardContainer = section.createEl('div', {
            cls: 'card-group-content'
        });
        cardContainer.dataset.groupId = group.id;

        return section;
    }

    /**
     * 그룹 헤더를 생성합니다
     *
     * @param group - 그룹 데이터
     * @param onToggle - 접기/펼치기 콜백
     * @param onSelectAll - 전체 선택 콜백
     * @returns 생성된 헤더 요소
     */
    private createGroupHeader(
        group: CardGroup,
        onToggle: (groupId: string, collapsed: boolean) => void,
        onSelectAll: (groupId: string) => void
    ): HTMLElement {
        const header = document.createElement('div');
        header.className = 'card-group-header';

        // 토글 아이콘 - 가로 모드에 따라 다른 아이콘 사용
        const toggleIcon = header.createEl('div', {
            cls: 'card-group-toggle-icon'
        });

        if (this.isHorizontalMode) {
            // 가로 모드: chevron-down (펼침) / chevron-right (접힘)
            setIcon(toggleIcon, group.collapsed ? 'chevron-right' : 'chevron-down');
        } else {
            // 세로 모드: chevron-down (펼침) / chevron-right (접힘)
            setIcon(toggleIcon, group.collapsed ? 'chevron-right' : 'chevron-down');
        }

        // 그룹 아이콘 (lucide 아이콘)
        if (group.icon) {
            const iconEl = header.createEl('div', {
                cls: 'card-group-icon'
            });
            setIcon(iconEl, group.icon);
        }

        // 그룹명
        header.createEl('span', {
            cls: 'card-group-name',
            text: group.name
        });

        // 파일 개수
        header.createEl('span', {
            cls: 'card-group-count',
            text: `(${group.files.length})`
        });

        // 액션 버튼 컨테이너
        const actions = header.createEl('div', {
            cls: 'card-group-actions'
        });

        // 전체 선택 버튼
        const selectAllBtn = actions.createEl('div', {
            cls: 'clickable-icon card-group-action-btn',
            attr: { 'aria-label': 'Select all in group' }
        });
        setIcon(selectAllBtn, 'check-square');
        selectAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectAll(group.id);
        });

        // 헤더 클릭 → 토글
        header.addEventListener('click', () => {
            // ⭐ group.collapsed는 렌더링 시점의 스냅샷이므로 직접 수정하지 않음
            // localStorage에서 현재 상태를 읽어 반전시킴
            const key = `card-navigator-group-collapsed-${group.id}`;
            const stored = localStorage.getItem(key);
            // localStorage에 저장된 값이 없으면 현재 그룹의 collapsed 상태 사용
            const currentState = stored !== null ? stored === 'true' : group.collapsed;
            const newState = !currentState;
            onToggle(group.id, newState);
        });

        return header;
    }

    /**
     * 그룹을 토글합니다 (접기/펼치기)
     *
     * @param section - 그룹 섹션 요소
     * @param collapsed - 접힌 상태
     */
    toggleGroup(section: HTMLElement, collapsed: boolean): void {
        const toggleIcon = section.querySelector('.card-group-toggle-icon');

        if (collapsed) {
            section.addClass('is-collapsed');
            if (toggleIcon) {
                toggleIcon.empty();
                // 가로/세로 모드 모두 chevron-right 사용
                setIcon(toggleIcon as HTMLElement, 'chevron-right');
            }
        } else {
            section.removeClass('is-collapsed');
            if (toggleIcon) {
                toggleIcon.empty();
                // 가로/세로 모드 모두 chevron-down 사용
                setIcon(toggleIcon as HTMLElement, 'chevron-down');
            }
        }
    }

    /**
     * 모든 그룹 섹션을 찾습니다
     *
     * @param container - 컨테이너 요소
     * @returns 그룹 섹션 요소 배열
     */
    findAllGroupSections(container: HTMLElement): HTMLElement[] {
        return Array.from(container.querySelectorAll('.card-group-section')) as HTMLElement[];
    }

    /**
     * 그룹 ID로 섹션을 찾습니다
     *
     * @param container - 컨테이너 요소
     * @param groupId - 그룹 ID
     * @returns 그룹 섹션 요소 또는 null
     */
    findGroupSection(container: HTMLElement, groupId: string): HTMLElement | null {
        return container.querySelector(`.card-group-section[data-group-id="${groupId}"]`) as HTMLElement | null;
    }

    /**
     * 그룹 내 카드 컨테이너를 찾습니다
     *
     * @param section - 그룹 섹션 요소
     * @returns 카드 컨테이너 요소 또는 null
     */
    findCardContainer(section: HTMLElement): HTMLElement | null {
        return section.querySelector('.card-group-content') as HTMLElement | null;
    }

    /**
     * 그룹 헤더의 파일 개수를 업데이트합니다
     *
     * @param section - 그룹 섹션 요소
     * @param count - 새 파일 개수
     */
    updateFileCount(section: HTMLElement, count: number): void {
        const countEl = section.querySelector('.card-group-count');
        if (countEl) {
            countEl.textContent = `(${count})`;
        }
    }
}

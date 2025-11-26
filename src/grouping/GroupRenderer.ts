import { CardGroup } from '../types';
import { setIcon } from 'obsidian';
import { GroupStateManager } from './GroupStateManager';

/**
 * 그룹 섹션 헤더를 렌더링합니다
 *
 * 그룹 섹션의 UI 요소를 생성하고 관리합니다.
 *
 * @remarks
 * Phase 4: 계층 구조 렌더링 지원 추가
 * - createHierarchicalGroupSection: 중첩된 그룹 렌더링
 * - level에 따른 들여쓰기
 * - 자식 그룹 토글 (부모 접힘 시 자식도 숨김)
 */
export class GroupRenderer {
    private isHorizontalMode: boolean = false;
    private stateManager: GroupStateManager | null = null;

    /** 계층 구조 들여쓰기 단위 (px) - Phase 5: 12px로 축소 */
    private static readonly INDENT_SIZE = 12;

    /**
     * 가로 모드 설정
     * @param isHorizontal - 가로 모드 여부
     */
    setHorizontalMode(isHorizontal: boolean): void {
        this.isHorizontalMode = isHorizontal;
    }

    /**
     * GroupStateManager 설정
     * @param manager - GroupStateManager 인스턴스
     */
    setStateManager(manager: GroupStateManager): void {
        this.stateManager = manager;
    }

    /**
     * 그룹 섹션을 생성합니다
     *
     * @param group - 그룹 데이터
     * @param container - 그룹을 추가할 컨테이너
     * @param onToggle - 접기/펼치기 콜백
     * @param onSelectAll - 전체 선택 콜백
     * @param activeFile - 현재 활성 파일 (선택사항)
     * @returns 생성된 섹션 요소
     */
    createGroupSection(
        group: CardGroup,
        container: HTMLElement,
        onToggle: (groupId: string, collapsed: boolean) => void,
        onSelectAll: (groupId: string) => void,
        activeFile?: { path: string } | null
    ): HTMLElement {
        const section = container.createEl('div', {
            cls: 'card-group-section'
        });
        section.dataset.groupId = group.id;

        // 접힌 그룹에 활성 파일이 포함되어 있으면 시각적 표시 추가
        const hasActiveFile = activeFile && group.files.some((file) => file.path === activeFile.path);

        if (group.collapsed) {
            section.addClass('is-collapsed');
            if (hasActiveFile) {
                section.addClass('has-active-card');
            }
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
     * @param showHierarchy - 계층 구조 표시 여부 (Phase 4)
     * @returns 생성된 헤더 요소
     */
    private createGroupHeader(
        group: CardGroup,
        onToggle: (groupId: string, collapsed: boolean) => void,
        onSelectAll: (groupId: string) => void,
        showHierarchy: boolean = false
    ): HTMLElement {
        const header = document.createElement('div');
        header.className = 'card-group-header';

        // ⭐ Phase 4: 계층 구조 들여쓰기 적용
        if (showHierarchy && group.level > 0) {
            header.style.paddingLeft = `${group.level * GroupRenderer.INDENT_SIZE + 8}px`;
            header.classList.add('card-group-header-nested');
            header.dataset.level = String(group.level);
        }

        // 토글 아이콘
        const toggleIcon = header.createEl('div', {
            cls: 'card-group-toggle-icon'
        });

        // ⭐ Phase 4: 자식이 있는 경우에만 토글 아이콘 표시
        const hasChildren = group.children && group.children.length > 0;
        const hasFiles = group.files.length > 0;

        if (hasChildren || hasFiles) {
            setIcon(toggleIcon, group.collapsed ? 'chevron-right' : 'chevron-down');
        } else {
            // 자식도 파일도 없는 경우 아이콘 숨김
            toggleIcon.style.visibility = 'hidden';
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

        // ⭐ Phase 4: 파일 개수 표시 (계층 구조에서는 totalFileCount 사용 가능)
        const displayCount = showHierarchy && group.totalFileCount !== undefined
            ? group.totalFileCount
            : group.files.length;

        header.createEl('span', {
            cls: 'card-group-count',
            text: `(${displayCount})`
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
            // ⭐ GroupStateManager에서 현재 상태를 읽어 반전시킴
            // stateManager가 없으면 렌더링 시점의 그룹 상태 사용 (fallback)
            const currentState = this.stateManager
                ? this.stateManager.getCollapsed(group.id)
                : group.collapsed;
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

    // ========== Phase 4: 계층 구조 렌더링 메서드 ==========

    /**
     * 계층 구조 그룹 섹션을 생성합니다
     *
     * @remarks
     * Phase 4: 중첩된 그룹을 재귀적으로 렌더링합니다.
     * - level에 따른 들여쓰기 적용
     * - totalFileCount 표시
     * - 부모 접힘 시 자식도 숨김
     *
     * @param group - 그룹 데이터 (계층 구조 포함)
     * @param container - 그룹을 추가할 컨테이너
     * @param onToggle - 접기/펼치기 콜백
     * @param onSelectAll - 전체 선택 콜백
     * @param activeFile - 현재 활성 파일
     * @returns 생성된 섹션 요소
     */
    createHierarchicalGroupSection(
        group: CardGroup,
        container: HTMLElement,
        onToggle: (groupId: string, collapsed: boolean) => void,
        onSelectAll: (groupId: string) => void,
        activeFile?: { path: string } | null
    ): HTMLElement {
        const section = container.createEl('div', {
            cls: 'card-group-section card-group-hierarchical'
        });
        section.dataset.groupId = group.id;
        section.dataset.level = String(group.level);

        if (group.parentId) {
            section.dataset.parentId = group.parentId;
        }

        // 접힌 그룹에 활성 파일이 포함되어 있으면 시각적 표시 추가
        const hasActiveFile = this.checkHasActiveFile(group, activeFile);

        if (group.collapsed) {
            section.addClass('is-collapsed');
            if (hasActiveFile) {
                section.addClass('has-active-card');
            }
        }

        // 섹션 헤더 (이름이 비어있으면 헤더 숨김)
        if (group.name) {
            const header = this.createGroupHeader(group, onToggle, onSelectAll, true);
            section.appendChild(header);
        }

        // 카드 컨테이너 (직계 파일용)
        const cardContainer = section.createEl('div', {
            cls: 'card-group-content'
        });
        cardContainer.dataset.groupId = group.id;

        // ⭐ Phase 4: 자식 그룹 컨테이너
        if (group.children && group.children.length > 0) {
            const childrenContainer = section.createEl('div', {
                cls: 'card-group-children'
            });
            childrenContainer.dataset.parentId = group.id;

            // 부모가 접히면 자식 컨테이너도 숨김
            if (group.collapsed) {
                childrenContainer.style.display = 'none';
            }
        }

        return section;
    }

    /**
     * 그룹(및 하위 그룹)에 활성 파일이 포함되어 있는지 확인합니다
     *
     * @param group - 그룹 데이터
     * @param activeFile - 활성 파일
     * @returns 활성 파일 포함 여부
     */
    private checkHasActiveFile(
        group: CardGroup,
        activeFile?: { path: string } | null
    ): boolean {
        if (!activeFile) return false;

        // 직계 파일 확인
        if (group.files.some(file => file.path === activeFile.path)) {
            return true;
        }

        // 자식 그룹 재귀 확인
        if (group.children) {
            for (const child of group.children) {
                if (this.checkHasActiveFile(child, activeFile)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 계층 구조 그룹을 토글합니다
     *
     * @remarks
     * Phase 4: 부모 그룹 접힘 시 자식 그룹도 함께 숨깁니다.
     * ⭐ Phase 2 최적화: 재귀 호출 제거, 반복문 기반으로 변경
     *
     * @param section - 그룹 섹션 요소
     * @param collapsed - 접힌 상태
     * @param container - 전체 컨테이너 (자식 그룹 처리용)
     */
    toggleHierarchicalGroup(
        section: HTMLElement,
        collapsed: boolean,
        container: HTMLElement
    ): void {
        // 기본 토글 동작
        this.toggleGroup(section, collapsed);

        const groupId = section.dataset.groupId;
        if (!groupId) return;

        // 자식 그룹 컨테이너 토글
        const childrenContainer = section.querySelector('.card-group-children') as HTMLElement;
        if (childrenContainer) {
            childrenContainer.style.display = collapsed ? 'none' : '';
        }

        // ⭐ Phase 2 최적화: 새로운 메서드 사용
        if (collapsed) {
            // 접을 때: 단일 쿼리로 모든 후손 숨김
            this.hideAllDescendants(groupId, container);
        } else {
            // 펼칠 때: 직접 자식만 표시 (자식의 접힘 상태 고려)
            this.showDirectChildren(groupId, container);
        }
    }

    /**
     * 모든 후손 그룹을 숨깁니다 (반복문 기반)
     *
     * @remarks
     * ⭐ Phase 2 최적화: 재귀적 querySelectorAll → 단일 쿼리 + 반복문
     * - 기존: O(d × h) - 계층 깊이만큼 DOM 쿼리 반복
     * - 개선: O(d) - 단일 DOM 쿼리로 모든 후손 처리
     *
     * @param groupId - 부모 그룹 ID
     * @param container - 전체 컨테이너
     */
    private hideAllDescendants(groupId: string, container: HTMLElement): void {
        // 단일 쿼리로 parentId가 있는 모든 섹션 수집
        const allSections = container.querySelectorAll(
            '.card-group-section[data-parent-id]'
        ) as NodeListOf<HTMLElement>;

        // 후손 ID를 추적하는 Set (초기값: 시작 그룹 ID)
        const descendantIds = new Set<string>([groupId]);

        // 단일 순회로 모든 후손 처리
        allSections.forEach(section => {
            const parentId = section.dataset.parentId;
            if (parentId && descendantIds.has(parentId)) {
                section.style.display = 'none';
                const sectionId = section.dataset.groupId;
                if (sectionId) {
                    descendantIds.add(sectionId);
                }
            }
        });
    }

    /**
     * 직접 자식 그룹만 표시합니다
     *
     * @remarks
     * ⭐ Phase 2 최적화: 펼칠 때 직접 자식만 표시하고,
     * 자식이 접혀있으면 그 후손은 숨김 상태 유지
     *
     * @param groupId - 부모 그룹 ID
     * @param container - 전체 컨테이너
     */
    private showDirectChildren(groupId: string, container: HTMLElement): void {
        const childSections = container.querySelectorAll(
            `.card-group-section[data-parent-id="${groupId}"]`
        ) as NodeListOf<HTMLElement>;

        childSections.forEach(childSection => {
            childSection.style.display = '';
            const childId = childSection.dataset.groupId;
            // 자식이 접혀있으면 그 후손은 숨김 유지
            if (childId && this.stateManager?.getCollapsed(childId)) {
                this.hideAllDescendants(childId, container);
            }
        });
    }

    /**
     * 자식 그룹 컨테이너를 찾습니다
     *
     * @param section - 그룹 섹션 요소
     * @returns 자식 그룹 컨테이너 또는 null
     */
    findChildrenContainer(section: HTMLElement): HTMLElement | null {
        return section.querySelector('.card-group-children') as HTMLElement | null;
    }

    /**
     * 특정 그룹의 모든 자식 섹션을 찾습니다
     *
     * @param container - 전체 컨테이너
     * @param parentId - 부모 그룹 ID
     * @returns 자식 섹션 배열
     */
    findChildSections(container: HTMLElement, parentId: string): HTMLElement[] {
        return Array.from(
            container.querySelectorAll(`.card-group-section[data-parent-id="${parentId}"]`)
        ) as HTMLElement[];
    }
}

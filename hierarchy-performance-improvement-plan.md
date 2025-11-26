# 계층 구조 성능 개선 계획

## 개요

Card Navigator 플러그인의 계층 구조 구현에 대한 성능 검토 결과를 바탕으로 작성된 개선 계획입니다.

### 검토 일자
2025-11-26

### 검토 범위
- ContextBar.ts - 계층 경로 표시 및 드롭다운 네비게이션
- GroupRenderer.ts - 계층 UI 렌더링
- GroupingManager.ts - 계층 구조 생성 및 관리
- GroupStateManager.ts - 계층 상태 관리
- FolderMode.ts - 폴더 기반 파일 필터링

---

## 현재 구현 상태 평가

### 잘 구현된 부분

| 구성 요소 | 구현 내용 | 평가 |
|----------|---------|------|
| GroupStateManager | 디바운스(500ms) + 메모리 캐시 | ✅ 우수 |
| buildHierarchy() | Map 기반 O(n) 트리 구축 | ✅ 우수 |
| expandAncestors() | Map을 활용한 O(1) 부모 조회 | ✅ 우수 |
| flattenHierarchy() | collapsed 필터링으로 불필요한 순회 방지 | ✅ 우수 |
| calculateTotalFileCounts() | 재귀적 계산 (일반적 깊이에서 안전) | ✅ 양호 |

### 개선이 필요한 부분

| 구성 요소 | 문제점 | 현재 복잡도 | 목표 복잡도 | 우선순위 |
|----------|-------|------------|------------|---------|
| ContextBar.isParentCollapsed() | 재귀적 Array.find() 호출 | O(n × h) | O(h) | 높음 |
| GroupRenderer.hideDescendants() | 재귀적 DOM querySelectorAll | O(d × h) | O(d) | 중간 |
| getAllFolders()/getAllTags() | hasChildren 계산 시 전체 순회 | O(n²) | O(n) | 중간 |
| FolderMode.getFiles() | 캐싱 없이 매번 재귀 탐색 | O(f) | O(1) 캐시 히트 | 낮음 |

> **범례**: n = 그룹 수, h = 계층 깊이, d = DOM 노드 수, f = 파일 수

---

## 개선 계획

### Phase 1: ContextBar 최적화 (우선순위: 높음)

#### 문제 분석

`isParentCollapsed()` 함수가 부모 그룹을 찾을 때 `Array.find()`를 사용하여 매번 전체 배열을 순회합니다.

```typescript
// 현재 코드 (ContextBar.ts:329)
const parent = this.groupList.find(g => g.id === group.parentId);
```

드롭다운 렌더링 시 모든 그룹에 대해 이 함수가 호출되므로, 그룹 수가 많을 때 O(n × h) 복잡도로 성능 저하가 발생합니다.

#### 개선 방안

Map을 도입하여 그룹 조회를 O(1)로 개선합니다.

```typescript
// 클래스 필드 추가
private groupListMap: Map<string, GroupListItem> = new Map();

// updateGroupList()에서 Map 생성
updateGroupList(groups: GroupListItem[], activeGroupId?: string): void {
    this.groupList = groups.map(g => ({
        ...g,
        isActive: g.id === activeGroupId
    }));

    // Map 생성 추가
    this.groupListMap = new Map(this.groupList.map(g => [g.id, g]));

    this.updateToggleButtonsVisibility();

    if (this.isDropdownOpen) {
        this.renderDropdownContent();
    }
}

// isParentCollapsed()에서 Map 사용
private isParentCollapsed(group: GroupListItem): boolean {
    if (!group.parentId) return false;

    if (this.collapsedGroups.has(group.parentId)) {
        return true;
    }

    const parent = this.groupListMap.get(group.parentId); // O(1) 조회
    if (parent) {
        return this.isParentCollapsed(parent);
    }

    return false;
}

// destroy()에서 정리
destroy(): void {
    // ... 기존 코드 ...
    this.groupListMap.clear();
}
```

#### 예상 효과

| 시나리오 | 현재 | 개선 후 |
|---------|------|--------|
| 100개 그룹, 깊이 5 | ~500회 비교 | ~5회 조회 |
| 500개 그룹, 깊이 10 | ~5000회 비교 | ~10회 조회 |

---

### Phase 2: GroupRenderer DOM 쿼리 최적화 (우선순위: 중간)

#### 문제 분석

`hideDescendants()`가 재귀적으로 `querySelectorAll()`을 호출하여 DOM 전체를 반복 탐색합니다.

```typescript
// 현재 코드 (GroupRenderer.ts:411-417)
private hideDescendants(section: HTMLElement, container: HTMLElement): void {
    const groupId = section.dataset.groupId;
    if (!groupId) return;

    const descendants = container.querySelectorAll(
        `.card-group-section[data-parent-id="${groupId}"]`
    ) as NodeListOf<HTMLElement>;

    descendants.forEach(descendant => {
        descendant.style.display = 'none';
        this.hideDescendants(descendant, container); // 재귀 호출
    });
}
```

#### 개선 방안

반복문 기반으로 변경하여 단일 DOM 쿼리로 처리합니다.

```typescript
toggleHierarchicalGroup(
    section: HTMLElement,
    collapsed: boolean,
    container: HTMLElement
): void {
    this.toggleGroup(section, collapsed);

    const groupId = section.dataset.groupId;
    if (!groupId) return;

    // 자식 컨테이너 토글
    const childrenContainer = section.querySelector('.card-group-children') as HTMLElement;
    if (childrenContainer) {
        childrenContainer.style.display = collapsed ? 'none' : '';
    }

    if (collapsed) {
        // 단일 쿼리로 모든 후손 수집 후 필터링
        this.hideAllDescendants(groupId, container);
    } else {
        // 직접 자식만 표시 (자체 접힘 상태 고려)
        this.showDirectChildren(groupId, container);
    }
}

/**
 * 모든 후손 그룹을 숨깁니다 (반복문 기반)
 */
private hideAllDescendants(groupId: string, container: HTMLElement): void {
    const allSections = container.querySelectorAll(
        '.card-group-section[data-parent-id]'
    ) as NodeListOf<HTMLElement>;

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
 */
private showDirectChildren(groupId: string, container: HTMLElement): void {
    const childSections = container.querySelectorAll(
        `.card-group-section[data-parent-id="${groupId}"]`
    ) as NodeListOf<HTMLElement>;

    childSections.forEach(childSection => {
        childSection.style.display = '';
        const childId = childSection.dataset.groupId;
        if (childId && this.stateManager?.getCollapsed(childId)) {
            // 자식이 접혀있으면 그 후손은 숨김 유지 (재귀 없이)
            this.hideAllDescendants(childId, container);
        }
    });
}
```

#### 예상 효과

| 시나리오 | 현재 | 개선 후 |
|---------|------|--------|
| 깊이 5 계층 접기 | 5회 querySelectorAll | 1회 querySelectorAll |
| 깊이 10 계층 접기 | 10회 querySelectorAll | 1회 querySelectorAll |

---

### Phase 3: GroupingManager hasChildren 계산 최적화 (우선순위: 중간)

#### 문제 분석

`getAllFolders()`와 `getAllTags()`에서 각 항목의 `hasChildren`을 계산할 때 전체 배열을 순회합니다.

```typescript
// 현재 코드 (GroupingManager.ts:866-875)
const hasChildren = Array.from(allFolderPaths).some(p => {
    if (p === folderPath) return false;
    if (folderPath === '/') {
        const pParts = p.split('/').filter(s => s);
        return pParts.length === 1;
    }
    return p.startsWith(folderPath + '/') &&
           p.split('/').length === folderPath.split('/').length + 1;
});
```

#### 개선 방안

사전에 자식 관계 Map을 구축하여 O(1) 조회로 변경합니다.

```typescript
getAllFolders(): { path: string; name: string; fileCount: number; level: number; hasChildren: boolean; parentId: string | null }[] {
    const folderMap = new Map<string, number>();
    const allFolderPaths = new Set<string>();

    // 모든 마크다운 파일의 폴더를 수집
    const markdownFiles = this.app.vault.getMarkdownFiles();
    for (const file of markdownFiles) {
        const folderPath = file.parent?.path || '/';
        folderMap.set(folderPath, (folderMap.get(folderPath) || 0) + 1);
        allFolderPaths.add(folderPath);

        // 중간 폴더들도 모두 추가
        if (folderPath !== '/') {
            const parts = folderPath.split('/');
            for (let i = 1; i < parts.length; i++) {
                const intermediatePath = parts.slice(0, i).join('/');
                if (intermediatePath && !allFolderPaths.has(intermediatePath)) {
                    allFolderPaths.add(intermediatePath);
                    if (!folderMap.has(intermediatePath)) {
                        folderMap.set(intermediatePath, 0);
                    }
                }
            }
        }
    }

    // ⭐ 개선: 자식 관계 Map 사전 구축 (O(n))
    const hasChildrenMap = new Map<string, boolean>();
    for (const folderPath of allFolderPaths) {
        if (folderPath === '/') continue;

        const parts = folderPath.split('/').filter(p => p);
        if (parts.length > 1) {
            const parentPath = parts.slice(0, -1).join('/');
            hasChildrenMap.set(parentPath, true);
        } else if (parts.length === 1) {
            hasChildrenMap.set('/', true);
        }
    }

    // 폴더 목록을 배열로 변환
    const folders: { ... }[] = [];

    for (const [folderPath, fileCount] of folderMap.entries()) {
        const parts = folderPath === '/' ? [] : folderPath.split('/').filter(p => p);
        const name = folderPath === '/' ? 'Root' : parts[parts.length - 1] || folderPath;
        const level = parts.length > 0 ? parts.length - 1 : 0;

        let parentPath: string | null = null;
        if (parts.length > 1) {
            parentPath = parts.slice(0, -1).join('/');
        } else if (parts.length === 1) {
            parentPath = '/';
        }

        // ⭐ 개선: O(1) 조회
        const hasChildren = hasChildrenMap.has(folderPath);

        folders.push({
            path: folderPath,
            name,
            fileCount,
            level,
            hasChildren,
            parentId: parentPath ? `folder-${parentPath}` : null
        });
    }

    folders.sort((a, b) => a.path.localeCompare(b.path));
    return folders;
}
```

동일한 패턴을 `getAllTags()`에도 적용합니다.

#### 예상 효과

| 시나리오 | 현재 | 개선 후 |
|---------|------|--------|
| 100개 폴더 | ~10,000회 비교 | ~200회 (Map 구축 + 조회) |
| 500개 폴더 | ~250,000회 비교 | ~1,000회 |

---

### Phase 4: FolderMode 파일 캐싱 (우선순위: 낮음)

#### 문제 분석

`getFiles()`가 매번 폴더를 재귀 탐색하여 파일 목록을 생성합니다.

```typescript
// 현재 코드 (FolderMode.ts:42-49)
getFiles(): TFile[] {
    const folder = this.getCurrentFolder();
    if (!isDefined(folder)) {
        return [];
    }
    return this.getFilesInFolder(folder);
}
```

#### 개선 방안

LRU 캐시를 도입하여 동일 폴더 조회 시 캐시된 결과를 반환합니다.

```typescript
import { LRUCache } from '../utils/memoize';

export class FolderMode {
    private app: App;
    private view: CardNavigatorView;

    // ⭐ 파일 목록 캐시 추가
    private fileCache: LRUCache<string, TFile[]>;
    private static readonly CACHE_SIZE = 50;

    constructor(app: App, view: CardNavigatorView) {
        this.app = app;
        this.view = view;
        this.fileCache = new LRUCache(FolderMode.CACHE_SIZE);
    }

    getFiles(): TFile[] {
        const folder = this.getCurrentFolder();
        if (!isDefined(folder)) {
            return [];
        }

        // 캐시 키: 폴더 경로 + 하위 폴더 포함 여부
        const cacheKey = `${folder.path}:${this.settings.includeSubfolders}`;

        // 캐시 조회
        const cached = this.fileCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // 캐시 미스: 계산 후 저장
        const files = this.getFilesInFolder(folder);
        this.fileCache.set(cacheKey, files);
        return files;
    }

    /**
     * 캐시 무효화 (파일 변경 시 호출)
     */
    invalidateCache(): void {
        this.fileCache.clear();
    }

    /**
     * 특정 폴더의 캐시만 무효화
     */
    invalidateFolderCache(folderPath: string): void {
        // 해당 폴더와 상위 폴더의 캐시 무효화
        const keysToDelete: string[] = [];
        // LRUCache에 keys() 메서드가 없으면 전체 clear() 사용
        this.fileCache.clear();
    }
}
```

#### 캐시 무효화 통합

메인 플러그인에서 파일 이벤트 발생 시 캐시를 무효화합니다.

```typescript
// main.ts 또는 CardNavigatorView.ts
this.registerEvent(
    this.app.vault.on('create', () => this.folderMode.invalidateCache())
);
this.registerEvent(
    this.app.vault.on('delete', () => this.folderMode.invalidateCache())
);
this.registerEvent(
    this.app.vault.on('rename', () => this.folderMode.invalidateCache())
);
```

#### 예상 효과

| 시나리오 | 현재 | 개선 후 |
|---------|------|--------|
| 동일 폴더 반복 조회 | 매번 O(f) 재귀 | O(1) 캐시 히트 |
| 폴더 변경 시 | O(f) | O(f) (캐시 미스) |

---

### Phase 5: active-leaf-change 이벤트 최적화 (우선순위: 높음)

#### 문제 분석

파일을 열 때 `active-leaf-change` 이벤트가 **중복으로 3회 발생**하는 현상이 확인되었습니다:

```
1. previousFile: 'A.md' → currentFile: 'A.md' (같은 파일 - 불필요)
2. previousFile: 'A.md' → currentFile: 'B.md' (실제 파일 변경)
3. previousFile: 'B.md' → currentFile: 'B.md' (같은 파일 - 불필요)
```

이로 인해 발생하는 문제:
1. **불필요한 작업 반복**: 같은 파일에 대한 이벤트도 모든 처리 로직을 통과
2. **Context Bar 업데이트 지연**: 렌더링 완료 후 즉시 207개 폴더 목록 조회
3. **Settings 패널 중복 호출**: `loadCurrentFileProperties()`가 매번 무조건 호출

#### 현재 코드 분석

**view.ts (라인 263-326)**
```typescript
this.app.workspace.on('active-leaf-change', async () => {
    // 같은 파일 체크는 있지만, 이미 여러 작업 수행 후에 체크됨
    const activeFile = this.app.workspace.getActiveFile();
    await this.plugin.presetManager.autoApplyPreset(activeFile); // 매번 호출

    const hasActiveFileChanged = this.state.hasFileChanged(activeFile);
    // ...
});
```

**InteractiveCardSettings.ts (라인 241-246)**
```typescript
this.plugin.app.workspace.on('active-leaf-change', () => {
    this.loadCurrentFileProperties(); // 무조건 호출 - 파일 변경 체크 없음
    // ...
});
```

**ViewRenderer.ts (라인 504)**
```typescript
// 렌더링 완료 직후 동기적으로 Context Bar 업데이트
this.updateContextBarGroupList(activeGroupId);
// 207개 폴더 목록 조회가 동기적으로 발생
```

#### 개선 방안

##### 5.1 view.ts - 조기 반환 최적화

```typescript
this.app.workspace.on('active-leaf-change', async () => {
    if (!isValidElement(this.cardsContainer)) {
        return;
    }

    if (this.state.getIsRendering()) {
        this.logger.debug('View', t().debug.view.renderingSkipped);
        return;
    }

    const activeFile = this.app.workspace.getActiveFile();

    // ⭐ 개선: 파일 변경 여부를 가장 먼저 체크하여 조기 반환
    const hasActiveFileChanged = this.state.hasFileChanged(activeFile);
    if (!hasActiveFileChanged) {
        this.logger.debug('View', t().debug.view.sameFileNoAction);
        return; // 같은 파일이면 아무 작업도 하지 않음
    }

    this.logger.debug('View', t().debug.view.activeLeafChange, {
        previousFile: this.state.getPreviousFile()?.path || 'none',
        currentFile: activeFile?.path || 'none'
    });

    // 파일이 실제로 변경되었을 때만 preset 적용
    await this.plugin.presetManager.autoApplyPreset(activeFile);

    // ... 나머지 로직
});
```

##### 5.2 InteractiveCardSettings.ts - 파일 변경 체크 추가

```typescript
// 클래스 필드 추가
private lastLoadedFilePath: string | null = null;

// 이벤트 핸들러 수정
this.plugin.app.workspace.on('active-leaf-change', () => {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    const currentPath = activeFile?.path || null;

    // ⭐ 개선: 같은 파일이면 스킵
    if (currentPath === this.lastLoadedFilePath) {
        return;
    }
    this.lastLoadedFilePath = currentPath;

    this.loadCurrentFileProperties();
    if (this.previewCard && this.plugin.settings[this.selectedSection].normalContent.contentType === 'property') {
        this.refreshPreviewCard();
    }
});
```

##### 5.3 Context Bar 업데이트 지연 (requestAnimationFrame)

```typescript
// ViewRenderer.ts - render 완료 후
private async updateContextBarAfterRender(activeGroupId?: string): Promise<void> {
    // ⭐ 개선: 렌더링 프레임 완료 후 Context Bar 업데이트
    requestAnimationFrame(() => {
        this.updateContextBarGroupList(activeGroupId);
    });
}

// 기존 render 메서드에서
this.logger.debug('View', t().debug.view.renderCompleted, { ... });

// 동기 호출 대신 비동기 호출
this.updateContextBarAfterRender(activeGroupId);
```

##### 5.4 이벤트 디바운싱 강화 (선택적)

```typescript
// view.ts
// 이미 디바운스된 forceRender가 있으므로, active-leaf-change에도 적용 가능
private debouncedActiveLeafChange = debounce(async () => {
    // 실제 처리 로직
}, 50); // 50ms 디바운스로 연속 이벤트 병합

this.app.workspace.on('active-leaf-change', () => {
    this.debouncedActiveLeafChange();
});
```

#### 예상 효과

| 시나리오 | 현재 | 개선 후 |
|---------|------|--------|
| 파일 열기 시 이벤트 처리 | 3회 전체 처리 | 1회만 처리 |
| loadCurrentFileProperties 호출 | 3회 | 1회 |
| Context Bar 업데이트 | 렌더링과 동기 | 렌더링 후 다음 프레임 |
| presetManager.autoApplyPreset | 3회 | 1회 |

#### 부가 효과: 에디터 깜빡임 감소

플러그인이 중복 이벤트에 반응하여 수행하는 작업이 줄어들면,
Obsidian 에디터의 DOM 재구성과 충돌하는 타이밍이 줄어들어
시각적 깜빡임이 감소할 수 있습니다.

---

## 구현 일정

| Phase | 작업 내용 | 예상 난이도 | 영향 범위 |
|-------|---------|------------|----------|
| Phase 1 | ContextBar Map 도입 | 낮음 | ContextBar.ts |
| Phase 2 | GroupRenderer DOM 최적화 | 중간 | GroupRenderer.ts |
| Phase 3 | hasChildren 계산 최적화 | 낮음 | GroupingManager.ts |
| Phase 4 | FolderMode 캐싱 | 중간 | FolderMode.ts, main.ts |
| **Phase 5** | **active-leaf-change 최적화** | **낮음** | **view.ts, InteractiveCardSettings.ts, ViewRenderer.ts** |

---

## 테스트 계획

### 성능 테스트 시나리오

1. **대규모 폴더 구조**
   - 100개 이상의 폴더
   - 10 레벨 이상의 깊이
   - 각 폴더에 50개 이상의 파일

2. **대규모 태그 구조**
   - 200개 이상의 태그
   - 중첩 태그 (#a/b/c/d/e)
   - 다중 태그 파일

3. **드롭다운 반복 조작**
   - 빠른 접기/펼치기 반복
   - 전체 접기/펼치기
   - 스크롤 성능

### 측정 항목

- 드롭다운 렌더링 시간
- 그룹 토글 응답 시간
- 메모리 사용량
- CPU 사용률

---

## 회귀 테스트 체크리스트

### 기존 기능 (Phase 1-4)

- [ ] 드롭다운 그룹 목록 정상 표시
- [ ] 계층 들여쓰기 정상 동작
- [ ] 그룹 접기/펼치기 정상 동작
- [ ] 부모 접힘 시 자식 숨김 정상 동작
- [ ] 전체 접기/펼치기 정상 동작
- [ ] 활성 파일 그룹으로 스크롤 정상 동작
- [ ] 그룹 상태 저장/복원 정상 동작
- [ ] 폴더 모드 파일 필터링 정상 동작
- [ ] 태그 모드 계층 구조 정상 동작

### Phase 5 추가 항목

- [ ] 파일 열기 시 카드 뷰 정상 업데이트
- [ ] 같은 파일 재선택 시 불필요한 재렌더링 없음
- [ ] 폴더 변경 시 Context Bar 정상 업데이트
- [ ] Settings 패널 열린 상태에서 파일 변경 시 정상 동작
- [ ] preset 자동 적용 정상 동작
- [ ] active 카드 클래스 정상 업데이트
- [ ] 빠른 연속 파일 전환 시 안정성

---

## 참고 자료

### 관련 파일

- [ContextBar.ts](../src/ui/ContextBar.ts)
- [GroupRenderer.ts](../src/grouping/GroupRenderer.ts)
- [GroupingManager.ts](../src/grouping/GroupingManager.ts)
- [GroupStateManager.ts](../src/grouping/GroupStateManager.ts)
- [FolderMode.ts](../src/modes/FolderMode.ts)
- [view.ts](../src/view.ts) - Phase 5 관련
- [ViewRenderer.ts](../src/view/ViewRenderer.ts) - Phase 5 관련
- [InteractiveCardSettings.ts](../src/ui/settings/InteractiveCardSettings.ts) - Phase 5 관련

### 관련 이슈

- 대규모 볼트에서의 성능 최적화
- 계층 구조 렌더링 개선
- 파일 열기 시 에디터 깜빡임 현상 (Phase 5)

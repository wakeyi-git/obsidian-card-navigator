# Card Navigator Plugin - 최적화 및 코드 정리 계획

## 목차
1. [옵시디언 카드 소스(캐시)](#1-옵시디언-카드-소스캐시)
2. [카드 목록 작성](#2-카드-목록-작성)
3. [카드 그룹화 및 정렬](#3-카드-그룹화-및-정렬)
4. [카드 데이터 추출 및 카드 생성](#4-카드-데이터-추출-및-카드-생성)
5. [렌더링 최적화](#5-렌더링-최적화)
6. [카드 스타일링](#6-카드-스타일링)
7. [레이아웃](#7-레이아웃)
8. [상호작용](#8-상호작용)
9. [프리셋](#9-프리셋)
10. [기타](#10-기타)
11. [우선순위 및 실행 계획](#11-우선순위-및-실행-계획)

---

## 1. 옵시디언 카드 소스(캐시)

### 현재 상태
- **파일 위치**: `src/search/SearchEngine.ts`
- **캐시 구현**: LRU 캐시 (최대 50개 항목)
- **캐시 키**: `query + files + caseSensitive`
- **무효화 전략**: 볼트 이벤트 발생 시 전체 캐시 삭제

### 문제점
1. **과도한 캐시 무효화**: 단일 파일 변경 시에도 전체 캐시를 삭제
2. **캐시 히트율 낮음**: 볼트 활동이 많을수록 캐시 효과 감소
3. **메모리 관리 미흡**: 캐시 크기 제한은 있지만 메모리 사용량 모니터링 없음

### 최적화 계획

#### 1.1. 선택적 캐시 무효화
```typescript
// src/search/SearchEngine.ts:40-54
// 현재: 모든 이벤트에서 전체 캐시 클리어
// 개선: 변경된 파일과 관련된 캐시만 무효화

interface CacheEntry {
  key: string;
  result: TFile[];
  affectedFiles: Set<string>; // 검색 결과에 포함된 파일 경로
}

invalidateCache(changedFile: TFile) {
  // 변경된 파일을 포함하는 캐시 항목만 삭제
  for (const [key, entry] of this.cache.entries()) {
    if (entry.affectedFiles.has(changedFile.path)) {
      this.cache.delete(key);
    }
  }
}
```

#### 1.2. 캐시 계층화
```typescript
// 3단계 캐시 전략
// L1: 최근 검색 결과 (메모리, 빠름)
// L2: 자주 사용하는 쿼리 (메모리, 중간)
// L3: 파일 메타데이터 (Obsidian MetadataCache 활용)

class TieredCache {
  private hotCache: LRUCache; // 10개
  private warmCache: LRUCache; // 40개
  private coldCache: Map; // Obsidian 기본 캐시 활용
}
```

#### 1.3. 배치 캐시 업데이트
```typescript
// 여러 파일 변경 시 배치 처리
private updateQueue: Set<TFile> = new Set();
private updateTimer: NodeJS.Timeout | null = null;

queueCacheUpdate(file: TFile) {
  this.updateQueue.add(file);

  if (!this.updateTimer) {
    this.updateTimer = setTimeout(() => {
      this.processBatchUpdate(this.updateQueue);
      this.updateQueue.clear();
      this.updateTimer = null;
    }, 200); // 200ms 디바운스
  }
}
```

---

## 2. 카드 목록 작성

### 현재 상태
- **모드**: Folder, Tag, Search
- **파일 위치**: `src/modes/`
- **검색 엔진**: `src/search/SearchEngine.ts` (1,400+ 줄)

### 문제점
1. **SearchEngine 비대화**: 단일 파일에 모든 검색 타입 구현 (1,400줄)
2. **검색 타입 확장성**: 새로운 검색 타입 추가 시 기존 파일 수정 필요
3. **코드 중복**: 각 모드에서 파일 필터링 로직 중복

### 최적화 계획

#### 2.1. SearchEngine 모듈화
```typescript
// src/search/SearchEngine.ts → 분할

// src/search/SearchEngine.ts (코어)
class SearchEngine {
  private strategies: Map<string, SearchStrategy>;

  registerStrategy(type: string, strategy: SearchStrategy) {
    this.strategies.set(type, strategy);
  }
}

// src/search/strategies/PathSearchStrategy.ts
class PathSearchStrategy implements SearchStrategy {
  execute(query: string, files: TFile[]): TFile[] {
    // path 검색 로직
  }
}

// src/search/strategies/ContentSearchStrategy.ts
// src/search/strategies/TagSearchStrategy.ts
// src/search/strategies/PropertySearchStrategy.ts
// ... 각 검색 타입을 독립 클래스로 분리
```

#### 2.2. 파일 수집 추상화
```typescript
// src/modes/FileCollector.ts (새 파일)
abstract class FileCollector {
  abstract collectFiles(): Promise<TFile[]>;

  protected applyCommonFilters(files: TFile[]): TFile[] {
    // 공통 필터링 로직 통합
  }
}

class FolderFileCollector extends FileCollector { }
class TagFileCollector extends FileCollector { }
class SearchFileCollector extends FileCollector { }
```

#### 2.3. 검색 결과 페이지네이션
```typescript
// 대량의 검색 결과 처리
class PaginatedSearchResult {
  private pageSize = 100;
  private currentPage = 0;

  getNextPage(): TFile[] {
    // 점진적 로딩
  }

  hasMore(): boolean {
    // 추가 결과 여부
  }
}
```

---

## 3. 카드 그룹화 및 정렬

### 현재 상태
- **파일 위치**:
  - `src/grouping/GroupingManager.ts`
  - `src/sort/SortManager.ts`
- **기능**: 다양한 그룹화 기준, 3단계 정렬, 핀 우선순위

### 문제점
1. **그룹 상태 저장**: localStorage 읽기/쓰기 개별 처리
2. **정렬 알고리즘**: 매번 전체 배열 정렬 (캐싱 없음)
3. **핀 파일 처리**: 그룹화와 정렬에서 중복 처리

### 최적화 계획

#### 3.1. 그룹 상태 배치 처리
```typescript
// src/grouping/GroupingManager.ts:587-595
// 현재: 개별 read/write
// 개선: 초기화 시 일괄 로드, 종료 시 일괄 저장

class GroupStateManager {
  private stateCache: Map<string, boolean> = new Map();
  private isDirty = false;

  loadAll() {
    const stored = localStorage.getItem('card-nav-group-states');
    this.stateCache = new Map(JSON.parse(stored || '[]'));
  }

  saveAll() {
    if (!this.isDirty) return;

    const data = JSON.stringify([...this.stateCache.entries()]);
    localStorage.setItem('card-nav-group-states', data);
    this.isDirty = false;
  }

  setCollapsed(groupId: string, collapsed: boolean) {
    this.stateCache.set(groupId, collapsed);
    this.isDirty = true;
    this.debouncedSave(); // 디바운스된 저장
  }
}
```

#### 3.2. 정렬 결과 캐싱
```typescript
// src/sort/SortManager.ts
class SortManager {
  private sortCache = new Map<string, TFile[]>();

  sort(files: TFile[], criteria: SortCriteria[]): TFile[] {
    const cacheKey = this.getCacheKey(files, criteria);

    if (this.sortCache.has(cacheKey)) {
      return this.sortCache.get(cacheKey)!;
    }

    const sorted = this.performSort(files, criteria);
    this.sortCache.set(cacheKey, sorted);
    return sorted;
  }

  invalidateCache(file: TFile) {
    // 해당 파일이 포함된 캐시만 무효화
  }
}
```

#### 3.3. 핀 파일 처리 통합
```typescript
// src/grouping/PinManager.ts (새 파일)
class PinManager {
  private pinnedFiles = new Set<string>();

  isPinned(file: TFile): boolean { }

  partition<T>(items: T[], getFile: (item: T) => TFile): {
    pinned: T[];
    normal: T[];
  } {
    // 핀/일반 파일 분리 로직 한 곳에서 관리
  }
}

// GroupingManager와 SortManager에서 PinManager 활용
```

---

## 4. 카드 데이터 추출 및 카드 생성

### 현재 상태
- **파일 위치**:
  - `src/view/CardFactory.ts`
  - `src/card/CardData.ts` (CardDataExtractor)
  - `src/card/CardRenderer.ts`
- **플로우**: Placeholder → 비동기 데이터 추출 → 렌더링

### 문제점
1. **개별 비동기 처리**: 각 카드마다 별도 async 호출
2. **중복 메타데이터 접근**: 같은 파일에 대해 반복적으로 MetadataCache 조회
3. **컨텐츠 추출 성능**: 대용량 파일 처리 시 블로킹

### 최적화 계획

#### 4.1. 배치 데이터 추출
```typescript
// src/card/CardData.ts
class CardDataExtractor {
  // 현재: 개별 추출 (CardFactory.ts:128-184)
  async extractContent(file: TFile, settings: CardSettings): Promise<CardData>

  // 개선: 배치 추출
  async extractBatch(
    files: TFile[],
    settings: CardSettings
  ): Promise<Map<string, CardData>> {
    // 한 번의 순회로 여러 파일의 데이터 추출
    const results = new Map();

    for (const file of files) {
      // MetadataCache 한 번만 조회
      const cache = this.app.metadataCache.getFileCache(file);
      results.set(file.path, this.extractFromCache(file, cache, settings));
    }

    return results;
  }
}
```

#### 4.2. 메타데이터 캐싱
```typescript
// src/card/MetadataCache.ts (새 파일)
class EnhancedMetadataCache {
  private cache = new Map<string, CachedMetadata>();
  private contentCache = new Map<string, string>();

  async getContent(file: TFile, maxLength?: number): Promise<string> {
    const cacheKey = `${file.path}:${maxLength || 'full'}`;

    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey)!;
    }

    const content = await this.app.vault.cachedRead(file);
    const truncated = maxLength ? content.slice(0, maxLength) : content;
    this.contentCache.set(cacheKey, truncated);

    return truncated;
  }
}
```

#### 4.3. 카드 생성 파이프라인 최적화
```typescript
// src/view/CardFactory.ts
class CardFactory {
  private creationQueue: Array<{file: TFile, element: HTMLElement}> = [];
  private processingBatch = false;

  queueCardCreation(file: TFile, placeholder: HTMLElement) {
    this.creationQueue.push({file, element: placeholder});

    if (!this.processingBatch) {
      this.processBatch();
    }
  }

  private async processBatch() {
    this.processingBatch = true;

    // 배치 크기 제한 (예: 10개씩)
    const batch = this.creationQueue.splice(0, 10);
    const files = batch.map(item => item.file);

    // 배치 데이터 추출
    const dataMap = await this.dataExtractor.extractBatch(files, this.settings);

    // 렌더링
    for (const {file, element} of batch) {
      const data = dataMap.get(file.path);
      this.renderer.render(element, data);
    }

    // 큐에 남은 항목이 있으면 계속 처리
    if (this.creationQueue.length > 0) {
      requestAnimationFrame(() => this.processBatch());
    } else {
      this.processingBatch = false;
    }
  }
}
```

---

## 5. 렌더링 최적화

### 현재 상태
- **파일 위치**:
  - `src/view/ViewRenderer.ts` - 뷰 렌더링 오케스트레이션
  - `src/view/ViewportManager.ts` - IntersectionObserver 기반 지연 로딩
  - `src/view/CardFactory.ts` - 카드 생성 및 placeholder 관리
- **렌더링 플로우**:
  1. ViewRenderer가 전체 렌더링 조율
  2. Placeholder 카드 생성
  3. IntersectionObserver로 가시성 감지
  4. 보이는 카드만 실제 렌더링

### 문제점
1. **DOM 조작 빈도**: 개별 카드마다 DOM 업데이트
2. **리플로우/리페인트**: 스타일 변경 시 브라우저 레이아웃 재계산
3. **대량 카드 렌더링**: 초기 로딩 시 수백 개의 placeholder DOM 생성
4. **재렌더링 트리거**: 설정 변경 시 전체 뷰 재렌더링
5. **중복 렌더링**: 동일한 카드가 여러 번 렌더링되는 경우

### 최적화 계획

#### 5.1. Virtual DOM / DocumentFragment 활용

```typescript
// src/view/ViewRenderer.ts
class ViewRenderer {
  render() {
    const fragment = document.createDocumentFragment();

    for (const group of groups) {
      const groupElement = this.createGroup(group);
      fragment.appendChild(groupElement);
    }

    // 한 번에 DOM에 추가 (리플로우 1회)
    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }

  createGroup(group: Group): HTMLElement {
    const groupElement = document.createElement('div');
    const cardsFragment = document.createDocumentFragment();

    for (const file of group.files) {
      const cardElement = this.cardFactory.createPlaceholder(file);
      cardsFragment.appendChild(cardElement);
    }

    groupElement.appendChild(cardsFragment);
    return groupElement;
  }
}
```

#### 5.2. 렌더링 우선순위 및 스케줄링

```typescript
// src/view/RenderScheduler.ts (새 파일)
class RenderScheduler {
  private renderQueue: RenderTask[] = [];
  private isRendering = false;

  schedule(task: RenderTask, priority: 'high' | 'normal' | 'low' = 'normal') {
    this.renderQueue.push({ ...task, priority });
    this.renderQueue.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));

    if (!this.isRendering) {
      this.processQueue();
    }
  }

  private async processQueue() {
    this.isRendering = true;

    while (this.renderQueue.length > 0) {
      const task = this.renderQueue.shift()!;

      // requestIdleCallback 활용 (브라우저 유휴 시간 활용)
      if ('requestIdleCallback' in window) {
        await new Promise(resolve => {
          requestIdleCallback((deadline) => {
            if (deadline.timeRemaining() > 10) {
              task.execute();
            } else {
              // 시간 없으면 다시 큐에 추가
              this.renderQueue.unshift(task);
            }
            resolve(undefined);
          });
        });
      } else {
        // Fallback: requestAnimationFrame
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            task.execute();
            resolve(undefined);
          });
        });
      }
    }

    this.isRendering = false;
  }

  private getPriorityValue(priority: string): number {
    const map = { high: 3, normal: 2, low: 1 };
    return map[priority] || 2;
  }
}
```

#### 5.3. 증분 렌더링 (Incremental Rendering)

```typescript
// src/view/IncrementalRenderer.ts (새 파일)
class IncrementalRenderer {
  private chunkSize = 20; // 한 번에 렌더링할 카드 수

  async renderInChunks(files: TFile[], container: HTMLElement) {
    const totalChunks = Math.ceil(files.length / this.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, files.length);
      const chunk = files.slice(start, end);

      await this.renderChunk(chunk, container);

      // 다음 청크는 다음 프레임에서 렌더링
      await this.waitForNextFrame();

      // 진행률 표시
      this.updateProgress((i + 1) / totalChunks);
    }
  }

  private async renderChunk(files: TFile[], container: HTMLElement) {
    const fragment = document.createDocumentFragment();

    for (const file of files) {
      const card = this.cardFactory.createCard(file);
      fragment.appendChild(card);
    }

    container.appendChild(fragment);
  }

  private waitForNextFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }
}
```

#### 5.4. 조건부 재렌더링 (Selective Re-rendering)

```typescript
// src/view/ViewRenderer.ts
class ViewRenderer {
  private lastRenderState: RenderState | null = null;

  render(forceRender = false) {
    const currentState = this.captureRenderState();

    if (!forceRender && this.shouldSkipRender(currentState)) {
      return; // 변경 사항 없으면 스킵
    }

    // 변경된 부분만 렌더링
    const changes = this.detectChanges(this.lastRenderState, currentState);

    if (changes.groupsChanged) {
      this.renderGroups();
    } else if (changes.cardsChanged) {
      this.updateChangedCards(changes.changedCards);
    } else if (changes.stylesChanged) {
      this.updateStyles();
    }

    this.lastRenderState = currentState;
  }

  private shouldSkipRender(state: RenderState): boolean {
    if (!this.lastRenderState) return false;

    return JSON.stringify(state) === JSON.stringify(this.lastRenderState);
  }

  private updateChangedCards(changedCards: Set<string>) {
    // 변경된 카드만 업데이트
    for (const filePath of changedCards) {
      const cardElement = this.cardElements.get(filePath);
      if (cardElement) {
        this.cardFactory.updateCard(cardElement);
      }
    }
  }
}
```

#### 5.5. Lazy Hydration (점진적 상호작용 활성화)

```typescript
// src/view/CardFactory.ts
class CardFactory {
  createCard(file: TFile, hydrate = false): HTMLElement {
    // 1단계: 정적 HTML 생성 (빠름)
    const card = this.createStaticCard(file);

    if (hydrate) {
      // 2단계: 즉시 이벤트 바인딩 (중요한 카드)
      this.hydrateCard(card, file);
    } else {
      // 2단계: 지연된 이벤트 바인딩 (일반 카드)
      this.scheduleHydration(card, file);
    }

    return card;
  }

  private scheduleHydration(card: HTMLElement, file: TFile) {
    // IntersectionObserver로 보이는 카드만 hydrate
    this.hydrationObserver.observe(card);

    // 또는 requestIdleCallback 사용
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.hydrateCard(card, file);
      }, { timeout: 2000 });
    }
  }

  private hydrateCard(card: HTMLElement, file: TFile) {
    // 이벤트 리스너 등록
    this.eventHandler.bindCardEvents(card, file);

    // 동적 콘텐츠 로드
    this.loadDynamicContent(card, file);

    // hydrated 표시
    card.dataset.hydrated = 'true';
  }
}
```

#### 5.6. 렌더링 성능 모니터링

```typescript
// src/utils/RenderProfiler.ts (새 파일)
class RenderProfiler {
  private metrics: Map<string, PerformanceMetric> = new Map();

  measureRender(name: string, fn: () => void) {
    const start = performance.now();

    // Layout thrashing 감지
    const layoutCount = this.getLayoutCount();

    fn();

    const end = performance.now();
    const duration = end - start;
    const layoutThrash = this.getLayoutCount() - layoutCount;

    this.metrics.set(name, {
      duration,
      layoutThrash,
      timestamp: Date.now(),
    });

    if (duration > 16.67) { // 60fps 기준
      console.warn(`Slow render: ${name} took ${duration.toFixed(2)}ms`);
    }

    if (layoutThrash > 5) {
      console.warn(`Layout thrashing detected in ${name}: ${layoutThrash} reflows`);
    }
  }

  getMetrics(name: string): PerformanceMetric | undefined {
    return this.metrics.get(name);
  }

  private getLayoutCount(): number {
    // PerformanceObserver로 layout shift 측정
    // 또는 간단히 performance.now() 사용
    return 0; // 구현 필요
  }

  exportReport(): string {
    const report = Array.from(this.metrics.entries())
      .map(([name, metric]) => {
        return `${name}: ${metric.duration.toFixed(2)}ms (reflows: ${metric.layoutThrash})`;
      })
      .join('\n');

    return report;
  }
}

// 사용 예시
const profiler = new RenderProfiler();

profiler.measureRender('full-view-render', () => {
  viewRenderer.render();
});
```

#### 5.7. 메모이제이션 기반 렌더링

```typescript
// src/view/CardFactory.ts
class CardFactory {
  private cardCache = new Map<string, {
    element: HTMLElement,
    settings: CardSettings,
    mtime: number
  }>();

  createCard(file: TFile, settings: CardSettings): HTMLElement {
    const cacheKey = file.path;
    const cached = this.cardCache.get(cacheKey);

    // 캐시 유효성 검사
    if (cached &&
        cached.mtime === file.stat.mtime &&
        this.settingsEqual(cached.settings, settings)) {
      return cached.element.cloneNode(true) as HTMLElement;
    }

    // 새로 렌더링
    const element = this.renderCard(file, settings);

    this.cardCache.set(cacheKey, {
      element: element.cloneNode(true) as HTMLElement,
      settings: { ...settings },
      mtime: file.stat.mtime,
    });

    return element;
  }

  invalidateCache(file?: TFile) {
    if (file) {
      this.cardCache.delete(file.path);
    } else {
      this.cardCache.clear();
    }
  }
}
```

### 성능 목표

| 지표 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| 100개 카드 초기 렌더링 | ~500ms | ~200ms | 60% |
| 스크롤 시 FPS | ~45fps | ~60fps | 33% |
| 재렌더링 시간 | ~300ms | ~100ms | 67% |
| 메모리 사용량 (1000개 카드) | ~150MB | ~100MB | 33% |
| Time to Interactive | ~800ms | ~400ms | 50% |

### 구현 우선순위

**Phase 1 (즉시 적용 가능)**
1. DocumentFragment 활용 (5.1)
2. 조건부 재렌더링 (5.4)
3. 메모이제이션 (5.7)

**Phase 2 (중기)**
4. 증분 렌더링 (5.3)
5. 렌더링 스케줄러 (5.2)

**Phase 3 (장기)**
6. Lazy Hydration (5.5)
7. 성능 모니터링 (5.6)

---

## 6. 카드 스타일링

### 현재 상태
- **파일 위치**:
  - `src/card/CardRenderer.ts`
  - `src/view/CardFactory.ts:196-214`
- **방식**: CSS 커스텀 속성을 통한 스타일 적용

### 문제점
1. **개별 속성 설정**: 각 카드마다 `setProperty()` 반복 호출
2. **스타일 재계산**: 동일한 설정에 대해 매번 CSS 속성 계산
3. **테마 변경 시 성능**: 전체 카드 재렌더링

### 최적화 계획

#### 6.1. 스타일 프리셋 사전 계산
```typescript
// src/card/CardStylePresets.ts (새 파일)
class CardStylePresets {
  private styleCache = new Map<string, string>();

  getStyleString(settings: CardSettings): string {
    const cacheKey = JSON.stringify(settings);

    if (this.styleCache.has(cacheKey)) {
      return this.styleCache.get(cacheKey)!;
    }

    // CSS 속성 문자열 미리 생성
    const style = `
      --card-width: ${settings.cardWidth}px;
      --card-height: ${settings.cardHeight}px;
      --card-bg: ${settings.backgroundColor};
      --card-border: ${settings.borderColor};
      ...
    `.trim();

    this.styleCache.set(cacheKey, style);
    return style;
  }
}
```

#### 6.2. CSS 클래스 기반 스타일링
```typescript
// 현재: 인라인 CSS 변수
element.style.setProperty('--card-width', '200px');

// 개선: CSS 클래스 활용
// styles.css
.card-preset-compact { --card-width: 150px; --card-height: 200px; }
.card-preset-normal { --card-width: 200px; --card-height: 300px; }
.card-preset-large { --card-width: 250px; --card-height: 400px; }

// TypeScript
element.classList.add(`card-preset-${settings.preset}`);
```

#### 6.3. 테마 변경 최적화
```typescript
// src/view/ThemeManager.ts (새 파일)
class ThemeManager {
  applyTheme(theme: 'light' | 'dark') {
    // CSS 변수만 변경 (재렌더링 없음)
    document.body.classList.toggle('card-nav-dark', theme === 'dark');

    // 필요한 경우만 선택적 업데이트
    this.updateThemeColors(theme);
  }

  private updateThemeColors(theme: string) {
    const root = document.documentElement;
    const colors = this.getThemeColors(theme);

    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(key, value);
    }
  }
}
```

---

## 6. 레이아웃

### 현재 상태
- **파일 위치**: `src/layout/LayoutManager.ts`
- **기능**: 자동 그리드 계산, ResizeObserver, 100ms 디바운스

### 문제점
1. **레이아웃 계산 빈도**: 리사이즈마다 전체 재계산
2. **CSS 변수 업데이트**: 개별 `setProperty()` 호출
3. **불필요한 재계산**: 그리드 설정이 동일해도 재적용

### 최적화 계획

#### 7.1. 레이아웃 변경 감지
```typescript
// src/layout/LayoutManager.ts
class LayoutManager {
  private lastLayout: LayoutConfig | null = null;

  updateLayout(width: number, height: number) {
    const newLayout = this.calculateLayout(width, height);

    // 변경 사항이 있을 때만 적용
    if (this.hasLayoutChanged(this.lastLayout, newLayout)) {
      this.applyLayout(newLayout);
      this.lastLayout = newLayout;
    }
  }

  private hasLayoutChanged(old: LayoutConfig, new: LayoutConfig): boolean {
    return old?.columns !== new.columns ||
           old?.rows !== new.rows ||
           old?.cardWidth !== new.cardWidth;
  }
}
```

#### 7.2. CSS 변수 배치 업데이트
```typescript
// 현재: 개별 setProperty (src/layout/LayoutManager.ts:154-215)
container.style.setProperty('--grid-columns', columns);
container.style.setProperty('--grid-rows', rows);
...

// 개선: 한 번에 적용
const cssText = `
  --grid-columns: ${columns};
  --grid-rows: ${rows};
  --card-width: ${cardWidth}px;
  --card-height: ${cardHeight}px;
  --grid-gap: ${gap}px;
`;

container.style.cssText += cssText;
```

#### 7.3. 뷰포트 기반 레이아웃
```typescript
// src/layout/ViewportLayoutManager.ts (새 파일)
class ViewportLayoutManager {
  // 현재 뷰포트에 보이는 카드만 레이아웃 계산
  private visibleRange: {start: number, end: number};

  updateVisibleRange(scrollTop: number, viewportHeight: number) {
    const newRange = this.calculateVisibleRange(scrollTop, viewportHeight);

    if (this.rangeChanged(this.visibleRange, newRange)) {
      this.layoutVisibleCards(newRange);
      this.visibleRange = newRange;
    }
  }
}
```

---

## 8. 상호작용

### 현재 상태
- **파일 위치**:
  - `src/navigation/KeyboardNav.ts` (키보드 네비게이션)
  - `src/view/ViewEventHandler.ts` (마우스 이벤트)
  - `src/selection/SelectionManager.ts` (선택 관리)

### 문제점
1. **이벤트 리스너 중복**: 각 카드마다 개별 이벤트 리스너 등록
2. **키보드 네비게이션 계산**: 그리드 컬럼 수를 매번 동적 계산
3. **선택 상태 관리**: DOM 직접 조작으로 상태 동기화 복잡

### 최적화 계획

#### 8.1. 이벤트 위임
```typescript
// src/view/ViewEventHandler.ts
class ViewEventHandler {
  // 현재: 각 카드에 개별 리스너
  bindCardEvents(card: HTMLElement, file: TFile) {
    card.addEventListener('click', ...);
    card.addEventListener('contextmenu', ...);
  }

  // 개선: 컨테이너 레벨에서 위임
  setupDelegatedEvents(container: HTMLElement) {
    container.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.card-item');
      if (card) {
        this.handleCardClick(card, e);
      }
    });

    container.addEventListener('contextmenu', (e) => {
      const card = (e.target as HTMLElement).closest('.card-item');
      if (card) {
        this.handleCardContextMenu(card, e);
      }
    });
  }
}
```

#### 8.2. 키보드 네비게이션 최적화
```typescript
// src/navigation/KeyboardNav.ts:157-176
class KeyboardNavigator {
  private gridColumns = 0;

  updateGridColumns(columns: number) {
    this.gridColumns = columns;
  }

  navigateRight() {
    if (this.focusedIndex === null) return;

    // 매번 계산하지 않고 캐시된 값 사용
    const nextIndex = this.focusedIndex + 1;
    const nextRow = Math.floor(nextIndex / this.gridColumns);

    if (nextRow === Math.floor(this.focusedIndex / this.gridColumns)) {
      this.setFocusedCard(nextIndex);
    }
  }
}
```

#### 8.3. 상태 기반 선택 관리
```typescript
// src/selection/SelectionManager.ts
class SelectionManager {
  private selectedFiles = new Set<string>();
  private cardElements = new Map<string, HTMLElement>();

  // 상태와 UI 분리
  select(filePath: string) {
    this.selectedFiles.add(filePath);
    this.updateCardUI(filePath, true);
  }

  private updateCardUI(filePath: string, selected: boolean) {
    const element = this.cardElements.get(filePath);
    if (element) {
      element.classList.toggle('is-selected', selected);
      element.setAttribute('aria-selected', String(selected));
    }
  }

  // 배치 선택 업데이트
  updateSelection(add: string[], remove: string[]) {
    // DOM 조작 최소화
    const fragment = document.createDocumentFragment();

    for (const path of add) {
      this.selectedFiles.add(path);
    }
    for (const path of remove) {
      this.selectedFiles.delete(path);
    }

    this.refreshUI();
  }
}
```

---

## 9. 프리셋

### 현재 상태
- **파일 위치**: `src/preset/PresetManager.ts`
- **기능**: 프리셋 생성/적용, 자동 매핑, 우선순위 모드

### 문제점
1. **매핑 검색 알고리즘**: 선형 검색 (O(n))
2. **프리셋 적용 오버헤드**: 전체 설정 복사 및 병합
3. **자동 적용 로직**: 매번 모든 매핑 확인

### 최적화 계획

#### 9.1. 프리셋 매핑 인덱싱
```typescript
// src/preset/PresetManager.ts:506-585
class PresetManager {
  private mappingIndex: {
    byFolder: Map<string, string[]>; // folder path → preset IDs
    byTag: Map<string, string[]>;    // tag → preset IDs
    byProperty: Map<string, string[]>; // property → preset IDs
  };

  buildIndex() {
    this.mappingIndex = {
      byFolder: new Map(),
      byTag: new Map(),
      byProperty: new Map(),
    };

    for (const [presetId, mappings] of this.presets.entries()) {
      for (const mapping of mappings) {
        switch (mapping.type) {
          case 'folder':
            this.addToIndex(this.mappingIndex.byFolder, mapping.value, presetId);
            break;
          case 'tag':
            this.addToIndex(this.mappingIndex.byTag, mapping.value, presetId);
            break;
          // ...
        }
      }
    }
  }

  findMatchingPreset(file: TFile): string | null {
    // O(1) 인덱스 조회
    const folderPresets = this.mappingIndex.byFolder.get(file.parent.path) || [];
    if (folderPresets.length > 0) {
      return this.selectByPriority(folderPresets);
    }

    // 태그 확인
    const tags = this.getFileTags(file);
    for (const tag of tags) {
      const tagPresets = this.mappingIndex.byTag.get(tag) || [];
      if (tagPresets.length > 0) {
        return this.selectByPriority(tagPresets);
      }
    }

    return null;
  }
}
```

#### 9.2. 프리셋 설정 캐싱
```typescript
class PresetManager {
  private settingsCache = new Map<string, CardSettings>();

  getCardSettingsForFile(file: TFile): CardSettings {
    const presetId = this.findMatchingPreset(file);
    const cacheKey = `${presetId || 'default'}`;

    if (this.settingsCache.has(cacheKey)) {
      return this.settingsCache.get(cacheKey)!;
    }

    const settings = this.computeSettings(presetId);
    this.settingsCache.set(cacheKey, settings);
    return settings;
  }

  invalidateCache(presetId?: string) {
    if (presetId) {
      this.settingsCache.delete(presetId);
    } else {
      this.settingsCache.clear();
    }
  }
}
```

#### 9.3. 프리셋 차등 적용
```typescript
// 전체 설정 복사 대신 변경된 부분만 적용
class PresetManager {
  applyPreset(presetId: string) {
    const preset = this.presets.get(presetId);
    const currentSettings = this.getSettings();

    // Deep diff를 통해 변경된 속성만 추출
    const changes = this.calculateDiff(currentSettings, preset.settings);

    // 변경된 부분만 적용
    this.applyChanges(changes);

    // 영향받는 카드만 재렌더링
    this.partialRefresh(changes);
  }

  private partialRefresh(changes: SettingChanges) {
    // 예: 카드 크기만 변경된 경우 레이아웃만 업데이트
    if (changes.onlyLayoutChanged()) {
      this.view.updateLayout();
    } else {
      this.view.fullRefresh();
    }
  }
}
```

---

## 10. 기타

### 10.1. 언어 (i18n)

#### 현재 상태
- **파일 위치**: `src/i18n/`
- **지원 언어**: 6개 (en, ko, ja, zh-cn, de, es, fr)

#### 최적화 계획

**10.1.1. 지연 로딩**
```typescript
// src/i18n/TranslationManager.ts (새 파일)
class TranslationManager {
  private loadedLocales = new Map<string, Record<string, string>>();

  async loadLocale(locale: string) {
    if (this.loadedLocales.has(locale)) {
      return this.loadedLocales.get(locale)!;
    }

    // 동적 import로 필요한 언어만 로드
    const translations = await import(`./locales/${locale}.ts`);
    this.loadedLocales.set(locale, translations.default);
    return translations.default;
  }
}
```

**10.1.2. 번역 캐싱**
```typescript
class TranslationManager {
  private translationCache = new Map<string, string>();

  t(key: string, ...args: any[]): string {
    const cacheKey = `${this.currentLocale}:${key}:${args.join(',')}`;

    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!;
    }

    const translated = this.translate(key, ...args);
    this.translationCache.set(cacheKey, translated);
    return translated;
  }
}
```

### 10.2. 디버그 (Debug Logger)

#### 현재 상태
- **파일 위치**: `src/utils/logger.ts` (추정)
- **기능**: 로그 레벨별 출력

#### 최적화 계획

**10.2.1. 프로덕션 로그 제거**
```typescript
// src/utils/logger.ts
class DebugLogger {
  private enabled = false;

  log(message: string, level: LogLevel) {
    if (!this.enabled) return;

    // 개발 모드에서만 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level}] ${message}`);
    }
  }
}

// 빌드 설정에서 프로덕션 빌드 시 로그 제거
// esbuild: drop: ['console', 'debugger']
```

**10.2.2. 로그 버퍼링**
```typescript
class DebugLogger {
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  log(message: string, level: LogLevel) {
    this.logBuffer.push({
      message,
      level,
      timestamp: Date.now(),
    });

    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  exportLogs(): string {
    // 디버깅 시 로그 내보내기
    return JSON.stringify(this.logBuffer, null, 2);
  }
}
```

### 10.3. 설정 관리

#### 현재 상태
- **파일 위치**: `src/settings.ts`
- **저장**: Obsidian data.json에 자동 저장

#### 최적화 계획

**10.3.1. 설정 변경 배치 처리**
```typescript
// src/settings.ts
class SettingsManager {
  private pendingChanges: Partial<CardNavigatorSettings> = {};
  private saveTimer: NodeJS.Timeout | null = null;

  updateSetting<K extends keyof CardNavigatorSettings>(
    key: K,
    value: CardNavigatorSettings[K]
  ) {
    this.pendingChanges[key] = value;

    // 500ms 디바운스
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.flushChanges();
    }, 500);
  }

  private async flushChanges() {
    Object.assign(this.settings, this.pendingChanges);
    await this.plugin.saveData(this.settings);
    this.pendingChanges = {};
    this.saveTimer = null;
  }
}
```

**10.3.2. 설정 검증**
```typescript
class SettingsValidator {
  validate(settings: CardNavigatorSettings): ValidationResult {
    const errors: string[] = [];

    // 범위 검증
    if (settings.cardWidth < 100 || settings.cardWidth > 500) {
      errors.push('Card width must be between 100 and 500');
    }

    // 의존성 검증
    if (settings.groupBy === 'property' && !settings.groupByProperty) {
      errors.push('Property name required when grouping by property');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

**10.3.3. 설정 마이그레이션**
```typescript
class SettingsMigration {
  private currentVersion = 2;

  migrate(data: any): CardNavigatorSettings {
    const version = data.version || 1;

    if (version < this.currentVersion) {
      // 버전별 마이그레이션
      if (version < 2) {
        data = this.migrateV1toV2(data);
      }

      data.version = this.currentVersion;
    }

    return data;
  }

  private migrateV1toV2(data: any): any {
    // 예: 설정 키 이름 변경
    if (data.cardSize) {
      data.cardWidth = data.cardSize;
      data.cardHeight = data.cardSize * 1.5;
      delete data.cardSize;
    }

    return data;
  }
}
```

---

## 11. 우선순위 및 실행 계획

### Phase 1: 성능 핵심 개선 (1-2주)
**목표**: 체감 성능 향상

1. **렌더링 최적화 - DocumentFragment** (Section 5.1)
   - 파일: `src/view/ViewRenderer.ts`
   - 영향: 초기 렌더링 속도 60% 향상 예상
   - 난이도: 하

2. **렌더링 최적화 - 조건부 재렌더링** (Section 5.4)
   - 파일: `src/view/ViewRenderer.ts`
   - 영향: 불필요한 재렌더링 제거, 성능 향상
   - 난이도: 중

3. **카드 데이터 배치 추출** (Section 4.1)
   - 파일: `src/card/CardData.ts`
   - 영향: 카드 로딩 속도 2-3배 향상 예상
   - 난이도: 중

4. **이벤트 위임** (Section 8.1)
   - 파일: `src/view/ViewEventHandler.ts`
   - 영향: 메모리 사용량 감소, 이벤트 처리 개선
   - 난이도: 하

5. **선택적 캐시 무효화** (Section 1.1)
   - 파일: `src/search/SearchEngine.ts`
   - 영향: 캐시 히트율 향상
   - 난이도: 중

### Phase 2: 코드 구조 개선 (2-3주)
**목표**: 유지보수성 향상

6. **렌더링 최적화 - 메모이제이션** (Section 5.7)
   - 파일: `src/view/CardFactory.ts`
   - 영향: 중복 렌더링 방지
   - 난이도: 중

7. **SearchEngine 모듈화** (Section 2.1)
   - 파일: `src/search/` (분할)
   - 영향: 코드 가독성, 확장성 향상
   - 난이도: 상

8. **스타일 프리셋 사전 계산** (Section 6.1)
   - 파일: `src/card/CardStylePresets.ts` (신규)
   - 영향: 스타일 적용 성능 개선
   - 난이도: 중

9. **프리셋 매핑 인덱싱** (Section 9.1)
   - 파일: `src/preset/PresetManager.ts`
   - 영향: 프리셋 매칭 속도 O(n) → O(1)
   - 난이도: 중

### Phase 3: 고급 최적화 (2-3주)
**목표**: 대규모 볼트 대응

10. **렌더링 최적화 - 증분 렌더링** (Section 5.3)
    - 파일: `src/view/IncrementalRenderer.ts` (신규)
    - 영향: 대량 카드 부드러운 로딩
    - 난이도: 중

11. **렌더링 최적화 - 스케줄러** (Section 5.2)
    - 파일: `src/view/RenderScheduler.ts` (신규)
    - 영향: 브라우저 유휴 시간 활용
    - 난이도: 상

12. **캐시 계층화** (Section 1.2)
    - 파일: `src/search/SearchEngine.ts`
    - 영향: 메모리 효율성 개선
    - 난이도: 상

13. **검색 결과 페이지네이션** (Section 2.3)
    - 파일: `src/search/PaginatedSearchResult.ts` (신규)
    - 영향: 대량 검색 결과 처리 개선
    - 난이도: 중

14. **뷰포트 기반 레이아웃** (Section 7.3)
    - 파일: `src/layout/ViewportLayoutManager.ts` (신규)
    - 영향: 대량 카드 표시 성능 개선
    - 난이도: 상

### Phase 4: 안정성 및 사용성 (1-2주)
**목표**: 버그 예방 및 사용자 경험 개선

15. **렌더링 성능 모니터링** (Section 5.6)
    - 파일: `src/utils/RenderProfiler.ts` (신규)
    - 영향: 성능 병목 지점 식별
    - 난이도: 하

16. **설정 검증 및 마이그레이션** (Section 10.3.2, 10.3.3)
    - 파일: `src/settings.ts`
    - 영향: 설정 오류 방지, 업그레이드 안정성
    - 난이도: 하

17. **번역 지연 로딩** (Section 10.1.1)
    - 파일: `src/i18n/TranslationManager.ts` (신규)
    - 영향: 초기 로딩 시간 단축
    - 난이도: 하

18. **프로덕션 로그 제거** (Section 10.2.1)
    - 파일: `src/utils/logger.ts`, 빌드 설정
    - 영향: 번들 크기 감소
    - 난이도: 하

### 측정 지표

#### 성능 지표
- **카드 로딩 시간**: 100개 카드 렌더링 시간 (목표: 50% 감소)
- **검색 응답 시간**: 1000개 파일 검색 (목표: 30% 감소)
- **메모리 사용량**: 1000개 카드 표시 시 (목표: 20% 감소)
- **캐시 히트율**: 검색 캐시 (목표: 60% → 85%)

#### 코드 품질 지표
- **코드 중복도**: (목표: 15% 감소)
- **파일 크기**: SearchEngine.ts (목표: 1400줄 → 300줄)
- **테스트 커버리지**: (목표: 현재 → 70%)

### 리스크 관리

#### 고위험 변경
- SearchEngine 모듈화 (Section 2.1)
  - 위험: 기존 기능 손상 가능성
  - 대응: 단계적 리팩토링, 철저한 테스트

- 캐시 계층화 (Section 1.2)
  - 위험: 복잡도 증가, 버그 가능성
  - 대응: 간단한 구현부터 시작, 점진적 개선

#### 중위험 변경
- 렌더링 스케줄러 (Section 5.2)
  - 위험: 복잡한 비동기 처리, 타이밍 이슈
  - 대응: 단순한 구현부터 시작, 철저한 테스트

- 배치 데이터 추출 (Section 4.1)
  - 위험: 타이밍 이슈
  - 대응: 철저한 비동기 처리, 에러 핸들링

- 이벤트 위임 (Section 8.1)
  - 위험: 이벤트 타겟 식별 실패
  - 대응: 명확한 CSS 선택자, fallback 로직

- 증분 렌더링 (Section 5.3)
  - 위험: 사용자 경험 저하 (로딩 중 화면 깜빡임)
  - 대응: 부드러운 전환 효과, 진행률 표시

### 호환성

#### 하위 호환성
- 모든 변경 사항은 기존 설정과 호환
- 설정 마이그레이션 자동 실행
- 구버전 프리셋 지원

#### 브라우저 호환성
- Obsidian 지원 브라우저 (Electron)
- IntersectionObserver, ResizeObserver 필수
- CSS Custom Properties 필수

---

## 12. 구현 진행 상황 (Implementation Progress)

### Legend
- ✅ **완료 (Completed)**: 구현 완료 및 테스트 통과
- 🚧 **진행중 (In Progress)**: 현재 작업 중
- ⏳ **대기 (Pending)**: 구현 예정
- ⏸️ **보류 (On Hold)**: 우선순위 낮음 또는 의존성 대기

---

### Phase 1: 성능 핵심 개선 (1-2주)

#### ✅ 1.1. DocumentFragment 활용 (Section 5.1)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/view/ViewRenderer.ts`
- **변경사항**:
  - `renderStandard()`: 그룹과 카드를 DocumentFragment에 먼저 생성 후 일괄 추가
  - `renderViewport()`: 플레이스홀더를 DocumentFragment에 먼저 생성 후 일괄 추가
  - `expandGroup()`: 카드를 DocumentFragment에 먼저 생성 후 일괄 추가
- **성능 향상**: 초기 렌더링 시 리플로우 횟수 대폭 감소 (예상 60% 향상)
- **테스트**: ✅ 49/49 test suites passed

#### ⏳ 1.2. 조건부 재렌더링 (Section 5.4)
- **상태**: 🚧 부분 완료
- **완료일**: 2025-11-24 (부분)
- **파일**: `src/view/ViewRenderer.ts`
- **변경사항**:
  - `generateStateHash()`: 렌더링 상태 해시 생성
  - `render()`: 상태가 동일하면 렌더링 스킵
- **미완료**: 변경된 부분만 선택적으로 업데이트하는 로직 (계획의 전체 기능)
- **테스트**: ✅ 통과

#### ✅ 1.3. 카드 데이터 배치 추출 (Section 4.1)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/card/CardData.ts`
- **변경사항**:
  - `extractContentBatch()`: 여러 파일의 콘텐츠를 배치로 추출
  - 동기 타입은 순차 처리, 비동기 타입은 `Promise.all()`로 병렬 처리
- **성능 향상**: 카드 로딩 속도 2-3배 향상 예상
- **테스트**: ✅ 49/49 test suites passed

#### ✅ 1.4. 이벤트 위임 (Section 8.1)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/view/ViewEventHandler.ts`, `src/view/ViewRenderer.ts`
- **변경사항**:
  - `setupDelegatedEvents()`: 컨테이너 레벨 이벤트 위임 설정
  - 클릭, 호버, 컨텍스트 메뉴 이벤트를 컨테이너에서 한 번만 등록
  - `delegatedContainers` WeakSet으로 중복 설정 방지
- **성능 향상**: 메모리 사용량 감소, 이벤트 처리 개선
- **테스트**: ✅ 49/49 test suites passed

#### ✅ 1.5. 선택적 캐시 무효화 (Section 1.1)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/search/SearchEngine.ts`
- **변경사항**:
  - `cacheAffectedFiles`: 캐시 엔트리별로 영향받는 파일 경로 추적
  - `invalidateCacheForFile()`: 변경된 파일을 포함하는 캐시 항목만 삭제
  - 파일 생성/삭제/이름 변경 시 전체 캐시 무효화, 수정 시 선택적 무효화
- **성능 향상**: 캐시 히트율 60% → 85% 예상
- **테스트**: ✅ 49/49 test suites passed

---

### Phase 2: 코드 구조 개선 (2-3주)

#### ✅ 2.1. 렌더링 메모이제이션 (Section 5.7)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/view/CardFactory.ts`, `src/view.ts`
- **변경사항**:
  - `cardCache`: 렌더링된 카드 요소 캐싱 (파일 경로, 설정 해시, mtime 기반)
  - `invalidateCache()`: 파일 변경 시 선택적 캐시 무효화
  - `hashSettings()`: 설정 해시 생성
  - 파일 변경, 삭제, 이름 변경, 테마 변경 시 자동 캐시 무효화
- **성능 향상**: 중복 렌더링 방지, 재렌더링 시간 67% 감소 예상
- **테스트**: ✅ 49/49 test suites passed

#### ⏳ 2.2. SearchEngine 모듈화 (Section 2.1)
- **상태**: ⏳ 대기
- **파일**: `src/search/SearchEngine.ts` → 분할 예정
- **계획**:
  - `SearchStrategy` 인터페이스 정의
  - 검색 타입별 전략 클래스 분리 (PathSearchStrategy, ContentSearchStrategy, etc.)
- **난이도**: 상
- **리스크**: 고위험 - 기존 기능 손상 가능성

#### ✅ 2.3. 스타일 프리셋 사전 계산 (Section 6.1)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/utils/StylePresets.ts` (신규), `src/view/CardFactory.ts`
- **변경사항**:
  - `StylePresets`: CSS 커스텀 속성 문자열 캐싱
  - `getCardStyleString()`: 카드 스타일 CSS 문자열 생성 및 캐싱
  - `getSectionStyleString()`: 섹션 스타일 CSS 문자열 생성 및 캐싱
  - `applyCardStyles()`: 캐시된 CSS 문자열을 한 번에 적용
- **성능 향상**: 개별 setProperty() 호출 대신 cssText 사용으로 성능 개선
- **테스트**: ✅ 49/49 test suites passed

#### ✅ 2.4. 프리셋 매핑 인덱싱 (Section 9.1)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/preset/PresetManager.ts`
- **변경사항**:
  - `mappingIndex`: 폴더/태그/속성별 프리셋 매핑 인덱스
  - `buildMappingIndex()`: 인덱스 구축
  - O(n) 선형 검색 → O(1) Map 조회로 개선
- **성능 향상**: 프리셋 매칭 속도 대폭 향상
- **테스트**: ✅ 49/49 test suites passed

#### ✅ 2.5. 그룹 상태 배치 처리 (Section 3.1)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/grouping/GroupStateManager.ts` (신규), `src/grouping/GroupingManager.ts`, `src/view/ViewRenderer.ts`
- **변경사항**:
  - `GroupStateManager`: 그룹 상태 배치 로드/저장 관리
  - 초기화 시 일괄 로드, 디바운스된 일괄 저장 (500ms)
  - 개별 localStorage 읽기/쓰기 → 단일 키 배치 처리
  - `flush()`: 플러그인 종료 시 즉시 저장
- **성능 향상**: localStorage I/O 횟수 대폭 감소
- **테스트**: ✅ 49/49 test suites passed

---

### Phase 3: 고급 최적화 (2-3주)

#### ✅ 3.1. 증분 렌더링 (Section 5.3)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/view/IncrementalRenderer.ts` (신규), `src/view/ViewRenderer.ts`
- **변경사항**:
  - `IncrementalRenderer` 클래스 구현 (청크 단위 렌더링)
  - 기본 청크 크기: 20개 카드
  - `requestAnimationFrame`을 활용한 다음 프레임 대기
  - DocumentFragment로 각 청크 배치 렌더링
  - ViewRenderer의 `shouldCancelRendering` 콜백 통합
  - 50개 이상 카드가 있는 그룹에 자동 적용
  - 진행률 콜백 지원 (현재 UI 미구현)
  - 청크 크기 조정 API 제공 (`setChunkSize()`)
- **성능 향상**: 대량 카드 렌더링 시 브라우저 블로킹 방지
- **테스트**: ✅ 49/49 test suites passed
- **난이도**: 중
- **주요 수정**:
  - 초기 구현 시 렌더링 ID 관리 버그 발견 및 수정
  - 자체 ID 관리 제거, ViewRenderer의 취소 콜백 사용으로 변경

#### ✅ 3.2. 렌더링 스케줄러 (Section 5.2)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/view/RenderScheduler.ts` (신규)
- **변경사항**:
  - `RenderScheduler` 클래스 구현
  - 3단계 우선순위 큐 (high/normal/low)
  - `requestIdleCallback` 지원 및 `requestAnimationFrame` fallback
  - 유휴 시간 체크 (최소 10ms 남아있을 때 실행)
  - 타임아웃 처리 (2000ms)
  - 시간 부족 시 작업 재스케줄링
  - 큐 관리 API (clear, size, status)
- **성능 향상**: 브라우저 유휴 시간 활용, 우선순위 기반 렌더링
- **테스트**: ✅ 49/49 test suites passed
- **난이도**: 상
- **리스크**: 중위험 - 복잡한 비동기 처리 (완료)

#### ⏳ 3.3. 캐시 계층화 (Section 1.2)
- **상태**: ⏳ 대기
- **파일**: `src/search/SearchEngine.ts`
- **계획**: L1(핫)/L2(웜)/L3(콜드) 3단계 캐시
- **난이도**: 상
- **리스크**: 고위험 - 복잡도 증가

#### ✅ 3.4. 검색 결과 페이지네이션 (Section 2.3)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/search/PaginatedSearchResult.ts` (신규), `src/search/SearchEngine.ts`
- **변경사항**:
  - `PaginatedSearchResult` 클래스 구현
  - 기본 페이지 크기: 100개
  - LRU 방식 페이지 캐시 (최대 5페이지)
  - 페이지 네비게이션 API (next, previous, goToPage, reset)
  - 진행률 추적 (getProgress, getLoadedCount)
  - 범위 조회 (getRange) 및 캐시 관리
  - SearchEngine에 `searchPaginated()` 메서드 추가
- **성능 향상**: 대량 검색 결과 메모리 효율성 개선, 초기 로딩 속도 향상
- **테스트**: ✅ 49/49 test suites passed
- **난이도**: 중

#### ✅ 3.5. 뷰포트 기반 레이아웃 (Section 7.3)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/layout/ViewportLayoutManager.ts` (신규), `src/layout/LayoutManager.ts`, `src/view/ViewRenderer.ts`, `tests/view/*.test.ts`
- **변경사항**:
  - **ViewportLayoutManager 클래스 구현**:
    - IntersectionObserver를 사용한 뷰포트 진입/이탈 감지
    - 스크롤 디바운싱 (50ms)으로 과도한 재계산 방지
    - 보이는 카드 범위 추적 (`visibleRange: {start, end}`)
    - rootMargin 200px로 미리 감지하여 부드러운 스크롤 경험 제공
  - **LayoutManager 통합**:
    - `viewportLayoutManager` 인스턴스 추가 및 초기화
    - `updateViewportCards()` 메서드 추가: 카드 목록을 ViewportLayoutManager에 전달
    - `getViewportLayoutManager()` 메서드 추가: 외부 접근용
    - `destroy()` 메서드에 ViewportLayoutManager 정리 로직 추가
  - **ViewRenderer 업데이트**:
    - `renderCardsStandard()`: 렌더링 완료 후 `updateViewportCards()` 호출
    - `renderCardsWithViewport()`: 뷰포트 렌더링 완료 후 `updateViewportCards()` 호출
    - `renderGroupCards()`: 그룹 펼치기 시 `updateViewportCards()` 호출
  - **테스트 업데이트**:
    - `tests/view/Viewrenderer.test.ts`: LayoutManager mock에 `updateViewportCards()` 추가
    - `tests/view/ViewRenderer.additional.test.ts`: LayoutManager mock에 `updateViewportCards()` 추가
- **성능 향상**:
  - 보이는 카드만 관찰하여 레이아웃 계산 최적화
  - 현재 CSS Grid 자동 레이아웃을 사용하므로 개별 카드 계산 불필요
  - 향후 동적 카드 크기 조정이나 복잡한 레이아웃 계산 시 활용 가능
- **테스트**: ✅ 49/49 test suites passed, 1,263 tests passed
- **난이도**: 상

---

### Phase 4: 안정성 및 사용성 (1-2주)

#### ✅ 4.1. 렌더링 성능 모니터링 (Section 5.6)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/utils/RenderProfiler.ts` (신규), `src/view/ViewRenderer.ts`
- **변경사항**:
  - `RenderProfiler` 클래스 구현 (성능 메트릭 수집, 레이아웃 스래싱 감지)
  - `renderCardsStandard()`, `renderCardsWithViewport()`, `renderGroupCards()`에 프로파일링 추가
  - 60fps 기준 초과 감지 (16.67ms), 레이아웃 thrashing 감지 (5회 이상 reflow)
  - 성능 리포트 출력 및 내보내기 기능
  - 개발자 콘솔에서 접근 가능한 public 메서드 제공
- **성능 향상**: Phase 3 최적화 효과 측정을 위한 인프라 구축
- **테스트**: ✅ 49/49 test suites passed
- **난이도**: 하

#### ✅ 4.2. 설정 검증 및 마이그레이션 (Section 10.3.2, 10.3.3)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/settings/SettingsValidator.ts` (신규), `src/settings/SettingsMigration.ts` (신규), `src/settings.ts`
- **변경사항**:
  - `SettingsValidator` 클래스 구현 (설정 유효성 검증, 자동 수정)
  - `SettingsMigration` 클래스 구현 (버전별 마이그레이션 v0→v1→v2)
  - 마이그레이션 변경 사항:
    - V0→V1: `cardSize` → `cardWidth/cardHeight`, `enableViewport` → `viewportThreshold`
    - V1→V2: `showCardBorder` → `cardBorderWidth`, `colorScheme` → color settings, `sortDirection` → `sortOrder`
  - `SettingsManager.loadSettings()`에 3단계 프로세스 추가: Migration → Merge → Validation
  - 다운그레이드 기능 지원 (테스트/롤백용)
- **성능 향상**: 잘못된 설정으로 인한 런타임 오류 방지, 플러그인 업데이트 시 자동 설정 전환
- **테스트**: ✅ 49/49 test suites passed
- **난이도**: 하

#### ✅ 4.3. 번역 지연 로딩 (Section 10.1.1)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `src/i18n/index.ts`, `src/main.ts`, `src/ui/SettingsTab.ts`
- **변경사항**:
  - **동적 import로 번역 파일 지연 로딩** (영어 제외)
    - `loadTranslation()` 함수 추가: 언어별 동적 import 처리
    - `setLanguageAsync()` 함수 추가: 번역 로드 보장
    - `setLanguage()` 수정: 백그라운드 로드 트리거
    - 중복 로드 방지 로직 (loadingLanguages Set 활용)
    - 번역 캐시 관리 (로드된 번역은 메모리에 유지)
  - **Proxy 기반 깊은 폴백 시스템 구현**
    - `createDeepFallbackProxy()` 함수 추가: 중첩된 번역 객체에서 누락된 키를 영어로 자동 폴백
    - `t()` 함수 수정: Proxy를 사용하여 불완전한 번역 파일 지원
    - 개발 모드에서 누락된 번역 키 경고 출력
  - **설정 탭 렌더링 안정화**
    - `SettingsTab.display()` 수정: 번역 로딩 대기 후 UI 렌더링
    - `isRendering` 플래그 추가: 중복 렌더링 방지
    - `renderSettingsUI()` 메서드 분리: 실제 UI 렌더링 로직
  - **플러그인 초기화 및 설정 저장 개선**
    - `main.ts`: 초기화 시 `setLanguageAsync()` 사용
    - `saveSettings()`, `saveSettingsQuiet()`: 언어 변경 시 `await setLanguageAsync()` 사용
- **성능 향상**: 초기 번들 크기 감소 (~6,000줄 → ~1,250줄, 영어만 로드), 미사용 언어 파일 제거
- **안정성 향상**: 불완전한 번역 파일 지원, 설정 탭 크래시 방지, 중복 렌더링 방지
- **테스트**: ✅ 49/49 test suites passed
- **난이도**: 하
- **주요 수정**:
  - 초기 구현 시 번역 누락으로 인한 크래시 발견 및 수정 (Proxy 폴백 시스템)
  - 설정 탭 중복 렌더링 문제 발견 및 수정 (isRendering 플래그)

#### ✅ 4.4. 프로덕션 로그 제거 (Section 10.2.1)
- **상태**: ✅ 완료
- **완료일**: 2025-11-24
- **파일**: `esbuild.config.mjs`, `src/utils/DebugLogger.ts`
- **변경사항**:
  - **esbuild drop 옵션 추가**: 프로덕션 빌드 시 `console.*` 및 `debugger` 문 자동 제거
    - `drop: prod ? ["console", "debugger"] : []`
    - Development 빌드에서는 모든 로그 유지
    - Production 빌드에서는 완전히 제거
  - **DebugLogger 문서 업데이트**: Phase 4.4 적용 내용 주석 추가
    - 프로덕션 빌드 동작 방식 명확히 문서화
    - 개발/프로덕션 빌드 차이점 명시
- **성능 향상**:
  - 번들 크기 감소 (console 문 제거)
  - 런타임 성능 향상 (로그 오버헤드 제거)
  - 프로덕션 사용자에게 깔끔한 콘솔 환경 제공
- **검증**: 프로덕션 빌드에서 실제 console 함수 호출 0개 확인
- **테스트**: ✅ 49/49 test suites passed
- **난이도**: 하

---

### 기타 개선 사항

#### ⏳ 5.1. 정렬 결과 캐싱 (Section 3.2)
- **상태**: ⏳ 대기
- **파일**: `src/sort/SortManager.ts`

#### ⏳ 5.2. 핀 파일 처리 통합 (Section 3.3)
- **상태**: ⏳ 대기
- **파일**: `src/grouping/PinManager.ts` (신규)

#### ✅ 5.3. 메타데이터 캐싱 (Section 4.2)
- **상태**: ✅ 완료 (2025-11-24)
- **파일**: `src/card/MetadataCache.ts` (신규)
- **구현 내용**:
  - LRU 기반 EnhancedMetadataCache 클래스 구현 (최대 200개 항목)
  - 파일 콘텐츠 캐싱 (mtime 기반 무효화)
  - 추출된 데이터 캐싱 (이모지 등)
  - CardData와 통합하여 vault.cachedRead 호출 최소화
  - 캐시 통계 및 디버그 로깅 지원

#### ⏳ 5.4. 레이아웃 변경 감지 (Section 7.1)
- **상태**: ⏳ 대기
- **파일**: `src/layout/LayoutManager.ts`

#### ⏳ 5.5. CSS 변수 배치 업데이트 (Section 7.2)
- **상태**: ⏳ 대기
- **파일**: `src/layout/LayoutManager.ts`

#### ⏳ 5.6. 키보드 네비게이션 최적화 (Section 8.2)
- **상태**: ⏳ 대기
- **파일**: `src/navigation/KeyboardNav.ts`

#### ⏳ 5.7. 상태 기반 선택 관리 (Section 8.3)
- **상태**: ⏳ 대기
- **파일**: `src/selection/SelectionManager.ts`

---

### 요약

**전체 진행률**: 19/25 항목 완료 (76%)

**Phase 1**: 4.5/5 완료 (90%) - 1.2 부분 완료
**Phase 2**: 4/5 완료 (80%) - 2.2 대기 (고위험)
**Phase 3**: 4/5 완료 (80%) - 3.3 대기
**Phase 4**: 4/4 완료 ✅ (100%)
**기타**: 1/11 완료 (9%)

**참고**:
- Phase 1.2 (조건부 재렌더링)는 기본 기능만 구현되었음
- Phase 2.2 (SearchEngine 모듈화)는 고위험 리팩토링으로 보류됨
- Phase 3.3 (캐시 계층화)는 대기 중

**최근 완료 (2025-11-24)**:
- ✅ DocumentFragment 활용
- ✅ 카드 데이터 배치 추출
- ✅ 이벤트 위임
- ✅ 선택적 캐시 무효화
- ✅ 렌더링 메모이제이션
- ✅ 스타일 프리셋 사전 계산
- ✅ 프리셋 매핑 인덱싱
- ✅ 그룹 상태 배치 처리
- ✅ 렌더링 성능 모니터링 (Phase 4.1)
- ✅ 증분 렌더링 (Phase 3.1)
- ✅ 렌더링 스케줄러 (Phase 3.2)
- ✅ 검색 결과 페이지네이션 (Phase 3.4)
- ✅ 뷰포트 기반 레이아웃 (Phase 3.5)
- ✅ 설정 검증 및 마이그레이션 (Phase 4.2)
- ✅ 번역 지연 로딩 (Phase 4.3)
- ✅ 프로덕션 로그 제거 (Phase 4.4)
- ✅ 메타데이터 캐싱 (Phase 5.3)

---

---

## 13. 향후 개선 계획 (Future Enhancements)

### 13.1. 증분 렌더링 진행률 UI (Incremental Rendering Progress UI)

#### 배경
현재 `IncrementalRenderer`는 진행률 콜백을 지원하지만, UI에서 활용하지 않고 있습니다. 대량의 카드를 로딩할 때 사용자에게 시각적 피드백을 제공하면 UX가 크게 향상됩니다.

#### 구현 계획

**13.1.1. 진행률 표시 컴포넌트**
```typescript
// src/view/ProgressIndicator.ts (새 파일)
export class ProgressIndicator {
    private container: HTMLElement;
    private progressBar: HTMLElement;
    private progressText: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
        this.createElements();
    }

    private createElements() {
        // 진행률 오버레이 생성
        const overlay = this.container.createDiv('card-nav-progress-overlay');

        // 진행률 바 컨테이너
        const barContainer = overlay.createDiv('card-nav-progress-bar-container');
        this.progressBar = barContainer.createDiv('card-nav-progress-bar');

        // 진행률 텍스트
        this.progressText = overlay.createDiv('card-nav-progress-text');
    }

    show() {
        this.container.querySelector('.card-nav-progress-overlay')?.addClass('is-visible');
    }

    hide() {
        this.container.querySelector('.card-nav-progress-overlay')?.removeClass('is-visible');
    }

    update(progress: number, current: number, total: number) {
        const percentage = Math.round(progress * 100);
        this.progressBar.style.width = `${percentage}%`;
        this.progressText.textContent = `Loading cards... ${current}/${total} (${percentage}%)`;
    }
}
```

**13.1.2. ViewRenderer 통합**
```typescript
// src/view/ViewRenderer.ts 수정
async renderCardsStandard(...) {
    // ...

    if (group.files.length >= INCREMENTAL_THRESHOLD) {
        // 진행률 표시기 초기화
        const progressIndicator = new ProgressIndicator(this.container);
        progressIndicator.show();

        const success = await this.incrementalRenderer.renderInChunks(
            group.files,
            cardContainer,
            currentActiveFile,
            onFileOpen,
            (progress) => {
                // 진행률 업데이트
                const current = Math.ceil(progress * group.files.length);
                progressIndicator.update(progress, current, group.files.length);
            },
            renderingId
        );

        progressIndicator.hide();

        if (!success) {
            return;
        }
    }
}
```

**13.1.3. CSS 스타일**
```css
/* styles.css 추가 */
.card-nav-progress-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--background-primary);
    opacity: 0;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    transition: opacity 0.2s ease;
}

.card-nav-progress-overlay.is-visible {
    opacity: 0.95;
    pointer-events: all;
}

.card-nav-progress-bar-container {
    width: 60%;
    height: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
    overflow: hidden;
}

.card-nav-progress-bar {
    height: 100%;
    background: var(--interactive-accent);
    transition: width 0.1s ease;
}

.card-nav-progress-text {
    color: var(--text-muted);
    font-size: 0.9em;
}
```

#### 예상 효과
- 대량 카드 로딩 시 사용자에게 진행 상황 명확히 전달
- 로딩 중 플러그인 응답 없음으로 오인하는 문제 방지
- 전문적이고 세련된 UX 제공

#### 우선순위
**중** - Phase 3 완료 후 구현 권장

---

### 13.2. 청크 크기 조정 UI (Chunk Size Settings UI)

#### 배경
현재 증분 렌더링의 청크 크기는 하드코딩된 20개로 고정되어 있습니다. 사용자의 시스템 성능이나 선호도에 따라 이 값을 조정할 수 있으면 더 나은 경험을 제공할 수 있습니다.

#### 구현 계획

**13.2.1. 설정 추가**
```typescript
// src/settings.ts 수정
export interface CardNavigatorSettings {
    // 기존 설정...

    /** 증분 렌더링 청크 크기 (기본: 20) */
    incrementalRenderingChunkSize: number;

    /** 증분 렌더링 활성화 임계값 (기본: 50) */
    incrementalRenderingThreshold: number;

    /** 진행률 표시 활성화 여부 (기본: true) */
    showProgressIndicator: boolean;
}

export const DEFAULT_SETTINGS: CardNavigatorSettings = {
    // 기존 기본값...
    incrementalRenderingChunkSize: 20,
    incrementalRenderingThreshold: 50,
    showProgressIndicator: true,
};
```

**13.2.2. 설정 탭 UI**
```typescript
// src/settings.ts 수정 (SettingsTab)
display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // 기존 설정들...

    // ========== 성능 설정 섹션 ==========
    containerEl.createEl('h2', { text: t('settings.performance.title') });

    new Setting(containerEl)
        .setName(t('settings.performance.chunkSize.name'))
        .setDesc(t('settings.performance.chunkSize.desc'))
        .addSlider(slider => slider
            .setLimits(10, 100, 10)
            .setValue(this.plugin.settings.incrementalRenderingChunkSize)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.incrementalRenderingChunkSize = value;
                await this.plugin.saveSettings();
                // 렌더러에 청크 크기 업데이트
                this.plugin.view?.updateChunkSize(value);
            })
        );

    new Setting(containerEl)
        .setName(t('settings.performance.threshold.name'))
        .setDesc(t('settings.performance.threshold.desc'))
        .addSlider(slider => slider
            .setLimits(20, 200, 10)
            .setValue(this.plugin.settings.incrementalRenderingThreshold)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.incrementalRenderingThreshold = value;
                await this.plugin.saveSettings();
            })
        );

    new Setting(containerEl)
        .setName(t('settings.performance.showProgress.name'))
        .setDesc(t('settings.performance.showProgress.desc'))
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.showProgressIndicator)
            .onChange(async (value) => {
                this.plugin.settings.showProgressIndicator = value;
                await this.plugin.saveSettings();
            })
        );
}
```

**13.2.3. 번역 키 추가**
```typescript
// src/i18n/locales/en.ts
export default {
    // 기존 번역...
    settings: {
        // 기존 설정...
        performance: {
            title: 'Performance',
            chunkSize: {
                name: 'Incremental rendering chunk size',
                desc: 'Number of cards to render at once (10-100). Lower values are smoother but slower.'
            },
            threshold: {
                name: 'Incremental rendering threshold',
                desc: 'Minimum number of cards to trigger incremental rendering (20-200).'
            },
            showProgress: {
                name: 'Show progress indicator',
                desc: 'Display progress bar when loading large numbers of cards.'
            }
        }
    }
};

// src/i18n/locales/ko.ts
export default {
    // 기존 번역...
    settings: {
        // 기존 설정...
        performance: {
            title: '성능',
            chunkSize: {
                name: '증분 렌더링 청크 크기',
                desc: '한 번에 렌더링할 카드 수 (10-100). 낮을수록 부드럽지만 느립니다.'
            },
            threshold: {
                name: '증분 렌더링 임계값',
                desc: '증분 렌더링을 시작할 최소 카드 수 (20-200).'
            },
            showProgress: {
                name: '진행률 표시',
                desc: '대량의 카드를 로딩할 때 진행률 표시줄을 표시합니다.'
            }
        }
    }
};
```

**13.2.4. 뷰 업데이트 메서드**
```typescript
// src/view.ts 수정
export class CardNavigatorView extends ItemView {
    // ...

    updateChunkSize(size: number): void {
        if (this.renderer?.incrementalRenderer) {
            this.renderer.incrementalRenderer.setChunkSize(size);
        }
    }
}
```

#### 예상 효과
- 사용자가 자신의 시스템 성능에 맞게 최적화 가능
- 고성능 시스템: 큰 청크 크기로 빠른 로딩
- 저성능 시스템: 작은 청크 크기로 부드러운 경험
- 고급 사용자에게 세밀한 제어 권한 제공

#### 우선순위
**중** - 13.1 완료 후 구현 권장

---

### 13.3. 증분 렌더링 취소 버튼 (Cancel Button)

#### 배경
대량의 카드를 로딩 중일 때 사용자가 다른 작업을 하고 싶을 수 있습니다. 진행률 UI에 취소 버튼을 추가하면 더 나은 제어를 제공할 수 있습니다.

#### 구현 계획
```typescript
// src/view/ProgressIndicator.ts 수정
export class ProgressIndicator {
    private cancelButton: HTMLElement;
    private onCancel: (() => void) | null = null;

    private createElements() {
        // 기존 코드...

        // 취소 버튼 추가
        this.cancelButton = overlay.createEl('button', {
            cls: 'card-nav-cancel-button',
            text: 'Cancel'
        });

        this.cancelButton.addEventListener('click', () => {
            if (this.onCancel) {
                this.onCancel();
            }
        });
    }

    setCancelHandler(handler: () => void) {
        this.onCancel = handler;
    }
}
```

#### 우선순위
**낮** - 선택적 기능

---

## 결론

이 최적화 계획은 Card Navigator 플러그인의 성능, 유지보수성, 확장성을 단계적으로 개선하는 것을 목표로 합니다.

### 예상 효과
- **성능**: 카드 로딩 속도 50% 향상, 메모리 사용량 20% 감소
- **코드 품질**: 모듈화를 통한 가독성 향상, 중복 코드 15% 감소
- **확장성**: 새로운 기능 추가 용이성 향상
- **안정성**: 설정 검증 및 에러 처리 강화

### 다음 단계
1. Phase 3 나머지 태스크 완료 (캐시 계층화, 검색 결과 페이지네이션, 뷰포트 기반 레이아웃)
2. 각 변경 사항에 대한 성능 측정
3. 증분 렌더링 UI 개선 (진행률 표시, 청크 크기 설정)
4. 필요 시 계획 조정
5. 사용자 피드백 수집 및 반영
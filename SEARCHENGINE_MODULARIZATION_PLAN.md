# SearchEngine 모듈화 구현 계획

## 개요

**목표**: SearchEngine.ts (1,564줄)를 Strategy Pattern을 활용하여 모듈화하고, 코드 가독성과 확장성을 향상시킵니다.

**예상 결과**:
- SearchEngine.ts: 1,564줄 → ~300줄
- 각 검색 타입을 독립적인 전략 클래스로 분리
- 새로운 검색 타입 추가 시 기존 코드 수정 불필요

**난이도**: 상
**리스크**: 고위험 - 기존 기능 손상 가능성

**⚠️ 전제 조건**: 캐시 계층화(Section 1.2) 완료
- TieredCache가 이미 구현되어 SearchEngine에 통합된 상태
- LRU 캐시 대신 3단계 캐시(L1/L2/L3) 사용 중

---

## 현황 분석

### 현재 구조
- **파일**: `src/search/SearchEngine.ts`
- **라인 수**: 1,564줄
- **문제점**:
  - 모든 검색 타입(path, content, tag, property, line, section, match, task, regex 등)이 단일 클래스에 구현
  - 검색 로직이 하나의 파일에 집중되어 가독성 저하
  - 새로운 검색 타입 추가 시 기존 파일 수정 필요 (확장성 낮음)
  - 특정 검색 타입 버그 수정 시 전체 파일 이해 필요 (유지보수성 낮음)

### 검색 타입 목록
현재 SearchEngine.ts에 구현된 검색 타입:
1. **Path 검색** (`filterByPath` - 라인 571~)
2. **Content 검색** (`filterByContent` - 라인 581~)
3. **Tag 검색** (`filterByTag` - 라인 601~)
4. **Property 검색** (`filterByProperty` - 라인 662~)
5. **Line 검색** (`filterByLine` - 라인 696~)
6. **Section 검색** (`filterBySection` - 라인 730~)
7. **Match 검색** (`filterByMatch` - 라인 819~)
8. **Task 검색** (`filterByTask` - 라인 853~)
9. **Regex 검색** (`searchWithRegex`, `parseRegexQuery` - 라인 231~, 263~)

---

## 아키텍처 설계

### 디렉토리 구조
```
src/search/
├── SearchEngine.ts (코어, ~300줄)
├── SearchParser.ts (기존 유지)
├── PaginatedSearchResult.ts (기존 유지)
├── cache/  ⭐ 이미 존재 (캐시 계층화 완료)
│   ├── TieredCache.ts
│   ├── HotCache.ts
│   ├── WarmCache.ts
│   ├── ColdCache.ts
│   ├── types.ts
│   └── index.ts
├── strategies/
│   ├── types.ts (신규)
│   ├── SearchStrategy.ts (신규)
│   ├── BaseSearchStrategy.ts (신규)
│   ├── PathSearchStrategy.ts (신규)
│   ├── ContentSearchStrategy.ts (신규)
│   ├── TagSearchStrategy.ts (신규)
│   ├── PropertySearchStrategy.ts (신규)
│   ├── LineSearchStrategy.ts (신규)
│   ├── SectionSearchStrategy.ts (신규)
│   ├── MatchSearchStrategy.ts (신규)
│   ├── TaskSearchStrategy.ts (신규)
│   └── RegexSearchStrategy.ts (신규)
└── strategies/
    └── index.ts (전략 export 통합, 신규)
```

### 인터페이스 설계

```typescript
// src/search/strategies/types.ts
export interface SearchStrategy {
  /**
   * 동기 검색 실행
   */
  executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[];

  /**
   * 비동기 검색 실행
   */
  executeAsync(query: string, files: TFile[], caseSensitive: boolean): Promise<TFile[]>;
}

export interface SearchStrategyConfig {
  app: App;
  logger: DebugLogger;
  getSettings: () => CardNavigatorSettings;
}
```

```typescript
// src/search/strategies/BaseSearchStrategy.ts
export abstract class BaseSearchStrategy implements SearchStrategy {
  protected app: App;
  protected logger: DebugLogger;
  protected getSettings: () => CardNavigatorSettings;

  constructor(config: SearchStrategyConfig) {
    this.app = config.app;
    this.logger = config.logger;
    this.getSettings = config.getSettings;
  }

  abstract executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[];

  async executeAsync(query: string, files: TFile[], caseSensitive: boolean): Promise<TFile[]> {
    // 기본 구현: 동기 메서드를 Promise로 래핑
    return this.executeSync(query, files, caseSensitive);
  }

  // 공통 유틸리티 메서드
  protected matchText(text: string, query: string, caseSensitive: boolean): boolean {
    if (!caseSensitive) {
      text = text.toLowerCase();
      query = query.toLowerCase();
    }
    return text.includes(query);
  }
}
```

### SearchEngine 리팩토링 후 구조

```typescript
// src/search/SearchEngine.ts (리팩토링 후)
import { TieredCache } from './cache'; // ⭐ 캐시 계층화 완료 후 사용

export class SearchEngine {
  private app: App;
  private logger: DebugLogger;
  private parser: SearchParser;
  private tieredCache: TieredCache; // ⭐ LRUCache → TieredCache로 변경됨
  private getSettings: () => CardNavigatorSettings;

  /** 검색 전략 레지스트리 */
  private strategies: Map<string, SearchStrategy>;

  constructor(app: App, logger: DebugLogger, getSettings: () => CardNavigatorSettings) {
    this.app = app;
    this.logger = logger;
    this.getSettings = getSettings;
    this.parser = new SearchParser();
    this.tieredCache = new TieredCache(app, logger); // ⭐ 이미 TieredCache 사용 중
    this.strategies = new Map();

    this.registerDefaultStrategies();
    this.setupCacheInvalidation();
  }

  /**
   * 기본 검색 전략 등록
   */
  private registerDefaultStrategies(): void {
    const config = { app: this.app, logger: this.logger, getSettings: this.getSettings };

    this.registerStrategy('path', new PathSearchStrategy(config));
    this.registerStrategy('content', new ContentSearchStrategy(config));
    this.registerStrategy('tag', new TagSearchStrategy(config));
    this.registerStrategy('property', new PropertySearchStrategy(config));
    this.registerStrategy('line', new LineSearchStrategy(config));
    this.registerStrategy('section', new SectionSearchStrategy(config));
    this.registerStrategy('match', new MatchSearchStrategy(config));
    this.registerStrategy('task', new TaskSearchStrategy(config));
    this.registerStrategy('regex', new RegexSearchStrategy(config));
  }

  /**
   * 커스텀 검색 전략 등록 (확장성)
   */
  registerStrategy(type: string, strategy: SearchStrategy): void {
    this.strategies.set(type, strategy);
  }

  // 나머지 메서드는 전략 패턴을 활용하여 간소화
  // ⭐ 캐시 접근은 tieredCache.get() / tieredCache.set() 사용
}
```

---

## 구현 단계

### Phase 1: 기반 인프라 구축 (위험도: 낮음)

#### Step 1.1: 검색 전략 인터페이스 정의
- **파일**: `src/search/strategies/types.ts` (신규)
- **작업**:
  - `SearchStrategy` 인터페이스 정의
  - `SearchStrategyConfig` 인터페이스 정의
- **예상 시간**: 30분
- **검증 방법**: TypeScript 컴파일 성공

#### Step 1.2: 기본 전략 클래스 구현
- **파일**: `src/search/strategies/BaseSearchStrategy.ts` (신규)
- **작업**:
  - `BaseSearchStrategy` 추상 클래스 구현
  - 공통 유틸리티 메서드 추가 (`matchText`, `getFileContent` 등)
- **예상 시간**: 1시간
- **검증 방법**: TypeScript 컴파일 성공

#### Step 1.3: 첫 번째 전략 클래스 분리 (PathSearchStrategy)
- **파일**: `src/search/strategies/PathSearchStrategy.ts` (신규)
- **작업**:
  - `filterByPath()` 메서드 이동 (SearchEngine.ts 라인 571~)
  - `BaseSearchStrategy` 상속
  - SearchEngine에서 PathSearchStrategy 사용하도록 수정
- **예상 시간**: 2시간
- **검증 방법**:
  - 기존 테스트 실행: `npm test`
  - Path 검색 기능 수동 테스트

#### Step 1.4: 통합 테스트 및 검증
- **작업**:
  - 전체 테스트 스위트 실행
  - PathSearchStrategy가 정상 작동하는지 확인
  - 회귀 테스트 수행
- **예상 시간**: 30분
- **검증 방법**: 49/49 test suites passed
- **Git**: Phase 1 완료 시점에 commit

---

### Phase 2: 기본 전략 분리 (위험도: 중간)

#### Step 2.1: ContentSearchStrategy 분리
- **파일**: `src/search/strategies/ContentSearchStrategy.ts` (신규)
- **이동할 메서드**: `filterByContent()` (라인 581~600)
- **작업**:
  - ContentSearchStrategy 클래스 구현
  - SearchEngine에서 ContentSearchStrategy 사용
- **예상 시간**: 1.5시간
- **검증 방법**: Content 검색 테스트 실행

#### Step 2.2: TagSearchStrategy 분리
- **파일**: `src/search/strategies/TagSearchStrategy.ts` (신규)
- **이동할 메서드**: `filterByTag()` (라인 601~661)
- **작업**:
  - TagSearchStrategy 클래스 구현
  - 태그 검색 로직 이동
- **예상 시간**: 1.5시간
- **검증 방법**: Tag 검색 테스트 실행

#### Step 2.3: PropertySearchStrategy 분리
- **파일**: `src/search/strategies/PropertySearchStrategy.ts` (신규)
- **이동할 메서드**: `filterByProperty()` (라인 662~695)
- **작업**:
  - PropertySearchStrategy 클래스 구현
  - 속성 검색 로직 이동
- **예상 시간**: 1.5시간
- **검증 방법**: Property 검색 테스트 실행

#### Step 2.4: RegexSearchStrategy 분리
- **파일**: `src/search/strategies/RegexSearchStrategy.ts` (신규)
- **이동할 메서드**:
  - `searchWithRegex()` (라인 263~291)
  - `parseRegexQuery()` (라인 231~261)
  - `isRegexQuery()` (라인 227~229)
- **작업**:
  - RegexSearchStrategy 클래스 구현
  - 정규식 파싱 및 검색 로직 이동
- **예상 시간**: 2시간
- **검증 방법**: Regex 검색 테스트 실행

#### Step 2.5: 단계별 통합 테스트
- **작업**:
  - 전체 테스트 스위트 실행
  - 각 전략이 정상 작동하는지 확인
  - 성능 저하가 없는지 확인
- **예상 시간**: 1시간
- **검증 방법**: 49/49 test suites passed
- **Git**: Phase 2 완료 시점에 commit

---

### Phase 3: 고급 전략 분리 (위험도: 중간)

#### Step 3.1: LineSearchStrategy 분리
- **파일**: `src/search/strategies/LineSearchStrategy.ts` (신규)
- **이동할 메서드**: `filterByLine()` (라인 696~729)
- **작업**:
  - LineSearchStrategy 클래스 구현
  - 라인 검색 로직 이동
- **예상 시간**: 1.5시간
- **검증 방법**: Line 검색 테스트 실행

#### Step 3.2: SectionSearchStrategy 분리
- **파일**: `src/search/strategies/SectionSearchStrategy.ts` (신규)
- **이동할 메서드**: `filterBySection()` (라인 730~818)
- **작업**:
  - SectionSearchStrategy 클래스 구현
  - 섹션 검색 로직 이동
- **예상 시간**: 2시간
- **검증 방법**: Section 검색 테스트 실행

#### Step 3.3: MatchSearchStrategy 분리
- **파일**: `src/search/strategies/MatchSearchStrategy.ts` (신규)
- **이동할 메서드**: `filterByMatch()` (라인 819~852)
- **작업**:
  - MatchSearchStrategy 클래스 구현
  - Match 검색 로직 이동
- **예상 시간**: 1.5시간
- **검증 방법**: Match 검색 테스트 실행

#### Step 3.4: TaskSearchStrategy 분리
- **파일**: `src/search/strategies/TaskSearchStrategy.ts` (신규)
- **이동할 메서드**: `filterByTask()` (라인 853~)
- **작업**:
  - TaskSearchStrategy 클래스 구현
  - Task 검색 로직 이동
- **예상 시간**: 1.5시간
- **검증 방법**: Task 검색 테스트 실행

#### Step 3.5: 통합 테스트
- **작업**:
  - 전체 테스트 스위트 실행
  - 모든 검색 타입 수동 테스트
- **예상 시간**: 1시간
- **검증 방법**: 49/49 test suites passed
- **Git**: Phase 3 완료 시점에 commit

---

### Phase 4: SearchEngine 리팩토링 (위험도: 높음)

#### Step 4.1: 전략 레지스트리 구현
- **파일**: `src/search/SearchEngine.ts`
- **작업**:
  - `strategies: Map<string, SearchStrategy>` 필드 추가
  - `registerDefaultStrategies()` 메서드 구현
  - `registerStrategy()` 메서드 구현 (확장성)
- **예상 시간**: 1시간
- **검증 방법**: TypeScript 컴파일 성공, 기존 테스트 실행

#### Step 4.2: filterByQuerySync 리팩토링
- **파일**: `src/search/SearchEngine.ts`
- **대상 메서드**: `filterByQuerySync()` (라인 442~493)
- **작업**:
  - switch-case 문을 전략 조회로 대체:
  ```typescript
  private filterByQuerySync(files: TFile[], query: SearchQuery, caseSensitive: boolean): TFile[] {
    const strategy = this.strategies.get(query.type);
    if (!strategy) {
      this.logger.warn('Search', `Unknown query type: ${query.type}`);
      return files;
    }
    return strategy.executeSync(query.value, files, caseSensitive);
  }
  ```
- **예상 시간**: 1.5시간
- **검증 방법**: 동기 검색 테스트 실행

#### Step 4.3: filterByQuery (async) 리팩토링
- **파일**: `src/search/SearchEngine.ts`
- **대상 메서드**: `filterByQuery()` (라인 494~570)
- **작업**:
  - switch-case 문을 전략 조회로 대체
  - 비동기 검색 로직 간소화
- **예상 시간**: 1.5시간
- **검증 방법**: 비동기 검색 테스트 실행

#### Step 4.4: 고급 검색 로직 간소화
- **파일**: `src/search/SearchEngine.ts`
- **대상 메서드**:
  - `advancedSearch()` (라인 344~400)
  - `advancedSearchSync()` (라인 293~343)
- **작업**:
  - 전략 패턴 활용으로 코드 간소화
  - 중복 로직 제거
- **예상 시간**: 2시간
- **검증 방법**: 고급 검색 테스트 실행

#### Step 4.5: 불필요한 메서드 제거
- **파일**: `src/search/SearchEngine.ts`
- **작업**:
  - 전략 클래스로 이동된 메서드 삭제
  - 사용하지 않는 헬퍼 메서드 정리
  - import 문 정리
- **예상 시간**: 1시간
- **검증 방법**: 사용되지 않는 코드 없음 확인

#### Step 4.6: 최종 통합 테스트
- **작업**:
  - 전체 테스트 스위트 실행
  - 모든 검색 기능 수동 테스트
  - 성능 테스트 (모듈화 전후 비교)
  - 메모리 사용량 확인
  - ⭐ **TieredCache 호환성 확인**: 캐시 히트율 유지 여부 검증
- **예상 시간**: 2시간
- **검증 방법**:
  - 49/49 test suites passed
  - 성능 저하 없음
  - 메모리 사용량 증가 없음
  - ⭐ 캐시 히트율 85% 유지 확인
- **Git**: Phase 4 완료 시점에 commit

---

### Phase 5: 정리 및 문서화 (위험도: 낮음)

#### Step 5.1: 전략 인덱스 파일 생성
- **파일**: `src/search/strategies/index.ts` (신규)
- **작업**:
  - 모든 전략 클래스 export
  ```typescript
  export * from './types';
  export * from './BaseSearchStrategy';
  export * from './PathSearchStrategy';
  export * from './ContentSearchStrategy';
  // ... 나머지 전략
  ```
- **예상 시간**: 15분

#### Step 5.2: JSDoc 추가
- **작업**:
  - 각 전략 클래스에 JSDoc 추가
  - 메서드별 설명 추가
  - 사용 예제 추가
- **예상 시간**: 2시간

#### Step 5.3: 아키텍처 문서 작성
- **파일**: `docs/SEARCHENGINE_ARCHITECTURE.md` (신규, 선택사항)
- **내용**:
  - 전략 패턴 설명
  - 각 전략 클래스 역할
  - 새로운 전략 추가 방법
  - 다이어그램 (선택사항)
- **예상 시간**: 1시간 (선택사항)

#### Step 5.4: OPTIMIZATION_PLAN.md 업데이트
- **파일**: `OPTIMIZATION_PLAN.md`
- **작업**:
  - Phase 2.2 상태를 ✅ 완료로 변경
  - 구현 내용 기록
  - 성능 측정 결과 기록
- **예상 시간**: 30분

#### Step 5.5: 최종 검증
- **작업**:
  - 코드 리뷰 (self-review)
  - 라인 수 확인:
    - SearchEngine.ts: 1,564줄 → ~300줄 목표
  - 성능 벤치마크 결과 기록
  - 테스트 커버리지 확인
- **예상 시간**: 1시간
- **Git**: Phase 5 완료 시점에 최종 commit

---

## 리스크 관리

### 캐시 계층화 완료 후 이점
- ✅ **캐시 레이어가 안정화됨**: TieredCache가 이미 검증됨
- ✅ **리스크 감소**: SearchEngine 모듈화 시 캐시 관련 문제 발생 가능성 낮음
- ✅ **테스트 범위 축소**: 검색 로직에만 집중, 캐시는 검증 완료 상태
- ✅ **성능 기준 명확**: 캐시 히트율 85% 유지가 목표

### 고위험 작업
- **Phase 4: SearchEngine 리팩토링**
  - 위험: 기존 기능 손상, 성능 저하
  - 대응책:
    - 각 Step마다 테스트 실행
    - 성능 벤치마크 비교
    - ⭐ TieredCache 통계 모니터링 (히트율 확인)
    - 문제 발생 시 즉시 rollback

### 중위험 작업
- **Phase 2-3: 전략 분리**
  - 위험: 로직 이동 시 버그 발생
  - 대응책:
    - 한 번에 하나씩 분리
    - 각 분리마다 테스트 실행
    - 단위 테스트 작성 (가능한 경우)

### 롤백 전략
1. **Phase별 브랜치 생성**:
   - `feature/searchengine-modularization-phase1`
   - `feature/searchengine-modularization-phase2`
   - `feature/searchengine-modularization-phase3`
   - `feature/searchengine-modularization-phase4`
   - `feature/searchengine-modularization-phase5`

2. **Phase별 태그 생성**:
   - `searchengine-mod-phase1-complete`
   - `searchengine-mod-phase2-complete`
   - 등등...

3. **문제 발생 시**:
   - 해당 Phase 브랜치로 checkout
   - 문제 원인 파악 및 수정
   - 수정 후 다음 Phase 진행

### 테스트 전략
1. **단위 테스트**:
   - 각 전략 클래스별 독립 테스트 작성 (선택사항)

2. **통합 테스트**:
   - 기존 테스트 스위트 활용
   - 각 Phase 완료 시 전체 테스트 실행

3. **성능 테스트**:
   - Phase 1 시작 전 기준 성능 측정
   - Phase 4 완료 후 성능 비교
   - 검색 속도, 메모리 사용량 비교

4. **수동 테스트**:
   - 각 검색 타입별 수동 테스트
   - 엣지 케이스 테스트

---

## 성공 기준

### 코드 품질
- ✅ SearchEngine.ts 라인 수: 1,564줄 → ~300줄
- ✅ 각 전략 클래스 크기: 100~200줄 이내
- ✅ 순환 의존성 없음
- ✅ TypeScript 컴파일 오류 없음

### 기능 정확성
- ✅ 모든 기존 테스트 통과 (49/49 test suites)
- ✅ 모든 검색 타입 정상 작동
- ✅ 고급 검색 기능 정상 작동

### 성능
- ✅ 검색 속도: 이전과 동일하거나 향상
- ✅ 메모리 사용량: 10% 이내 증가 허용
- ✅ **캐시 히트율: 85% 유지** (TieredCache 기준)

### 확장성
- ✅ 새로운 검색 전략 추가 가능
- ✅ 기존 코드 수정 없이 전략 추가 가능
- ✅ `registerStrategy()` API 제공

### 유지보수성
- ✅ 각 전략 클래스 독립적 수정 가능
- ✅ 명확한 책임 분리
- ✅ 코드 중복 최소화

---

## 예상 소요 시간

| Phase | 작업 시간 | 테스트 시간 | 합계 |
|-------|----------|-----------|------|
| Phase 1 | 3.5시간 | 0.5시간 | 4시간 |
| Phase 2 | 8시간 | 1시간 | 9시간 |
| Phase 3 | 7.5시간 | 1시간 | 8.5시간 |
| Phase 4 | 9시간 | 2시간 | 11시간 |
| Phase 5 | 3.75시간 | 1시간 | 4.75시간 |
| **총계** | **31.75시간** | **5.5시간** | **37.25시간** |

**예상 완료 기간**: 5-7일 (하루 6-8시간 작업 기준)

---

## 추가 고려사항

### 캐시 계층화와의 통합
- ✅ **TieredCache 활용**: 이미 구현된 3단계 캐시 시스템 사용
- ✅ **L3 캐시 최적화**: 메타데이터 기반 검색(path, tag, property)은 L3 캐시에서 처리
- ⚠️ **주의사항**: 전략 클래스에서 직접 캐시 접근하지 않음 (SearchEngine이 관리)

### 성능 최적화
- 전략 인스턴스 재사용 (싱글톤 패턴)
- 전략 조회 캐싱 (필요한 경우)
- ⭐ TieredCache와의 시너지 효과 활용

### 확장 가능성
- 플러그인 시스템으로 확장 (미래)
- 사용자 정의 검색 전략 지원 (미래)

### 테스트 개선
- 각 전략별 단위 테스트 작성 (선택사항)
- 통합 테스트 강화
- ⭐ 캐시 히트율 테스트 추가

### 문서화
- 아키텍처 다이어그램 추가 (선택사항)
- 개발자 가이드 작성 (선택사항)
- ⭐ TieredCache와 Strategy Pattern 통합 문서

---

## 체크리스트

### Phase 1
- [ ] Step 1.1: 전략 인터페이스 정의
- [ ] Step 1.2: 기본 전략 클래스 구현
- [ ] Step 1.3: PathSearchStrategy 분리
- [ ] Step 1.4: 통합 테스트
- [ ] Git commit (Phase 1 완료)

### Phase 2
- [ ] Step 2.1: ContentSearchStrategy 분리
- [ ] Step 2.2: TagSearchStrategy 분리
- [ ] Step 2.3: PropertySearchStrategy 분리
- [ ] Step 2.4: RegexSearchStrategy 분리
- [ ] Step 2.5: 통합 테스트
- [ ] Git commit (Phase 2 완료)

### Phase 3
- [ ] Step 3.1: LineSearchStrategy 분리
- [ ] Step 3.2: SectionSearchStrategy 분리
- [ ] Step 3.3: MatchSearchStrategy 분리
- [ ] Step 3.4: TaskSearchStrategy 분리
- [ ] Step 3.5: 통합 테스트
- [ ] Git commit (Phase 3 완료)

### Phase 4
- [ ] Step 4.1: 전략 레지스트리 구현
- [ ] Step 4.2: filterByQuerySync 리팩토링
- [ ] Step 4.3: filterByQuery (async) 리팩토링
- [ ] Step 4.4: 고급 검색 로직 간소화
- [ ] Step 4.5: 불필요한 메서드 제거
- [ ] Step 4.6: 최종 통합 테스트
- [ ] Git commit (Phase 4 완료)

### Phase 5
- [ ] Step 5.1: 전략 인덱스 파일 생성
- [ ] Step 5.2: JSDoc 추가
- [ ] Step 5.3: 아키텍처 문서 작성 (선택)
- [ ] Step 5.4: OPTIMIZATION_PLAN.md 업데이트
- [ ] Step 5.5: 최종 검증
- [ ] Git commit (Phase 5 완료)

---

## 참고 자료

### 디자인 패턴
- Strategy Pattern: https://refactoring.guru/design-patterns/strategy

### 관련 이슈
- OPTIMIZATION_PLAN.md - Section 2.1 (SearchEngine 모듈화)
- CACHE_TIERING_PLAN.md (캐시 계층화, 선행 작업)

### 관련 파일
- `src/search/SearchEngine.ts` (리팩토링 대상)
- `src/search/SearchParser.ts` (참조)
- `src/search/cache/TieredCache.ts` (⭐ 이미 구현됨, 캐시 계층화)
- `src/types.ts` (타입 정의 참조)

### 선행 작업
- ✅ **캐시 계층화 (Section 1.2)**: 반드시 먼저 완료되어야 함
  - TieredCache 구현 완료
  - L1/L2/L3 캐시 시스템 안정화
  - 캐시 히트율 85% 달성

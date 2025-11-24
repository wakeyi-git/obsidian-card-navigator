# 캐시 계층화 (Cache Tiering) 구현 계획

## 개요

**목표**: 검색 캐시를 3단계로 계층화하여 메모리 효율성과 캐시 히트율을 동시에 개선합니다.

**예상 결과**:
- 캐시 히트율: 60% → 85%
- 메모리 사용량: 20% 감소
- 검색 응답 시간: 30% 감소
- 대규모 볼트(1000개 이상 파일)에서 성능 향상

**난이도**: 상
**리스크**: 고위험 - 복잡도 증가, 버그 가능성

---

## 현황 분석

### 현재 캐시 구조
- **파일**: `src/search/SearchEngine.ts`
- **캐시 구현**: 단일 LRU 캐시 (최대 50개 항목)
- **캐시 키**: `query + files + caseSensitive`
- **무효화 전략**:
  - 파일 생성/삭제/이름 변경: 전체 캐시 삭제
  - 파일 수정: 선택적 캐시 무효화 (✅ 이미 구현됨)

### 문제점
1. **단일 레벨 캐시의 한계**:
   - 모든 검색 결과를 동일한 우선순위로 관리
   - 자주 사용하는 쿼리와 일회성 쿼리가 구분되지 않음
   - LRU 정책으로 인해 자주 사용하는 쿼리도 제거될 수 있음

2. **메모리 비효율**:
   - 대량의 검색 결과를 모두 메모리에 유지
   - 캐시 크기 고정 (50개)으로 유연성 부족
   - 메타데이터만 필요한 경우도 전체 파일 목록 저장

3. **캐시 히트율 최적화 부족**:
   - 사용 빈도를 고려하지 않음
   - 최근 사용만 고려 (LRU)
   - 쿼리 패턴 분석 없음

### 현재 성능 지표 (추정)
- 캐시 히트율: ~60%
- 평균 검색 시간: 100ms (1000개 파일 기준)
- 메모리 사용량: 검색 결과 × 50개

---

## 아키텍처 설계

### 3단계 캐시 전략

```
┌─────────────────────────────────────────────────────────────┐
│                     검색 요청                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────────┐
│ L1 Cache (Hot) - 최근 사용 (LRU)                              │
│ - 크기: 10개                                                  │
│ - 전략: LRU (Least Recently Used)                            │
│ - 대상: 방금 검색한 쿼리                                       │
│ - 히트율: ~30% (예상)                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ Miss
                       ↓
┌──────────────────────────────────────────────────────────────┐
│ L2 Cache (Warm) - 자주 사용 (LFU)                             │
│ - 크기: 40개                                                  │
│ - 전략: LFU (Least Frequently Used)                          │
│ - 대상: 자주 반복되는 쿼리                                     │
│ - 히트율: ~40% (예상)                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ Miss
                       ↓
┌──────────────────────────────────────────────────────────────┐
│ L3 Cache (Cold) - 메타데이터 (Obsidian MetadataCache 활용)    │
│ - 크기: 무제한 (Obsidian 제공)                                │
│ - 전략: 파일 메타데이터만 저장 (경로, 태그, 속성)              │
│ - 대상: 메타데이터 기반 검색                                  │
│ - 히트율: ~15% (예상)                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ Miss
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                   실제 검색 실행                               │
│ - 파일 스캔, 내용 읽기, 필터링                                │
└──────────────────────────────────────────────────────────────┘
```

### 캐시 레벨별 특성

| 레벨 | 이름 | 크기 | 전략 | 대상 | 예상 히트율 | TTL |
|------|------|------|------|------|------------|-----|
| L1 | Hot | 10개 | LRU | 방금 검색한 쿼리 | 30% | 5분 |
| L2 | Warm | 40개 | LFU | 자주 사용하는 쿼리 | 40% | 30분 |
| L3 | Cold | 무제한 | Metadata | 메타데이터 기반 검색 | 15% | 영구 |

**총 예상 히트율**: 85% (30% + 40% + 15%)

---

## 상세 설계

### 데이터 구조

```typescript
// src/search/cache/TieredCache.ts (신규)

/**
 * 캐시 엔트리
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  hitCount: number;
  affectedFiles: Set<string>;
}

/**
 * 캐시 통계
 */
interface CacheStats {
  l1Hits: number;
  l2Hits: number;
  l3Hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
}

/**
 * L1 캐시 (Hot) - 최근 사용
 */
class HotCache<T> {
  private cache: LRUCache<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number; // 5분

  constructor(maxSize: number = 10, ttl: number = 5 * 60 * 1000) {
    this.cache = new LRUCache<string, CacheEntry<T>>(maxSize);
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // TTL 체크
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    entry.hitCount++;
    return entry.value;
  }

  set(key: string, value: T, affectedFiles: Set<string>): void {
    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      hitCount: 1,
      affectedFiles
    });
  }

  invalidate(filePath: string): number {
    let count = 0;
    for (const [key, entry] of this.cache['cache'].entries()) {
      if (entry.affectedFiles.has(filePath)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  // 히트 카운트가 높은 엔트리를 L2로 승격
  getPromotionCandidates(threshold: number = 3): CacheEntry<T>[] {
    const entries: CacheEntry<T>[] = [];
    for (const entry of this.cache['cache'].values()) {
      if (entry.hitCount >= threshold) {
        entries.push(entry);
      }
    }
    return entries;
  }
}

/**
 * L2 캐시 (Warm) - 자주 사용
 */
class WarmCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number; // 30분

  constructor(maxSize: number = 40, ttl: number = 30 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // TTL 체크
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    entry.hitCount++;
    entry.timestamp = Date.now(); // TTL 갱신
    return entry.value;
  }

  set(key: string, value: T, affectedFiles: Set<string>): void {
    // 크기 초과 시 가장 적게 사용된 항목 제거 (LFU)
    if (this.cache.size >= this.maxSize) {
      this.evictLeastFrequent();
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      hitCount: 1,
      affectedFiles
    });
  }

  private evictLeastFrequent(): void {
    let minHitCount = Infinity;
    let leastFrequentKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hitCount < minHitCount) {
        minHitCount = entry.hitCount;
        leastFrequentKey = key;
      }
    }

    if (leastFrequentKey) {
      this.cache.delete(leastFrequentKey);
    }
  }

  invalidate(filePath: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.affectedFiles.has(filePath)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * L3 캐시 (Cold) - 메타데이터
 */
class ColdCache {
  private app: App;
  private logger: DebugLogger;

  constructor(app: App, logger: DebugLogger) {
    this.app = app;
    this.logger = logger;
  }

  /**
   * 메타데이터 기반 검색 (Obsidian MetadataCache 활용)
   *
   * @remarks
   * 경로, 태그, 속성 검색은 Obsidian MetadataCache를 활용하여
   * 별도 캐싱 없이도 빠른 검색 가능
   */
  searchByMetadata(query: SearchQuery, files: TFile[]): TFile[] | undefined {
    // 메타데이터 기반 검색만 지원
    if (!this.isMetadataQuery(query)) {
      return undefined;
    }

    try {
      switch (query.type) {
        case 'path':
          return this.searchByPath(files, query.value);
        case 'tag':
          return this.searchByTag(files, query.value);
        case 'property':
          return this.searchByProperty(files, query.value);
        default:
          return undefined;
      }
    } catch (error) {
      this.logger.error('Cache', 'L3 캐시 검색 실패', error);
      return undefined;
    }
  }

  private isMetadataQuery(query: SearchQuery): boolean {
    return ['path', 'tag', 'property'].includes(query.type);
  }

  private searchByPath(files: TFile[], path: string): TFile[] {
    const lowerPath = path.toLowerCase();
    return files.filter(file =>
      file.path.toLowerCase().includes(lowerPath)
    );
  }

  private searchByTag(files: TFile[], tag: string): TFile[] {
    const results: TFile[] = [];
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;

      const tags = cache.tags?.map(t => t.tag) || [];
      if (tags.some(t => t.includes(tag))) {
        results.push(file);
      }
    }
    return results;
  }

  private searchByProperty(files: TFile[], property: string): TFile[] {
    const [key, value] = property.split(':');
    const results: TFile[] = [];

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;

      if (value) {
        if (cache.frontmatter[key] === value) {
          results.push(file);
        }
      } else {
        if (key in cache.frontmatter) {
          results.push(file);
        }
      }
    }
    return results;
  }
}

/**
 * 3단계 캐시 시스템
 */
export class TieredCache {
  private hotCache: HotCache<TFile[]>;
  private warmCache: WarmCache<TFile[]>;
  private coldCache: ColdCache;
  private logger: DebugLogger;

  // 통계
  private stats: CacheStats = {
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    misses: 0,
    totalRequests: 0,
    hitRate: 0
  };

  constructor(app: App, logger: DebugLogger) {
    this.hotCache = new HotCache<TFile[]>(10);
    this.warmCache = new WarmCache<TFile[]>(40);
    this.coldCache = new ColdCache(app, logger);
    this.logger = logger;

    // 주기적으로 L1 → L2 승격 (30초마다)
    this.startPromotionScheduler();
  }

  /**
   * 캐시에서 검색
   */
  get(key: string, query?: SearchQuery, files?: TFile[]): TFile[] | undefined {
    this.stats.totalRequests++;

    // L1 캐시 조회
    const l1Result = this.hotCache.get(key);
    if (l1Result !== undefined) {
      this.stats.l1Hits++;
      this.updateHitRate();
      this.logger.debug('Cache', `L1 Hit: ${key}`);
      return l1Result;
    }

    // L2 캐시 조회
    const l2Result = this.warmCache.get(key);
    if (l2Result !== undefined) {
      this.stats.l2Hits++;
      this.updateHitRate();
      this.logger.debug('Cache', `L2 Hit: ${key}`);

      // L2 히트 시 L1에도 추가 (Hot으로 승격)
      this.hotCache.set(key, l2Result, new Set(l2Result.map(f => f.path)));
      return l2Result;
    }

    // L3 캐시 조회 (메타데이터)
    if (query && files) {
      const l3Result = this.coldCache.searchByMetadata(query, files);
      if (l3Result !== undefined) {
        this.stats.l3Hits++;
        this.updateHitRate();
        this.logger.debug('Cache', `L3 Hit: ${key}`);

        // L3 히트 시 L1에 추가
        this.hotCache.set(key, l3Result, new Set(l3Result.map(f => f.path)));
        return l3Result;
      }
    }

    // 캐시 미스
    this.stats.misses++;
    this.updateHitRate();
    return undefined;
  }

  /**
   * 캐시에 저장
   */
  set(key: string, value: TFile[]): void {
    const affectedFiles = new Set(value.map(f => f.path));

    // L1에 저장
    this.hotCache.set(key, value, affectedFiles);
  }

  /**
   * 특정 파일과 관련된 캐시 무효화
   */
  invalidate(filePath: string): void {
    const l1Count = this.hotCache.invalidate(filePath);
    const l2Count = this.warmCache.invalidate(filePath);

    this.logger.debug('Cache', `캐시 무효화: L1=${l1Count}, L2=${l2Count}`, {
      file: filePath
    });
  }

  /**
   * 전체 캐시 삭제
   */
  clear(): void {
    this.hotCache.clear();
    this.warmCache.clear();
    this.resetStats();
  }

  /**
   * 캐시 통계 조회
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 통계 초기화
   */
  private resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0,
      totalRequests: 0,
      hitRate: 0
    };
  }

  /**
   * 히트율 업데이트
   */
  private updateHitRate(): void {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits;
    this.stats.hitRate = this.stats.totalRequests > 0
      ? totalHits / this.stats.totalRequests
      : 0;
  }

  /**
   * L1 → L2 승격 스케줄러
   */
  private startPromotionScheduler(): void {
    setInterval(() => {
      const candidates = this.hotCache.getPromotionCandidates(3);
      for (const entry of candidates) {
        this.warmCache.set(entry.key, entry.value, entry.affectedFiles);
        this.logger.debug('Cache', `L1 → L2 승격: ${entry.key} (hitCount: ${entry.hitCount})`);
      }
    }, 30000); // 30초마다
  }

  /**
   * 캐시 크기 조회
   */
  get size(): { l1: number; l2: number; total: number } {
    return {
      l1: this.hotCache.size,
      l2: this.warmCache.size,
      total: this.hotCache.size + this.warmCache.size
    };
  }
}
```

---

## 구현 단계

### Phase 1: 기본 인프라 구축 (위험도: 낮음)

#### Step 1.1: TieredCache 파일 구조 생성
- **파일**: `src/search/cache/` 디렉토리 생성
- **작업**:
  - `src/search/cache/TieredCache.ts` (신규)
  - `src/search/cache/HotCache.ts` (신규)
  - `src/search/cache/WarmCache.ts` (신규)
  - `src/search/cache/ColdCache.ts` (신규)
  - `src/search/cache/types.ts` (신규)
  - `src/search/cache/index.ts` (신규)
- **예상 시간**: 30분
- **검증 방법**: 파일 구조 확인, TypeScript 컴파일 성공

#### Step 1.2: 공통 타입 정의
- **파일**: `src/search/cache/types.ts`
- **작업**:
  - `CacheEntry` 인터페이스 정의
  - `CacheStats` 인터페이스 정의
  - `CacheLevel` enum 정의
- **예상 시간**: 30분
- **검증 방법**: TypeScript 컴파일 성공

#### Step 1.3: HotCache 구현 (L1)
- **파일**: `src/search/cache/HotCache.ts`
- **작업**:
  - LRU 기반 캐시 구현
  - TTL 기능 추가 (5분)
  - 히트 카운트 추적
  - 승격 후보 조회 메서드
- **예상 시간**: 2시간
- **검증 방법**: 단위 테스트 작성 (선택)

#### Step 1.4: WarmCache 구현 (L2)
- **파일**: `src/search/cache/WarmCache.ts`
- **작업**:
  - LFU 기반 캐시 구현
  - TTL 기능 추가 (30분)
  - 히트 카운트 기반 제거 정책
- **예상 시간**: 2시간
- **검증 방법**: 단위 테스트 작성 (선택)

#### Step 1.5: ColdCache 구현 (L3)
- **파일**: `src/search/cache/ColdCache.ts`
- **작업**:
  - Obsidian MetadataCache 활용
  - 메타데이터 기반 검색 (path, tag, property)
  - 검색 결과 반환
- **예상 시간**: 2시간
- **검증 방법**: 메타데이터 검색 테스트

---

### Phase 2: TieredCache 통합 (위험도: 중간)

#### Step 2.1: TieredCache 클래스 구현
- **파일**: `src/search/cache/TieredCache.ts`
- **작업**:
  - 3개 캐시 레벨 통합
  - `get()` 메서드: L1 → L2 → L3 순서로 조회
  - `set()` 메서드: L1에 저장
  - 캐시 통계 추적
- **예상 시간**: 3시간
- **검증 방법**: 통합 테스트

#### Step 2.2: 승격 스케줄러 구현
- **파일**: `src/search/cache/TieredCache.ts`
- **작업**:
  - L1 → L2 자동 승격 (30초마다)
  - 히트 카운트 기반 승격 (threshold: 3)
  - 승격 로그 출력
- **예상 시간**: 1.5시간
- **검증 방법**: 승격 로직 테스트

#### Step 2.3: 캐시 무효화 구현
- **파일**: `src/search/cache/TieredCache.ts`
- **작업**:
  - `invalidate()` 메서드: 특정 파일 관련 캐시 삭제
  - L1, L2, L3 모두 무효화
  - 무효화 통계 기록
- **예상 시간**: 1시간
- **검증 방법**: 무효화 테스트

---

### Phase 3: SearchEngine 통합 (위험도: 높음)

#### Step 3.1: SearchEngine에 TieredCache 통합
- **파일**: `src/search/SearchEngine.ts`
- **작업**:
  - 기존 `searchCache` 제거
  - `TieredCache` 인스턴스 추가
  - 생성자에서 TieredCache 초기화
- **예상 시간**: 1시간
- **검증 방법**: TypeScript 컴파일 성공

#### Step 3.2: search() 메서드 리팩토링
- **파일**: `src/search/SearchEngine.ts`
- **대상 메서드**: `search()` (라인 175~)
- **작업**:
  - TieredCache.get() 호출로 변경
  - 캐시 미스 시 검색 실행 후 TieredCache.set() 호출
  - ParsedQuery를 TieredCache.get()에 전달 (L3 캐시용)
- **예상 시간**: 2시간
- **검증 방법**: 검색 테스트 실행

#### Step 3.3: searchSync() 메서드 리팩토링
- **파일**: `src/search/SearchEngine.ts`
- **대상 메서드**: `searchSync()` (라인 127~)
- **작업**:
  - TieredCache.get() 호출로 변경
  - 동기 검색 로직 유지
- **예상 시간**: 1.5시간
- **검증 방법**: 동기 검색 테스트 실행

#### Step 3.4: 캐시 무효화 업데이트
- **파일**: `src/search/SearchEngine.ts`
- **대상 메서드**: `setupCacheInvalidation()`, `invalidateCacheForFile()`
- **작업**:
  - TieredCache.invalidate() 호출로 변경
  - TieredCache.clear() 호출로 변경
  - 기존 `cacheAffectedFiles` Map 제거 (TieredCache에서 관리)
- **예상 시간**: 1시간
- **검증 방법**: 캐시 무효화 테스트

#### Step 3.5: 통합 테스트
- **작업**:
  - 전체 테스트 스위트 실행
  - 모든 검색 기능 수동 테스트
  - 캐시 히트율 확인
- **예상 시간**: 2시간
- **검증 방법**: 49/49 test suites passed
- **Git**: Phase 3 완료 시점에 commit

---

### Phase 4: 성능 최적화 및 모니터링 (위험도: 중간)

#### Step 4.1: 캐시 통계 UI 추가 (선택)
- **파일**: `src/settings.ts` (선택)
- **작업**:
  - 설정 페이지에 캐시 통계 섹션 추가
  - L1/L2/L3 히트율 표시
  - 총 히트율 표시
  - 캐시 크기 표시
  - 캐시 초기화 버튼
- **예상 시간**: 2시간 (선택)
- **검증 방법**: 설정 페이지 확인

#### Step 4.2: 성능 벤치마크
- **작업**:
  - 캐시 히트율 측정
  - 검색 응답 시간 측정 (이전 vs 이후)
  - 메모리 사용량 측정
  - 대규모 볼트(1000개 파일) 테스트
- **예상 시간**: 2시간
- **검증 방법**: 성능 지표 비교

#### Step 4.3: 캐시 크기 자동 조정 (선택)
- **파일**: `src/search/cache/TieredCache.ts`
- **작업**:
  - 사용 패턴에 따라 L1/L2 크기 동적 조정
  - 메모리 사용량 기반 크기 조정
  - 설정에서 수동 조정 가능
- **예상 시간**: 3시간 (선택)
- **검증 방법**: 동적 크기 조정 테스트

#### Step 4.4: 디버그 로깅 추가
- **파일**: `src/search/cache/TieredCache.ts`
- **작업**:
  - 각 레벨별 히트/미스 로그
  - 승격 로그
  - 무효화 로그
  - 성능 지표 로그
- **예상 시간**: 1시간
- **검증 방법**: 로그 출력 확인

---

### Phase 5: 정리 및 문서화 (위험도: 낮음)

#### Step 5.1: JSDoc 추가
- **작업**:
  - TieredCache 클래스 JSDoc
  - 각 메서드 설명 추가
  - 사용 예제 추가
- **예상 시간**: 1.5시간

#### Step 5.2: 아키텍처 문서 작성 (선택)
- **파일**: `docs/CACHE_ARCHITECTURE.md` (신규, 선택)
- **내용**:
  - 3단계 캐시 구조 설명
  - 각 레벨별 특성
  - 승격/강등 정책
  - 성능 측정 결과
  - 다이어그램
- **예상 시간**: 2시간 (선택)

#### Step 5.3: OPTIMIZATION_PLAN.md 업데이트
- **파일**: `OPTIMIZATION_PLAN.md`
- **작업**:
  - Phase 3.3 상태를 ✅ 완료로 변경
  - 구현 내용 기록
  - 성능 측정 결과 기록
  - 캐시 히트율 개선 결과 기록
- **예상 시간**: 30분

#### Step 5.4: 최종 검증
- **작업**:
  - 코드 리뷰 (self-review)
  - 전체 테스트 실행
  - 성능 벤치마크 최종 확인
  - 메모리 누수 확인
- **예상 시간**: 1.5시간
- **Git**: Phase 5 완료 시점에 최종 commit

---

## 리스크 관리

### 고위험 작업
- **Phase 3: SearchEngine 통합**
  - 위험: 기존 검색 기능 손상, 성능 저하
  - 대응책:
    - 단계별 리팩토링 및 테스트
    - 각 Step마다 기존 테스트 실행
    - 성능 벤치마크 비교
    - 문제 발생 시 즉시 rollback

### 중위험 작업
- **Phase 2: TieredCache 통합**
  - 위험: 캐시 로직 버그, 메모리 누수
  - 대응책:
    - 각 캐시 레벨 독립 테스트
    - 메모리 사용량 모니터링
    - TTL 기능 철저히 테스트

### 저위험 작업
- **Phase 1: 기본 인프라 구축**
  - 위험: 낮음 (기존 코드 수정 없음)
  - 대응책: 단위 테스트 작성

### 롤백 전략
1. **Phase별 브랜치 생성**:
   - `feature/cache-tiering-phase1`
   - `feature/cache-tiering-phase2`
   - `feature/cache-tiering-phase3`
   - `feature/cache-tiering-phase4`
   - `feature/cache-tiering-phase5`

2. **Phase별 태그 생성**:
   - `cache-tiering-phase1-complete`
   - `cache-tiering-phase2-complete`
   - 등등...

3. **문제 발생 시**:
   - 해당 Phase 브랜치로 checkout
   - 문제 원인 파악 및 수정
   - 수정 후 다음 Phase 진행

### 메모리 관리
1. **메모리 사용량 모니터링**:
   - L1 + L2 캐시 크기 제한
   - 큰 검색 결과는 압축 저장 고려

2. **TTL 기반 자동 정리**:
   - L1: 5분 후 자동 삭제
   - L2: 30분 후 자동 삭제

3. **메모리 압박 시 대응**:
   - L2 크기 동적 감소
   - 강제 가비지 컬렉션 (필요 시)

---

## 성공 기준

### 성능 지표
- ✅ 캐시 히트율: 60% → 85% 이상
- ✅ 검색 응답 시간: 30% 감소
- ✅ 메모리 사용량: 20% 감소 또는 유지
- ✅ 대규모 볼트 성능: 1000개 파일 기준 200ms 이내

### 기능 정확성
- ✅ 모든 기존 테스트 통과 (49/49 test suites)
- ✅ 모든 검색 타입 정상 작동
- ✅ 캐시 무효화 정상 작동
- ✅ L1 → L2 승격 정상 작동

### 코드 품질
- ✅ 모듈화된 캐시 구조
- ✅ 명확한 책임 분리 (L1/L2/L3)
- ✅ 메모리 누수 없음
- ✅ TypeScript 컴파일 오류 없음

### 확장성
- ✅ 캐시 레벨 추가 가능
- ✅ 캐시 정책 변경 가능
- ✅ 캐시 크기 조정 가능

---

## 예상 소요 시간

| Phase | 작업 시간 | 테스트 시간 | 합계 |
|-------|----------|-----------|------|
| Phase 1 | 7시간 | 1시간 | 8시간 |
| Phase 2 | 5.5시간 | 1시간 | 6.5시간 |
| Phase 3 | 7.5시간 | 2시간 | 9.5시간 |
| Phase 4 | 8시간 | 2시간 | 10시간 (4시간 필수 + 6시간 선택) |
| Phase 5 | 3.5시간 | 1.5시간 | 5시간 (3시간 필수 + 2시간 선택) |
| **총계 (필수)** | **23.5시간** | **6.5시간** | **30시간** |
| **총계 (선택 포함)** | **31.5시간** | **7.5시간** | **39시간** |

**예상 완료 기간**:
- 필수 작업: 4-5일 (하루 6-8시간 작업 기준)
- 선택 작업 포함: 5-7일

---

## 추가 고려사항

### A/B 테스트
- 일부 사용자에게만 TieredCache 적용
- 히트율 및 성능 비교
- 점진적 롤아웃

### 설정 옵션 제공
- 캐시 활성화/비활성화
- 캐시 크기 조정
- TTL 조정
- 통계 보기

### 향후 확장
- L4 캐시: IndexedDB 활용 (영구 저장)
- 분산 캐시: 멀티 윈도우 지원
- 캐시 프리로딩: 자주 사용하는 쿼리 미리 로드

### 성능 최적화
- 캐시 키 최적화 (해시 충돌 방지)
- 압축 알고리즘 적용 (큰 결과)
- 배치 무효화 (여러 파일 변경 시)

---

## 체크리스트

### Phase 1
- [ ] Step 1.1: TieredCache 파일 구조 생성
- [ ] Step 1.2: 공통 타입 정의
- [ ] Step 1.3: HotCache 구현 (L1)
- [ ] Step 1.4: WarmCache 구현 (L2)
- [ ] Step 1.5: ColdCache 구현 (L3)
- [ ] Git commit (Phase 1 완료)

### Phase 2
- [ ] Step 2.1: TieredCache 클래스 구현
- [ ] Step 2.2: 승격 스케줄러 구현
- [ ] Step 2.3: 캐시 무효화 구현
- [ ] Git commit (Phase 2 완료)

### Phase 3
- [ ] Step 3.1: SearchEngine에 TieredCache 통합
- [ ] Step 3.2: search() 메서드 리팩토링
- [ ] Step 3.3: searchSync() 메서드 리팩토링
- [ ] Step 3.4: 캐시 무효화 업데이트
- [ ] Step 3.5: 통합 테스트
- [ ] Git commit (Phase 3 완료)

### Phase 4
- [ ] Step 4.1: 캐시 통계 UI 추가 (선택)
- [ ] Step 4.2: 성능 벤치마크
- [ ] Step 4.3: 캐시 크기 자동 조정 (선택)
- [ ] Step 4.4: 디버그 로깅 추가
- [ ] Git commit (Phase 4 완료)

### Phase 5
- [ ] Step 5.1: JSDoc 추가
- [ ] Step 5.2: 아키텍처 문서 작성 (선택)
- [ ] Step 5.3: OPTIMIZATION_PLAN.md 업데이트
- [ ] Step 5.4: 최종 검증
- [ ] Git commit (Phase 5 완료)

---

## 성능 측정 계획

### 측정 지표
1. **캐시 히트율**:
   - L1 히트율
   - L2 히트율
   - L3 히트율
   - 총 히트율

2. **검색 응답 시간**:
   - 캐시 히트 시
   - 캐시 미스 시
   - 평균 응답 시간

3. **메모리 사용량**:
   - L1 캐시 크기
   - L2 캐시 크기
   - 총 메모리 사용량

4. **승격/강등 통계**:
   - L1 → L2 승격 횟수
   - L2 제거 횟수

### 테스트 시나리오
1. **일반 사용 패턴**:
   - 동일 쿼리 반복 검색
   - 다양한 쿼리 검색
   - 파일 수정 후 재검색

2. **대규모 볼트**:
   - 1000개 파일
   - 5000개 파일
   - 10000개 파일

3. **메타데이터 검색**:
   - path 검색
   - tag 검색
   - property 검색

### 기준선 측정 (현재)
- 캐시 히트율: ~60%
- 평균 검색 시간: 100ms (1000개 파일)
- 메모리 사용량: 검색 결과 × 50개

### 목표 (TieredCache 적용 후)
- 캐시 히트율: 85% 이상
- 평균 검색 시간: 70ms 이하 (30% 감소)
- 메모리 사용량: 현재 대비 80% 이하 (20% 감소)

---

## 참고 자료

### 캐시 전략
- LRU Cache: https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU
- LFU Cache: https://en.wikipedia.org/wiki/Least_frequently_used
- Multi-level Cache: https://en.wikipedia.org/wiki/Cache_hierarchy

### 관련 이슈
- OPTIMIZATION_PLAN.md - Section 1.2

### 관련 파일
- `src/search/SearchEngine.ts` (리팩토링 대상)
- `src/utils/memoize.ts` (LRUCache 참조)
- `src/types.ts` (타입 정의 참조)

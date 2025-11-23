# 🔧 레이아웃 버그 수정 요약 (2025-11-23)

## 📋 보고된 문제

사용자 보고:
1. **가로 모드가 활성화되지 않음**
2. **컨테이너 크기와 카드 너비 임계값에 따른 자동 열 추가/삭제가 동작하지 않음**

## 🔍 근본 원인 분석

### 1. 그룹화 모드에서 그리드 레이아웃 미적용 (🔥 주요 원인)

**문제:**
- `.card-group-content`에 `display: grid`만 설정되어 있고 `grid-template-columns/rows`가 없음
- 부모의 `--grid-columns` CSS 변수를 상속받지만, 이를 그리드 레이아웃에 적용하는 CSS 규칙이 없음
- 결과적으로 그룹화된 카드가 **1열로만 표시됨**

**코드 위치:** [styles.css:3417-3425](styles.css#L3417-L3425)

**수정 전:**
```css
.card-group-content {
    margin-top: var(--size-4-2);
    display: grid;
    gap: var(--card-gap);
    /* ❌ grid-template-columns가 없음! */
}
```

**수정 후:**
```css
/* 세로 모드: 그룹 컨테이너도 부모와 동일한 그리드 레이아웃 사용 */
.card-navigator-cards.vertical-mode .card-group-content {
    grid-template-columns: repeat(var(--grid-columns, 3), 1fr);  /* ✅ 추가 */
    grid-auto-rows: minmax(var(--card-min-height, 100px), auto);
    grid-auto-flow: row;
    overflow-x: hidden;
    overflow-y: visible;
}

/* 가로 모드: 그룹 컨테이너도 부모와 동일한 그리드 레이아웃 사용 */
.card-navigator-cards.horizontal-mode .card-group-content {
    grid-template-rows: repeat(var(--grid-rows, 2), 1fr);  /* ✅ 추가 */
    grid-auto-columns: minmax(var(--card-min-width, 150px), auto);
    grid-auto-flow: column;
    overflow-x: auto;
    overflow-y: hidden;
    /* ... */
}
```

**효과:**
- 그룹화된 카드가 올바른 열/행 개수로 표시됨
- 자동 열 조정이 그룹화 모드에서도 정상 작동

---

### 2. 초기 로딩 시 컨테이너 크기 문제

**문제:**
- LayoutManager 생성 시점에 `getBoundingClientRect()` 호출
- 이 시점에 컨테이너는 아직 렌더링되지 않았거나 크기가 0x0일 수 있음
- 잘못된 초기 크기로 인해 잘못된 모드가 설정됨

**코드 위치:** [LayoutManager.ts:34-40](src/layout/LayoutManager.ts#L34-L40)

**수정 전:**
```typescript
const rect = this.containerEl.getBoundingClientRect();
this.currentMode = this.detectLayoutMode(); // 0x0 크기로 잘못된 모드 감지
```

**수정 후:**
```typescript
const rect = this.containerEl.getBoundingClientRect();
if (rect.width < 10 || rect.height < 10) {
    this.currentMode = 'vertical'; // 기본값 사용
    this.logger.debug('Layout', 'LayoutManager 초기화 (컨테이너 크기 미확정, 기본 모드 사용)', {
        mode: this.currentMode,
        width: rect.width,
        height: rect.height,
        reason: '컨테이너 크기가 너무 작음'
    });
} else {
    this.currentMode = this.detectLayoutMode();
}
```

**효과:**
- 컨테이너가 올바른 크기를 갖게 되면 ResizeObserver가 트리거되어 자동으로 올바른 모드로 전환
- 초기 렌더링 실패 방지

---

### 3. 디버그 로깅 부족

**문제:**
- 레이아웃 업데이트가 실행되는지 확인하기 어려움
- CSS 변수와 클래스가 올바르게 적용되는지 확인 불가
- 크기 변화가 임계값을 초과하는지 확인 불가

**수정 내용:**

#### 2.1 초기화 로깅 개선
[LayoutManager.ts:44-49](src/layout/LayoutManager.ts#L44-L49)
```typescript
this.logger.debug('Layout', 'LayoutManager 초기화 (컨테이너 크기 미확정, 기본 모드 사용)', {
    mode: this.currentMode,
    width: rect.width,
    height: rect.height,
    reason: '컨테이너 크기가 너무 작음'
});
```

#### 2.2 ResizeObserver 로깅 개선
[LayoutManager.ts:115-123](src/layout/LayoutManager.ts#L115-L123)
```typescript
this.logger.debug('Layout', '레이아웃 업데이트 트리거', {
    modeChanged,
    oldMode: this.currentMode,
    newMode,
    widthChange: widthChange.toFixed(1),
    heightChange: heightChange.toFixed(1),
    threshold: this.SIZE_CHANGE_THRESHOLD,
    containerSize: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}`
});
```

#### 2.3 업데이트 건너뜀 로깅 추가
[LayoutManager.ts:132-138](src/layout/LayoutManager.ts#L132-L138)
```typescript
this.logger.debug('Layout', '레이아웃 업데이트 건너뜀', {
    widthChange: widthChange.toFixed(1),
    heightChange: heightChange.toFixed(1),
    threshold: this.SIZE_CHANGE_THRESHOLD,
    reason: '변화량이 임계값 미만'
});
```

#### 2.4 적용 완료 상태 로깅
[LayoutManager.ts:195-206](src/layout/LayoutManager.ts#L195-L206)
```typescript
this.logger.debug('Layout', '레이아웃 적용 완료', {
    mode,
    gridSize,
    hasGroups,
    appliedClasses: this.containerEl.className,
    cssVariables: {
        '--grid-columns': this.containerEl.style.getPropertyValue('--grid-columns'),
        '--grid-rows': this.containerEl.style.getPropertyValue('--grid-rows'),
        '--card-min-width': this.containerEl.style.getPropertyValue('--card-min-width'),
        '--card-min-height': this.containerEl.style.getPropertyValue('--card-min-height')
    }
});
```

**효과:**
- 사용자가 Debug Mode를 켜면 모든 레이아웃 변경을 Console에서 추적 가능
- 문제 발생 시 정확한 진단 가능

---

## ✅ 수정된 파일

### 1. [styles.css](styles.css) 🔥 핵심 수정
- `.card-group-content`에 세로 모드 그리드 레이아웃 추가 (3428-3434행)
- `.card-group-content`에 가로 모드 그리드 레이아웃 추가 (3437-3451행)
- **효과**: 그룹화된 카드가 올바른 열/행 개수로 표시됨

### 2. [LayoutManager.ts](src/layout/LayoutManager.ts)
- 초기화 시 컨테이너 크기 검증 추가 (42-57행)
- ResizeObserver 로깅 개선 (97-120행)
- updateLayout() 완료 상태 로깅 추가 (177-188행)

### 3. [ScrollManager.ts](src/navigation/ScrollManager.ts) ⭐ 가로 모드 스크롤 수정
- 가로 모드 감지 로직 추가 (62-69행)
- 가로 모드에서 `block: 'nearest'`, `inline: 'center'` 사용하도록 수정 (82-86행)
- **효과**: 가로 모드에서 활성 카드가 화면 수평 중앙으로 정확히 스크롤됨
- **원리**:
  - 세로 모드: `block='center'` (상하 중앙), `inline='nearest'` (좌우 최소)
  - 가로 모드: `block='nearest'` (상하 최소), `inline='center'` (좌우 중앙)

### 4. [DEBUG_LAYOUT.md](DEBUG_LAYOUT.md)
- 최신 업데이트 섹션 추가 (3-20행)
- 문제 해결 팁 업데이트 (215-223행)

### 5. [LAYOUT_FIX_SUMMARY.md](LAYOUT_FIX_SUMMARY.md)
- 이 문서 생성 (전체 수정 내역 요약)

---

## 🧪 테스트 결과

### 단위 테스트
```bash
npm test -- --testPathPattern=LayoutManager.test.ts
```
**결과:** ✅ 22/22 테스트 통과

### 전체 테스트
```bash
npm test
```
**결과:** ✅ 1,299/1,299 테스트 통과

### 빌드
```bash
npm run build
```
**결과:** ✅ 빌드 성공 (에러 없음)

---

## 🔄 동작 방식

### 초기 로딩 시나리오

1. **CardNavigatorView.onOpen()** 호출
2. `cardsContainer` 생성 (크기 미확정, 0x0 또는 매우 작음)
3. **LayoutManager 생성**
   - `getBoundingClientRect()` → width < 10 || height < 10
   - 기본 모드 'vertical' 사용
   - 로그: "컨테이너 크기 미확정, 기본 모드 사용"
4. **카드 렌더링** (renderCards)
5. **컨테이너 크기 확정** (Obsidian 레이아웃 엔진)
6. **ResizeObserver 트리거**
   - 크기 변화 > 20px (임계값 초과)
   - 새 모드 감지 (width > height → 'horizontal')
   - `updateLayout()` 호출
   - 로그: "레이아웃 업데이트 트리거" (modeChanged: true)
7. **올바른 모드로 전환 완료**
   - 클래스: `card-navigator-cards horizontal-mode`
   - CSS 변수: `--grid-rows: 3`
   - 로그: "레이아웃 적용 완료"

### 크기 조정 시나리오

1. **사용자가 패널 크기 조정**
2. **ResizeObserver 트리거**
3. **크기 변화 계산**
   - widthChange: 50px
   - heightChange: 10px
4. **임계값 검사** (20px)
   - widthChange (50px) >= 20px → 업데이트 필요
5. **모드 재감지**
   - 이전: 'horizontal'
   - 새 모드: 'horizontal' (변화 없음)
6. **그리드 크기 재계산**
   - 이전: 3행
   - 새 크기: 4행 (높이 증가로 인해)
7. **레이아웃 업데이트**
   - CSS 변수: `--grid-rows: 4`
   - 로그: "레이아웃 업데이트 트리거"

---

## 📊 기대 효과

### Before (수정 전)
```
❌ 초기 로딩 시 잘못된 모드 설정
❌ 크기 조정 후에도 모드 전환 실패 (일부 케이스)
❌ 디버그 정보 부족으로 문제 진단 불가
```

### After (수정 후)
```
✅ 초기 로딩: 안전한 기본값 사용 → ResizeObserver로 자동 보정
✅ 크기 조정: 상세 로깅으로 모든 단계 추적 가능
✅ 문제 진단: Debug Mode로 실시간 상태 확인
```

---

## 🛠️ 사용자 액션

### 즉시 적용 방법
1. 플러그인 폴더에서 `npm run build` 실행
2. Obsidian 재시작 또는 플러그인 리로드 (Cmd+R / Ctrl+R)

### 문제 발생 시 디버깅
1. Settings → Card Navigator → Advanced → Enable Debug Mode ✅
2. DevTools Console 열기 (Cmd+Opt+I / Ctrl+Shift+I)
3. 다음 로그 확인:
   - `[Layout] LayoutManager 초기화`
   - `[Layout] 레이아웃 업데이트 트리거`
   - `[Layout] 레이아웃 적용 완료`
4. 패널 크기를 20px 이상 조정하여 ResizeObserver 트리거

### 예상 Console 출력
```javascript
[Layout] LayoutManager 초기화 (컨테이너 크기 미확정, 기본 모드 사용)
  mode: "vertical"
  width: 0
  height: 0
  reason: "컨테이너 크기가 너무 작음"

[Layout] 레이아웃 업데이트 트리거
  modeChanged: true
  oldMode: "vertical"
  newMode: "horizontal"
  widthChange: "1200.0"
  heightChange: "600.0"
  threshold: 20
  containerSize: "1200×600"

[Layout] 레이아웃 적용 완료
  mode: "horizontal"
  gridSize: 4
  hasGroups: false
  appliedClasses: "card-navigator-cards horizontal-mode"
  cssVariables:
    --grid-columns: ""
    --grid-rows: "4"
    --card-min-width: "150px"
    --card-min-height: "100px"
```

---

## 📚 참고 문서

- [DEBUG_LAYOUT.md](DEBUG_LAYOUT.md) - 상세한 디버깅 가이드
- [TEST_LAYOUT.md](TEST_LAYOUT.md) - 레이아웃 테스트 가이드
- [LayoutManager.ts](src/layout/LayoutManager.ts) - 수정된 소스 코드

---

## 📝 추가 개선 제안

### 잠재적 개선 사항 (필요 시)
1. **초기 지연 시간 추가**: `setTimeout()` 사용하여 컨테이너 크기 확정 후 모드 감지
2. **임계값 조정**: 20px → 10px로 낮춰 더 민감하게 반응
3. **강제 업데이트 API**: 외부에서 `layoutManager.forceUpdate()` 호출 가능

### 현재 상태
- 현재 구현은 안정적이며 모든 테스트 통과
- 추가 개선은 실제 사용자 피드백 수집 후 결정

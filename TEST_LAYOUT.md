# Layout Test Guide

## 🧪 가로/세로 모드 및 자동 열 조정 테스트 가이드

### 1️⃣ 세로 모드 (Vertical Mode) 테스트

**조건:** 컨테이너 높이 > 너비

**예상 동작:**
- ✅ 카드가 **위에서 아래로** 배치
- ✅ 여러 **열(columns)**로 나뉨
- ✅ 세로 스크롤 발생
- ✅ 가로 스크롤 없음

**테스트 방법:**
1. Obsidian에서 Card Navigator 패널을 **세로로 길게** 조정
2. DevTools 열기 (Cmd+Opt+I / Ctrl+Shift+I)
3. Console에서 확인:
   ```javascript
   const container = document.querySelector('.card-navigator-cards');
   console.log('Mode:', container.classList.contains('vertical-mode') ? 'VERTICAL' : 'HORIZONTAL');
   console.log('Columns:', container.style.getPropertyValue('--grid-columns'));
   console.log('Grid:', window.getComputedStyle(container).gridTemplateColumns);
   ```

**자동 열 조정 테스트:**
1. 패널 너비를 **천천히 넓힘** → 열 개수 증가 확인
2. 패널 너비를 **천천히 좁힘** → 열 개수 감소 확인
3. Console에서 실시간 확인:
   ```javascript
   new MutationObserver(() => {
       const cols = document.querySelector('.card-navigator-cards')
           .style.getPropertyValue('--grid-columns');
       console.log('Columns:', cols);
   }).observe(document.querySelector('.card-navigator-cards'), {
       attributes: true,
       attributeFilter: ['style']
   });
   ```

---

### 2️⃣ 가로 모드 (Horizontal Mode) 테스트

**조건:** 컨테이너 너비 > 높이

**예상 동작:**
- ✅ 카드가 **왼쪽에서 오른쪽으로** 배치
- ✅ 여러 **행(rows)**으로 나뉨
- ✅ 가로 스크롤 발생
- ✅ 세로 스크롤 없음

**테스트 방법:**
1. Obsidian에서 Card Navigator 패널을 **가로로 넓게** 조정
2. DevTools 열기
3. Console에서 확인:
   ```javascript
   const container = document.querySelector('.card-navigator-cards');
   console.log('Mode:', container.classList.contains('horizontal-mode') ? 'HORIZONTAL' : 'VERTICAL');
   console.log('Rows:', container.style.getPropertyValue('--grid-rows'));
   console.log('Grid:', window.getComputedStyle(container).gridTemplateRows);
   ```

**자동 행 조정 테스트:**
1. 패널 높이를 **천천히 높임** → 행 개수 증가 확인
2. 패널 높이를 **천천히 낮춤** → 행 개수 감소 확인

---

### 3️⃣ 디버그 정보 확인

**현재 레이아웃 상태 확인:**
```javascript
const container = document.querySelector('.card-navigator-cards');
const computed = window.getComputedStyle(container);

console.table({
    'Class - Vertical': container.classList.contains('vertical-mode'),
    'Class - Horizontal': container.classList.contains('horizontal-mode'),
    'CSS Var - Columns': container.style.getPropertyValue('--grid-columns'),
    'CSS Var - Rows': container.style.getPropertyValue('--grid-rows'),
    'Computed - Template Columns': computed.gridTemplateColumns,
    'Computed - Template Rows': computed.gridTemplateRows,
    'Computed - Auto Flow': computed.gridAutoFlow,
    'Overflow X': computed.overflowX,
    'Overflow Y': computed.overflowY,
    'Container Width': container.getBoundingClientRect().width.toFixed(0) + 'px',
    'Container Height': container.getBoundingClientRect().height.toFixed(0) + 'px'
});
```

---

### 4️⃣ 크기 변화 감지 테스트

**ResizeObserver 동작 확인:**
```javascript
// 크기 변화를 감지하여 로그 출력
const container = document.querySelector('.card-navigator-cards');
const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        const cols = container.style.getPropertyValue('--grid-columns');
        const rows = container.style.getPropertyValue('--grid-rows');
        console.log(`📐 Size: ${width.toFixed(0)}x${height.toFixed(0)} | Cols: ${cols} | Rows: ${rows}`);
    }
});
ro.observe(container);
```

---

### 5️⃣ 문제 발생 시 체크리스트

#### ❌ 가로 모드가 활성화되지 않는 경우
- [ ] 컨테이너 너비 > 높이인지 확인
- [ ] `.horizontal-mode` 클래스가 적용되었는지 확인
- [ ] `--grid-rows` 변수가 설정되었는지 확인
- [ ] `grid-auto-flow: column`인지 확인

#### ❌ 자동 열/행 조정이 안 되는 경우
- [ ] ResizeObserver가 동작하는지 확인 (위 스크립트 실행)
- [ ] `--grid-columns` 또는 `--grid-rows` 값이 변경되는지 확인
- [ ] 20px 이상 크기가 변경되었는지 확인 (임계값)
- [ ] 그룹화 모드가 활성화되어 있는지 확인

#### ❌ 그리드가 깨져 보이는 경우
- [ ] `grid-template-columns` 또는 `grid-template-rows`가 `none`이 아닌 `initial`인지 확인
- [ ] CSS 변수가 올바르게 설정되었는지 확인
- [ ] 빌드가 최신 상태인지 확인 (`npm run build`)

---

### 6️⃣ 예상 결과

**세로 모드 (800px × 1200px):**
```
Mode: VERTICAL
Columns: 4 (800px ÷ 200px)
Grid: repeat(4, 1fr)
Overflow: hidden (X), auto (Y)
```

**가로 모드 (1200px × 600px):**
```
Mode: HORIZONTAL
Rows: 3 (600px ÷ 150px)
Grid: repeat(3, 1fr)
Overflow: auto (X), hidden (Y)
```

---

## 🔧 트러블슈팅

### 로그 활성화
설정에서 Debug Mode를 켜면 Layout 관련 로그가 Console에 출력됩니다.

### 강제 레이아웃 업데이트
```javascript
// 강제로 레이아웃 재계산
const container = document.querySelector('.card-navigator-cards');
container.dispatchEvent(new Event('resize'));
```

### CSS 변수 수동 설정 (테스트용)
```javascript
const container = document.querySelector('.card-navigator-cards');
container.style.setProperty('--grid-columns', '5');
container.style.setProperty('--grid-rows', '4');
```

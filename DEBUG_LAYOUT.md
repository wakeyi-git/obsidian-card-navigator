# 🔍 레이아웃 디버깅 가이드

## ⚠️ 최신 업데이트 (2025-11-23)

**개선된 기능:**
1. ✅ **초기 로딩 안정성 향상**: 컨테이너 크기가 10px 미만일 때 기본 모드(vertical) 사용
2. ✅ **상세한 디버그 로깅**: 모드 전환, CSS 변수 적용, 클래스 변경 등 모든 단계 로깅
3. ✅ **ResizeObserver 개선**: 크기 변화량과 임계값을 명확히 로깅

**주요 변경사항:**
- 초기 컨테이너 크기가 매우 작을 때 기본값('vertical')으로 설정
- ResizeObserver가 트리거되면 올바른 모드로 자동 전환
- 모든 레이아웃 변경 시 적용된 클래스와 CSS 변수 로깅

**문제 해결 팁:**
- 가로 모드가 즉시 활성화되지 않으면 패널 크기를 살짝 조정하세요 (20px 이상)
- Debug Mode를 활성화하여 Console에서 상세 로그 확인
- 로그에 "컨테이너 크기 미확정" 메시지가 보이면 정상 동작 중입니다

---

## 문제 진단 체크리스트

### ✅ Step 1: 디버그 모드 활성화

1. **Card Navigator 설정 열기**
   - Settings → Card Navigator → Advanced → Enable Debug Mode ✅

2. **Console 열기**
   - Mac: `Cmd + Opt + I`
   - Windows/Linux: `Ctrl + Shift + I`
   - Console 탭으로 이동

3. **디버그 로그 확인**
   - 플러그인을 다시 로드하거나 창 크기를 조정하면 로그가 출력됨
   - `[Layout]` 태그가 붙은 로그 확인

---

### ✅ Step 2: 현재 상태 확인

Console에서 다음 코드를 실행하세요:

```javascript
// 현재 레이아웃 상태 확인
const container = document.querySelector('.card-navigator-cards');
if (!container) {
    console.error('❌ .card-navigator-cards 컨테이너를 찾을 수 없습니다!');
} else {
    const computed = window.getComputedStyle(container);
    const rect = container.getBoundingClientRect();

    console.log('📊 레이아웃 상태:');
    console.table({
        '컨테이너 크기': `${rect.width.toFixed(0)} × ${rect.height.toFixed(0)}`,
        '예상 모드': rect.width > rect.height ? 'HORIZONTAL' : 'VERTICAL',
        '실제 모드 (클래스)': container.classList.contains('vertical-mode') ? 'VERTICAL' :
                           container.classList.contains('horizontal-mode') ? 'HORIZONTAL' :
                           '❌ 모드 클래스 없음',
        '--grid-columns': container.style.getPropertyValue('--grid-columns') || '❌ 없음',
        '--grid-rows': container.style.getPropertyValue('--grid-rows') || '❌ 없음',
        'grid-template-columns': computed.gridTemplateColumns,
        'grid-template-rows': computed.gridTemplateRows,
        'grid-auto-flow': computed.gridAutoFlow,
        'overflow-x': computed.overflowX,
        'overflow-y': computed.overflowY
    });
}
```

**예상 결과:**
- **세로 모드** (높이 > 너비):
  - 실제 모드: `VERTICAL`
  - `--grid-columns`: 숫자 (예: `3`)
  - `grid-auto-flow`: `row`
  - `overflow-y`: `auto`

- **가로 모드** (너비 > 높이):
  - 실제 모드: `HORIZONTAL`
  - `--grid-rows`: 숫자 (예: `2`)
  - `grid-auto-flow`: `column`
  - `overflow-x`: `auto`

---

### ✅ Step 3: ResizeObserver 동작 확인

창 크기 조정 시 레이아웃이 업데이트되는지 확인:

```javascript
// ResizeObserver 모니터링
let resizeCount = 0;
const container = document.querySelector('.card-navigator-cards');

const observer = new ResizeObserver((entries) => {
    resizeCount++;
    const entry = entries[0];
    const width = entry.contentRect.width;
    const height = entry.contentRect.height;
    const cols = container.style.getPropertyValue('--grid-columns');
    const rows = container.style.getPropertyValue('--grid-rows');
    const mode = width > height ? 'H' : 'V';

    console.log(`🔄 Resize #${resizeCount}: ${width.toFixed(0)}×${height.toFixed(0)} | Mode: ${mode} | Cols: ${cols} | Rows: ${rows}`);
});

observer.observe(container);

console.log('✅ ResizeObserver 활성화됨. 이제 창 크기를 조정해보세요.');
```

**테스트 방법:**
1. Card Navigator 패널의 크기를 **천천히** 조정
2. Console에 `🔄 Resize` 로그가 출력되는지 확인
3. `Cols` 또는 `Rows` 값이 변경되는지 확인

**문제 발생 시:**
- 로그가 출력되지 않음 → ResizeObserver가 제대로 설정되지 않음
- 로그는 출력되지만 Cols/Rows가 변경되지 않음 → 계산 로직 문제

---

### ✅ Step 4: 강제 레이아웃 업데이트

수동으로 레이아웃을 강제 업데이트:

```javascript
// 방법 1: 컨테이너 크기 강제 변경 (작은 변화)
const container = document.querySelector('.card-navigator-cards');
const originalWidth = container.style.width;
container.style.width = (container.offsetWidth + 1) + 'px';
setTimeout(() => {
    container.style.width = originalWidth;
}, 100);
console.log('✅ 강제 크기 변경 실행 (1px 증가 → 원복)');

// 방법 2: 큰 크기 변화 (임계값 초과)
setTimeout(() => {
    container.style.width = (container.offsetWidth + 50) + 'px';
    setTimeout(() => {
        container.style.width = originalWidth;
    }, 100);
    console.log('✅ 강제 크기 변경 실행 (50px 증가 → 원복)');
}, 500);
```

---

### ✅ Step 5: CSS 변수 수동 테스트

CSS 변수를 직접 변경하여 그리드가 반응하는지 확인:

```javascript
const container = document.querySelector('.card-navigator-cards');

// 세로 모드로 강제 설정
container.classList.remove('horizontal-mode');
container.classList.add('vertical-mode');
container.style.setProperty('--grid-columns', '5');

console.log('✅ 세로 모드로 설정 (5열)');
console.log('현재 grid-template-columns:', window.getComputedStyle(container).gridTemplateColumns);

// 2초 후 가로 모드로 전환
setTimeout(() => {
    container.classList.remove('vertical-mode');
    container.classList.add('horizontal-mode');
    container.style.setProperty('--grid-rows', '4');

    console.log('✅ 가로 모드로 설정 (4행)');
    console.log('현재 grid-template-rows:', window.getComputedStyle(container).gridTemplateRows);
}, 2000);
```

**예상 결과:**
- `grid-template-columns`가 `repeat(5, 1fr)` 또는 유사한 값으로 변경
- 2초 후 `grid-template-rows`가 `repeat(4, 1fr)` 또는 유사한 값으로 변경

**문제 발생 시:**
- 값이 변경되지 않음 → CSS 파일이 제대로 로드되지 않음
- `none`이나 `initial`로 표시됨 → CSS 우선순위 문제

---

### ✅ Step 6: 그룹화 모드 확인

그룹화가 활성화되어 있는지 확인:

```javascript
const container = document.querySelector('.card-navigator-cards');
const groupSections = container.querySelectorAll('.card-group-section');

console.log('📁 그룹 섹션 개수:', groupSections.length);

if (groupSections.length > 0) {
    console.log('⚠️ 그룹화 모드가 활성화되어 있습니다.');
    console.log('그룹화 모드에서는 CSS가 레이아웃을 완전히 제어합니다.');

    // 그룹 컨테이너의 스타일 확인
    const groupContent = container.querySelector('.card-group-content');
    if (groupContent) {
        const computed = window.getComputedStyle(groupContent);
        console.table({
            'display': computed.display,
            'grid-template-columns': computed.gridTemplateColumns,
            'grid-auto-flow': computed.gridAutoFlow
        });
    }
} else {
    console.log('✅ 그룹화 모드가 비활성화되어 있습니다.');
}
```

---

## 🐛 일반적인 문제와 해결 방법

### 문제 1: 가로 모드가 활성화되지 않음

**증상:**
- 컨테이너가 가로로 넓은데도 세로 모드로 표시
- 가로 스크롤이 발생하지 않음

**확인 사항:**
```javascript
const container = document.querySelector('.card-navigator-cards');
const rect = container.getBoundingClientRect();
console.log('너비:', rect.width, '높이:', rect.height);
console.log('예상 모드:', rect.width > rect.height ? 'HORIZONTAL' : 'VERTICAL');
console.log('실제 클래스:', container.className);
```

**가능한 원인:**
1. **초기 로딩 시 컨테이너 크기 미확정**: 플러그인 로딩 시 컨테이너가 0x0이거나 매우 작은 상태였을 수 있음
2. **ResizeObserver 미동작**: 컨테이너 크기 변화를 감지하지 못함
3. **CSS 클래스 미적용**: .horizontal-mode 클래스가 추가되지 않음

**해결 방법:**
1. **즉시 해결**: 패널 크기를 살짝 조정 (20px 이상) → ResizeObserver가 트리거됨
2. **빌드 확인**: `npm run build` 실행 후 Obsidian 재시작
3. **플러그인 재시작**: 플러그인 비활성화 → 활성화
4. **강제 리로드**: Cmd+R (Mac) / Ctrl+R (Windows)

---

### 문제 2: 자동 열 조정이 안 됨

**증상:**
- 창 크기를 조정해도 열/행 개수가 변하지 않음

**확인 사항:**
```javascript
// 크기 변화 임계값 확인 (20px)
const container = document.querySelector('.card-navigator-cards');
let previousWidth = container.getBoundingClientRect().width;

new ResizeObserver(() => {
    const currentWidth = container.getBoundingClientRect().width;
    const change = Math.abs(currentWidth - previousWidth);
    console.log(`변화량: ${change.toFixed(1)}px (임계값: 20px)`);
    if (change < 20) {
        console.log('⚠️ 변화량이 임계값 미만입니다. 레이아웃 업데이트 건너뜀.');
    }
    previousWidth = currentWidth;
}).observe(container);
```

**해결 방법:**
- 창 크기를 **20px 이상** 조정하세요
- 또는 더 크게 드래그하세요

---

### 문제 3: CSS 그리드가 적용되지 않음

**증상:**
- 카드가 한 줄로만 표시됨
- 그리드가 보이지 않음

**확인 사항:**
```javascript
const container = document.querySelector('.card-navigator-cards');
const computed = window.getComputedStyle(container);

console.table({
    'display': computed.display,
    'grid-template-columns': computed.gridTemplateColumns,
    'grid-template-rows': computed.gridTemplateRows,
    '--grid-columns': container.style.getPropertyValue('--grid-columns'),
    '--grid-rows': container.style.getPropertyValue('--grid-rows')
});
```

**해결 방법:**
1. CSS 파일 확인: `styles.css`가 최신인지 확인
2. 캐시 클리어: `Cmd+R` (Mac) / `Ctrl+R` (Windows)
3. `grid-template-columns`가 `none`으로 표시되면 CSS 버그 → 재빌드

---

## 📝 로그 수집하기

문제를 보고할 때 다음 정보를 함께 제공하세요:

```javascript
// 전체 진단 정보 수집
const container = document.querySelector('.card-navigator-cards');
const computed = window.getComputedStyle(container);
const rect = container.getBoundingClientRect();

const diagnosticInfo = {
    '버전': '1.4.1',
    '컨테이너 크기': `${rect.width.toFixed(0)} × ${rect.height.toFixed(0)}`,
    '클래스 목록': container.className,
    'CSS 변수': {
        '--grid-columns': container.style.getPropertyValue('--grid-columns'),
        '--grid-rows': container.style.getPropertyValue('--grid-rows'),
        '--card-min-width': container.style.getPropertyValue('--card-min-width'),
        '--card-min-height': container.style.getPropertyValue('--card-min-height')
    },
    '계산된 스타일': {
        'display': computed.display,
        'grid-template-columns': computed.gridTemplateColumns,
        'grid-template-rows': computed.gridTemplateRows,
        'grid-auto-flow': computed.gridAutoFlow,
        'overflow-x': computed.overflowX,
        'overflow-y': computed.overflowY
    },
    '그룹화': {
        '그룹 개수': container.querySelectorAll('.card-group-section').length
    }
};

console.log('📋 진단 정보:');
console.log(JSON.stringify(diagnosticInfo, null, 2));

// 클립보드에 복사
navigator.clipboard.writeText(JSON.stringify(diagnosticInfo, null, 2));
console.log('✅ 진단 정보가 클립보드에 복사되었습니다.');
```

---

## 🔧 고급 디버깅

### LayoutManager 직접 접근

```javascript
// ⚠️ 내부 API - 테스트 용도로만 사용
const view = app.workspace.getLeavesOfType('card-navigator-view')[0]?.view;

if (view) {
    console.log('✅ CardNavigatorView 찾음');

    // 강제 레이아웃 업데이트
    if (view.layoutManager) {
        view.layoutManager.updateLayout();
        console.log('✅ updateLayout() 호출됨');
    }

    // 현재 모드 확인
    console.log('현재 모드:', view.layoutManager.getMode());
} else {
    console.error('❌ CardNavigatorView를 찾을 수 없습니다.');
}
```

---

## 📞 지원 요청

문제가 해결되지 않으면 GitHub Issues에 다음 정보와 함께 보고해주세요:

1. ✅ 위의 "로그 수집하기" 섹션 결과
2. ✅ Obsidian 버전
3. ✅ 운영체제 (Mac/Windows/Linux)
4. ✅ Console에 나타나는 에러 메시지
5. ✅ 스크린샷 (레이아웃 문제)

GitHub Issues: https://github.com/anthropics/claude-code/issues

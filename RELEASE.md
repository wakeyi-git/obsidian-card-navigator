# Release Guide

Card Navigator 플러그인의 릴리즈 프로세스를 안내합니다.

## 자동화된 릴리즈 (권장)

### Patch Release (버그 수정)
```bash
npm run release:patch
```

### Minor Release (새 기능)
```bash
npm run release:minor
```

### Major Release (Breaking Changes)
```bash
npm run release:major
```

## 자동 릴리즈 프로세스

위 명령어를 실행하면 다음 작업이 **자동으로** 수행됩니다:

1. **버전 업데이트**
   - `package.json` 버전 증가
   - `manifest.json` 버전 동기화
   - `versions.json` 업데이트
   - `CHANGELOG.md` 업데이트 준비

2. **Git 커밋 & 태그**
   - 변경사항 커밋: `chore(release): v1.x.x`
   - Git 태그 생성: `v1.x.x`

3. **자동 푸시**
   - 커밋을 원격 저장소로 푸시
   - 태그를 원격 저장소로 푸시

4. **GitHub 릴리즈 생성**
   - `CHANGELOG.md`에서 해당 버전의 릴리즈 노트 자동 추출
   - GitHub Release 생성
   - `main.js`, `manifest.json`, `styles.css` 자동 첨부
   - 기존 릴리즈가 있으면 자동으로 삭제 후 재생성

## 수동 릴리즈 (필요시)

### 1. 버전 업데이트
```bash
# package.json, manifest.json 버전 수동 수정
npm run build
```

### 2. CHANGELOG.md 업데이트
```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added/Changed/Fixed
- 변경 사항 설명
```

### 3. Git 커밋 & 푸시
```bash
git add -A
git commit -m "chore(release): vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
```

### 4. GitHub 릴리즈 생성
```bash
npm run github:release X.Y.Z
```

또는:

```bash
node scripts/create-release.js X.Y.Z
```

## 릴리즈 전 체크리스트

- [ ] 모든 변경사항이 커밋되었는가?
- [ ] `CHANGELOG.md`에 변경사항이 문서화되었는가?
- [ ] 빌드가 성공하는가? (`npm run build`)
- [ ] 테스트가 통과하는가? (`npm test`)
- [ ] 린트 체크가 통과하는가? (`npm run lint`)

## 릴리즈 롤백

릴리즈에 문제가 있는 경우:

### GitHub 릴리즈 삭제
```bash
gh release delete vX.Y.Z --yes
```

### Git 태그 삭제
```bash
# 로컬 태그 삭제
git tag -d vX.Y.Z

# 원격 태그 삭제
git push origin :refs/tags/vX.Y.Z
```

### 커밋 롤백 (조심!)
```bash
git reset --hard HEAD~1
git push -f origin main
```

## 릴리즈 스크립트 설명

### `scripts/create-release.js`

CHANGELOG.md에서 릴리즈 노트를 자동으로 추출하여 GitHub 릴리즈를 생성합니다.

**동작:**
1. CHANGELOG.md에서 버전 섹션 추출
2. 필수 파일 확인 (main.js, manifest.json, styles.css)
3. 기존 릴리즈가 있으면 삭제
4. GitHub 릴리즈 생성 및 파일 첨부

**사용법:**
```bash
node scripts/create-release.js 1.4.3
```

### `scripts/update-version.js`

package.json의 버전을 manifest.json과 versions.json에 동기화합니다.

**동작:**
1. package.json 버전 읽기
2. manifest.json 버전 업데이트
3. versions.json에 버전 추가

## 트러블슈팅

### "release with the same tag name already exists"

**원인:** 이미 해당 버전의 릴리즈가 존재함

**해결:**
```bash
# 기존 릴리즈 삭제 후 재생성
gh release delete vX.Y.Z --yes
npm run github:release X.Y.Z
```

### "Version not found in CHANGELOG.md"

**원인:** CHANGELOG.md에 해당 버전 섹션이 없음

**해결:**
1. CHANGELOG.md에 버전 섹션 추가:
```markdown
## [X.Y.Z] - YYYY-MM-DD

### Changed
- 변경 내용
```
2. 릴리즈 스크립트 재실행

### "Missing required files"

**원인:** main.js, manifest.json, styles.css 파일이 없음

**해결:**
```bash
npm run build
```

## 참고사항

- **태그 충돌 방지**: `postversion` 훅이 자동으로 푸시하므로 수동 태그 생성 불필요
- **릴리즈 노트**: CHANGELOG.md의 형식을 유지해야 자동 추출이 정상 작동
- **GitHub CLI**: `gh` 명령어가 설치되어 있고 인증되어 있어야 함

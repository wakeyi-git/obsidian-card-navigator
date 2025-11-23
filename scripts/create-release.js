#!/usr/bin/env node

/**
 * GitHub Release 자동화 스크립트
 *
 * 사용법:
 *   node scripts/create-release.js [version]
 *
 * 예시:
 *   node scripts/create-release.js 1.4.3
 *
 * 동작:
 * 1. CHANGELOG.md에서 해당 버전의 릴리즈 노트 추출
 * 2. GitHub 릴리즈 생성 (main.js, manifest.json, styles.css 첨부)
 * 3. 기존 릴리즈가 있으면 삭제 후 재생성
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 명령 실행 헬퍼
function exec(command, options = {}) {
    try {
        return execSync(command, {
            encoding: 'utf-8',
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options
        });
    } catch (error) {
        if (options.ignoreError) {
            return null;
        }
        throw error;
    }
}

// 버전 파라미터 가져오기
const version = process.argv[2];
if (!version) {
    console.error('Error: Version argument required');
    console.error('Usage: node scripts/create-release.js [version]');
    console.error('Example: node scripts/create-release.js 1.4.3');
    process.exit(1);
}

const versionTag = `v${version}`;

console.log(`📦 Creating GitHub Release for ${versionTag}...`);

// 1. CHANGELOG.md에서 릴리즈 노트 추출
console.log('\n📝 Extracting release notes from CHANGELOG.md...');

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
if (!fs.existsSync(changelogPath)) {
    console.error('Error: CHANGELOG.md not found');
    process.exit(1);
}

const changelog = fs.readFileSync(changelogPath, 'utf-8');
const versionRegex = new RegExp(`## \\[${version}\\]([\\s\\S]*?)(?=## \\[|$)`, 'm');
const match = changelog.match(versionRegex);

if (!match) {
    console.error(`Error: Version ${version} not found in CHANGELOG.md`);
    process.exit(1);
}

const releaseNotes = match[0].trim();
const releaseNotesPath = `/tmp/release-notes-${version}.md`;
fs.writeFileSync(releaseNotesPath, releaseNotes, 'utf-8');
console.log(`✅ Release notes saved to ${releaseNotesPath}`);

// 2. 릴리즈 제목 생성 (첫 번째 헤딩 추출)
const titleMatch = releaseNotes.match(/###?\s+(.+)/);
const releaseTitle = titleMatch
    ? `${versionTag} - ${titleMatch[1].trim()}`
    : versionTag;

console.log(`📋 Release title: ${releaseTitle}`);

// 3. 필수 파일 확인
console.log('\n🔍 Checking required files...');
const requiredFiles = ['main.js', 'manifest.json', 'styles.css'];
const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));

if (missingFiles.length > 0) {
    console.error(`Error: Missing required files: ${missingFiles.join(', ')}`);
    console.error('Please run "npm run build" first');
    process.exit(1);
}
console.log('✅ All required files found');

// 4. 기존 릴리즈 확인 및 삭제
console.log(`\n🔍 Checking for existing release ${versionTag}...`);
const existingRelease = exec(`gh release view ${versionTag}`, {
    silent: true,
    ignoreError: true
});

if (existingRelease) {
    console.log(`⚠️  Release ${versionTag} already exists, deleting...`);
    exec(`gh release delete ${versionTag} --yes`, { silent: true });
    console.log('✅ Existing release deleted');
} else {
    console.log('✅ No existing release found');
}

// 5. GitHub 릴리즈 생성
console.log(`\n🚀 Creating GitHub release ${versionTag}...`);
try {
    const releaseUrl = exec(
        `gh release create ${versionTag} ` +
        `--title "${releaseTitle}" ` +
        `--notes-file "${releaseNotesPath}" ` +
        `${requiredFiles.join(' ')}`,
        { silent: true }
    ).trim();

    console.log('✅ Release created successfully!');
    console.log(`🔗 Release URL: ${releaseUrl}`);

    // 임시 파일 삭제
    fs.unlinkSync(releaseNotesPath);

    console.log('\n✨ Release process completed!');
} catch (error) {
    console.error('\n❌ Failed to create release');
    console.error(error.message);
    process.exit(1);
}

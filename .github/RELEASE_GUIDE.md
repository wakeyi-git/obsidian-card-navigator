# Release Guide

This guide explains how to create a new release of the Card Navigator plugin using the automated release workflow.

## Prerequisites

- All changes are committed and pushed to the `main` branch
- All tests are passing (`npm test`)
- The build is successful (`npm run build`)
- CHANGELOG.md's `[Unreleased]` section contains all notable changes

## Release Process

### Automated Release (Recommended)

The release process is fully automated using npm version commands and GitHub Actions.

#### 1. Choose the Release Type

- **Patch Release** (1.0.0 → 1.0.1): Bug fixes and minor changes
  ```bash
  npm run release:patch
  ```

- **Minor Release** (1.0.0 → 1.1.0): New features, backward compatible
  ```bash
  npm run release:minor
  ```

- **Major Release** (1.0.0 → 2.0.0): Breaking changes
  ```bash
  npm run release:major
  ```

#### 2. What Happens Automatically

When you run one of the release commands above, the following happens:

1. **Version Update**:
   - `package.json` version is bumped
   - CHANGELOG.md is updated with the new version
   - `manifest.json` version is updated to match
   - `versions.json` is updated with the new version

2. **Git Operations**:
   - Changes are committed with message: `chore(release): <version>`
   - A git tag is created (e.g., `v1.0.1`)
   - Changes and tags are pushed to GitHub

3. **GitHub Actions Workflow** (automatic):
   - Code is checked out
   - Dependencies are installed
   - Tests are run
   - Plugin is built
   - GitHub Release is created with:
     - Release notes from CHANGELOG.md
     - `main.js`
     - `manifest.json`
     - `styles.css`

### Manual Release (Alternative)

If you prefer more control, you can manually create a release:

1. Update versions:
   ```bash
   npm version patch  # or minor/major
   ```

2. Push with tags:
   ```bash
   git push --follow-tags
   ```

The GitHub Actions workflow will still run automatically when the tag is pushed.

## Pre-Release Checklist

Before creating a release, ensure:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] CHANGELOG.md `[Unreleased]` section is up to date
- [ ] All changes are committed to `main` branch
- [ ] No uncommitted changes in working directory

## Post-Release Tasks

After the GitHub Actions workflow completes:

1. **Verify the Release**:
   - Check the [Releases page](https://github.com/wakeyi-git/obsidian-card-navigator/releases)
   - Verify all assets are attached (main.js, manifest.json, styles.css)
   - Review the release notes

2. **Update Unreleased Section** (if needed):
   - Edit CHANGELOG.md
   - Reset the `[Unreleased]` section for the next development cycle
   - Commit and push changes

3. **Community Plugin Submission** (first release only):
   - Follow [Obsidian's community plugin guidelines](https://github.com/obsidianmd/obsidian-releases)
   - Submit a pull request to add your plugin to the community list

## Troubleshooting

### Release Workflow Failed

1. Check the [Actions tab](https://github.com/wakeyi-git/obsidian-card-navigator/actions) for error details
2. Common issues:
   - Tests failing: Fix tests and push changes
   - Build errors: Fix build configuration
   - Missing files: Ensure main.js, manifest.json, styles.css exist after build

### Version Mismatch

If manifest.json and package.json versions don't match:

```bash
node scripts/update-version.js
git add manifest.json versions.json
git commit -m "chore: sync manifest version"
git push
```

### Delete a Failed Release

If you need to delete a release and retry:

1. Delete the release from GitHub (keep or delete the tag)
2. If you deleted the tag, also delete it locally:
   ```bash
   git tag -d v1.0.1
   git push origin :refs/tags/v1.0.1
   ```
3. Fix the issues and create a new release

## Release Notes Guidelines

When updating CHANGELOG.md, follow these guidelines:

- Use [Keep a Changelog](https://keepachangelog.com/) format
- Group changes by type: Added, Changed, Deprecated, Removed, Fixed, Security
- Write user-focused descriptions (not technical implementation details)
- Link to relevant issues/PRs when applicable
- Be concise but informative

### Example CHANGELOG Entry

```markdown
## [1.1.0] - 2025-11-22

### Added
- **Dark Mode Optimization**: Theme-aware CSS variables for better dark mode support
- **Comprehensive Testing**: Added 12 new test cases for dark mode functionality

### Changed
- Replaced all hardcoded shadow colors with CSS variables
- Improved theme switching behavior

### Fixed
- Fixed shadow visibility in dark mode
```

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version: Incompatible API changes or breaking changes
- **MINOR** version: New features, backward compatible
- **PATCH** version: Bug fixes, backward compatible

## Questions?

If you have questions about the release process, please:

1. Check this guide first
2. Review the [GitHub Actions workflow](.github/workflows/release.yml)
3. Open an issue with the `question` label

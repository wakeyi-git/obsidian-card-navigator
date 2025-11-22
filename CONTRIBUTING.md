# Contributing to Card Navigator

Thank you for your interest in contributing to Card Navigator!

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development: `npm run dev`
4. Run tests: `npm test`

## Code Quality

- **Linting**: `npm run lint` or `npm run lint:fix`
- **Testing**: Write tests for new features
- **Type Safety**: Use TypeScript with strict mode

## CHANGELOG Management

We follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format with a specific structure for automated releases.

### CHANGELOG.md Structure

```markdown
# Changelog

[Description and format information]

---

## [Unreleased]

### Added
- New features go here

### Changed
- Changes to existing features

### Fixed
- Bug fixes

---

## [1.1.0] - 2025-11-22

[Release content...]

---

## [1.0.0] - 2025-11-20

[Release content...]

---

## Version History

- **1.1.0** (2025-11-22) - Description
- **1.0.0** (2025-11-20) - Description
```

### Adding Changes

1. **During Development**: Add your changes to the `[Unreleased]` section
   - Use appropriate category: `### Added`, `### Changed`, `### Fixed`, `### Deprecated`, `### Removed`, `### Security`
   - Write clear, user-focused descriptions
   - Reference issues/PRs if applicable

2. **Before Release**: 
   - Review and organize the `[Unreleased]` section
   - Ensure all changes are documented
   - Remove empty categories

### Release Process

We use automated releases with semantic versioning:

```bash
# Patch release (1.1.0 → 1.1.1) - Bug fixes
npm run release:patch

# Minor release (1.1.0 → 1.2.0) - New features
npm run release:minor

# Major release (1.1.0 → 2.0.0) - Breaking changes
npm run release:major
```

**What happens during release:**

1. `npm version` updates package.json version
2. `scripts/update-version.js` runs automatically:
   - Updates manifest.json
   - Updates versions.json
   - Converts `[Unreleased]` to new version in CHANGELOG.md
   - Adds entry to Version History
3. Git commit is created with version tag
4. Push triggers GitHub Actions workflow:
   - Runs tests
   - Builds plugin
   - Extracts release notes from CHANGELOG.md
   - Creates GitHub Release with assets

### Manual CHANGELOG Updates

If you need to update CHANGELOG.md manually:

1. **Adding a new version section:**
   ```markdown
   ---
   
   ## [X.Y.Z] - YYYY-MM-DD
   
   ### Added
   - Your changes here
   
   ---
   ```

2. **Updating Version History:**
   ```markdown
   ## Version History
   
   - **X.Y.Z** (YYYY-MM-DD) - Brief description
   ```

3. **Important**: Always maintain the `---` separators between sections for proper parsing

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add new feature`
- `fix: fix bug`
- `docs: update documentation`
- `chore: update dependencies`
- `test: add tests`
- `refactor: refactor code`

## Pull Requests

1. Create a feature branch
2. Make your changes
3. Add/update tests
4. Update CHANGELOG.md `[Unreleased]` section
5. Ensure all tests pass
6. Submit PR with clear description

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide detailed reproduction steps for bugs

Thank you for contributing! 🎉

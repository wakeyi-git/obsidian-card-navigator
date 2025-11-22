# Commit Message Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

## Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

## Scope

The scope should be the name of the component/module affected:

- **card**: Card rendering and management
- **view**: View components and logic
- **search**: Search functionality
- **preset**: Preset system
- **settings**: Settings UI
- **ui**: General UI components
- **test**: Testing infrastructure
- **deps**: Dependencies
- etc.

## Subject

The subject contains a succinct description of the change:

- Use the imperative, present tense: "change" not "changed" nor "changes"
- Don't capitalize the first letter
- No dot (.) at the end

## Body

The body should include the motivation for the change and contrast this with previous behavior.

## Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit closes.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines.

## Examples

### Feature

```
feat(card): add drag and drop reordering

Allow users to reorder cards by dragging them.

Closes #123
```

### Bug Fix

```
fix(search): resolve search input focus issue

Fix issue where search input loses focus when typing rapidly.

Fixes #456
```

### Documentation

```
docs: update installation instructions

Add troubleshooting section for common installation issues.
```

### Performance

```
perf(view): optimize card rendering with virtual scrolling

Implement virtual scrolling to handle 1000+ cards efficiently.

- Reduces initial render time by 60%
- Decreases memory usage by 40%
```

### Breaking Change

```
feat(preset)!: change preset file format

BREAKING CHANGE: Preset files now use JSON instead of YAML.
Migration script provided in docs/migration.md.

Closes #789
```

## Automation

When you run `npm version [major|minor|patch]`, the changelog will be automatically updated based on commits since the last release.

To manually generate changelog:
```bash
npm run changelog
```

## Commitlint

All commits are validated using commitlint. Invalid commit messages will be rejected by the pre-commit hook.

To skip the hook (not recommended):
```bash
git commit --no-verify
```

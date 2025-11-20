# Contributing to Card Navigator

Thank you for your interest in contributing to Card Navigator! This document provides guidelines and instructions for contributing to the project.

## 🤝 How to Contribute

### Reporting Bugs

Before creating a bug report, please check the [existing issues](https://github.com/wakeyi-git/obsidian-card-navigator/issues) to avoid duplicates.

When filing a bug report, include:
- **Description**: Clear description of the issue
- **Steps to Reproduce**: Detailed steps to reproduce the behavior
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**:
  - Obsidian version
  - Plugin version
  - Operating system
  - Any relevant settings or configurations
- **Screenshots**: If applicable

### Suggesting Features

We welcome feature suggestions! Please:
1. Check if the feature has already been requested
2. Clearly describe the feature and its use case
3. Explain why this feature would be useful to most users
4. Consider providing examples or mockups

### Pull Requests

We actively welcome your pull requests! Here's the process:

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** if you've added functionality
4. **Update documentation** if needed
5. **Ensure tests pass** by running `npm test`
6. **Submit a pull request**

## 🛠️ Development Setup

### Prerequisites

- Node.js 18.x or later (LTS recommended)
- npm 9.x or later
- Git
- A text editor (VS Code recommended)

### Initial Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/obsidian-card-navigator.git
cd obsidian-card-navigator

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Development Workflow

1. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** in the `src/` directory

3. **Test your changes**:
   ```bash
   # Run tests
   npm test

   # Run tests in watch mode
   npm run test:watch

   # Check test coverage
   npm run test:coverage

   # Type check
   npx tsc --noEmit

   # Lint code
   npx eslint src --ext .ts
   ```

4. **Build the plugin**:
   ```bash
   npm run build
   ```

5. **Test in Obsidian**:
   - Copy `main.js` and `manifest.json` to your test vault's plugin folder
   - Reload Obsidian
   - Test your changes thoroughly

## 📝 Coding Standards

### TypeScript

- Use TypeScript strict mode features
- Provide type annotations for function parameters and return values
- Avoid using `any` - use proper types or `unknown`
- Use interfaces for object shapes
- Follow existing naming conventions

### Code Style

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Line Length**: Aim for 100 characters max
- **Naming**:
  - `camelCase` for variables and functions
  - `PascalCase` for classes and interfaces
  - `UPPER_CASE` for constants

### Comments

- Write clear, concise comments for complex logic
- Use JSDoc comments for public APIs
- Keep comments up-to-date with code changes
- Comment "why" not "what" when the code is self-explanatory

Example:
```typescript
/**
 * Calculates the layout dimensions for cards based on viewport size
 * @param viewportWidth - Available width in pixels
 * @param cardSize - Configured card size
 * @returns Layout configuration with columns and spacing
 */
calculateLayout(viewportWidth: number, cardSize: CardSize): LayoutConfig {
  // Use golden ratio for optimal spacing (1.618)
  const spacing = Math.floor(cardSize.width / 1.618);
  // ...
}
```

## 🧪 Testing

### Writing Tests

- Write tests for new features and bug fixes
- Place tests in `__tests__/` directories
- Use descriptive test names that explain the behavior
- Follow the Arrange-Act-Assert pattern
- Mock Obsidian API calls when needed

Example test structure:
```typescript
describe('CardRenderer', () => {
  describe('renderCard', () => {
    it('should render card with filename in header', () => {
      // Arrange
      const cardData = createMockCardData();
      const settings = { header: { type: 'filename' } };

      // Act
      const result = renderer.renderCard(cardData, settings);

      // Assert
      expect(result.header).toContain(cardData.file.basename);
    });
  });
});
```

### Test Coverage

- Aim for >80% coverage for new code
- Core business logic should have >90% coverage
- UI components should have basic functionality tested
- Use `npm run test:coverage` to check coverage

## 📚 Documentation

### Code Documentation

- Add JSDoc comments for public APIs and complex functions
- Include parameter descriptions and return types
- Document any non-obvious behavior or edge cases

### User Documentation

If your changes affect user-facing features:
- Update [README.md](README.md) with new features or changes
- Add entries to [CHANGELOG.md](CHANGELOG.md) following Keep a Changelog format
- Update screenshots or examples if needed

## 🔄 Git Workflow

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(search): add boolean query support

fix(card): prevent crash when file has no metadata

docs: update installation instructions

test(preset): add tests for preset deletion
```

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements

Examples:
- `feature/multi-tag-support`
- `fix/card-rendering-issue`
- `docs/update-readme`

## 🎯 Pull Request Process

1. **Update your branch** with the latest main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure all checks pass**:
   - All tests passing
   - No TypeScript errors
   - No ESLint errors
   - Build succeeds

3. **Write a clear PR description**:
   - What changes does this PR make?
   - Why are these changes needed?
   - How have you tested the changes?
   - Any breaking changes or migration needed?

4. **Link related issues**: Use keywords like "Fixes #123" or "Closes #456"

5. **Request review**: Tag maintainers if needed

6. **Address feedback**: Be responsive to review comments

7. **Squash commits**: Clean up commit history before merging

## 🐛 Debugging

### Enable Debug Mode

1. Open Card Navigator settings
2. Enable "Debug Mode"
3. Open Developer Console (Ctrl/Cmd + Shift + I)
4. Check Console tab for debug logs

### Debug Logging in Code

```typescript
import { DebugLogger } from './utils/DebugLogger';

const logger = DebugLogger.getInstance();
logger.debug('Search', 'Processing query', { query, results });
logger.warn('Card', 'Missing metadata', { file: file.path });
logger.error('Preset', 'Failed to load preset', error);
```

## 📋 Checklist Before Submitting

- [ ] Code follows the project's style guidelines
- [ ] All tests pass (`npm test`)
- [ ] TypeScript compilation succeeds (`npx tsc --noEmit`)
- [ ] ESLint passes (`npx eslint src --ext .ts`)
- [ ] New code has appropriate test coverage
- [ ] Documentation has been updated
- [ ] CHANGELOG.md has been updated (if applicable)
- [ ] Commit messages follow conventional commits format
- [ ] PR description is clear and complete

## 🌟 Recognition

Contributors will be recognized in:
- GitHub contributors page
- Release notes (for significant contributions)
- Project acknowledgments

## 📞 Getting Help

- **Questions**: Open a [Discussion](https://github.com/wakeyi-git/obsidian-card-navigator/discussions)
- **Issues**: File an [Issue](https://github.com/wakeyi-git/obsidian-card-navigator/issues)
- **Contact**: Reach out to [@wakeyi](https://github.com/wakeyi-git)

## 📜 License

By contributing, you agree that your contributions will be licensed under the ISC License.

---

Thank you for contributing to Card Navigator! 🎉

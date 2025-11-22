## 1.1.0 (2025-11-22)

* feat: Dark theme improvements ([a41eeb0](https://github.com/wakeyi-git/obsidian-card-navigator/commit/a41eeb0))
* feat: Dark theme improvements ([a97d52e](https://github.com/wakeyi-git/obsidian-card-navigator/commit/a97d52e))
* feat(keyboard): add render mode toggle keyboard shortcut ([4535518](https://github.com/wakeyi-git/obsidian-card-navigator/commit/4535518))
* feat(release): add automated GitHub release workflow ([52f8ba7](https://github.com/wakeyi-git/obsidian-card-navigator/commit/52f8ba7)), closes [softprops/action-#release](https://github.com/softprops/action-/issues/release)
* chore: remove .github from gitignore and add release automation ([5d9d9e2](https://github.com/wakeyi-git/obsidian-card-navigator/commit/5d9d9e2))
* docs(changelog): add dark mode optimization to unreleased section ([af900db](https://github.com/wakeyi-git/obsidian-card-navigator/commit/af900db))
* code improve ([fc957bd](https://github.com/wakeyi-git/obsidian-card-navigator/commit/fc957bd))
* code improve 2 ([bd2de2f](https://github.com/wakeyi-git/obsidian-card-navigator/commit/bd2de2f))
* code improve 3 ([3d11e85](https://github.com/wakeyi-git/obsidian-card-navigator/commit/3d11e85))
* delet interactivelayoutsettings ([f3e6e3c](https://github.com/wakeyi-git/obsidian-card-navigator/commit/f3e6e3c))
* hotkeys ([9b1978d](https://github.com/wakeyi-git/obsidian-card-navigator/commit/9b1978d))
* i18n ([740898a](https://github.com/wakeyi-git/obsidian-card-navigator/commit/740898a))
* import preset and markdown-html ([6df005d](https://github.com/wakeyi-git/obsidian-card-navigator/commit/6df005d))
* InlineEditor Removal ([d0fa1be](https://github.com/wakeyi-git/obsidian-card-navigator/commit/d0fa1be))
* layout ([b2ed7cd](https://github.com/wakeyi-git/obsidian-card-navigator/commit/b2ed7cd))
* layout min max ([914e14d](https://github.com/wakeyi-git/obsidian-card-navigator/commit/914e14d))
* markdown-html ([3a19738](https://github.com/wakeyi-git/obsidian-card-navigator/commit/3a19738))
* performance ([fa6b2cd](https://github.com/wakeyi-git/obsidian-card-navigator/commit/fa6b2cd))
* performance ([2ae4262](https://github.com/wakeyi-git/obsidian-card-navigator/commit/2ae4262))
* preset edit ([4343c41](https://github.com/wakeyi-git/obsidian-card-navigator/commit/4343c41))
* preview card style ([c37e367](https://github.com/wakeyi-git/obsidian-card-navigator/commit/c37e367))
* settings style ([63fba2b](https://github.com/wakeyi-git/obsidian-card-navigator/commit/63fba2b))
* settingsTab Tab ([c673228](https://github.com/wakeyi-git/obsidian-card-navigator/commit/c673228))
* tag margin ([969ffc3](https://github.com/wakeyi-git/obsidian-card-navigator/commit/969ffc3))
* text color ([087d474](https://github.com/wakeyi-git/obsidian-card-navigator/commit/087d474))
* third commit ([86500d1](https://github.com/wakeyi-git/obsidian-card-navigator/commit/86500d1))



# Changelog

All notable changes to Card Navigator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-20

### 🎉 Initial Release

First public release of Card Navigator!

### Added

#### Core Features
- **Folder Mode**: Browse notes by folder hierarchy with recursive folder exploration
- **Tag Mode**: Group and navigate notes by tags with multi-tag support
- **Search Mode**: Real-time search across filenames and content

#### Card System
- **Flexible Card Builder**: Configure Header, Body, and Footer sections independently
- **Multiple Content Types**: Display filename, path, headings, body text, tags, dates, file size, and more
- **Three Rendering Modes**: Plain text, Markdown, and Markdown+HTML rendering
- **State-Based Styling**: Different visual styles for normal, active, and focused cards

#### Layouts
- **Grid Layout**: Responsive card grid with customizable card size and spacing
- **List Layout**: Compact list view for efficient browsing
- **Auto-Fit**: Cards automatically adjust to available space

#### User Experience
- **Keyboard Navigation**: Navigate cards with arrow keys, open with Enter
- **Multi-Selection**: Select and manage multiple cards at once
- **Active Card Focus**: Automatically highlight and scroll to currently open note
- **Context Menu**: Right-click menu for card actions

#### Preset System
- **Save Configurations**: Store favorite settings as named presets
- **File-Based Mapping**: Automatically apply presets based on current file
- **Quick Switching**: Easy preset selection from dropdown menu
- **Preset Management**: Create, edit, and delete presets

#### Settings
- **Comprehensive Settings UI**: Intuitive interface for all configuration options
- **Card Content Configuration**: Customize what appears in each card section
- **Layout Options**: Adjust card size, spacing, and arrangement
- **Color Customization**: Set colors for normal, active, and focused states
- **Sorting Options**: Sort by filename, modified date, created date, or file size
- **Debug Mode**: Toggle debug logging for troubleshooting

#### Technical
- TypeScript-based development with strict type checking
- Modular architecture for maintainability and extensibility
- Jest testing framework with unit tests
- ESLint for code quality
- esbuild for fast bundling
- Comprehensive debug logging system

### Platform Support
- ✅ Desktop (Windows, macOS, Linux)
- ✅ Mobile (iOS, Android)

### Performance
- Efficient rendering with memoization
- Optimized for vaults with thousands of notes
- Minimal performance impact on Obsidian

---

## [Unreleased]

### Added

#### Dark Mode Optimization
- **CSS Custom Properties**: Theme-aware CSS variables for shadows (`--cn-shadow-sm`, `--cn-shadow-md`, `--cn-shadow-lg`, `--cn-modal-backdrop`)
- **Adaptive Shadows**: Different shadow opacity for light mode (0.05-0.5) and dark mode (0.3-0.7) for better visibility
- **Comprehensive Testing**: Added 12 new test cases for dark mode functionality in `CardStyles.darkmode.test.ts`

#### Keyboard Shortcuts
- **Render Mode Toggle**: New keyboard command to quickly switch between Plain Text and Markdown+HTML rendering modes
  - Command ID: `toggle-render-mode`
  - Provides instant visual feedback via notice message

#### Developer Experience
- **Automated Release Workflow**: GitHub Actions workflow for automated releases with changelog extraction
- **Version Sync Script**: Automatic synchronization of versions across package.json, manifest.json, and versions.json
- **Release Commands**: Convenient npm scripts for patch, minor, and major releases (`npm run release:patch/minor/major`)
- **Release Guide**: Comprehensive documentation for the release process at `.github/RELEASE_GUIDE.md`

### Changed
- Replaced all hardcoded `rgba` shadow values with CSS variables throughout `styles.css`
- Improved theme switching behavior with dedicated `.theme-dark` and `.theme-light` classes
- Removed `.github` from `.gitignore` to enable GitHub Actions workflows

### Planned Features
- Custom card templates
- Advanced filtering options
- More sorting criteria
- Card export functionality
- Integration with other plugins

---

## Version History

- **1.0.0** (2025-11-20) - Initial release

---

## Links

- [GitHub Repository](https://github.com/wakeyi-git/obsidian-card-navigator)
- [Report Issues](https://github.com/wakeyi-git/obsidian-card-navigator/issues)
- [Documentation](https://github.com/wakeyi-git/obsidian-card-navigator/blob/main/README.md)

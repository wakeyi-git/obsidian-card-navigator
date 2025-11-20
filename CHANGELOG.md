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

Future updates will be listed here.

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

# Card Navigator

Navigate your Obsidian notes with a beautiful card-based interface. Browse by folder, tag, or search with customizable card layouts.

![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22card-navigator%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/wakeyi/obsidian-card-navigator)
![GitHub](https://img.shields.io/github/license/wakeyi/obsidian-card-navigator)

## ✨ Features

### 🗂️ Three Navigation Modes

- **Folder Mode**: Browse your notes by folder hierarchy
- **Tag Mode**: Group and explore notes by tags
- **Search Mode**: Find notes with real-time search

### 🎴 Customizable Cards

- **Flexible Sections**: Configure Header, Body, and Footer independently
- **Rich Content Types**: Display filename, path, headings, body text, tags, dates, and more
- **Multiple Rendering Modes**: Choose between plain text or markdown with HTML
- **State-Based Styling**: Different styles for normal, active, and focused cards

### 📐 Layout Options

- **Grid Layout**: Responsive card grid with adjustable card size and spacing
- **List Layout**: Compact list view for efficient browsing
- **Active Card Focus**: Automatically highlight and scroll to your currently open note

### 🎯 Preset System

- **Save Configurations**: Store your favorite settings as presets
- **File-Based Mapping**: Automatically apply presets based on the current file
- **Quick Switching**: Easily toggle between different view configurations

### ⌨️ Keyboard Navigation

- **Arrow Keys**: Navigate between cards
- **Enter**: Open selected note
- **Multi-Selection**: Select multiple cards with keyboard shortcuts
- **Select All**: Quick command to select all visible cards

## 📸 Overview

Card Navigator provides three powerful ways to browse your notes:

- **Folder Mode**: Browse notes organized by your vault's folder structure with recursive exploration
- **Tag Mode**: Group notes by tags for easy discovery and organization
- **Search Mode**: Find notes instantly with real-time search across filenames and content
- **Customizable Settings**: Fine-tune every aspect of your card display including layout, colors, and content
- **Preset Management**: Save and switch between different configurations for various workflows

## 🚀 Installation

### From Community Plugins (Not yet)

1. Open Obsidian Settings
2. Go to **Community plugins** and disable Safe mode
3. Click **Browse** and search for "Card Navigator"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/wakeyi-git/obsidian-card-navigator/releases)
2. Extract the files to your vault's plugins folder: `<vault>/.obsidian/plugins/card-navigator/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community plugins

## 📖 Usage

### Opening Card Navigator

- **Ribbon Icon**: Click the grid icon in the left sidebar
- **Command Palette**: Search for "Card Navigator" and select the open command

### Switching Modes

Use the mode selector at the top of the Card Navigator view:
- **Folder Mode**: Browse by folder structure
- **Tag Mode**: Browse by tags
- **Search Mode**: Search across all notes

### Navigating Cards

- **Click**: Select a card
- **Double-Click** or **Enter**: Open the note
- **Arrow Keys**: Move between cards
- **Ctrl/Cmd + Click**: Multi-select cards

### Using Presets

1. Configure your desired settings in the Settings tab
2. Click "Save as Preset" and give it a name
3. Switch between presets using the preset dropdown
4. Optionally map presets to specific files for automatic switching

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Navigate cards | Arrow Keys |
| Open selected note | Enter |
| Close Card Navigator | Escape |
| Select all cards | Ctrl/Cmd + A (when view is focused) |
| Focus on active card | Use "Focus on Card Navigator" command |

## ⚙️ Settings

### Card Content Configuration

Configure what appears in each section of your cards:

- **Header**: Filename, first heading, custom field, etc.
- **Body**: Note excerpt, full content, tags, etc.
- **Footer**: Dates, file path, metadata, etc.

### Display Options

- **Layout**: Choose between grid and list layouts
- **Card Size**: Adjust width and height
- **Spacing**: Control gap between cards
- **Colors**: Customize card colors for different states

### Rendering Modes

- **Plain**: Display content as plain text
- **Markdown + HTML**: Full markdown rendering with HTML support

### Preset System

Create and manage presets for different use cases:
- Research preset with detailed metadata
- Quick browse preset with minimal info
- Focus preset with large cards and spacing

## 📚 Documentation

Comprehensive documentation is available in the [docs/](docs/) directory:

- **[Architecture Guide](docs/ARCHITECTURE.md)** - Complete architectural overview, design patterns, and component details
- **[Testing Guide](docs/TESTING_GUIDE.md)** - How to write and run tests, best practices, and troubleshooting
- **[Improvement Plan](docs/IMPROVEMENT_PLAN.md)** - Roadmap for future enhancements and quality improvements

## 🛠️ Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/wakeyi-git/obsidian-card-navigator.git
cd obsidian-card-navigator

# Install dependencies
npm install

# Start development mode with auto-rebuild
npm run dev
```

### Building

```bash
# Build for production
npm run build
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

For detailed testing information, see the [Testing Guide](docs/TESTING_GUIDE.md).

### Quality Assurance

This project uses automated quality checks:

- **Pre-commit Hooks**: Automatically runs linting and tests on staged files before each commit
- **CI/CD Pipeline**: GitHub Actions runs comprehensive checks on every push:
  - TypeScript type checking
  - ESLint code quality checks
  - Full test suite execution
  - Test coverage validation (55% minimum)
  - Bundle size monitoring (5MB limit)
  - Multi-version Node.js testing (18.x, 20.x)

The pre-commit hooks are powered by [husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged), ensuring code quality before it reaches the repository.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

Before contributing, please read:
- **[Architecture Guide](docs/ARCHITECTURE.md)** to understand the codebase structure
- **[Testing Guide](docs/TESTING_GUIDE.md)** to learn how to write tests
- **[Improvement Plan](docs/IMPROVEMENT_PLAN.md)** to see current priorities

### Guidelines

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
6. Push to the branch (`git push origin feature/AmazingFeature`)
7. Open a Pull Request

## 🐛 Bug Reports & Feature Requests

- **Bug Reports**: Please use the [GitHub Issues](https://github.com/wakeyi-git/obsidian-card-navigator/issues) page
- **Feature Requests**: Open an issue with the "enhancement" label
- **Questions**: Use the [Discussions](https://github.com/wakeyi-git/obsidian-card-navigator/discussions) page

## ⚠️ Known Limitations

- **Inline Editing**: Direct editing of note content within cards is currently disabled in this version. Cards are read-only, and you'll need to open notes to edit them. This feature may be added in a future release.

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes in each version.

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- Inspired by the Obsidian community's need for better note navigation
- Thanks to all contributors and users who provide feedback

## 💖 Support

If you find this plugin helpful, consider supporting its development:

- ⭐ Star this repository on GitHub
- 🐛 Report bugs and request features
- 📝 Share your experience and spread the word

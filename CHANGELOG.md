## [1.4.0] - 2025-11-23

### Added

#### Image Thumbnails (Phase 2)
- **Card Thumbnail Display**: Show the first image from a note as a thumbnail in the card
  - Support for embedded images `![[image.png]]`
  - Support for Markdown images `![](image.jpg)`
  - Support for external images (optional)
  - Configurable thumbnail settings:
    - Enable/disable thumbnails globally
    - Thumbnail size (small: 40px, medium: 60px, large: 80px)
    - Thumbnail position (header/body/footer)
    - Aspect ratio (square/original/16:9)
    - Border radius for rounded corners
  - Fallback options when no image:
    - Icon based on file extension
    - Configurable fallback icon color
- **Performance Optimizations**:
  - Lazy loading for images to improve initial render performance
  - Proper resource path resolution using Obsidian API
  - Efficient image extraction from note content

#### Card Grouping/Sections (Phase 2)
- **Flexible Grouping System**: Organize cards by various criteria with collapsible sections
  - **Grouping Criteria**:
    - By folder (flat or hierarchical)
    - By tag (first tag or all tags mode)
    - By date (year, month, week, or day)
    - By custom property (from frontmatter)
    - By file size (small/medium/large)
    - By first letter (A-Z)
  - **Interactive UI Features**:
    - Collapsible section headers with expand/collapse controls
    - Section count display showing number of files in each group
    - "Expand All" / "Collapse All" buttons for bulk operations
    - Persistent collapsed state across sessions
    - Section-level actions (select all in section, etc.)
  - **Advanced Options**:
    - Hierarchical folder grouping with nested structure
    - Tag grouping with first-tag or all-tags mode
    - Date grouping basis (created date, modified date, or custom property)
    - Custom property grouping for frontmatter-based organization
    - File size thresholds (customizable small/large boundaries)
- **GroupingManager**: New dedicated manager for grouping logic
- **GroupRenderer**: Dedicated rendering component for grouped card display

#### Card Color Coding (Phase 2)
- **Automatic Color Assignment**: Cards can be automatically colored based on various criteria
  - **Color Rules**:
    - By folder (auto-assign colors to different folders)
    - By tag (color code by tags)
    - By custom property (use frontmatter values)
    - By date age (gradient from new to old files)
  - **Customization Options**:
    - Color palette selection
    - Opacity/intensity control
    - Enable/disable per preset
    - Preview in settings
  - **Visual Enhancements**:
    - WCAG-compliant contrast color calculation for text readability
    - Automatic text color adjustment based on background
    - Support for both light and dark themes
- **StyleUtils**: New utility class for centralized color and style operations

### Changed

- **Card Rendering Architecture**: Enhanced to support thumbnails and color coding
  - Refactored `CardRenderer` to handle thumbnail extraction and display
  - Integrated color rules into card styling system
  - Added thumbnail caching for performance
- **ViewRenderer**: Updated to support grouping functionality
  - New rendering path for grouped card display
  - Integrated collapse/expand state management
  - Section header rendering with counts
- **Settings UI**: Expanded with new configuration panels
  - Image Thumbnail Settings panel
  - Card Grouping Settings panel
  - Card Color Coding Settings panel
  - Improved settings organization and UX
- **Type System**: Extended type definitions for new features
  - `ImageThumbnailSettings` interface
  - `GroupingSettings` and `CardGroup` interfaces
  - `ColorCodingSettings` and color rule types
  - Enhanced `CardNavigatorSettings` with new sections

### Internationalization

- **New Translation Keys**: Full i18n support for Phase 2 features
  - Image thumbnail settings (all 7 languages)
  - Card grouping settings (all 7 languages)
  - Card color coding settings (all 7 languages)
  - Group section headers and UI elements

### Performance

- Optimized thumbnail loading with lazy rendering
- Efficient grouping algorithm with minimal overhead
- Cached color calculations for better performance
- Viewport optimization works seamlessly with grouped display

---

## [1.3.1] - 2025-11-23

### Added
- **StyleUtils utility class**: Centralized card styling operations with WCAG-compliant contrast color calculation
- **Enhanced preset management**: Advanced preset configuration with improved UI/UX
- **Improved drag-and-drop handling**: Enhanced DnD functionality for better user experience

### Changed
- **Type safety improvements**: Replaced `any` types with proper TypeScript interfaces
- **Code organization**: Extracted reusable styling logic into utility class
- **Settings UI refinements**: Improved preset and interactive card settings interfaces

### Fixed
- **TypeScript compilation**: Fixed type errors in settings components
- **ESLint compliance**: Resolved linting issues (no-explicit-any, no-case-declarations, no-unused-vars)
- **Import organization**: Added missing type imports for better code maintainability

## [1.3.0] - 2025-11-23

### Added

#### Pin Feature Enhancement
- **Batch Pin Operations**: Multi-select files and pin/unpin them all at once
  - Added pin button to batch action toolbar
  - Toggle logic: if all selected files are pinned → unpin all, otherwise → pin all
  - Success notifications with count
  - Automatic view refresh after operation

#### Batch Star (Bookmark) Operations
- **Multi-select Bookmarking**: Bulk add/remove bookmarks for selected files
  - Added star button to batch action toolbar
  - Integrates with Obsidian's internal bookmark plugin
  - Toggle logic: if all starred → unstar all, otherwise → star all
  - Graceful handling when bookmark plugin is unavailable

#### Multi-Sort Functionality
- **Advanced Multi-level Sorting**: Sort files by multiple criteria in sequence
  - Configure up to 5 sort levels with drag-and-drop reordering
  - Each level can use different criteria (name, date, size, property)
  - Visual modal for easy configuration
  - Enable/disable multi-sort from toolbar
  - Persistent sort configuration in settings

#### Always Show Pinned Files
- **Persistent Pin Display**: Option to always show pinned files regardless of scroll position
  - New setting: "Always show pinned files"
  - Pinned files remain visible even when scrolling out of viewport
  - Works with viewport optimization for better performance

### Changed

#### UI Improvements
- **Icon-based Batch Actions**: Replaced text buttons with clickable icons
  - Cleaner, more compact interface
  - Saves horizontal space in batch action bar
  - Uses Lucide icons: pin, star, tag, folder-input, trash, x
  - Maintains full accessibility with aria-labels

- **Selected Card Text Visibility**: Fixed text readability in selected cards
  - Explicitly set text color to `var(--text-normal)` for all sections
  - Works correctly in both light and dark themes
  - Prevents white-on-white or black-on-black text issues

#### Viewport Rendering Fixes
- **Placeholder-to-Card Rendering**: Fixed hover actions not appearing with many files
  - Refactored `renderPlaceholder` to render directly into placeholder element
  - Eliminated nested card-item structure that caused hover action issues
  - Created dedicated `addHoverActionsToPlaceholder` method

- **Layout Consistency**: Fixed height mismatch between placeholders and cards
  - Mode-specific height strategies:
    - Vertical mode: fixed height for layout stability
    - Horizontal mode: flexible height (100%) to fill container
  - Prevents overlap and layout shift during rendering

- **Pinned Card Borders**: Fixed double border issue in viewport mode
  - Border only shows on rendered cards, not placeholders
  - CSS selectors: `:not(.card-placeholder)` and `.card-rendered`

### Fixed
- Hover actions now appear correctly in both viewport-active and viewport-inactive scenarios
- Pinned card visual indicators no longer overlap
- Multi-select UI no longer breaks with many action buttons
- Text in selected cards remains readable in all themes

### Internationalization
- Added translations for batch pin/star operations (Korean, English, Chinese, Japanese)
- Added pin settings translations (all languages)
- New translation keys:
  - `selection.pin`, `selection.star`
  - `selection.filesPinned()`, `selection.filesUnpinned()`
  - `selection.filesStarred()`, `selection.filesUnstarred()`
  - `selection.bookmarksNotAvailable`
  - `settingsTab.pinSettings.*`

## [1.2.0] - 2025-11-22

### Added

#### Search Result Count Display
- **File Count Display**: Real-time display of filtered/total file count in toolbar
  - Shows "displayed / total" format (e.g., "20 / 100")
  - Updates dynamically as search filters change
  - Clean, minimal design without unnecessary text

#### Saved Searches
- **Search Management**: Save and manage frequently used search queries
  - Save current search with custom name
  - Quick apply from saved searches modal
  - Favorite searches for easy access
  - Recent searches tracking
  - Delete unwanted searches
- **UI Components**:
  - SavedSearchModal: Browse and manage saved searches
  - SaveSearchModal: Save current search with name input
  - SavedSearchManager: Backend for search persistence
- **Internationalization**: Full i18n support for all saved search features

#### Fuzzy Search
- **Comprehensive Fuzzy Matching**: Approximate string matching across all search types
  - Sequential character matching algorithm with scoring
  - Configurable similarity threshold (0-1 scale)
  - Toggle on/off via settings
- **Coverage**: Fuzzy search works with:
  - Basic search: filename, filepath, content, headings, tags, links
  - Advanced search operators:
    - `path:` - Folder path matching
    - `file:` - Filename matching
    - `tag:` - Tag matching (with/without # prefix)
    - `section:` - Heading matching
    - `property:[name]:value` - Property value matching
    - `line:` - Line content matching
    - `content:` - Body content matching
    - `task:`, `task-todo:`, `task-done:` - Task content matching
    - `block:` - Block content matching
    - `link:` - Link target matching
- **Smart Scoring**:
  - Base score: matched characters / text length
  - Bonus for consecutive matches
  - Bonus for beginning position matches
  - Exact and substring matches get higher scores

### Changed
- **Internationalization**: Added searchSection translations for Settings tab
  - English: "Search Settings"
  - Korean: "검색 설정"
- **SearchEngine Architecture**: Refactored to use settings callback pattern
  - Constructor now accepts `getSettings: () => CardNavigatorSettings`
  - Ensures latest settings are always used without stale references
- **UI Refinements**:
  - Toolbar file count display simplified to "20 / 100" format
  - Settings tab "Search" header now uses i18n translations

### Fixed
- **Fuzzy Search Rendering**: Fixed cards not rendering with fuzzy search enabled
  - Added fuzzy matching to async search path (`searchInFileAsync`)
  - Cards now display correctly for all fuzzy search results
- **Advanced Search Fuzzy Support**: Fixed advanced search operators not working with fuzzy search
  - All filter methods now support fuzzy matching
  - Tag search works with partial matches (e.g., "tag:#1차" matches "tag:#1차기의")

---

## [1.1.1] - 2025-11-22

### Fixed
- **Render Mode Toggle Command**: Fixed keyboard shortcut to properly toggle body rendering mode
  - Now correctly toggles `body.contentRenderMode` setting
  - Works seamlessly with preset-based cards
  - Provides proper visual feedback via notice messages
- **Code Cleanup**: Removed unused RenderingSettings component and related code

---

## [1.1.0] - 2025-11-22

### Added

#### Dark Mode Optimization
- **CSS Custom Properties**: Theme-aware CSS variables for shadows (`--cn-shadow-sm`, `--cn-shadow-md`, `--cn-shadow-lg`, `--cn-modal-backdrop`)
- **Adaptive Shadows**: Different shadow opacity for light mode (0.05-0.5) and dark mode (0.3-0.7) for better visibility
- **Comprehensive Testing**: Added 12 new test cases for dark mode functionality

#### Keyboard Shortcuts
- **Render Mode Toggle**: New keyboard command to quickly switch between Plain Text and Markdown+HTML rendering modes
  - Command ID: `toggle-render-mode`
  - Provides instant visual feedback via notice message

#### Developer Experience
- **Automated Release Workflow**: GitHub Actions workflow for automated releases with changelog extraction
- **Version Sync Script**: Automatic synchronization of versions across package.json, manifest.json, and versions.json
- **Release Commands**: Convenient npm scripts for patch, minor, and major releases (`npm run release:patch/minor/major`)

### Changed
- Replaced all hardcoded `rgba` shadow values with CSS variables throughout styles.css
- Improved theme switching behavior with dedicated `.theme-dark` and `.theme-light` classes
- Removed `.github` from `.gitignore` to enable GitHub Actions workflows

### Fixed
- Resolved 40 ESLint errors in source code for CI/CD compliance
- Fixed flaky timing-based test in SearchEngine cache functionality
- Added tests directory to repository for proper CI/CD execution



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

## Version History

- **1.1.1** (2025-11-22) - Render mode toggle fix, code cleanup
- **1.1.0** (2025-11-22) - Dark mode optimization, render mode toggle, automated releases
- **1.0.0** (2025-11-20) - Initial release

---

## Links

- [GitHub Repository](https://github.com/wakeyi-git/obsidian-card-navigator)
- [Report Issues](https://github.com/wakeyi-git/obsidian-card-navigator/issues)
- [Documentation](https://github.com/wakeyi-git/obsidian-card-navigator/blob/main/README.md)

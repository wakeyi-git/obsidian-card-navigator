## [1.4.8] - 2025-11-24

### Added

#### Incremental Rendering Progress UI (Section 13.1)
- **ProgressBar Component**: New visual progress indicator for incremental rendering
  - Displays a thin 3px progress bar below the toolbar during large card rendering operations
  - Smooth animations with accent color and glow effect
  - Auto-hides with fade-out animation when rendering completes
  - Shows only when rendering 50+ cards
  - Related files: [ProgressBar.ts](src/ui/ProgressBar.ts), [ViewRenderer.ts](src/view/ViewRenderer.ts), [styles.css](styles.css)

#### Performance Settings UI (Section 13.2)
- **Chunk Size Configuration**: Added configurable chunk size setting in "Other" → "Performance" tab
  - Adjustable slider (5-50 cards, step 5)
  - Default: 20 cards per chunk
  - Lower values: smoother experience, slower loading
  - Higher values: faster loading, possible brief UI freezes
  - Applied dynamically to IncrementalRenderer
  - Related files: [SettingsTab.ts](src/ui/SettingsTab.ts), [types.ts](src/types.ts), [IncrementalRenderer.ts](src/view/IncrementalRenderer.ts)

#### Internationalization
- **Performance Settings Translation**: Added translations for new performance settings
  - Korean: "성능", "증분 렌더링 청크 크기"
  - English: "Performance", "Incremental rendering chunk size"
  - Related files: [ko.ts](src/i18n/locales/ko.ts), [en.ts](src/i18n/locales/en.ts)

### Improved

#### Selection Management Optimization (Section 8.3)
- **State-Based Selection Updates**: Optimized SelectionManager to minimize DOM queries
  - Card element caching using `Map<string, HTMLElement>` for O(1) lookup
  - State tracking with Set diff algorithm to detect changes (added/removed)
  - Only updates changed cards instead of all cards
  - Selection bar element reuse (recreated only when needed)
  - `buildCardCache()` method called after rendering to populate cache
  - Related file: [SelectionManager.ts](src/selection/SelectionManager.ts)

#### Performance
- **Reduced DOM Queries**: Selection updates now use cached elements instead of repeated `querySelectorAll()`
- **Incremental Rendering Feedback**: Users can now see progress when rendering many cards
- **Configurable Performance**: Users can balance smoothness vs speed based on their needs

### Changed

#### Architecture
- **ViewRenderer Integration**: Progress bar integrated into standard and viewport rendering paths
  - Shows progress bar for 50+ cards
  - Hides instantly on render cancellation
  - Calls `buildCardCache()` after rendering completes

#### Test Coverage
- **Mock Updates**: Updated test mocks to include `buildCardCache()` method
- All tests passing (49/49 suites, 1,266 tests)

## [1.4.7] - 2025-11-24

### Added

#### Enhanced Metadata Caching (Phase 5.3)
- **EnhancedMetadataCache**: New LRU-based caching layer for file content and extracted data
  - Caches file content with mtime-based invalidation
  - Caches extracted data (emoji, etc.) to avoid redundant computation
  - Maximum 200 items with automatic eviction of least recently used entries
  - Reduces repetitive file reads and improves performance
  - Related files: [MetadataCache.ts](src/card/MetadataCache.ts), [CardData.ts](src/card/CardData.ts)

#### Debug Logging Enhancement
- **Cache Logging Category**: Added 'Cache' category to debug logging system
  - Monitor cache hits/misses in developer console
  - Track cache invalidation and eviction events
  - View cache statistics for performance analysis
  - Related files: [types.ts](src/types.ts), [SettingsTab.ts](src/ui/SettingsTab.ts)

### Changed

#### Performance Optimization
- **File Reading**: Replaced direct `vault.read()` calls with cached reads via `EnhancedMetadataCache`
  - File content is now cached and reused across multiple extractions
  - Same file is read only once even when used by different render modes
  - Cache automatically invalidates when file is modified (mtime check)
  - Related file: [CardData.ts](src/card/CardData.ts)

#### Internationalization
- **Cache Translation**: Added cache-related translations to all language files
  - Korean: "캐시" - "메타데이터 캐시, 콘텐츠 캐시 등"
  - English: "Cache" - "Metadata cache, content cache"
  - Related files: [ko.ts](src/i18n/locales/ko.ts), [en.ts](src/i18n/locales/en.ts)

### Improved

#### Memory Efficiency
- **LRU Eviction**: Automatic cache size management prevents unbounded memory growth
- **Smart Invalidation**: Only invalidates cache entries for modified files, preserving others

#### Test Coverage
- **Cache Testing**: Updated tests to reflect new caching behavior
  - Tests verify cache reuse across different render modes
  - Tests confirm cache invalidation on file changes
  - All 1263 tests passing with new cache implementation

## [1.4.6] - 2025-11-23

### Fixed

#### Keyboard Navigation with Grouping
- **Focus and File Opening Mismatch**: Fixed issue where focused card and opened file were different when grouping was enabled
  - Problem: Card order in DOM and keyboard navigation system were out of sync when groups were collapsed
  - Solution: Keyboard navigation now uses actual DOM order instead of full file list
  - Collapsed groups are properly excluded from keyboard navigation
  - Related files: [ViewRenderer.ts](src/view/ViewRenderer.ts), [KeyboardNav.ts](src/navigation/KeyboardNav.ts)

#### Focus Card Command
- **Focus Command Not Working**: Fixed "Focus on Card Navigator (active card)" hotkey not focusing properly
  - Problem: When active file was missing, direct DOM manipulation bypassed KeyboardNavigator
  - Solution: Now uses `KeyboardNavigator.focusCardElement()` method consistently
  - Proper focused styles are now applied
  - Keyboard navigation state is correctly maintained
  - Related file: [view.ts](src/view.ts)

## [1.4.5] - 2025-11-23

### Fixed

#### Theme Responsiveness
- **Automatic Theme Adaptation**: Cards now automatically adapt to Obsidian theme changes
  - Text color automatically adjusts for readability based on background color
  - Smooth color transitions when switching between light and dark themes
  - Theme change detection via `css-change` event listener
  - Related files: [styles.css](styles.css), [view.ts](src/view.ts)

#### Style Inheritance System
- **Complete Property Inheritance**: Fixed inheritance feature for Active/Focused card states
  - All style properties (background, font, borders) now properly inherit from Normal state
  - Border properties (color, width, radius) were missing from inheritance - now fixed
  - Real-time updates when Normal state changes propagate to inherited states
  - Related files: [StyleUtils.ts](src/utils/StyleUtils.ts), [InteractiveCardSettings.ts](src/ui/settings/InteractiveCardSettings.ts)

#### CSS/TypeScript Consistency
- **Border Variable Integration**: Resolved conflicts between CSS and TypeScript styling
  - CSS now uses border variables set by TypeScript (previously used hardcoded values)
  - Header, body, and footer sections now support customizable borders
  - Proper fallback chains for Active/Focused states
  - Related file: [styles.css](styles.css)

#### Settings UI Stability
- **Layout Stabilization**: Fixed card preview and hint message position shifting
  - Card preview section uses explicit flexbox ordering
  - Elements maintain consistent order regardless of browser or content changes
  - Grid layout with explicit row/column positioning
  - Related files: [styles.css](styles.css), [InteractiveCardSettings.ts](src/ui/settings/InteractiveCardSettings.ts)

### Improved

#### Visual Polish
- **Smooth Transitions**: Added 0.2s transitions to all card style changes
- **Theme Integration**: Better integration with Obsidian's native theme system using `color-scheme` property

## [1.4.4] - 2025-11-23

### Added

#### Pin Settings Enhancement
- **Pinned Files Grouping**: New option to show pinned files as a separate group when grouping is enabled
  - New setting: "Show pinned files as separate group" under Pin Settings
  - When enabled, pinned files appear in a dedicated "Pinned" group at the top
  - Pinned group always stays at the top regardless of group sorting rules
  - Related files: [GroupingManager.ts](src/grouping/GroupingManager.ts), [types.ts](src/types.ts)

### Changed

#### Settings UI Reorganization
- **Pin Settings Location**: Moved pin settings from "Mode & Search" tab to "Grouping & Sort" tab
  - Pin settings now appear as a subsection after grouping settings
  - "Show pinned files as separate group" option only visible when grouping is enabled
  - Improves logical grouping of related settings
  - Related files: [SettingsTab.ts](src/ui/SettingsTab.ts), [ModeSettings.ts](src/ui/settings/ModeSettings.ts)

- **Tab Label Updates**: Updated settings tab labels for better clarity
  - "카드 목록 작성" → "모드 및 검색" (Mode & Search)
  - All tab labels now support internationalization (Korean/English)
  - Related files: [ko.ts](src/i18n/locales/ko.ts), [en.ts](src/i18n/locales/en.ts)

#### Pinned Files Behavior Improvements
- **Smart Grouping Integration**: Pinned files now work harmoniously with grouping
  - When grouping is disabled: Pinned files appear at the top (existing behavior)
  - When grouping is enabled + "Show as separate group" OFF: Pinned files have priority within each group
  - When grouping is enabled + "Show as separate group" ON: Pinned files appear in dedicated "Pinned" group
  - Related file: [SortManager.ts](src/sort/SortManager.ts)

### Improved

#### User Experience
- **Better Pin Management**: Users can now choose how pinned files interact with grouping
- **Contextual Settings**: Related settings are now grouped together logically
- **Multilingual Support**: All tab labels properly support multiple languages

## [1.4.3] - 2025-11-23

### Changed

#### Settings UI Reorganization
- **Settings Tab Structure**: Reorganized settings tabs for better usability and logical grouping
  - Reduced from 8 tabs to 7 tabs by merging related settings
  - Tab structure:
    1. **카드 목록 작성** (Card List Creation): Folder/Tag/Search mode and search settings
    2. **그룹화 및 정렬** (Grouping & Sorting): Card grouping and sorting settings
    3. **카드 설정** (Card Settings): Unified card content (data) and styling settings with interactive preview
    4. **레이아웃** (Layout): Grid/Masonry layout settings
    5. **상호작용** (Interaction): Navigation, tag click, and drag & drop settings
    6. **프리셋** (Presets): Preset management
    7. **기타** (Other): Language, debug mode, and settings management (reduced from 9 items to 3)
  - Related file: [SettingsTab.ts](src/ui/SettingsTab.ts)

#### Code Refactoring & Optimization
- **StyleUtils Enhancement**: Added centralized contrast color calculation and card style application
  - New `getContrastColor()` method for automatic text color calculation based on background
  - New `applyCardCustomProperties()` method for consistent CSS custom property management
  - Removed duplicate color calculation logic from CardRenderer and InteractiveCardSettings
  - Related files: [StyleUtils.ts](src/utils/StyleUtils.ts), [CardRenderer.ts](src/card/CardRenderer.ts)

- **ViewRenderer Optimization**: Improved card rendering performance and reliability
  - Separated navigation state preservation into dedicated method `preserveNavigationState()`
  - Optimized card initialization flow with better state management
  - Enhanced error handling with try-catch blocks and detailed logging
  - Related file: [ViewRenderer.ts](src/view/ViewRenderer.ts)

### Improved

#### User Experience
- **Settings Organization**: Much cleaner settings UI with logical grouping
  - "Other" tab now contains only 3 essential items (down from 9)
  - Card content and styling unified in one tab with interactive preview
  - Better navigation flow: List Creation → Grouping/Sorting → Card Settings → Layout → Interaction → Presets → Other

#### Code Quality
- **Maintainability**: Centralized common utility functions to reduce code duplication
- **Consistency**: Unified CSS custom property application across components
- **Reliability**: Better error handling and state management in view rendering

## [1.4.2] - 2025-11-23

### Fixed

#### Layout Stabilization
- **Grouped Cards Grid Layout**: Fixed grouped cards displaying in only 1 column despite correct gridSize calculation
  - Added `grid-template-columns` for vertical mode on `.card-group-content`
  - Added `grid-template-rows` for horizontal mode on `.card-group-content`
  - Grouped cards now display in correct number of columns/rows based on container size
  - Auto column/row adjustment now works correctly in both grouped and non-grouped modes
  - Related files: [styles.css:3428-3434](styles.css#L3428-L3434), [styles.css:3437-3451](styles.css#L3437-L3451)

- **Horizontal Mode Scroll to Center**: Fixed active card scrolling in horizontal mode
  - Active cards now properly scroll to horizontal center of container
  - Implemented mode-aware scroll logic: vertical mode uses `block='center'`, horizontal mode uses `inline='center'`
  - Fixed both animated scroll (smooth behavior) and instant scroll (no animation) modes
  - Related files: [ScrollManager.ts:48-86](src/navigation/ScrollManager.ts#L48-L86), [ScrollManager.ts:171-196](src/navigation/ScrollManager.ts#L171-L196)

- **Initial Loading Stability**: Improved layout initialization reliability
  - Added container size validation during LayoutManager initialization
  - Prevents incorrect mode detection when container size is not yet determined
  - Uses safe default mode ('vertical') until ResizeObserver confirms actual container size
  - Related file: [LayoutManager.ts:42-57](src/layout/LayoutManager.ts#L42-L57)

### Changed

- **Debug Logging Enhancement**: Added comprehensive debug logging for layout operations
  - Layout initialization logging with container size and mode detection reasoning
  - ResizeObserver trigger logging with size changes and threshold comparison
  - Layout application completion logging with applied classes and CSS variables
  - Helps diagnose layout issues when Debug Mode is enabled

### Documentation

- **Layout Fix Documentation**: Created comprehensive documentation of layout fixes
  - [LAYOUT_FIX_SUMMARY.md](LAYOUT_FIX_SUMMARY.md): Complete summary of all layout-related fixes
  - Root cause analysis for each issue
  - Before/after comparison with code examples
  - Expected behavior and testing results

## [1.4.1] - 2025-01-23

### Fixed

#### Grouping Stability Improvements
- **Group State Synchronization**: Fixed group collapse/expand state inconsistency
  - Group toggle now properly reads from localStorage instead of stale snapshot
  - Prevents state desynchronization between renders
- **Lazy Card Rendering**: Implemented proper card rendering when expanding collapsed groups
  - Cards are now correctly rendered when a group is expanded for the first time
  - Fixes issue where cards added to collapsed groups weren't visible after expanding
  - Optimized performance by only rendering cards when groups are expanded
- **Horizontal Mode Layout**: Fixed group container rendering in horizontal mode
  - Corrected CSS `max-width`/`min-width` properties for proper grid expansion
  - Fixed collapsed state animations in horizontal mode
  - Group content now scrolls correctly in horizontal layout
- **Metadata Cache Handling**: Enhanced detection and logging for metadata cache readiness
  - Added warnings when metadata cache is not ready during grouping
  - Temporary fallback to "untagged" group until cache is available

### Changed

- **Group Toggle Logic**: Enhanced `onGroupToggle` to be async for proper card rendering
- **Debug Logging**: Added comprehensive debug logs for group operations
  - Toggle events
  - Card rendering status
  - Group state changes

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

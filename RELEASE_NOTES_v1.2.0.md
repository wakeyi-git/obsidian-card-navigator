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

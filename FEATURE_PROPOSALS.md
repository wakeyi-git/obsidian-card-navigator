# Card Navigator - Feature Proposals

This document outlines proposed new features and enhancements for the Card Navigator plugin.

**Last Updated**: 2025-11-22
**Plugin Version**: 1.1.1

---

## 📌 Executive Summary

Card Navigator is a mature Obsidian plugin with comprehensive functionality including:
- ✅ 3 navigation modes (Folder, Tag, Search)
- ✅ Customizable card layouts and styling
- ✅ Preset system with import/export
- ✅ Viewport-based rendering optimization
- ✅ Bulk operations (tag adding, file moving, deletion)
- ✅ 7 language support
- ✅ Multi-selection with keyboard shortcuts
- ✅ Context menu with extensive file operations

This document proposes **new features** to enhance user experience and expand the plugin's capabilities.

---

## 🎯 High Priority Features

### 1. **Saved Searches**

**Status**: Not Implemented
**Effort**: Low (2-3 hours)
**Impact**: High

#### Description
Allow users to save frequently-used search queries for quick access. Similar to the preset system, but specifically for search mode.

#### Proposed Features
- Save current search query with a name
- Quick access dropdown in search mode
- Search history (automatic LRU cache, last 20 searches)
- Star/favorite specific searches
- Export/import saved searches

#### Technical Approach
```typescript
interface SavedSearch {
    id: string;
    name: string;
    query: string;
    createdAt: number;
    lastUsed: number;
    favorite: boolean;
}

// Leverage existing LRU cache pattern from SearchEngine
// Reuse preset UI patterns for saved search management
```

#### Why This Matters
- Reduces repetitive typing for common searches
- Enables power users to build a library of useful queries
- Complements existing preset system (presets = display settings, saved searches = query shortcuts)

---

### 2. **Search Result Count Display**

**Status**: Not Implemented
**Effort**: Very Low (30 minutes)
**Impact**: Medium

#### Description
Display the count of currently visible cards and total available cards.

#### Proposed UI
```
┌─────────────────────────────────┐
│  🔍 Search: "meeting"           │
│  📊 Showing 23 / 156 notes      │
└─────────────────────────────────┘
```

#### Implementation Location
- Add to toolbar next to search input
- Update on every filter/search operation
- Format: `Showing X / Y notes` (translatable)

#### Why This Matters
- Provides immediate feedback on search/filter effectiveness
- Helps users understand the scope of their current view
- Common pattern in file managers and search tools

---

### 3. **Fuzzy Search Enhancement**

**Status**: Partially Implemented (uses Obsidian's search API)
**Effort**: Medium (3-4 hours)
**Impact**: High

#### Description
Add fuzzy matching to find notes even with typos or partial matches.

#### Current State
- Plugin uses `prepareSimpleSearch()` from Obsidian API
- Supports exact matches and some operators

#### Proposed Enhancement
- Integrate fuzzy matching using Levenshtein distance
- Note: `leven` package already installed as dependency (via jest)
- Add setting to toggle fuzzy search (off by default for performance)
- Add setting for fuzzy threshold (default: 0.7)

#### Example Use Cases
```
Query: "meetng"     → Matches: "meeting notes", "meetings/daily"
Query: "prject"     → Matches: "project", "projects/2024"
Query: "reviw"      → Matches: "review", "code-review"
```

#### Why This Matters
- Reduces frustration from typos
- More forgiving search experience
- Especially helpful on mobile devices

---

### 4. **Timeline/Calendar View**

**Status**: Not Implemented
**Effort**: High (2-3 days)
**Impact**: Medium-High

#### Description
Add a new navigation mode that organizes cards by date (created or modified).

#### Proposed Features
- New mode alongside Folder/Tag/Search
- Date grouping options:
  - By day (for daily notes, journals)
  - By week
  - By month
  - By year
- Sort options:
  - Created date
  - Modified date
  - Custom date property (from frontmatter)
- Calendar picker for quick date navigation

#### UI Mockup
```
📅 Timeline View (by Month)
├── November 2025 (15 notes)
│   ├── Card 1 (Nov 22)
│   ├── Card 2 (Nov 21)
│   └── ...
├── October 2025 (28 notes)
│   ├── Card 1 (Oct 31)
│   └── ...
└── September 2025 (12 notes)
```

#### Why This Matters
- Perfect for journals, daily notes, meeting minutes
- Complements existing navigation modes
- Helps users find notes by temporal context

---

### 5. **Image Thumbnails**

**Status**: Not Implemented
**Effort**: Medium (4-5 hours)
**Impact**: Medium

#### Description
Display the first image from a note as a thumbnail in the card.

#### Proposed Features
- Extract first image from note content
- Support for:
  - Embedded images `![[image.png]]`
  - Markdown images `![](image.jpg)`
  - External images (optional)
- Fallback options when no image:
  - Icon based on file type
  - Color based on folder/tag
  - First emoji in content
- Settings:
  - Enable/disable thumbnails
  - Thumbnail size (small/medium/large)
  - Thumbnail position (header/body/footer)
  - Aspect ratio (square/original/16:9)

#### Technical Considerations
- Cache thumbnails to avoid re-extraction
- Lazy load images for performance
- Use Obsidian's resource path resolver

#### Why This Matters
- Visual identification of notes
- Especially useful for gallery-like vaults (photos, diagrams, sketches)
- Improves visual appeal and UX

---

## 🚀 Medium Priority Features

### 6. **Card Grouping/Sections**

**Status**: Not Implemented
**Effort**: Medium (5-6 hours)
**Impact**: Medium

#### Description
Add collapsible sections to group cards by various criteria.

#### Proposed Grouping Options
- By folder (hierarchical)
- By tag (first tag, all tags)
- By date (year, month, week)
- By custom property (from frontmatter)
- By file size (small/medium/large)
- By first letter (A-Z)

#### UI Features
- Collapsible section headers
- Section count display
- "Expand All" / "Collapse All" commands
- Remember collapsed state per session
- Section-level actions (select all in section, etc.)

#### Example
```
📁 Projects (23 notes) [▼]
├── Card 1
├── Card 2
└── ...

📁 Personal (15 notes) [▶] (collapsed)

📁 Archive (8 notes) [▼]
├── Card 1
└── ...
```

#### Why This Matters
- Better organization for large result sets
- Reduces visual clutter
- Enables progressive disclosure

---

### 7. **Advanced Multi-Sort**

**Status**: Basic sorting implemented
**Effort**: Low (2-3 hours)
**Impact**: Low-Medium

#### Current State
- Single sort criterion (name, created, modified, size)
- Ascending/descending toggle

#### Proposed Enhancement
- Multi-level sorting (primary, secondary, tertiary)
- Example: Sort by folder → modified date → name
- Save sort configurations in presets
- Quick sort presets dropdown

#### UI Mockup
```
Sort by:
  1. Folder (A-Z)
  2. Modified Date (Newest)
  3. Name (A-Z)

[Save as Sort Preset]
```

#### Why This Matters
- More sophisticated organization options
- Useful for complex vaults with many files
- Power user feature

---

### 8. **Quick Filters**

**Status**: Not Implemented
**Effort**: Medium (3-4 hours)
**Impact**: Medium

#### Description
Add quick filter chips/toggles for common filtering operations.

#### Proposed Filters
- File type (canvas, markdown, excalidraw, etc.)
- Date range (today, this week, this month, custom)
- File size range
- Has images
- Has links
- Has tags
- Has properties
- Recently modified (last 7 days, 30 days)

#### UI Location
- Below toolbar as chip/pill buttons
- Togglable on/off
- Combine filters with AND logic
- Visual indication of active filters

#### Example
```
┌─────────────────────────────────────────┐
│  Filters: [📅 This Week] [🖼️ Has Images] │
│  [❌ Clear All]                          │
└─────────────────────────────────────────┘
```

#### Why This Matters
- Faster filtering without typing search queries
- Visual, discoverable filtering options
- Complements text search

---

### 9. **Card Hover Actions**

**Status**: Not Implemented
**Effort**: Low (2-3 hours)
**Impact**: Low-Medium

#### Description
Show quick action buttons when hovering over a card.

#### Proposed Actions
- Pin/unpin note
- Star/favorite note
- Quick tag add
- Quick copy link
- Quick delete
- Quick share

#### UI Pattern
```
┌─────────────────────────┐
│  Note Title             │
│                         │
│  [📌] [⭐] [🏷️] [🔗] [🗑️] │
└─────────────────────────┘
   ↑ Appears on hover
```

#### Why This Matters
- Faster common actions
- Reduced need for context menu
- Modern UI pattern

---

### 10. **Smart Suggestions**

**Status**: Not Implemented
**Effort**: High (1-2 days)
**Impact**: Medium

#### Description
AI-powered or rule-based suggestions for related notes.

#### Proposed Features
- "Related Notes" section based on:
  - Shared tags
  - Linked notes (backlinks/outlinks)
  - Similar content (TF-IDF, if implemented)
  - Temporal proximity (created/modified around same time)
  - Same folder hierarchy
- Display suggestions in sidebar or below cards
- Click to navigate to suggested note

#### Why This Matters
- Helps discover connections between notes
- Serendipitous note discovery
- Enhances knowledge management workflow

---

## 🔧 Low Priority / Advanced Features

### 11. **Note Templates from Cards**

**Status**: Not Implemented
**Effort**: Low (2-3 hours)
**Impact**: Low

#### Description
Create new notes from templates directly from card view.

#### Proposed Features
- "New Note from Template" button in toolbar
- Quick template selection modal
- Pre-fill note with:
  - Current folder (if in folder mode)
  - Current tags (if in tag mode)
  - Date/time
- Open newly created note automatically

---

### 12. **Card Color Coding**

**Status**: Partially implemented (via custom styles)
**Effort**: Low (2-3 hours)
**Impact**: Low

#### Current State
- Cards have normal/active/focused states
- Custom CSS can be applied

#### Proposed Enhancement
- Auto-assign colors based on:
  - Folder
  - Tag
  - Custom property
  - Date age (recent = green, old = red)
- Color legend/key in settings
- Save color rules in presets

---

### 13. **Export Cards**

**Status**: Not Implemented
**Effort**: Medium (4-5 hours)
**Impact**: Low

#### Description
Export current card view to various formats.

#### Proposed Formats
- HTML (with styles)
- Markdown (list of links)
- CSV (metadata table)
- JSON (structured data)
- PDF (requires additional library)

#### Use Cases
- Share current view with others
- Backup/archive
- Import into other tools

---

### 14. **Mobile Optimizations**

**Status**: Plugin works on mobile but not optimized
**Effort**: Medium (5-6 hours)
**Impact**: Medium (for mobile users)

#### Current State
- `isDesktopOnly: false` in manifest
- Basic functionality works
- Not touch-optimized

#### Proposed Enhancements
- Touch gestures:
  - Swipe left/right for navigation
  - Long-press for context menu
  - Pinch to zoom cards
- Mobile-friendly card sizes
- Simplified toolbar for small screens
- Bottom navigation bar (mobile pattern)
- Haptic feedback on interactions

---

### 15. **Graph View Integration**

**Status**: Not Implemented
**Effort**: High (2-3 days)
**Impact**: Low-Medium

#### Description
Show card relationships in a graph visualization.

#### Proposed Features
- Mini graph showing:
  - Current cards as nodes
  - Links between them as edges
- Click node to navigate to card
- Filter graph by connection strength
- Integrate with Obsidian's native graph view

---

## 🌍 Internationalization Enhancements

### 16. **Complete Missing Translations**

**Status**: Partially translated
**Effort**: Low (per language)
**Impact**: Medium (for non-English users)

#### Current State
- English: Complete
- Korean: Complete
- German, Spanish, French, Japanese, Chinese: Partial

#### Action Items
- Community translation contributions
- Translation guide for contributors
- Translation verification workflow

---

## 📊 Feature Prioritization Matrix

| Feature | Effort | Impact | Priority | Quick Win? |
|---------|--------|--------|----------|------------|
| Search Result Count | Very Low | Medium | High | ✅ Yes |
| Saved Searches | Low | High | High | ✅ Yes |
| Fuzzy Search | Medium | High | High | ✅ Yes |
| Timeline View | High | Medium-High | Medium | ❌ No |
| Image Thumbnails | Medium | Medium | Medium | ✅ Moderate |
| Card Grouping | Medium | Medium | Medium | ❌ No |
| Advanced Multi-Sort | Low | Low-Medium | Medium | ✅ Yes |
| Quick Filters | Medium | Medium | Medium | ❌ No |
| Card Hover Actions | Low | Low-Medium | Low | ✅ Yes |
| Smart Suggestions | High | Medium | Low | ❌ No |
| Note Templates | Low | Low | Low | ✅ Yes |
| Card Color Coding | Low | Low | Low | ✅ Yes |
| Export Cards | Medium | Low | Low | ❌ No |
| Mobile Optimizations | Medium | Medium | Medium | ❌ No |
| Graph View | High | Low-Medium | Low | ❌ No |

---

## 💡 Recommended Implementation Order

### Phase 1: Quick Wins (1-2 weeks)
1. **Search Result Count** (30 min) - Immediate value
2. **Saved Searches** (2-3 hours) - Reuses preset patterns
3. **Fuzzy Search** (3-4 hours) - Dependency already available
4. **Advanced Multi-Sort** (2-3 hours) - Small extension of existing feature
5. **Card Hover Actions** (2-3 hours) - Modern UX improvement

**Total Effort**: ~2 days
**Impact**: High user satisfaction

---

### Phase 2: Visual Enhancements (2-3 weeks)
1. **Image Thumbnails** (4-5 hours) - Visual appeal
2. **Card Grouping** (5-6 hours) - Better organization
3. **Quick Filters** (3-4 hours) - Discoverable filtering
4. **Card Color Coding** (2-3 hours) - Visual organization

**Total Effort**: ~3-4 days
**Impact**: Significantly improved visual UX

---

### Phase 3: Advanced Features (3-4 weeks)
1. **Timeline View** (2-3 days) - New navigation paradigm
2. **Smart Suggestions** (1-2 days) - Knowledge discovery
3. **Mobile Optimizations** (5-6 hours) - Mobile user experience

**Total Effort**: ~5-6 days
**Impact**: Expands plugin capabilities

---

## 🎨 Design Principles

All new features should follow these principles:

1. **Consistency**: Match existing UI patterns and terminology
2. **Performance**: Use caching, debouncing, and viewport optimization
3. **Accessibility**: Keyboard shortcuts, screen reader support
4. **Configurability**: Add settings to enable/disable features
5. **Preset Integration**: Include new settings in preset system
6. **i18n Support**: All UI strings must be translatable
7. **Testing**: Maintain >90% coverage for business logic
8. **Documentation**: Update README and inline docs

---

## 📚 Related Documents

- [Architecture Guide](./ARCHITECTURE.md) - System design and patterns
- [Improvement Plan](./IMPROVEMENT_PLAN.md) - Code quality improvements
- [Testing Guide](./TESTING_GUIDE.md) - Testing best practices
- [Changelog](../CHANGELOG.md) - Version history

---

## 🤝 Contributing

Interested in implementing one of these features? Please:

1. Open an issue to discuss the feature
2. Reference this document and specific feature number
3. Follow the [Architecture Guide](./ARCHITECTURE.md) for implementation patterns
4. Write tests following the [Testing Guide](./TESTING_GUIDE.md)
5. Update this document if feature scope changes

---

## 📝 Feedback

Have ideas for new features not listed here? Please:

- Open a GitHub Discussion for community feedback
- Open a GitHub Issue for specific feature requests
- Tag with `enhancement` label

---

**Last Updated**: 2025-11-22
**Maintainer**: @wakeyi-git

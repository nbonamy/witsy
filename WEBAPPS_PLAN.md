# Web Apps Feature Implementation Plan

## Overview
Add configurable web apps to workspace settings that appear in sidebar and open in embedded webviews with full session persistence.

## Key Technical Decisions (Based on Cherry Studio Analysis)

### Session Persistence
- Use `partition="persist:webview"` - automatically handles:
  - Cookies
  - localStorage
  - sessionStorage
  - Login sessions
  - Form data
- All persisted to `userData/Partitions/persist_webview/`

### User Agent
- Strip "Witsy" and "Electron" from UA (like Cherry Studio does)
- Prevents webapp detection of Electron wrapper

### Memory Management
- **Lazy Loading**: Create webview DOM elements only on first click
- **Context Preservation**: Keep webviews mounted but hidden (preserves page state)
- **Eviction**: Destroy webview DOM after configurable inactivity (default 30 min)
- Track `lastUsed` timestamp on each activation

### UI/UX
- Icon picker: Scrollable grid of all Lucide icons with search
- Auto-save: All changes immediately persist (no save button)
- Drag-to-reorder webapp list
- Allow http:// and https://
- Links stay in webview (don't open externally)
- Allow multiple instances of same URL

### Feature Flag
- Guard with `store.isFeatureEnabled('webapps')`
- Add to `defaults/features.json`: `"webapps": true`

---

## Implementation Checklist

### ✅ Step 0: Setup
- [x] Create git worktree at `/Users/nbonamy/src/nbonamy/witsy-webapps`
- [x] Create this plan document

### ✅ Step 1: Update Types
**Files**: `src/types/workspace.ts`, `src/types/index.ts`, `src/types/config.ts`

- [x] Add `WebApp` type to workspace.ts
- [x] Add `webapps?: WebApp[]` to `Workspace` type
- [x] Update `MainWindowMode` in index.ts to support webapp modes (template literal type)
- [x] Add `webappEvictionMinutes: number` to `GeneralConfig`
- [x] Linting passed ✓

### ✅ Step 2: Feature Flag
**File**: `defaults/features.json`

- [x] Add `"webapps": true`
- [x] Linting passed ✓

### ✅ Step 3: Main Process - Webview Session Setup
**Files**: `src/main/ipc.ts`, `src/main/webview.ts`, `src/main.ts`, `src/preload.ts`

- [x] Create webview.ts service with functions:
  - `initWebviewSession()` - Setup session with custom UA
  - `setWebviewLinkBehavior()` - Configure link handling
  - `setWebviewSpellCheck()` - Enable/disable spell check
- [x] Add IPC handlers in ipc.ts
- [x] Initialize in main.ts whenReady()
- [x] Expose API in preload.ts
- [x] Linting passed ✓

### ⬜ Step 4: WebAppViewer Component
**File**: `src/screens/WebAppViewer.vue`

- [ ] Create component with props: `webapp: WebApp`
- [ ] Use `<webview>` tag:
  - `partition="persist:webview"`
  - `allowpopups`
  - Lazy `src` assignment (only set when first shown)
- [ ] Handle events:
  - `did-finish-load`
  - `did-navigate-in-page` (track URL changes)
  - `dom-ready`
- [ ] Update `lastUsed` timestamp on activation
- [ ] Emit events to parent for state management

### ⬜ Step 5: Update Main.vue
**File**: `src/screens/Main.vue`

- [ ] Import WebAppViewer
- [ ] Track loaded webapps (Map of id -> component instance)
- [ ] Lazy-create WebAppViewer on first activation
- [ ] Show/hide based on mode (keep mounted when hidden)
- [ ] Implement eviction logic:
  - Check lastUsed timestamps periodically
  - Destroy webview DOM if exceeded threshold
  - Keep webapp config intact
- [ ] Handle mode switching for `web-app-{id}` pattern

### ⬜ Step 6: Update MenuBar
**File**: `src/components/MenuBar.vue`

- [ ] Import webapp icons dynamically from Lucide
- [ ] Render webapp items from `store.workspace.webapps?.filter(w => w.enabled)`
- [ ] Position after Computer Use, before agents
- [ ] Emit mode change: `web-app-{id}`
- [ ] Guard with `store.isFeatureEnabled('webapps')`

### ⬜ Step 7: Create Icon Picker Component
**File**: `src/components/IconPicker.vue`

- [ ] Get all Lucide icon names
- [ ] Create scrollable grid layout
- [ ] Add search filter input
- [ ] Show icon preview for each
- [ ] Emit selected icon name
- [ ] Current selection highlight

### ⬜ Step 8: Create SettingsWebApps Component
**File**: `src/settings/SettingsWebApps.vue`

- [ ] List current webapps with drag-to-reorder
  - Use vue-draggable or similar
- [ ] Each item shows:
  - Icon preview
  - Name
  - URL
  - Enabled toggle
  - Edit button
  - Delete button
- [ ] Add webapp button (opens dialog/inline form)
- [ ] Edit webapp form:
  - Name input
  - URL input (validate http/https)
  - Icon picker (use IconPicker component)
  - Enabled toggle
- [ ] Auto-save on every change (use watchers or @change)
- [ ] Delete confirmation dialog
- [ ] Eviction duration setting (in minutes)
- [ ] Save to workspace file immediately

### ⬜ Step 9: Update Settings.vue
**File**: `src/screens/Settings.vue`

- [ ] Add WebApps tab (only if workspaces feature enabled)
- [ ] Import SettingsWebApps component
- [ ] Add to workspace settings section
- [ ] Tab icon: use a Lucide icon (AppWindowIcon?)

### ⬜ Step 10: Localization
**File**: `locales/en.json`

- [ ] Add translations:
  - `settings.tabs.webapps`: "Web Apps"
  - `webapps.title`: "Web Apps"
  - `webapps.add`: "Add Web App"
  - `webapps.edit`: "Edit Web App"
  - `webapps.name`: "Name"
  - `webapps.url`: "URL"
  - `webapps.icon`: "Icon"
  - `webapps.enabled`: "Enabled"
  - `webapps.delete`: "Delete Web App"
  - `webapps.deleteConfirm`: "Are you sure you want to delete this web app?"
  - `webapps.evictionDuration`: "Evict inactive webapps after (minutes)"
  - `webapps.iconSearch`: "Search icons..."
  - `webapps.noApps`: "No web apps configured"

### ⬜ Step 11: Tests
**Files**: New test files in `tests/unit/` and `tests/screens/`

- [ ] Test WebApp type validation
- [ ] Test SettingsWebApps component:
  - Rendering list
  - Add webapp
  - Edit webapp
  - Delete webapp
  - Reorder
  - Auto-save behavior
  - Eviction setting
- [ ] Test IconPicker component
- [ ] Test Main.vue webapp mode switching
- [ ] Test MenuBar webapp rendering

### ⬜ Step 12: Integration & Polish
- [ ] Test end-to-end flow:
  - Add webapp in settings
  - See it in menubar
  - Click to open
  - Verify session persistence (login to a site, close, reopen)
  - Test eviction (wait for timeout)
  - Test reordering
  - Test disable/enable
- [ ] Run linting: `npm run lint`
- [ ] Run tests: `npm test -- --run`
- [ ] Verify no console errors
- [ ] Test with feature flag disabled

---

## Notes
- Working directory: `/Users/nbonamy/src/nbonamy/witsy-webapps`
- Branch: `feature/webapps`
- Cherry Studio reference: `/tmp/cherry-studio`

## After Each Step
- Update this file with completion status
- Run linting
- Commit changes
- Test functionality

# Command Palette Implementation Plan

## 🎯 IMPLEMENTATION STATUS

### ✅ COMPLETED (Phases 1-2 + Partial Phase 3)

**Phase 1: Command Registry** ✅ 100%
- ✅ Created `src/services/command_registry.ts` (171 lines)
- ✅ Created `tests/unit/command_registry.test.ts` (379 lines, 23 tests passing)
- ✅ Implemented: register, unregister, clear, getAll, getByCategory, search, getRecent, markAsExecuted
- ✅ Fuzzy search with scoring (exact > starts-with > contains > fuzzy)
- ✅ Recent commands tracking (max 10, localStorage persistence)
- ✅ All 23 unit tests passing, lint clean

**Phase 2: Command Palette Component** ✅ 100%
- ✅ Created `src/components/CommandPalette.vue` (277 lines)
- ✅ Created `tests/components/command_palette.test.ts` (503 lines, 31 tests passing)
- ✅ Implemented: search input, keyboard nav, recent commands section, alphabetical sorting, disabled states
- ✅ Keyboard navigation: Arrow Up/Down (skip disabled), Enter (execute), Escape (close)
- ✅ Mouse support: hover to select, click to execute
- ✅ Scroll management with scrollIntoView
- ✅ All 31 component tests passing, lint clean

**Phase 3: IPC & Shortcuts** ✅ 60%
- ✅ Added `COMMAND_PALETTE.OPEN` to `src/ipc_consts.ts`
- ✅ Added `commandPalette.onOpen()/offOpen()` to `src/preload.ts`
- ⏳ **NEXT**: Register global shortcut in main process
- ⏳ **NEXT**: Add to ShortcutsConfig type in `src/types/config.ts`
- ⏳ **NEXT**: Add default to `defaults/settings.json`
- ⏳ **NEXT**: Run full test suite

**Test Results**: 2166/2166 passing (2112 existing + 54 new), 0 lint errors

### 🚧 IN PROGRESS - Resume Here

**Next Immediate Steps**:
1. Find shortcut registration pattern in codebase
2. Complete Phase 3: shortcuts + config
3. Run tests
4. Start Phase 4: integration

### ⏳ TODO (Phases 3-5)

**Phase 3: Complete Shortcuts** (40% remaining)
- [ ] Find existing shortcut registration code
- [ ] Register commandPalette shortcut (Cmd/Ctrl+Shift+P) in main process
- [ ] Update `src/types/config.ts` - add commandPalette to ShortcutsConfig
- [ ] Update `defaults/settings.json` - add commandPalette default
- [ ] Run `npm run lint && npm test`

**Phase 4: Integration**
- [ ] Create initializeCommandRegistry() function with all menu items
- [ ] Add CommandPalette to Main.vue
- [ ] Add View menu item
- [ ] Add translations to locales/en.json
- [ ] Run full test suite

**Phase 5: Polish**
- [ ] Manual testing
- [ ] Refine styling
- [ ] Documentation
- [ ] Final tests
- [ ] Commit

---

## Overview

Add a VS Code-style command palette to Witsy that provides quick keyboard access to menu items and application actions. This feature will enhance user productivity by allowing keyboard-driven navigation without requiring memorization of individual shortcuts.

## Decisions Made

Based on clarifications:
1. ✅ **Embedded in Main window** - Component within Main.vue, not separate window
2. ❌ **No user commands** - Excluded from initial implementation (future enhancement)
3. ⚠️ **Show disabled commands** - Commands with false conditions show as disabled/grayed out
4. ✅ **Fuzzy search** - "tgsb" finds "Toggle Sidebar"
5. 📊 **Alphabetical ordering** - Results sorted alphabetically, not by category
6. ⭐ **Recent commands** - Last 10 executed commands appear at top
7. ✅ **Customizable shortcut** - Default Cmd/Ctrl+Shift+P, configurable in settings
8. ✅ **Auto-close** - Palette closes after command execution
9. 🔍 **Debug commands** - Dev-only commands (DevTools, Reload) only in debug mode
10. 📝 **Direct to main** - No feature branch, commit to main
11. 🧪 **Full test suite** - Run complete tests after each phase
12. ✅ **TDD approach** - Write tests first, then implementation

## Goals

1. **Discoverability**: Users can discover all available commands in one place
2. **Efficiency**: Quick keyboard access to any action (Cmd/Ctrl+Shift+P)
3. **Consistency**: Follow Witsy's existing patterns for IPC and UI
4. **Extensibility**: Easy to add new commands as features are added
5. **Performance**: Fast search and filtering with fuzzy matching
6. **Recency**: Recently used commands easily accessible

## Architecture Analysis

### Existing Patterns to Follow

**Command Picker Pattern** (`src/screens/CommandPicker.vue`):
- Keyboard-driven navigation (arrows, enter, escape)
- Auto-closes on blur/escape
- Uses IPC for communication
- Selection state management

**Key Differences for Command Palette**:
- Embedded in Main.vue (not separate window)
- Includes search/filter input
- Broader set of commands (menu items, not user commands)
- Alphabetical sorting
- Recent commands tracking

**Menu Structure** (`src/main/menu.ts`):
- Centralized menu template with callbacks
- Already categorized (App, File, Edit, View, Window, Help)
- Platform-specific items (Mac vs Windows)
- Dynamic items based on focused window state

**IPC Pattern** (`src/ipc_consts.ts` + `src/main/ipc.ts`):
- Namespaced constants (e.g., `CHAT.OPEN`)
- Preload bridge for renderer access

## Detailed Design

### 1. Command Registry Architecture

**Purpose**: Centralize all executable commands with metadata for display in palette.

**File**: `src/services/command_registry.ts`

**Type Definitions**:
```typescript
export type CommandPaletteItem = {
  id: string                           // Unique identifier (e.g., 'file.newChat')
  label: string                        // Display text (localized)
  category: CommandCategory            // For categorization
  shortcut?: string                    // Display format (e.g., '⌘N' or 'Ctrl+N')
  icon?: string                        // Optional emoji or icon
  enabled: boolean                     // Whether command can be executed
  callback: () => void | Promise<void> // Action to execute
  keywords?: string[]                  // Additional search terms
}

export type CommandCategory =
  | 'file'
  | 'edit'
  | 'view'
  | 'window'
  | 'help'
  | 'navigation'

export class CommandRegistry {
  private commands: Map<string, CommandPaletteItem>
  private recentCommands: string[]  // Command IDs, max 10

  register(command: CommandPaletteItem): void
  unregister(id: string): void
  clear(): void
  getAll(): CommandPaletteItem[]
  getRecent(): CommandPaletteItem[]
  getByCategory(category: CommandCategory): CommandPaletteItem[]
  search(query: string): CommandPaletteItem[]  // Fuzzy search
  markAsExecuted(id: string): void  // Track recent usage
}
```

**Command Sources** (Menu Items Only):

1. **File Menu**:
   - New Chat (⌘N / Ctrl+N)
   - Main Window (custom shortcut)
   - Quick Prompt (custom shortcut)
   - Scratchpad (custom shortcut)
   - Design Studio (custom shortcut)
   - Agent Forge (custom shortcut)
   - Export Backup
   - Import Backup
   - Import from OpenAI
   - Close Window / Quit

2. **Edit Menu**:
   - Undo (⌘Z / Ctrl+Z)
   - Redo (⌘⇧Z / Ctrl+Y)
   - Cut (⌘X / Ctrl+X)
   - Copy (⌘C / Ctrl+C)
   - Paste (⌘V / Ctrl+V)
   - Delete Chat (⌘⌫ - Mac only, when chat view)
   - Delete Media (⌘⌫ - Mac only, when studio view)
   - Select All (⌘A / Ctrl+A)
   - Start Dictation (⌘T - when available)

3. **View Menu**:
   - Command Palette (⌘⇧P / Ctrl+Shift+P) - NEW
   - Debug Console
   - Reload (⌘R - debug mode only)
   - Force Reload (⌘⇧R - debug mode only)
   - Toggle DevTools (⌘⌥I - debug mode only)
   - Reset Zoom (⌘0 / Ctrl+0)
   - Zoom In (⌘+ / Ctrl++)
   - Zoom Out (⌘- / Ctrl+-)
   - Toggle Fullscreen (⌃⌘F / F11)

4. **Window Menu**:
   - Minimize
   - Close (⌘W / Ctrl+W)
   - Bring All to Front (Mac only)

5. **Help Menu**:
   - Run Onboarding
   - Go to Data Folder
   - Go to Log Folder
   - Learn More (GitHub)

6. **App Menu** (Mac only):
   - About Witsy
   - Check for Updates
   - Settings (⌘, / Ctrl+,)
   - Services (Mac only)
   - Hide Witsy (⌘H)
   - Hide Others (⌘⌥H)
   - Show All
   - Quit (⌘Q)

7. **Custom Actions** (not in menu):
   - Toggle Sidebar
   - Switch to Chat View
   - Switch to Studio View
   - Switch to Computer Use View

**Implementation Strategy**:

The registry will be populated from the renderer process because:
- Commands need access to Vue event bus and store
- Callbacks can directly trigger UI actions
- Menu items registered by wrapping their IPC calls
- Simpler than duplicating logic

**Search Algorithm**:
```typescript
function fuzzyMatch(query: string, text: string): { match: boolean, score: number } {
  const lowerQuery = query.toLowerCase()
  const lowerText = text.toLowerCase()

  // Exact match (highest score)
  if (lowerText === lowerQuery) {
    return { match: true, score: 100 }
  }

  // Starts with (high score)
  if (lowerText.startsWith(lowerQuery)) {
    return { match: true, score: 90 }
  }

  // Contains (medium score)
  if (lowerText.includes(lowerQuery)) {
    return { match: true, score: 70 }
  }

  // Fuzzy (check all chars appear in order)
  let queryIndex = 0
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++
    }
  }

  if (queryIndex === lowerQuery.length) {
    return { match: true, score: 50 }
  }

  return { match: false, score: 0 }
}

// Search also checks keywords array
// Results sorted by: score desc, then alphabetically
```

**Recent Commands Tracking**:
```typescript
// Store in localStorage
// Format: ['file.newChat', 'view.toggleSidebar', ...]
// Max 10 items, FIFO queue
// Load on init, save on each execution
```

### 2. Command Palette Component

**File**: `src/components/CommandPalette.vue`

**Structure**:
```vue
<template>
  <Teleport to="body">
    <div class="command-palette-backdrop" v-if="visible" @click="close">
      <div class="command-palette" @click.stop>
        <input
          ref="searchInput"
          v-model="searchQuery"
          class="search-input"
          :placeholder="t('commandPalette.placeholder')"
          @keydown="onKeyDown"
        />
        <div class="results" ref="resultsList">
          <!-- Recent commands section (only if no search) -->
          <template v-if="!searchQuery && recentCommands.length > 0">
            <div class="section-header">{{ t('commandPalette.recent') }}</div>
            <div
              v-for="(command, index) in recentCommands"
              :key="'recent-' + command.id"
              :class="{
                'result-item': true,
                'selected': index === selectedIndex,
                'disabled': !command.enabled
              }"
              @mousemove="selectedIndex = index"
              @click="executeCommand(command)"
            >
              <div class="icon" v-if="command.icon">{{ command.icon }}</div>
              <div class="label">{{ command.label }}</div>
              <div class="shortcut" v-if="command.shortcut">{{ command.shortcut }}</div>
            </div>
            <div class="separator"></div>
          </template>

          <!-- All commands (filtered and sorted alphabetically) -->
          <div
            v-for="(command, index) in displayCommands"
            :key="command.id"
            :class="{
              'result-item': true,
              'selected': index + recentOffset === selectedIndex,
              'disabled': !command.enabled
            }"
            @mousemove="selectedIndex = index + recentOffset"
            @click="command.enabled && executeCommand(command)"
          >
            <div class="icon" v-if="command.icon">{{ command.icon }}</div>
            <div class="label">{{ command.label }}</div>
            <div class="shortcut" v-if="command.shortcut">{{ command.shortcut }}</div>
          </div>

          <div class="no-results" v-if="allCommands.length === 0">
            {{ t('commandPalette.noResults') }}
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
```

**Key Features**:

1. **Auto-focus**: When shown, immediately focus search input
2. **Recent Commands**: Show last 10 at top when no search query
3. **Keyboard Navigation**:
   - Arrow Up/Down: Navigate results (skip disabled)
   - Enter: Execute selected command (if enabled)
   - Escape: Close palette
   - Typing: Filters and sorts results in real-time
4. **Mouse Support**: Hover to select, click to execute (if enabled)
5. **Disabled State**: Grayed out, not selectable, not executable
6. **Scroll Management**: Ensure selected item is always visible
7. **Backdrop Click**: Close on click outside

**State Management**:
```typescript
const visible = ref(false)
const searchQuery = ref('')
const selectedIndex = ref(0)
const searchInput = ref<HTMLInputElement>()
const resultsList = ref<HTMLElement>()

// Computed
const recentCommands = computed(() => {
  if (searchQuery.value) return []
  return commandRegistry.getRecent()
})

const recentOffset = computed(() => {
  return searchQuery.value ? 0 : recentCommands.value.length
})

const allCommands = computed(() => {
  if (!searchQuery.value) {
    // All commands, alphabetically sorted, excluding recent
    const all = commandRegistry.getAll()
    const recentIds = new Set(recentCommands.value.map(c => c.id))
    return all
      .filter(c => !recentIds.has(c.id))
      .sort((a, b) => a.label.localeCompare(b.label))
  }
  // Searched and sorted by relevance, then alphabetically
  return commandRegistry.search(searchQuery.value)
})

const displayCommands = computed(() => allCommands.value)

// Methods
const show = async () => {
  visible.value = true
  searchQuery.value = ''
  selectedIndex.value = 0
  await nextTick()
  searchInput.value?.focus()
}

const close = () => {
  visible.value = false
  searchQuery.value = ''
}

const executeCommand = async (command: CommandPaletteItem) => {
  if (!command.enabled) return

  commandRegistry.markAsExecuted(command.id)
  close()
  await nextTick()
  await command.callback()
}

const onKeyDown = (e: KeyboardEvent) => {
  const totalCommands = recentCommands.value.length + allCommands.value.length

  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const allItems = [...recentCommands.value, ...allCommands.value]
    const selected = allItems[selectedIndex.value]
    if (selected?.enabled) {
      executeCommand(selected)
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    // Skip disabled items
    let newIndex = selectedIndex.value + 1
    const allItems = [...recentCommands.value, ...allCommands.value]
    while (newIndex < allItems.length && !allItems[newIndex].enabled) {
      newIndex++
    }
    selectedIndex.value = Math.min(newIndex, totalCommands - 1)
    ensureVisible()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    // Skip disabled items
    let newIndex = selectedIndex.value - 1
    const allItems = [...recentCommands.value, ...allCommands.value]
    while (newIndex >= 0 && !allItems[newIndex].enabled) {
      newIndex--
    }
    selectedIndex.value = Math.max(newIndex, 0)
    ensureVisible()
  }
}

const ensureVisible = () => {
  nextTick(() => {
    const selectedEl = resultsList.value?.querySelector('.selected')
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    }
  })
}

// Watch for search changes, reset selection to first enabled
watch(searchQuery, () => {
  const allItems = [...recentCommands.value, ...allCommands.value]
  selectedIndex.value = allItems.findIndex(c => c.enabled)
  if (selectedIndex.value === -1) selectedIndex.value = 0
})
```

**Styling Approach**:
- Use existing CSS variables from `css/variables.css`
- Match `CommandPicker` styling for consistency:
  - `--context-menu-bg-color` for background
  - `--context-menu-text-color` for text
  - `--highlight-color` for selection
  - `--highlighted-color` for selected text
  - `--faded-text-color` for disabled items
- Backdrop: semi-transparent overlay (rgba(0,0,0,0.5))
- Palette: 600px wide, max 400px tall, centered on screen
- Search input: 16px font, padding, prominent focus ring
- Results: scrollable list, 40px item height
- Separator: 1px line between recent and all commands
- Section header: small, uppercase, muted

### 3. IPC Communication

**Constants** (`src/ipc_consts.ts`):
```typescript
export const COMMAND_PALETTE = {
  OPEN: 'command-palette-open',
} as const
```

**Why minimal IPC?**
- Embedded in main window
- Only need IPC for global shortcut trigger
- Commands execute directly in renderer

**Handlers** (`src/main/ipc.ts`):
```typescript
// No handler needed - using webContents.send directly
```

**Preload** (`src/preload.ts`):
```typescript
commandPalette: {
  onOpen: (callback: () => void) => {
    ipcRenderer.on(COMMAND_PALETTE.OPEN, callback)
  },
  offOpen: (callback: () => void) => {
    ipcRenderer.removeListener(COMMAND_PALETTE.OPEN, callback)
  }
}
```

### 4. Global Shortcut Registration

**Configuration** (`src/types/config.ts`):
```typescript
export type ShortcutsConfig = {
  main: Shortcut
  prompt: Shortcut
  scratchpad: Shortcut
  command: Shortcut
  commandPalette: Shortcut  // NEW
  readaloud: Shortcut
  transcribe: Shortcut
  realtime: Shortcut
  studio: Shortcut
  forge: Shortcut
}
```

**Default Value** (`defaults/settings.json`):
```json
{
  "shortcuts": {
    "commandPalette": {
      "ctrl": false,
      "alt": false,
      "shift": true,
      "meta": true,
      "key": "P"
    }
  }
}
```

**Registration** (`src/main.ts` or where shortcuts are registered):
```typescript
// Find existing shortcut registration code and add:
const commandPaletteShortcut = shortcutAccelerator(config.shortcuts.commandPalette)
if (commandPaletteShortcut) {
  globalShortcut.register(commandPaletteShortcut, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(COMMAND_PALETTE.OPEN)
    }
  })
}

// Don't forget to unregister on app quit
```

### 5. Integration into Main Window

**File**: `src/screens/Main.vue`

**Template Addition**:
```vue
<template>
  <div class="main">
    <!-- Existing content -->
    <CommandPalette ref="commandPalette" />
  </div>
</template>
```

**Script Setup**:
```typescript
import CommandPalette from '../components/CommandPalette.vue'
import { initializeCommandRegistry } from '../services/command_registry'

const commandPalette = ref<typeof CommandPalette>()

onMounted(() => {
  // Initialize command registry
  initializeCommandRegistry()

  // Listen for IPC event to open palette
  window.api.commandPalette.onOpen(() => {
    commandPalette.value?.show()
  })

  // Also allow opening via event bus for internal use
  onEvent('open-command-palette', () => {
    commandPalette.value?.show()
  })
})

onUnmounted(() => {
  window.api.commandPalette.offOpen()
})
```

**Initialize Command Registry** (`src/services/command_registry.ts` - export function):

```typescript
import { commandRegistry } from './command_registry'
import { t } from './i18n'
import { store } from './store'

export const initializeCommandRegistry = () => {

  // Clear first
  commandRegistry.clear()

  const platform = window.api.platform
  const isMac = platform === 'darwin'
  const isDebug = !!process.env.DEBUG

  // Helper to format shortcuts for display
  const formatShortcut = (shortcut: Shortcut | string): string => {
    if (typeof shortcut === 'string') return shortcut
    // Convert Shortcut object to display string
    // ... implementation
  }

  // FILE MENU
  commandRegistry.register({
    id: 'file.newChat',
    label: t('menu.file.newChat'),
    category: 'file',
    shortcut: isMac ? '⌘N' : 'Ctrl+N',
    enabled: true,
    callback: () => window.api.on('new-chat')
  })

  // ... register all menu items
  // ... check conditions for enabled state
  // ... only include debug commands if isDebug is true

  // CUSTOM ACTIONS (not in menu)
  commandRegistry.register({
    id: 'view.toggleSidebar',
    label: t('view.toggleSidebar'),
    category: 'view',
    enabled: true,
    callback: () => emitEvent('toggle-sidebar')
  })

  // ... etc
}
```

### 6. Menu Item Addition

**File**: `src/main/menu.ts`

Add to View menu submenu array (after debug, before separator):
```typescript
{
  label: t('menu.view.title'),
  submenu: [
    {
      label: t('menu.view.commandPalette'),
      accelerator: shortcutAccelerator(shortcuts?.commandPalette),
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(COMMAND_PALETTE.OPEN)
        }
      }
    },
    { type: 'separator' },
    {
      label: t('menu.view.debug'),
      // ... rest of view menu
    }
  ]
}
```

### 7. Localization

**File**: `locales/en.json`

Add translations:
```json
{
  "menu": {
    "view": {
      "commandPalette": "Command Palette..."
    }
  },
  "commandPalette": {
    "placeholder": "Type a command or search...",
    "noResults": "No commands found",
    "recent": "Recently Used"
  }
}
```

## Testing Strategy

### TDD Approach - Write Tests FIRST

For each component/service:
1. Write test file with all test cases
2. Run tests (they will fail - red)
3. Implement minimal code to pass tests (green)
4. Refactor if needed
5. Run full test suite

### Test Execution Plan

**After EVERY code change**:
```bash
npm run lint && npm test
```

No exceptions. Full suite must pass before moving forward.

### Unit Tests - WRITE FIRST

**File**: `tests/unit/command_registry.test.ts`

Write this file BEFORE implementing `command_registry.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommandRegistry } from '../../src/services/command_registry'

describe('CommandRegistry', () => {
  let registry: CommandRegistry

  beforeEach(() => {
    registry = new CommandRegistry()
  })

  describe('basic operations', () => {
    it('should register a command', () => {
      registry.register({
        id: 'test.command',
        label: 'Test Command',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      const commands = registry.getAll()
      expect(commands).toHaveLength(1)
      expect(commands[0].id).toBe('test.command')
    })

    it('should unregister a command', () => {
      registry.register({
        id: 'test.command',
        label: 'Test Command',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.unregister('test.command')
      expect(registry.getAll()).toHaveLength(0)
    })

    it('should clear all commands', () => {
      registry.register({
        id: 'test.command1',
        label: 'Test Command 1',
        category: 'file',
        enabled: true,
        callback: () => {}
      })
      registry.register({
        id: 'test.command2',
        label: 'Test Command 2',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.clear()
      expect(registry.getAll()).toHaveLength(0)
    })

    it('should throw error on duplicate id registration', () => {
      registry.register({
        id: 'test.command',
        label: 'Test Command 1',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      expect(() => {
        registry.register({
          id: 'test.command',
          label: 'Test Command 2',
          category: 'file',
          enabled: true,
          callback: () => {}
        })
      }).toThrow(/already registered/)
    })
  })

  describe('categorization', () => {
    beforeEach(() => {
      registry.register({
        id: 'file.command',
        label: 'File Command',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'edit.command',
        label: 'Edit Command',
        category: 'edit',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'view.command',
        label: 'View Command',
        category: 'view',
        enabled: true,
        callback: () => {}
      })
    })

    it('should get commands by category', () => {
      const fileCommands = registry.getByCategory('file')
      expect(fileCommands).toHaveLength(1)
      expect(fileCommands[0].id).toBe('file.command')
    })

    it('should return empty array for empty category', () => {
      const helpCommands = registry.getByCategory('help')
      expect(helpCommands).toHaveLength(0)
    })
  })

  describe('search functionality', () => {
    beforeEach(() => {
      registry.register({
        id: 'file.newChat',
        label: 'New Chat',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'file.settings',
        label: 'Settings',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'view.toggleSidebar',
        label: 'Toggle Sidebar',
        category: 'view',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'edit.disabled',
        label: 'Disabled Command',
        category: 'edit',
        enabled: false,
        callback: () => {}
      })
    })

    it('should find exact matches', () => {
      const results = registry.search('Settings')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('file.settings')
    })

    it('should find partial matches', () => {
      const results = registry.search('new')
      expect(results.find(r => r.id === 'file.newChat')).toBeDefined()
    })

    it('should be case insensitive', () => {
      const results = registry.search('SETTINGS')
      expect(results.find(r => r.id === 'file.settings')).toBeDefined()
    })

    it('should do fuzzy matching', () => {
      const results = registry.search('tgsb')
      expect(results.find(r => r.id === 'view.toggleSidebar')).toBeDefined()
    })

    it('should search in keywords', () => {
      registry.register({
        id: 'file.preferences',
        label: 'Preferences',
        category: 'file',
        enabled: true,
        keywords: ['settings', 'config', 'options'],
        callback: () => {}
      })

      const results = registry.search('config')
      expect(results.find(r => r.id === 'file.preferences')).toBeDefined()
    })

    it('should return empty array for no matches', () => {
      const results = registry.search('zzzzzzzzz')
      expect(results).toHaveLength(0)
    })

    it('should include disabled commands in search results', () => {
      const results = registry.search('Disabled')
      expect(results.find(r => r.id === 'edit.disabled')).toBeDefined()
    })

    it('should sort results by relevance then alphabetically', () => {
      registry.register({
        id: 'exact',
        label: 'Chat',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      const results = registry.search('chat')

      // Exact match should be first
      expect(results[0].id).toBe('exact')

      // "New Chat" should be second (starts with)
      expect(results[1].id).toBe('file.newChat')
    })
  })

  describe('recent commands', () => {
    beforeEach(() => {
      // Mock localStorage
      global.localStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn()
      }

      for (let i = 0; i < 15; i++) {
        registry.register({
          id: `command.${i}`,
          label: `Command ${i}`,
          category: 'file',
          enabled: true,
          callback: () => {}
        })
      }
    })

    it('should track executed commands', () => {
      registry.markAsExecuted('command.0')
      registry.markAsExecuted('command.1')

      const recent = registry.getRecent()
      expect(recent).toHaveLength(2)
      expect(recent[0].id).toBe('command.1') // Most recent first
      expect(recent[1].id).toBe('command.0')
    })

    it('should limit recent commands to 10', () => {
      for (let i = 0; i < 15; i++) {
        registry.markAsExecuted(`command.${i}`)
      }

      const recent = registry.getRecent()
      expect(recent).toHaveLength(10)
      expect(recent[0].id).toBe('command.14') // Most recent
    })

    it('should not duplicate in recent commands', () => {
      registry.markAsExecuted('command.0')
      registry.markAsExecuted('command.1')
      registry.markAsExecuted('command.0') // Execute again

      const recent = registry.getRecent()
      expect(recent).toHaveLength(2)
      expect(recent[0].id).toBe('command.0') // Moved to top
      expect(recent[1].id).toBe('command.1')
    })

    it('should persist recent commands to localStorage', () => {
      registry.markAsExecuted('command.0')

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'commandPalette.recent',
        expect.stringContaining('command.0')
      )
    })

    it('should load recent commands from localStorage', () => {
      global.localStorage.getItem = vi.fn(() =>
        JSON.stringify(['command.5', 'command.3'])
      )

      const newRegistry = new CommandRegistry()
      for (let i = 0; i < 15; i++) {
        newRegistry.register({
          id: `command.${i}`,
          label: `Command ${i}`,
          category: 'file',
          enabled: true,
          callback: () => {}
        })
      }

      const recent = newRegistry.getRecent()
      expect(recent).toHaveLength(2)
      expect(recent[0].id).toBe('command.5')
    })

    it('should exclude non-existent commands from recent', () => {
      global.localStorage.getItem = vi.fn(() =>
        JSON.stringify(['command.0', 'nonexistent', 'command.1'])
      )

      const newRegistry = new CommandRegistry()
      newRegistry.register({
        id: 'command.0',
        label: 'Command 0',
        category: 'file',
        enabled: true,
        callback: () => {}
      })
      newRegistry.register({
        id: 'command.1',
        label: 'Command 1',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      const recent = newRegistry.getRecent()
      expect(recent).toHaveLength(2)
      expect(recent.find(r => r.id === 'nonexistent')).toBeUndefined()
    })
  })

  describe('callback execution', () => {
    it('should execute sync callback', () => {
      let executed = false

      registry.register({
        id: 'test.command',
        label: 'Test Command',
        category: 'file',
        enabled: true,
        callback: () => { executed = true }
      })

      const command = registry.getAll()[0]
      command.callback()
      expect(executed).toBe(true)
    })

    it('should execute async callback', async () => {
      let executed = false

      registry.register({
        id: 'test.command',
        label: 'Test Command',
        category: 'file',
        enabled: true,
        callback: async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          executed = true
        }
      })

      const command = registry.getAll()[0]
      await command.callback()
      expect(executed).toBe(true)
    })
  })

  describe('enabled state', () => {
    it('should respect enabled flag', () => {
      registry.register({
        id: 'enabled.command',
        label: 'Enabled Command',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'disabled.command',
        label: 'Disabled Command',
        category: 'file',
        enabled: false,
        callback: () => {}
      })

      const all = registry.getAll()
      expect(all[0].enabled).toBe(true)
      expect(all[1].enabled).toBe(false)
    })
  })
})
```

### Component Tests - WRITE FIRST

**File**: `tests/components/command_palette.test.ts`

Write this BEFORE implementing CommandPalette.vue:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import CommandPalette from '../../src/components/CommandPalette.vue'
import { commandRegistry } from '../../src/services/command_registry'

describe('CommandPalette', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    }

    // Clear and populate registry
    commandRegistry.clear()

    commandRegistry.register({
      id: 'test.command1',
      label: 'Test Command 1',
      category: 'file',
      enabled: true,
      callback: vi.fn()
    })

    commandRegistry.register({
      id: 'test.command2',
      label: 'Another Command',
      category: 'edit',
      shortcut: '⌘K',
      enabled: true,
      callback: vi.fn()
    })

    commandRegistry.register({
      id: 'test.disabled',
      label: 'Disabled Command',
      category: 'view',
      enabled: false,
      callback: vi.fn()
    })

    wrapper = mount(CommandPalette)
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('visibility', () => {
    it('should not be visible by default', () => {
      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })

    it('should show when show() is called', async () => {
      await wrapper.vm.show()
      expect(wrapper.find('.command-palette-backdrop').isVisible()).toBe(true)
    })

    it('should hide when close() is called', async () => {
      await wrapper.vm.show()
      await wrapper.vm.close()
      await nextTick()
      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })

    it('should close on backdrop click', async () => {
      await wrapper.vm.show()
      await wrapper.find('.command-palette-backdrop').trigger('click')
      await nextTick()
      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })

    it('should not close on palette content click', async () => {
      await wrapper.vm.show()
      await wrapper.find('.command-palette').trigger('click')
      await nextTick()
      expect(wrapper.find('.command-palette-backdrop').isVisible()).toBe(true)
    })
  })

  describe('search input', () => {
    it('should focus search input when shown', async () => {
      await wrapper.vm.show()
      await nextTick()
      const input = wrapper.find('input.search-input').element as HTMLInputElement
      expect(document.activeElement).toBe(input)
    })

    it('should reset search query when closed and reopened', async () => {
      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.setValue('test query')
      await wrapper.vm.close()
      await wrapper.vm.show()
      await nextTick()
      expect((input.element as HTMLInputElement).value).toBe('')
    })
  })

  describe('command display', () => {
    it('should display commands alphabetically when no search', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const labels = items.map(item => item.find('.label').text())

      // Check alphabetical order (excluding recent section if any)
      const sortedLabels = [...labels].sort()
      expect(labels).toEqual(sortedLabels)
    })

    it('should display shortcuts when available', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const itemWithShortcut = items.find(item =>
        item.find('.label').text() === 'Another Command'
      )

      expect(itemWithShortcut.find('.shortcut').text()).toBe('⌘K')
    })

    it('should show disabled commands as disabled', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const disabledItem = items.find(item =>
        item.find('.label').text() === 'Disabled Command'
      )

      expect(disabledItem.classes()).toContain('disabled')
    })
  })

  describe('search filtering', () => {
    it('should filter commands based on search query', async () => {
      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.setValue('Another')
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items).toHaveLength(1)
      expect(items[0].text()).toContain('Another Command')
    })

    it('should show no results message when no matches', async () => {
      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.setValue('zzzzzzzzz')
      await nextTick()

      expect(wrapper.find('.no-results').isVisible()).toBe(true)
      expect(wrapper.findAll('.result-item')).toHaveLength(0)
    })

    it('should include disabled commands in search results', async () => {
      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.setValue('Disabled')
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items.length).toBeGreaterThan(0)
      expect(items[0].classes()).toContain('disabled')
    })
  })

  describe('recent commands', () => {
    it('should show recent commands section when no search', async () => {
      commandRegistry.markAsExecuted('test.command1')

      await wrapper.vm.show()
      await nextTick()

      expect(wrapper.find('.section-header').text()).toContain('Recently Used')
    })

    it('should hide recent commands section when searching', async () => {
      commandRegistry.markAsExecuted('test.command1')

      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.setValue('test')
      await nextTick()

      expect(wrapper.find('.section-header').exists()).toBe(false)
    })

    it('should show separator between recent and all commands', async () => {
      commandRegistry.markAsExecuted('test.command1')

      await wrapper.vm.show()
      await nextTick()

      expect(wrapper.find('.separator').exists()).toBe(true)
    })
  })

  describe('keyboard navigation', () => {
    it('should select first enabled item by default', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const firstEnabled = items.find(item => !item.classes().includes('disabled'))
      expect(firstEnabled.classes()).toContain('selected')
    })

    it('should navigate down with ArrowDown', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'ArrowDown' })
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items[1].classes()).toContain('selected')
    })

    it('should navigate up with ArrowUp', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'ArrowUp' })
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items[1].classes()).toContain('selected')
    })

    it('should skip disabled items when navigating', async () => {
      // Ensure disabled item is between enabled items
      commandRegistry.clear()
      commandRegistry.register({
        id: 'enabled1',
        label: 'A Enabled',
        category: 'file',
        enabled: true,
        callback: vi.fn()
      })
      commandRegistry.register({
        id: 'disabled',
        label: 'B Disabled',
        category: 'file',
        enabled: false,
        callback: vi.fn()
      })
      commandRegistry.register({
        id: 'enabled2',
        label: 'C Enabled',
        category: 'file',
        enabled: true,
        callback: vi.fn()
      })

      wrapper.unmount()
      wrapper = mount(CommandPalette)
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'ArrowDown' })
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const selected = items.find(item => item.classes().includes('selected'))
      expect(selected.find('.label').text()).toBe('C Enabled')
    })

    it('should not go below first item', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'ArrowUp' })
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items[0].classes()).toContain('selected')
    })

    it('should not go beyond last item', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      const items = wrapper.findAll('.result-item')

      for (let i = 0; i < items.length + 5; i++) {
        await input.trigger('keydown', { key: 'ArrowDown' })
      }
      await nextTick()

      const updatedItems = wrapper.findAll('.result-item')
      expect(updatedItems[updatedItems.length - 1].classes()).toContain('selected')
    })

    it('should close on Escape', async () => {
      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Escape' })
      await nextTick()

      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })
  })

  describe('command execution', () => {
    it('should execute command on Enter', async () => {
      const mockCallback = vi.fn()
      commandRegistry.clear()
      commandRegistry.register({
        id: 'test.enter',
        label: 'Test Enter Command',
        category: 'file',
        enabled: true,
        callback: mockCallback
      })

      wrapper.unmount()
      wrapper = mount(CommandPalette)
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      expect(mockCallback).toHaveBeenCalled()
    })

    it('should not execute disabled command on Enter', async () => {
      const mockCallback = vi.fn()
      commandRegistry.clear()
      commandRegistry.register({
        id: 'test.disabled',
        label: 'Disabled Command',
        category: 'file',
        enabled: false,
        callback: mockCallback
      })

      wrapper.unmount()
      wrapper = mount(CommandPalette)
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should execute command on click', async () => {
      const mockCallback = vi.fn()
      commandRegistry.register({
        id: 'test.click',
        label: 'Test Click Command',
        category: 'file',
        enabled: true,
        callback: mockCallback
      })

      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.setValue('Test Click')
      await nextTick()

      const item = wrapper.find('.result-item')
      await item.trigger('click')
      await nextTick()

      expect(mockCallback).toHaveBeenCalled()
    })

    it('should not execute disabled command on click', async () => {
      const mockCallback = vi.fn()

      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.setValue('Disabled')
      await nextTick()

      const item = wrapper.find('.result-item.disabled')
      await item.trigger('click')
      await nextTick()

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should close after executing command', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })

    it('should track command execution in recent', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      const recent = commandRegistry.getRecent()
      expect(recent.length).toBeGreaterThan(0)
    })
  })

  describe('mouse interaction', () => {
    it('should update selection on mousemove', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      await items[1].trigger('mousemove')
      await nextTick()

      expect(items[1].classes()).toContain('selected')
    })
  })

  describe('scroll behavior', () => {
    it('should ensure selected item is visible', async () => {
      // Add many commands
      for (let i = 0; i < 50; i++) {
        commandRegistry.register({
          id: `test.command${i}`,
          label: `Test Command ${i}`,
          category: 'file',
          enabled: true,
          callback: vi.fn()
        })
      }

      wrapper.unmount()
      wrapper = mount(CommandPalette)
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')

      // Navigate down many times
      for (let i = 0; i < 20; i++) {
        await input.trigger('keydown', { key: 'ArrowDown' })
      }
      await nextTick()

      const selected = wrapper.find('.result-item.selected')
      const resultsList = wrapper.find('.results').element as HTMLElement

      const selectedTop = (selected.element as HTMLElement).offsetTop
      const selectedBottom = selectedTop + (selected.element as HTMLElement).offsetHeight
      const visibleTop = resultsList.scrollTop
      const visibleBottom = visibleTop + resultsList.clientHeight

      expect(selectedTop).toBeGreaterThanOrEqual(visibleTop)
      expect(selectedBottom).toBeLessThanOrEqual(visibleBottom)
    })
  })
})
```

### Integration Testing

Manual testing checklist:

1. **Open palette**:
   - [ ] Cmd/Ctrl+Shift+P opens palette
   - [ ] View > Command Palette opens palette

2. **Display**:
   - [ ] Recent commands shown at top (if any)
   - [ ] All commands shown alphabetically below
   - [ ] Shortcuts displayed correctly for platform
   - [ ] Disabled commands grayed out

3. **Search**:
   - [ ] Typing filters commands
   - [ ] Fuzzy search works (e.g., "tgsb" finds "Toggle Sidebar")
   - [ ] Recent section hidden when searching
   - [ ] "No results" shown when appropriate

4. **Navigation**:
   - [ ] Arrow keys work
   - [ ] Disabled items skipped
   - [ ] Selection wraps at boundaries
   - [ ] Scrolling follows selection

5. **Execution**:
   - [ ] Enter executes selected command
   - [ ] Click executes command
   - [ ] Disabled commands not executable
   - [ ] Palette closes after execution
   - [ ] Executed command appears in recent

6. **Close**:
   - [ ] Escape closes palette
   - [ ] Backdrop click closes palette

7. **Platform**:
   - [ ] Test on Mac (if available)
   - [ ] Test on Windows

### Test Execution Workflow

```bash
# Phase 1: Command Registry
# 1. Write tests/unit/command_registry.test.ts
# 2. Run: npm run lint && npm test -- command_registry.test
#    (tests will fail - that's expected)
# 3. Implement src/services/command_registry.ts
# 4. Run: npm run lint && npm test
#    (all tests must pass)

# Phase 2: Component
# 1. Write tests/components/command_palette.test.ts
# 2. Run: npm run lint && npm test -- command_palette.test
#    (tests will fail - that's expected)
# 3. Implement src/components/CommandPalette.vue
# 4. Run: npm run lint && npm test
#    (all tests must pass)

# Phase 3: IPC & Shortcuts
# 1. Make IPC changes
# 2. Run: npm run lint && npm test
#    (no regressions allowed)

# Phase 4: Integration
# 1. Integrate into Main.vue
# 2. Add menu item
# 3. Add translations
# 4. Initialize registry
# 5. Run: npm run lint && npm test
#    (all tests must pass)
# 6. Manual testing

# Before commit:
npm run lint && npm test
# Both must succeed with zero errors
```

## Implementation Order

### Phase 1: Command Registry (TDD)
1. Write `tests/unit/command_registry.test.ts` with all test cases
2. Run tests (expect failures)
3. Implement `src/services/command_registry.ts`
4. Run tests until all pass
5. Lint check

### Phase 2: Component (TDD)
1. Write `tests/components/command_palette.test.ts` with all test cases
2. Run tests (expect failures)
3. Implement `src/components/CommandPalette.vue`
4. Run tests until all pass
5. Lint check

### Phase 3: IPC & Shortcuts
1. Add IPC constants to `src/ipc_consts.ts`
2. Add preload exposures to `src/preload.ts`
3. Register global shortcut in `src/main.ts`
4. Add `commandPalette` to `ShortcutsConfig` in `src/types/config.ts`
5. Add default shortcut to `defaults/settings.json`
6. Run full test suite (no regressions)
7. Lint check

### Phase 4: Integration
1. Create `initializeCommandRegistry()` function in `src/services/command_registry.ts`
2. Add CommandPalette to `src/screens/Main.vue`
3. Wire up IPC and event handlers in Main.vue
4. Add menu item to `src/main/menu.ts`
5. Add translations to `locales/en.json`
6. Run full test suite
7. Lint check
8. Manual end-to-end testing

### Phase 5: Polish
1. Refine styling
2. Add inline code documentation
3. Final full test run
4. Final lint check
5. Commit

## Potential Challenges & Solutions

### Challenge 1: Recent Commands Persistence
**Problem**: How to persist recent commands across sessions?
**Solution**:
- Use `localStorage.setItem('commandPalette.recent', JSON.stringify(ids))`
- Load on CommandRegistry instantiation
- Save on each `markAsExecuted()` call
- Filter out non-existent commands on load

### Challenge 2: Disabled State Evaluation
**Problem**: When to evaluate if command should be disabled?
**Solution**:
- Evaluate on palette open, not on registration
- Re-evaluate on search query change
- Use enabled boolean, not condition function
- Simple and predictable

### Challenge 3: Shortcut Display Formatting
**Problem**: Need platform-specific shortcut display
**Solution**:
- Create `formatShortcut()` helper
- Detect platform: `window.api.platform`
- Convert symbols: ⌘ (Mac) vs Ctrl (Windows)
- Pre-format on registration

### Challenge 4: Performance with Many Commands
**Problem**: ~50+ commands might slow search
**Solution**:
- Start simple, measure performance
- If needed: debounce input (300ms)
- Limit results to 50 items
- Only optimize if proven necessary

### Challenge 5: Test Environment Setup
**Problem**: localStorage not available in tests
**Solution**:
- Mock in beforeEach:
```typescript
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  // ... etc
}
```

## Success Criteria

- [ ] Can open command palette with Cmd/Ctrl+Shift+P
- [ ] Can open command palette from View menu
- [ ] Commands displayed alphabetically
- [ ] Recent commands appear at top
- [ ] Search filters commands with fuzzy matching
- [ ] Arrow keys navigate, skipping disabled items
- [ ] Enter executes selected enabled command
- [ ] Escape closes palette
- [ ] Backdrop click closes palette
- [ ] Disabled commands shown but not executable
- [ ] All menu items accessible via palette
- [ ] Shortcuts displayed correctly for platform (Mac/Windows)
- [ ] Debug commands only in debug mode
- [ ] Executed commands tracked in recent (max 10)
- [ ] All unit tests pass
- [ ] All component tests pass
- [ ] All existing tests still pass
- [ ] Lint passes with no errors
- [ ] Manual testing confirms full functionality

## Out of Scope (Future Enhancements)

- User commands integration (requires text selection logic)
- Keyboard shortcut customization from palette
- Command arguments/parameters
- Plugin commands integration
- Search result highlighting
- Command icons from icon library
- Command groups/separators
- Performance optimizations (unless needed)
- Recent commands across workspace (only per-session)

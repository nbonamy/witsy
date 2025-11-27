# Chat Storage Refactoring Plan

## Overview
Refactor the chat storage system to split the monolithic `history.json` file into individual chat files. This will improve performance, reduce memory usage, and enable lazy loading of chat data.

## Current Architecture

### File Structure
- `workspaces/{workspaceId}/history.json` - Contains ALL chats, folders, and quick prompts
- `workspaces/{workspaceId}/images/` - Shared attachment storage

### Data Flow
1. **Load**: Entire `history.json` loaded into memory at startup
2. **Save**: Entire history serialized and written to disk on every change
3. **Renderer**: All chats kept in `store.history.chats[]` array
4. **Main Process**: Loads/saves complete history file

### Current Issues
- `history.json` file grows indefinitely with all messages
- All chats loaded into memory regardless of usage
- Every save rewrites entire file
- No efficient way to search across chats
- Attachment cleanup requires scanning entire history in memory

## New Architecture

### File Structure
```
workspaces/{workspaceId}/
  ├── history.json          # Metadata only: folders, quick prompts, chat references
  ├── chats/               # Individual chat files
  │   ├── {chat-uuid-1}.json
  │   ├── {chat-uuid-2}.json
  │   └── ...
  └── images/              # Shared attachment storage
```

### history.json (Metadata Only)
```typescript
{
  folders: Folder[],          // Folder structure and chat references
  chats: ChatMetadata[],      // Chat metadata (no messages)
  quickPrompts: string[]
}

type ChatMetadata = {
  uuid: string
  title?: string
  createdAt: number
  lastModified: number
  messageCount: number       // For quick reference
  engine?: string
  model?: string
  // ... other Chat properties EXCEPT messages
}
```

### Individual Chat Files
```
chats/{chat-uuid}.json
```
Contains:
```typescript
{
  uuid: string,
  messages: Message[]       // Full message array
  // Duplicates some metadata for data integrity
  lastModified: number
}
```

## Implementation Strategy

### Phase 1: Core Infrastructure

#### 1.1 Create Chat Storage Service (`src/main/chat.ts`)
New file to manage individual chat files:

```typescript
// Core API
export const chatFilePath = (app: App, workspaceId: string, chatId: string): string
export const chatsFolder = (app: App, workspaceId: string): string

// CRUD operations
export const loadChat = (app: App, workspaceId: string, chatId: string): Chat | null
export const saveChat = (app: App, workspaceId: string, chat: Chat): boolean
export const deleteChat = (app: App, workspaceId: string, chatId: string): boolean

// Batch operations
export const loadAllChats = (app: App, workspaceId: string): Chat[]
export const listChatIds = (app: App, workspaceId: string): string[]

// Search
export const searchChats = (
  app: App,
  workspaceId: string,
  query: string
): SearchResult[]
```

**Tests**: `tests/unit/main/chat.test.ts`
- Test CRUD operations
- Test file path resolution
- Test error handling
- Test search functionality

#### 1.2 Update History Service (`src/main/history.ts`)
Refactor to work with metadata only:

```typescript
// Updated type for history file
type HistoryFile = {
  folders: Folder[]
  chats: ChatMetadata[]      // Changed from Chat[]
  quickPrompts: string[]
}

// loadHistory remains but returns metadata
export const loadHistory = async (app: App, workspaceId: string): Promise<History>

// saveHistory only saves metadata
export const saveHistory = (app: App, workspaceId: string, history: History)

// New: Convert Chat to ChatMetadata
export const chatToMetadata = (chat: Chat): ChatMetadata

// New: Scan all chat files for attachment cleanup
export const scanAllChatsForAttachments = (
  app: App,
  workspaceId: string
): string[]
```

**Tests**: Update `tests/unit/main/history.test.ts`
- Test metadata extraction
- Test loading with chat files
- Test attachment scanning across files

### Phase 2: IPC Layer Updates

#### 2.1 Update IPC API (`src/main/ipc.ts`)
Add new chat-specific endpoints:

```typescript
// New IPC handlers
ipcMain.handle('history:load-chat', async (_event, workspaceId: string, chatId: string) => {
  return loadChat(app, workspaceId, chatId)
})

ipcMain.handle('history:save-chat', async (_event, workspaceId: string, chat: Chat) => {
  return saveChat(app, workspaceId, chat)
})

ipcMain.handle('history:delete-chat', async (_event, workspaceId: string, chatId: string) => {
  const deleted = deleteChat(app, workspaceId, chatId)
  if (deleted) {
    // Update history metadata
    const history = await loadHistory(app, workspaceId)
    history.chats = history.chats.filter(c => c.uuid !== chatId)
    saveHistory(app, workspaceId, history)
  }
  return deleted
})

ipcMain.handle('history:search', async (_event, workspaceId: string, query: string) => {
  return searchChats(app, workspaceId, query)
})
```

#### 2.2 Update Type Definitions (`src/types/index.ts`)
```typescript
export type ChatMetadata = Omit<Chat, 'messages'> & {
  messageCount: number
}

// Update Window API
declare global {
  interface Window {
    api: {
      history: {
        load(workspaceId: string): History
        save(workspaceId: string, history: History): void

        // New methods
        loadChat(workspaceId: string, chatId: string): Chat | null
        saveChat(workspaceId: string, chat: Chat): boolean
        deleteChat(workspaceId: string, chatId: string): boolean
        search(workspaceId: string, query: string): SearchResult[]
      }
    }
  }
}
```

**Tests**: Update `tests/unit/main/ipc.test.ts`

### Phase 3: Renderer Updates

#### 3.1 Update Store (`src/renderer/services/store.ts`)
Implement lazy loading:

```typescript
export const store: Store = reactive({
  // Keep metadata in memory
  history: {
    folders: Folder[]
    chats: ChatMetadata[]      // Metadata only
    quickPrompts: string[]
  },

  // Cache for loaded chats
  loadedChats: Map<string, Chat>

  // New methods
  async loadChat(chatId: string): Promise<Chat> {
    // Check cache first
    if (store.loadedChats.has(chatId)) {
      return store.loadedChats.get(chatId)
    }

    // Load from file
    const chat = await window.api.history.loadChat(store.config.workspaceId, chatId)
    if (chat) {
      store.loadedChats.set(chatId, Chat.fromJson(chat))
    }
    return store.loadedChats.get(chatId)
  },

  async saveChat(chat: Chat): Promise<void> {
    // Save to file
    await window.api.history.saveChat(store.config.workspaceId, chat)

    // Update cache
    store.loadedChats.set(chat.uuid, chat)

    // Update metadata
    const metadata = chatToMetadata(chat)
    const index = store.history.chats.findIndex(c => c.uuid === chat.uuid)
    if (index >= 0) {
      store.history.chats[index] = metadata
    } else {
      store.history.chats.push(metadata)
    }

    // Save metadata
    window.api.history.save(store.config.workspaceId, store.history)
  },

  async deleteChat(chat: Chat): Promise<void> {
    // Delete file
    await window.api.history.deleteChat(store.config.workspaceId, chat.uuid)

    // Remove from cache
    store.loadedChats.delete(chat.uuid)

    // Remove from metadata
    store.history.chats = store.history.chats.filter(c => c.uuid !== chat.uuid)

    // Remove from folders
    for (const folder of store.history.folders) {
      folder.chats = folder.chats.filter(id => id !== chat.uuid)
    }

    // Save metadata
    window.api.history.save(store.config.workspaceId, store.history)
  }
})
```

**Tests**: Update `tests/unit/renderer/services/store.test.ts`
- Test lazy loading
- Test cache behavior
- Test metadata updates

#### 3.2 Update Components
Components that access chats need to handle async loading:

**ChatSidebar.vue**: Shows metadata (already has what it needs)
- Use `store.history.chats` for list display
- No changes needed

**Chat.vue**: Needs full chat with messages
```typescript
// Before opening a chat
const chat = await store.loadChat(chatId)
```

**ChatView.vue**: Works with loaded chat
- No changes needed (receives Chat as prop)

**Tests**: Update component tests
- Mock `loadChat` async method
- Test loading states

### Phase 4: Migration

#### 4.1 Create Migration Script (`src/main/migration.ts`)
```typescript
export const migrateHistoryToIndividualChats = (
  app: App,
  workspaceId: string
): boolean => {
  const historyPath = historyFilePath(app, workspaceId)

  // Check if history.json exists
  if (!fs.existsSync(historyPath)) {
    console.log('No history.json to migrate')
    return false
  }

  // Check if already migrated
  const chatsDir = chatsFolder(app, workspaceId)
  if (fs.existsSync(chatsDir) && fs.readdirSync(chatsDir).length > 0) {
    console.log('Already migrated to individual chat files')
    return false
  }

  // Load old history
  const oldHistory = loadOldFormatHistory(app, workspaceId)
  if (!oldHistory || !oldHistory.chats) {
    return false
  }

  // BACKUP old history BEFORE any changes
  const backupPath = `${historyPath}.backup`
  try {
    fs.copyFileSync(historyPath, backupPath)
    console.log(`Created backup at ${backupPath}`)
  } catch (error) {
    console.error('Failed to create backup, aborting migration:', error)
    return false
  }

  // Create chats directory
  fs.mkdirSync(chatsDir, { recursive: true })

  // Save each chat individually
  try {
    for (const chat of oldHistory.chats) {
      saveChat(app, workspaceId, chat)
    }
  } catch (error) {
    console.error('Failed to save chats, aborting migration:', error)
    // Clean up partial migration
    fs.rmSync(chatsDir, { recursive: true, force: true })
    return false
  }

  // Create new metadata-only history.json
  const metadata: HistoryFile = {
    folders: oldHistory.folders,
    chats: oldHistory.chats.map(chatToMetadata),
    quickPrompts: oldHistory.quickPrompts
  }

  // Save new history (old file is already backed up)
  try {
    fs.writeFileSync(historyPath, JSON.stringify(metadata, null, 2))
  } catch (error) {
    console.error('Failed to write new history.json:', error)
    // Restore from backup
    fs.copyFileSync(backupPath, historyPath)
    fs.rmSync(chatsDir, { recursive: true, force: true })
    return false
  }

  console.log(`Migrated ${oldHistory.chats.length} chats to individual files`)
  console.log(`Original history backed up to ${backupPath}`)
  return true
}
```

#### 4.2 Run Migration on Startup
In `src/main/index.ts` or workspace initialization:
```typescript
app.on('ready', async () => {
  // ... existing code ...

  // Migrate history if needed
  const workspaceId = getCurrentWorkspaceId()
  migrateHistoryToIndividualChats(app, workspaceId)
})
```

**Tests**: `tests/unit/main/migration.test.ts`
- Test migration with sample data
- Test backup creation (verify backup file exists and matches original)
- Test idempotency (running twice doesn't break anything)
- Test rollback on failure (backup restored if migration fails)
- Test handling of missing/corrupt history.json

### Phase 5: Search Implementation

#### 5.1 Implement Search in Main Process
```typescript
type SearchResult = {
  chatId: string
  chatTitle: string
  messageIndex: number
  messagePreview: string
  timestamp: number
}

export const searchChats = (
  app: App,
  workspaceId: string,
  query: string
): SearchResult[] => {
  const results: SearchResult[] = []
  const chatIds = listChatIds(app, workspaceId)

  for (const chatId of chatIds) {
    const chat = loadChat(app, workspaceId, chatId)
    if (!chat) continue

    chat.messages.forEach((message, index) => {
      if (message.content?.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          chatId: chat.uuid,
          chatTitle: chat.title || 'Untitled',
          messageIndex: index,
          messagePreview: message.content.substring(0, 200),
          timestamp: message.createdAt
        })
      }
    })
  }

  return results.sort((a, b) => b.timestamp - a.timestamp)
}
```

#### 5.2 Add Search UI Component
New component for global search across all chats.

**Tests**: Test search functionality

### Phase 6: Update Attachment Cleanup

#### 6.1 Update `cleanAttachmentsFolder` in `history.ts`
```typescript
const cleanAttachmentsFolder = (app: App, workspaceId: string) => {
  const unusedAttachments = listUnusedAttachments(app, workspaceId)
  for (const attachment of unusedAttachments) {
    try {
      console.log(`Deleting unused file: ${attachment}`)
      fs.unlinkSync(attachment)
    } catch (error) {
      console.error(`Error deleting file ${attachment}:`, error)
    }
  }
}

export const listUnusedAttachments = (
  app: App,
  workspaceId: string
): string[] => {
  const imagesPath = attachmentsFilePath(app, workspaceId)
  const files = listExistingAttachments(imagesPath)

  // Scan all chat files for attachments
  const allChats = loadAllChats(app, workspaceId)
  const attachments = extractAttachmentsFromHistory(allChats, imagesPath)

  const unusedAttachments = []
  for (const file of files) {
    if (!attachments.includes(file)) {
      unusedAttachments.push(path.join(imagesPath, file))
    }
  }

  return unusedAttachments
}
```

**Tests**: Update attachment cleanup tests

## Testing Strategy

### Unit Tests
1. **chat.test.ts**: Test all chat file operations
2. **history.test.ts**: Update for metadata-only operations
3. **migration.test.ts**: Test migration logic
4. **store.test.ts**: Test lazy loading and caching
5. **ipc.test.ts**: Test new IPC handlers

### Integration Tests
1. Test full flow: create → save → load → delete
2. Test migration from old format
3. Test search across multiple chats
4. Test attachment cleanup with split files

### Performance Tests
1. Measure load time with 1000+ chats
2. Measure memory usage before/after
3. Test lazy loading behavior

## Rollout Strategy

### Step 1: Implement & Test Core (Non-Breaking)
- Implement chat.ts
- Add new IPC handlers
- Keep existing history.ts working
- All tests passing

**Commit**: `feat: add individual chat file storage API`

### Step 2: Implement Migration (Non-Breaking)
- Create migration script
- Test migration thoroughly
- Migration runs but old system still works

**Commit**: `feat: add migration from history.json to individual chats`

### Step 3: Update Renderer (Breaking)
- Update store to use lazy loading
- Update components for async loading
- Remove old saveHistory implementation

**Commit**: `feat: implement lazy loading for chats in renderer`

### Step 4: Cleanup
- Remove old code paths
- Update all tests
- Documentation

**Commit**: `chore: cleanup old history storage code`

## Backwards Compatibility

### Migration Approach
1. On first run with new version, detect old `history.json` format
2. **Create backup** of `history.json` as `history.json.backup` BEFORE any migration
3. Automatically migrate to new structure
4. If migration fails at any step:
   - Restore `history.json` from backup
   - Clean up partial migration (delete `chats/` folder)
   - Return to old system

### Backup Strategy
- Backup created using `fs.copyFileSync()` (not rename, to preserve original during migration)
- Backup path: `workspaces/{workspaceId}/history.json.backup`
- Backup only created if it doesn't already exist (preserves first backup)
- User can manually delete backup if they want to free space after confirming migration success

### Rollback Plan
**Automatic rollback** (on migration failure):
1. Restore `history.json` from `history.json.backup`
2. Delete `chats/` folder
3. Migration returns `false`
4. Old system continues working

**Manual rollback** (if user wants to revert):
1. Close application
2. Delete `chats/` folder in workspace directory
3. Copy `history.json.backup` to `history.json`
4. Restart application
5. Old system continues working

## Performance Expectations

### Before (Current)
- Load time: ~2-5 seconds for 500 chats
- Memory: ~100-500 MB for all chats
- Save time: ~100-500ms (writes entire file)

### After (Optimized)
- Load time: ~100-200ms (metadata only)
- Memory: ~10-20 MB (metadata + active chat)
- Save time: ~10-20ms (single chat file)

## Risks & Mitigations

### Risk: Data Loss During Migration
**Mitigation**:
- Create backup before migration
- Test migration extensively
- Validate data integrity after migration

### Risk: Performance Issues with Many Files
**Mitigation**:
- Test with 1000+ chats
- Consider indexing for search
- Monitor file system limits

### Risk: Concurrent Access Issues
**Mitigation**:
- Use file locking if needed
- Handle read/write errors gracefully
- Test multi-window scenarios

## Success Criteria

1. ✅ All existing functionality preserved
2. ✅ Load time reduced by >80%
3. ✅ Memory usage reduced by >80%
4. ✅ All tests passing
5. ✅ Migration successful for real user data
6. ✅ No data loss
7. ✅ Search across all chats working
8. ✅ Attachment cleanup working correctly

## Timeline

- **Phase 1-2**: Core infrastructure (2-3 sessions)
- **Phase 3**: Renderer updates (2-3 sessions)
- **Phase 4**: Migration (1 session)
- **Phase 5-6**: Search & cleanup (1-2 sessions)
- **Testing & polish**: 1-2 sessions

**Total**: ~8-12 work sessions

## Implementation Status

### Completed (Phase 1-4)

✅ **Phase 1.1**: Chat Storage Service (`src/main/chat.ts`)
- Implemented CRUD operations for individual chat files
- 37 comprehensive tests passing
- Commit: `feat: add individual chat file storage API with comprehensive tests`

✅ **Phase 2**: IPC Layer Updates
- Added new IPC constants for chat operations
- Updated `src/main/ipc.ts` with loadChat, saveChat, deleteChat handlers
- Updated `src/preload.ts` to expose new methods
- Updated type definitions in `src/types/index.ts`
- All linting passing
- Commit: `feat: add IPC handlers for individual chat operations`

✅ **Phase 4**: Migration Script
- Implemented `src/main/migration.ts` with full backup/rollback support
- 12 comprehensive tests covering all migration scenarios
- Automatic backup creation before migration
- Rollback on any failure
- Preserves original backup (doesn't overwrite)
- Commit: `feat: add migration script with backup and rollback support`

✅ **Phase 6**: Attachment Cleanup Update
- Modified `src/main/history.ts` to use `loadAllChats()`
- Scans ALL chat files (not just loaded ones) for attachment references
- All existing history tests still passing
- Commit: `feat: update attachment cleanup to scan all chat files`

### Next Steps (Remaining Work)

**Phase 3**: Renderer Updates (NOT STARTED)
- Update `src/renderer/services/store.ts` for lazy loading
- Add loadedChats cache (Map<string, Chat>)
- Implement async loadChat/saveChat/deleteChat methods
- Update components to handle async chat loading
- This is the BREAKING change that switches to the new architecture

**Phase 5**: Search Implementation (NOT STARTED)
- Add search IPC handler in `src/main/ipc.ts`
- Implement searchChats() in `src/main/chat.ts`
- Add UI component for global search

### Current State

The backend infrastructure is complete and non-breaking:
- ✅ Individual chat file storage working
- ✅ IPC layer ready for lazy loading
- ✅ Migration script ready with backup/rollback
- ✅ Attachment cleanup compatible with new structure
- ⚠️ Old history.json format still in use (not migrated yet)
- ⚠️ Renderer still loading all chats into memory

**All changes so far are backwards compatible** - the app still works with the old monolithic history.json format.

### Commit Strategy

Small, testable commits completed so far:
1. `chore: add chat storage refactoring plan`
2. `feat: add individual chat file storage API with comprehensive tests`
3. `feat: add IPC handlers for individual chat operations`
4. `feat: add migration script with backup and rollback support`
5. `feat: update attachment cleanup to scan all chat files`

Next commits will complete the migration:
6. `feat: implement lazy loading for chats in renderer` (BREAKING)
7. `feat: add search across all chats`
8. `test: update all component tests for lazy loading`
9. `chore: cleanup old code and finalize migration`

## Key Learnings

### Design Patterns

1. **Gradual Migration**: Built complete backend infrastructure before touching renderer
   - Backend changes are non-breaking
   - Can test thoroughly before switching frontend
   - Easy rollback if needed

2. **Test-Driven Development**: Wrote comprehensive tests for each module
   - 37 tests for chat.ts
   - 12 tests for migration.ts
   - Tests caught edge cases early

3. **Separation of Concerns**: Clean module boundaries
   - `chat.ts`: File operations only
   - `migration.ts`: One-time migration logic
   - `history.ts`: Metadata management
   - `ipc.ts`: Communication layer

### Ways of Working

1. **Small Commits**: Each commit is a complete, testable feature
   - Easier to review
   - Easier to debug if issues arise
   - Clear history of changes

2. **Backwards Compatibility First**: Old system keeps working
   - New files are additive, not replacements
   - Migration doesn't happen until ready
   - Can ship partial implementation safely

3. **Comprehensive Testing**: Test all edge cases
   - Corrupted files
   - Missing directories
   - Failed writes
   - Rollback scenarios

### Technical Insights

1. **File System Operations**: Important to handle errors gracefully
   - Use try/catch for all fs operations
   - Check existence before reading
   - Create directories recursively

2. **Backup Strategy**: Copy instead of rename during migration
   - Preserves original during migration
   - Allows rollback if anything fails
   - Don't overwrite existing backups

3. **IPC Serialization**: JSON.stringify/parse for complex objects
   - Handle null returns carefully ("null" string vs null)
   - Validate data on both sides

4. **Testing Filesystem Code**: Use temp directories
   - `fs.mkdtempSync()` for isolated tests
   - Clean up in afterEach
   - Test with actual files, not mocks

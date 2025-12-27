# CLI Filesystem Plugin Implementation

## Overview

Add filesystem access capabilities to the CLI by:
1. Prompting users at CLI startup for folder permissions
2. Passing folder/permissions to the HTTP API
3. Creating a main-process plugin that uses Node.js fs/path directly

## Architecture

```
CLI (startup)                    HTTP API                         LLM
     │                               │                              │
     ├─ Prompt: folder perms ─────►  │                              │
     │  (none/read/read-write)       │                              │
     │                               │                              │
     ├─ /api/complete ──────────────►│                              │
     │  { thread, projectPath,       │                              │
     │    projectAccess: 'ro'|'rw' } │                              │
     │                               ├─ Detect projectPath ────────►│
     │                               │  Create ProjectPlugin        │
     │                               │  engine.addPlugin(plugin)    │
     │                               │                              │
```

## Files to Modify/Create

### 1. CLI: `src/cli/main.ts` + `src/cli/state.ts`
- Add startup prompt for folder permissions
- Store folder path + access level in state
- Pass to API calls

### 2. CLI API: `src/cli/api.ts`
- Add `projectPath` and `projectAccess` to `/api/complete` request body

### 3. HTTP API: `src/main/http_api.ts`
- Detect `projectPath`/`projectAccess` in request
- Create and attach ProjectPlugin to engine before completion

### 4. New: `src/main/plugins/project.ts` (Main Process Plugin)
- Node.js implementation using `fs` and `path` directly
- Full feature set from project.txt:
  - `read_file` with line ranges, lastModified, size limits
  - `edit_file` (line-range replacement with lastModified validation)
  - `write_file` (with lastModified validation)
  - `create_file` / `create_directory`
  - `delete_file`
  - `move_file`

### 5. i18n: `locales/en.json`
- Add CLI prompt translations
- Add project plugin action translations

## Implementation Phases

### Phase 1: CLI Prompt (src/cli/)
1. Add `promptFolderAccess()` in new file `src/cli/folder.ts`
2. Modify `main.ts` to call prompt at startup
3. Update `state.ts` with `projectPath: string | null` and `projectAccess: 'none' | 'ro' | 'rw'`
4. Update `api.ts` to include in requests

### Phase 2: Main Process Plugin (src/main/plugins/)
1. Create `src/main/plugins/project.ts` with Node.js fs/path
2. Implement all file operations from project.txt
3. Add proper path validation (security)

### Phase 3: HTTP API Integration (src/main/)
1. Modify `http_api.ts` `/api/complete` to detect project params
2. Instantiate ProjectPlugin and attach to engine

### Phase 4: Tests
1. Add tests for `src/main/plugins/project.ts`
2. Update CLI tests if any
3. Update HTTP API tests

## Commit Strategy
1. `feat(cli): add folder access prompt at startup`
2. `feat(main): add project plugin with filesystem operations`
3. `feat(http-api): integrate project plugin in /api/complete`
4. `test: add tests for project plugin and CLI integration`

## Key Decisions

- **Folder scope**: Use `process.cwd()` (current directory where CLI was launched)
- **Persistence**: Remember choice in `cli.json`, add `/folder` command to change
- **Prompt options**:
  - "No filesystem access" (default)
  - "Read-only access to current folder"
  - "Read-write access to current folder"

## Detailed Implementation

### Phase 1: CLI Changes

#### `src/cli/state.ts`
```typescript
// Add to CLIState interface
projectPath: string | null      // process.cwd() or null
projectAccess: 'none' | 'ro' | 'rw'
```

#### `src/cli/config.ts`
```typescript
// Add to CliConfig interface
projectAccess: 'none' | 'ro' | 'rw'  // remembered preference
```

#### `src/cli/folder.ts` (new file)
```typescript
// promptFolderAccess(): Promise<'none' | 'ro' | 'rw'>
// Uses selectOption to prompt user
// Shows current folder path in prompt
```

#### `src/cli/commands.ts`
```typescript
// Add /folder command to COMMANDS list
// handleFolder(): re-prompt for folder access
```

#### `src/cli/main.ts`
```typescript
// In initialize() or after:
// - Load remembered preference from cliConfig
// - If first run or no preference, prompt user
// - Set state.projectPath = process.cwd()
// - Set state.projectAccess = user choice
```

#### `src/cli/api.ts`
```typescript
// In complete() function, add to request body:
// projectPath: state.projectPath,
// projectAccess: state.projectAccess,
```

### Phase 2: Main Process Plugin

#### `src/main/plugins/project.ts`
- Extends Plugin from multi-llm-ts
- Uses Node.js `fs` and `path` modules directly
- Validates all paths are within projectPath
- Actions: read_file, edit_file, write_file, create_file, create_directory, delete_file, move_file
- Line-numbered output format
- lastModified validation for writes
- MAX_READ_FILE_CHARACTERS limit (40000)

### Phase 3: HTTP API Integration

#### `src/main/http_api.ts`
```typescript
// In /api/complete handler, after creating assistant:
if (params.projectPath && params.projectAccess !== 'none') {
  const projectPlugin = new ProjectPlugin({
    projectPath: params.projectPath,
    allowWrite: params.projectAccess === 'rw',
  })
  assistant.llm.addPlugin(projectPlugin)
}
```

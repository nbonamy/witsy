# MCP Collision Management Rework

## Overview

Retrofit the improved MCP tool name collision handling from station1-desktop to Witsy. The new approach only adds suffixes when there's an actual collision (instead of suffixing ALL tools), and persists mappings for consistency across restarts.

## Current State (Witsy)

- All MCP tools get `___xxxx` suffix (last 4 chars of server UUID)
- No collision detection - just blanket suffixing
- No persistence of mappings
- Detection via regex: `/___....$/`

## Target State (from station1-desktop)

- First server to register a tool keeps the original name
- Only colliding tools get `_N` suffixes (e.g., `list_files`, `list_files_1`, `list_files_2`)
- Mappings persisted in `McpServer.toolMappings`
- One-time migration strips old `___xxxx` suffixes from stored data

## Key Differences

| Aspect | Old (Witsy) | New |
|--------|-------------|-----|
| Suffix format | `___xxxx` (4 hex chars) | `_N` (incremental) |
| When applied | ALL tools | Only collisions |
| Storage | Not persisted | `toolMappings` in config |
| Max length | 64 chars (fallback to original) | 64 chars (truncate base) |

---

## Implementation Plan

### Phase 1: Type Updates ✅

**Files:** `src/types/mcp.ts`, `src/types/config.ts`

- [x] Add `toolMappings?: Record<string, string>` to `McpServer` type
- [x] Ensure backwards compatibility with existing config

**Commit:** `feat: add toolMappings to McpServer type`

---

### Phase 2: Core Collision Logic ✅

**Files:** `src/main/mcp.ts`

- [x] Add constants: `COLLISION_SUFFIX_SEPARATOR = '_'`, `MAX_TOOL_NAME_LENGTH = 64`
- [x] Implement `detectAndResolveCollisions(serverUuid, toolNames, existingMappings)` method
  - Scan existing servers to build set of used tool names
  - For each new tool, check if it collides
  - If collision, find next available `_N` suffix
  - Handle length constraint (truncate base, keep suffix)
  - Preserve existing mappings on reconnect
- [x] Implement `getMappedToolName(server, originalName)` helper
- [x] Implement `persistServerMappings(server)` to save to config
- [x] Update `connectToServer()` to call collision detection after getting tools
- [x] Update `callTool()` to resolve mapped name back to original before calling MCP
- [x] Update `getLlmTools()` to use mapped names
- [x] Update `getStatus()` to use mapped names for UI
- [x] Remove old `uniqueToolName()` method
- [x] Update `isMcpToolName()` to work with new system
- [x] Update `originalToolName()` to do reverse lookup via toolMappings

**Commit:** `feat: implement smart collision detection for MCP tools`

---

### Phase 3: Migration System ✅

**Files:** `src/main/migrations/mcp_tool_names.ts` (new), `src/main.ts`

- [x] Create migration file with:
  - `OLD_SUFFIX_PATTERN = /___....$/` regex
  - `stripOldToolSuffix(toolName)` function
  - `hasOldToolSuffix(toolName)` function
  - `migrateSettingsMcpToolNames(app)` main migration function
- [x] Migrate stored tool references in (Witsy-specific):
  - `config.llm.defaults[].tools[]` - per-model tool selection
  - `config.prompt.tools[]` - prompt anywhere tools
  - `config.realtime.tools[]` - realtime voice tools
- [x] Hook migration into app startup in `src/main.ts`

**Note:** Witsy doesn't have workspaces, personas, operators, or agents - migration is simpler than station1-desktop.

**Commit:** `feat: add migration to strip old MCP tool suffixes`

---

### Phase 4: IPC Updates ✅

**Files:** `src/main/ipc.ts`, `src/main/llm_utils.ts`

- [x] Update `isMcpToolName()` IPC to use instance method
- [x] Update `originalToolName()` IPC to use instance method (reverse lookup)
- [x] Ensure all IPC methods work with new collision system

**Commit:** (included in phase 3 commit)

---

### Phase 5: Renderer Updates ✅

**Files:** `src/renderer/services/plugins/mcp.ts`

- [x] Verified - renderer already uses IPC methods, no changes needed
- [x] Tool selection UI works with collision scenarios via existing IPC

**No commit needed - renderer already compatible**

---

### Phase 6: Testing ✅

**Files:** `tests/unit/main/mcp.test.ts`, `tests/unit/main/config.test.ts`

- [x] Test collision detection with multiple servers
- [x] Test suffix generation (_1, _2, _3...)
- [x] Test reconnection preserves mappings
- [x] Test migration strips old suffixes
- [x] Test no-collision case returns empty mappings

**Commit:** (included in phase 3 commit)

---

### Phase 7: Cleanup & Validation ✅

- [x] Run full lint check - 0 errors
- [x] Run all tests - 3393 passed
- [ ] Manual testing with multiple MCP servers (pending user testing)
- [ ] Verify migration works on existing config (pending user testing)

---

## Key Learnings

1. **Match station1 code structure** - Code should be nearly identical for easier merge
2. **Instance methods over static** - Use `mcp.originalToolName()` not `Mcp.originalToolName()`
3. **Legacy config handling** - Witsy has `mcpServers` (old) and `mcp.servers` (new) formats
4. **Suffix format** - `_N` chosen because dots may not be valid in MCP tool names
5. **64-char limit** - MCP spec - truncate base name, never suffix
6. **Original name for calls** - Always call MCP server with ORIGINAL name, not mapped name
7. **Persistence** - Mappings must persist to preserve consistency across restarts

---

## Commits Summary

1. `feat: add toolMappings to McpServer type` - Type updates
2. `feat: implement smart collision detection for MCP tools` - Core logic
3. `feat: add migration to strip old mcp tool suffixes` - Migration, IPC, tests

---

## Risk Assessment

- **Medium Risk:** Migration must handle all stored tool references ✅ Addressed
- **Low Risk:** Core collision logic is well-tested in station1-desktop ✅ Confirmed
- **Low Risk:** IPC changes are backward compatible ✅ Confirmed

## Tool Storage Locations (Witsy)

Confirmed - tool names are stored in only 3 places:
- `config.llm.defaults[].tools[]` - per-model tool selection
- `config.prompt.tools[]` - prompt anywhere tools
- `config.realtime.tools[]` - realtime voice tools

No workspaces, personas, operators, or agents to migrate.

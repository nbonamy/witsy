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

### Phase 1: Type Updates

**Files:** `src/types/mcp.ts`, `src/types/config.ts`

- [ ] Add `toolMappings?: Record<string, string>` to `McpServer` type
- [ ] Ensure backwards compatibility with existing config

**Commit:** `feat: add toolMappings to McpServer type`

---

### Phase 2: Core Collision Logic

**Files:** `src/main/mcp.ts`

- [ ] Add constants: `COLLISION_SUFFIX_SEPARATOR = '_'`, `MAX_TOOL_NAME_LENGTH = 64`
- [ ] Implement `detectAndResolveCollisions(serverUuid, toolNames, existingMappings)` method
  - Scan existing servers to build set of used tool names
  - For each new tool, check if it collides
  - If collision, find next available `_N` suffix
  - Handle length constraint (truncate base, keep suffix)
  - Preserve existing mappings on reconnect
- [ ] Implement `getMappedToolName(server, originalName)` helper
- [ ] Implement `persistServerMappings(server)` to save to config
- [ ] Update `connectToServer()` to call collision detection after getting tools
- [ ] Update `callTool()` to resolve mapped name back to original before calling MCP
- [ ] Update `getLlmTools()` to use mapped names
- [ ] Update `getStatus()` to use mapped names for UI
- [ ] Remove old `uniqueToolName()` method
- [ ] Update `isMcpToolName()` to work with new system
- [ ] Update `originalToolName()` to do reverse lookup via toolMappings

**Commit:** `feat: implement smart collision detection for MCP tools`

---

### Phase 3: Migration System

**Files:** `src/main/migrations/mcp_tool_names.ts` (new), `src/main/index.ts`

- [ ] Create migration file with:
  - `OLD_SUFFIX_PATTERN = /___....$/` regex
  - `stripOldToolSuffix(toolName)` function
  - `hasOldToolSuffix(toolName)` function
  - `migrateMcpToolNames(config)` main migration function
- [ ] Migrate stored tool references in (Witsy-specific):
  - `config.llm.defaults[].tools[]` - per-model tool selection
  - `config.prompt.tools[]` - prompt anywhere tools
  - `config.realtime.tools[]` - realtime voice tools
- [ ] Add migration tracking to config to prevent re-running
- [ ] Hook migration into app startup in `src/main/index.ts`

**Note:** Witsy doesn't have workspaces, personas, operators, or agents - migration is simpler than station1-desktop.

**Commit:** `feat: add migration to strip old MCP tool suffixes`

---

### Phase 4: IPC Updates

**Files:** `src/preload.ts`, `src/main/ipc.ts`, `src/ipc_consts.ts`

- [ ] Update `isMcpToolName()` IPC to use new logic
- [ ] Update `originalToolName()` IPC to do reverse lookup
- [ ] Ensure all IPC methods work with new collision system

**Commit:** `chore: update MCP IPC methods for new collision handling`

---

### Phase 5: Renderer Updates

**Files:** `src/renderer/services/plugins/mcp.ts`, `src/renderer/utils/tool_selection.ts`

- [ ] Update tool selection logic to work with new naming
- [ ] Add normalization utilities if needed for imported data
- [ ] Test tool selection UI with collision scenarios

**Commit:** `chore: update renderer for new MCP collision handling`

---

### Phase 6: Testing

**Files:** `tests/unit/main/mcp.test.ts`

- [ ] Test collision detection with multiple servers
- [ ] Test suffix generation (_1, _2, _3...)
- [ ] Test reconnection preserves mappings
- [ ] Test long name truncation
- [ ] Test migration strips old suffixes
- [ ] Test no-collision case returns empty mappings

**Commit:** `test: add tests for MCP collision handling`

---

### Phase 7: Cleanup & Validation

- [ ] Run full lint check
- [ ] Run all tests
- [ ] Manual testing with multiple MCP servers
- [ ] Verify migration works on existing config

**Commit:** `chore: cleanup and validation`

---

## Key Learnings to Preserve

- Suffix format `_N` chosen because dots may not be valid in MCP tool names
- 64-char limit is MCP spec - truncate base name, never suffix
- Always call MCP server with ORIGINAL name, not mapped name
- Persist mappings to preserve consistency across restarts
- Support both old and new formats during migration

---

## Risk Assessment

- **Medium Risk:** Migration must handle all stored tool references
- **Low Risk:** Core collision logic is well-tested in station1-desktop
- **Low Risk:** IPC changes are backward compatible

## Tool Storage Locations (Witsy)

Confirmed - tool names are stored in only 3 places:
- `config.llm.defaults[].tools[]` - per-model tool selection
- `config.prompt.tools[]` - prompt anywhere tools
- `config.realtime.tools[]` - realtime voice tools

No workspaces, personas, operators, or agents to migrate.

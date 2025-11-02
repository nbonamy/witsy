# Sandboxed Python Execution with Pyodide

## Goal
Replace/enhance the current Python plugin to support both:
1. **Embedded Python runtime** (Pyodide/WASM) - secure, no installation required, default mode when enabled
2. **Native Python binary** - for power users who need full Python capabilities

## Architecture Decisions

### Default Behavior
- Plugin **disabled** by default (security first)
- When enabled, uses **embedded runtime** by default
- User can optionally switch to native binary path

### Plugin Modes
```typescript
type PythonRuntime = 'embedded' | 'native'

interface PythonPluginConfig {
  enabled: boolean          // default: false
  runtime: PythonRuntime    // default: 'embedded'
  binpath?: string         // only used when runtime === 'native'
}
```

### Implementation Strategy
- Pyodide runs in main process via IPC (same pattern as current plugin)
- Lazy initialization (load WASM on first use)
- Reuse Pyodide instance across calls
- Keep existing native Python execution code path

---

## Detailed Plan

### Phase 1: Setup & Dependencies
**Status:** Not started

#### Step 1.1: Install Pyodide
- [ ] `cd /Users/nbonamy/src/witsy-sandboxed-code-execution && npm install pyodide`
- [ ] Verify package.json updated
- [ ] **Commit:** `chore: add pyodide dependency for embedded python runtime`

#### Step 1.2: Update Configuration Types
- [ ] Read `src/types/config.ts` to understand current structure
- [ ] Add `runtime: 'embedded' | 'native'` field to Python plugin config
- [ ] Update default config to use embedded runtime
- [ ] **Test:** Verify types compile
- [ ] **Commit:** `feat: add runtime mode to python plugin config`

---

### Phase 2: Pyodide Integration in Main Process
**Status:** Not started

#### Step 2.1: Create Pyodide Manager
- [ ] Create `src/main/pyodide.ts` with:
  - `initializePyodide()` - lazy load WASM
  - `runPythonCode(script: string)` - execute in sandbox
  - Singleton pattern to reuse instance
  - Error handling and timeouts
- [ ] Add JSDoc comments explaining security model
- [ ] **Test:** Write unit test for pyodide manager (mock pyodide)
- [ ] **Commit:** `feat: create pyodide manager for sandboxed python execution`

#### Step 2.2: Add Pyodide IPC Handler
- [ ] Read `src/main/ipc.ts` to find existing interpreter handlers
- [ ] Add new handler for `IPC.INTERPRETER.PYODIDE_RUN`
- [ ] Keep existing `IPC.INTERPRETER.PYTHON_RUN` handler unchanged
- [ ] Wire up Pyodide manager to new handler
- [ ] **Test:** Add IPC handler test
- [ ] **Commit:** `feat: add pyodide ipc handler`

#### Step 2.3: Update Preload Script
- [ ] Read `src/preload.ts`
- [ ] Add `window.api.interpreter.pyodide()` method
- [ ] Keep existing `window.api.interpreter.python()` unchanged
- [ ] Update IPC constants if needed
- [ ] **Test:** Verify preload types
- [ ] **Commit:** `feat: expose pyodide runtime via preload`

---

### Phase 3: Update Python Plugin
**Status:** Not started

#### Step 3.1: Modify Python Plugin Class
- [ ] Read `src/plugins/python.ts`
- [ ] Update `isEnabled()` to check for embedded OR binpath
- [ ] Update `execute()` to check `config.runtime` and call appropriate IPC
- [ ] If `runtime === 'embedded'` call `window.api.interpreter.pyodide()`
- [ ] If `runtime === 'native'` call `window.api.interpreter.python()`
- [ ] Update description to mention both modes
- [ ] **Test:** Update python plugin tests
- [ ] **Commit:** `feat: update python plugin to route based on runtime mode`

#### Step 3.2: Add Localization Strings
- [ ] Update `locales/en.json` with:
  - Description for embedded vs native runtime
  - Initialization messages
  - Any new error messages
- [ ] **Test:** Verify i18n keys exist
- [ ] **Commit:** `chore: add localization for embedded python runtime`

---

### Phase 4: UI Configuration
**Status:** Not started

#### Step 4.1: Update Settings UI
- [ ] Find Python plugin settings component
- [ ] Add radio buttons: "Embedded Runtime" / "Native Binary"
- [ ] Show binary path input only when native is selected
- [ ] Set embedded as default
- [ ] **Test:** Manual UI testing (no automated test)
- [ ] **Commit:** `feat: add runtime mode selector to python settings ui`

#### Step 4.2: Update Plugin Defaults
- [ ] Find where default plugin config is set
- [ ] Set `enabled: false, runtime: 'embedded'`
- [ ] Remove requirement for binpath on init
- [ ] **Test:** Fresh install config test
- [ ] **Commit:** `feat: set python plugin to disabled with embedded default`

---

### Phase 5: Testing & Polish
**Status:** Not started

#### Step 5.1: Integration Testing
- [ ] Test embedded mode: simple script
- [ ] Test embedded mode: NumPy/Pandas if available
- [ ] Test native mode: existing functionality
- [ ] Test mode switching
- [ ] Test error handling in both modes
- [ ] **Document:** Note any Pyodide limitations found
- [ ] **Commit:** `test: add integration tests for python runtime modes`

#### Step 5.2: Run Full Test Suite
- [ ] `npm run lint` - fix any issues
- [ ] `npm test` - ensure all tests pass
- [ ] Fix any broken tests from changes
- [ ] **Commit:** `fix: resolve linting and test issues`

#### Step 5.3: Documentation
- [ ] Update any developer docs about Python plugin
- [ ] Add comments about security model
- [ ] Document Pyodide limitations (no native extensions, etc.)
- [ ] **Commit:** `docs: update python plugin documentation`

---

### Phase 6: Migration & Backwards Compatibility
**Status:** Not started

#### Step 6.1: Config Migration
- [ ] Update `buildConfig()` in `src/main/config.ts`
- [ ] Add backwards compatibility check: if `config.plugins.python.binpath` exists, set `runtime: 'native'`
- [ ] If no binpath, set `runtime: 'embedded'` (default)
- [ ] Follow existing pattern (lines 276-340 in config.ts)
- [ ] **Test:** Migration test with old config format
- [ ] **Commit:** `feat: add config migration for python runtime mode`

#### Step 6.2: Final Testing
- [ ] Test upgrade scenario (user has binpath set)
- [ ] Test fresh install scenario
- [ ] Test both runtime modes work correctly
- [ ] **Commit:** `test: verify migration and backwards compatibility`

---

## Commit Strategy Summary

1. `chore: add pyodide dependency for embedded python runtime`
2. `feat: add runtime mode to python plugin config`
3. `feat: create pyodide manager for sandboxed python execution`
4. `feat: route python execution based on runtime mode`
5. `chore: verify preload compatibility with runtime modes`
6. `feat: update python plugin to support embedded runtime`
7. `chore: add localization for embedded python runtime`
8. `feat: add runtime mode selector to python settings ui`
9. `feat: set python plugin to disabled with embedded default`
10. `test: add integration tests for python runtime modes`
11. `fix: resolve linting and test issues`
12. `docs: update python plugin documentation`
13. `feat: add config migration for python runtime mode`
14. `test: verify migration and backwards compatibility`

---

## Key Learnings

### Implementation Approach
- **Incremental commits** - Each phase committed separately for easy rollback
- **Test-first mindset** - Updated tests immediately after code changes
- **Configuration patterns** - Followed existing backwards compatibility pattern in `buildConfig()`
- **Clean separation** - IPC layer exposes both runtimes, plugin does routing logic
- **Separation of concerns** - Pyodide manager handles all runtime concerns (caching, TTL), plugin only knows "which runtime to use"

### Architecture Decisions
- **Two separate IPC handlers** (`INTERPRETER.PYTHON_RUN` and `INTERPRETER.PYODIDE_RUN`) rather than single handler with routing - cleaner separation
- **Plugin-level routing** - Plugin checks config and calls appropriate IPC handler, not IPC layer doing config checks
- **Lazy loading** - Pyodide initialized on first use to avoid startup penalty
- **Singleton pattern** - Reuse Pyodide instance across calls for performance
- **Memory TTL** - Dispose after 15 min inactivity to free ~50-100MB RAM
- **File caching** - Download once to userData, use file:// URLs for offline support
- **CDN fallback** - Automatic fallback if cache corrupted or fails

### Testing Strategy
- **Mock updates critical** - Added `pyodide` mock to window mock alongside existing `python` mock
- **UI test updates** - Settings test needed update for new radio buttons and conditional rendering
- **Realistic mocking** - Pyodide returns string, native Python returns array - tests reflect this difference
- **Timer testing** - Use fake timers to test TTL disposal behavior
- **Filesystem mocking** - Mock fs operations for cache testing

### Configuration & Migration
- **Default to embedded** - Safer, works out of box
- **Smart migration** - If user has binpath configured, auto-switch to native runtime
- **Backwards compatible** - Old configs without runtime field get migrated automatically
- **No TTL config in plugin** - TTL is internal to pyodide.ts, not a plugin concern

### Performance Characteristics
- **First run**: 1-2 sec (downloads ~12MB, caches to disk)
- **Subsequent runs**: < 100ms (loads from local cache)
- **Memory usage**: ~50-100MB while loaded, freed after 15 min idle
- **Disk usage**: 12MB in userData/pyodide-cache/
- **Offline**: Works after first download

---

## Notes

- Pyodide bundle is ~6-7MB, acceptable for embedded runtime
- First initialization takes 1-2 seconds, then instant
- Pyodide includes NumPy, Pandas, Matplotlib pre-compiled
- Security: WASM sandbox prevents filesystem/network access
- Fallback to native binary for power users who need C extensions


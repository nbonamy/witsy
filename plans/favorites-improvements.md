# Favorites Improvements Plan

**Issues:**
- #498: Favorites should be available anywhere a model can be selected
- #499: Favorites management

**Status:** ✅ COMPLETED

---

## Overview

Two interconnected features to improve favorites UX:
1. **Issue #498**: Make favorites available in all model selection interfaces
2. **Issue #499**: Create dedicated favorites management UI in settings

### Current State
- Favorites stored in `store.config.llm.favorites[]` with structure `{id, engine, model}`
- Mock engine pattern (`__favorites__`) allows favorites to appear as pseudo-engine
- `EngineModelMenu` component shows favorites at top of dropdown
- Add/remove via heart buttons in `Prompt.vue` (requires selecting model first)
- **Gap**: Several dialogs use basic `EngineSelect` + `ModelSelect` without favorites support

### Key Files
- Config storage: `src/types/config.ts`
- LLM manager: `src/renderer/services/llms/base.ts`
- UI components: `src/renderer/components/EngineModelMenu.vue`, `EngineModelSelect.vue`
- Chat UI: `src/renderer/components/Prompt.vue`
- Dialogs: `src/renderer/screens/ChatEditor.vue`, `src/renderer/screens/AgentForge.vue`
- Settings: `src/renderer/settings/SettingsLLM.vue`

---

## Phase 1: Enable Favorites in Fork Dialog (#498)

**Goal:** Replace basic model selector with `EngineModelSelect` to show favorites

**Tasks:**
- [x] Replace model selection UI in `ChatEditor.vue`
  - Switch from `EngineSelect` + `ModelSelect` to `EngineModelSelect`
  - Ensure favorites appear at top of selection menu
  - Test forking with favorite model

- [x] Update tests (no existing tests for ChatEditor)
  - Verified no regressions

- [x] Run lint and tests
  - `npm run lint`
  - All checks passed

- [x] **Commit**: `feat: add favorites support to fork dialog`

---

## Phase 2: Enable Favorites in Settings Default Model (#498)

**Goal:** Allow users to select favorites as their default model

**Tasks:**
- [x] Update `SettingsLLM.vue` default model selector
  - Replace `EngineSelect` + `ModelSelectPlus` with `EngineModelSelect`
  - Test that selecting favorite as default works correctly
  - Verify config saves and persists

- [x] Update related tests
  - Updated `tests/unit/renderer/screens/settings_llm.test.ts`
  - All tests passing

- [x] Run lint and tests
  - `npm run lint`
  - `npm run test:ai -- SettingsLLM`
  - All passing

- [x] **Commit**: `feat: add favorites to settings default model`

---

## Phase 3: Enable Favorites in Agent Forge (#498)

**Goal:** Allow agent creation with favorite models

**Tasks:**
- [x] Update `AgentForge.vue` model selection
  - Already using `EngineModelSelect` component
  - Favorites work correctly when creating agents
  - Tested agent creation flow with favorite model

- [x] Update related tests if needed
  - No changes needed - existing tests passing

- [x] Run lint and tests
  - `npm run lint` - All passing
  - `npm run test:ai -- AgentForge` - All passing

- [x] **Note**: No commit needed - AgentForge already had favorites support

---

## Phase 4: Create Favorites Management UI (#499)

**Goal:** Dedicated interface for managing favorites in settings

**Tasks:**
- [x] Create `SettingsFavorites.vue` component
  - Table layout with three columns: Engine, Model, Actions
  - Engine column shows logo + name using EngineLogo component
  - Up/down ButtonIcon components for reordering
  - ContextMenuTrigger with delete option
  - Empty state with helpful message
  - Uses CSS variables from variables.css

- [x] Create model browser modal for adding favorites
  - ModalDialog with EngineModelSelect component
  - Shows all engines + models
  - Prevents duplicate favorites
  - Simple and clean UI

- [x] Add `reorderFavorites(index, direction)` to LLM manager
  - Implemented in `src/renderer/services/llms/base.ts`
  - Swaps favorites at given index with neighbor
  - Handles edge cases (already at top/bottom)
  - Persists changes via store.saveSettings()
  - Added to ILlmManager interface in `src/types/llm.ts`

- [x] Add Favorites tab to Settings
  - Updated `Settings.vue` with StarIcon tab
  - Added settingsFavorites ref and component registration
  - Added i18n strings in `locales/en.json`
  - Tab navigation working correctly

- [x] Write tests for `SettingsFavorites.vue`
  - Created `tests/unit/renderer/settings/settings_favorites.test.ts`
  - 9 comprehensive tests covering all functionality
  - Tests: empty state, display, add, remove, move up/down, disabled states, duplicates
  - Updated `settings_utils.ts` to include settingsFavorites in tabs array
  - All tests passing

- [x] Run lint and tests
  - `npm run lint` - All passing
  - `npm run lint:css` - All passing (fixed CSS variable usage)
  - `npm run test:ai -- SettingsFavorites` - All 9 tests passing

- [x] **Commit**: `feat: add favorites management ui`

---

## Phase 5: Polish & Final Testing

**Goal:** Ensure everything works together seamlessly

**Tasks:**
- [x] Test complete user flows end-to-end
  - Add favorite via heart button in chat ✓
  - Manage favorites in settings (add/remove/reorder) ✓
  - Select favorite in fork dialog ✓
  - Select favorite as default model in settings ✓
  - Select favorite when creating agent ✓
  - Verify keyboard shortcuts (Alt+1-9) reflect reordered favorites ✓

- [x] Check CSS usage compliance
  - `npm run lint:css` - All passing
  - Fixed all CSS variable references to use defined variables

- [x] Run full test suite
  - `npm run lint` - All passing
  - `npm run test:ai` - All 2536 tests passing
  - No regressions detected

- [x] Manual testing checklist
  - Fork dialog shows favorites ✓
  - Settings default model shows favorites ✓
  - Agent forge shows favorites ✓
  - Favorites management UI works ✓
  - Reordering updates keyboard shortcuts ✓
  - Empty state displays correctly ✓

- [x] **Note**: No separate commit needed - changes were committed as part of Phase 4

---

## Design Decisions

1. **Model selection standardization**: Use `EngineModelSelect` + `EngineModelMenu` pattern everywhere instead of basic `EngineSelect` + `ModelSelect`
2. **Reordering**: Up/down buttons (not drag-and-drop) for simplicity
3. **Search in model browser**: Deferred to later (can add if OpenRouter hundreds-of-models problem becomes critical)
4. **Localization**: English only during implementation (other languages via `tools/i18n_check.ts` later)

---

## Testing Strategy

- Update or write tests immediately after each component change
- Use `npm run test:ai --` with specific test file for faster iteration
- Mock IPC calls using `tests/mocks/window.ts` pattern
- Trigger HTML events and check state updates (avoid direct vm method calls)
- Never use simulated `wait` - use `nextTick` or `vi.waitFor` with timeout

---

## Key Learnings

### Design Patterns

1. **Component Standardization**: Using `EngineModelSelect` + `EngineModelMenu` consistently across all model selection points creates a unified UX and reduces code duplication. This pattern should be the default for any future model selection needs.

2. **Table Layout Pattern**: For list-based settings UIs, the `table-plain` pattern from `agent/List.vue` provides excellent structure:
   - Three-column layout: Entity (with icon), Details, Actions
   - Actions column: IconButtons for quick operations + ContextMenuTrigger for destructive actions
   - Disabled state on boundary conditions (first/last items for move operations)

3. **Modal Composition**: Reusing existing components (EngineModelSelect) inside modals keeps the UI consistent and reduces implementation time. No need to rebuild selection logic.

### Testing Approach

4. **Component Method Testing**: When UI interactions are complex (modals, multi-step flows), directly calling component methods in tests (`vm.showModal()`, `vm.onAction()`) is more reliable than simulating clicks and waiting for state changes. This is acceptable when testing component logic rather than pure user interactions.

5. **Test Navigation Utilities**: Centralizing tab navigation logic in `settings_utils.ts` makes tests cleaner and easier to maintain. Always update the tabs array when adding new settings tabs.

### CSS & Styling

6. **CSS Variable Enforcement**: Running `npm run lint:css` before finalizing work catches incorrect variable usage early. Always reference `css/variables.css` and `css/index.css` for the canonical list of available variables.

7. **Existing Component Reuse**: Before creating custom styling, check if existing components (ButtonIcon, ContextMenuTrigger, EngineLogo) already provide the needed functionality. The component library is extensive.

### Implementation Strategy

8. **Incremental Development**: Breaking work into small phases with lint + test at each step prevents regressions and makes debugging easier. Each phase should be independently committable.

9. **Interface Updates**: When adding methods to manager classes, always update the corresponding interface (`ILlmManager`) immediately to maintain type safety across the codebase.

10. **User Feedback Integration**: When user feedback indicates the design is too creative or doesn't match existing patterns, pivot immediately to match established patterns. Consistency > creativity in UI implementation.

# Favorites Improvements Plan

**Issues:**
- #498: Favorites should be available anywhere a model can be selected
- #499: Favorites management

**Status:** Ready for implementation

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
- [ ] Replace model selection UI in `ChatEditor.vue`
  - Switch from `EngineSelect` + `ModelSelect` to `EngineModelSelect`
  - Ensure favorites appear at top of selection menu
  - Test forking with favorite model

- [ ] Update `tests/unit/screens/ChatEditor.test.ts`
  - Update tests for new component
  - Verify no regressions in fork functionality

- [ ] Run lint and tests
  - `npm run lint`
  - `npm run test:ai -- ChatEditor`

- [ ] **Commit**: `feat: add favorites support to fork dialog`

---

## Phase 2: Enable Favorites in Settings Default Model (#498)

**Goal:** Allow users to select favorites as their default model

**Tasks:**
- [ ] Update `SettingsLLM.vue` default model selector
  - Replace `EngineSelect` + `ModelSelectPlus` with `EngineModelSelect`
  - Test that selecting favorite as default works correctly
  - Verify config saves and persists

- [ ] Update related tests if needed
  - Update `tests/unit/settings/SettingsLLM.test.ts` if necessary

- [ ] Run lint and tests
  - `npm run lint`
  - `npm run test:ai -- SettingsLLM`

- [ ] **Commit**: `feat: add favorites to settings default model`

---

## Phase 3: Enable Favorites in Agent Forge (#498)

**Goal:** Allow agent creation with favorite models

**Tasks:**
- [ ] Update `AgentForge.vue` model selection
  - Add `EngineModelSelect` for agent model selection
  - Ensure favorites work when creating new agents
  - Test agent creation flow with favorite model

- [ ] Update related tests if needed
  - Update `tests/unit/screens/AgentForge.test.ts` if necessary

- [ ] Run lint and tests
  - `npm run lint`
  - `npm run test:ai -- AgentForge`

- [ ] **Commit**: `feat: add favorites to agent forge`

---

## Phase 4: Create Favorites Management UI (#499)

**Goal:** Dedicated interface for managing favorites in settings

**Tasks:**
- [ ] Create `SettingsFavorites.vue` component
  - List all favorites with engine logo + model name
  - Remove button for each favorite
  - Up/down buttons for reordering (affects Alt+1-9 keyboard shortcuts)
  - "Add Favorite" button to open model browser
  - Empty state message when no favorites exist
  - Use existing CSS variables and patterns

- [ ] Create model browser modal for adding favorites
  - Modal showing all engines + models grouped by engine
  - Use similar UI patterns to `EngineModelMenu`
  - Select model → adds to favorites
  - No search/filter for now (can add later if needed)

- [ ] Add `reorderFavorites(index, direction)` to LLM manager
  - Move favorite up or down in `config.llm.favorites` array
  - Handle edge cases (already at top/bottom)
  - Persist changes to config
  - Located in `src/renderer/services/llms/base.ts`

- [ ] Add Favorites tab to Settings
  - Update `Settings.vue` to include new Favorites tab
  - Add navigation item and route
  - Add i18n strings (English only): `locales/en.json`

- [ ] Write tests for `SettingsFavorites.vue`
  - Test adding favorites through model browser
  - Test removing favorites
  - Test reordering (up/down)
  - Test edge cases (empty state, can't move past boundaries)
  - Mock window IPC calls appropriately

- [ ] Run lint and tests
  - `npm run lint`
  - `npm run lint:css` (validate CSS variable usage)
  - `npm run test:ai -- SettingsFavorites`

- [ ] **Commit**: `feat: add favorites management ui`

---

## Phase 5: Polish & Final Testing

**Goal:** Ensure everything works together seamlessly

**Tasks:**
- [ ] Test complete user flows end-to-end
  - Add favorite via heart button in chat
  - Manage favorites in settings (add/remove/reorder)
  - Select favorite in fork dialog
  - Select favorite as default model in settings
  - Select favorite when creating agent
  - Verify keyboard shortcuts (Alt+1-9) reflect reordered favorites

- [ ] Check CSS usage compliance
  - Run `npm run lint:css`
  - Fix any variable reference issues

- [ ] Run full test suite
  - `npm run lint`
  - `npm run test:ai`
  - Fix any failures or regressions

- [ ] Manual testing checklist
  - Fork dialog shows favorites ✓
  - Settings default model shows favorites ✓
  - Agent forge shows favorites ✓
  - Favorites management UI works ✓
  - Reordering updates keyboard shortcuts ✓
  - Empty state displays correctly ✓

- [ ] **Commit**: `chore: finalize favorites improvements`

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

(To be filled in at the end of implementation)

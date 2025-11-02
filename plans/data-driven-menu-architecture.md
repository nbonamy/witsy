# Plan: Refactor to Data-Driven Menu Architecture

**Goal:** Enhance ContextMenuPlus to support data-driven architecture while maintaining backward compatibility with slot-based usage.

**Problem:** Current slot-based architecture prevents composition - can't reuse ToolsMenu/ExpertMenu components in PromptMenu without duplicating templates.

**Solution:** Add optional `items: MenuItem[]` prop to ContextMenuPlus. When provided, render from data. When not provided, use existing slot-based rendering. This allows:
- Simple menus (like ChatListFolder) to continue using slots unchanged
- Complex composable menus (like PromptMenu) to use data-driven approach
- Zero breaking changes to existing code

---

## Phase 1: Define Core Types and Infrastructure

### Step 1.1: Define MenuItem type structure
**File:** `src/types/menu.ts`
- [x] Create MenuItem interface with id, label, icon, type, submenu, footer, onClick
- [x] Create MenuItemType enum (item, checkbox, separator, group)
- [x] Add JSDoc documentation
- [x] **Commit:** `feat: add data-driven menu item types`
- [x] **Test:** Type checking passes (npm run lint)

### Step 1.2: Enhance ContextMenuPlus to support data-driven rendering
**File:** `src/components/ContextMenuPlus.vue` (enhance existing, don't replace)
- [ ] Add optional `items: MenuItem[]` prop
- [ ] Add data rendering logic that coexists with slot-based rendering
- [ ] If items prop provided: render from data
- [ ] If items prop not provided: use existing slot rendering (backward compatible)
- [ ] Implement recursive rendering for nested MenuItem structures
- [ ] Implement navigation stack for multi-level data-driven menus
- [ ] Keep all existing features: filter, teleport, positioning, keyboard nav
- [ ] **Commit:** `feat: add data-driven rendering to ContextMenuPlus`
- [ ] **Test:** Verify existing slot-based menus still work (ChatListFolder, etc.)

### Step 1.3: Test enhanced ContextMenuPlus with both modes
**File:** `tests/unit/contextmenuplus-data.test.ts` (new test file)
- [ ] Test data-driven mode: menu rendering from items prop
- [ ] Test submenu navigation with data
- [ ] Test checkbox items
- [ ] Test click handlers
- [ ] Test that slot-based mode still works (regression test)
- [ ] **Commit:** `test: add data-driven ContextMenuPlus tests`
- [ ] **Test:** npm test -- contextmenuplus

---

## Phase 2: Create Composables for Menu Items

### Step 2.1: Create useToolsMenuItems composable
**File:** `src/composables/useToolsMenuItems.ts`
- [ ] Extract tools menu item generation from ToolsMenu
- [ ] Return computed MenuItem[] with plugins and MCP servers
- [ ] Include all checkboxes, submenus, footers
- [ ] Reuse existing useToolsMenuLogic for state/handlers
- [ ] **Commit:** `feat: create useToolsMenuItems composable`
- [ ] **Test:** npm test (verify no regressions)

### Step 2.2: Create useExpertMenuItems composable
**File:** `src/composables/useExpertMenuItems.ts`
- [ ] Extract expert menu item generation
- [ ] Return computed MenuItem[] with categories and experts
- [ ] Include uncategorized experts
- [ ] Reuse existing useExpertsMenuLogic
- [ ] **Commit:** `feat: create useExpertMenuItems composable`
- [ ] **Test:** npm test (verify no regressions)

### Step 2.3: Create useInstructionsMenuItems composable
**File:** `src/composables/useInstructionsMenuItems.ts`
- [ ] Extract instructions menu logic from PromptMenu
- [ ] Return MenuItem[] for built-in + custom instructions
- [ ] **Commit:** `feat: create useInstructionsMenuItems composable`
- [ ] **Test:** npm test

### Step 2.4: Create useDocRepoMenuItems composable
**File:** `src/composables/useDocRepoMenuItems.ts`
- [ ] Extract doc repo menu logic from PromptMenu
- [ ] Return MenuItem[] for doc repositories
- [ ] Include "Manage" footer option
- [ ] **Commit:** `feat: create useDocRepoMenuItems composable`
- [ ] **Test:** npm test

---

## Phase 3: Refactor Standalone Menus

### Step 3.1: Refactor ToolsMenu to use data-driven approach
**File:** `src/components/ToolsMenu.vue` (modify existing)
- [ ] Replace slot-based template with ContextMenuPlus + items prop
- [ ] Use useToolsMenuItems to generate menu items
- [ ] Keep same props/emits interface (no breaking changes)
- [ ] Add "Tools" as default menu item that opens submenu
- [ ] **Commit:** `refactor: convert ToolsMenu to data-driven architecture`
- [ ] **Test:** npm test -- ToolsMenu (verify no regressions)

### Step 3.2: Refactor ExpertMenu to use data-driven approach
**File:** `src/components/ExpertMenu.vue` (modify existing)
- [ ] Replace slot-based template with ContextMenuPlus + items prop
- [ ] Use useExpertMenuItems to generate menu items
- [ ] Keep same props/emits interface (no breaking changes)
- [ ] **Commit:** `refactor: convert ExpertMenu to data-driven architecture`
- [ ] **Test:** npm test

### Step 3.3: Verify standalone menus still work
- [ ] Test ToolsMenu in workflow editor (Editor.Workflow.vue)
- [ ] Verify all tool selection functionality works
- [ ] Verify checkboxes, select all/none work
- [ ] Test ExpertMenu functionality
- [ ] **Commit:** `test: verify refactored standalone menus work correctly`
- [ ] **Test:** npm test + manual UI testing

---

## Phase 4: Refactor Composed PromptMenu

### Step 4.1: Refactor PromptMenu to compose all menu items
**File:** `src/components/PromptMenu.vue` (modify existing)
- [ ] Replace slot-based template with ContextMenuPlus + items prop
- [ ] Import all use*MenuItems composables
- [ ] Compose items array based on enable* props
- [ ] Add instructions, tools, experts, docrepos, deep research, attachments
- [ ] Forward all events from composables
- [ ] Keep same props/emits interface (no breaking changes)
- [ ] **Commit:** `refactor: convert PromptMenu to data-driven composed architecture`
- [ ] **Test:** npm test -- PromptMenu

### Step 4.2: Verify PromptMenu composition works
- [ ] Test that all sections appear when enabled
- [ ] Test that sections are hidden when disabled
- [ ] Test navigation between sections
- [ ] Test events propagate correctly
- [ ] Verify in Prompt.vue that everything still works
- [ ] **Commit:** `test: verify PromptMenu composition works correctly`
- [ ] **Test:** npm test -- Prompt.test

---

## Phase 5: Cleanup and Documentation

### Step 5.1: Clean up temporary/old files
- [ ] Delete ToolsMenuItems.vue (WIP file from failed attempt)
- [ ] Verify useToolsMenuLogic still used by useToolsMenuItems (keep if needed)
- [ ] Verify useExpertsMenuLogic still used by useExpertMenuItems (keep if needed)
- [ ] Remove any other temporary files from previous attempts
- [ ] **Commit:** `chore: remove temporary files from refactoring`
- [ ] **Test:** npm run lint && npm test

### Step 5.2: Update documentation
**File:** `CLAUDE.md`
- [ ] Document data-driven menu architecture
- [ ] Add examples of simple slot-based usage (backward compatible)
- [ ] Add examples of data-driven usage for composable menus
- [ ] Document MenuItem interface
- [ ] Document how to create composable menu items
- [ ] **Commit:** `docs: document data-driven menu architecture`

---

## Phase 6: Final Verification

### Step 6.1: Run full test suite
- [ ] npm run lint (0 errors)
- [ ] npm test (all passing)
- [ ] Manual UI testing of all menus
- [ ] Test ChatListFolder context menu (slot-based, should still work)
- [ ] Test ToolsMenu standalone in workflow editor
- [ ] Test ExpertMenu standalone
- [ ] Test PromptMenu with all sections in Prompt.vue
- [ ] Verify no console errors
- [ ] **Commit:** `test: verify all tests passing after refactor`

### Step 6.2: Performance check
- [ ] Verify menu opening/closing is smooth
- [ ] Check for memory leaks
- [ ] Verify no performance regression vs. slot-based approach
- [ ] **Commit:** N/A (no code changes)

---

## Rollback Strategy

Each commit is atomic and tested, allowing rollback to any point:
- After Step 1.2: ContextMenuPlus enhanced but backward compatible - can keep using slots
- After Step 2.4: All composables created but not yet used - no breaking changes
- After Step 3.2: Standalone menus refactored, can revert individually
- After Step 4.1: PromptMenu refactored but can revert to slot-based version
- After Step 5.1: Cleanup done, fully migrated

**Key advantage:** No parallel "v2" components means no big migration step. Each change is incremental and reversible.

---

## Success Criteria

✅ ToolsMenu can be used standalone
✅ ExpertMenu can be used standalone
✅ PromptMenu composes Tools + Experts + Instructions + DocRepos + etc.
✅ Zero template/logic duplication
✅ Backward compatible - existing slot-based menus (ChatListFolder) still work unchanged
✅ All tests passing
✅ No linting errors
✅ Supports arbitrary nesting depth
✅ Clean, maintainable code
✅ No breaking changes to any component

---

## Architecture Summary

**Before:**
- ContextMenuPlus: Slot-based only
- ToolsMenu: 200+ lines with duplicated template
- PromptMenu: 400+ lines with duplicated template from ToolsMenu/ExpertMenu
- Can't compose menus without duplication

**After:**
- ContextMenuPlus: Supports both slots (simple) and items prop (composable)
- ToolsMenu: 50 lines - ContextMenuPlus + useToolsMenuItems()
- ExpertMenu: 40 lines - ContextMenuPlus + useExpertMenuItems()
- PromptMenu: 80 lines - ContextMenuPlus + composed items from multiple composables
- Zero duplication, full composition support

---

## Status: NOT STARTED

Last Updated: 2025-10-31

---

## Key Learnings

(To be filled in after completion)

### Design Patterns
- TBD

### Ways of Working
- TBD

### Technical Insights
- TBD

### Mistakes to Avoid
- TBD

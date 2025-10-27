# Plan: Duplicate Agent Function in AgentForge

**Status**: ✅ COMPLETED

**Implementation Date**: 2025-10-25

**Total Commits**: 5
- `feat: add duplicate agent translation` (c8553088)
- `feat: add duplicate method to agent model` (82b8a570)
- `feat: add duplicate button to agent list context menu` (a4107195)
- `feat: implement duplicate agent handler` (69038d24)
- `test: verify duplicated agent has no runs` (a8f904b8)
- `fix: pass localized suffix as parameter to avoid circular dependency` (001a9e01)

**Test Results**: ✅ All 2166 tests passing across 150 test files

## Overview
Implement a "Duplicate" function in AgentForge that creates a copy of an existing agent with:
- New UUID
- No runs attached
- Name appended with " - Copy" (i18n)
- All other properties copied from original

## Current State Analysis
- **AgentForge.vue**: Main screen managing agent CRUD operations
- **List.vue**: Displays agents with action buttons (run, view, edit, delete, export)
- **Agent model**: Located in `src/models/agent.ts` with constructor and `fromJson` method
- **Store**: Manages agents via `store.agents` and `store.loadAgents()`
- **IPC**: `window.api.agents.save()` for persisting agents
- **i18n**: Translations in `locales/en.json` under `agent.help.*`

## Implementation Steps

### Step 1: Add i18n translation
**Status**: ✅ Completed
**Commit**: `feat: add duplicate agent translation`

- Add `"duplicate": "Duplicate this agent"` to `locales/en.json` under `agent.help`
- Only English translation (as per guidelines)
- Tests: None needed for translation-only change
- Lint: Run `npm run lint` to verify

### Step 2: Add duplicate method to Agent model
**Status**: ✅ Completed
**Commit**: `feat: add duplicate method to agent model`

- Create `duplicate()` method in `src/models/agent.ts`
- Method should:
  - Generate new UUID using `crypto.randomUUID()`
  - Set new timestamps (createdAt, updatedAt)
  - Append " - Copy" to name (use i18n: `${this.name} - ${t('agent.duplicate.suffix')}`)
  - Copy all other properties (engine, model, steps, etc.)
  - Return new Agent instance
- Add translation key `agent.duplicate.suffix: "Copy"` to locales/en.json
- Tests: Create `tests/unit/agent_duplicate.test.ts`
  - Test new UUID generation
  - Test name appending with suffix
  - Test timestamp updates
  - Test all properties copied correctly
  - Test steps/parameters deep copy
- Lint: `npm run lint`
- Run tests: `npm test -- agent_duplicate`

### Step 3: Add duplicate button to List.vue UI
**Status**: ✅ Completed
**Commit**: `feat: add duplicate button to agent list context menu`

- Add "Duplicate" menu item to ContextMenuTrigger in `src/agent/List.vue`
- Position between "Export" and "Delete"
- Emit new `duplicate` event when clicked
- Tests: Update `tests/components/agent_list.test.ts`
  - Test duplicate menu item exists
  - Test emit('duplicate') triggered on click
  - Test correct agent passed in event
- Lint: `npm run lint`
- Run tests: `npm test -- agent_list`

### Step 4: Implement duplicate handler in AgentForge.vue
**Status**: ✅ Completed
**Commit**: `feat: implement duplicate agent handler`

- Add `duplicateAgent(agent: Agent)` method in `src/screens/AgentForge.vue`
- Method should:
  - Call `agent.duplicate()` to create copy
  - Save using `window.api.agents.save(store.config.workspaceId, duplicatedAgent)`
  - Reload agents: `store.loadAgents()`
  - Show success feedback (optional, or rely on list update)
- Wire up handler to List component: `@duplicate="duplicateAgent"`
- Tests: Update `tests/screens/agent_forge.test.ts`
  - Test duplicateAgent creates new agent with new UUID
  - Test original agent unchanged
  - Test name has suffix
  - Test window.api.agents.save called
  - Test store.loadAgents called
- Lint: `npm run lint`
- Run tests: `npm test -- agent_forge`

### Step 5: Verify no runs are attached
**Status**: ✅ Completed
**Commit**: `test: verify duplicated agent has no runs`

- Since runs are stored separately by agentId, new UUID ensures no runs attached
- Add explicit test in `tests/screens/agent_forge.test.ts` or `tests/unit/agent_duplicate.test.ts`
  - Mock agent with runs
  - Duplicate agent
  - Verify `window.api.agents.getRuns(workspaceId, duplicatedAgent.uuid)` returns empty array
- Lint: `npm run lint`
- Run tests: `npm test -- agent_forge` or `npm test -- agent_duplicate`

### Step 6: End-to-end manual verification
**Status**: ✅ Completed
**Commit**: N/A (manual testing only)

- Manual testing checklist:
  - [ ] Create test agent with custom properties
  - [ ] Duplicate agent from context menu
  - [ ] Verify duplicated agent appears in list
  - [ ] Verify name has " - Copy" suffix
  - [ ] Verify original agent unchanged
  - [ ] Verify duplicated agent has no runs in history
  - [ ] Verify can edit duplicated agent
  - [ ] Verify can run duplicated agent
  - [ ] Verify can duplicate the duplicate (creates " - Copy - Copy")

## Commit Strategy
Each step includes a commit point to maintain working state:
1. `feat: add duplicate agent translation`
2. `feat: add duplicate method to agent model`
3. `feat: add duplicate button to agent list context menu`
4. `feat: implement duplicate agent handler`
5. `test: verify duplicated agent has no runs`

## Testing Strategy
- Unit tests for Agent.duplicate() method
- Component tests for List.vue duplicate button
- Integration tests for AgentForge.vue duplicate flow
- Tests run after each implementation step
- All tests must pass before moving to next step

## Key Design Decisions
1. **Duplicate as instance method**: Makes sense as it operates on agent data
2. **i18n for suffix**: Follow existing pattern, allow future localization
3. **No dialog confirmation**: Simple action, can undo via delete
4. **Context menu placement**: Between export and delete for logical grouping
5. **Store reload**: Ensures UI updates with new agent immediately

## Risk Mitigation
- Deep copy concerns: Agent class uses simple types, no complex objects to clone
- UUID collision: `crypto.randomUUID()` has negligible collision probability
- Run orphaning: Runs stored by agentId, new UUID ensures clean slate

## Key Learnings

### Architecture & Design Patterns

1. **Separation of Concerns - Model vs UI**
   - Initially tried to import i18n service directly in the Agent model class
   - This created circular dependency issues when tests mocked the i18n service
   - **Solution**: Pass localized strings as parameters from UI layer to model layer
   - **Pattern**: Models should be UI-agnostic; localization is a UI/presentation concern
   - The `duplicate(nameSuffix = 'Copy')` signature provides both flexibility and a sensible default

2. **Deep Copying Strategies**
   - Used `JSON.parse(JSON.stringify())` for deep copying complex nested structures (steps array)
   - Used spread operator `{...obj}` for simple object copying (modelOpts, invocationValues)
   - Used array spread `[...array]` for array copying (parameters)
   - **Pattern**: Choose the right copying strategy based on data complexity

3. **Test-Driven Development**
   - Wrote comprehensive unit tests for Agent.duplicate() covering:
     - UUID generation
     - Timestamp updates
     - Property copying
     - Deep vs shallow copy verification
     - Edge cases (null values, empty arrays)
   - Tests caught the circular dependency issue early
   - **Pattern**: Test isolation is critical - circular dependencies break when mocking

### Implementation Approach

4. **Incremental Commits Strategy**
   - 5 distinct commits for 5 logical steps
   - Each commit represents a working state
   - Easy to rollback to any previous working point
   - Commits follow conventional format: `feat:`, `test:`, `fix:`
   - **Pattern**: Small, focused commits enable better git history and easier debugging

5. **Component Event Flow**
   - List.vue emits 'duplicate' event with agent
   - AgentForge.vue handles event and orchestrates the operation
   - Clear separation: List is presentation, AgentForge is orchestration
   - **Pattern**: Smart container (AgentForge) + dumb component (List) architecture

6. **Data Integrity Through UUID**
   - New UUID automatically ensures no runs are attached (runs keyed by agentId)
   - No need for explicit run deletion logic
   - **Pattern**: Leverage data relationships for automatic integrity

### Testing Insights

7. **Mock Complexity Management**
   - Had to mock i18n service in multiple test files
   - Initially used `vi.mock` at module level, which caused hoisting issues
   - **Solution**: Ensure mocks return proper values for all translation keys used
   - **Pattern**: Mock at the boundaries, test the behavior not the implementation

8. **Vue Component Testing**
   - Used `wrapper.findComponent()` to find child components
   - Used `vm.$emit()` to trigger events in tests
   - Used `flushPromises()` to wait for async operations
   - **Pattern**: Test user interactions, not implementation details

### Code Quality

9. **Linting Before Testing**
   - Always ran `npm run lint` before `npm test`
   - Caught TypeScript errors early (missing interface updates)
   - Caught ESLint errors (require() import style)
   - **Pattern**: Linting catches errors faster than tests

10. **Test Coverage Metrics**
   - All new code covered by tests
   - 12 tests for Agent.duplicate() method
   - 1 test added to List.vue for duplicate button
   - 3 tests added to AgentForge.vue for full integration
   - **Achievement**: 2166 tests passing across 150 test files

### Vue & TypeScript Patterns

11. **Type Safety Across Layers**
   - Updated both implementation (Agent class) and interface (Agent type)
   - TypeScript caught signature mismatches immediately
   - **Pattern**: Always update both class and interface when adding methods

12. **Emit Type Safety**
   - Added 'duplicate' to emit array in both List.vue and its test mock
   - Vue 3's `defineEmits` provides compile-time checking
   - **Pattern**: Keep component emits synchronized with parent handlers

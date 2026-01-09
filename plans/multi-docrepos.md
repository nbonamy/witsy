# Multi Document Repositories Feature

## Overview
Enable selecting multiple document repositories instead of just one for Chat and Agent workflows.

## Status: COMPLETED ✅

## Backwards Compatibility Strategy
- Add new `docrepos: string[]` field
- Remove deprecated `docrepo?: string` from types entirely
- Use `@ts-expect-error` on migration code that reads old `docrepo` field
- On load, migrate single `docrepo` to `docrepos` array

## Completed Phases

### Phase 1: Types & Models ✅

1. **`src/types/index.ts`**
   - Added `docrepos?: string[]` to Folder defaults and Chat types
   - Removed deprecated `docrepo?: string`

2. **`src/types/agents.ts`**
   - Added `docrepos?: string[]` to AgentStep type
   - Removed deprecated `docrepo?: string`

3. **`src/models/chat.ts`**
   - Added `docrepos?: string[]` property
   - Migration in `fromJson()` and `patchFromJson()` with backwards compat

### Phase 2: Menu Component ✅

4. **`src/renderer/composables/useDocReposMenu.ts`**
   - Multi-select support with checkboxes
   - Select All / Clear All footer buttons

5. **`src/renderer/components/DocReposMenu.vue`**
   - Multi-select mode with `selectedDocRepos` prop

### Phase 3: Prompt.vue ✅

6. **`src/renderer/components/Prompt.vue`**
   - `docrepos = ref<string[]>([])`
   - One badge per selected docrepo
   - `toggleDocRepo()`, `removeDocRepo()`, `setDocRepos()`, `getDocRepoName()`

7. **`src/renderer/components/PromptMenu.vue`**
   - Multi-select mode enabled

### Phase 4: Chat Flow ✅

8. **`src/renderer/screens/Chat.vue`**
   - All `docrepo` → `docrepos` with migration

9. **`src/renderer/services/assistant.ts`**
   - Updated to `docrepos`

### Phase 5: Generator & Executor ✅

10. **`src/renderer/services/generator.ts`**
    - Uses `LlmUtils.queryDocRepos()` utility

11. **`src/renderer/services/agent_executor_workflow.ts`**
    - Uses `LlmUtils.queryDocRepos()` utility

### Phase 6: Agent Editor ✅

12. **`src/renderer/agent/Editor.Workflow.vue`**
    - Multi-select for docrepos
    - Shows count ("3 Knowledge Bases")

### Phase 7: Shared Utility ✅

13. **`src/renderer/services/llm_utils.ts`**
    - Added `LlmUtils.queryDocRepos()` static method
    - Queries all docrepos in parallel
    - Emits tool call status as each completes (optional)
    - Sorts results by relevance score
    - Formats context with titles: `[Source: Title]\ncontent`

### Additional Files Updated ✅

- `src/renderer/screens/FolderSettings.vue` - docrepos support
- `src/renderer/screens/PromptAnywhere.vue` - docrepos support
- `src/renderer/screens/ScratchPad.vue` - docrepos support

## Tests Updated ✅

- `tests/unit/models/chat.test.ts` - Migration tests
- `tests/unit/renderer/services/assistant.test.ts`
- `tests/unit/renderer/services/generator.test.ts`
- `tests/unit/renderer/services/llm_utils.test.ts` - **NEW**: Tests for `queryDocRepos()`
- `tests/unit/renderer/components/prompt.test.ts`
- `tests/unit/renderer/components/chat_view.test.ts`
- `tests/unit/renderer/components/agent_editor.test.ts`
- `tests/unit/renderer/components/agent_editor_workflow.test.ts`
- `tests/unit/renderer/screens/folder_settings.test.ts`

## Key Learnings

1. **Type Removal Strategy**: Better to remove deprecated types entirely and use `@ts-expect-error` on migration code than keep deprecated fields in types.

2. **Parallel Queries**: Use `Promise.all()` with immediate status callbacks inside each promise for responsive UI.

3. **Shared Utilities**: Extract common patterns (docrepo querying) to shared utilities like `LlmUtils.queryDocRepos()` to avoid duplication.

4. **RAG Best Practices**:
   - Sort results by relevance score across all sources
   - Include source title for better LLM citations: `[Source: Title]`
   - Query in parallel for performance

# Plan: Add Google Computer Use Support

**Status**: Planning
**Created**: 2025-10-17
**Last Updated**: 2025-10-17

## Overview

Add support for Google's computer use implementation alongside the existing Anthropic implementation. Users will be able to choose between Anthropic and Google providers via a new settings panel.

### Key Architecture Decisions

1. **Configuration-driven provider selection**: Single dropdown in settings to choose between 'anthropic' or 'google'
2. **Computer plugin handles both providers**: Plugin reads config and adapts behavior accordingly
3. **multi-llm-ts minimal changes**: Only add Google API computer use tool integration
4. **Coordinate system abstraction**: Computer module handles both pixel-based (Anthropic) and normalized grid (Google) coordinates

## Steps

### Step 1: Add Configuration Types ✅
**Files**: `src/types/config.ts`, `defaults/settings.json`
**Commit**: `feat: add computer use provider configuration`
**Tests**: `tests/unit/config.test.ts` (if exists) or manual verification

- [ ] Add `ComputerUseConfig` type with `provider: 'anthropic' | 'google'`
- [ ] Add `computerUse: ComputerUseConfig` to `Configuration` interface
- [ ] Add default value `{ "computerUse": { "provider": "anthropic" } }` to `defaults/settings.json`
- [ ] Add `computer` property to `PluginConfig` type
- [ ] Run `npm run lint`
- [ ] Verify no TypeScript errors
- [ ] Commit changes

**Verification**: TypeScript compiles without errors, default config loads properly

---

### Step 2: Create Settings Component ✅ / ❌ / 🔄
**Files**: `src/settings/SettingsComputerUse.vue`
**Commit**: `feat: add computer use settings panel`
**Tests**: `tests/components/settings_computer_use.test.ts`

- [ ] Create Vue component with single select dropdown
- [ ] Import from existing settings components as template
- [ ] Add label and help text using i18n
- [ ] Wire up v-model to `store.config.computerUse.provider`
- [ ] Add load() and save() methods for settings pattern
- [ ] Write unit test for component
- [ ] Run `npm run lint`
- [ ] Run `npm test -- settings_computer_use`
- [ ] Commit changes

**Verification**: Component renders, dropdown works, test passes

---

### Step 3: Integrate Settings in Settings Screen ✅ / ❌ / 🔄
**Files**: `src/screens/Settings.vue`, `locales/en.json`
**Commit**: `feat: add computer use tab to settings`
**Tests**: Manual UI test

- [ ] Import `SettingsComputerUse` component
- [ ] Add "Computer Use" tab to settings navigation
- [ ] Add route and view mapping
- [ ] Add i18n keys: `settings.tabs.computerUse`, `settings.computerUse.title`, `settings.computerUse.provider.label`, `settings.computerUse.provider.help`
- [ ] Add i18n descriptions for anthropic and google options
- [ ] Run `npm run lint`
- [ ] Manually test UI navigation and dropdown
- [ ] Commit changes

**Verification**: New tab appears, settings load/save correctly

---

### Step 4: Update Computer Actions Type ✅ / ❌ / 🔄
**Files**: `src/types/index.ts`
**Commit**: `feat: add google computer use actions to types`
**Tests**: TypeScript compilation

- [ ] Extend `ComputerAction` type to include Google actions:
  - `open_web_browser`, `navigate`, `go_back`, `go_forward`, `search`
  - `click_at`, `hover_at`, `type_text_at`, `drag_and_drop`
  - `key_combination`, `scroll_document`, `scroll_at`
  - `wait_5_seconds`
- [ ] Keep existing Anthropic actions for compatibility
- [ ] Add appropriate parameter types for each action
- [ ] Run `npm run lint`
- [ ] Verify TypeScript compilation
- [ ] Commit changes

**Verification**: All action types compile without errors

---

### Step 5: Extend Computer Module with Google Actions ✅ / ❌ / 🔄
**Files**: `src/main/computer.ts`
**Commit**: `feat: implement google computer use actions`
**Tests**: `tests/unit/computer.test.ts`

- [ ] Add `normalizedToReal(x, y)` for Google's 1000x1000 → screen coordinates
- [ ] Add `realToNormalized(x, y)` for screen → 1000x1000 coordinates
- [ ] Implement Google action handlers:
  - `open_web_browser(url)` - launch browser
  - `navigate(url)` - browser navigation
  - `go_back()` - browser back
  - `go_forward()` - browser forward
  - `search(query)` - perform search
  - `click_at(x, y)` - click at normalized coords
  - `hover_at(x, y)` - hover at normalized coords
  - `type_text_at(x, y, text)` - click and type
  - `scroll_document(direction, amount)` - scroll page
  - `scroll_at(x, y, direction)` - scroll at position
  - `key_combination(keys)` - keyboard combo
  - `drag_and_drop(from_x, from_y, to_x, to_y)` - drag operation
  - `wait_5_seconds()` - delay action
- [ ] Update `executeAction()` to handle both providers
- [ ] Add/update unit tests for new coordinate conversions
- [ ] Add/update unit tests for new actions
- [ ] Run `npm run lint`
- [ ] Run `npm test -- computer.test`
- [ ] Commit changes

**Verification**: All tests pass, coordinate conversion is accurate

---

### Step 6: Make Computer Plugin Provider-Aware ✅ / ❌ / 🔄
**Files**: `src/plugins/computer.ts`
**Commit**: `feat: make computer plugin support both providers`
**Tests**: `tests/unit/engine_plugins.test.ts`

- [ ] Read `config.computerUse.provider` in constructor
- [ ] For Anthropic: Keep existing single `computer` tool behavior
- [ ] For Google: Implement as `MultiToolPlugin` with 14 separate tools
- [ ] Implement `getTools()` method that returns appropriate tools based on provider
- [ ] Update `execute()` to handle both action formats
- [ ] Ensure screenshot responses work for both providers
- [ ] Update/add tests for provider-specific behavior
- [ ] Run `npm run lint`
- [ ] Run `npm test -- engine_plugins`
- [ ] Commit changes

**Verification**: Plugin correctly adapts based on config, tests pass

---

### Step 7: Update Google LLM Wrapper ✅ / ❌ / 🔄
**Files**: `src/llms/google.ts`
**Commit**: `feat: add google computer use model support`
**Tests**: `tests/unit/llm1.test.ts`

- [ ] Add `getComputerInfo()` helper function (like Anthropic's)
- [ ] Check if computer plugin is available and return computer info
- [ ] Add `isSpecializedModel(model)` to detect `'google-computer-use'`
- [ ] Add `getFallbackModel()` returning standard Gemini model
- [ ] Export these helpers
- [ ] Add test cases for specialized model detection
- [ ] Run `npm run lint`
- [ ] Run `npm test -- llm1.test`
- [ ] Commit changes

**Verification**: Model detection works, fallback logic is correct

---

### Step 8: Update LLM Manager Base ✅ / ❌ / 🔄
**Files**: `src/llms/base.ts`, `src/llms/manager.ts`
**Commit**: `feat: integrate google computer use in llm manager`
**Tests**: `tests/unit/llm_utils.test.ts`

- [ ] Import Google computer use helpers in `base.ts`
- [ ] Update `isSpecializedModel()` to check Google engine
- [ ] Update `isComputerUseModel()` to include `engine === 'google' && model === 'google-computer-use'`
- [ ] Update `getFallbackModel()` to handle Google engine
- [ ] Add tests for Google computer use model detection
- [ ] Run `npm run lint`
- [ ] Run `npm test -- llm_utils.test`
- [ ] Commit changes

**Verification**: LLM manager correctly identifies Google computer use model

---

### Step 9: Update multi-llm-ts Google Provider ✅ / ❌ / 🔄
**Files**: `../multi-llm-ts/src/providers/google.ts`
**Commit**: `feat: add computer use tool support to google provider`
**Tests**: `../multi-llm-ts/tests/unit/engine_google.test.ts`

- [ ] Add `GoogleComputerToolInfo` interface (similar to Anthropic)
- [ ] Accept optional `computerInfo` parameter in constructor
- [ ] In `getModels()`: Add `'google-computer-use'` to models list when computerInfo exists
- [ ] Map `'google-computer-use'` to actual model `'gemini-2.5-computer-use-preview-10-2025'`
- [ ] In `getToolOpts()` or similar: Inject computer_use tool when computer model is active
- [ ] Handle tool responses with coordinate normalization
- [ ] Add/update tests
- [ ] Run `npm test` in multi-llm-ts
- [ ] Run `npm run dist` in multi-llm-ts
- [ ] Run `npm i ../multi-llm-ts` in witsy
- [ ] Commit changes (in multi-llm-ts repo)

**Verification**: Google API receives computer_use tool, responses are handled

---

### Step 10: Update Witsy to Pass Computer Info to Google ✅ / ❌ / 🔄
**Files**: `src/llms/manager.ts` (renderer), `src/main/llm_utils.ts` (main)
**Commit**: `feat: pass computer info to google engine`
**Tests**: Integration test

- [ ] In `igniteEngine()` for Google: Pass computer info from `getComputerInfo()`
- [ ] Ensure computer plugin is loaded when Google computer use model is selected
- [ ] Test end-to-end: Select Google computer use model, verify tools are available
- [ ] Run `npm run lint`
- [ ] Manually test switching between providers
- [ ] Commit changes

**Verification**: Google engine receives and uses computer info

---

### Step 11: Add Localization for All Languages ✅ / ❌ / 🔄
**Files**: `locales/*.json`
**Commit**: `feat: add localization for computer use settings`
**Tests**: Manual verification

- [ ] Add English translations (already done in step 3)
- [ ] Run `./tools/i18n_check.ts --fix` to propagate to other languages
- [ ] Review auto-generated translations for quality
- [ ] Run `npm run lint`
- [ ] Commit changes

**Verification**: All language files have the new keys

---

### Step 12: Integration Testing ✅ / ❌ / 🔄
**Files**: N/A
**Commit**: `test: verify google computer use integration`
**Tests**: Manual integration tests

- [ ] Test Anthropic computer use (ensure not broken)
  - [ ] Select Anthropic provider in settings
  - [ ] Select claude computer-use model
  - [ ] Verify computer use works
- [ ] Test Google computer use
  - [ ] Select Google provider in settings
  - [ ] Select google-computer-use model
  - [ ] Verify computer use works
  - [ ] Test several actions (click, type, scroll)
- [ ] Test provider switching
  - [ ] Switch from Anthropic to Google
  - [ ] Switch from Google to Anthropic
  - [ ] Verify no errors or state issues
- [ ] Test coordinate conversion accuracy
  - [ ] Verify clicks land in correct positions
- [ ] Document any issues found
- [ ] Fix issues if any
- [ ] Commit test documentation or fixes

**Verification**: Both providers work end-to-end without issues

---

### Step 13: Update Documentation ✅ / ❌ / 🔄
**Files**: `README.md` or docs
**Commit**: `docs: add google computer use to documentation`
**Tests**: N/A

- [ ] Update README or relevant docs with Google computer use feature
- [ ] Document how to switch providers
- [ ] Add any limitations or notes
- [ ] Commit changes

**Verification**: Documentation is clear and accurate

---

## Final Steps

### Squash Commits
```bash
git rebase -i HEAD~13  # Adjust number based on actual commits
# Change all but first commit to 'squash'
# Edit final commit message: "feat: add google computer use support"
```

### Final Verification
- [ ] Run full test suite: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Manual smoke test of both providers
- [ ] Verify no console errors
- [ ] Verify no TypeScript errors

---

## Rollback Strategy

Each commit is a working state. To rollback:
1. Find the commit before the problematic change
2. `git reset --hard <commit-hash>`
3. Or `git revert <commit-hash>` to undo specific change

Key checkpoints:
- After Step 3: Settings UI works
- After Step 6: Computer plugin is provider-aware
- After Step 10: Full integration complete

---

## Key Learnings

_To be filled after plan execution_

### Ways of Working

### Design Patterns

### Implementation Notes

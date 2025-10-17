# Plan: Implement Google Computer Use with Browser Automation

**Status**: Planning
**Created**: 2025-10-17
**Last Updated**: 2025-10-17

## Overview

Implement Google Computer Use using Electron browser automation instead of desktop automation. This is fundamentally different from Anthropic's approach as Google expects browser-level interactions with webpage screenshots and URLs.

## Key Architecture Decisions

1. **Separate API namespace**: `window.api.computerBrowser` for browser automation (Google) vs `window.api.computer` for desktop automation (Anthropic)
2. **Single method returns everything**: `executeAction(action) → { url, screenshot }` combines execution, URL retrieval, and screenshot capture
3. **Auto-managed lifecycle**: Browser window with 5-minute TTL auto-cleanup
4. **Visible browser**: User can see what AI is doing (transparency)
5. **Coordinate system**: 1000x1000 normalized grid maps to browser viewport (not desktop)

## Implementation Steps

### Step 1: Create Browser Window Manager ✅
**Files**: `src/main/windows/computer_browser.ts`
**Commit**: `feat: create computer browser window manager`
**Tests**: Manual verification

**Implementation**:
- Create `ComputerBrowser` class managing single BrowserWindow instance
- Window specs: 1440x900, visible, partition `persist:computer-browser`
- TTL timer: 5 minutes, resets on each action
- Methods:
  - `executeAction(action)` → `{ url, screenshot }`
  - `navigate(url)`: Load URL, wait for load
  - `screenshot()`: Capture webContents as PNG base64
  - `getCurrentURL()`: Get page URL
  - `click(x, y)`: Send mouse input event
  - `type(text)`: Send keyboard char events
  - `scroll(direction, amount)`: Execute scrollBy JavaScript
  - `executeJS(code)`: Run JavaScript in page
  - `resetTTL()`: Reset 5-minute timer
  - `close()`: Cleanup window

**Tests**:
- Verify window creation
- Verify TTL cleanup works
- Verify screenshot capture

**Verification**: Browser window opens, closes after 5 min inactivity

---

### Step 2: Implement Browser Actions ✅ / ❌ / 🔄
**Files**: `src/main/windows/computer_browser.ts`
**Commit**: `feat: implement browser action execution`
**Tests**: Unit tests for each action

**Implementation**:
Map each Google action to browser operations:
- `open_web_browser(url)` / `navigate(url)`: webContents.loadURL(), wait for did-finish-load
- `go_back()`: webContents.goBack()
- `go_forward()`: webContents.goForward()
- `search(query)`: Navigate to Google search URL
- `click_at(x, y)`: Convert 1000x1000 → viewport coords, sendInputEvent mouseDown+mouseUp
- `hover_at(x, y)`: sendInputEvent mouseMove
- `type_text_at(x, y, text)`: Click then send char events
- `scroll_document(direction, amount)`: executeJavaScript scrollBy
- `scroll_at(x, y, direction, amount)`: Focus element then scroll
- `key_combination(keys)`: sendInputEvent with modifiers
- `drag_and_drop(from, to)`: Sequence of mouseDown, mouseMove, mouseUp
- `wait_5_seconds()`: Promise delay

**Coordinate conversion**:
```typescript
normalizedToViewport(x, y) {
  const bounds = window.getBounds()
  return {
    x: (x * bounds.width) / 1000,
    y: (y * bounds.height) / 1000
  }
}
```

**Tests**:
- Test coordinate conversion
- Test each action type
- Test URL retrieval after actions

**Verification**: All 14 actions execute correctly

---

### Step 3: Add IPC Handlers ✅
**Files**: `src/main/ipc.ts`, `src/preload.ts`, `src/ipc_consts.ts`
**Commit**: `feat: add computer browser ipc handlers`
**Tests**: TypeScript compilation

**Implementation**:

`src/ipc_consts.ts`:
```typescript
export const COMPUTER_BROWSER = {
  IS_AVAILABLE: 'computer-browser-is-available',
  EXECUTE_ACTION: 'computer-browser-execute-action',
} as const
```

`src/main/ipc.ts`:
```typescript
import computerBrowser from './windows/computer_browser'

ipcMain.handle(COMPUTER_BROWSER.IS_AVAILABLE, () => {
  return computerBrowser.isAvailable()
})

ipcMain.handle(COMPUTER_BROWSER.EXECUTE_ACTION, async (event, action) => {
  return await computerBrowser.executeAction(action)
})
```

`src/preload.ts`:
```typescript
computerBrowser: {
  isAvailable: () => ipcRenderer.invoke(COMPUTER_BROWSER.IS_AVAILABLE),
  executeAction: (action) => ipcRenderer.invoke(COMPUTER_BROWSER.EXECUTE_ACTION, action),
}
```

**Tests**:
- Run TypeScript compiler
- Verify no type errors

**Verification**: IPC wiring compiles without errors

---

### Step 4: Update Types ✅
**Files**: `src/types/index.ts`
**Commit**: `feat: add computer browser types`
**Tests**: TypeScript compilation

**Implementation**:
```typescript
computerBrowser: {
  isAvailable(): boolean
  executeAction(action: ComputerAction): Promise<{ url: string, screenshot: string }>
}
```

**Tests**:
- Run lint
- Verify TypeScript compilation

**Verification**: Types compile correctly

---

### Step 5: Update ComputerGooglePlugin ✅
**Files**: `src/plugins/computer_google.ts`
**Commit**: `feat: update google plugin to use browser automation`
**Tests**: Unit tests

**Implementation**:
```typescript
async execute(_context, payload) {
  const { tool, parameters } = payload
  const action = this.mapToolToAction(tool, parameters)

  const result = await window.api.computerBrowser.executeAction(action)

  return {
    url: result.url,
    parts: [{
      inlineData: {
        mimeType: 'image/png',
        data: result.screenshot
      }
    }]
  }
}
```

**Tests**:
- Update plugin test
- Mock computerBrowser API
- Verify response format

**Verification**: Plugin returns correct Google format

---

### Step 6: Update Helper to Use Browser ✅
**Files**: `src/llms/google.ts`
**Commit**: `feat: use browser for google computer info`
**Tests**: Manual verification

**Implementation**:
```typescript
const getComputerInfo = () => {
  if (!window.api.computerBrowser?.isAvailable()) return null
  const plugin = new ComputerGooglePlugin(store.config.plugins.computer, store.config.workspaceId)
  return {
    plugin: plugin,
    screenSize: () => ({ width: 1440, height: 900 }), // Browser window size
    screenNumber: () => 1,
  }
}
```

**Tests**:
- Run lint
- Verify TypeScript

**Verification**: Helper correctly detects browser availability

---

### Step 7: Multi-llm-ts Updates ✅ / ❌ / 🔄
**Files**: `../multi-llm-ts/src/providers/google.ts`
**Commit**: `chore: rebuild multi-llm-ts with browser support`
**Tests**: multi-llm-ts test suite

**Implementation**:
- No code changes needed (already supports computer use)
- Just rebuild and reinstall:
  ```bash
  cd ../multi-llm-ts
  npm run dist
  cd ../witsy
  npm i ../multi-llm-ts
  ```

**Tests**:
- Run multi-llm-ts tests
- Verify build succeeds

**Verification**: Updated library installed

---

### Step 8: Integration Testing ✅ / ❌ / 🔄
**Files**: N/A
**Commit**: `test: verify browser-based computer use`
**Tests**: Manual integration tests

**Manual Tests**:
- Open Google Computer Use chat
- Test navigation: "Go to google.com"
- Test clicking: "Click the search box"
- Test typing: "Type 'hello world'"
- Test scrolling: "Scroll down"
- Verify screenshots show browser content
- Verify URL is actual page URL
- Verify TTL cleanup after 5 minutes

**Verification**: End-to-end browser automation works

---

### Step 9: Add Window Tests ✅ / ❌ / 🔄
**Files**: `tests/unit/computer_browser.test.ts`
**Commit**: `test: add computer browser unit tests`
**Tests**: `npm test -- computer_browser`

**Tests to add**:
- Window creation and cleanup
- TTL timer functionality
- Coordinate conversion
- Action execution
- Screenshot capture
- URL retrieval

**Verification**: All tests pass

---

### Step 10: Documentation ✅ / ❌ / 🔄
**Files**: `README.md`, plan file
**Commit**: `docs: document browser-based google computer use`
**Tests**: N/A

**Updates**:
- README: Explain Google uses browser automation
- Note differences from Anthropic (desktop vs browser)
- Document TTL behavior
- Update architecture notes in plan

**Verification**: Documentation is clear

---

## Final Steps

### Commit History Structure
Each step has its own atomic commit for easy rollback:
```
feat/fix/test/chore: descriptive message
```

### Squash Strategy
```bash
git rebase -i HEAD~10
# Squash all into: "feat: add google computer use with browser automation"
```

### Final Verification
- [ ] All tests pass
- [ ] Linting clean
- [ ] Browser window opens/closes correctly
- [ ] All 14 actions work
- [ ] Screenshots show browser content
- [ ] URLs are accurate
- [ ] TTL cleanup works

---

## Rollback Strategy

Each commit is atomic and tested. To rollback:
- Find commit before issue: `git log --oneline`
- Reset: `git reset --hard <commit>`

Key checkpoints:
- After Step 1: Browser window infrastructure works
- After Step 5: Plugin integration complete
- After Step 8: Full end-to-end working

---

## Key Learnings

_To be filled after execution_

### Ways of Working

### Design Patterns

### Implementation Notes

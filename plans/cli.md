# Witsy CLI - Features & Architecture

## Summary

Witsy CLI is a terminal-based interface for the Witsy AI assistant, providing a minimal but powerful chat experience.

### Current Features

- **Interactive Chat**: Streaming completions with conversation history
- **Command System**: `/help`, `/model`, `/port`, `/clear`, `/exit`
- **Filterable Menus**: Type to filter commands and model selections
- **Input History**: UP/DOWN arrow navigation through previous prompts
- **Tool Call Visualization**: Blue/green indicators for tool execution
- **Smart Display**: Auto-adjusts menu height, double-escape to clear
- **Persistent Config**: CLI-specific settings in `cli.json` (engine, model, input history)

### Architecture Design

**Core Components:**
- `cli.ts` - Main REPL loop, orchestrates input/command flow
- `commands.ts` - Command handlers and business logic
- `api.ts` - HTTP client for Witsy backend communication
- `input.ts` - Custom input field with history and escape handling
- `select.ts` - Filterable menu with recursive filtering
- `display.ts` - Terminal rendering and layout management
- `config.ts` - CLI configuration persistence
- `state.ts` - Runtime state management

**Key Design Patterns:**
- **Custom Input Field**: Modified terminal-kit's `inputField` for Witsy-specific behaviors (history, escape, slash detection)
- **Recursive Filtering**: Select menus rebuild on each keystroke, filtering from original list
- **Cleanup Pattern**: Centralized cleanup function for input field teardown
- **Streaming Protocol**: SSE-like streaming with `data:` prefixed JSON chunks

**Communication:**
```
CLI <--(HTTP)--> Witsy Backend (port 8090)
  GET  /api/cli/config       - Get current engine/model
  GET  /api/engines          - List available engines
  GET  /api/models/:engine   - List models for engine
  POST /api/complete         - Stream chat completion
```

---

## TODO List

### 1. Connection Error Management

**Problem**: Generic error messages, no reconnection flow, slow startup on failed connection.

**Requirements:**
- Short timeout on initial connection (e.g., 2 seconds)
- Clear error message: "Witsy not running. Start Witsy desktop app and use /connect command"
- `/port` command validates connection to new port before accepting
- `/connect` command to retry connection (test `/api/cli/config`)

**Implementation:**
- Add `connectWithTimeout(port: number, timeout: number): Promise<boolean>` to `api.ts`
- Update `initialize()` to use short timeout, show helpful error
- Update `handlePort()` to test connection before saving
- Add `handleConnect()` command that calls `connectWithTimeout()` and updates state
- Add connection status indicator in footer (connected/disconnected)

---

### 2. Save Conversation Command

**Problem**: Conversations are ephemeral, lost on `/clear` or CLI exit.

**Requirements:**
- `/save` command saves current conversation to Witsy workspace
- Uses new API endpoint: `POST /api/conversations` (to be created)
- CLI message model needs enrichment with Chat/Message metadata (timestamps, IDs)
- Conversation saved with proper workspace association (`config.workspaceId`)

**Implementation:**

**Backend (main process):**
- Create `POST /api/conversations` endpoint
- Accepts: `{ workspaceId: string, messages: Message[] }`
- Uses existing Chat/Message persistence logic
- Returns: `{ chatId: string, messageIds: string[] }`

**CLI:**
- Update `CLIState.history` type from simple `{ role, content }` to richer model:
  ```typescript
  interface CliMessage {
    role: string
    content: string
    timestamp: Date
    id?: string  // After save
  }
  ```
- Add `handleSave()` in `commands.ts`
- Call `POST /api/conversations` with current `state.history`
- Show success message: "✓ Conversation saved to workspace"
- Mark messages as saved in state (store returned IDs)

**Future Enhancement:**
- `/load <chatId>` to restore saved conversation
- `/conversations list` to show recent chats

---

### 3. Multiline Input Support

**Problem**: Single-line input is limiting for longer prompts, can't paste multi-line text easily.

**Requirements:**
- Shift+Enter creates a new line within input
- Enter submits (existing behavior)
- `witsyInputField` handles multi-line display and coordinate calculation
- Footer repositioning accounts for multi-line input height
- Input line count calculation updated

**Implementation:**

**witsyInputField.ts:**
- Add Shift+Enter keybinding: `SHIFT_ENTER: 'newline'`
- In `onKey`, handle 'newline' action:
  ```typescript
  case 'newline':
    inputs[inputIndex].splice(offset, 0, '\n')
    offset++
    computeAllCoordinate()
    redraw()
    break
  ```
- Update `computeAllCoordinate()` to handle `\n` in input string
- Calculate visual lines based on wrapping AND newlines

**input.ts:**
- Update `calculateLineCount()` to count `\n` characters:
  ```typescript
  const newlineCount = (text.match(/\n/g) || []).length
  const wrappedLines = Math.ceil(totalChars / termWidth)
  return Math.max(1, wrappedLines + newlineCount)
  ```
- Ensure footer repositioning works with multi-line input

**display.ts:**
- No changes needed (footer already uses `lineCount`)

**Testing:**
- Type text, Shift+Enter, type more, submit
- Paste multi-line text
- Verify footer stays in correct position
- Test with very long lines that wrap

---

### 4. Stop Streaming with Escape

**Problem**: No way to cancel long-running completions.

**Requirements:**
- Escape key during streaming stops the request
- Shows "Response cancelled by user" message
- Partial response is preserved in history
- Display returns to normal prompt state

**Implementation:**

**api.ts:**
- Make `complete()` cancellable:
  ```typescript
  async complete(
    thread: Array<{role: string, content: string}>,
    onChunk: (text: string) => void,
    signal?: AbortSignal  // Add abort signal
  ): Promise<void>
  ```
- Pass signal to fetch:
  ```typescript
  const response = await fetch(`${this.baseUrl()}/api/complete`, {
    method: 'POST',
    signal,  // Add this
    // ...
  })
  ```

**commands.ts:**
- Update `handleMessage()`:
  ```typescript
  const controller = new AbortController()
  let cancelled = false

  // Set up escape key listener
  const escapeListener = (key: string) => {
    if (key === '\x1b') {  // Escape
      cancelled = true
      controller.abort()
    }
  }
  process.stdin.on('data', escapeListener)

  try {
    await api.complete(state.history, onChunk, controller.signal)
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(chalk.yellow('\n[Response cancelled]'))
    } else {
      throw error
    }
  } finally {
    process.stdin.removeListener('data', escapeListener)
  }

  // Keep partial response in history
  if (response.length > 0) {
    state.history.push({ role: 'assistant', content: response })
  } else if (cancelled) {
    state.history.pop()  // Remove user message if no response
  }
  ```

**Alternative Approach:**
- Use terminal-kit's key grabbing instead of raw stdin listener
- May be cleaner but need to ensure it doesn't interfere with input field

**Testing:**
- Start long completion, press Escape immediately
- Press Escape mid-response, verify partial text saved
- Press Escape multiple times (shouldn't error)
- Verify next prompt works normally after cancel

---

## Future Enhancements (Not Prioritized)

- `/retry` - Resend last message
- `/history` - Show conversation stats and management
- `/export markdown` - Save conversation to file
- Session persistence (auto-save/restore)
- Conversation branching
- Templates/presets for common prompts
- Search in conversation history
- Configurable keybindings (vim/emacs modes)
- Context window management (trim, summarize)
- Rich tool call display (show parameters/results)

# Witsy CLI - Features & Architecture

## Document Maintenance

**When implementing a feature from TODO list:**
1. Update Summary section (Current Features and Architecture). Keep it concise - highlight feature, not implementation details
2. Remove completed item from TODO list
3. Update tests if state structure changes (e.g., `tests/unit/cli/display.test.ts` uses `state.chat` now instead of `state.history`)

---

## Summary

Witsy CLI is a terminal-based interface for the Witsy AI assistant, providing a minimal but powerful chat experience.

### Current Features

- **Interactive Chat**: Streaming completions with conversation history
- **Command System**: `/help`, `/port`, `/model`, `/title`, `/save`, `/clear`, `/exit`
- **Conversation Persistence**: Save conversations to workspace with `/save`, auto-saves on each message after first save
- **Title Management**: Set conversation titles with `/title`, auto-saves if conversation already saved
- **Connection Management**: Short timeout on startup, exits immediately if cannot connect or HTTP endpoints disabled
- **Filterable Menus**: Type to filter commands and model selections, aligned descriptions (Claude Code style)
- **Input History**: UP/DOWN arrow navigation through previous prompts
- **Tool Call Visualization**: Blue/green indicators for tool execution
- **Smart Display**: Auto-adjusts menu height, double-escape to clear, save status in footer ("type /save" hint at 4+ messages, "auto-saving" when saved)
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
  POST /api/conversations    - Save/update chat conversation
```

---

## TODO List

### 1. Multiline Input Support

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

### 2. Stop Streaming with Escape

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

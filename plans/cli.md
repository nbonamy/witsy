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
- **Command System**: `/help`, `/port`, `/model`, `/title`, `/save`, `/retry`, `/clear`, `/exit`
- **Conversation Persistence**: Save conversations to workspace with `/save`, auto-saves on each message after first save
- **Title Management**: Set conversation titles with `/title`, auto-saves if conversation already saved
- **Message Retry**: Retry last message with `/retry`, uses current engine/model (respects model changes)
- **Connection Management**: Short timeout on startup, exits immediately if cannot connect or HTTP endpoints disabled
- **Filterable Menus**: Type to filter commands and model selections, aligned descriptions (Claude Code style)
- **Input History**: UP/DOWN arrow navigation through previous prompts
- **Keyboard Shortcuts**: Ctrl+C exits immediately, Ctrl+D clears conversation (or exits if empty), double-Escape clears input
- **Tool Call Visualization**: Blue/green indicators for tool execution
- **Smart Display**: Auto-adjusts menu height, save status in footer ("type /save" hint at 4+ messages, "auto-saving" when saved)
- **Stream Cancellation**: Press Escape during streaming to cancel, partial responses are saved
- **Persistent Config**: CLI-specific settings in `cli.json` (engine, model, input history)

### Architecture Design

**Core Components:**
- `main.ts` - Main REPL loop, orchestrates input/command flow
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

## Future Enhancements (Not Prioritized)

- `'/agent'` - To run agent
- `'/expert'` - To select an expert
- Templates/presets for common prompts
- Search in conversation history
- Configurable keybindings (vim/emacs modes)
- Context window management (trim, summarize)
- Rich tool call display (show parameters/results)

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
- **Connection Management**: Short timeout on startup, exits immediately if cannot connect or HTTP endpoints disabled, configurable port via `-p/--port` CLI argument (default: 8090)
- **Command Line Arguments**: `-p/--port` to specify port, `-d/--debug` to show keycodes on line 1, `-h/--help` for usage information
- **Filterable Menus**: Type to filter commands and model selections, aligned descriptions (Claude Code style)
- **Input History**: UP/DOWN arrow navigation through previous prompts
- **Keyboard Shortcuts**: Ctrl+C exits immediately, Ctrl+D clears conversation (or exits if empty), double-Escape clears input, Option+Left/Right for word navigation, Command+Left/Right for line navigation
- **Tool Call Visualization**: Blue/green indicators for tool execution
- **Smart Display**: Auto-adjusts menu height, save status in footer ("type /save" hint at 4+ messages, "auto-saving" when saved)
- **Stream Cancellation**: Press Escape during streaming to cancel, partial responses are saved
- **Persistent Config**: CLI-specific settings in `cli.json` (engine/model with display names, input history)
- **Multi-line Input**: Shift+Enter (CTRL_J) creates newlines, multi-line paste preserves newlines, UP/DOWN navigate between logical lines

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
CLI <--(HTTP)--> Witsy Backend (default port 8090, configurable via -p/--port)
  GET  /api/cli/config       - Get current engine/model
  GET  /api/engines          - List available engines
  GET  /api/models/:engine   - List models for engine
  POST /api/complete         - Stream chat completion
  POST /api/conversations    - Save/update chat conversation
```

---

## TODO List

_(No pending features)_

---

## Development Notes

**Debugging Keycodes:**
- Run CLI with `--debug` flag to show keycodes in real-time on line 1
- Useful for investigating terminal key sequences when adding new keyboard shortcuts
- Example: `witsy-cli --debug` then press Option+Left to see `DEBUG: key='ALT_B' ...`

---

## Future Enhancements (Not Prioritized)

- `'/agent'` - To run agent
- `'/expert'` - To select an expert
- Templates/presets for common prompts
- Search in conversation history
- Configurable keybindings (vim/emacs modes)
- Context window management (trim, summarize)
- Rich tool call display (show parameters/results)

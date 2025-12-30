# CLI Component Framework

## Goal
Create a mini-framework that manages a tree of components and automatically handles display/update/resizing. When a component's height changes (e.g., tool call status goes from 2→5 lines), the framework automatically inserts/deletes lines and shifts content.

## Core Problem
Current code in `display.ts` manually handles line shifting in `rewriteToolAt()`:
- Calculate line differences
- Move cursor up, erase down
- Rewrite the changed component + ALL subsequent components

This is fragile and needs to be replicated everywhere (input resizing, message updates, etc.).

## Design

### Component Base Class
```typescript
abstract class Component {
  id: string
  parent: Component | null
  children: Component[]

  // Cached height from last render
  private cachedHeight: number = 0

  // Calculate height (in terminal lines)
  abstract calculateHeight(width: number): number

  // Render to array of strings (one per line)
  abstract render(width: number): string[]

  // Mark as needing re-render
  markDirty(): void

  // Tree manipulation
  appendChild(child: Component): void
  insertBefore(child: Component, before: Component): void
  removeChild(child: Component): void
}
```

### Root Component (the layout engine)
```typescript
class Root extends Component {
  // Track positions: componentId -> { startRow, height }
  private positions: Map<string, { startRow: number; height: number }>

  // Central animation manager
  private animations: Map<string, NodeJS.Timeout>

  // Full render (used on init, resize)
  renderFull(): void

  // Update a single component (handles line insertion/deletion)
  updateComponent(component: Component): void

  // Animation management
  startAnimation(id: string, callback: () => void, intervalMs: number): void
  stopAnimation(id: string): void
}
```

### The Magic: `updateComponent()`
When a component's height changes:
1. Calculate new height
2. Compare with cached height
3. If height increased: insert empty lines BEFORE re-rendering
4. If height decreased: delete excess lines AFTER re-rendering
5. Re-render the component at its position
6. Update positions of all subsequent components

```typescript
updateComponent(component: Component): void {
  const pos = this.positions.get(component.id)
  const oldHeight = pos.height
  const newHeight = component.calculateHeight(termWidth)

  // Move cursor to component's start row
  process.stdout.write(ansiEscapes.cursorTo(0, pos.startRow - 1))

  if (newHeight > oldHeight) {
    // Need more space - insert blank lines first
    const diff = newHeight - oldHeight
    process.stdout.write('\n'.repeat(diff))  // Push content down
    process.stdout.write(ansiEscapes.cursorUp(diff))  // Move back up
  }

  // Render the component
  const lines = component.render(termWidth)
  lines.forEach((line, i) => {
    process.stdout.write(ansiEscapes.cursorTo(0, pos.startRow - 1 + i))
    process.stdout.write(ansiEscapes.eraseLine)
    process.stdout.write(line)
  })

  if (newHeight < oldHeight) {
    // Component shrank - delete extra lines
    const diff = oldHeight - newHeight
    for (let i = 0; i < diff; i++) {
      process.stdout.write(ansiEscapes.cursorTo(0, pos.startRow - 1 + newHeight + i))
      process.stdout.write(ansiEscapes.eraseLine)
    }
    // Scroll remaining content up? Or just leave blank?
    // Actually: erase remaining lines, then re-render everything below
  }

  // Update position cache
  pos.height = newHeight
  this.updatePositionsAfter(component)
}
```

### Component Types

| Component | Height | Children |
|-----------|--------|----------|
| Header | Fixed (4 lines) | No |
| Empty | Configurable | No |
| Text | Dynamic (wraps) | No |
| ToolCall | Dynamic (2-5+ lines) | No |
| UserMessage | Dynamic | Text |
| AssistantMessage | Dynamic | ToolCall[], Text[] |
| ActivityIndicator | Fixed (1 line) | No |
| Prompt | Dynamic (wraps) | No - wraps witsyInputField |
| Footer | Fixed (2 lines) | No |
| Menu | Dynamic | No |

### Tree Structure

```
Root
├── Header (4 lines)
├── Empty (1 line)
├── [Messages...]
│   ├── UserMessage
│   │   └── Text
│   ├── AssistantMessage
│   │   ├── ToolCall
│   │   ├── ToolCall
│   │   └── Text
│   └── ...
├── ActivityIndicator? (1 line, while generating)
├── Prompt (1+ lines)
└── Footer (2 lines)
    └── Menu? (N lines, when showing commands)
```

## File Structure

```
src/cli/
├── components/
│   ├── index.ts          # Exports
│   ├── component.ts      # Base class
│   ├── root.ts           # Layout engine + animation manager
│   ├── header.ts
│   ├── empty.ts
│   ├── text.ts
│   ├── toolcall.ts
│   ├── user-message.ts
│   ├── assistant-message.ts
│   ├── activity-indicator.ts
│   ├── prompt.ts
│   ├── footer.ts
│   └── menu.ts
├── display.ts            # Keep color utilities, padContent
├── main.ts               # Use component tree
├── input.ts              # Simplified - Prompt component handles
├── witsyInputField.ts    # Keep as-is
├── select.ts             # Keep for now, integrate later
├── commands.ts           # Update to use component tree
└── state.ts              # Add componentTree reference
```

## Implementation Phases

### Phase 1: Foundation
**Files:** `src/cli/components/component.ts`, `root.ts`

1. Create `components/` directory
2. Implement `Component` base class
3. Implement `Root` with:
   - Position tracking
   - `renderFull()`
   - `updateComponent()` - the core line insertion/deletion logic
   - Animation manager (`startAnimation`, `stopAnimation`)
4. Unit tests for position calculations

**Commit:** `feat: add cli component framework foundation`

### Phase 2: Simple Components
**Files:** `header.ts`, `empty.ts`, `text.ts`, `footer.ts`

1. Implement Header component (fixed 4 lines)
2. Implement Empty component (configurable lines)
3. Implement Text component (dynamic wrapping)
4. Implement Footer component (2 lines)
5. Unit tests for each

**Commit:** `feat: add basic cli components (header, text, footer)`

### Phase 3: Tool Components
**Files:** `toolcall.ts`, `activity-indicator.ts`

1. Implement ToolCall component
   - Animation frame tracking
   - Status update → markDirty
   - Completion states
2. Implement ActivityIndicator (simple 1-line spinner)
3. Port existing animation logic from `display.ts`
4. Unit tests

**Commit:** `feat: add tool call and activity indicator components`

### Phase 4: Message Components
**Files:** `user-message.ts`, `assistant-message.ts`

1. Implement UserMessage (contains Text)
2. Implement AssistantMessage (contains ToolCall[], Text[])
   - `addToolCall()`, `addText()` methods
3. Test nested component height calculations

**Commit:** `feat: add message container components`

### Phase 5: Prompt Integration
**Files:** `prompt.ts`, updates to `input.ts`

1. Implement Prompt component
   - Wraps witsyInputField
   - Tracks line count changes
   - Calls `markDirty()` on height change
2. Integrate with Root for automatic footer repositioning
3. Test input resizing

**Commit:** `feat: add prompt component with auto-footer repositioning`

### Phase 6: Integration
**Files:** `main.ts`, `commands.ts`, `state.ts`

1. Add `componentTree: Root` to state
2. Update `main.ts` to:
   - Initialize component tree
   - Use `root.renderFull()` on startup
   - Build tree from messages
3. Update `commands.ts` to:
   - Use component tree for message display
   - Use component tree for tool animations
4. Integration tests

**Commit:** `feat: integrate component tree into cli main loop`

### Phase 7: Menu Component
**Files:** `menu.ts`, updates to `select.ts`

1. Implement Menu component
2. Integrate with Footer (Menu appears under Footer)
3. Handle menu showing/hiding

**Commit:** `feat: add menu component`

### Phase 8: Cleanup
**Files:** `display.ts`

1. Remove deprecated functions:
   - `resetDisplay` (replaced by `root.renderFull()`)
   - `displayConversation` (replaced by component tree)
   - Tool animation functions (moved to Root)
2. Keep utilities: colors, `padContent`
3. Final testing

**Commit:** `chore: cleanup deprecated display functions`

## Critical Files

- `src/cli/display.ts` - Extract utilities, reference for existing logic
- `src/cli/main.ts` - Will use component tree
- `src/cli/input.ts` - Simplified, Prompt component handles footer
- `src/cli/commands.ts` - handleMessage will build component tree
- `src/cli/state.ts` - Add componentTree reference

## Testing Strategy

Each phase includes unit tests:
- Component height calculations
- Position tracking
- Line insertion/deletion (mock stdout)
- Animation start/stop

Tests in `tests/unit/cli/components/`

## Usage Example (After Implementation)

```typescript
// Using tree.ts utilities
import {
  initializeTree,
  getTree,
  addUserMessage,
  addAssistantMessage,
  showActivity,
  hideActivity,
  startToolAnimations,
  stopToolAnimations
} from './tree'

// Initialize tree (done in main.ts)
initializeTree()

// Add user message
const userMsg = addUserMessage(message)

// Show activity indicator
showActivity('Thinking...')

// Create assistant message
const assistantMsg = addAssistantMessage()

// As tools execute...
const tool = assistantMsg.addToolCall(toolId, 'tool_name(args)')
startToolAnimations(assistantMsg)

// Tool status changes (2 lines → 5 lines)
tool.updateStatus('tool_name(args)\n  line1\n  line2\n  line3')
getTree().updateComponent(tool)  // Framework handles line insertion!

// Tool completes
tool.complete('completed', 'tool_name(args)\n  result')
stopToolAnimations()

// Hide activity indicator
hideActivity()
```

## Implementation Status

### Completed
- [x] Phase 1: Component base class and Root layout engine
- [x] Phase 2: Simple components (Header, Empty, Text, Footer)
- [x] Phase 3: Tool components (ToolCall, ActivityIndicator)
- [x] Phase 4: Message containers (UserMessage, AssistantMessage)
- [x] Phase 5: Prompt component
- [x] Phase 6: Integration (tree initialized in main.ts)
- [x] Phase 7: Menu component

### Pending
- [ ] Phase 8: Cleanup deprecated display functions (optional - existing code works alongside new framework)

## Key Learnings

### Design Patterns
1. **Component tree approach** - Works well for CLI rendering. Each component knows its height and renders to string array.
2. **Central animation manager** - Root handles all animation intervals, making cleanup reliable.
3. **Position caching** - Root tracks positions to enable incremental updates without full redraws.
4. **Utility module (tree.ts)** - Provides convenience functions, making the framework easier to use.

### Implementation Notes
1. **Incremental migration** - Framework can coexist with existing display code. No need for big-bang rewrite.
2. **Testing** - 160 unit tests for components ensure reliability.
3. **Line insertion/deletion** - The key `updateComponent()` method in Root handles this automatically.
4. **TypeScript** - Strong typing helps catch errors early.

### Files Created
- `src/cli/components/` - Component implementations
- `src/cli/tree.ts` - Tree utility functions
- `tests/unit/cli/components/` - Unit tests

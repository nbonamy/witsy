# Agent View Revamp - Execution Flow Visualization

## Overview

Revamp the Agent View (`/src/renderer/agent/View.vue`) to have a 3-vertical-pane layout similar to `AudioBooth.vue`, with a canvas-based execution flow visualization in the middle pane.

## Current State

The current View.vue uses a 2-pane master-detail layout:
- **Left (master)**: Agent info + history list (runs)
- **Right (detail)**: Run details panel showing metadata and step outputs

## Target State

A 3-vertical-pane layout:
1. **Left pane**: Header + scrollable list of runs (like sidebar)
2. **Middle pane**: Canvas-based execution flow visualization showing steps as connected nodes
3. **Right pane**: Details panel - either run header (when first step selected) or mini message list (for other steps)

## Architecture Decisions

### Canvas Visualization
- Use HTML5 Canvas for the execution flow visualization
- Each step rendered as a node with connections
- First step = agent icon + name
- Subsequent steps = step description or "Step N"
- Support for scrolling and zooming (basic implementation first)
- Node selection state

### Component Structure
- `View.vue` - Main container with 3-pane layout (runs list integrated directly)
- `ExecutionFlow.vue` - New component for canvas visualization
- `StepDetail.vue` - New component for right panel step details

## Implementation Plan

### Phase 1: Basic 3-Pane Layout ✅
- [x] Create basic 3-pane split-pane structure in View.vue
- [x] Integrate run list directly into View.vue (simplified from original plan)
- [x] Add placeholder for middle canvas pane
- [x] Add placeholder for right detail pane
- [x] Verify layout works with existing CSS variables

**Commit**: `5adaca86` "feat: basic 3-pane layout for agent view"

### Phase 2: Runs List Component (SKIPPED)
- Decided to integrate runs list directly into View.vue for simplicity
- All run list functionality works within the parent component

### Phase 3: Execution Flow Canvas - Basic Structure ✅
- [x] Create `ExecutionFlow.vue` component
- [x] Set up canvas with proper sizing (HiDPI support)
- [x] Implement basic node rendering (rounded rectangles with text)
- [x] Render first node as agent info (name + description)
- [x] Render subsequent nodes as steps
- [x] Draw connections between nodes (vertical flow with arrows)

### Phase 4: Canvas Interactivity ✅
- [x] Implement node hit detection
- [x] Handle node selection (click)
- [x] Highlight selected node (color change)
- [x] Emit selection events to parent
- [x] Default selection: first step (agent node)

### Phase 5: Canvas Enhancements ✅
- [x] Add scrolling support for long flows (wheel event)
- [x] Add basic zoom support (ctrl/cmd + wheel)
- [x] Improve node styling (rounded corners)
- [x] Add status indicators on nodes (success/error/running)
- [ ] Add icons to nodes (deferred for polish phase)

**Commit**: `270df693` "feat: basic execution flow canvas visualization"

### Phase 6: Step Detail Panel ✅
- [x] Create `StepDetail.vue` component
- [x] When first step (agent) selected: show run metadata
- [x] When other step selected: show mini MessageList with prompt/response
- [x] Handle "no step selected" state (empty placeholder)

**Commit**: `25aab8f5` "feat: step detail panel with conditional content"

### Phase 7: Integration & Polish
- [x] Wire up all components in View.vue
- [x] Handle run selection -> load steps -> update canvas
- [x] Handle step selection -> update detail panel
- [x] Ensure proper reactivity on run updates (IPC events)
- [ ] Style consistency refinements
- [ ] Add icons to canvas nodes

**Status**: Core integration complete, polish items pending

### Phase 8: Testing ✅
- [x] Update existing View.vue tests for new structure (23 tests passing)
- [ ] Add dedicated unit tests for ExecutionFlow
- [ ] Add dedicated unit tests for StepDetail

## Data Flow

```
View.vue
├── agent: Agent (prop)
├── runs: AgentRun[] (loaded)
├── selection: AgentRun[] (selected runs)
├── selectedStepIndex: number (0 = agent info, 1+ = steps)
│
├── Runs List (inline)
│   └── filteredRuns, selection, showWorkflows state
│
├── ExecutionFlow
│   ├── agent (prop) - for name/description
│   ├── run (prop) - for steps
│   ├── selectedIndex (prop)
│   └── @select (event)
│
└── StepDetail
    ├── agent (prop)
    ├── run (prop)
    ├── stepIndex (prop)
    └── @delete (event)
```

## Step Data Structure

From the run, we extract steps as:
```typescript
// Step 0: Agent info
{ type: 'agent', index: 0, label: agent.name, description: agent.description }

// Step 1+: From run.messages, grouped as prompt/response pairs
{ type: 'step', index: N, label: 'Step N', description: step.description, prompt: Message, response: Message }
```

## Visual Design (Implemented)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Agent Name                         [Run] [Edit] [Delete]           │
├──────────┬──────────────────────────┬───────────────────────────────┤
│ History  │                          │   Step Details                │
│ [filter] │   ┌─────────────────┐    │                               │
│          │   │  Agent Name     │◄──│   ┌─────────────────────────┐│
│ Run 1    │   │  description    │    │   │ Run Details             ││
│ Run 2    │   └────────┬────────┘    │   │ - ID: xxx               ││
│ Run 3 ◄  │            │             │   │ - Status: success       ││
│          │            ▼             │   │ - Duration: 5s          ││
│          │   ┌─────────────────┐ ●  │   │ - Prompt: ...           ││
│          │   │   Step 1        │    │   └─────────────────────────┘│
│          │   └────────┬────────┘    │                               │
│          │            │             │   OR (when step selected):    │
│          │            ▼             │                               │
│          │   ┌─────────────────┐ ●  │   ┌─────────────────────────┐│
│          │   │   Step 2        │    │   │ Step 1                  ││
│          │   └─────────────────┘    │   │ Input: [prompt]         ││
│          │                          │   │ Output: [response]      ││
│          │  (scroll/zoom: wheel)    │   └─────────────────────────┘│
└──────────┴──────────────────────────┴───────────────────────────────┘
```

## Key Learnings

### Design Decisions
1. Integrating runs list directly into View.vue rather than extracting to a separate component simplified the implementation and state management
2. HTML5 Canvas works well for the execution flow visualization - simpler than SVG for this use case
3. ResizeObserver needs a guard for test environments where it's not available

### Implementation Notes
1. Canvas needs HiDPI scaling (device pixel ratio) for crisp rendering
2. Node hit detection requires transforming click coordinates back to canvas space
3. Scroll/zoom state needs to be bounded to prevent over-scrolling
4. StepDetail reuses MessageItemBody for consistent message rendering

### Testing
1. Updated all existing tests to work with new component structure
2. Tests verify 3-pane layout, run selection, step selection, and event handling

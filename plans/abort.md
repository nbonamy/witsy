# AbortController Support for Plugins

## Requirement

Add AbortSignal support to the plugin execution system, allowing plugins to check for cancellation and abort long-running operations. This needs to work across IPC boundaries since some plugins (like search) call main process functions through IPC.

The goal is to enable users to cancel operations like web searches, file system operations, or any other long-running plugin tasks, with proper cleanup and resource management.

## Current State

### Multi-LLM-TS Package

**AbortSignal Support:**
- `LlmCompletionOpts` includes `abortSignal?: AbortSignal` (src/types/llm.ts:107)
- `LlmEngine.generate()` checks `opts?.abortSignal?.aborted` before and after processing chunks (src/engine.ts:136, 147)
- When aborted, calls `currentStream.controller?.abort()` and returns early

**Plugin Context:**
- `PluginExecutionContext` type only contains `model: string` (src/types/plugin.ts:20-22)
- No abort signal is currently passed to plugins
- `LlmEngine.callTool()` calls `toolOwner.execute(context, payload)` (src/engine.ts:434)

**Deprecated Method:**
- `LlmEngine.stop(stream)` is marked as deprecated (src/engine.ts:54-56)
- Comment says to use `abortSignal` in `LlmCompletionOpts` instead

### Witsy Application

**Generator/Assistant Classes:**
- **Still using the OLD deprecated approach**
- `Generator.stop()` (src/services/generator.ts:311-318):
  - Sets manual `stopGeneration = true` flag
  - Calls deprecated `llm.stop(this.stream)`
- Manual flag check in streaming loop (generator.ts:138-142):
  ```typescript
  for await (const msg of this.stream) {
    if (this.stopGeneration) {  // Manual check
      response.appendText({ type: 'content', text: '', done: true })
      rc = 'stopped'
      break
    }
  ```
- **Does NOT create or use AbortController**
- **Does NOT pass abortSignal in opts to llm.generate() or llm.complete()**

**Search Plugin:**
- Local search method (src/plugins/search.ts:105-122):
  ```typescript
  async local(parameters: anyDict, maxResults: number): Promise<SearchResponse> {
    try {
      const results = await window.api.search.query(parameters.query, maxResults)
      // Single await - blocks until completion
      return { query: parameters.query, results: [...] }
    } catch (error) {
      return { error: error.message }
    }
  }
  ```
- Just awaits IPC call - no way to cancel mid-operation
- External API methods (brave, exa, perplexity, tavily) use fetch but don't pass abort signals

**IPC Layer:**
- Search IPC (src/main/ipc.ts:808-813):
  ```typescript
  ipcMain.handle(IPC.SEARCH.QUERY, async (_, payload) => {
    const { query, num } = payload;
    const localSearch = new LocalSearch();
    const results = localSearch.search(query, num);
    return results;
  });
  ```
- No support for cancellation
- No tracking of active operations

**LocalSearch Main Process:**
- `search()` method (src/main/search.ts:53-130):
  - Creates hidden browser windows to scrape Google
  - Iterates through results fetching content
  - No abort signal support
  - Long-running operations with no cancellation mechanism
- `getContents()` method (src/main/search.ts:132-253):
  - Opens browser windows to fetch page content
  - No abort signal support
  - Can download files, parse HTML
  - All blocking operations

## Impact Analysis

### What Needs AbortSignal Support

**High Priority:**
1. **Generator/Assistant** - Main generation loop
2. **Search Plugin** - Can take 30+ seconds for Google scraping
3. **LocalSearch (main process)** - Browser automation, multiple fetches
4. **MCP Plugin** - External tool calls (SDK supports abort!)

**Medium Priority:**
5. **Browse Plugin** - Web page fetching
6. **Filesystem Plugin** - Large file operations
7. **Image/Video Plugins** - Image generation can be slow
8. **Python Plugin** - Code execution

**Lower Priority:**
9. **Computer Plugin** - Screenshot/automation operations (usually fast)
10. **Memory Plugin** - Usually fast
11. **YouTube/Vega Plugins** - Usually fast

### IPC Challenges

**Problem:** AbortSignal cannot be serialized across IPC boundaries (it's a DOM object with event listeners)

**Solution Approaches:**

1. **Signal ID Proxy Pattern:**
   - Renderer creates AbortController and generates unique ID
   - Passes signal ID through IPC instead of signal itself
   - Main process maintains Map<signalId, AbortController>
   - Main creates its own AbortController for the operation
   - Renderer calls separate IPC to cancel by signal ID
   - Main process looks up controller and calls abort()

2. **Polling Pattern:**
   - Renderer starts async operation with signal ID
   - Operation runs in background on main process
   - Renderer polls for status/completion
   - Renderer can cancel by sending cancel IPC message
   - More complex but allows progress updates

3. **Dual Controller Pattern:**
   - Renderer has AbortController for local operations
   - Main process has separate AbortController for IPC operations
   - Renderer's abort triggers IPC cancel message
   - Main process's controller aborts its operations

## Helper Utilities for Abort Pattern

### The Two-Layer Approach

Since the abort pattern with IPC involves repetitive code, we'll create helper utilities at two layers:

1. **Layer 1 (multi-llm-ts)**: Generic Promise racing with abort signal
2. **Layer 2 (Witsy)**: IPC-specific signal ID management

### Layer 1: multi-llm-ts Plugin.runWithAbort()

**File: ~/src/nbonamy/multi-llm-ts/src/plugin.ts**

Add a protected method to the Plugin base class:

```typescript
export default class Plugin implements IPlugin {

  // ... existing methods ...

  /**
   * Executes a promise with abort signal support and optional cleanup.
   * Races the promise against the abort signal.
   *
   * This is a generic helper that works with any Promise and AbortSignal,
   * not specific to IPC or any particular implementation.
   *
   * @param operation - The async operation to execute
   * @param abortSignal - Optional abort signal to monitor
   * @param onAbort - Optional callback invoked when abort is triggered (for cleanup)
   * @returns Promise that resolves with operation result or rejects on abort
   *
   * @example
   * // Simple fetch with abort
   * const data = await this.runWithAbort(
   *   fetch('https://api.example.com/data'),
   *   context.abortSignal
   * )
   *
   * @example
   * // With cleanup callback
   * const result = await this.runWithAbort(
   *   someAsyncOperation(),
   *   context.abortSignal,
   *   () => cleanup()
   * )
   */
  protected async runWithAbort<T>(
    operation: Promise<T>,
    abortSignal?: AbortSignal,
    onAbort?: () => void
  ): Promise<T> {

    // Check if already aborted before starting
    if (abortSignal?.aborted) {
      onAbort?.()
      throw new Error('Operation cancelled')
    }

    // If no abort signal, just return the promise
    if (!abortSignal) {
      return operation
    }

    // Race between completion and abort
    return Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        abortSignal.addEventListener('abort', () => {
          onAbort?.()
          reject(new Error('Operation cancelled'))
        }, { once: true })
      })
    ])
  }
}
```

**Benefits:**
- Generic - works with any Promise and AbortSignal
- No knowledge of IPC, Electron, or signal IDs
- Reusable across all projects using multi-llm-ts
- Clean abstraction with optional cleanup callback
- Proper TypeScript generics for type safety

**Usage (without IPC):**
```typescript
// Direct fetch with abort
const data = await this.runWithAbort(
  fetch(url, { signal: context.abortSignal }),
  context.abortSignal
)

// Or with a cleanup callback
const result = await this.runWithAbort(
  longRunningOperation(),
  context.abortSignal,
  () => console.log('Operation was cancelled')
)
```

### Layer 2: Witsy IPC Helper

**Why We Need This:**

The signal ID handling is **unavoidable** in Witsy due to Electron's IPC limitations:

**The Problem:**
- Renderer process has `AbortSignal` object (DOM EventTarget with listeners)
- Main process needs to know "which operation to cancel"
- **AbortSignal cannot be serialized across IPC**

**The Solution:**
```
Renderer:  AbortSignal → generates signalId → IPC with signalId → Main
Main:      receives signalId → creates own AbortController → tracks in Map
Renderer:  signal aborts → IPC cancel(signalId) → Main
Main:      looks up signalId in Map → aborts its AbortController
```

**File: src/plugins/ipc_abort_helper.ts** (new file)

```typescript
import Plugin from './plugin'

/**
 * Helper for IPC calls that need abort support.
 * Handles signal ID generation, IPC call setup, and cleanup automatically.
 *
 * This wraps the Electron-specific overhead of:
 * 1. Generating unique signal IDs
 * 2. Passing them through IPC
 * 3. Calling cancel via IPC on abort
 *
 * Uses Plugin.runWithAbort() under the hood for the race pattern.
 *
 * @param plugin - The plugin instance (for accessing runWithAbort)
 * @param ipcCall - Function that makes the IPC call, receives signalId
 * @param cancelCall - Function that cancels the IPC call by signalId
 * @param abortSignal - Optional abort signal to monitor
 * @returns Promise that resolves with IPC result or rejects on abort
 *
 * @example
 * const results = await executeIpcWithAbort(
 *   this,
 *   (signalId) => window.api.search.query(query, maxResults, signalId),
 *   (signalId) => window.api.search.cancel(signalId),
 *   context.abortSignal
 * )
 */
export async function executeIpcWithAbort<T>(
  plugin: Plugin,
  ipcCall: (signalId: string) => Promise<T>,
  cancelCall: (signalId: string) => void,
  abortSignal?: AbortSignal
): Promise<T> {

  // Generate unique signal ID for IPC tracking
  const signalId = crypto.randomUUID()

  // Use the base Plugin.runWithAbort() for the race pattern
  return plugin['runWithAbort'](
    ipcCall(signalId),
    abortSignal,
    () => cancelCall(signalId)
  )
}
```

**Benefits:**
- Eliminates signal ID boilerplate in every plugin
- DRY principle for IPC + abort pattern
- Still uses the generic `runWithAbort()` under the hood
- Type-safe with generics
- Clear, self-documenting code

**Usage in Plugins:**

```typescript
import { executeIpcWithAbort } from './ipc_abort_helper'

async local(parameters: anyDict, maxResults: number, signal?: AbortSignal): Promise<SearchResponse> {
  try {
    const results = await executeIpcWithAbort(
      this,
      (signalId) => window.api.search.query(parameters.query, maxResults, signalId),
      (signalId) => window.api.search.cancel(signalId),
      signal
    )

    return {
      query: parameters.query,
      results: results.map(result => ({
        title: result.title,
        url: result.url,
        content: this.truncateContent(this.htmlToText(result.content))
      }))
    }
  } catch (error) {
    if (error.message === 'Operation cancelled') {
      return { error: 'Search cancelled' }
    }
    return { error: error.message }
  }
}
```

### Comparison: With vs Without Helpers

**Without any helpers (raw implementation):**
```typescript
async local(parameters: anyDict, maxResults: number, signal?: AbortSignal): Promise<SearchResponse> {
  const signalId = crypto.randomUUID()

  try {
    const resultsPromise = window.api.search.query(parameters.query, maxResults, signalId)

    if (signal) {
      await Promise.race([
        resultsPromise,
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            window.api.search.cancel(signalId)
            reject(new Error('Aborted'))
          })
        })
      ])
    }

    const results = await resultsPromise
    return { query: parameters.query, results: [...] }
  } catch (error) {
    if (error.message === 'Aborted') {
      return { error: 'Search cancelled' }
    }
    return { error: error.message }
  }
}
```
**Lines: 25+**

**With Plugin.runWithAbort() only:**
```typescript
async local(parameters: anyDict, maxResults: number, signal?: AbortSignal): Promise<SearchResponse> {
  const signalId = crypto.randomUUID()

  try {
    const results = await this.runWithAbort(
      window.api.search.query(parameters.query, maxResults, signalId),
      signal,
      () => window.api.search.cancel(signalId)
    )

    return { query: parameters.query, results: [...] }
  } catch (error) {
    if (error.message === 'Operation cancelled') {
      return { error: 'Search cancelled' }
    }
    return { error: error.message }
  }
}
```
**Lines: 17** (8 lines saved, race pattern eliminated)

**With executeIpcWithAbort():**
```typescript
async local(parameters: anyDict, maxResults: number, signal?: AbortSignal): Promise<SearchResponse> {
  try {
    const results = await executeIpcWithAbort(
      this,
      (signalId) => window.api.search.query(parameters.query, maxResults, signalId),
      (signalId) => window.api.search.cancel(signalId),
      signal
    )

    return { query: parameters.query, results: [...] }
  } catch (error) {
    if (error.message === 'Operation cancelled') {
      return { error: 'Search cancelled' }
    }
    return { error: error.message }
  }
}
```
**Lines: 15** (10 lines saved, signal ID handling eliminated)

### When to Use Which Helper

| Scenario | Helper to Use |
|----------|--------------|
| Plugin using IPC (search, MCP, etc.) | `executeIpcWithAbort()` |
| Plugin using direct fetch/API | `this.runWithAbort()` |
| Non-IPC async operations | `this.runWithAbort()` |
| Multiple IPC calls in sequence | `executeIpcWithAbort()` for each |
| Custom cleanup logic | `this.runWithAbort()` with onAbort callback |

## Initial Solutions

### Solution 1: Update Generator to Use AbortController (Foundation)

**Priority:** MUST DO FIRST - This is the foundation for everything else

**Changes:**

**File: src/services/generator.ts**
```typescript
export default class Generator {
  config: Configuration
  abortController: AbortController | null  // Replace stopGeneration flag
  stream: AsyncIterable<LlmChunk>|null
  llm: LlmEngine|null

  constructor(config: Configuration) {
    this.config = config
    this.stream = null
    this.abortController = null  // Initialize
    this.llm = null
  }

  async generate(llm: LlmEngine, messages: Message[], opts: GenerationOpts, llmCallback?: LlmChunkCallback): Promise<GenerationResult> {

    // Create abort controller for this generation
    this.abortController = new AbortController()

    try {
      if (opts.streaming === false) {
        // Pass abort signal to complete
        const llmResponse: LlmResponse = await llm.complete(model, conversation, {
          visionFallbackModel: visionModel,
          usage: true,
          abortSignal: this.abortController.signal,  // ADD THIS
          ...opts
        })
        // ... rest
      } else {
        // Pass abort signal to generate
        this.stream = llm.generate(model, conversation, {
          visionFallbackModel: visionModel,
          usage: true,
          abortSignal: this.abortController.signal,  // ADD THIS
          ...opts
        })

        // Remove manual stopGeneration check - engine handles it
        for await (const msg of this.stream) {
          // Engine will stop if signal aborted
          if (msg.type === 'usage') {
            response.usage = msg.usage
          } else if (msg.type === 'tool') {
            // ... rest
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // Handle abort gracefully
        llmCallback?.call(null, { type: 'content', text: null, done: true })
        return 'stopped'
      }
      // ... rest of error handling
    } finally {
      this.abortController = null
    }
  }

  async stop() {
    // New approach: abort the signal
    this.abortController?.abort()
  }
}
```

**Benefits:**
- Aligns with multi-llm-ts design
- Removes deprecated method usage
- AbortSignal automatically propagates to plugins through context (once we add it)

### Solution 2: Add AbortSignal to Plugin Context (Multi-LLM-TS)

**Priority:** Required before plugins can check for cancellation

**File: ~/src/nbonamy/multi-llm-ts/src/types/plugin.ts**
```typescript
export type PluginExecutionContext = {
  model: string
  abortSignal?: AbortSignal  // ADD THIS
}
```

**File: ~/src/nbonamy/multi-llm-ts/src/engine.ts (callTool method)**
```typescript
protected async *callTool(context: PluginExecutionContext, tool: string, args: any): AsyncGenerator<PluginExecutionUpdate> {

  // get the plugin
  let payload = args
  let toolOwner = this.plugins.find((plugin) => plugin.getName() === tool)
  // ... multi-tool handling ...

  // check
  if (!toolOwner) {
    yield { type: 'result', result: { error: `Tool ${tool} does not exist.` } }
    return
  }

  // Check abort before calling tool
  if (context.abortSignal?.aborted) {
    yield { type: 'result', result: { error: 'Operation cancelled' } }
    return
  }

  // now we can run depending on plugin implementation
  if ('executeWithUpdates' in toolOwner) {
    for await (const update of toolOwner.executeWithUpdates!(context, payload)) {  // Pass context with signal
      if (context.abortSignal?.aborted) {
        yield { type: 'result', result: { error: 'Operation cancelled' } }
        return
      }
      yield update
    }
  } else {
    const result = await toolOwner.execute(context, payload)
    yield { type: 'result', result: result }
  }
}
```

**Note:** Need to find where context is created and ensure it includes the abortSignal from opts.

### Solution 3: Make Search Plugin Abortable (Renderer Side)

**Priority:** High - demonstrates the pattern for other plugins

**File: src/plugins/search.ts**
```typescript
async execute(context: PluginExecutionContext, parameters: anyDict): Promise<SearchResponse> {

  // Check before starting
  if (context.abortSignal?.aborted) {
    return { error: 'Cancelled' }
  }

  const maxResults = parameters.maxResults || this.config.maxResults || 5

  if (this.config.engine === 'local') {
    return this.local(parameters, maxResults, context.abortSignal)
  } else if (this.config.engine === 'brave') {
    return this.brave(parameters, maxResults, context.abortSignal)
  }
  // ... etc
}

async local(parameters: anyDict, maxResults: number, signal?: AbortSignal): Promise<SearchResponse> {

  // Generate unique signal ID for IPC
  const signalId = crypto.randomUUID()

  try {
    // Start the search with signal ID
    const resultsPromise = window.api.search.query(parameters.query, maxResults, signalId)

    // Race between results and abort signal
    if (signal) {
      await Promise.race([
        resultsPromise,
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            window.api.search.cancel(signalId)
            reject(new Error('Aborted'))
          })
        })
      ])
    }

    const results = await resultsPromise
    return {
      query: parameters.query,
      results: results.map(result => ({
        title: result.title,
        url: result.url,
        content: this.truncateContent(this.htmlToText(result.content))
      }))
    }
  } catch (error) {
    if (error.message === 'Aborted') {
      return { error: 'Search cancelled' }
    }
    return { error: error.message }
  }
}

async brave(parameters: anyDict, maxResults: number, signal?: AbortSignal): Promise<SearchResponse> {
  try {
    const baseUrl = 'https://api.search.brave.com/res/v1/web/search'
    const response = await fetch(`${baseUrl}?q=${encodeURIComponent(parameters.query)}&count=${maxResults}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': this.config.braveApiKey
      },
      signal  // Pass abort signal to fetch
    })

    const data = await response.json()

    // Fetch content for each result
    for (const result of data.web.results) {
      if (signal?.aborted) {
        return { error: 'Search cancelled' }
      }
      const html = await fetch(result.url, { signal }).then(response => response.text())
      result.content = this.htmlToText(html)
    }

    return {
      query: parameters.query,
      results: data.web.results.map((result: any) => ({
        url: result.url,
        title: result.title,
        content: result.content
      }))
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { error: 'Search cancelled' }
    }
    return { error: error.message }
  }
}

// Similar updates for exa, perplexity, tavily methods...
```

### Solution 4: Update IPC Layer for Search Cancellation

**Priority:** High - required for local search abort

**File: src/ipc_consts.ts**
```typescript
export const SEARCH = {
  QUERY: 'search-query',
  TEST: 'search-test',
  CANCEL: 'search-cancel',  // ADD THIS
} as const;
```

**File: src/preload.ts**
```typescript
search: {
  query: (query: string, num: number = 5, signalId?: string): Promise<LocalSearchResult[]> => {
    return ipcRenderer.invoke(IPC.SEARCH.QUERY, { query, num, signalId })
  },
  test: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC.SEARCH.TEST)
  },
  cancel: (signalId: string): void => {  // ADD THIS
    ipcRenderer.send(IPC.SEARCH.CANCEL, signalId)
  },
},
```

**File: src/main/ipc.ts**
```typescript
// Store active searches
const activeSearches = new Map<string, LocalSearch>()

ipcMain.handle(IPC.SEARCH.QUERY, async (_, payload) => {
  const { query, num, signalId } = payload;
  const localSearch = new LocalSearch();

  // Track if signal ID provided
  if (signalId) {
    activeSearches.set(signalId, localSearch)
  }

  try {
    const results = await localSearch.search(query, num, false, signalId);
    return results;
  } finally {
    // Cleanup
    if (signalId) {
      activeSearches.delete(signalId)
    }
  }
});

ipcMain.on(IPC.SEARCH.CANCEL, (_, signalId) => {
  const localSearch = activeSearches.get(signalId)
  if (localSearch) {
    localSearch.cancel(signalId)
    activeSearches.delete(signalId)
  }
});
```

### Solution 5: Update LocalSearch (Main Process)

**Priority:** High - implements actual cancellation logic

**File: src/main/search.ts** (see detailed code in previous response)

Key changes:
1. Add `activeSearches: Map<string, AbortController> = new Map()`
2. Update `search()` to accept optional `signalId` parameter
3. Create AbortController if signalId provided
4. Check `abortController?.signal.aborted` at key points:
   - Before processing Google results
   - In loop iterating through results
   - Before fetching each page content
5. Pass `abortSignal` to `getContents()` method
6. Update `getContents()` to accept and check `abortSignal`
7. Add abort event listeners to close windows and reject promises
8. Clean up Map entries on completion or abort
9. Add `cancel(signalId: string)` method to trigger abort

### Solution 6: Update Other Plugins

**Priority:** Medium - apply same pattern

**Plugins to update:**
- **browse.ts** - Add signal parameter, pass to fetch calls
- **filesystem.ts** - Check signal before file operations
- **python.ts** - Check signal before/after execution
- **computer.ts** - Check signal during automation
- **mcp.ts** - Pass signal to MCP tool calls

**Pattern for each:**
```typescript
async execute(context: PluginExecutionContext, parameters: anyDict): Promise<any> {
  if (context.abortSignal?.aborted) {
    return { error: 'Operation cancelled' }
  }

  // For operations with fetch
  const response = await fetch(url, {
    signal: context.abortSignal
  })

  // For loops or long operations
  for (const item of items) {
    if (context.abortSignal?.aborted) {
      return { error: 'Operation cancelled' }
    }
    // process item
  }

  // For IPC calls (if needed)
  // Use signal ID pattern like search plugin
}
```

## MCP SDK Abort Support

**Good News:** The MCP SDK already supports abort signals!

### SDK RequestOptions Interface

From `@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts`:

```typescript
export type RequestOptions = {
  /**
   * Can be used to cancel an in-flight request.
   * This will cause an AbortError to be raised from request().
   */
  signal?: AbortSignal;

  /**
   * A timeout (in milliseconds) for this request.
   * If exceeded, an McpError with code `RequestTimeout` will be raised.
   */
  timeout?: number;

  /**
   * If true, receiving a progress notification will reset the request timeout.
   */
  resetTimeoutOnProgress?: boolean;

  // ... other options
}
```

### Client.callTool Signature

```typescript
callTool(
  params: CallToolRequest['params'],
  resultSchema?: typeof CallToolResultSchema,
  options?: RequestOptions
): Promise<CallToolResult>
```

The `options` parameter accepts `RequestOptions` which includes the `signal` field!

### Solution for MCP Plugin

**File: src/main/mcp.ts**
```typescript
callTool = async (name: string, args: anyDict, signal?: AbortSignal): Promise<any> => {

  const client = this.clients.find(client => client.tools.includes(name))
  if (!client) {
    throw new Error(`Tool ${name} not found`)
  }

  // remove unique suffix
  const tool = this.originalToolName(name)
  console.log('Calling MCP tool', tool, args)

  // Pass abort signal to MCP SDK via options parameter
  return await client.client.callTool({
    name: tool,
    arguments: args
  }, CompatibilityCallToolResultSchema, {
    signal  // MCP SDK will handle cancellation internally!
  })

}
```

**File: src/main/ipc.ts**
```typescript
// Track active MCP calls
const activeMcpCalls = new Map<string, boolean>()

ipcMain.handle(IPC.MCP.CALL_TOOL, async (_, payload) => {
  const { name, parameters, signalId } = payload

  // Track if signal ID provided
  if (signalId) {
    activeMcpCalls.set(signalId, true)
  }

  try {
    // Get signal from map or undefined
    const abortController = signalId ? new AbortController() : undefined
    if (signalId && abortController) {
      // Store controller so we can abort later
      activeMcpCalls.set(signalId, abortController)
    }

    const result = await mcp?.callTool(name, parameters, abortController?.signal)
    return result
  } finally {
    if (signalId) {
      activeMcpCalls.delete(signalId)
    }
  }
});

ipcMain.on(IPC.MCP.CANCEL_TOOL, (_, signalId) => {
  const controller = activeMcpCalls.get(signalId)
  if (controller && controller instanceof AbortController) {
    controller.abort()
    activeMcpCalls.delete(signalId)
  }
});
```

**File: src/plugins/mcp.ts**
```typescript
async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {

  // Check if cancelled
  if (context.abortSignal?.aborted) {
    return { error: 'Operation cancelled' }
  }

  // avoid unauthorized call
  if (!this.handlesTool(parameters.tool)) {
    return { error: `Tool ${parameters.tool} is not handled by this plugin or has been disabled` }
  }

  try {
    // Generate signal ID for IPC
    const signalId = crypto.randomUUID()

    // Start the call
    const callPromise = window.api.mcp.callTool(parameters.tool, parameters.parameters, signalId)

    // Race with abort signal if provided
    if (context.abortSignal) {
      await Promise.race([
        callPromise,
        new Promise((_, reject) => {
          context.abortSignal.addEventListener('abort', () => {
            window.api.mcp.cancelTool(signalId)
            reject(new Error('Aborted'))
          })
        })
      ])
    }

    const result = await callPromise

    if (Array.isArray(result.content) && result.content.length == 1 && result.content[0].text) {
      return { result: result.content[0].text }
    } else {
      return result
    }
  } catch (error) {
    if (error.message === 'Aborted') {
      return { error: 'Tool call cancelled' }
    }
    console.error(error)
    return { error: error.message }
  }
}
```

**File: src/ipc_consts.ts**
```typescript
export const MCP = {
  // ... existing constants ...
  CALL_TOOL: 'mcp-call-tool',
  CANCEL_TOOL: 'mcp-cancel-tool',  // ADD THIS
  // ...
} as const;
```

**File: src/preload.ts**
```typescript
mcp: {
  // ... existing methods ...
  callTool: (name: string, parameters: anyDict, signalId?: string): Promise<any> => {
    return ipcRenderer.invoke(IPC.MCP.CALL_TOOL, { name, parameters, signalId })
  },
  cancelTool: (signalId: string): void => {  // ADD THIS
    ipcRenderer.send(IPC.MCP.CANCEL_TOOL, signalId)
  },
  // ...
}
```

### Benefits

1. **Native SDK Support** - MCP SDK handles abort internally, no need to poll or manually cancel
2. **Clean Implementation** - Just pass signal through options parameter
3. **Error Handling** - SDK raises `AbortError` which we can catch and handle
4. **Same Pattern** - Uses same IPC signal ID proxy pattern as search plugin

## Implementation Order

### Phase 1: Foundation (multi-llm-ts)

1. ✅ **Add Plugin.runWithAbort() to multi-llm-ts** - Generic helper for race pattern
2. ✅ **Update PluginExecutionContext** - Add abortSignal field
3. ✅ **Update LlmEngine.callTool()** - Pass signal to plugins via context

### Phase 2: Generator/Assistant (Witsy)

4. ✅ **Update Generator class** - Use AbortController instead of stopGeneration flag
5. ✅ **Update Assistant class** - Pass abort through to deepResearch
6. ✅ **Remove deprecated stop() calls** - Use abortController.abort() instead

### Phase 3: IPC Infrastructure (Witsy)

7. ✅ **Create ipc_abort_helper.ts** - Witsy IPC-specific helper utility
8. ✅ **Update Search IPC layer** - Add cancel support, track active searches
9. ✅ **Update MCP IPC layer** - Add cancel support, track active calls
10. ✅ **Update preload.ts** - Add cancel methods for search and MCP
11. ✅ **Update ipc_consts.ts** - Add SEARCH.CANCEL and MCP.CANCEL_TOOL

### Phase 4: Main Process Implementations (Witsy)

12. ✅ **Update LocalSearch (main)** - Accept signalId, implement cancellation logic
13. ✅ **Update Mcp.callTool (main)** - Accept signal, pass to SDK

### Phase 5: Plugin Implementations (Witsy)

14. ✅ **Update Search Plugin** - Use executeIpcWithAbort() for all methods
15. ✅ **Update MCP Plugin** - Use executeIpcWithAbort() for tool calls
16. 🔄 **Update Browse Plugin** - Use runWithAbort() for fetch calls
17. 🔄 **Update Filesystem Plugin** - Check signal before file operations
18. 🔄 **Update Image/Video Plugins** - Use runWithAbort() or executeIpcWithAbort()
19. 🔄 **Update Python Plugin** - Check signal before/after execution
20. 🔄 **Update other plugins** - Computer, Memory, YouTube, Vega, etc.

### Phase 6: Testing & Cleanup

21. 🔄 **Unit tests** - Test helpers in isolation
22. 🔄 **Integration tests** - Test abort across IPC boundary
23. 🔄 **Manual testing** - Verify cancellation in real scenarios
24. 🔄 **Documentation** - Update README/docs if needed

### Quick Reference: What Each Component Does

| Component | Responsibility |
|-----------|---------------|
| `Plugin.runWithAbort()` | Generic Promise racing (multi-llm-ts) |
| `executeIpcWithAbort()` | IPC signal ID management (Witsy) |
| `Generator.abortController` | Top-level cancellation control |
| `LlmEngine.callTool()` | Passes signal to plugin context |
| `PluginExecutionContext.abortSignal` | Signal available to all plugins |
| IPC handlers (main) | Track active operations, respond to cancel |
| `LocalSearch.cancel()` | Abort browser automation |
| MCP SDK options | Pass signal to MCP tool calls |

## Testing Strategy

1. **Unit Tests:**
   - Test abort during search (before results, during results, during content fetch)
   - Test abort during other plugin operations
   - Test cleanup of resources (Map entries, browser windows)

2. **Integration Tests:**
   - Test abort during LLM generation with plugin calls
   - Test multiple concurrent operations with selective cancellation
   - Test abort across IPC boundary

3. **Manual Testing:**
   - Start long search operation, cancel mid-way
   - Verify browser windows close
   - Verify no memory leaks (Map cleanup)
   - Verify error messages to user are appropriate

## Notes and Considerations

1. **Backward Compatibility:** The `abortSignal` field is optional in context, so plugins that don't check it will continue to work (but won't be cancellable)

2. **Error Handling:** Need to distinguish between cancellation (expected) and actual errors

3. **Resource Cleanup:** Critical to clean up Map entries and close browser windows to prevent memory leaks

4. **Race Conditions:** Need to handle cases where operation completes just as cancel is called

5. **User Feedback:** Should show appropriate message when operation is cancelled vs failed

6. **Multiple Signals:** Each generation gets its own AbortController, so multiple concurrent chats can be cancelled independently

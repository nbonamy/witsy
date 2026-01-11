# Realtime Chat Tool Integration

## Goal

Rewrite RealtimeChat.vue to enable tool usage following the [OpenAI Agents JS quickstart guide](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/).

## Current Architecture

- **Direct WebRTC**: RealtimeChat.vue currently establishes a direct WebRTC peer connection to OpenAI's realtime API
- **Manual session management**: Handles audio streams, data channels, and event parsing manually
- **No tool support**: Cannot execute tools/plugins during realtime conversations
- **Cost tracking**: Tracks tokens and estimates costs based on usage events

## Target Architecture

- **OpenAI Agents SDK**: Use `RealtimeAgent` and `RealtimeSession` from `@openai/agents`
- **Tool integration**: Convert Witsy's plugin system to OpenAI agent tools format
- **Unified patterns**: Leverage existing plugin architecture (search, browse, filesystem, python, etc.)
- **Maintain features**: Keep cost tracking, voice selection, model selection

## Implementation Strategy

### Phase 1: Setup and Dependencies

**1.1 Install required packages**
- Install `@openai/agents` package (requires `zod@3` which is already installed)
- Test imports to verify package structure

**1.2 Understand package structure**
- Explore `@openai/agents` exports
- Verify `RealtimeAgent`, `RealtimeSession`, and `tool` APIs
- Check if separate packages needed (`@openai/agents-realtime`, `@openai/agents-openai`)

**Commit**: `chore: add openai agents sdk dependency`

### Phase 2: Create Tool Adapter Layer

**Note**: multi-llm-ts already converts Witsy plugins to OpenAI API format via `engine.getAvailableTools()`. We need to adapt from OpenAI API format to OpenAI Agents SDK format (which uses Zod schemas and the `tool()` helper).

**2.1 Create tool conversion utilities**
- Create `src/renderer/services/realtime_tools.ts`
- Implement function to convert OpenAI API tool format to OpenAI Agents SDK format:
  ```typescript
  // Input: OpenAI API format from multi-llm-ts
  // { type: 'function', function: { name, description, parameters } }

  // Output: OpenAI Agents SDK format
  // tool({ name, description, parameters: zodSchema, execute: async (input) => {} })
  ```
- Convert JSON Schema parameters to Zod schemas using `jsonSchemaToZod()`
- Wire up `execute` to call the plugin's `execute()` method
- Handle both single-tool and multi-tool plugins

**2.2 Implement tool builder**
- Use `LlmEngine.getAvailableTools()` from multi-llm-ts to get OpenAI API format tools
- Convert each to OpenAI Agents SDK format
- Return array of tools ready for RealtimeAgent
- Respect plugin enabled state from configuration

**2.3 Add unit tests**
- Test OpenAI API → OpenAI Agents SDK conversion
- Test Zod schema generation from JSON Schema
- Mock plugin execution through the adapter

**Commit**: `feat: add realtime tool adapter layer`

### Phase 3: Refactor RealtimeChat.vue Core

**3.1 Replace WebRTC with RealtimeAgent**
- Remove direct RTCPeerConnection code (lines 178-263)
- Replace with RealtimeAgent initialization:
  ```typescript
  import { RealtimeAgent, RealtimeSession } from '@openai/agents'

  const agent = new RealtimeAgent({
    name: 'Witsy Realtime Assistant',
    instructions: 'You are a helpful assistant...',
    model: model.value,
    voice: voice.value,
    tools: [...tools]
  })

  const session = new RealtimeSession({ agent })
  ```

**3.2 Update session lifecycle**
- Replace `startSession()` to use RealtimeSession API
- Replace `stopSession()` to properly close RealtimeSession
- Handle microphone permissions and audio stream

**3.3 Event handling**
- Replace manual data channel event parsing with RealtimeSession event handlers
- Map SDK events to existing UI updates (blob animation, transcripts, etc.)

**Commit**: `refactor: migrate to openai agents sdk`

### Phase 4: Cost Tracking Integration

**4.1 Hook into usage events**
- Find equivalent events in RealtimeSession for token usage
- Update `sessionTotals` ref when usage events fire
- Maintain existing `calculateCosts()` logic

**4.2 Test cost calculations**
- Verify token counts match
- Ensure cost display updates correctly

**Commit**: `feat: integrate cost tracking with agent sdk`

### Phase 5: Tool Execution Handling

**5.1 Wire up tool execution**
- Ensure tools execute when called by the agent
- Handle async tool execution
- Pass abort signals through to plugins

**5.2 Add execution feedback**
- Show visual indicator when tools are running (similar to chat UI)
- Display tool results appropriately
- Handle tool errors gracefully

**5.3 Test with each plugin type**
- Search plugin
- Browse plugin
- Filesystem plugin
- Python plugin
- Other enabled plugins

**Commit**: `feat: enable tool execution in realtime chat`

### Phase 6: Configuration and UI

**6.1 Add tool selection UI**
- Add checkbox/toggle section to sidebar for enabling/disabling tools
- Use existing plugin configuration as defaults
- Save tool preferences to `store.config.realtime.tools`

**6.2 Update configuration types**
- Extend `RealtimeConfig` type to include tool selection
- Update default configuration

**6.3 Test UI interactions**
- Verify tool toggles work
- Ensure settings persist

**Commit**: `feat: add tool selection ui to realtime chat`

### Phase 7: Testing and Polish

**7.1 Update unit tests**
- Update RealtimeChat.vue test file
- Mock RealtimeAgent and RealtimeSession
- Test tool integration

**7.2 Manual testing**
- Test with different models
- Test with different voice options
- Test tool calling (e.g., "search the web for...")
- Verify cost tracking accuracy

**7.3 Error handling**
- Handle SDK errors gracefully
- Show user-friendly error messages
- Test edge cases (no API key, network errors, etc.)

**7.4 Lint and cleanup**
- Run `npm run lint` and fix any issues
- Remove unused code and comments
- Update localization strings if needed

**Commit**: `test: update realtime chat tests for agent sdk`

## Testing Strategy

- **Unit tests**: Test tool adapter, plugin conversion, cost calculations
- **Integration tests**: Test RealtimeChat.vue with mocked SDK
- **Manual testing**: Full end-to-end testing with live API
- **Run tests after each phase**: `npm run test:ai -- realtime`

## Rollback Plan

If issues arise, we can:
1. Keep the old implementation in a branch
2. Add feature flag to toggle between old/new implementation
3. Revert commits in reverse order

## Key Design Decisions

**Why RealtimeAgent over direct WebRTC?**
- Abstracts complexity of WebRTC
- Built-in tool support
- Better error handling
- Maintained by OpenAI

**Why adapt plugins instead of rewriting?**
- Plugins already work well in chat
- Reuse existing implementation
- Maintain consistency across features

**How to handle plugin execution context?**
- Create minimal PluginExecutionContext for realtime
- Provide abort signals for cancellation
- Use existing plugin error handling

## Success Criteria

- [ ] RealtimeChat.vue uses OpenAI Agents SDK
- [ ] Tools can be selected and enabled/disabled
- [ ] Plugins execute correctly when called by agent
- [ ] Cost tracking continues to work
- [ ] All existing features preserved (voice, model selection, etc.)
- [ ] Unit tests passing
- [ ] No linting errors
- [ ] Manual testing successful

## Resources

- [OpenAI Agents JS Documentation](https://openai.github.io/openai-agents-js/)
- [Voice Agents Quickstart](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/)
- [GitHub Repository](https://github.com/openai/openai-agents-js)
- [NPM Package](https://www.npmjs.com/package/@openai/agents)
- [Tools Guide](https://openai.github.io/openai-agents-js/guides/tools/)

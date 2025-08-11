# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Witsy is a cross-platform desktop AI assistant built with Electron, Vue.js, and TypeScript. It serves as a universal MCP (Model Context Protocol) client that supports multiple AI providers and features like chat completion, text-to-image generation, voice capabilities, automation tools, and document analysis with RAG (Retrieval-Augmented Generation).

## Development Commands

### Build and Development
```bash
npm install              # Install dependencies
npm start               # Start development with hot reload (DEBUG=1 flag)
npm run package         # Package the application
npm run make            # Build distributables for current platform
npm run publish         # Publish to GitHub releases
```

### Testing
```bash
npm test               # Run unit tests with Vitest
npm run test-ci        # Run tests with coverage for CI
npm run testui         # Run tests with UI and coverage
npm run teste2e        # Run end-to-end tests with Playwright
```

### Code Quality
```bash
npm run lint           # Run ESLint and TypeScript checks
npm run credits        # Generate credits file
```

## Architecture Overview

### Electron Architecture
- **Main Process** (`src/main.ts`): Controls application lifecycle, window management, system integrations
- **Renderer Process** (`src/renderer.ts`): Vue.js application for UI
- **Preload Script** (`src/preload.ts`): Secure bridge between main and renderer processes using contextBridge

### Core Systems

#### LLM Integration (`src/llms/`)
- Abstraction layer supporting multiple AI providers (OpenAI, Anthropic, Google, Ollama, etc.)
- `LlmManager` handles provider selection and request routing
- Supports streaming, function calling, and tool usage
- Uses `multi-llm-ts` library for provider abstraction

#### Plugin System (`src/plugins/`)
- Modular tools that extend LLM capabilities
- Available plugins: search, browse, image, video, python, memory, filesystem, MCP, youtube
- Each plugin implements the `Plugin` base class or uses `CustomToolPlugin`

#### MCP (Model Context Protocol) (`src/main/mcp.ts`)
- Universal client for MCP servers
- Allows any LLM to use MCP tools
- Server management and tool discovery

#### Document Repository/RAG (`src/rag/`)
- Local document ingestion and vector storage using Vectra
- Embedding support via OpenAI or Ollama
- Document monitoring with Chokidar for auto-updates
- Text splitters for various document formats

#### Automation System (`src/automations/`)
- Cross-platform automation capabilities
- Prompt Anywhere: Generate text in any application
- AI Commands: Quick text processing shortcuts
- Platform-specific implementations (macOS/Windows/Linux)

#### Memory Management (`src/main/memory.ts`)
- Long-term conversation memory using embeddings
- Fact storage and retrieval for contextual responses

#### Agent System (`src/agent/`)
- Multi-step AI workflows with scheduling
- Goal-based task execution
- Run history and management

### UI Components (`src/components/` and `src/screens/`)
- Vue 3 with Composition API
- Component-based architecture with reusable UI elements
- Main screens: Chat, Settings, Scratchpad, Agent Forge, Design Studio
- Responsive design with CSS variables and themes

### Configuration System (`src/main/config.ts`)
- JSON-based settings with schema validation
- Hot-reloading configuration changes
- Per-engine/model defaults support

### Window Management (`src/main/window.ts`)
- Multiple window types with specific purposes
- Preloading for performance optimization
- Cross-platform window positioning and state management

### Services (`src/services/`)
- Shared business logic across the application
- i18n internationalization support
- Store management for persistent data

## Key File Locations

- **Main entry points**: `src/main.ts`, `src/renderer.ts`, `src/preload.ts`
- **Vue app root**: `src/App.vue`
- **Type definitions**: `src/types/`
- **IPC constants**: `src/ipc_consts.ts`
- **Build configuration**: `forge.config.ts`, `vite.*.config.ts`
- **Test configuration**: `vitest.config.mjs`, `vitest.setup.ts`

## Development Notes

### Testing Strategy
- Unit tests use Vitest with jsdom environment
- Component tests use Vue Test Utils
- E2E tests use Playwright
- Coverage excludes platform-specific and generated code

### Platform Considerations
- macOS: App Store (MAS) and standard distribution builds
- Windows: Portable executable generation
- Linux: AppImage, Deb, RPM packages
- Code signing and notarization for macOS/Windows

### Security
- Context isolation enabled in Electron
- Secure IPC communication patterns
- Sandboxed renderer process
- Careful handling of user credentials and API keys

### Performance
- Window preloading for common dialogs
- Lazy loading of heavy components
- Streaming responses for LLM interactions
- Efficient vector operations for RAG

When working with this codebase, pay attention to the IPC communication patterns, the plugin architecture for extending functionality, and the multi-platform considerations for automation features.
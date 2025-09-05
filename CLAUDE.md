# Witsy AI Assistant - Developer Guide

## Project Overview

Witsy is a cross-platform Electron-based desktop AI assistant that serves as a universal MCP (Model Context Protocol) client. Built with Electron, TypeScript, Vue 3, and Vite, it integrates multiple LLM providers and supports features like chat completion, image generation, speech-to-text, text-to-speech, document search (RAG), and automation capabilities.

## Architecture & Key Components

### Core Structure
- **Main Process** (`src/main/`): Electron main process handling system integration, IPC, and native APIs
- **Renderer Process** (`src/`): Vue 3 frontend with Vite bundling 
- **Preload Scripts** (`src/preload.ts`): Secure IPC bridge between main and renderer
- **LLM Integration** (`src/llms/`): Multi-provider LLM abstraction layer using `multi-llm-ts`
- **Plugin System** (`src/plugins/`): Extensible tools for search, filesystem, python execution, etc.
- **Automation** (`src/automations/`): Cross-platform automation for "Prompt Anywhere" and AI commands

### Build System (Electron Forge + Vite)
- **Development**: `npm start` - runs with hot reload
- **Testing**: `npm test` (Vitest unit tests), `npm run test:e2e` (E2E tests)
- **Building**: `make mac-arm64`, `make win-x64`, etc. - platform-specific builds via Makefile
- **Configuration**: `forge.config.ts` handles Electron Forge setup, Vite configs handle bundling

## Development Workflows

In all cases, implementation should be done in small increments: code, lint, test. Always break down tasks into small, manageable pieces. This allows for easier debugging and testing, and ensures that the codebase remains stable. At the end of each task, ensure that the code is properly tested and linted before moving on to the next task. Confirm with the user that the task is complete and that they are satisfied with the implementation and that you can move on to the next task.

Tests should be written or updated as soon as possible and kept passing before moving on to the next task. This ensures that the codebase remains stable and maintainable. Always assume when starting a new feature, that the code is already in a good state and that all existing tests are passing. Be mindful of that when fixing non-passing tests.

Linting can be done with `npm run lint`, which will also check for Vue type errors. It is mandatory to run this command before running tests to ensure code quality. When this command produces no output, it means that the code is properly formatted and does not contain any linting errors.

Tests can be run using `npm test -- --run` followed by the test name or path. Don't forget the `-- --run` flags to execute the tests, otherwise the test runner will not stop and wait for user input.

Never run end-to-end tests during your process.
Never try to build the application during your process.
Never try to run the application during your process.

## Key Patterns & Conventions

### State Management

In the renderer process, the state is managed through the store object: 

```typescript
import { store } from '../services/store'
```

This store is a Vue 3 reactive object that holds the application state, including user preferences, conversation history and other relevant data.

### Configuration Management
```typescript
// Centralized config in src/types/config.ts with backwards compatibility
export type Configuration = {
  engines: Record<string, EngineConfig>, // LLM provider configs
  plugins: Record<string, PluginConfig>, // Plugin settings
  // ... other sections
}
```

### IPC Communication
```typescript
// Organized constants in src/ipc_consts.ts
export const CHAT = {
  STREAM: 'chat-stream',
  CANCEL: 'chat-cancel'
} as const
// Main process handlers in src/main/ipc.ts
// Preload exposures in src/preload.ts
```


### Testing Patterns
- **Unit Tests**: `tests/unit/` using Vitest + Vue Test Utils
- **Mocking**: LLM providers mocked in tests via `LlmMock` class
- **Coverage**: Excludes platform-specific automation code and vendor files
- **E2E Tests**: `tests/e2e/` using Playwright

When writing tests, prioritize testing user interactions by triggering HTML events and then checking state updates, whether on the UI itself or updats to store. As much possible avoid injecting data in Vue `vm` and call methods on it. We want to test as if the user is interacting with the application, so prefer using `trigger` or `setValue` to simulate user actions.

Never use simulated `wait` statements using an "await Promise" pattern. In most cases awaiting `nextTick` should be sufficient to ensure the UI is updated before assertions. If really needed you can use `vi.waitFor` or `vi.waitUntil` to wait for a specific condition, but this should be avoided unless absolutely necessary and always using a reasonable timeout.


All the IPC methods are mocked in `tests/mocks/window.ts`. In most cases, if you need to test IPC calls, you should

```typescript
import { useWindowMock } from '../mocks/window
```

and use the `windowMock` in `beforeAll` (or maybe `beforeEach`).

### Localization

Witsy is localized using `vue-i18n`. All translations are stored in `./locales/*.json` and can be added or modified as needed. The main language is English, and other languages can be added by creating new JSON files in the locales directory. Only add translation for English when creating a new feature. If asked to add translations for other languages you can run `./tools/i18n_check.ts --fix` but never run this based on your own initiative.

### CSS Variables

All the CSS variables are defined in `./css/index.css`. Use those variables and only those variables. Do not come up with new variables or use hardcoded values. If you need to add a new variable, please discuss it with the team first.

## Common Tasks

### Running Tests
```bash
npm test                   # Unit tests
npm run test:ci            # With coverage
```

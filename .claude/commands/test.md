# Add or Update Tests

Make sure you have added or updated tests for any new functionality or bug fixes in the codebase.

Review existing tests before blindly adding new ones to avoid duplication.

Make sure to run all tests and ensure they pass before submitting your changes.

## Running Tests

```bash
npm run test:ai -- <test-name-or-path>
```

Or run all tests:
```bash
npm run test:ai
```

## Test Structure

- **Main process tests**: `tests/unit/main/`
- **Renderer component tests**: `tests/unit/renderer/components/`
- **Renderer view tests**: `tests/unit/renderer/views/`
- **Renderer service tests**: `tests/unit/renderer/services/`
- **CLI tests**: `tests/unit/cli/`

## Testing Guidelines

1. **Test user interactions** - Trigger HTML events and check state updates
2. **Avoid direct method calls** - Don't inject data in Vue `vm` and call methods
3. **Simulate user actions** - Use `trigger` or `setValue`
4. **Avoid arbitrary waits** - Use `await nextTick()` instead of Promise-based delays
5. **Use vi.waitFor sparingly** - Only when absolutely necessary with reasonable timeout

## Mocking

- IPC methods are mocked in `tests/mocks/window.ts`
- Use `useWindowMock` in `beforeAll` or `beforeEach`:

```typescript
import { useWindowMock } from '@tests/mocks/window'

beforeAll(() => {
  useWindowMock()
})
```

## Coverage Analysis

To identify files with the most uncovered lines:

```bash
node tools/coverage_gaps.js                          # Top 20 files
node tools/coverage_gaps.js --limit 10               # Top 10 files
node tools/coverage_gaps.js --filter src/renderer    # Filter to directory
node tools/coverage_gaps.js --show-lines             # Show uncovered lines
```

## Important

- **Never** run E2E tests (`tests/e2e/`) during your process
- Always run linting before tests: `npm run lint`

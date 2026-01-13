# Definition of Done (DoD)

Before considering a task complete, verify ALL items below pass. This is a quality gate - do not skip any step.

## 1. Code Quality

Run linting and fix any issues:
```bash
npm run lint
```

This includes:
- ESLint for TypeScript
- Vue TypeScript checking
- Stylelint for CSS variables

## 2. Unit Tests

- [ ] New functionality has corresponding unit tests in `tests/unit/`
- [ ] All existing tests still pass
- [ ] Run: `npm run test:ai`

### Test Organization
- Main process tests: `tests/unit/main/`
- Renderer component tests: `tests/unit/renderer/components/`
- Renderer view tests: `tests/unit/renderer/views/`
- Service tests: `tests/unit/renderer/services/`

### Testing Guidelines
- Test user interactions by triggering HTML events
- Avoid injecting data in Vue `vm` and calling methods directly
- Use `trigger` or `setValue` to simulate user actions
- Prefer `await nextTick()` over arbitrary waits
- Use `vi.waitFor` or `vi.waitUntil` only when absolutely necessary

## 3. Internationalization

- [ ] No hardcoded user-facing strings
- [ ] New strings added to `locales/en.json`
- [ ] Run: `./tools/i18n_check.ts`

## 4. CSS Variables

- [ ] All CSS uses variables from `css/variables.css` and `css/index.css`
- [ ] No hardcoded colors, font sizes, or spacing
- [ ] Run: `npm run lint:css`

## 5. Documentation

- [ ] CLAUDE.md updated if architectural changes
- [ ] README updated if setup/usage changes

## Important Restrictions

- **Never** run E2E tests during your process
- **Never** try to build the application
- **Never** try to run the application directly
- Use the StationOne MCP server tools to verify UI rendering if needed

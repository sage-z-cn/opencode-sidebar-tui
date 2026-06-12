# Test Agent Notes

## Scope

- Unit tests use Vitest in Node, not `@vscode/test-electron`.
- `vitest.config.ts` includes `src/**/*.test.ts`, aliases `vscode` to `src/test/mocks/vscode.ts`, and sets `mockReset: true` plus `restoreMocks: true`.
- Coverage excludes `src/webview/**`; webview tests still run, they just do not count toward coverage thresholds.

## Mocks

- Use `vi.mock("vscode")` to pick up `src/test/mocks/vscode.ts`.
- Use the existing node-pty mock patterns in `src/test/mocks/node-pty.ts`; do not instantiate real PTYs in unit tests.
- `src/test/mocks/index.ts` exposes setup/reset helpers used by tests that need global mock state cleanup.
- Tests touching singletons or shared stores must reset with existing helpers such as `resetMocks()` / `resetInstance()` where available.

## Multi-Terminal Test Targets

- Command routing: `src/core/commands/terminalCommands.test.ts`.
- Host/session switching and pane session lifecycle: `src/providers/SessionRuntime.test.ts` and `TerminalProvider.test.ts`.
- Webview pane/tab behavior: `src/webview/__tests__/tab-bar.test.ts`, `pane-manager.test.ts`, `pane-message-router.test.ts`, and `layout-engine.test.ts`.
- Instance state/persistence/switching: `src/services/InstanceStore.test.ts`, `InstanceRegistry.test.ts`, `InstanceQuickPick.test.ts`, and `InstanceController.test.ts`.

## Commands

- Full unit suite: `npm run test`.
- Focused file: `npx vitest run src/path/File.test.ts`.
- Focused test name: `npx vitest run -t "test name"`.
- Coverage: `npm run test:coverage`.
- E2E is separate and uses `npm run test:e2e` after compile steps.

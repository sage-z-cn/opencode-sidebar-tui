# Providers Agent Notes

## Scope

- Providers are extension-host code that bridge VS Code webviews/actions to services.
- Current provider files are `TerminalProvider.ts`, `MessageRouter.ts`, `SessionRuntime.ts`, `CodeActionProvider.ts`, and `openFile.ts`.
- Do not assume a dashboard or multi-backend provider exists; the current tree only has the providers listed above.

## Responsibility Split

- `TerminalProvider` owns VS Code webview lifecycle, editor-tab attachment, HTML generation, pane host glue, pending webview messages, `PaneStore`, and `DataThrottleService` integration.
- `MessageRouter` dispatches normal `WebviewMessage` values: terminal input/resize, ready, drag/drop, paste/image paste, file open, external terminal list, restart/settings, and AI tool selector messages.
- `SessionRuntime` owns terminal session state: start/restart, active instance switching, per-pane sessions, HTTP client readiness, selected AI tool persistence, and listener reconnects.
- `CodeActionProvider` stays focused on diagnostic code actions and sends prompts through the provider path.

## Multi-Terminal Flow

- Default startup: webview sends `ready` for the default pane; `MessageRouter.handleReady()` starts the default session if needed.
- Non-default pane startup: `TerminalProvider` intercepts non-default `ready`, ensures `PaneStore` has that pane, calls `SessionRuntime.createSession(paneId, ...)`, then delegates resize to `MessageRouter`.
- Pane creation/deletion: `TerminalProvider` intercepts `paneCreate` / `paneDelete` before `MessageRouter`; deletion must call both `SessionRuntime.destroySession(paneId)` and `PaneStore.removePane(paneId)`.
- Instance switching: `SessionRuntime` listens to `InstanceStore.onDidSetActive`; `TerminalProvider.switchToInstance()` clears the terminal, reconnects listeners to an existing terminal, or force-restarts with the selected AI tool.
- `MessageRouter.resolveTerminalTarget()` sends default-pane input to `provider.getActiveTerminalId()` and non-default pane input directly to the `paneId` terminal key.
- `TerminalProvider.postWebviewMessage()` throttles `terminalOutput` by `paneId`; focus messages must update `DataThrottleService.setFocusedPane()` before flushing.

## Constraints

- Providers can use Node/VS Code APIs, but browser rendering and DOM behavior belong in `src/webview`.
- Any message shape used here must be declared in `src/types.ts`; no arbitrary provider-only payloads.
- Do not put process lifecycle or port allocation directly in `MessageRouter`; route through `SessionRuntime`, `TerminalManager`, and services.
- `TerminalProvider.getHtmlForWebview()` loads only `dist/webview.js` plus copied CSS assets; do not reference a dashboard bundle unless webpack is changed.

## Verification

- Provider tests are colocated: `TerminalProvider.test.ts`, `MessageRouter.test.ts`, `SessionRuntime.test.ts`, and `CodeActionProvider.test.ts`.

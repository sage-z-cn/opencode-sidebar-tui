# Webview Agent Notes

## Scope

- `src/webview` is browser-sandbox code: xterm.js rendering, tabs/panes/layout, toolbar, clipboard, drag/drop, focus, links, and host messaging through `acquireVsCodeApi()` wrappers.
- Webpack currently has one webview entry: `src/webview/main.ts`, emitted as `dist/webview.js`.
- There is only one webview entry/bundle. Do not re-add references to a second webview entry without adding a webpack entry and code.

## Multi-Terminal Flow

- `main.ts` bootstraps the default xterm, then wires `PaneManager`, `PaneMessageRouter`, `LayoutEngine`, `TabBar`, `PaneActions`, and `FocusManager`.
- `TabBar` is tab switching only: it hides panes from the previous tab and shows panes for the new tab. It must not fit hidden panes.
- `PaneManager` owns browser xterm instances by `paneId`; `showPane()` calls `fitAddon.fit()` only after the pane is visible.
- `PaneMessageRouter` injects/resolves the focused `paneId` for outbound messages and routes pane-scoped host messages back into the correct xterm.
- `FocusManager` and `TabBar` must stay in sync with `PaneMessageRouter.setFocusedPane()` so input, drag/drop, paste, and output target the intended pane.
- Pane create/delete messages are sent to the extension host; the host creates/kills the actual terminal session in `SessionRuntime`.

## Constraints

- Browser APIs only: no `fs`, `path`, `os`, child processes, or VS Code extension-host APIs.
- Host communication must use `WebviewMessage` / `HostMessage` from `src/types.ts`.
- Keep data shaping in providers/services; webview code should route UI events and render current state.
- Preserve xterm timing: fit after fonts are ready and after panes become visible; avoid fitting hidden DOM nodes.
- WebGL is capped in `PaneManager` and falls back to canvas; do not assume every pane has WebGL.

## Where To Look

- Terminal bootstrap: `main.ts` and `terminal/index.ts`.
- xterm instances and drag/drop target resolution: `pane-manager.ts`.
- Pane-scoped message routing: `pane-message-router.ts`.
- Splits/layout DOM: `layout/layout-engine.ts`.
- Tab switching: `tab-bar/tab-bar.ts`.
- Pane controls: `pane-actions/pane-actions.ts`.
- Toolbar/pill UI: `toolbar/` and `ai-tool-selector.ts`.

## Verification

- Webview unit tests live under `src/webview/__tests__` and adjacent `*.test.ts` files, but `src/webview/**` is excluded from coverage thresholds.

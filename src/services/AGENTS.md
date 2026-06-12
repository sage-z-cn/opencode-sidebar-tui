# Services Agent Notes

## Scope

- `src/services` is the stateful backend: instance store/persistence/discovery/control, HTTP client, ports, native terminal backend plans, pane state, throttling, AI tool operators, context/file references, logging, and output capture.
- The only backend type is `"native"`. There are no external multiplexer managers, pane sync services, or dashboard services in the current tree.

## Instance Layer

- `InstanceStore` is the in-memory source of truth for instance records and the active instance. It emits `change`, `setActive`, `add`, and `remove`.
- `InstanceRegistry` hydrates/persists `InstanceStore` from VS Code global/workspace state and preserves `selectedAiTool`, `terminalBackend`, and `backendState` when present.
- `InstanceDiscoveryService` discovers running OpenCode-compatible HTTP instances and syncs discovered process state.
- `InstanceController` spawns/connects/disconnects/kills/resolves stored instances; it uses `PortManager` and `TerminalManager` and optionally `ConnectionResolver`.
- `ConnectionResolver` is the stored/discovered/spawn resolution path for HTTP ports; do not duplicate that fallback chain elsewhere.
- `InstanceQuickPick` is the user-facing session switcher: selecting an item calls `InstanceStore.setActive()`, which drives provider/session switching.

## Multi-Terminal State

- Active instance switching is store-driven; do not keep a separate active instance cache outside `InstanceStore`/`SessionRuntime`.
- Per-pane terminal state is split: extension-host pane metadata is `PaneStore`, running sessions are `SessionRuntime.sessions`, and browser xterm instances are `webview/PaneManager`.
- Default session ids differ from pane sessions: default uses the active instance id as terminal key; non-default panes use `paneId` as terminal key and `${activeInstanceId}::${paneId}` as instance id.
- `DataThrottleService` batches pane output and tracks the focused pane; update focus before flushing output on pane/tab changes.
- `NativeTerminalManager.create()` returns a `BackendLaunchPlan` for persisted restore metadata, but backend availability currently resolves to `native` in `terminalBackends.ts`.

## Ports And Logging

- Use `PortManager.getInstance(...)` or the module-level `portManager`; no ad hoc port allocation.
- OpenCode HTTP ports are assigned in the ephemeral range `16384-65535` and passed via `_EXTENSION_OPENCODE_PORT` plus `OPENCODE_CALLER=vscode`.
- Use `OutputChannelService.getInstance()` for logging. Tests may reset the singleton; never call `new OutputChannelService()` directly.

## AI Tool Operators

- Add tool-specific behavior under `src/services/aiTools/operators` and register through `AiToolOperatorRegistry`.
- Formatting file refs, dropped files, pasted images, launch commands, auto-context support, and HTTP support should live in operators rather than command/provider conditionals.

## Verification

- Service tests are colocated as `*.test.ts`, with some older grouped tests under `src/services/__tests__`.
- Tests touching singleton or global service state must reset using the existing reset helpers/patterns.

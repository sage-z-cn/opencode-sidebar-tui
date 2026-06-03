# PROJECT KNOWLEDGE BASE

**Updated:** 2026-06-03 Asia/Shanghai
**Commit:** 464b563 | **Branch:** main

## OVERVIEW

VS Code extension — AI Sidebar Terminal. Embeds multiple AI coding tools (OpenCode, Claude Code, Codex, Gemini CLI, Kimi Code, Qwen Code, custom) in the sidebar with full PTY, HTTP API, and multi-backend terminal management (native / tmux / zellij).

## BUILD & TEST

```bash
npm run compile          # dev build (webpack) — two bundles: extension.js + webview.js/dashboard.js
npm run watch            # watch mode
npm run package          # production build + vsce package → build/extension.vsix
npm run test             # vitest run
npm run test:coverage    # vitest + coverage (lines 80%, functions 80%, branches 70%, statements 80%)
npm run build-and-install # compile → package → install to VS Code
```

- Webpack produces 3 outputs: `extension.js` (node target), `webview.js` + `dashboard.js` (web target)
- `vitest.config.ts` aliases `vscode` → `./src/test/mocks/vscode.ts` (no `@vscode/test-electron` for unit tests)
- Webview code (`src/webview/**`) excluded from coverage
- `dist/` is the build output; `out/` is unused (tsconfig `outDir` is historical)

## STRUCTURE

```
src/
├── extension.ts              # VS Code entry: activate/deactivate → ExtensionLifecycle
├── types.ts                  # shared host↔webview message contracts (WebviewMessage, HostMessage, TmuxDashboardActionMessage)
├── i18n.ts                   # thin wrapper around vscode.l10n.t
├── core/
│   ├── ExtensionLifecycle.ts # activate(): creates all services, registers providers + commands
│   └── commands/             # domain-split command registration
│       ├── index.ts          # registerCommands(context, deps) orchestrator
│       ├── terminalCommands.ts
│       ├── tmuxSessionCommands.ts
│       ├── tmuxPaneCommands.ts
│       └── dashboardCommands.ts
├── providers/                # extension host webview providers
│   ├── TerminalProvider.ts   # webview lifecycle shell + HTML generation
│   ├── MessageRouter.ts      # message dispatch (20+ handlers)
│   ├── SessionRuntime.ts     # start/restart/tmux/instance switching
│   ├── TerminalDashboardProvider.ts  # tmux dashboard (inline HTML)
│   └── CodeActionProvider.ts
├── services/                 # stateful backend
│   ├── InstanceStore.ts      # in-memory instance state hub (Node EventEmitter)
│   ├── InstanceController.ts # spawn/connect/disconnect/kill lifecycle
│   ├── InstanceDiscoveryService.ts # process scan, auto-spawn
│   ├── InstanceRegistry.ts   # persistence (globalState/workspaceState)
│   ├── ConnectionResolver.ts # 4-tier: stored → discovered → spawned + client pool
│   ├── OpenCodeApiClient.ts  # HTTP client with retry/backoff
│   ├── PortManager.ts        # singleton ephemeral port allocation (16384-65535)
│   ├── NativeTerminalManager.ts # native backend (no tmux/zellij dependency)
│   ├── TmuxSessionManager.ts # tmux CLI wrapper (standalone, no service deps)
│   ├── ZellijSessionManager.ts
│   ├── terminalBackends.ts   # TerminalBackend interface + TerminalBackendRegistry
│   ├── PaneStore.ts          # pane state (tabs, panes, layout snapshots)
│   ├── DataThrottleService.ts # batched pane data delivery
│   ├── TmuxPaneSyncService.ts / ZellijPaneSyncService.ts
│   ├── aiTools/              # extensible AI tool operator system
│   │   ├── AiToolOperator.ts
│   │   ├── AiToolOperatorRegistry.ts
│   │   └── operators/        # OpenCode, Claude, Codex, Gemini, Kimi operators
│   ├── ContextManager.ts / ContextSharingService.ts
│   ├── FileReferenceManager.ts
│   ├── InstanceQuickPick.ts
│   ├── OutputChannelService.ts # singleton logger
│   └── OutputCaptureManager.ts
├── terminals/                # node-pty process management
├── webview/                  # browser-only code (xterm.js, Preact dashboard)
│   ├── main.ts               # terminal bootstrap (xterm + WebGL + fit/resize)
│   ├── dashboard-manager.tsx # Preact dashboard entry
│   ├── layout/               # layout engine (multi-pane)
│   ├── terminal/             # terminal container, toolbar, keyboard, AI selector
│   ├── toolbar/              # toolbar buttons including refresh terminal
│   ├── pane-manager.ts       # pane lifecycle management
│   ├── pane-message-router.ts
│   └── ...                   # focus, clipboard, dragdrop, links, messages, etc.
├── utils/
├── test/mocks/               # manual vscode.ts + node-pty.ts mocks
└── __tests__/                # vitest setup
```

## ARCHITECTURE

```
extension.ts → ExtensionLifecycle.activate()
  ├── ~15 services created (manual DI, no container)
  ├── 2 providers registered (TerminalProvider, TerminalDashboardProvider)
  ├── CodeActionProvider registered
  ├── TerminalBackendRegistry (native + tmux + zellij)
  └── command groups under core/commands/
```

**Terminal backends:** native (default), tmux, zellij — user-selectable via `ai-sidebar-terminal.terminalBackend` config.

**AI tool operators:** extensible via `AiToolOperatorRegistry` + `operators/` directory. Each operator handles tool-specific behavior.

**i18n:** Uses VS Code's built-in `l10n` API. Strings via `src/i18n.ts` → `l10n.t()`. Translations in `l10n/bundle.l10n.zh-cn.json`. Webview uses the same `l10n` import.

**Host↔Webview messages:** discriminated unions in `src/types.ts` — all message shapes must be updated there.

## SINGLETONS

- `OutputChannelService` — `getInstance()` + `resetInstance()` for tests
- `portManager` — module-level export in `PortManager.ts`

## EVENT PATTERNS

- `InstanceStore` — Node `EventEmitter`: `change`, `setActive`, `add`, `remove`
- `TerminalManager` / `NativeTerminalManager` — VS Code `EventEmitter`: `onData`, `onExit`
- `FileReferenceManager` — VS Code `EventEmitter`: `onDidAddReference`, `onDidRemoveReference`
- `PaneStore` — Node `EventEmitter`

## CONVENTIONS

- TypeScript `strict: true`; diagnostics must stay clean on changed files
- PascalCase classes; lowercase entrypoints (`extension.ts`, `main.ts`)
- Tests colocated as `*.test.ts`; manual mocks in `src/test/mocks/`
- Commands split by domain in `core/commands/` — never register directly in lifecycle or providers
- `l10n.t()` for all user-visible strings (extension host + webview)
- Webview code = browser-only; extension host code = `providers/`, `services/`, `core/`

## ANTI-PATTERNS (THIS PROJECT)

- No Node APIs in `src/webview` (`fs`, `path`, `os` are not available)
- No duplicating instance state outside `InstanceStore`
- No tmux/zellij logic in providers — use `TmuxSessionManager` / `ZellijSessionManager`
- New message shapes must update `src/types.ts`
- Never `new OutputChannelService()` — use `getInstance()`
- Never bypass mocks — follow existing patterns in `src/test/mocks/`
- No ad hoc port allocation — use `PortManager`
- No arbitrary message shapes in providers — must go through `MessageRouter`

## KNOWN DEBT

- `TerminalDashboardProvider.ts` — inline HTML, needs split
- `PortManager` — created separately in provider and lifecycle (needs singleton consolidation)

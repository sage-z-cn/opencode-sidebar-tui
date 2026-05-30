# Opencode Sidebar TUI

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/sagez.opencode-sidebar-tui-sage?logo=visual-studio-code&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=sagez.opencode-sidebar-tui-sage)


[中文文档](https://github.com/sage-z-cn/opencode-sidebar-tui/blob/main/README.zh-CN.md)

Automatically render Opencode Sidebar Terminal in VS Code sidebar with full terminal support.

> This extension is a fork of [islee23520/opencode-sidebar-tui](https://github.com/islee23520/opencode-sidebar-tui) with Windows compatibility improvements.

## Changes in this Fork

See [CHANGELOG.md](https://github.com/sage-z-cn/opencode-sidebar-tui/blob/main/CHANGELOG.md) for modifications starting from v2.0.0.

## Features

- **Auto-launch OpenCode**: Opens OpenCode automatically when the sidebar is activated
- **Full TUI Support**: Complete terminal emulation with xterm.js and WebGL rendering
- **Multi-AI Tool Support**: Configure and switch between OpenCode, Claude, Codex, or custom AI tools
- **Terminal Managers**: Dedicated tmux session management surface with inline pane and window controls
- **Tmux Integration**: Automatic tmux session discovery, workspace-scoped session filtering, and tmux status bar hidden in sidebar
- **Native Shell Switching**: Toggle between OpenCode and a native shell in the same terminal
- **Return to Workspace Banner**: Quick navigation back to the active workspace from Terminal Managers
- **HTTP API Integration**: Bidirectional communication with OpenCode CLI via HTTP API
- **Auto-Context Sharing**: Automatically shares editor context when terminal opens
- **File References with Line Numbers**: Send file references with `@filename#L10-L20` syntax
- **Code Actions**: Diagnostic-triggered code actions for errors and warnings
- **Keyboard Shortcuts**: Quick access with `Cmd+Alt+L`, `Cmd+Alt+A`, and `Cmd+Alt+T`
- **Drag & Drop Support**: Hold Shift and drag files/folders to send as references
- **Context Menu Integration**: Right-click files in Explorer or text in Editor to send to OpenCode
- **Secondary Sidebar**: Dock the terminal in the secondary sidebar for split-screen workflows
- **Configurable**: Customize command, font, terminal settings, HTTP API behavior, and AI tool preferences

## Architecture

This extension provides a **sidebar-only** terminal experience. OpenCode runs embedded in the VS Code sidebar Activity Bar, not in the native VS Code terminal panel.

The extension consists of two primary sidebar views:

1. **OpenCode Terminal** (secondary sidebar): The main interactive TUI session.
2. **Terminal Managers**: A dedicated surface for managing tmux sessions, panes, and windows.

### Communication Architecture

The extension uses a hybrid communication approach:

1. **HTTP API**: Primary communication channel with OpenCode CLI
   - Port range: 16384-65535 (ephemeral ports)
   - Endpoints: `/health`, `/tui/append-prompt`
   - Auto-discovery of OpenCode CLI HTTP server

2. **WebView Messaging**: Terminal I/O between extension host and sidebar WebView
   - xterm.js for terminal rendering
   - Bidirectional message passing for input/output

## Installation

### From Source

1. Clone the repository:

```bash
git clone https://github.com/sage-z-cn/opencode-sidebar-tui.git
cd opencode-sidebar-tui
```

2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run compile
```

4. Package the extension:

```bash
npx @vscode/vsce package
```

5. Install in VS Code:

- Open VS Code
- Go to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`)
- Click "..." menu → "Install from VSIX"
- Select the generated `.vsix` file

## Usage

1. Click the OpenCode icon in the Activity Bar (sidebar) to open Terminal Managers
2. The Open Sidebar Terminal is available in the secondary sidebar
3. Open Sidebar Terminal automatically starts when the terminal view is activated
4. Interact with OpenCode directly in the sidebar

## Commands

### Basic Commands

- **Open Sidebar Terminal: Start OpenCode** - Manually start OpenCode
- **Open Sidebar Terminal: Paste** - Paste text into the terminal

### File Reference Commands

- **Send File Reference (@file)** (`Cmd+Alt+L` / `Ctrl+Alt+L`) - Send current file with line numbers
  - No selection: `@filename`
  - Single line: `@filename#L10`
  - Multiple lines: `@filename#L10-L20`
- **Send All Open File References** (`Cmd+Alt+A` / `Ctrl+Alt+A`) - Send all open file references
- **Send to OpenCode** - Send selected text or file from context menu
- **Send to Active Terminal** - Send selected text to the active terminal

### Tmux Session Commands

- **Open Tmux Session in New Window** - Open the current tmux session in a new VS Code window
- **Spawn Tmux Session for Workspace** - Create a new tmux session scoped to the current workspace
- **Select OpenCode Tmux Session** - Choose from a list of available tmux sessions
- **Switch Tmux Session** - Switch to a different tmux session
- **Browse Tmux Sessions** (`Cmd+Alt+T` / `Ctrl+Alt+T`) - Browse and switch between tmux sessions
- **Switch to Native Shell** - Toggle between OpenCode and a native shell
- **Open Terminal Managers** - Open the Terminal Managers view

### Tmux Pane Commands

- **Switch to Pane** - Switch focus to a specific tmux pane
- **Split Pane Horizontal** - Split the current pane horizontally
- **Split Pane Vertical** - Split the current pane vertically
- **Split Pane with Command** - Split the pane and run a specific command
- **Send Text to Pane** - Send text directly to a specific tmux pane
- **Resize Pane** - Adjust the size of the current tmux pane
- **Swap Panes** - Swap positions of two tmux panes
- **Kill Pane** - Close the current tmux pane

### Tmux Window Commands

- **Next Window** - Switch to the next tmux window
- **Previous Window** - Switch to the previous tmux window
- **Create Window** - Create a new tmux window
- **Select Window** - Choose from available tmux windows
- **Kill Window** - Close the current tmux window
- **Kill Session** - Kill the current tmux session
- **Refresh Terminal Manager** - Refresh Terminal Managers

### Keyboard Shortcuts

| Shortcut                   | Command              | Context                        |
| -------------------------- | -------------------- | ------------------------------ |
| `Cmd+Alt+L` / `Ctrl+Alt+L` | Send File Reference  | Editor or Terminal             |
| `Cmd+Alt+A` / `Ctrl+Alt+A` | Send All Open Files  | Editor or Terminal             |
| `Cmd+Alt+T` / `Ctrl+Alt+T` | Browse Tmux Sessions | Terminal focused               |
| `Cmd+V` / `Ctrl+V`         | Paste                | Terminal focused               |
| `Ctrl+P`                   | Quick Open (native)  | Terminal focused (passthrough) |

### Context Menu Options

- **Explorer**: Right-click any file or folder → "Send to OpenCode"
- **Editor**: Right-click anywhere → "Send File Reference (@file)"

### Drag & Drop

- Hold **Shift** and drag files/folders to the terminal to send as `@file` references

## Terminal Managers

The Terminal Managers view provides advanced tmux session and pane management directly within the VS Code sidebar:

- **Session Discovery**: Automatically detects existing tmux sessions on your system.
- **Workspace Filtering**: Filters sessions to show those relevant to your current workspace.
- **Pane Controls**: Inline buttons to split panes (horizontal/vertical), switch focus, resize, swap, and kill panes.
- **Window Controls**: Navigate, create, select, and kill tmux windows.
- **Return to Workspace**: A quick-access banner to navigate back to the active workspace session.
- **Clean UI**: The tmux status bar is automatically hidden within the sidebar terminal to maximize vertical space.

## HTTP API Integration

The extension communicates with OpenCode CLI via an HTTP API for reliable bidirectional communication:

### Features

- **Auto-Discovery**: Automatically discovers OpenCode CLI HTTP server port
- **Health Checks**: Validates OpenCode CLI availability before sending commands
- **Retry Logic**: Exponential backoff for reliable communication
- **Context Sharing**: Automatically shares editor context on terminal open

### How It Works

1. When OpenCode starts, it launches an HTTP server on an ephemeral port (16384-65535)
2. The extension discovers the port and establishes communication
3. File references and context are sent via HTTP POST to `/tui/append-prompt`
4. Health checks ensure OpenCode is ready before sending data

### Configuration

```json
{
  "ost.enableHttpApi": true,
  "ost.httpTimeout": 5000,
  "ost.autoShareContext": true
}
```

## Auto-Context Sharing

When enabled, the extension automatically shares editor context with OpenCode when the terminal opens:

- **Open Files**: Lists all currently open files
- **Active Selection**: Includes line numbers for selected text
- **Format**: `@path/to/file#L10-L20`

This feature eliminates the need to manually share context when starting a new OpenCode session.

## Configuration

Available settings in VS Code settings (`Cmd+,` / `Ctrl+,`):

### Terminal Settings

| Setting                       | Type    | Default           | Description                                             |
| ----------------------------- | ------- | ----------------- | ------------------------------------------------------- |
| `ost.autoStart`       | boolean | `true`            | Automatically start OpenCode when the view is activated |
| `ost.autoStartOnOpen` | boolean | `true`            | Automatically start OpenCode when sidebar is opened     |
| `ost.fontSize`        | number  | `14`              | Terminal font size in pixels (6-25)                     |
| `ost.fontFamily`      | string  | Nerd Font stack\* | Terminal font family                                    |
| `ost.cursorBlink`     | boolean | `true`            | Enable cursor blinking                                  |
| `ost.cursorStyle`     | string  | `"block"`         | Cursor style: `block`, `underline`, or `bar`            |
| `ost.scrollback`      | number  | `10000`           | Maximum lines in scrollback buffer (0-100000)           |
| `ost.autoFocusOnSend` | boolean | `true`            | Auto-focus sidebar after sending file references        |
| `ost.shellPath`       | string  | `""`              | Custom shell path (empty = VS Code default)             |
| `ost.shellArgs`       | array   | `[]`              | Custom shell arguments                                  |

\* Default: `'JetBrainsMono Nerd Font', 'FiraCode Nerd Font', 'CascadiaCode NF', Menlo, monospace`

### HTTP API Settings

| Setting                         | Type    | Default | Description                                      |
| ------------------------------- | ------- | ------- | ------------------------------------------------ |
| `ost.enableHttpApi`     | boolean | `true`  | Enable HTTP API for OpenCode communication       |
| `ost.httpTimeout`       | number  | `5000`  | HTTP API request timeout in ms (1000-30000)      |
| `ost.autoShareContext`  | boolean | `true`  | Auto-share editor context with OpenCode          |
| `ost.contextDebounceMs` | number  | `500`   | Debounce delay for context updates (100-5000 ms) |

### AI Tool Settings

| Setting                       | Type    | Default                       | Description                                               |
| ----------------------------- | ------- | ----------------------------- | --------------------------------------------------------- |
| `ost.aiTools`         | array   | `[{opencode, claude, codex}]` | Configure AI coding tools with custom paths and arguments |
| `ost.defaultAiTool`   | string  | `"opencode"`                  | Default AI tool for new tmux sessions                     |
| `ost.enableAutoSpawn` | boolean | `true`                        | Auto-spawn OpenCode if not running                        |

### Tmux Settings

| Setting                          | Type    | Default | Description                                                            |
| -------------------------------- | ------- | ------- | ---------------------------------------------------------------------- |
| `ost.nativeShellDefault` | string  | `""`    | Default behavior for native shell switch (`""`, `"opencode"`, `"shell"`) |
| `ost.tmuxSessionDefault` | string  | `""`    | Default behavior for new tmux sessions (`""`, `"opencode"`, `"shell"`) |
| `ost.showTmuxWindowControls` | boolean | `true` | Show direct tmux session/window controls in the terminal toolbar       |

### Advanced Settings

| Setting                            | Type   | Default                | Description                                      |
| ---------------------------------- | ------ | ---------------------- | ------------------------------------------------ |
| `ost.logLevel`             | string | `"info"`               | Log level: `debug`, `info`, `warn`, `error`      |
| `ost.maxDiagnosticLength`  | number | `500`                  | Maximum length of diagnostic messages (100-2000) |
| `ost.codeActionSeverities` | array  | `["error", "warning"]` | Diagnostic severities that trigger code actions  |

### Example Configuration

```json
{
  "ost.autoStart": true,
  "ost.fontSize": 14,
  "ost.fontFamily": "'JetBrainsMono Nerd Font', monospace",
  "ost.cursorBlink": true,
  "ost.cursorStyle": "block",
  "ost.scrollback": 10000,
  "ost.enableHttpApi": true,
  "ost.httpTimeout": 5000,
  "ost.autoShareContext": true,
  "ost.defaultAiTool": "opencode"
}
```

## Requirements

- VS Code 1.106.0 or higher
- Node.js 20.0.0 or higher
- OpenCode installed and accessible via `opencode` command

## Development

### Build

```bash
npm run compile         # Development build
npm run watch           # Watch mode
npm run package         # Production build
npm run test            # Run tests
npm run test:watch      # Watch mode tests
npm run test:coverage   # Run tests with coverage
npm run lint            # Lint source
npm run format          # Format source
```

### Project Structure

```
src/
├── extension.ts                         # VS Code entry (activate/deactivate)
├── types.ts                             # Shared host↔webview message contracts
├── types.test.ts                        # Type contract tests
├── core/
│   ├── ExtensionLifecycle.ts            # Service wiring + activation/deactivation
│   └── commands/                        # Command registration
│       ├── index.ts                     # registerCommands() orchestrator
│       ├── terminalCommands.ts          # start, restart, paste, file references
│       ├── tmuxSessionCommands.ts       # session switch, create, spawn, browse
│       └── tmuxPaneCommands.ts          # pane + window commands + QuickPick helpers
├── providers/
│   ├── TerminalProvider.ts              # Main sidebar terminal webview provider
│   ├── TerminalProvider.test.ts         # Provider tests
│   ├── TerminalDashboardProvider.ts     # Terminal Managers provider
│   ├── TerminalDashboardProvider.test.ts # Dashboard tests
│   ├── CodeActionProvider.ts            # Diagnostic code action provider
│   ├── CodeActionProvider.test.ts       # Code action tests
│   └── opencode/                        # Terminal core modules
│       ├── OpenCodeMessageRouter.ts     # Message dispatch + handlers
│       └── OpenCodeSessionRuntime.ts    # Start/restart/tmux/instance switching
├── terminals/
│   └── TerminalManager.ts              # node-pty process lifecycle
├── services/
│   ├── InstanceStore.ts                # In-memory instance state + EventEmitter
│   ├── InstanceController.ts           # Instance lifecycle orchestration
│   ├── InstanceDiscoveryService.ts     # Running instance discovery + auto-spawn
│   ├── InstanceRegistry.ts             # Instance persistence (globalState)
│   ├── ConnectionResolver.ts           # 4-tier port resolution + client pool
│   ├── OpenCodeApiClient.ts            # HTTP client (retry/backoff)
│   ├── PortManager.ts                  # Ephemeral port allocation
│   ├── TmuxSessionManager.ts           # tmux CLI wrapper (sessions, panes, windows)
│   ├── ContextManager.ts               # Active editor/selection observer
│   ├── ContextSharingService.ts        # @file#L context formatter
│   ├── FileReferenceManager.ts         # File reference serialization
│   ├── InstanceQuickPick.ts            # Quick pick UI for instance selection
│   ├── OutputChannelService.ts         # Singleton logging service
│   └── OutputCaptureManager.ts         # Terminal output capture
├── webview/
│   ├── main.ts                         # Terminal webview (xterm.js + WebGL)
│   ├── terminal.html                   # Terminal webview HTML
│   ├── terminal.css                    # Terminal webview styles
│   ├── dashboard-manager.ts            # Dashboard webview logic
│   ├── dashboard.html                  # Dashboard webview HTML
│   └── dashboard.css                   # Dashboard webview styles
├── utils/
│   └── PromptFormatter.ts              # Prompt formatting utilities
├── test/
│   └── mocks/
│       ├── vscode.ts                   # VS Code API mock
│       └── node-pty.ts                 # node-pty mock
└── __tests__/
    └── setup.ts                        # Vitest global setup
```

## Implementation Details

Based on the excellent vscode-sidebar-terminal extension, streamlined specifically for Open Sidebar Terminal:

- **Terminal Backend**: node-pty for PTY support
- **Terminal Frontend**: xterm.js with WebGL rendering
- **Process Management**: Automatic OpenCode lifecycle
- **Communication**: HTTP API + WebView messaging
- **Port Management**: Ephemeral port allocation (16384-65535)

## Upstream Sync

This fork maintains an `origin-main` branch that mirrors the upstream repository. See [SYNC_UPSTREAM.md](SYNC_UPSTREAM.md) for the sync workflow.

## License

MIT — see [LICENSE](LICENSE) for details.


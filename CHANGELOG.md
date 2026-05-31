# Changelog

All notable changes to the "Open Sidebar TUI" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.1] - 2026-05-31

### Changed

- 统一 WebView 配色方案为深黑色背景。

## [2.2.0] - 2026-05-31

### Added

- 工具栏新增设置按钮（⚙），点击直接打开扩展设置面板（已过滤 `ost.` 前缀）。

### Fixed

- 修复后端切换按钮的提示文字从 "Switch to Native Shell" 改为 "Cycle terminal backend"。
- 修复会话标签居中问题，改用绝对定位确保标签始终居中。

## [2.1.1] - 2026-05-31

### Fixed

- Fix re-render button not working — switch from `fitAddon.fit()`/`terminal.refresh()` to `maxHeight` DOM trick to reliably trigger xterm.js re-render via ResizeObserver.

## [2.1.0] - 2026-05-31

### Added

- Add l10n (localization) support with `vscode.l10n` translation bundle and `i18n` module.
- Localize extension host modules (commands, providers, services) via `l10n.t()`.
- Add `package.nls.json` for extension manifest localization.
- Add terminal re-render button (▣) that performs fit+refresh without restarting the process.
- Localize all toolbar button titles via `vscode.l10n`.

## [2.0.0] - 2026-05-30

### Changed

- Fork from [islee23520/opencode-sidebar-tui](https://github.com/islee23520/opencode-sidebar-tui) as independent extension `sagez.opencode-sidebar-tui-sage`.
- Rename all command and configuration IDs from `opencodeTui`/`opencode` prefix to `ost` to avoid conflicts with the original extension.
- Rename display name to "Opencode Sidebar TUI".

### Fixed

- Fix Shift+Enter sending CRLF instead of LF in the sidebar terminal.
- Fix CopyPlugin glob mismatch on Windows preventing dashboard/terminal assets from being copied to `dist/`.
- Fix sidebar xterm height stuck at 360px after packaging due to missing CSS files.

## [1.8.0] - 2026-05-18

### Added

- Add multi-backend terminal support with `native`, `tmux`, and `zellij` backend selection.
- Add native terminal backend support with ask-first AI tool selection.
- Add `ost.terminalBackend` setting for choosing the terminal backend.
- Add `ost.sendKeybindingsToShell` so terminal-focused Ctrl/Cmd shortcuts can be passed through to the TUI.

### Changed

- Change `ost.autoStartOnOpen` default to `false` so users can choose which AI tool to launch when opening the sidebar.
- Rename dashboard command labels to `Open Terminal Managers` for clearer VS Code command palette and menu wording.
- Improve Windows compatibility and terminal UX around shell handling, paths, clipboard behavior, and terminal focus.
- Expand automated test coverage across core commands, providers, services, terminals, webview keyboard handling, and VS Code mocks.

### Fixed

- Fix Shift+Enter newline handling in the sidebar terminal.
- Fix editor title actions so `Open Terminal in Editor` and `Open Terminal Managers` only appear after the extension is fully active.
- Fix package repository URL metadata by removing the leading whitespace.

### Security

- Update dependency lockfile entries for `postcss`, `fast-uri`, `brace-expansion`, `ajv`, and `serialize-javascript`.
- Add a `serialize-javascript` override to force `^7.0.5`.

## [1.4.1] - 2026-03-03

### Fixed

- Fix all "Send to OpenCode" commands broken after 1.4.0 multi-instance patch
  - Root cause: `OpenCodeTuiProvider.startOpenCode()` did not write `terminalKey` into the InstanceStore, causing `getActiveTerminalId()` to resolve to a non-existent terminal ID
  - On fresh installs (empty store), `getActive()` threw → fallback to `"opencode-main"`, while the actual terminal was created with ID `"default"` → silent mismatch
  - Fixed by ensuring the instance store record is created/updated with the correct `terminalKey` after terminal creation
- Fix `sendFileToTerminal` (Send File Reference) not working from editor and explorer context menus
- Fix `sendAtMention` (Send @file) not working
- Fix `sendAllOpenFiles` (Send All Open Files) not working
- Fix `sendToTerminal` (Send Selected Text) not working

### Improved

- Support multi-file selection in Explorer context menu — selecting multiple files and using "Send to OpenCode" now sends all selected files as `@file1 @file2 @file3`
- Replace notification popups (`showInformationMessage`) with transient status bar messages (`setStatusBarMessage`) when sending files — less intrusive UX

## [1.3.2] - 2026-02-20

### Fixed

- Support multi-file selection in Explorer context menu - multiple files are now sent together as `@file1 @file2 @file3`
- Improve drag-and-drop handling for VS Code editor tabs - files dragged from editor tabs are now properly captured
- Remove duplicate "Send to OpenCode Terminal" from editor context menu - only "Send File Reference (@file)" remains
- Fix multi-file drag-and-drop from Explorer - all selected files are now processed instead of just the first one

## [1.1.0] - 2025-02-06

### Added

- **HTTP API Integration**: Bidirectional communication with OpenCode CLI via HTTP API
  - Auto-discovery of OpenCode CLI HTTP server on ephemeral ports (16384-65535)
  - Health check endpoint (`/health`) for availability validation
  - Prompt append endpoint (`/tui/append-prompt`) for sending commands
  - Exponential backoff retry logic for reliable communication
  - Configurable timeout (default: 5000ms)

- **Auto-Context Sharing**: Automatically shares editor context when terminal opens
  - Shares all open files on terminal startup
  - Includes line numbers for active selections
  - Format: `@path/to/file#L10-L20`
  - Configurable via `ost.autoShareContext` setting

- **Port Management Service**: Ephemeral port allocation for HTTP communication
  - Port range: 16384-65535 (standard ephemeral range)
  - Collision detection and prevention
  - Per-terminal port tracking
  - Automatic cleanup on terminal closure

- **Context Sharing Service**: Editor context detection and formatting
  - Detects current file and selection
  - Formats file references with line numbers
  - Supports `@file`, `@file#L10`, `@file#L10-L20` formats

- **New Configuration Options**:
  - `ost.enableHttpApi`: Enable/disable HTTP API (default: `true`)
  - `ost.httpTimeout`: HTTP request timeout in milliseconds (default: `5000`, range: 1000-30000)
  - `ost.autoShareContext`: Auto-share editor context on terminal open (default: `true`)

### Changed

- **Architecture Documentation**: Clarified sidebar-only architecture
  - Added explicit note that this is a sidebar-only extension (not native VS Code: terminal)
  - Documented HTTP API vs WebView messaging architecture
  - Updated feature list to highlight HTTP API capabilities

- **Communication Method**: Migrated from terminal I/O to HTTP API for reliable bidirectional communication
  - More reliable than terminal stdin/stdout parsing
  - Better error handling and retry capabilities
  - Cleaner separation of concerns

### Technical

- Added `OpenCodeApiClient` for HTTP communication with retry logic
- Added `PortManager` for ephemeral port allocation
- Added `ContextSharingService` for editor context detection
- Added `TerminalDiscoveryService` for terminal integration
- Added `OutputCaptureManager` for output handling
- Comprehensive test coverage for all new services

## [1.0.4] - 2025-01-XX

### Added

- Initial release with core functionality
- Auto-launch OpenCode when sidebar is activated
- Full TUI support with xterm.js and WebGL rendering
- File references with line numbers (`@filename#L10-L20`)
- Keyboard shortcuts (`Cmd+Alt+L`, `Cmd+Alt+A`)
- Drag & drop support for files
- Context menu integration
- Configurable terminal settings

### Features

- **Terminal Management**: node-pty backend with xterm.js frontend
- **File References**: Send current file or selection to OpenCode
- **Keyboard Shortcuts**: Quick access commands
- **Context Menus**: Right-click integration in Explorer and Editor
- **Drag & Drop**: Shift-drag files to send as references
- **Configuration**: Customizable command, font, and terminal settings

[2.0.0]: https://github.com/sage-z-cn/opencode-sidebar-tui/compare/v1.8.0...v2.0.0
[1.8.0]: https://github.com/sage-z-cn/opencode-sidebar-tui/compare/v1.3.2...v1.8.0
[1.1.0]: https://github.com/sage-z-cn/opencode-sidebar-tui/compare/v1.0.4...v1.1.0
[1.0.4]: https://github.com/sage-z-cn/opencode-sidebar-tui/releases/tag/v1.0.4


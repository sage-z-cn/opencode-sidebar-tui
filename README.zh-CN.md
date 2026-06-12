# AI 侧边栏终端

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/sagez.ai-sidebar-terminal?logo=visual-studio-code&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=sagez.ai-sidebar-terminal)

[English](https://github.com/sage-z-cn/ai-sidebar-terminal/blob/main/README.md)

在 VS Code 侧边栏中嵌入多种 AI 编程助手（OpenCode、Claude Code、Codex、Gemini CLI、Kimi Code、Qwen Code、Mimo Code 或任意自定义 AI 工具），提供完整终端管理。

## 功能特性

- **自动启动 AI 工具**: 侧边栏激活时自动启动所选 AI 编程助手
- **完整 TUI 支持**: xterm.js + WebGL 渲染的终端模拟
- **多 AI 工具支持**: 内置 OpenCode、Claude Code、Codex、Gemini CLI、Kimi Code、Qwen Code、Mimo Code，可自定义扩展
- **多窗格分屏**: 基于 xterm.js 将终端分割为多个窗格，支持标签页管理
- **Pill Dropdown 工具栏**: 统一的 pill 式下拉菜单，快速切换 AI 工具
- **HTTP API 集成**: 通过 HTTP API 与 OpenCode CLI 双向通信
- **自动上下文共享**: 终端打开时自动共享编辑器上下文
- **带行号的文件引用**: 以 `@filename#L10-L20` 语法发送文件引用
- **代码操作**: 对错误和警告触发诊断代码操作
- **键盘快捷键**: `Alt+A`、`Cmd+Alt+A` 快速操作
- **拖放支持**: 按住 Shift 拖放文件/文件夹发送引用
- **右键菜单集成**: 在资源管理器或编辑器中右键发送到 AI 终端
- **辅助侧边栏**: 将终端停靠在辅助侧边栏实现分屏工作流
- **高度可配置**: 自定义命令、字体、终端设置、HTTP API 行为和 AI 工具偏好

## 架构

本扩展提供**仅侧边栏**的终端体验。AI 工具内嵌在 VS Code 侧边栏活动栏中运行，而非原生 VS Code 终端面板。

### 通信架构

扩展采用混合通信方式：

1. **HTTP API**: 与 OpenCode CLI 的主要通信通道
   - 端口范围：16384-65535（临时端口）
   - 端点：`/health`、`/tui/append-prompt`
   - 自动发现 OpenCode CLI HTTP 服务器

2. **WebView 消息**: 扩展宿主与侧边栏 WebView 之间的终端 I/O
   - xterm.js 终端渲染
   - 双向消息传递用于输入/输出

## 安装

### 从源码构建

1. 克隆仓库：

```bash
git clone https://github.com/sage-z-cn/ai-sidebar-terminal.git
cd ai-sidebar-terminal
```

2. 安装依赖：

```bash
npm install
```

3. 构建扩展：

```bash
npm run build-and-install
```

4. 打包扩展：

```bash
npx @vscode/vsce package
```

5. 在 VS Code 中安装：

- 打开 VS Code
- 打开扩展面板（`Cmd+Shift+X` / `Ctrl+Shift+X`）
- 点击"..."菜单 → "从 VSIX 安装"
- 选择生成的 `.vsix` 文件

## 使用方法

1. 点击活动栏中的 AI Sidebar Terminal 图标
2. 终端视图激活时自动启动
3. 直接在侧边栏中与 AI 工具交互

## 命令

### 基础命令

- **AI 侧边栏终端: Start OpenCode** - 手动启动 AI 工具
- **AI 侧边栏终端: Paste** - 粘贴文本到终端
- **AI 侧边栏终端: Focus Terminal** - 聚焦侧边栏终端

### 文件引用命令

- **Send File Reference (@file)** (`Alt+A`) - 发送当前文件及行号
  - 无选中：`@filename`
  - 单行：`@filename#L10`
  - 多行：`@filename#L10-L20`
- **Send All Open File References** (`Cmd+Alt+A` / `Ctrl+Alt+A`) - 发送所有打开的文件引用
- **Send to AI Terminal** - 通过右键菜单发送选中文本或文件
- **Send to Active Terminal** - 发送选中文本到活动终端

### 键盘快捷键

| 快捷键                    | 功能             | 适用场景                  |
| ------------------------- | ---------------- | ------------------------- |
| `Alt+A`                    | 发送文件引用     | 编辑器或终端              |
| `Cmd+Alt+A` / `Ctrl+Alt+A` | 发送所有打开文件 | 编辑器或终端              |
| `Cmd+V` / `Ctrl+V`         | 粘贴             | 终端聚焦时                |
| `Ctrl+P`                   | 透传             | 终端聚焦时（透传）        |

### 右键菜单

- **资源管理器**: 右键任意文件或文件夹 → "Send to AI Terminal"
- **编辑器**: 右键任意位置 → "Send File Reference (@file)"

### 拖放

- 按住 **Shift** 拖动文件/文件夹到终端，以 `@file` 引用方式发送

## HTTP API 集成

扩展通过 HTTP API 与 OpenCode CLI 通信，实现可靠的双向通信：

### 功能

- **自动发现**: 自动发现 OpenCode CLI HTTP 服务器端口
- **健康检查**: 在发送命令前验证 OpenCode CLI 可用性
- **重试逻辑**: 指数退避确保可靠通信
- **上下文共享**: 终端打开时自动共享编辑器上下文

### 工作方式

1. OpenCode 启动时在临时端口（16384-65535）上启动 HTTP 服务器
2. 扩展发现端口并建立通信
3. 文件引用和上下文通过 HTTP POST 发送到 `/tui/append-prompt`
4. 健康检查确保 OpenCode 准备就绪后再发送数据

## 自动上下文共享

启用后，终端打开时自动共享编辑器上下文：

- **打开的文件**: 列出所有当前打开的文件
- **活动选中内容**: 包含选中文本的行号
- **格式**: `@path/to/file#L10-L20`

此功能消除了手动共享上下文的需要。

## 配置

在 VS Code 设置中可用（`Cmd+,` / `Ctrl+,`）：

### 终端设置

| 设置                                   | 类型    | 默认值            | 描述                                      |
| -------------------------------------- | ------- | ----------------- | ----------------------------------------- |
| `ai-sidebar-terminal.fontSize`         | number  | `12`              | 终端字号（像素，6-25）                    |
| `ai-sidebar-terminal.fontFamily`       | string  | Nerd Font 字体栈* | 终端字体族                                |
| `ai-sidebar-terminal.cursorBlink`      | boolean | `true`            | 启用光标闪烁                              |
| `ai-sidebar-terminal.cursorStyle`      | string  | `"block"`         | 光标样式：`block`、`underline`、`bar`     |
| `ai-sidebar-terminal.scrollback`       | number  | `10000`           | 回滚缓冲区最大行数（0-100000）            |
| `ai-sidebar-terminal.autoFocusOnSend`  | boolean | `true`            | 发送文件引用后自动聚焦侧边栏              |
| `ai-sidebar-terminal.autoStartOnOpen`  | boolean | `true`            | 侧边栏打开时自动启动 AI 工具              |
| `ai-sidebar-terminal.shellPath`        | string  | `""`              | 自定义 Shell 路径（空 = VS Code 默认）    |
| `ai-sidebar-terminal.shellArgs`        | array   | `[]`              | 自定义 Shell 参数                         |
| `ai-sidebar-terminal.sendKeybindingsToShell` | boolean | `true`       | 将 Ctrl/Cmd 快捷键发送到终端              |

\* 默认：`'JetBrainsMono Nerd Font', 'FiraCode Nerd Font', 'CascadiaCode NF', Menlo, monospace`

### HTTP API 设置

| 设置                                   | 类型    | 默认值  | 描述                                        |
| -------------------------------------- | ------- | ------- | ------------------------------------------- |
| `ai-sidebar-terminal.enableHttpApi`    | boolean | `true`  | 启用 HTTP API 通信                          |
| `ai-sidebar-terminal.httpTimeout`      | number  | `5000`  | HTTP API 请求超时（毫秒，1000-30000）        |
| `ai-sidebar-terminal.autoShareContext` | boolean | `true`  | 自动共享编辑器上下文给 AI 工具              |
| `ai-sidebar-terminal.contextDebounceMs` | number  | `500`   | 上下文更新防抖延迟（毫秒，100-5000）        |

### AI 工具设置

| 设置                                   | 类型    | 默认值                        | 描述                                      |
| -------------------------------------- | ------- | ----------------------------- | ----------------------------------------- |
| `ai-sidebar-terminal.aiTools`          | array   | `[{opencode, claude, codex}]` | 配置 AI 工具及其自定义路径和参数          |
| `ai-sidebar-terminal.defaultAiTool`    | string  | `"opencode"`                  | 新终端会话的默认 AI 工具                  |
| `ai-sidebar-terminal.enableAutoSpawn`  | boolean | `true`                        | AI 工具未运行时自动拉起                   |
| `ai-sidebar-terminal.promptAiToolOnSession` | boolean | `true`                   | 创建新会话时显示 AI 工具选择器            |

### 高级设置

| 设置                                            | 类型   | 默认值                 | 描述                                     |
| ----------------------------------------------- | ------ | ---------------------- | ---------------------------------------- |
| `ai-sidebar-terminal.logLevel`                  | string | `"info"`               | 日志级别：`debug`、`info`、`warn`、`error` |
| `ai-sidebar-terminal.maxDiagnosticLength`       | number | `500`                  | 诊断消息最大长度（100-2000）              |
| `ai-sidebar-terminal.codeActionSeverities`      | array  | `["error", "warning"]` | 触发代码操作的诊断严重级别                |
| `ai-sidebar-terminal.collapseSecondaryBarOnEditorOpen` | boolean | `true`          | 打开编辑器标签页时关闭辅助侧边栏          |

### 窗格设置

| 设置                                          | 类型    | 默认值          | 描述                                      |
| --------------------------------------------- | ------- | --------------- | ----------------------------------------- |
| `ai-sidebar-terminal.pane.defaultSplitDirection` | string  | `"horizontal"`  | 默认分割方向（horizontal / vertical）    |
| `ai-sidebar-terminal.pane.focusOnClick`       | boolean | `true`          | 点击窗格时聚焦                            |
| `ai-sidebar-terminal.pane.showPaneActions`    | boolean | `true`          | 显示窗格操作按钮（分割、关闭）            |
| `ai-sidebar-terminal.pane.renderer`           | string  | `"auto"`        | 渲染器：`webgl`、`canvas` 或 `auto`       |

### 示例配置

```json
{
  "ai-sidebar-terminal.fontSize": 12,
  "ai-sidebar-terminal.fontFamily": "'JetBrainsMono Nerd Font', monospace",
  "ai-sidebar-terminal.cursorBlink": true,
  "ai-sidebar-terminal.cursorStyle": "block",
  "ai-sidebar-terminal.scrollback": 10000,
  "ai-sidebar-terminal.enableHttpApi": true,
  "ai-sidebar-terminal.httpTimeout": 5000,
  "ai-sidebar-terminal.autoShareContext": true,
  "ai-sidebar-terminal.defaultAiTool": "opencode"
}
```

## 环境要求

- VS Code 1.106.0 或更高版本
- Node.js 20.0.0 或更高版本
- 至少一个受支持的 AI 工具已安装且可通过命令行访问

## 开发

### 构建命令

```bash
npm run compile         # 开发构建
npm run watch           # 监听模式
npm run package         # 生产构建
npm run test            # 运行测试
npm run test:watch      # 监听模式测试
npm run test:coverage   # 运行测试并输出覆盖率
npm run lint            # 代码检查
npm run format          # 代码格式化
```

### 项目结构

```
src/
├── extension.ts                         # VS Code 入口（activate/deactivate）
├── types.ts                             # 宿主↔WebView 消息契约
├── core/
│   ├── ExtensionLifecycle.ts            # 服务编排 + 激活/停用
│   └── commands/                        # 命令注册
│       ├── index.ts                     # registerCommands() 编排器
│       └── terminalCommands.ts          # 启动、粘贴、文件引用
├── providers/
│   ├── TerminalProvider.ts              # 主侧边栏终端 WebView 提供者
│   ├── MessageRouter.ts                 # 消息分发 + 处理器
│   ├── SessionRuntime.ts                # 启动/重启/实例切换
│   └── CodeActionProvider.ts            # 诊断代码操作提供者
├── terminals/
│   └── TerminalManager.ts              # node-pty 进程生命周期
├── services/
│   ├── InstanceStore.ts                # 内存实例状态 + EventEmitter
│   ├── InstanceController.ts           # 实例生命周期编排
│   ├── InstanceDiscoveryService.ts     # 运行实例发现 + 自动拉起
│   ├── InstanceRegistry.ts             # 实例持久化（globalState）
│   ├── ConnectionResolver.ts           # 4 层端口解析 + 客户端池
│   ├── OpenCodeApiClient.ts            # HTTP 客户端（重试/退避）
│   ├── PortManager.ts                  # 临时端口分配
│   ├── NativeTerminalManager.ts         # 原生终端后端
│   ├── terminalBackends.ts              # 后端注册表
│   ├── PaneStore.ts                     # 窗格状态管理
│   ├── DataThrottleService.ts           # 批量窗格数据投递
│   ├── ContextManager.ts               # 活动编辑器/选区观察者
│   ├── ContextSharingService.ts        # @file#L 上下文格式化器
│   ├── FileReferenceManager.ts         # 文件引用序列化
│   ├── InstanceQuickPick.ts            # 实例选择 QuickPick UI
│   ├── OutputChannelService.ts         # 单例日志服务
│   ├── OutputCaptureManager.ts         # 终端输出捕获
│   └── aiTools/                        # AI 工具操作符系统
├── webview/
│   ├── main.ts                         # 终端启动（xterm.js + WebGL）
│   ├── pane-manager.ts                 # 多窗格生命周期
│   ├── pane-message-router.ts          # 窗格消息路由
│   ├── layout/                         # 布局引擎（多窗格）
│   ├── tab-bar/                        # 标签栏 UI
│   ├── pane-actions/                   # 窗格操作按钮
│   ├── focus/                          # 聚焦管理
│   ├── toolbar/                        # 工具栏按钮
│   ├── clipboard/                      # 剪贴板处理
│   ├── terminal/                       # 终端容器、键盘、AI 选择器
│   └── messages/                       # 宿主消息处理
├── utils/
└── test/mocks/
    ├── vscode.ts                       # VS Code API 模拟
    └── node-pty.ts                     # node-pty 模拟
```

## 实现细节

基于 vscode-sidebar-terminal 扩展，针对 AI 侧边栏终端进行精简：

- **终端后端**: node-pty PTY 支持
- **终端前端**: xterm.js + WebGL 渲染
- **进程管理**: 自动 AI 工具生命周期管理
- **通信**: HTTP API + WebView 消息传递
- **端口管理**: 临时端口分配（16384-65535）

## 许可证

MIT — 详见 [LICENSE](LICENSE)。

# Opencode Sidebar TUI

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/sagez.opencode-sidebar-tui-sage?logo=visual-studio-code&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=sagez.opencode-sidebar-tui-sage)
[English](https://github.com/sage-z-cn/opencode-sidebar-tui/blob/main/README.md)


Automatically render Opencode Sidebar Terminal in VS Code sidebar with full terminal support.

> 本插件是 [islee23520/opencode-sidebar-tui](https://github.com/islee23520/opencode-sidebar-tui) 的 fork 版本，增加了 Windows 兼容性修复。

## Fork 修改记录

详见 [CHANGELOG.md](https://github.com/sage-z-cn/opencode-sidebar-tui/blob/main/CHANGELOG.md) 中 v2.0.0 及之后的更新日志。

## 功能特性

- **自动启动 OpenCode**: 侧边栏激活时自动启动 OpenCode
- **完整 TUI 支持**: xterm.js + WebGL 渲染的终端模拟
- **多 AI 工具支持**: 可配置切换 OpenCode、Claude、Codex 及自定义 AI 工具
- **终端管理器**: 专用的 tmux 会话管理面板，支持内联窗格和窗口控制
- **Tmux 集成**: 自动发现 tmux 会话、工作区级过滤、侧边栏中隐藏 tmux 状态栏
- **原生 Shell 切换**: 在同一终端中切换 OpenCode 和原生 Shell
- **返回工作区横幅**: 在终端管理器中快速返回活动工作区
- **HTTP API 集成**: 通过 HTTP API 与 OpenCode CLI 双向通信
- **自动上下文共享**: 终端打开时自动共享编辑器上下文
- **带行号的文件引用**: 以 `@filename#L10-L20` 语法发送文件引用
- **代码操作**: 对错误和警告触发诊断代码操作
- **键盘快捷键**: `Cmd+Alt+L`、`Cmd+Alt+A`、`Cmd+Alt+T` 快速操作
- **拖放支持**: 按住 Shift 拖放文件/文件夹发送引用
- **右键菜单集成**: 在资源管理器或编辑器中右键发送到 OpenCode
- **辅助侧边栏**: 将终端停靠在辅助侧边栏实现分屏工作流
- **高度可配置**: 自定义命令、字体、终端设置、HTTP API 行为和 AI 工具偏好

## 架构

本扩展提供**仅侧边栏**的终端体验。OpenCode 内嵌在 VS Code 侧边栏活动栏中运行，而非原生 VS Code 终端面板。

扩展包含两个主要侧边栏视图：

1. **OpenCode 终端**（辅助侧边栏）：主要的交互式 TUI 会话。
2. **终端管理器**：用于管理 tmux 会话、窗格和窗口的专用面板。

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
git clone https://github.com/sage-z-cn/opencode-sidebar-tui.git
cd opencode-sidebar-tui
```

2. 安装依赖：

```bash
npm install
```

3. 构建扩展：

```bash
npm run compile
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

1. 点击活动栏中的 OpenCode 图标打开终端管理器
2. 在辅助侧边栏中使用 Open Sidebar Terminal
3. 终端视图激活时自动启动
4. 直接在侧边栏中与 OpenCode 交互

## 命令

### 基础命令

- **Open Sidebar Terminal: Start OpenCode** - 手动启动 OpenCode
- **Open Sidebar Terminal: Paste** - 粘贴文本到终端

### 文件引用命令

- **Send File Reference (@file)** (`Cmd+Alt+L` / `Ctrl+Alt+L`) - 发送当前文件及行号
  - 无选中：`@filename`
  - 单行：`@filename#L10`
  - 多行：`@filename#L10-L20`
- **Send All Open File References** (`Cmd+Alt+A` / `Ctrl+Alt+A`) - 发送所有打开的文件引用
- **Send to OpenCode** - 通过右键菜单发送选中文本或文件
- **Send to Active Terminal** - 发送选中文本到活动终端

### Tmux 会话命令

- **Open Tmux Session in New Window** - 在新 VS Code 窗口中打开当前 tmux 会话
- **Spawn Tmux Session for Workspace** - 为当前工作区创建新的 tmux 会话
- **Select OpenCode Tmux Session** - 从可用 tmux 会话列表中选择
- **Switch Tmux Session** - 切换到其他 tmux 会话
- **Browse Tmux Sessions** (`Cmd+Alt+T` / `Ctrl+Alt+T`) - 浏览和切换 tmux 会话
- **Switch to Native Shell** - 在 OpenCode 和原生 Shell 之间切换
- **Open Terminal Managers** - 打开终端管理器视图

### Tmux 窗格命令

- **Switch to Pane** - 切换到指定 tmux 窗格
- **Split Pane Horizontal** - 水平分割当前窗格
- **Split Pane Vertical** - 垂直分割当前窗格
- **Split Pane with Command** - 分割窗格并运行指定命令
- **Send Text to Pane** - 发送文本到指定 tmux 窗格
- **Resize Pane** - 调整当前 tmux 窗格大小
- **Swap Panes** - 交换两个 tmux 窗格位置
- **Kill Pane** - 关闭当前 tmux 窗格

### Tmux 窗口命令

- **Next Window** - 切换到下一个 tmux 窗口
- **Previous Window** - 切换到上一个 tmux 窗口
- **Create Window** - 创建新的 tmux 窗口
- **Select Window** - 选择 tmux 窗口
- **Kill Window** - 关闭当前 tmux 窗口
- **Kill Session** - 终止当前 tmux 会话
- **Refresh Terminal Manager** - 刷新终端管理器

### 键盘快捷键

| 快捷键                    | 功能              | 适用场景                  |
| ------------------------- | ----------------- | ------------------------- |
| `Cmd+Alt+L` / `Ctrl+Alt+L` | 发送文件引用      | 编辑器或终端              |
| `Cmd+Alt+A` / `Ctrl+Alt+A` | 发送所有打开文件  | 编辑器或终端              |
| `Cmd+Alt+T` / `Ctrl+Alt+T` | 浏览 Tmux 会话    | 终端聚焦时                |
| `Cmd+V` / `Ctrl+V`         | 粘贴              | 终端聚焦时                |
| `Ctrl+P`                   | 快速打开（原生）  | 终端聚焦时（透传）        |

### 右键菜单

- **资源管理器**: 右键任意文件或文件夹 → "Send to OpenCode"
- **编辑器**: 右键任意位置 → "Send File Reference (@file)"

### 拖放

- 按住 **Shift** 拖动文件/文件夹到终端，以 `@file` 引用方式发送

## 终端管理器

终端管理器视图在 VS Code 侧边栏中提供高级 tmux 会话和窗格管理：

- **会话发现**: 自动检测系统中的现有 tmux 会话。
- **工作区过滤**: 过滤会话仅显示与当前工作区相关的。
- **窗格控制**: 内联按钮用于分割窗格（水平/垂直）、切换焦点、调整大小、交换和终止窗格。
- **窗口控制**: 导航、创建、选择和终止 tmux 窗口。
- **返回工作区**: 快速访问横幅，导航回活动工作区会话。
- **整洁 UI**: tmux 状态栏在侧边栏终端中自动隐藏以最大化垂直空间。

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

| 设置                          | 类型    | 默认值            | 描述                                      |
| ----------------------------- | ------- | ----------------- | ----------------------------------------- |
| `ost.autoStart`       | boolean | `true`            | 视图激活时自动启动 OpenCode              |
| `ost.autoStartOnOpen` | boolean | `true`            | 侧边栏打开时自动启动 OpenCode            |
| `ost.fontSize`        | number  | `14`              | 终端字号（像素，6-25）                    |
| `ost.fontFamily`      | string  | Nerd Font 字体栈* | 终端字体族                                |
| `ost.cursorBlink`     | boolean | `true`            | 启用光标闪烁                              |
| `ost.cursorStyle`     | string  | `"block"`         | 光标样式：`block`、`underline`、`bar`     |
| `ost.scrollback`      | number  | `10000`           | 回滚缓冲区最大行数（0-100000）            |
| `ost.autoFocusOnSend` | boolean | `true`            | 发送文件引用后自动聚焦侧边栏              |
| `ost.shellPath`       | string  | `""`              | 自定义 Shell 路径（空 = VS Code 默认）    |
| `ost.shellArgs`       | array   | `[]`              | 自定义 Shell 参数                         |

\* 默认：`'JetBrainsMono Nerd Font', 'FiraCode Nerd Font', 'CascadiaCode NF', Menlo, monospace`

### HTTP API 设置

| 设置                             | 类型    | 默认值  | 描述                                        |
| -------------------------------- | ------- | ------- | ------------------------------------------- |
| `ost.enableHttpApi`     | boolean | `true`  | 启用 OpenCode 通信的 HTTP API               |
| `ost.httpTimeout`       | number  | `5000`  | HTTP API 请求超时（毫秒，1000-30000）        |
| `ost.autoShareContext`  | boolean | `true`  | 自动共享编辑器上下文给 OpenCode             |
| `ost.contextDebounceMs` | number  | `500`   | 上下文更新防抖延迟（毫秒，100-5000）        |

### AI 工具设置

| 设置                          | 类型    | 默认值                        | 描述                                      |
| ----------------------------- | ------- | ----------------------------- | ----------------------------------------- |
| `ost.aiTools`         | array   | `[{opencode, claude, codex}]` | 配置 AI 工具及其自定义路径和参数          |
| `ost.defaultAiTool`   | string  | `"opencode"`                  | 新 tmux 会话的默认 AI 工具                |
| `ost.enableAutoSpawn` | boolean | `true`                        | OpenCode 未运行时自动拉起                 |

### Tmux 设置

| 设置                               | 类型    | 默认值  | 描述                                                            |
| ---------------------------------- | ------- | ------- | --------------------------------------------------------------- |
| `ost.nativeShellDefault`  | string  | `""`    | 原生 Shell 切换默认行为（`""`、`"opencode"`、`"shell"`）        |
| `ost.tmuxSessionDefault`  | string  | `""`    | 新 tmux 会话默认行为（`""`、`"opencode"`、`"shell"`）           |
| `ost.showTmuxWindowControls` | boolean | `true` | 在终端工具栏中显示直接 tmux 会话/窗口控制                        |

### 高级设置

| 设置                               | 类型   | 默认值                 | 描述                                     |
| ---------------------------------- | ------ | ---------------------- | ---------------------------------------- |
| `ost.logLevel`            | string | `"info"`               | 日志级别：`debug`、`info`、`warn`、`error` |
| `ost.maxDiagnosticLength` | number | `500`                  | 诊断消息最大长度（100-2000）              |
| `ost.codeActionSeverities` | array  | `["error", "warning"]` | 触发代码操作的诊断严重级别                |

### 示例配置

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

## 环境要求

- VS Code 1.106.0 或更高版本
- Node.js 20.0.0 或更高版本
- OpenCode 已安装且可通过 `opencode` 命令访问

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
├── types.test.ts                        # 类型契约测试
├── core/
│   ├── ExtensionLifecycle.ts            # 服务编排 + 激活/停用
│   └── commands/                        # 命令注册
│       ├── index.ts                     # registerCommands() 编排器
│       ├── terminalCommands.ts          # 启动、重启、粘贴、文件引用
│       ├── tmuxSessionCommands.ts       # 会话切换、创建、拉起、浏览
│       └── tmuxPaneCommands.ts          # 窗格 + 窗口命令 + QuickPick 辅助
├── providers/
│   ├── TerminalProvider.ts              # 主侧边栏终端 WebView 提供者
│   ├── TerminalProvider.test.ts         # 提供者测试
│   ├── TerminalDashboardProvider.ts     # 终端管理器提供者
│   ├── TerminalDashboardProvider.test.ts # 仪表盘测试
│   ├── CodeActionProvider.ts            # 诊断代码操作提供者
│   ├── CodeActionProvider.test.ts       # 代码操作测试
│   └── opencode/                        # 终端核心模块
│       ├── OpenCodeMessageRouter.ts     # 消息分发 + 处理器
│       └── OpenCodeSessionRuntime.ts    # 启动/重启/tmux/实例切换
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
│   ├── TmuxSessionManager.ts           # tmux CLI 封装（会话、窗格、窗口）
│   ├── ContextManager.ts               # 活动编辑器/选区观察者
│   ├── ContextSharingService.ts        # @file#L 上下文格式化器
│   ├── FileReferenceManager.ts         # 文件引用序列化
│   ├── InstanceQuickPick.ts            # 实例选择 QuickPick UI
│   ├── OutputChannelService.ts         # 单例日志服务
│   └── OutputCaptureManager.ts         # 终端输出捕获
├── webview/
│   ├── main.ts                         # 终端 WebView（xterm.js + WebGL）
│   ├── terminal.html                   # 终端 WebView HTML
│   ├── terminal.css                    # 终端 WebView 样式
│   ├── dashboard-manager.ts            # 仪表盘 WebView 逻辑
│   ├── dashboard.html                  # 仪表盘 WebView HTML
│   └── dashboard.css                   # 仪表盘 WebView 样式
├── utils/
│   └── PromptFormatter.ts              # 提示文本格式化工具
├── test/
│   └── mocks/
│       ├── vscode.ts                   # VS Code API 模拟
│       └── node-pty.ts                 # node-pty 模拟
└── __tests__/
    └── setup.ts                        # Vitest 全局设置
```

## 实现细节

基于 vscode-sidebar-terminal 扩展，针对 Open Sidebar Terminal 进行精简：

- **终端后端**: node-pty PTY 支持
- **终端前端**: xterm.js + WebGL 渲染
- **进程管理**: 自动 OpenCode 生命周期管理
- **通信**: HTTP API + WebView 消息传递
- **端口管理**: 临时端口分配（16384-65535）

## 上游同步

本 fork 维护一个 `origin-main` 分支用于镜像上游仓库。参阅 [SYNC_UPSTREAM.md](SYNC_UPSTREAM.md) 了解同步工作流。

## 许可证

MIT — 详见 [LICENSE](LICENSE)。


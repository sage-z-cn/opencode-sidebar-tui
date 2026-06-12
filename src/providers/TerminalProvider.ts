import * as vscode from "vscode";
import { l10n } from "../i18n";
import { TerminalManager } from "../terminals/TerminalManager";
import { OutputCaptureManager } from "../services/OutputCaptureManager";
import { OpenCodeApiClient } from "../services/OpenCodeApiClient";
import { PortManager } from "../services/PortManager";
import { ContextSharingService } from "../services/ContextSharingService";
import { OutputChannelService } from "../services/OutputChannelService";
import { DataThrottleService } from "../services/DataThrottleService";
import { InstanceId, InstanceStore } from "../services/InstanceStore";
import { PaneStore } from "../services/PaneStore";
import { AiToolFileReference } from "../services/aiTools/AiToolOperator";
import {
  AiToolConfig,
  HostMessage,
  TerminalBackendType,
  resolveAiToolConfigs,
} from "../types";
import { AiToolOperatorRegistry } from "../services/aiTools/AiToolOperatorRegistry";
import { MessageRouter, MessageRouterProviderBridge } from "./MessageRouter";
import { SessionRuntime } from "./SessionRuntime";
import { renderTerminalHtml } from "../webview/terminal/html";
import { NativeTerminalManager } from "../services/NativeTerminalManager";
import { TerminalBackendRegistry } from "../services/terminalBackends";

export class TerminalProvider
  implements vscode.WebviewViewProvider, vscode.WebviewPanelSerializer
{
  public static readonly viewType = "ai-sidebar-terminal-view";
  public static readonly panelViewType = "ai-sidebar-terminal.terminalEditor";

  private _view?: vscode.WebviewView;
  private _panel?: vscode.WebviewPanel;
  private readonly contextSharingService: ContextSharingService;
  private readonly logger = OutputChannelService.getInstance();
  private readonly aiToolRegistry: AiToolOperatorRegistry;
  private readonly sessionRuntime: SessionRuntime;
  private readonly messageRouter: MessageRouter;
  private readonly dataThrottleService: DataThrottleService;
  private readonly paneStore = new PaneStore();
  private readonly pendingWebviewMessages: HostMessage[] = [];
  private pendingQueueablePostChecks = 0;
  private static readonly DEFAULT_PANE_ID = "default";
  private static readonly DEFAULT_TAB_ID = "default";

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly terminalManager: TerminalManager,
    private readonly captureManager: OutputCaptureManager,
    private readonly portManager: PortManager = PortManager.getInstance(),
    private readonly instanceStore?: InstanceStore,
    private readonly backendRegistry: TerminalBackendRegistry = new TerminalBackendRegistry(),
    private readonly nativeTerminalManager?: NativeTerminalManager,
  ) {
    this.contextSharingService = new ContextSharingService();
    this.aiToolRegistry = new AiToolOperatorRegistry();
    this.dataThrottleService = new DataThrottleService((batch) => {
      for (const item of batch) {
        this.postWebviewMessageNow({
          type: "terminalOutput",
          data: item.data,
          paneId: item.paneId,
        });
      }
    });

    this.sessionRuntime = new SessionRuntime(
      this.terminalManager,
      this.captureManager,
      undefined,
      this.portManager,
      this.backendRegistry,
      this.instanceStore,
      this.logger,
      this.contextSharingService,
      this.aiToolRegistry,
      {
        postMessage: (message) => this.postWebviewMessage(message),
        onActiveInstanceChanged: (instanceId) => {
          void this.switchToInstance(instanceId);
        },
        requestStartOpenCode: () => this.startOpenCode(),
        showAiToolSelector: (sessionId, sessionName, forceShow) =>
          this.showAiToolSelector(sessionId, sessionName, forceShow),
      },
      this.nativeTerminalManager,
    );

    const routerBridge: MessageRouterProviderBridge = {
      startOpenCode: () => this.startOpenCode(),
      restart: () => this.restart(),
      openSettings: () => this.openSettings(),
      openKeyboardShortcuts: () => this.openKeyboardShortcuts(),
      pasteText: (text) => this.pasteText(text),
      getActiveInstanceId: () => this.getActiveInstanceId(),
      setLastKnownTerminalSize: (cols, rows) =>
        this.setLastKnownTerminalSize(cols, rows),
      getLastKnownTerminalSize: () => this.getLastKnownTerminalSize(),
      isStarted: () => this.isStarted(),
      resizeActiveTerminal: (cols, rows) =>
        this.resizeActiveTerminal(cols, rows),
      getActiveTerminalId: () => this.activeTerminalId,
      postWebviewMessage: (message) => this.postWebviewMessage(message),
      formatDroppedFiles: (paths, useAtSyntax) =>
        this.sessionRuntime.formatDroppedFiles(paths, { useAtSyntax }),
      formatPastedImage: (tempPath) =>
        this.sessionRuntime.formatPastedImage(tempPath),
      launchAiTool: (sessionId, toolName, savePreference, targetPaneId) =>
        this.launchAiTool(sessionId, toolName, savePreference, targetPaneId),
      showAiToolSelector: (sessionId, sessionName, forceShow, targetPaneId) =>
        Promise.resolve(
          this.showAiToolSelector(
            sessionId,
            sessionName,
            forceShow,
            targetPaneId,
          ),
        ),
    };

    this.messageRouter = new MessageRouter(
      routerBridge,
      this.context,
      this.terminalManager,
      this.captureManager,
      this.getApiClient(),
      this.contextSharingService,
      this.logger,
      this.instanceStore,
    );
  }

  private get activeInstanceId(): InstanceId {
    return this.sessionRuntime.getActiveInstanceId();
  }

  private get activeTerminalId(): string {
    return this.sessionRuntime.getActiveTerminalId();
  }

  public get lastKnownCols(): number {
    return this.sessionRuntime.getLastKnownTerminalSize().cols;
  }

  public set lastKnownCols(cols: number) {
    const size = this.sessionRuntime.getLastKnownTerminalSize();
    this.sessionRuntime.setLastKnownTerminalSize(cols, size.rows);
  }

  public get lastKnownRows(): number {
    return this.sessionRuntime.getLastKnownTerminalSize().rows;
  }

  public set lastKnownRows(rows: number) {
    const size = this.sessionRuntime.getLastKnownTerminalSize();
    this.sessionRuntime.setLastKnownTerminalSize(size.cols, rows);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    this.ensureDefaultPaneState();
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    const processAlive = this.sessionRuntime.hasLiveTerminalProcess();
    if (this.sessionRuntime.isStartedFlag() && !processAlive) {
      this.sessionRuntime.resetState();
    }

    webviewView.webview.onDidReceiveMessage((message) => {
      this.handleMessage(message);
    });

    if (processAlive) {
      this.sessionRuntime.reconnectListeners();
    }

    this.postTerminalConfig();
    this.postCurrentSessionState(webviewView.webview);
    this.flushPendingWebviewMessages(webviewView.webview);

    const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
    const autoStartOnOpen = config.get<boolean>("autoStartOnOpen", true);
    const visibilityListener = webviewView.onDidChangeVisibility(() => {
      if (!webviewView.visible) {
        return;
      }

      const hadPendingMessages =
        this.pendingWebviewMessages.length > 0 ||
        this.pendingQueueablePostChecks > 0;
      this.flushPendingWebviewMessages(webviewView.webview);
      if (!hadPendingMessages) {
        this.postWebviewVisibleForKnownPanes();
        this.postTerminalConfig();
      }

      if (autoStartOnOpen && !this.isStarted()) {
        if (this.getNativeRestoreRecord()) {
          void this.promptNativeRestore().then((restored) => {
            if (!restored) {
              void this.startOpenCode();
            }
          });
        } else {
          void this.startOpenCode();
        }
        visibilityListener.dispose();
      }
    });
    webviewView.onDidDispose(() => visibilityListener.dispose());

    if (autoStartOnOpen) {
      if (webviewView.visible) {
        if (!this.isStarted()) {
          if (this.getNativeRestoreRecord()) {
            void this.promptNativeRestore().then((restored) => {
              if (!restored) {
                void this.startOpenCode();
              }
            });
          } else {
            void this.startOpenCode();
          }
        }
      }
    } else if (webviewView.visible && !this.isStarted()) {
      void this.promptNativeRestore();
    }
  }

  public focus(): void {
    this._panel?.reveal(vscode.ViewColumn.Active);
    this.postWebviewMessage({
      type: "focusTerminal",
      paneId: this.getFocusedPaneId(),
    });
  }

  public async toggleEditorAttachment(): Promise<void> {
    const currentPanel = this._panel;
    if (currentPanel) {
      this._panel = undefined;
      currentPanel.dispose();
      this.postTerminalConfig();
      await this.revealSidebarView();
      return;
    }

    this.openInEditorTab();
  }

  public async openInEditorTab(): Promise<void> {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Active);
      this.focus();
      return;
    }

    const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");

    if (config.get<boolean>("collapseSecondaryBarOnEditorOpen", true)) {
      await vscode.commands.executeCommand(
        "workbench.action.closeAuxiliaryBar",
      );
    }

    const panel = vscode.window.createWebviewPanel(
      TerminalProvider.panelViewType,
      "Open Sidebar Terminal",
      vscode.ViewColumn.Beside,
      this.getEditorPanelOptions(),
    );

    this.initializeEditorPanel(panel);

    await vscode.commands.executeCommand("workbench.action.lockEditorGroup");
  }

  public async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    _state: unknown,
  ): Promise<void> {
    this.initializeEditorPanel(webviewPanel);
  }

  public formatFileReference(reference: AiToolFileReference): string {
    return this.sessionRuntime.formatFileReference(reference);
  }

  public formatUriReference(uri: vscode.Uri): string {
    return this.formatFileReference({
      path: vscode.workspace.asRelativePath(uri, false),
    });
  }

  public formatEditorReference(editor: vscode.TextEditor): string {
    const relativePath = vscode.workspace.asRelativePath(
      editor.document.uri,
      false,
    );
    const selection = editor.selection;
    return this.formatFileReference({
      path: relativePath,
      selectionStart: selection.isEmpty ? undefined : selection.start.line + 1,
      selectionEnd: selection.isEmpty ? undefined : selection.end.line + 1,
    });
  }

  public pasteText(text: string): void {
    this.postWebviewMessage({
      type: "clipboardContent",
      text,
    });
  }

  public requestPaste(): void {
    this.postWebviewMessage({
      type: "requestPaste",
    });
  }

  public getApiClient(): OpenCodeApiClient | undefined {
    return this.sessionRuntime.getApiClient();
  }

  public isHttpAvailable(): boolean {
    return this.sessionRuntime.isHttpAvailable();
  }

  public async startOpenCode(): Promise<void> {
    await this.sessionRuntime.startOpenCode();
  }

  public restart(): void {
    this.sessionRuntime.restart();
  }

  public openSettings(): void {
    vscode.commands.executeCommand("workbench.action.openSettings", "ai-sidebar-terminal.");
  }

  public openKeyboardShortcuts(): void {
    vscode.commands.executeCommand(
      "workbench.action.openGlobalKeybindings",
      "@ext:sagez.ai-sidebar-terminal",
    );
  }

  public async switchToInstance(
    instanceId: InstanceId,
    options?: { forceRestart?: boolean },
  ): Promise<void> {
    await this.sessionRuntime.switchToInstance(instanceId, options);
  }

  public async sendPrompt(prompt: string): Promise<void> {
    const apiClient = this.sessionRuntime.getApiClient();
    if (apiClient && this.sessionRuntime.isHttpAvailable()) {
      try {
        await apiClient.appendPrompt(prompt);
        return;
      } catch (error) {
        this.logger.warn(
          `HTTP API send failed, falling back to terminal write: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.terminalManager.writeToTerminal(this.activeTerminalId, prompt);
  }

  public async launchAiTool(
    sessionId: string,
    toolName: string,
    savePreference: boolean,
    targetPaneId?: string,
  ): Promise<void> {
    if (savePreference) {
      const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
      await config.update(
        "defaultAiTool",
        toolName,
        vscode.ConfigurationTarget.Global,
      );
    }

    const tool = this.sessionRuntime.resolveToolByName(toolName);
    if (!tool) {
      return;
    }

    const instanceId =
      this.sessionRuntime.resolveInstanceIdFromSessionId(sessionId);
    this.sessionRuntime.rememberSelectedTool(tool.name, instanceId);

    void this.sessionRuntime.switchToInstance(instanceId, {
      forceRestart: true,
      preferredToolName: toolName,
    });
  }

  private handleMessage(message: unknown): void {
    if (this.isPaneScopedWebviewMessage(message)) {
      this.dataThrottleService.setFocusedPane(this.normalizePaneId(message.paneId));
    }

    if (this.isPaneCreateWebviewMessage(message)) {
      void this.handlePaneCreate(message);
      return;
    }

    if (this.isPaneDeleteWebviewMessage(message)) {
      this.handlePaneDelete(message);
      return;
    }

    if (this.isNonDefaultReadyMessage(message)) {
      void this.handleNonDefaultPaneReady(message);
      return;
    }

    this.messageRouter.handleMessage(message);
  }

  public showAiToolSelector(
    sessionId: string,
    sessionName: string,
    forceShow = false,
    targetPaneId?: string,
  ): void {
    const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
    if (forceShow && !config.get<boolean>("promptAiToolOnSession", true)) {
      return;
    }
    const instanceId =
      this.sessionRuntime.resolveInstanceIdFromSessionId(sessionId);
    const savedTool =
      this.instanceStore?.get(instanceId)?.config.selectedAiTool ??
      config.get<string>("defaultAiTool", "");
    const tools: AiToolConfig[] = resolveAiToolConfigs(
      config.get("aiTools", []),
    );
    if (!forceShow && savedTool) {
      void this.launchAiTool(
        sessionId,
        savedTool,
        false,
        targetPaneId,
      );
      return;
    }
    this.postWebviewMessage({
      type: "showAiToolSelector",
      sessionId,
      sessionName,
      defaultTool: undefined,
      tools,
      targetPaneId,
    });
  }

  private getNativeRestoreRecord():
    | ReturnType<InstanceStore["getActive"]>
    | undefined {
    let record: ReturnType<InstanceStore["getActive"]> | undefined;
    try {
      record = this.instanceStore?.getActive();
    } catch (error) {
      this.logger.info(
        `[TerminalProvider] Native restore skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }

    if (
      !record ||
      record.state !== "disconnected" ||
      !record.config.selectedAiTool
    ) {
      return undefined;
    }

    return record;
  }

  private async promptNativeRestore(): Promise<boolean> {
    const record = this.getNativeRestoreRecord();

    if (!record) {
      return false;
    }

    const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
    const selectedAiTool = record.config.selectedAiTool!;
    const aiTools = resolveAiToolConfigs(config.get("aiTools", []));
    const toolExists = aiTools.some((tool) => tool.name === selectedAiTool);
    const toolToUse = toolExists
      ? selectedAiTool
      : config.get<string>("defaultAiTool", "opencode");

    this.logger.info(
      `[TerminalProvider] Auto-restoring native terminal for ${record.config.id} with ${toolToUse}${
        !toolExists ? ` (previous tool ${selectedAiTool} no longer configured, using default)` : ""
      }`,
    );

    this.sessionRuntime.rememberSelectedTool(toolToUse, record.config.id);
    await this.sessionRuntime.startOpenCode();
    return true;
  }

  private resizeActiveTerminal(cols: number, rows: number): void {
    this.terminalManager.resizeTerminal(this.activeTerminalId, cols, rows);
  }

  private async handlePaneCreate(message: {
    paneId?: string;
    direction?: "horizontal" | "vertical";
  }): Promise<void> {
    const paneId = this.normalizePaneId(message.paneId);
    if (paneId === TerminalProvider.DEFAULT_PANE_ID) {
      this.ensureDefaultPaneState();
      return;
    }

    this.ensureDefaultPaneState();
    if (this.paneStore.getPane(paneId)) {
      this.setFocusedPane(paneId);
      return;
    }

    this.paneStore.addPane({
      paneId,
      tabId: this.paneStore.getActiveTab() ?? TerminalProvider.DEFAULT_TAB_ID,
      isActive: true,
      size: 100,
      splitDirection: message.direction,
    });
    this.setFocusedPane(paneId);

    try {
      await this.sessionRuntime.createSession(paneId, {
        paneId,
      });
    } catch (error) {
      this.logger.error(
        `[TerminalProvider] Failed to create pane session '${paneId}': ${error instanceof Error ? error.message : String(error)}`,
      );
      this.paneStore.removePane(paneId);
      this.setFocusedPane(this.getFocusedPaneId());
      this.postWebviewMessage({
        type: "terminalExited",
        paneId,
      });
    }
  }

  private handlePaneDelete(message: { paneId?: string }): void {
    const paneId = this.normalizePaneId(message.paneId);
    if (paneId === TerminalProvider.DEFAULT_PANE_ID) {
      return;
    }

    this.sessionRuntime.destroySession(paneId);
    this.paneStore.removePane(paneId);
    this.setFocusedPane(this.resolveNextPaneId());
    this.postWebviewMessage({
      type: "focusTerminal",
      paneId: this.getFocusedPaneId(),
    });
  }

  private async handleNonDefaultPaneReady(message: {
    cols: number;
    rows: number;
    paneId?: string;
  }): Promise<void> {
    const paneId = this.normalizePaneId(message.paneId);

    this.ensureDefaultPaneState();
    if (!this.paneStore.getPane(paneId)) {
      this.paneStore.addPane({
        paneId,
        tabId: this.paneStore.getActiveTab() ?? TerminalProvider.DEFAULT_TAB_ID,
        isActive: true,
        size: 100,
      });
    }
    this.setFocusedPane(paneId);

    if (!this.sessionRuntime.getSession(paneId)) {
      await this.sessionRuntime.createSession(paneId, {
        paneId,
      });
    }

    this.messageRouter.handleTerminalResize(message.cols, message.rows, paneId);
    this.postPlatformInfo();
  }

  private getActiveInstanceId(): InstanceId {
    return this.activeInstanceId;
  }

  private setLastKnownTerminalSize(cols: number, rows: number): void {
    this.sessionRuntime.setLastKnownTerminalSize(cols, rows);
  }

  private getLastKnownTerminalSize(): { cols: number; rows: number } {
    return this.sessionRuntime.getLastKnownTerminalSize();
  }

  private isStarted(): boolean {
    return this.sessionRuntime.isStartedFlag();
  }

  private postWebviewMessage(message: unknown): void {
    if (this.isTerminalOutputHostMessage(message)) {
      this.dataThrottleService.push(
        this.normalizePaneId(message.paneId),
        message.data,
      );
      return;
    }

    if (this.isPaneScopedHostMessage(message)) {
      const paneId = this.normalizePaneId(message.paneId);
      if (message.type === "focusTerminal" || message.type === "webviewVisible") {
        this.dataThrottleService.setFocusedPane(paneId);
        this.dataThrottleService.flush();
      }

      this.postWebviewMessageNow({
        ...message,
        paneId,
      });
      return;
    }

    this.postWebviewMessageNow(message);
  }

  private postPlatformInfo(): void {
    this.postWebviewMessage({
      type: "platformInfo",
      platform: process.platform,
      activeBackend: "native" as TerminalBackendType,
    });
  }

  private postWebviewVisibleForKnownPanes(): void {
    for (const paneId of this.getKnownPaneIds()) {
      this.postWebviewMessage({
        type: "webviewVisible",
        paneId,
      });
    }
  }

  private postWebviewMessageNow(message: unknown): void {
    const webview = this._panel?.webview ?? this._view?.webview;
    if (webview) {
      const postResult = webview.postMessage(message) as
        | boolean
        | Thenable<boolean>;
      if (this.isThenablePostResult(postResult)) {
        if (this.isQueueableHostMessage(message)) {
          this.pendingQueueablePostChecks += 1;
        }
        void postResult.then((delivered) => {
          if (this.isQueueableHostMessage(message)) {
            this.pendingQueueablePostChecks = Math.max(
              0,
              this.pendingQueueablePostChecks - 1,
            );
          }
          if (!delivered && this.isQueueableHostMessage(message)) {
            this.replacePendingWebviewMessage(message);
            if (this.isWebviewVisible()) {
              this.flushPendingWebviewMessages(webview);
            }
          }
        });
        return;
      }

      if (!postResult && this.isQueueableHostMessage(message)) {
        this.replacePendingWebviewMessage(message);
      }
      return;
    }

    if (this.isQueueableHostMessage(message)) {
      this.replacePendingWebviewMessage(message);
    }
  }

  private isWebviewVisible(): boolean {
    return this._panel?.visible === true || this._view?.visible === true;
  }

  private isThenablePostResult(
    value: boolean | Thenable<boolean>,
  ): value is Thenable<boolean> {
    return typeof value === "object" && value !== null && "then" in value;
  }

  private isTerminalOutputHostMessage(
    message: unknown,
  ): message is Extract<HostMessage, { type: "terminalOutput" }> {
    return (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "terminalOutput" &&
      "data" in message &&
      typeof message.data === "string"
    );
  }

  private isPaneScopedHostMessage(
    message: unknown,
  ): message is Extract<
    HostMessage,
    {
      type:
        | "terminalExited"
        | "clearTerminal"
        | "focusTerminal"
        | "webviewVisible";
    }
  > {
    return (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      (message.type === "terminalExited" ||
        message.type === "clearTerminal" ||
        message.type === "focusTerminal" ||
        message.type === "webviewVisible")
    );
  }

  private normalizePaneId(paneId: string | undefined): string {
    return paneId ?? TerminalProvider.DEFAULT_PANE_ID;
  }

  private isPaneScopedWebviewMessage(
    message: unknown,
  ): message is { paneId?: string } {
    return typeof message === "object" && message !== null && "type" in message;
  }

  private isPaneCreateWebviewMessage(
    message: unknown,
  ): message is { type: "paneCreate"; paneId?: string; direction?: "horizontal" | "vertical" } {
    return (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "paneCreate"
    );
  }

  private isPaneDeleteWebviewMessage(
    message: unknown,
  ): message is { type: "paneDelete"; paneId?: string } {
    return (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "paneDelete"
    );
  }

  private isNonDefaultReadyMessage(
    message: unknown,
  ): message is { type: "ready"; cols: number; rows: number; paneId?: string } {
    return (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "ready" &&
      this.normalizePaneId(
        "paneId" in message && typeof message.paneId === "string"
          ? message.paneId
          : undefined,
      ) !== TerminalProvider.DEFAULT_PANE_ID &&
      "cols" in message &&
      typeof message.cols === "number" &&
      "rows" in message &&
      typeof message.rows === "number"
    );
  }

  private isQueueableHostMessage(
    message: unknown,
  ): message is Extract<HostMessage, { type: "showAiToolSelector" }> {
    return (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "showAiToolSelector"
    );
  }

  private replacePendingWebviewMessage(message: HostMessage): void {
    const existingIndex = this.pendingWebviewMessages.findIndex(
      (pendingMessage) => pendingMessage.type === message.type,
    );
    if (existingIndex >= 0) {
      this.pendingWebviewMessages.splice(existingIndex, 1, message);
      return;
    }

    this.pendingWebviewMessages.push(message);
  }

  private flushPendingWebviewMessages(webview: vscode.Webview): void {
    const messages = this.pendingWebviewMessages.splice(0);
    for (const message of messages) {
      const postResult = webview.postMessage(message) as
        | boolean
        | Thenable<boolean>;
      if (this.isThenablePostResult(postResult)) {
        void postResult.then((delivered) => {
          if (!delivered && this.isQueueableHostMessage(message)) {
            this.replacePendingWebviewMessage(message);
          }
        });
      } else if (!postResult && this.isQueueableHostMessage(message)) {
        this.replacePendingWebviewMessage(message);
      }
    }
  }

  private postCurrentSessionState(webview: vscode.Webview): void {
    const activeTool = this.sessionRuntime.getActiveTool();
    const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
    const aiTools = resolveAiToolConfigs(config.get("aiTools", [])).map(
      (t) => ({ name: t.name, label: t.label }),
    );

    webview.postMessage({
      type: "activeSession",
      backend: "native" as TerminalBackendType,
      aiToolLabel: activeTool?.label,
      aiTools,
    });
  }

  private getEditorPanelOptions(): vscode.WebviewOptions &
    vscode.WebviewPanelOptions {
    return {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [this.context.extensionUri],
    };
  }

  private initializeEditorPanel(panel: vscode.WebviewPanel): void {
    this._panel = panel;
    panel.webview.options = this.getEditorPanelOptions();
    this.ensureDefaultPaneState();
    panel.webview.html = this.getHtmlForWebview(panel.webview);

    const processAlive = this.sessionRuntime.hasLiveTerminalProcess();
    if (this.sessionRuntime.isStartedFlag() && !processAlive) {
      this.sessionRuntime.resetState();
    }

    panel.webview.onDidReceiveMessage((message) => {
      this.handleMessage(message);
    });

    if (processAlive) {
      this.sessionRuntime.reconnectListeners();
    }

    this.postTerminalConfig();
    this.postCurrentSessionState(panel.webview);
    this.flushPendingWebviewMessages(panel.webview);

    panel.onDidDispose(() => {
      if (this._panel === panel) {
        this._panel = undefined;
        if (this._view) {
          this.postTerminalConfig();
          this.postWebviewVisibleForKnownPanes();
        }
      }
    });
  }

  private async revealSidebarView(): Promise<void> {
    try {
      await vscode.commands.executeCommand(
        "workbench.view.extension.ai-sidebar-terminalContainer",
      );
    } catch {
      // intentionally empty: sidebar reveal is best-effort
    }

    this._view?.show?.(true);
    this.postWebviewMessage({
      type: "focusTerminal",
      paneId: this.getFocusedPaneId(),
    });
  }

  private postTerminalConfig(): void {
    const terminalConfig = this.getTerminalConfig();
    this.postWebviewMessage({
      type: "terminalConfig",
      ...terminalConfig,
    });
  }

  private getTerminalConfig(): Omit<
    Extract<HostMessage, { type: "terminalConfig" }>,
    "type"
  > {
    const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
    return {
      fontSize: config.get<number>("fontSize", 14),
      fontFamily: config.get<string>(
        "fontFamily",
        "'JetBrainsMono Nerd Font', 'FiraCode Nerd Font', 'CascadiaCode NF', Menlo, monospace",
      ),
      cursorBlink: config.get<boolean>("cursorBlink", true),
      cursorStyle: config.get<"block" | "underline" | "bar">(
        "cursorStyle",
        "block",
      ),
      scrollback: config.get<number>("scrollback", 10000),
      sendKeybindingsToShell: config.get<boolean>(
        "sendKeybindingsToShell",
        true,
      ),
    };
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview
      .asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"),
      )
      .toString();
    const cssUri = webview
      .asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "terminal.css"),
      )
      .toString();
    const nonce = this.getNonce();
    const layoutCssUri = webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          "dist",
          "layout",
          "layout-engine.css",
        ),
      )
      .toString();
    const tabBarCssUri = webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          "dist",
          "tab-bar",
          "tab-bar.css",
        ),
      )
      .toString();
    const paneActionsCssUri = webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          "dist",
          "pane-actions",
          "pane-actions.css",
        ),
      )
      .toString();
    const focusManagerCssUri = webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          "dist",
          "focus",
          "focus-manager.css",
        ),
      )
      .toString();

    const terminalConfig = this.getTerminalConfig();

    const html = renderTerminalHtml({
      cspSource: webview.cspSource,
      nonce,
      cssUri,
      scriptUri,
      fontSize: String(terminalConfig.fontSize),
      fontFamily: terminalConfig.fontFamily,
      cursorBlink: String(terminalConfig.cursorBlink),
      cursorStyle: terminalConfig.cursorStyle,
      scrollback: String(terminalConfig.scrollback),
      sendKeybindingsToShell: String(terminalConfig.sendKeybindingsToShell),
    });

    const multiPaneCssLinks = [
      layoutCssUri,
      tabBarCssUri,
      paneActionsCssUri,
      focusManagerCssUri,
    ]
      .map((uri) => `<link rel="stylesheet" href="${uri}" />`)
      .join("\n    ");
    const bootstrapScript = `<script nonce="${nonce}">(() => {\n  const container = document.getElementById("terminal-container");\n  if (!container) {\n    return;\n  }\n\n  if (!document.getElementById("terminal-layout-root")) {\n    const root = document.createElement("div");\n    root.id = "terminal-layout-root";\n    root.className = "layout-root";\n    root.dataset.defaultPaneId = "${TerminalProvider.DEFAULT_PANE_ID}";\n    container.parentElement?.insertBefore(root, container);\n    root.appendChild(container);\n  }\n\n  document.body.dataset.multiPaneBootstrap = "enabled";\n  window.__OPENCODE_TUI_MULTI_PANE__ = Object.freeze({\n    defaultPaneId: "${TerminalProvider.DEFAULT_PANE_ID}",\n    components: [\n      "PaneManager",\n      "PaneMessageRouter",\n      "LayoutEngine",\n      "TabBar",\n      "PaneActions",\n      "FocusManager"\n    ]\n  });\n})();</script>`;

    return html
      .replace("</head>", `    ${multiPaneCssLinks}\n  </head>`)
      .replace(
        `<script nonce="${nonce}" src="${scriptUri}"></script>`,
        `${bootstrapScript}\n    <script nonce="${nonce}" src="${scriptUri}"></script>`,
      );
  }

  private ensureDefaultPaneState(): void {
    if (this.paneStore.getPane(TerminalProvider.DEFAULT_PANE_ID)) {
      return;
    }

    this.paneStore.addPane({
      paneId: TerminalProvider.DEFAULT_PANE_ID,
      tabId: TerminalProvider.DEFAULT_TAB_ID,
      isActive: true,
      size: 100,
    });
    this.dataThrottleService.setFocusedPane(TerminalProvider.DEFAULT_PANE_ID);
  }

  private getKnownPaneIds(): string[] {
    const paneIds = Array.from(this.paneStore.getAllPanes().keys());
    return paneIds.length > 0 ? paneIds : [TerminalProvider.DEFAULT_PANE_ID];
  }

  private getFocusedPaneId(): string {
    return this.paneStore.getActivePane()?.paneId ?? TerminalProvider.DEFAULT_PANE_ID;
  }

  private setFocusedPane(paneId: string): void {
    const normalizedPaneId = this.normalizePaneId(paneId);
    if (this.paneStore.getPane(normalizedPaneId)) {
      this.paneStore.setActivePane(normalizedPaneId);
    }
    this.dataThrottleService.setFocusedPane(normalizedPaneId);
  }

  private resolveNextPaneId(): string {
    const nextPaneId = this.paneStore.getActivePane()?.paneId;
    if (nextPaneId) {
      return nextPaneId;
    }

    const firstRemainingPaneId = this.paneStore.getAllPanes().keys().next().value as
      | string
      | undefined;
    if (firstRemainingPaneId) {
      this.paneStore.setActivePane(firstRemainingPaneId);
      return firstRemainingPaneId;
    }

    this.ensureDefaultPaneState();
    return TerminalProvider.DEFAULT_PANE_ID;
  }

  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose(): void {
    this.dataThrottleService.dispose();
    this.paneStore.dispose();
    this.sessionRuntime.dispose();
  }
}

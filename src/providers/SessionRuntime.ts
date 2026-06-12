import * as os from "os";
import * as vscode from "vscode";
import { l10n } from "../i18n";
import { OutputCaptureManager } from "../services/OutputCaptureManager";
import { OpenCodeApiClient } from "../services/OpenCodeApiClient";
import { PortManager } from "../services/PortManager";
import { ContextSharingService } from "../services/ContextSharingService";
import { OutputChannelService } from "../services/OutputChannelService";
import { InstanceId, InstanceStore } from "../services/InstanceStore";
import {
  AiToolConfig,
  PaneConfig,
  resolveAiToolConfigs,
  TerminalBackendType,
} from "../types";
import { AiToolFileReference } from "../services/aiTools/AiToolOperator";
import { TerminalManager } from "../terminals/TerminalManager";
import { AiToolOperatorRegistry } from "../services/aiTools/AiToolOperatorRegistry";
import { TerminalBackendRegistry } from "../services/terminalBackends";
import type {
  BackendLaunchPlan,
} from "../services/terminalBackends";
import { NativeTerminalManager } from "../services/NativeTerminalManager";

interface StartupWorkspaceResolution {
  workspacePath: string;
  isWorkspaceScoped: boolean;
}

interface SessionRuntimeCallbacks {
  postMessage: (message: unknown) => void;
  onActiveInstanceChanged: (instanceId: InstanceId) => void;
  requestStartOpenCode: () => Promise<void>;
  showAiToolSelector: (
    sessionId: string,
    sessionName: string,
    forceShow?: boolean,
  ) => void;
}

export interface SessionState {
  paneId: string;
  instanceId: InstanceId;
  terminalKey: string;
  port?: number;
  backendState?: import("../services/terminalBackends").BackendSessionState;
  backend: TerminalBackendType;
}

export class SessionRuntime {
  private static readonly LEGACY_TERMINAL_ID: InstanceId = "ai-sidebar-terminal-main";
  private static readonly DEFAULT_PANE_ID = "default";

  private activeInstanceId: InstanceId = "default";
  private isStarted = false;
  private isStarting = false;
  private apiClient?: OpenCodeApiClient;
  private httpAvailable = false;
  private autoContextSent = false;
  private dataListener?: vscode.Disposable;
  private exitListener?: vscode.Disposable;
  private activeInstanceSubscription?: vscode.Disposable;
  private lastKnownCols = 0;
  private lastKnownRows = 0;
  private activeBackend: TerminalBackendType = "native";
  private pendingLaunchToolName?: string;
  private activeTool?: AiToolConfig;
  private readonly sessions = new Map<string, SessionState>();

  public constructor(
    private readonly terminalManager: TerminalManager,
    _captureManager: OutputCaptureManager,
    _openCodeApiClient: OpenCodeApiClient | undefined,
    private readonly portManager: PortManager,
    private readonly backendRegistry: TerminalBackendRegistry,
    private readonly instanceStore: InstanceStore | undefined,
    private readonly logger: OutputChannelService,
    private readonly contextSharingService: ContextSharingService,
    private readonly aiToolRegistry: AiToolOperatorRegistry,
    private readonly callbacks: SessionRuntimeCallbacks,
    private readonly nativeTerminalManager?: NativeTerminalManager,
  ) {
    if (this.instanceStore) {
      this.subscribeToActiveInstanceChanges();
    } else {
      this.activeInstanceId = SessionRuntime.LEGACY_TERMINAL_ID;
    }
  }

  public getActiveInstanceId(): InstanceId {
    return this.activeInstanceId;
  }

  public getActiveTerminalId(): string {
    return (
      this.sessions.get(SessionRuntime.DEFAULT_PANE_ID)?.terminalKey ??
      this.resolveTerminalIdForInstance(this.activeInstanceId)
    );
  }

  public getLastKnownTerminalSize(): { cols: number; rows: number } {
    return { cols: this.lastKnownCols, rows: this.lastKnownRows };
  }

  public setLastKnownTerminalSize(cols: number, rows: number): void {
    this.lastKnownCols = cols;
    this.lastKnownRows = rows;
  }

  public isStartedFlag(): boolean {
    return this.isStarted;
  }

  public getApiClient(): OpenCodeApiClient | undefined {
    return this.apiClient;
  }

  public getActiveTool(): AiToolConfig | undefined {
    return this.activeTool;
  }

  public getActiveBackend(): TerminalBackendType {
    return this.activeBackend;
  }

  public resolveToolByName(toolName: string): AiToolConfig | undefined {
    return this.resolveToolConfig(toolName);
  }

  public rememberSelectedTool(
    toolName: string | undefined,
    instanceId = this.activeInstanceId,
  ): void {
    this.persistSelectedTool(toolName, instanceId);
    if (instanceId === this.activeInstanceId) {
      this.activeTool = this.resolveToolConfig(toolName);
    }
  }

  public isHttpAvailable(): boolean {
    return this.httpAvailable;
  }

  public hasLiveTerminalProcess(): boolean {
    return (
      this.isStarted &&
      this.terminalManager.getTerminal(this.getActiveTerminalId()) !== undefined
    );
  }

  public getSession(paneId: string): SessionState | undefined {
    const session = this.sessions.get(this.normalizePaneId(paneId));
    return session ? { ...session } : undefined;
  }

  public async createSession(
    paneId: string,
    config: PaneConfig,
  ): Promise<SessionState | undefined> {
    const normalizedPaneId = this.normalizePaneId(paneId);
    if (normalizedPaneId === SessionRuntime.DEFAULT_PANE_ID) {
      return this.startDefaultSession();
    }

    const existing = this.sessions.get(normalizedPaneId);
    if (existing) {
      return { ...existing };
    }

    const workspaceConfig = vscode.workspace.getConfiguration("ai-sidebar-terminal");
    const enableHttpApi = workspaceConfig.get<boolean>("enableHttpApi", true);
    const workspacePath =
      config.cwd ?? this.resolveStartupWorkspacePath().workspacePath;
    const instanceId = this.createPaneInstanceId(normalizedPaneId);

    const resolvedTool = this.activeTool ?? this.resolveStoredTool();
    const operator = resolvedTool
      ? this.aiToolRegistry.getForConfig(resolvedTool)
      : undefined;
    const command =
      config.command ??
      (resolvedTool && operator
        ? operator.getLaunchCommand(resolvedTool)
        : undefined);

    let nativeLaunchPlan: BackendLaunchPlan | undefined;
    if (this.nativeTerminalManager && command) {
      nativeLaunchPlan = this.nativeTerminalManager.create(instanceId, {
        command,
        args: resolvedTool?.args,
        cwd: workspacePath,
      });
    }

    let port: number | undefined;
    if (
      enableHttpApi &&
      command !== undefined &&
      resolvedTool &&
      operator?.supportsHttpApi(resolvedTool)
    ) {
      try {
        port = this.portManager.assignPortToTerminal(instanceId);
      } catch (error) {
        this.logger.error(
          `[TerminalProvider] Failed to assign port for pane ${normalizedPaneId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.terminalManager.createTerminal(
      normalizedPaneId,
      command,
      port
        ? {
            _EXTENSION_OPENCODE_PORT: port.toString(),
            OPENCODE_CALLER: "vscode",
          }
        : {},
      port,
      this.lastKnownCols || undefined,
      this.lastKnownRows || undefined,
      instanceId,
      workspacePath,
    );

    const sessionState = this.registerSession({
      paneId: normalizedPaneId,
      instanceId,
      terminalKey: normalizedPaneId,
      port,
      backendState: nativeLaunchPlan?.state,
      backend: "native",
    });

    if (!this.dataListener || !this.exitListener) {
      this.reconnectListeners();
    }

    return sessionState;
  }

  public destroySession(paneId: string): void {
    const normalizedPaneId = this.normalizePaneId(paneId);
    const session = this.sessions.get(normalizedPaneId);
    if (!session) {
      return;
    }

    this.terminalManager.killByInstance(session.instanceId);
    this.terminalManager.killTerminal(session.terminalKey);
    this.removeSessionState(session, true);

    if (normalizedPaneId === SessionRuntime.DEFAULT_PANE_ID) {
      this.disposeListeners();
      this.isStarted = false;
      this.isStarting = false;
      this.httpAvailable = false;
      this.apiClient = undefined;
      this.activeTool = undefined;
      this.autoContextSent = false;
    }
  }

  public async switchToInstance(
    instanceId: InstanceId,
    options?: { forceRestart?: boolean; preferredToolName?: string },
  ): Promise<void> {
    const forceRestart = options?.forceRestart ?? false;
    if (instanceId === this.activeInstanceId && !forceRestart) {
      return;
    }

    this.disposeListeners();
    this.portManager.releaseTerminalPorts(this.activeInstanceId);
    this.portManager.releaseTerminalPorts(instanceId);
    this.resetState(false);
    this.activeInstanceId = instanceId;

    this.callbacks.postMessage({ type: "clearTerminal" });

    const existingTerminal =
      this.terminalManager.getByInstance(instanceId) ||
      this.terminalManager.getTerminal(instanceId);

    if (existingTerminal && !forceRestart) {
      this.isStarted = true;
      this.activeTool = this.resolveStoredTool(instanceId);
      this.reconnectListeners();
      this.syncActiveInstance(instanceId);

      const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
      const enableHttpApi = config.get<boolean>("enableHttpApi", true);
      const operator = this.activeTool
        ? this.aiToolRegistry.getForConfig(this.activeTool)
        : undefined;
      if (
        enableHttpApi &&
        existingTerminal.port &&
        this.activeTool &&
        operator?.supportsHttpApi(this.activeTool)
      ) {
        const httpTimeout = config.get<number>("httpTimeout", 5000);
        this.apiClient = new OpenCodeApiClient(
          existingTerminal.port,
          10,
          200,
          httpTimeout,
        );
        await this.pollForHttpReadiness();
      }

      if (this.lastKnownCols && this.lastKnownRows) {
        this.terminalManager.resizeTerminal(
          this.getActiveTerminalId(),
          this.lastKnownCols,
          this.lastKnownRows,
        );
      }
      return;
    }

    if (existingTerminal && forceRestart) {
      this.terminalManager.killByInstance(instanceId);
      this.terminalManager.killTerminal(instanceId);
    }

    this.pendingLaunchToolName =
      options?.preferredToolName ?? this.pendingLaunchToolName;
    await this.callbacks.requestStartOpenCode();
    this.syncActiveInstance(instanceId);
  }

  public async startOpenCode(): Promise<void> {
    await this.createSession(SessionRuntime.DEFAULT_PANE_ID, {
      paneId: SessionRuntime.DEFAULT_PANE_ID,
    });
  }

  private async startDefaultSession(): Promise<SessionState | undefined> {
    if (this.isStarted || this.isStarting) {
      return (
        this.getSession(SessionRuntime.DEFAULT_PANE_ID) ?? {
          paneId: SessionRuntime.DEFAULT_PANE_ID,
          instanceId: this.activeInstanceId,
          terminalKey: this.getActiveTerminalId(),
          backend: "native",
        }
      );
    }

    this.isStarting = true;

    try {
      this.disposeListeners();

      const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
      const enableHttpApi = config.get<boolean>("enableHttpApi", true);
      const httpTimeout = config.get<number>("httpTimeout", 5000);

      const { workspacePath, isWorkspaceScoped } =
        this.resolveStartupWorkspacePath();

      let resolvedTool: AiToolConfig | undefined;
      let command: string | undefined;

      resolvedTool = await this.resolveToolForStartup(config);
      if (!resolvedTool) {
        this.isStarting = false;
        return;
      }

      const operator = this.aiToolRegistry.getForConfig(resolvedTool);
      if (!operator) {
        this.isStarting = false;
        return;
      }
      command = operator.getLaunchCommand(resolvedTool);

      let nativeLaunchPlan: BackendLaunchPlan | undefined;
      if (this.nativeTerminalManager && command) {
        nativeLaunchPlan = this.nativeTerminalManager.create(
          this.activeInstanceId,
          {
            command,
            args: resolvedTool?.args,
            cwd: workspacePath,
          },
        );
      }

      this.activeTool = resolvedTool;

      const activeOperator =
        this.activeTool && this.aiToolRegistry.getForConfig(this.activeTool);
      let port: number | undefined;
      if (
        enableHttpApi &&
        command !== undefined &&
        this.activeTool &&
        activeOperator?.supportsHttpApi(this.activeTool)
      ) {
        try {
          port = this.portManager.assignPortToTerminal(this.activeInstanceId);
          this.logger.info(
            `[TerminalProvider] Assigned port ${port} to terminal ${this.activeInstanceId}`,
          );
        } catch (error) {
          this.logger.error(
            `[TerminalProvider] Failed to assign port: ${error instanceof Error ? error.message : String(error)}`,
          );
          vscode.window.showWarningMessage(
            l10n.t("Failed to assign port for OpenCode HTTP API. Running without HTTP features."),
          );
        }
      }

      this.pendingLaunchToolName = undefined;

      this.terminalManager.createTerminal(
        this.activeInstanceId,
        command,
        port
          ? {
              _EXTENSION_OPENCODE_PORT: port.toString(),
              OPENCODE_CALLER: "vscode",
            }
          : {},
        port,
        this.lastKnownCols || undefined,
        this.lastKnownRows || undefined,
        this.activeInstanceId,
        workspacePath,
      );

      const sessionState = this.registerSession({
        paneId: SessionRuntime.DEFAULT_PANE_ID,
        instanceId: this.activeInstanceId,
        terminalKey: this.activeInstanceId,
        port,
        backendState: nativeLaunchPlan?.state,
        backend: "native",
      });

      if (this.instanceStore) {
        try {
          const existing = this.instanceStore.get(this.activeInstanceId);
          if (existing) {
            this.instanceStore.upsert({
              ...existing,
              config: {
                ...existing.config,
                selectedAiTool: this.activeTool?.name,
                terminalBackend: "native",
              },
              runtime: {
                ...existing.runtime,
                terminalKey: this.activeInstanceId,
                terminalBackend: "native",
                backendState: nativeLaunchPlan?.state,
                port: port ?? existing.runtime.port,
              },
            });
          } else {
            this.instanceStore.upsert({
              config: {
                id: this.activeInstanceId,
                selectedAiTool: this.activeTool?.name,
                terminalBackend: "native",
              },
              runtime: {
                terminalKey: this.activeInstanceId,
                terminalBackend: "native",
                backendState: nativeLaunchPlan?.state,
                port,
              },
              state: "connected",
            });
          }
        } catch (err) {
          this.logger.warn(
            `[TerminalProvider] Failed to update instance store with terminal key: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      this.reconnectListeners();

      this.isStarted = true;

      this.notifyActiveSession();

      if (enableHttpApi && port) {
        this.apiClient = new OpenCodeApiClient(port, 10, 200, httpTimeout);
        await this.pollForHttpReadiness();
      } else {
        this.logger.info(
          "[TerminalProvider] HTTP API disabled or unavailable, using message passing fallback",
        );
        this.httpAvailable = false;
      }

      return sessionState;
    } finally {
      this.isStarting = false;
    }
  }

  public restart(): void {
    this.disposeListeners();
    this.destroySession(SessionRuntime.DEFAULT_PANE_ID);
    this.resetState();

    this.callbacks.postMessage({ type: "clearTerminal" });

    void this.callbacks.requestStartOpenCode();
  }

  public resetState(releasePorts: boolean = true): void {
    this.isStarted = false;
    this.isStarting = false;
    this.httpAvailable = false;
    this.apiClient = undefined;
    this.activeTool = undefined;
    this.autoContextSent = false;
    const defaultSession = this.sessions.get(SessionRuntime.DEFAULT_PANE_ID);
    if (releasePorts && defaultSession) {
      this.portManager.releaseTerminalPorts(defaultSession.instanceId);
    }
    this.sessions.delete(SessionRuntime.DEFAULT_PANE_ID);
  }

  public disposeListeners(): void {
    if (this.dataListener) {
      this.dataListener.dispose();
      this.dataListener = undefined;
    }
    if (this.exitListener) {
      this.exitListener.dispose();
      this.exitListener = undefined;
    }
  }

  public reconnectListeners(): void {
    this.disposeListeners();

    this.dataListener = this.terminalManager.onData((event) => {
      const session = this.findSessionByTerminalKey(event.id);
      if (!session) {
        return;
      }
      this.callbacks.postMessage(
        this.withPaneId(
          {
            type: "terminalOutput",
            data: event.data,
          },
          session.paneId,
        ),
      );
    });

    this.exitListener = this.terminalManager.onExit((id) => {
      const session = this.findSessionByTerminalKey(id);
      if (!session) {
        return;
      }

      if (session.paneId === SessionRuntime.DEFAULT_PANE_ID) {
        this.resetState();
        this.callbacks.postMessage({
          type: "terminalExited",
        });
        return;
      }

      this.removeSessionState(session, true);
      this.callbacks.postMessage(
        this.withPaneId({ type: "terminalExited" }, session.paneId),
      );
    });
  }

  public async pollForHttpReadiness(): Promise<void> {
    if (!this.apiClient) {
      return;
    }

    const maxRetries = 10;
    const delayMs = 200;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const isHealthy = await this.apiClient.healthCheck();
        if (isHealthy) {
          this.httpAvailable = true;
          this.logger.info("[TerminalProvider] HTTP API is ready");
          await this.sendAutoContext();
          return;
        }
      } catch {
        this.logger.info(
          `[TerminalProvider] Health check attempt ${attempt}/${maxRetries} failed`,
        );
      }

      if (attempt < maxRetries) {
        await this.sleep(delayMs);
      }
    }

    this.logger.info(
      "[TerminalProvider] HTTP API not available after retries, using message passing fallback",
    );
    this.httpAvailable = false;
  }

  public sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public resolveStartupWorkspacePath(): StartupWorkspaceResolution {
    const instanceWorkspacePath = this.resolveWorkspacePathFromActiveInstance();
    if (instanceWorkspacePath) {
      return { workspacePath: instanceWorkspacePath, isWorkspaceScoped: true };
    }

    const workspaceFolderPath =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceFolderPath) {
      return { workspacePath: workspaceFolderPath, isWorkspaceScoped: true };
    }

    return { workspacePath: os.homedir(), isWorkspaceScoped: false };
  }

  public resolveWorkspacePathFromActiveInstance(): string | undefined {
    if (!this.instanceStore) {
      return undefined;
    }

    const record = this.instanceStore.get(this.activeInstanceId);
    const workspaceUri = record?.config.workspaceUri;
    if (!workspaceUri) {
      return undefined;
    }

    try {
      const parsed = vscode.Uri.parse(workspaceUri);
      return parsed.fsPath || undefined;
    } catch {
      return undefined;
    }
  }

  public resolveInstanceIdFromSessionId(sessionId: string): InstanceId {
    if (!this.instanceStore) {
      return this.activeInstanceId;
    }

    if (this.instanceStore.get(sessionId)) {
      return sessionId;
    }

    return this.activeInstanceId;
  }

  public formatDroppedFiles(
    paths: string[],
    options: { useAtSyntax: boolean },
  ): string {
    const operator = this.activeTool
      ? this.aiToolRegistry.getForConfig(this.activeTool)
      : this.aiToolRegistry.getByToolName("opencode");
    if (!operator) {
      return paths.join(" ");
    }

    return operator.formatDroppedFiles(paths, options);
  }

  public formatFileReference(reference: AiToolFileReference): string {
    const operator = this.activeTool
      ? this.aiToolRegistry.getForConfig(this.activeTool)
      : this.aiToolRegistry.getByToolName("opencode");
    if (!operator) {
      return reference.path;
    }

    return operator.formatFileReference(reference);
  }

  public formatPastedImage(tempPath: string): string | undefined {
    const operator = this.activeTool
      ? this.aiToolRegistry.getForConfig(this.activeTool)
      : this.aiToolRegistry.getByToolName("opencode");
    return operator?.formatPastedImage(tempPath);
  }

  public subscribeToActiveInstanceChanges(): void {
    if (!this.instanceStore) {
      return;
    }

    try {
      this.activeInstanceId = this.instanceStore.getActive().config.id;
    } catch {
      // intentionally empty: no active instance is fine during init
    }

    this.activeInstanceSubscription = this.instanceStore.onDidSetActive(
      (id) => {
        this.callbacks.onActiveInstanceChanged(id);
      },
    );
  }

  private syncActiveInstance(instanceId: InstanceId): void {
    if (!this.instanceStore) {
      return;
    }
    try {
      const currentActive = this.instanceStore.getActive().config.id;
      if (currentActive !== instanceId) {
        this.instanceStore.setActive(instanceId);
      }
    } catch {
      // intentionally empty: getActive() may throw if instance removed
    }
  }

  private notifyActiveSession(): void {
    const aiTools = this.getConfiguredTools().map((t) => ({
      name: t.name,
      label: t.label,
    }));

    this.callbacks.postMessage({
      type: "activeSession",
      backend: "native",
      aiToolLabel: this.activeTool?.label,
      aiTools,
    });
  }

  public dispose(): void {
    this.disposeListeners();
    this.activeInstanceSubscription?.dispose();
    this.activeInstanceSubscription = undefined;
    for (const session of this.sessions.values()) {
      this.terminalManager.killByInstance(session.instanceId);
      this.terminalManager.killTerminal(session.terminalKey);
      this.portManager.releaseTerminalPorts(session.instanceId);
    }
    this.sessions.clear();
  }

  private normalizePaneId(paneId: string | undefined): string {
    return paneId || SessionRuntime.DEFAULT_PANE_ID;
  }

  private createPaneInstanceId(paneId: string): InstanceId {
    if (paneId === SessionRuntime.DEFAULT_PANE_ID) {
      return this.activeInstanceId;
    }
    return `${this.activeInstanceId}::${paneId}`;
  }

  private registerSession(session: SessionState): SessionState {
    const snapshot = { ...session };
    this.sessions.set(session.paneId, snapshot);
    return { ...snapshot };
  }

  private findSessionByTerminalKey(terminalKey: string): SessionState | undefined {
    for (const session of this.sessions.values()) {
      if (session.terminalKey === terminalKey) {
        return session;
      }
    }
    return undefined;
  }

  private removeSessionState(
    session: SessionState,
    releasePort: boolean,
  ): void {
    this.sessions.delete(session.paneId);
    if (releasePort) {
      this.portManager.releaseTerminalPorts(session.instanceId);
    }
  }

  private withPaneId<T extends object>(
    message: T,
    paneId: string,
  ): T & { paneId?: string } {
    if (paneId === SessionRuntime.DEFAULT_PANE_ID) {
      return message;
    }
    return {
      ...message,
      paneId,
    };
  }

  private resolveTerminalIdForInstance(instanceId: InstanceId): string {
    if (!this.instanceStore) {
      return instanceId;
    }

    try {
      return (
        this.instanceStore.get(instanceId)?.runtime.terminalKey ?? instanceId
      );
    } catch {
      return instanceId;
    }
  }

  private async sendAutoContext(): Promise<void> {
    if (this.autoContextSent) {
      return;
    }

    const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
    const enableHttpApi = config.get<boolean>("enableHttpApi", true);
    const autoShareContext = config.get<boolean>("autoShareContext", true);
    const operator = this.activeTool
      ? this.aiToolRegistry.getForConfig(this.activeTool)
      : undefined;

    if (!enableHttpApi) {
      this.logger.info(
        "[TerminalProvider] HTTP API disabled, skipping auto-context",
      );
      return;
    }

    if (!autoShareContext) {
      this.logger.info(
        "[TerminalProvider] Auto-context sharing disabled by user",
      );
      return;
    }

    if (!this.activeTool || !operator?.supportsAutoContext(this.activeTool)) {
      this.logger.info(
        "[TerminalProvider] Active tool does not support auto-context",
      );
      return;
    }

    if (!this.httpAvailable || !this.apiClient) {
      this.logger.info(
        "[TerminalProvider] HTTP not available, skipping auto-context",
      );
      return;
    }

    const context = this.contextSharingService.getCurrentContext();
    if (!context) {
      this.logger.info(
        "[TerminalProvider] No active editor, skipping auto-context",
      );
      return;
    }

    const fileRef = this.formatFileReference({
      path: context.filePath,
      selectionStart: context.selectionStart,
      selectionEnd: context.selectionEnd,
    });
    this.logger.info(`[TerminalProvider] Sending auto-context: ${fileRef}`);

    try {
      await this.apiClient.appendPrompt(fileRef);
      this.autoContextSent = true;
      this.logger.info(
        "[TerminalProvider] Auto-context sent successfully via HTTP",
      );
    } catch (error) {
      this.logger.error(
        `[TerminalProvider] Failed to send auto-context: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getConfiguredTools(
    config = vscode.workspace.getConfiguration("ai-sidebar-terminal"),
  ): AiToolConfig[] {
    return resolveAiToolConfigs(config.get("aiTools", []));
  }

  private resolveStoredTool(
    instanceId = this.activeInstanceId,
  ): AiToolConfig | undefined {
    const config = vscode.workspace.getConfiguration("ai-sidebar-terminal");
    const storedToolName =
      this.instanceStore?.get(instanceId)?.config.selectedAiTool;
    return this.resolveToolConfig(
      storedToolName ?? config.get<string>("defaultAiTool", ""),
      config,
    );
  }

  private resolveToolConfig(
    toolName: string | undefined,
    config = vscode.workspace.getConfiguration("ai-sidebar-terminal"),
  ): AiToolConfig | undefined {
    if (!toolName) {
      return undefined;
    }

    return this.getConfiguredTools(config).find((tool) =>
      this.aiToolRegistry.matchesName(tool, toolName),
    );
  }

  private persistSelectedTool(
    toolName: string | undefined,
    instanceId = this.activeInstanceId,
  ): void {
    if (!this.instanceStore) {
      return;
    }

    const record = this.instanceStore.get(instanceId);
    if (!record) {
      return;
    }

    this.instanceStore.upsert({
      ...record,
      config: {
        ...record.config,
        selectedAiTool: toolName,
      },
    });
  }

  private async resolveToolForStartup(
    config: vscode.WorkspaceConfiguration,
  ): Promise<AiToolConfig | undefined> {
    const preferredToolName =
      (this.pendingLaunchToolName ??
        this.instanceStore?.get(this.activeInstanceId)?.config.selectedAiTool ??
        config.get<string>("defaultAiTool", "")) ||
      "opencode";

    let tool = this.resolveToolConfig(preferredToolName, config);
    if (!tool) {
      const toolItems = this.getConfiguredTools(config).map((candidate) => ({
        label: candidate.label,
        description: l10n.t("Launch {label} in the terminal", { label: candidate.label }),
        tool: candidate,
      }));
      const picked = await vscode.window.showQuickPick(toolItems, {
        placeHolder: l10n.t("Select AI tool to launch"),
      });
      if (!picked) {
        return undefined;
      }
      tool = picked.tool;
      const saveDefault = await vscode.window.showInformationMessage(
        l10n.t("Save {tool} as default tool?", { tool: picked.tool.label }),
        { modal: false },
        l10n.t("Yes"),
        l10n.t("No"),
      );
      if (saveDefault === l10n.t("Yes")) {
        await config.update(
          "defaultAiTool",
          picked.tool.name,
          vscode.ConfigurationTarget.Global,
        );
      }
    }

    this.persistSelectedTool(tool.name);
    return tool;
  }
}

import * as vscode from "vscode";
import { l10n } from "../../i18n";
import type { TerminalProvider } from "../../providers/TerminalProvider";
import type { InstanceController } from "../../services/InstanceController";
import type { InstanceQuickPick } from "../../services/InstanceQuickPick";
import type { InstanceStore } from "../../services/InstanceStore";
import type { OutputChannelService } from "../../services/OutputChannelService";
import type { TmuxSessionManager } from "../../services/TmuxSessionManager";
import type { ZellijSessionManager } from "../../services/ZellijSessionManager";
import type { TerminalBackendType } from "../../types";

export interface TmuxSessionCommandDependencies {
  provider: TerminalProvider | undefined;
  instanceStore: InstanceStore | undefined;
  instanceController: InstanceController | undefined;
  instanceQuickPick: InstanceQuickPick | undefined;
  outputChannel: OutputChannelService | undefined;
  tmuxManager: TmuxSessionManager | undefined;
  zellijManager?: ZellijSessionManager | undefined;
}

function getActiveBackend(
  instanceStore: InstanceStore | undefined,
): TerminalBackendType {
  try {
    return instanceStore?.getActive().runtime.terminalBackend ?? "tmux";
  } catch {
    return "tmux";
  }
}

export function registerTmuxSessionCommands(
  deps: TmuxSessionCommandDependencies,
): vscode.Disposable[] {
  const openInNewWindowCommand = vscode.commands.registerCommand(
    "ai-sidebar-terminal.openInNewWindow",
    async () => {
      if (!deps.instanceStore) {
        vscode.window.showErrorMessage(l10n.t("Instance store is not initialized"));
        return;
      }

      try {
        const active = deps.instanceStore.getActive();
        const newId = `${Date.now()}`;
        const newRecord = {
          config: {
            id: newId,
            workspaceUri: active.config.workspaceUri,
            label: `${active.config.label || "OpenCode"} (New Window)`,
          },
          runtime: {},
          state: "disconnected" as const,
        };

        deps.instanceStore.upsert(newRecord);

        if (newRecord.config.workspaceUri) {
          vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.parse(newRecord.config.workspaceUri),
            true,
          );
        }
        vscode.window.showInformationMessage(
          l10n.t("Opened in new window: {label}", { label: newRecord.config.label }),
        );
      } catch (error) {
        deps.outputChannel?.error(
          `Failed to open in new window: ${error instanceof Error ? error.message : String(error)}`,
        );
        vscode.window.showErrorMessage(
          l10n.t("Failed to open in new window: {error}", { error: error instanceof Error ? error.message : String(error) }),
        );
      }
    },
  );

  const spawnForWorkspaceCommand = vscode.commands.registerCommand(
    "ai-sidebar-terminal.spawnForWorkspace",
    async (uri?: vscode.Uri) => {
      if (!deps.instanceStore) {
        vscode.window.showErrorMessage(l10n.t("Instance store is not initialized"));
        return;
      }

      try {
        const workspaceUri =
          uri?.toString() ||
          vscode.workspace.workspaceFolders?.[0]?.uri.toString();
        if (!workspaceUri) {
          vscode.window.showWarningMessage(l10n.t("No workspace folder available"));
          return;
        }

        const existingWorkspaceRecord = deps.instanceStore
          .getAll()
          .find((record) => record.config.workspaceUri === workspaceUri);

        const reusableStates = new Set<string>([
          "connected",
          "connecting",
          "spawning",
          "resolving",
        ]);

        if (
          existingWorkspaceRecord &&
          reusableStates.has(existingWorkspaceRecord.state)
        ) {
          deps.instanceStore.setActive(existingWorkspaceRecord.config.id);
          await vscode.commands.executeCommand("ai-sidebar-terminal.focus");
          vscode.window.showInformationMessage(
            l10n.t("Focused existing OpenCode for workspace: {label}", { label: existingWorkspaceRecord.config.label || existingWorkspaceRecord.config.id }),
          );
          return;
        }

        if (existingWorkspaceRecord) {
          deps.instanceStore.setActive(existingWorkspaceRecord.config.id);
          await deps.instanceController?.spawn(
            existingWorkspaceRecord.config.id,
          );
          vscode.window.showInformationMessage(
            l10n.t("Spawned OpenCode for workspace: {label}", { label: existingWorkspaceRecord.config.label || existingWorkspaceRecord.config.id }),
          );
          return;
        }

        const newId = `${Date.now()}`;
        const newRecord = {
          config: {
            id: newId,
            workspaceUri,
            label: `OpenCode (${vscode.workspace.name || "Workspace"})`,
          },
          runtime: {},
          state: "disconnected" as const,
        };

        deps.instanceStore.upsert(newRecord);

        await deps.instanceController?.spawn(newId);
        vscode.window.showInformationMessage(
          l10n.t("Spawned OpenCode for workspace: {label}", { label: newRecord.config.label }),
        );
      } catch (error) {
        deps.outputChannel?.error(
          `Failed to spawn for workspace: ${error instanceof Error ? error.message : String(error)}`,
        );
        vscode.window.showErrorMessage(
          l10n.t("Failed to spawn for workspace: {error}", { error: error instanceof Error ? error.message : String(error) }),
        );
      }
    },
  );

  const selectInstanceCommand = vscode.commands.registerCommand(
    "ai-sidebar-terminal.selectInstance",
    () => {
      deps.instanceQuickPick?.show();
    },
  );

  const switchTmuxSessionCommand = vscode.commands.registerCommand(
    "ai-sidebar-terminal.switchTmuxSession",
    async (sessionId?: string) => {
      if (!sessionId || !deps.provider) {
        return;
      }

      await vscode.commands.executeCommand("ai-sidebar-terminal.focus");
      await deps.provider.switchToTmuxSession(sessionId);
    },
  );

  const createTmuxSessionCommand = vscode.commands.registerCommand(
    "ai-sidebar-terminal.createTmuxSession",
    async () => {
      if (!deps.provider) {
        return;
      }

      await vscode.commands.executeCommand("ai-sidebar-terminal.focus");
      return deps.provider.createTmuxSession();
    },
  );

  const killTmuxSessionCommand = vscode.commands.registerCommand(
    "ai-sidebar-terminal.killTmuxSession",
    async (sessionId?: string) => {
      if (!sessionId || !deps.provider) {
        return;
      }

      await deps.provider.killTmuxSession(sessionId);
    },
  );

  const switchNativeShellCommand = vscode.commands.registerCommand(
    "ai-sidebar-terminal.switchNativeShell",
    async () => {
      if (!deps.provider) {
        return;
      }

      await deps.provider.switchToNativeShell();
    },
  );

  const browseTmuxSessionsCommand = vscode.commands.registerCommand(
    "ai-sidebar-terminal.browseTmuxSessions",
    async () => {
      const activeBackend = getActiveBackend(deps.instanceStore);
      const sessionManager =
        activeBackend === "zellij" ? deps.zellijManager : deps.tmuxManager;
      const backendLabel = activeBackend === "zellij" ? "zellij" : "tmux";

      if (!sessionManager || !deps.provider) {
        vscode.window.showWarningMessage(
          l10n.t("{backendLabel} is not available or the terminal provider is not initialized", { backendLabel }),
        );
        return;
      }

      try {
        const sessions = await sessionManager.discoverSessions();
        if (sessions.length === 0) {
          vscode.window.showInformationMessage(l10n.t("No {backendLabel} sessions found", { backendLabel }));
          return;
        }

        const activeSessionId =
          activeBackend === "zellij"
            ? deps.instanceStore?.getActive()?.runtime.zellijSessionId
            : deps.instanceStore?.getActive()?.runtime.tmuxSessionId;

        const items = sessions.map((session) => ({
          label: session.name,
          description: session.workspace,
          detail: session.isActive ? "attached" : undefined,
          session,
        }));

        items.sort((a, b) => {
          if (a.session.id === activeSessionId) return -1;
          if (b.session.id === activeSessionId) return 1;
          return a.label.localeCompare(b.label);
        });

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: activeSessionId
            ? l10n.t("Current: {sessionId} — select a session to switch", { sessionId: activeSessionId })
            : l10n.t("Select a {backendLabel} session to attach", { backendLabel }),
          matchOnDescription: true,
          matchOnDetail: true,
        });

        if (!picked) {
          return;
        }

        if (picked.session.id === activeSessionId) {
          vscode.window.showInformationMessage(
            l10n.t('Already attached to session "{name}"', { name: picked.session.name }),
          );
          return;
        }

        await vscode.commands.executeCommand("ai-sidebar-terminal.focus");
        if (activeBackend === "zellij") {
          await deps.provider.switchToZellijSession(picked.session.id);
        } else {
          await deps.provider.switchToTmuxSession(picked.session.id);
        }
      } catch (error) {
        deps.outputChannel?.error(
          `Failed to browse tmux sessions: ${error instanceof Error ? error.message : String(error)}`,
        );
        vscode.window.showErrorMessage(
          l10n.t("Failed to browse tmux sessions: {error}", { error: error instanceof Error ? error.message : String(error) }),
        );
      }
    },
  );

  const killNativeShellCommand = vscode.commands.registerCommand(
    "ai-sidebar-terminal.killNativeShell",
    async (instanceId?: string) => {
      if (!instanceId || !deps.instanceController || !deps.instanceStore) {
        return;
      }

      try {
        const wasActive =
          deps.instanceStore.getActive()?.config.id === instanceId;

        await deps.instanceController.kill(instanceId);
        deps.instanceStore.remove(instanceId);

        if (wasActive) {
          const remaining = deps.instanceStore.getAll();
          if (remaining.length > 0) {
            deps.instanceStore.setActive(remaining[0].config.id);
          }
        }
      } catch (error) {
        deps.outputChannel?.error(
          `[killNativeShell] Failed to kill native shell ${instanceId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  return [
    openInNewWindowCommand,
    spawnForWorkspaceCommand,
    selectInstanceCommand,
    switchTmuxSessionCommand,
    createTmuxSessionCommand,
    killTmuxSessionCommand,
    killNativeShellCommand,
    switchNativeShellCommand,
    browseTmuxSessionsCommand,
  ];
}


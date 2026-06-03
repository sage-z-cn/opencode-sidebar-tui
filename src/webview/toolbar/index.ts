import { postMessage } from "../shared/vscode-api";
import {
  TerminalBackendAvailability,
  TerminalBackendType,
  TmuxWebviewCommandId,
} from "../../types";
import type { BackendOption } from "../../types";

import * as TmuxCmd from "../tmux-command-dropdown";
import { PillDropdown, type PillOption } from "./pill-dropdown";

// ── Pill instances (lazy-initialised) ──

let aiToolPill: PillDropdown | null = null;
let backendPill: PillDropdown | null = null;

export function initPills(): {
  aiToolPill: PillDropdown;
  backendPill: PillDropdown;
} {
  aiToolPill = new PillDropdown({
    hostId: "pill-ai-tool",
    buttonId: "btn-pill-ai-tool",
    labelId: "pill-ai-tool-label",
    dropdownId: "dropdown-ai-tool",
    onSelect(value) {
      const sessionId = getCurrentSessionId();
      postMessage({
        type: "launchAiTool",
        sessionId: sessionId ?? "",
        tool: value,
        savePreference: false,
      });
    },
  });

  backendPill = new PillDropdown({
    hostId: "pill-backend",
    buttonId: "btn-pill-backend",
    labelId: "pill-backend-label",
    dropdownId: "dropdown-backend",
    onSelect(value) {
      // Value is encoded as "type:sessionId" or just "type"
      const sepIdx = value.indexOf(":");
      if (sepIdx >= 0) {
        const backend = value.slice(0, sepIdx) as TerminalBackendType;
        const sessionId = value.slice(sepIdx + 1);
        postMessage({ type: "switchToBackend", backend, sessionId });
      } else {
        postMessage({
          type: "switchToBackend",
          backend: value as TerminalBackendType,
        });
      }
    },
  });

  return { aiToolPill, backendPill };
}

export function getAiToolPill(): PillDropdown | null {
  return aiToolPill;
}

export function getBackendPill(): PillDropdown | null {
  return backendPill;
}

/**
 * Update both pills from an activeSession message.
 */
export function updatePillsFromActiveSession(data: {
  aiToolLabel?: string;
  aiTools?: readonly { name: string; label: string }[];
  backend?: TerminalBackendType;
  backendOptions?: readonly BackendOption[];
}): void {
  // AI Tool pill
  if (aiToolPill && data.aiTools) {
    const toolOptions: PillOption[] = data.aiTools.map((t) => ({
      value: t.name,
      label: t.label,
    }));
    const currentTool =
      data.aiTools.find((t) => t.label === data.aiToolLabel)?.name ??
      data.aiTools[0]?.name ??
      "";
    aiToolPill.update(toolOptions, currentTool);
  }

  // Backend pill
  if (backendPill && data.backendOptions) {
    const backendOpts: PillOption[] = data.backendOptions.map((o) => ({
      value: o.sessionId ? `${o.type}:${o.sessionId}` : o.type,
      label: o.label,
      group: o.group,
    }));
    // Compute current value for selection highlight
    const currentBackend = data.backend ?? "native";
    // Find the first option matching current backend type
    // For native: match the native option (no sessionId)
    // For tmux/zellij: match the first option of that type
    const currentBackendOpt = data.backendOptions.find(
      (o) =>
        o.type === currentBackend &&
        (currentBackend === "native" ? !o.sessionId : true),
    );
    const currentValue = currentBackendOpt
      ? currentBackendOpt.sessionId
        ? `${currentBackendOpt.type}:${currentBackendOpt.sessionId}`
        : currentBackendOpt.type
      : currentBackend;
    backendPill.update(backendOpts, currentValue);
  }
}

// ── Legacy helpers (still needed for tmux window buttons) ──

let currentSessionId: string | null = null;

function getCurrentSessionId(): string | null {
  return currentSessionId;
}

export function setCurrentSessionId(id: string | null): void {
  currentSessionId = id;
}

// ── Tmux command button ──

export function setupTmuxCommandButton(
  getSessionId: () => string | null,
  getActiveBackend: () => TerminalBackendType = () => "tmux",
): void {
  const btnTmuxCommands = document.getElementById("btn-tmux-commands");
  btnTmuxCommands?.addEventListener("click", () => {
    TmuxCmd.isVisible()
      ? TmuxCmd.hide()
      : TmuxCmd.show(getSessionId(), getActiveBackend());
  });
}

// ── Tmux window buttons ──

export function setupTmuxWindowButtons(): void {
  bindTmuxCommandButton("btn-tmux-new-session", "ai-sidebar-terminal.createTmuxSession");
  bindTmuxCommandButton("btn-tmux-prev-window", "ai-sidebar-terminal.tmuxPrevWindow");
  bindTmuxCommandButton("btn-tmux-new-window", "ai-sidebar-terminal.tmuxCreateWindow");
  bindTmuxCommandButton("btn-tmux-next-window", "ai-sidebar-terminal.tmuxNextWindow");
}

function bindTmuxCommandButton(
  elementId: string,
  commandId: TmuxWebviewCommandId,
): void {
  document.getElementById(elementId)?.addEventListener("click", () => {
    postMessage({ type: "executeTmuxCommand", commandId });
  });
}

// ── Backend toggle state (kept for tmux window button updates) ──

export function updateBackendToggleButtonState(
  activeBackend: TerminalBackendType,
  availability: TerminalBackendAvailability,
): void {
  updateTmuxWindowButtonState(activeBackend, availability);
}

function updateTmuxWindowButtonState(
  activeBackend: TerminalBackendType,
  availability: TerminalBackendAvailability,
): void {
  const L = (window as any).__TOOLBAR_L10N__ as
    | Record<string, string>
    | undefined;

  const sessionButton = document.getElementById(
    "btn-tmux-new-session",
  ) as HTMLButtonElement | null;
  if (sessionButton) {
    sessionButton.disabled = !availability.tmux;
    sessionButton.title = availability.tmux
      ? L?.newSession ?? "New tmux session"
      : L?.tmuxNotAvailable ?? "tmux is not available";
  }

  const windowButtons = [
    ["btn-tmux-prev-window", "prevWindow", "Previous tmux window"],
    ["btn-tmux-new-window", "newWindow", "New tmux window"],
    ["btn-tmux-next-window", "nextWindow", "Next tmux window"],
  ] as const;

  const isTmuxActive = activeBackend === "tmux" && availability.tmux;
  windowButtons.forEach(([id, l10nKey, fallbackTitle]) => {
    const button = document.getElementById(id) as HTMLButtonElement | null;
    if (!button) return;
    button.disabled = !isTmuxActive;
    button.title = isTmuxActive
      ? L?.[l10nKey] ?? fallbackTitle
      : activeBackend === "zellij"
        ? L?.useTabControlsFromCommands ?? "Use tab controls from commands"
        : L?.switchToTmuxToManageWindows ??
          "Switch to tmux to manage windows";
  });
}

// ── Other toolbar buttons ──

export function setupReloadButton(): void {
  document.getElementById("btn-restart")?.addEventListener("click", () => {
    postMessage({ type: "requestRestart" });
  });
}

export function setupRerenderButton(): void {
  document.getElementById("btn-rerender")?.addEventListener("click", () => {
    const currentHeight = document.body.offsetHeight;

    // Briefly constrain body dimensions to trigger
    // ResizeObserver → fitAddon.fit() + terminal.refresh()
    document.body.style.maxHeight = `${currentHeight - 10}px`;
    document.body.style.width = "99%";

    setTimeout(() => {
      document.body.style.maxHeight = "";
      document.body.style.width = "";
    }, 500);
  });
}

export function setupEditorAttachmentButton(): void {
  document
    .getElementById("btn-toggle-editor-attachment")
    ?.addEventListener("click", () => {
      postMessage({ type: "toggleEditorAttachment" });
    });
}

export function setupSettingsButton(): void {
  document.getElementById("btn-settings")?.addEventListener("click", () => {
    postMessage({ type: "openSettings" });
  });
}

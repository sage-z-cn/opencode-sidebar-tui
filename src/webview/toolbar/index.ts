import { postMessage } from "../shared/vscode-api";
import type { TerminalBackendType } from "../../types";

import { PillDropdown, type PillOption, closeAllPillDropdowns, registerExternalDropdownClose } from "./pill-dropdown";

// ── Pill instances (lazy-initialised) ──

let aiToolPill: PillDropdown | null = null;

export function initPills(): {
  aiToolPill: PillDropdown;
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

  return { aiToolPill };
}

export function getAiToolPill(): PillDropdown | null {
  return aiToolPill;
}

/**
 * Update AI tool pill from an activeSession message.
 */
export function updatePillsFromActiveSession(data: {
  aiToolLabel?: string;
  aiTools?: readonly { name: string; label: string }[];
  backend?: TerminalBackendType;
}): void {
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
}

// ── Legacy helpers ──

let currentSessionId: string | null = null;

function getCurrentSessionId(): string | null {
  return currentSessionId;
}

export function setCurrentSessionId(id: string | null): void {
  currentSessionId = id;
}

// ── Other toolbar buttons ──

export function setupReloadButton(): void {
  document.getElementById("btn-restart")?.addEventListener("click", () => {
    postMessage({ type: "requestRestart" });
  });
}

export function updateEditorAttachmentIcon(isEditorTab: boolean): void {
  const btn = document.getElementById("btn-toggle-editor-attachment");
  if (btn) {
    btn.textContent = isEditorTab ? "↗" : "↖";
  }
}

export function setupEditorAttachmentButton(): void {
  document
    .getElementById("btn-toggle-editor-attachment")
    ?.addEventListener("click", () => {
      postMessage({ type: "toggleEditorAttachment" });
    });
}

// ── Settings button (dropdown menu) ──

/** Delay in ms before auto-closing settings dropdown on mouse leave. */
const SETTINGS_CLOSE_DELAY_MS = 200;

export function setupSettingsButton(): void {
  const btn = document.getElementById("btn-settings");
  const dropdown = document.getElementById("dropdown-settings");
  const host = document.querySelector(".settings-host");

  if (!btn || !dropdown) return;

  let leaveTimer: ReturnType<typeof setTimeout> | null = null;

  function closeDropdown(): void {
    dropdown!.classList.add("hidden");
    if (leaveTimer !== null) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
  }

  function scheduleClose(): void {
    if (leaveTimer !== null) clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => closeDropdown(), SETTINGS_CLOSE_DELAY_MS);
  }

  registerExternalDropdownClose(() => closeDropdown());

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!dropdown.classList.contains("hidden")) {
      closeDropdown();
    } else {
      closeAllPillDropdowns();
      dropdown.classList.remove("hidden");
    }
  });

  host?.addEventListener("pointerleave", () => {
    if (!dropdown.classList.contains("hidden")) scheduleClose();
  });

  host?.addEventListener("pointerenter", () => {
    if (leaveTimer !== null) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
  });

  dropdown.querySelectorAll(".settings-option").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = (item as HTMLElement).dataset.action;
      if (action === "keyboardShortcuts") {
        postMessage({ type: "openKeyboardShortcuts" });
      } else {
        postMessage({ type: "openSettings" });
      }
      closeDropdown();
    });
  });
}

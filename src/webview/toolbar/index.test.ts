// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupTmuxCommandButton,
  setupTmuxWindowButtons,
  updateBackendToggleButtonState,
  initPills,
  updatePillsFromActiveSession,
} from "./index";
import { resetVsCodeApi } from "../shared/vscode-api";

const postMessageMock = vi.fn();

function renderPillHtml(): void {
  document.body.innerHTML = `
    <div class="toolbar-context">
      <div class="pill-host" id="pill-ai-tool">
        <button type="button" class="toolbar-pill" id="btn-pill-ai-tool">
          <span class="pill-label" id="pill-ai-tool-label">OpenCode</span>
          <svg class="pill-chevron"></svg>
        </button>
        <div class="pill-dropdown hidden" id="dropdown-ai-tool" role="listbox"></div>
      </div>
      <span class="pill-separator">·</span>
      <div class="pill-host" id="pill-backend">
        <button type="button" class="toolbar-pill" id="btn-pill-backend">
          <span class="pill-label" id="pill-backend-label">Native Shell</span>
          <svg class="pill-chevron"></svg>
        </button>
        <div class="pill-dropdown hidden" id="dropdown-backend" role="listbox"></div>
      </div>
    </div>
    <button id="btn-tmux-new-session"></button>
    <button id="btn-tmux-prev-window"></button>
    <button id="btn-tmux-new-window"></button>
    <button id="btn-tmux-next-window"></button>
  `;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetVsCodeApi();
  renderPillHtml();
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: postMessageMock,
    getState: vi.fn(),
    setState: vi.fn(),
  }));
});

describe("pill dropdowns", () => {
  it("initializes both pills and updates labels from activeSession data", () => {
    initPills();

    updatePillsFromActiveSession({
      aiToolLabel: "Claude",
      aiTools: [
        { name: "opencode", label: "OpenCode" },
        { name: "claude", label: "Claude" },
      ],
      backend: "tmux",
      backendOptions: [
        { type: "native", label: "Native Shell", group: "Shell" },
        { type: "tmux", sessionId: "s1", label: "dev", group: "Tmux" },
      ],
    });

    expect(
      document.getElementById("pill-ai-tool-label")?.textContent,
    ).toBe("Claude");
    expect(
      document.getElementById("pill-backend-label")?.textContent,
    ).toBe("dev");
  });

  it("sends switchToBackend message when backend option is selected", () => {
    initPills();

    updatePillsFromActiveSession({
      backend: "native",
      backendOptions: [
        { type: "native", label: "Native Shell", group: "Shell" },
        { type: "tmux", sessionId: "s1", label: "dev", group: "Tmux" },
      ],
    });

    // Open the backend dropdown
    document.getElementById("btn-pill-backend")?.click();
    // Click the tmux option
    const items =
      document.getElementById("dropdown-backend")?.querySelectorAll(
        ".pill-option",
      ) ?? [];
    const tmuxItem = Array.from(items).find(
      (el) => el.textContent === "dev",
    );
    (tmuxItem as HTMLElement)?.click();

    expect(postMessageMock).toHaveBeenCalledWith({
      type: "switchToBackend",
      backend: "tmux",
      sessionId: "s1",
    });
  });

  it("sends launchAiTool message when AI tool option is selected", () => {
    initPills();

    updatePillsFromActiveSession({
      aiToolLabel: "OpenCode",
      aiTools: [
        { name: "opencode", label: "OpenCode" },
        { name: "claude", label: "Claude" },
      ],
      backend: "native",
      backendOptions: [{ type: "native", label: "Native Shell", group: "Shell" }],
    });

    // Open the AI tool dropdown
    document.getElementById("btn-pill-ai-tool")?.click();
    // Click Claude option
    const items =
      document.getElementById("dropdown-ai-tool")?.querySelectorAll(
        ".pill-option",
      ) ?? [];
    const claudeItem = Array.from(items).find(
      (el) => el.textContent === "Claude",
    );
    (claudeItem as HTMLElement)?.click();

    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "launchAiTool",
        tool: "claude",
      }),
    );
  });

  it("hides chevron and disables click when only one option", () => {
    initPills();

    updatePillsFromActiveSession({
      aiToolLabel: "OpenCode",
      aiTools: [{ name: "opencode", label: "OpenCode" }],
      backend: "native",
      backendOptions: [{ type: "native", label: "Native Shell", group: "Shell" }],
    });

    const btn = document.getElementById("btn-pill-ai-tool") as HTMLButtonElement;
    expect(btn.dataset.single).toBe("true");
  });
});

describe("tmux command button", () => {
  it("opens command dropdown with the active zellij backend", async () => {
    document.body.innerHTML = `
      <button id="btn-tmux-commands"></button>
      <div id="tmux-command-dropdown" style="display:none"></div>
      <input id="tmux-cmd-search-input" />
      <div id="tmux-command-list"></div>
    `;

    setupTmuxCommandButton(() => "repo-a", () => "zellij");
    document.getElementById("btn-tmux-commands")?.click();

    const listText = document.getElementById("tmux-command-list")?.textContent ?? "";
    expect(listText).toContain("New Tab");
    expect(listText).not.toContain("Swap Pane");
  });
});

describe("tmux window buttons", () => {
  it("dispatches direct tmux session and window commands from toolbar buttons", () => {
    document.body.innerHTML = `
      <button id="btn-tmux-new-session"></button>
      <button id="btn-tmux-prev-window"></button>
      <button id="btn-tmux-new-window"></button>
      <button id="btn-tmux-next-window"></button>
    `;

    setupTmuxWindowButtons();

    document.getElementById("btn-tmux-new-session")?.click();
    document.getElementById("btn-tmux-prev-window")?.click();
    document.getElementById("btn-tmux-new-window")?.click();
    document.getElementById("btn-tmux-next-window")?.click();

    expect(postMessageMock).toHaveBeenNthCalledWith(1, {
      type: "executeTmuxCommand",
      commandId: "ost.createTmuxSession",
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: "executeTmuxCommand",
      commandId: "ost.tmuxPrevWindow",
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(3, {
      type: "executeTmuxCommand",
      commandId: "ost.tmuxCreateWindow",
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(4, {
      type: "executeTmuxCommand",
      commandId: "ost.tmuxNextWindow",
    });
  });

  it("disables direct tmux window movement outside the tmux backend", () => {
    document.body.innerHTML = `
      <button id="btn-tmux-new-session"></button>
      <button id="btn-tmux-prev-window" title="Previous tmux window"></button>
      <button id="btn-tmux-new-window" title="New tmux window"></button>
      <button id="btn-tmux-next-window" title="Next tmux window"></button>
    `;

    updateBackendToggleButtonState("native", {
      native: true,
      tmux: true,
      zellij: false,
    });

    expect(
      (document.getElementById("btn-tmux-new-session") as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (document.getElementById("btn-tmux-prev-window") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (document.getElementById("btn-tmux-new-window") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (document.getElementById("btn-tmux-next-window") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

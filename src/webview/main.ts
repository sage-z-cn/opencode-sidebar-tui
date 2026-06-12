import "@xterm/xterm/css/xterm.css";
import * as AiSelector from "./ai-tool-selector";
import type { HostMessage, TerminalBackendType } from "../types";
import { PaneManager } from "./pane-manager";
import { PaneMessageRouter } from "./pane-message-router";
import { LayoutEngine } from "./layout/layout-engine";
import { TabBar } from "./tab-bar/tab-bar";
import { PaneActions } from "./pane-actions/pane-actions";
import { FocusManager } from "./focus/focus-manager";
import {
  copySelectionToClipboard,
  handlePasteEventWithImageSupport,
} from "./clipboard";
import { postMessage } from "./shared/vscode-api";
import { initTerminal } from "./terminal";
import { createMessageHandler, type MessageHandlerCallbacks } from "./messages";
import {
  setupEditorAttachmentButton,
  setupReloadButton,
  setupRerenderButton,
  setupSettingsButton,
  initPills,
  updatePillsFromActiveSession,
} from "./toolbar";

const callbacks: MessageHandlerCallbacks = {
  onActiveSession(message) {
    const toolbar = document.getElementById("toolbar");
    const toolbarControls = document.querySelector(".toolbar-controls");

    if (toolbar) toolbar.classList.remove("hidden");

    if (toolbarControls) {
      toolbarControls.classList.add("hidden");
    }

    updatePillsFromActiveSession({
      backend: "native" as TerminalBackendType,
      aiToolLabel: message.aiToolLabel,
      aiTools: message.aiTools,
    });
  },

  onShowAiToolSelector(message) {
    AiSelector.show(
      message.sessionId,
      message.sessionName,
      message.defaultTool,
      message.tools,
      message.targetPaneId,
    );
  },

  onPlatformInfo(message) {
    void message;
  },
};

const messageHandler = createMessageHandler(callbacks);

function initApp(): void {
  const container = document.getElementById("terminal-container");
  if (!container) return;

  const instance = initTerminal(container, {
    onData: (data) => {
      postMessage({ type: "terminalInput", data });
    },
    onResize: (cols, rows) => {
      postMessage({ type: "terminalResize", cols, rows });
    },
  });

  if (instance) {
    messageHandler.terminal = instance.terminal;
    messageHandler.fitAddon = instance.fitAddon;
  }

  const multiPaneContainer = document.getElementById("terminal-layout-root") ?? container;
  const paneManager = new PaneManager();
  paneManager.init(multiPaneContainer);
  const paneRouter = new PaneMessageRouter();
  const layoutEngine = new LayoutEngine(multiPaneContainer);
  const tabBar = new TabBar(paneManager, paneRouter);
  const focusManager = new FocusManager(paneManager, paneRouter);
  focusManager.init(multiPaneContainer);

  const paneActions = new PaneActions({
    layoutEngine,
    paneManager,
    getFocusedPaneId: () => focusManager.getFocusedPane(),
    getCurrentPaneCount: () => paneManager.getAllPaneIds().length,
    getLayoutRoot: () => multiPaneContainer,
  });
  paneActions.init(
    document.getElementById("pane-actions-container") ?? undefined,
  );

  paneManager.registerPane("default", instance?.terminal ?? null, container);
  focusManager.registerPane("default", container);
  tabBar.addTab("default", "Terminal");

  tabBar.onTabAdd(() => {
    postMessage({ type: "paneCreate" });
  });

  container.addEventListener(
    "paste",
    (event: ClipboardEvent) => {
      if (!handlePasteEventWithImageSupport(event)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true },
  );

  container.addEventListener(
    "copy",
    (event: ClipboardEvent) => {
      const selection = instance?.terminal.hasSelection()
        ? instance.terminal.getSelection()
        : "";
      if (!selection) {
        return;
      }

      event.preventDefault();
      copySelectionToClipboard(selection);
    },
    { capture: true },
  );

  setupReloadButton();
  setupRerenderButton();
  setupEditorAttachmentButton();
  setupSettingsButton();
  initPills();

  window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data as Record<string, unknown> | undefined;
    if (msg && msg.type === "paneCreate" && "paneId" in msg) {
      const paneId = msg.paneId as string;
      const direction = (msg.direction as string) || "horizontal";
      layoutEngine.splitPane(
        "default",
        direction as "horizontal" | "vertical",
        paneId,
      );
      const newContainer = layoutEngine.getPaneElement(paneId);
      if (newContainer) {
        paneManager.registerPane(paneId, null, newContainer);
        focusManager.registerPane(paneId, newContainer);
        tabBar.addTab(paneId, `Terminal ${paneId}`);
      }
    }
    if (msg && msg.type === "paneDelete" && "paneId" in msg) {
      const paneId = msg.paneId as string;
      paneManager.disposePane(paneId);
      focusManager.unregisterPane(paneId);
      layoutEngine.removePane(paneId);
      tabBar.removeTab(paneId);
    }
    messageHandler.handleEvent(event as MessageEvent<HostMessage>);
  });

  setupAiToolSelectorEvents();
}

const aiCallbacks = {
  postMessage: (msg: unknown) => {
    const m = msg as Record<string, unknown>;
    if (m && m.action === "launchAiTool") {
      postMessage({
        type: "launchAiTool",
        sessionId: String(m.sessionId ?? ""),
        tool: String(m.tool ?? ""),
        savePreference: Boolean(m.savePreference),
        targetPaneId: m.targetPaneId ? String(m.targetPaneId) : undefined,
      });
    }
  },
};

function setupAiToolSelectorEvents(): void {
  document.addEventListener("click", (event) => {
    const target = event
      .composedPath()
      .find((el): el is Element => el instanceof Element);
    if (!target) return;
    if (AiSelector.isVisible()) {
      AiSelector.handleClick(target, aiCallbacks);
    }
  });
}

const boot = () => {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => initApp());
  } else {
    initApp();
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

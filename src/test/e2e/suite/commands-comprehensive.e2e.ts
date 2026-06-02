import * as assert from "assert";
import * as vscode from "vscode";

async function activateExtension(): Promise<vscode.Extension<unknown>> {
  const extension = vscode.extensions.getExtension(
    "sagez.opencode-sidebar-tui-sage",
  );

  assert.ok(extension, "Extension should be available in the test host");
  await extension.activate();
  return extension;
}

const commandCategories = {
  core: [
    "ai-sidebar-terminal.start",
    "ai-sidebar-terminal.focus",
    "ai-sidebar-terminal.paste",
    "ai-sidebar-terminal.openTerminalInEditor",
    "ai-sidebar-terminal.restoreTerminalToSidebar",
  ],
  "file-reference": [
    "ai-sidebar-terminal.sendToTerminal",
    "ai-sidebar-terminal.sendAtMention",
    "ai-sidebar-terminal.sendAllOpenFiles",
    "ai-sidebar-terminal.sendFileToTerminal",
  ],
  "tmux-session": [
    "ai-sidebar-terminal.openInNewWindow",
    "ai-sidebar-terminal.spawnForWorkspace",
    "ai-sidebar-terminal.selectInstance",
    "ai-sidebar-terminal.switchTmuxSession",
    "ai-sidebar-terminal.createTmuxSession",
    "ai-sidebar-terminal.browseTmuxSessions",
    "ai-sidebar-terminal.switchNativeShell",
    "ai-sidebar-terminal.killNativeShell",
    "ai-sidebar-terminal.tmuxKillSession",
    "ai-sidebar-terminal.killTmuxSession",
  ],
  "tmux-pane": [
    "ai-sidebar-terminal.tmuxSwitchPane",
    "ai-sidebar-terminal.tmuxSplitPaneH",
    "ai-sidebar-terminal.tmuxSplitPaneV",
    "ai-sidebar-terminal.tmuxSplitPaneWithCommand",
    "ai-sidebar-terminal.tmuxSendTextToPane",
    "ai-sidebar-terminal.tmuxResizePane",
    "ai-sidebar-terminal.tmuxSwapPane",
    "ai-sidebar-terminal.tmuxKillPane",
  ],
  "tmux-window": [
    "ai-sidebar-terminal.tmuxNextWindow",
    "ai-sidebar-terminal.tmuxPrevWindow",
    "ai-sidebar-terminal.tmuxCreateWindow",
    "ai-sidebar-terminal.tmuxKillWindow",
    "ai-sidebar-terminal.tmuxSelectWindow",
  ],
  dashboard: [
    "ai-sidebar-terminal.openTerminalManager",
    "ai-sidebar-terminal.toggleDashboard",
    "ai-sidebar-terminal.toggleTmuxCommandToolbar",
    "ai-sidebar-terminal.openDashboardInEditor",
    "ai-sidebar-terminal.tmuxRefresh",
  ],
} as const satisfies Record<string, readonly string[]>;

function allExpectedCommands(): string[] {
  return Object.values(commandCategories).flatMap((commands) => [...commands]);
}

suite("Comprehensive command registration", () => {
  for (const [category, expectedCommands] of Object.entries(commandCategories)) {
    test(`registers ${category} commands`, async () => {
      await activateExtension();
      const registeredCommands = await vscode.commands.getCommands(true);

      for (const command of expectedCommands) {
        assert.ok(
          registeredCommands.includes(command),
          `${command} should be registered in ${category}`,
        );
      }
    });
  }

  test("registers every package command exactly once in the comprehensive list", async () => {
    const extension = await activateExtension();
    const packageJSON = extension.packageJSON as {
      contributes?: { commands?: Array<{ command?: string }> };
    };
    const contributedCommands =
      packageJSON.contributes?.commands?.map(({ command }) => command) ?? [];
    const expectedCommands = allExpectedCommands();

    assert.strictEqual(expectedCommands.length, 37);
    assert.deepStrictEqual(
      [...new Set(expectedCommands)].sort(),
      [...expectedCommands].sort(),
    );
    assert.deepStrictEqual(contributedCommands.sort(), expectedCommands.sort());
  });
});



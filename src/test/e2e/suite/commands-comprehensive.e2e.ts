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
    "ost.start",
    "ost.focus",
    "ost.paste",
    "ost.openTerminalInEditor",
    "ost.restoreTerminalToSidebar",
  ],
  "file-reference": [
    "ost.sendToTerminal",
    "ost.sendAtMention",
    "ost.sendAllOpenFiles",
    "ost.sendFileToTerminal",
  ],
  "tmux-session": [
    "ost.openInNewWindow",
    "ost.spawnForWorkspace",
    "ost.selectInstance",
    "ost.switchTmuxSession",
    "ost.createTmuxSession",
    "ost.browseTmuxSessions",
    "ost.switchNativeShell",
    "ost.killNativeShell",
    "ost.tmuxKillSession",
    "ost.killTmuxSession",
  ],
  "tmux-pane": [
    "ost.tmuxSwitchPane",
    "ost.tmuxSplitPaneH",
    "ost.tmuxSplitPaneV",
    "ost.tmuxSplitPaneWithCommand",
    "ost.tmuxSendTextToPane",
    "ost.tmuxResizePane",
    "ost.tmuxSwapPane",
    "ost.tmuxKillPane",
  ],
  "tmux-window": [
    "ost.tmuxNextWindow",
    "ost.tmuxPrevWindow",
    "ost.tmuxCreateWindow",
    "ost.tmuxKillWindow",
    "ost.tmuxSelectWindow",
  ],
  dashboard: [
    "ost.openTerminalManager",
    "ost.toggleDashboard",
    "ost.toggleTmuxCommandToolbar",
    "ost.openDashboardInEditor",
    "ost.tmuxRefresh",
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



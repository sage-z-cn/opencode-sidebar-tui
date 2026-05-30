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

async function executeCommandWithoutUserInput(commandId: string): Promise<void> {
  const closeQuickPick =
    commandId === "ost.browseTmuxSessions"
      ? setTimeout(() => {
          void vscode.commands.executeCommand("workbench.action.closeQuickOpen");
        }, 250)
      : undefined;

  try {
    await vscode.commands.executeCommand(commandId);
  } finally {
    if (closeQuickPick) {
      clearTimeout(closeQuickPick);
    }
  }
}

suite("Command behavior", () => {
  const safeCommands = [
    "ost.start",
    "ost.toggleDashboard",
    "ost.openTerminalManager",
    "ost.browseTmuxSessions",
    "ost.switchTmuxSession",
    "ost.switchNativeShell",
  ];

  for (const commandId of safeCommands) {
    test(`executes ${commandId} without throwing`, async () => {
      await activateExtension();

      await assert.doesNotReject(async () => {
        await executeCommandWithoutUserInput(commandId);
      });
    });
  }
});



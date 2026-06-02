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

async function getRegisteredCommands(): Promise<string[]> {
  await activateExtension();
  return vscode.commands.getCommands(true);
}

function assertCommandRegistered(commands: string[], commandId: string): void {
  assert.ok(commands.includes(commandId), `${commandId} should be registered`);
}

suite("Session flows", () => {
  test("registers tmux-related commands", async () => {
    const commands = await getRegisteredCommands();

    assertCommandRegistered(commands, "ai-sidebar-terminal.switchTmuxSession");
    assertCommandRegistered(commands, "ai-sidebar-terminal.spawnForWorkspace");
    assertCommandRegistered(commands, "ai-sidebar-terminal.browseTmuxSessions");
  });

  test("registers zellij-capable session controls", async () => {
    const extension = await activateExtension();
    const commands = await vscode.commands.getCommands(true);
    const packageJSON = extension.packageJSON as {
      contributes?: {
        configuration?: {
          properties?: Record<
            string,
            {
              enum?: string[];
            }
          >;
        };
      };
    };
    const terminalBackend =
      packageJSON.contributes?.configuration?.properties?.[
        "ai-sidebar-terminal.terminalBackend"
      ];

    assert.ok(
      terminalBackend?.enum?.includes("zellij"),
      "terminalBackend should support zellij",
    );
    assertCommandRegistered(commands, "ai-sidebar-terminal.browseTmuxSessions");
    assertCommandRegistered(commands, "ai-sidebar-terminal.switchTmuxSession");
  });

  test("executes switchTmuxSession command without requiring tmux", async () => {
    await activateExtension();

    await assert.doesNotReject(
      async () =>
        vscode.commands.executeCommand("ai-sidebar-terminal.switchTmuxSession"),
    );
  });

  test("executes switchNativeShell command", async () => {
    const commands = await getRegisteredCommands();
    assertCommandRegistered(commands, "ai-sidebar-terminal.switchNativeShell");

    await assert.doesNotReject(
      async () =>
        vscode.commands.executeCommand("ai-sidebar-terminal.switchNativeShell"),
    );
  });
});



import * as assert from "assert";
import * as vscode from "vscode";

async function activateExtension(): Promise<vscode.Extension<unknown>> {
  const extension = vscode.extensions.getExtension(
    "islee23520.opencode-sidebar-tui",
  );

  assert.ok(extension, "Extension should be available in the test host");
  await extension.activate();
  return extension;
}

suite("Command registration", () => {
  test("registers core extension commands", async () => {
    await activateExtension();

    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes("opencodeTui.start"));
    assert.ok(commands.includes("opencodeTui.focus"));
    assert.ok(commands.includes("opencodeTui.openTerminalInEditor"));
    assert.ok(commands.includes("opencodeTui.toggleDashboard"));
  });

  test("executes focus command without throwing", async () => {
    await activateExtension();

    await vscode.commands.executeCommand("opencodeTui.focus");
    assert.ok(true);
  });

  test("uses opencode auto-start defaults", async () => {
    const extension = await activateExtension();

    const properties = extension.packageJSON.contributes.configuration
      .properties as Record<string, { default: unknown }>;

    assert.strictEqual(properties["opencodeTui.autoStartOnOpen"].default, true);
    assert.strictEqual(
      properties["opencodeTui.defaultAiTool"].default,
      "opencode",
    );
  });
});

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

suite("Webview registration", () => {
  test("registers the sidebar view contribution", async () => {
    const extension = await activateExtension();
    const packageJSON = extension.packageJSON as {
      contributes?: {
        views?: Record<string, Array<{ id?: string; type?: string }>>;
      };
    };

    const sidebarViews =
      packageJSON.contributes?.views?.ostContainer ?? [];
    const terminalView = sidebarViews.find((view) => view.id === "ost");

    assert.ok(terminalView, "ost sidebar view should be contributed");
    assert.strictEqual(terminalView.type, "webview");
  });

  test("registers the dashboard view command", async () => {
    await activateExtension();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("ost.toggleDashboard"),
      "Dashboard command should be registered",
    );
  });

  test("view container command is registered", async () => {
    await activateExtension();

    const commands = await vscode.commands.getCommands(true);
    const viewContainerCommand = "workbench.view.extension.ostContainer";

    assert.ok(
      commands.includes(viewContainerCommand),
      `${viewContainerCommand} should be registered when extension contributes a view container`,
    );
  });
});



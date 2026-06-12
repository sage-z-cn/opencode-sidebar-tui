import * as vscode from "vscode";
import type { ContextManager } from "../../services/ContextManager";
import {
  registerTerminalCommands,
  type TerminalCommandDependencies,
} from "./terminalCommands";

export type RegisterCommandDependencies = TerminalCommandDependencies & {
  contextManager: ContextManager | undefined;
};

export function registerCommands(
  context: vscode.ExtensionContext,
  deps: RegisterCommandDependencies,
): void {
  const disposables: vscode.Disposable[] = [
    ...registerTerminalCommands(deps),
  ];

  context.subscriptions.push(...disposables);
}

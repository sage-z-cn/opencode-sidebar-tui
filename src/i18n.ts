import * as vscode from "vscode";

export const l10n = {
  t: vscode.l10n.t.bind(vscode.l10n) as typeof vscode.l10n.t,
};

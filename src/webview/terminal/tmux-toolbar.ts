import { l10n } from "../../i18n";
import html from "./tmux-toolbar.html?raw";

const titleL10nMap: Record<string, string> = {
  newSession: l10n.t("New tmux session"),
  prevWindow: l10n.t("Previous tmux window"),
  newWindow: l10n.t("New tmux window"),
  nextWindow: l10n.t("Next tmux window"),
  tmuxCommands: l10n.t("Tmux commands"),
  toggleBackend: l10n.t("Cycle terminal backend"),
  toggleEditor: l10n.t("Toggle editor mode"),
  rerender: l10n.t("Refresh terminal"),
  restart: l10n.t("Restart terminal"),
  settings: l10n.t("Settings"),
  extensionSettings: l10n.t("Extension settings"),
  keyboardShortcuts: l10n.t("Open keyboard shortcuts"),
  keybindSettings: l10n.t("Keyboard shortcut settings"),
  noOtherBackend: l10n.t("No other terminal backend is available"),
  switchToBackend: l10n.t("Switch to {backend}"),
  tmuxNotAvailable: l10n.t("tmux is not available"),
  useTabControlsFromCommands: l10n.t("Use tab controls from commands"),
  switchToTmuxToManageWindows: l10n.t("Switch to tmux to manage windows"),
};

function localizeTitles(input: string): string {
  return input.replace(/\{\{t:(\w+)\}\}/g, (_, key: string) => {
    return titleL10nMap[key] ?? `{{t:${key}}}`;
  });
}

/** Strings the webview runtime needs for dynamic title updates. */
export const toolbarL10nStrings: Record<string, string> = {
  noOtherBackend: titleL10nMap.noOtherBackend,
  switchToBackend: titleL10nMap.switchToBackend,
  tmuxNotAvailable: titleL10nMap.tmuxNotAvailable,
  useTabControlsFromCommands: titleL10nMap.useTabControlsFromCommands,
  switchToTmuxToManageWindows: titleL10nMap.switchToTmuxToManageWindows,
  newSession: titleL10nMap.newSession,
  prevWindow: titleL10nMap.prevWindow,
  newWindow: titleL10nMap.newWindow,
  nextWindow: titleL10nMap.nextWindow,
};

export function renderTmuxToolbar(showTmuxWindowControls = true): string {
  let result = html;

  if (!showTmuxWindowControls) {
    result = result.replace(
      'class="tmux-window-controls" data-tmux-window-controls',
      'class="tmux-window-controls hidden" data-tmux-window-controls',
    );
  }

  return localizeTitles(result);
}

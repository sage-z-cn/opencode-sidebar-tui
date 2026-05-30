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
  rerender: l10n.t("Re-render terminal"),
  restart: l10n.t("Restart terminal"),
  settings: l10n.t("Open extension settings"),
};

function localizeTitles(input: string): string {
  return input.replace(/\{\{t:(\w+)\}\}/g, (_, key: string) => {
    return titleL10nMap[key] ?? `{{t:${key}}}`;
  });
}

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

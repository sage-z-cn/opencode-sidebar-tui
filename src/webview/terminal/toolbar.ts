import { l10n } from "../../i18n";
import html from "./toolbar.html?raw";

const titleL10nMap: Record<string, string> = {
  toggleEditor: l10n.t("Toggle editor mode"),
  restart: l10n.t("Restart terminal"),
  settings: l10n.t("Settings"),
  extensionSettings: l10n.t("Extension settings"),
  keybindSettings: l10n.t("Keyboard shortcut settings"),
};

function localizeTitles(input: string): string {
  return input.replace(/\{\{t:(\w+)\}\}/g, (_, key: string) => {
    return titleL10nMap[key] ?? `{{t:${key}}}`;
  });
}

export const toolbarL10nStrings: Record<string, string> = {};

export function renderToolbar(): string {
  return localizeTitles(html);
}

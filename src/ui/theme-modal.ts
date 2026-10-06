// The appearance dialog: Light, Dark or System. The pressed option is the saved preference, not the mode being shown;
// with System pressed a note says which mode the device is giving. Choosing applies at once and never closes it.

import { loadSave, updateSettings } from "../adapters/store.ts";
import { icon, type IconName } from "./icons.ts";
import { applySettings } from "./settings.ts";
import { currentMode, currentPreference, modeToTheme, MODE_EVENT, type ModePref } from "./theme.ts";
import { h, openDialog } from "./ui.ts";

const OPTIONS: { value: ModePref; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "system" },
];

/** The icon for the top-bar button: the preference's own, so a pinned mode shows as pinned. */
export function appearanceIcon(pref: ModePref): IconName {
  return OPTIONS.find((o) => o.value === pref)?.icon ?? "system";
}

export async function openThemeModal(): Promise<void> {
  const note = h("p", { id: "theme-note", class: "hint-text", "aria-live": "polite" });
  const buttons = new Map<ModePref, HTMLButtonElement>();

  const refresh = () => {
    const pref = currentPreference();
    for (const [value, button] of buttons) {
      button.setAttribute("aria-checked", String(value === pref));
      button.tabIndex = value === pref ? 0 : -1;
    }
    note.hidden = pref !== "system";
    note.textContent = pref === "system" ? `Following your device. Currently ${currentMode()}.` : "";
  };

  const choose = (value: ModePref) => {
    updateSettings({ theme: modeToTheme(value) });
    applySettings(loadSave().save.settings);
    refresh();
  };

  const group = h("div", { class: "seg", role: "radiogroup", "aria-label": "Colour mode" });
  for (const option of OPTIONS) {
    const button = h("button", { type: "button", role: "radio", "aria-checked": "false", onclick: () => choose(option.value) }, icon(option.icon), option.label);
    buttons.set(option.value, button);
    group.append(button);
  }
  group.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const at = OPTIONS.findIndex((o) => o.value === currentPreference());
    const next = OPTIONS[(at + step + OPTIONS.length) % OPTIONS.length]!;
    choose(next.value);
    buttons.get(next.value)?.focus();
  });

  refresh();
  // the device can change while the dialog is open: keep the note true
  window.addEventListener(MODE_EVENT, refresh);
  await openDialog({
    title: "Appearance",
    body: [group, note],
    actions: [{ label: "Done", value: "done" }],
  });
  window.removeEventListener(MODE_EVENT, refresh);
}

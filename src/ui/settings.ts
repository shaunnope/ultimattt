// Settings: hints, automatic replay, appearance and the icons for X and O. Changes apply at once
// and are remembered on this device.

import type { Settings, Theme } from "../core/settings.ts";
import { validateIcons } from "../core/icons.ts";
import { loadSave, updateSettings } from "../adapters/store.ts";
import { setGlyphs } from "./glyph.ts";
import { iconMessage } from "./messages.ts";
import { applyTheme } from "./theme.ts";
import { h, openDialog } from "./ui.ts";

export const SETTINGS_EVENT = "ttt:settings";

/** Put settings into effect: icons and appearance now, and tell the screen to redraw. */
export function applySettings(settings: Settings): void {
  setGlyphs(settings.icons);
  applyTheme(settings.theme);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SETTINGS_EVENT));
}

function checkbox(label: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const input = h("input", { type: "checkbox", checked });
  input.addEventListener("change", () => onChange(input.checked));
  return h("label", { class: "check" }, input, h("span", null, label));
}

export async function openSettings(): Promise<void> {
  const settings = loadSave().save.settings;
  const change = (patch: Partial<Settings>) => {
    updateSettings(patch);
    applySettings(loadSave().save.settings);
  };

  const themeSelect = h("select", { id: "theme-select" },
    h("option", { value: "auto", selected: settings.theme === "auto" }, "Auto (follow the system)"),
    h("option", { value: "light", selected: settings.theme === "light" }, "Light"),
    h("option", { value: "dark", selected: settings.theme === "dark" }, "Dark"));
  themeSelect.addEventListener("change", () => change({ theme: themeSelect.value as Theme }));

  const iconX = h("input", { id: "icon-x", type: "text", value: settings.icons.X, maxlength: 16, autocomplete: "off", spellcheck: "false" });
  const iconO = h("input", { id: "icon-o", type: "text", value: settings.icons.O, maxlength: 16, autocomplete: "off", spellcheck: "false" });
  const iconError = h("p", { class: "field-error", role: "alert" });
  iconError.hidden = true;
  const onIcons = () => {
    const icons = { X: iconX.value, O: iconO.value };
    const check = validateIcons(icons);
    iconError.textContent = iconMessage(check);
    iconError.hidden = check.ok;
    if (check.ok) change({ icons });
  };
  iconX.addEventListener("input", onIcons);
  iconO.addEventListener("input", onIcons);
  const reset = h("button", { class: "btn btn-small", type: "button" }, "Use X and O");
  reset.addEventListener("click", () => {
    iconX.value = "X";
    iconO.value = "O";
    onIcons();
  });

  await openDialog({
    title: "Settings",
    body: [
      checkbox("Show hints", settings.hints, (hints) => change({ hints })),
      h("p", { class: "hint-text" }, "Marks the cells that win for you (a dot) and the cells you must block (a dashed ring) on your turn."),
      checkbox("Replay a finished game automatically", settings.autoReplay, (autoReplay) => change({ autoReplay })),
      h("label", { class: "field" }, "Appearance", themeSelect),
      h("fieldset", { class: "icon-fields" },
        h("legend", null, "Icons (on this device only)"),
        h("label", { class: "field" }, "Icon for X", iconX),
        h("label", { class: "field" }, "Icon for O", iconO),
        iconError,
        reset),
    ],
    actions: [{ label: "Done", value: "done", primary: true }],
  });
}

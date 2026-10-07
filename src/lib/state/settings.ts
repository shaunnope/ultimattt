// The settings the screens share, as a store: read through the saved game, written through updateSettings, put into effect
// (mark colours and appearance) and announced to whoever is watching. Colours and turn names are display preferences: they
// never reach a game, a seed, a link or the network.
import { loadSave, updateSettings } from "../../adapters/store.ts";
import type { Settings } from "../../core/settings.ts";
import { applyMarkPalette, applyMode, themeToMode } from "../../ui/theme.ts";

/** Fired on window after settings are put into effect, for the screens that are still built by hand. */
export const SETTINGS_EVENT = "ttt:settings";

export interface SettingsDeps {
  load(): Settings;
  save(patch: Partial<Settings>): void;
  apply(settings: Settings): void;
}

export interface SettingsState {
  subscribe(run: (settings: Settings) => void): () => void;
  get(): Settings;
  /** Save a change and put it into effect. */
  update(patch: Partial<Settings>): void;
  /** Put the saved settings into effect without saving anything (at start-up). */
  apply(): void;
}

export function createSettingsState(deps: SettingsDeps): SettingsState {
  // other code (the start screen's last choices, for one) also writes to the saved settings, so they are read when asked for
  const listeners = new Set<(settings: Settings) => void>();
  const refresh = (): void => {
    const now = deps.load();
    deps.apply(now);
    for (const run of [...listeners]) run(now);
  };
  return {
    subscribe(run) {
      listeners.add(run);
      run(deps.load());
      return () => void listeners.delete(run);
    },
    get: () => deps.load(),
    update(patch) {
      deps.save(patch);
      refresh();
    },
    apply: refresh,
  };
}

/** Put settings into effect: colours and appearance now, and tell the screen to redraw. */
function applyToPage(settings: Settings): void {
  applyMarkPalette(settings.markPalette);
  applyMode(themeToMode(settings.theme));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SETTINGS_EVENT));
}

/** The page's settings. */
export const settings = createSettingsState({ load: () => loadSave().save.settings, save: updateSettings, apply: applyToPage });

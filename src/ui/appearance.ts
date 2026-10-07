// The three appearance choices and the icon that stands for each: the top-bar button shows the saved preference's own
// icon, so a pinned mode shows as pinned. DOM-free data, shared by the top bar and the appearance dialog.

import type { IconName } from "./icons.ts";
import type { ModePref } from "./theme.ts";

export const APPEARANCE_OPTIONS: { value: ModePref; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "system" },
];

export function appearanceIcon(pref: ModePref): IconName {
  return APPEARANCE_OPTIONS.find((o) => o.value === pref)?.icon ?? "system";
}

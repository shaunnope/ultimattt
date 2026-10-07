// The help page's place in the router: open it over the current screen, leave it, and ask whether it is showing. The rules
// are in ui/help-nav.ts (unit-tested); this applies them with SvelteKit's navigation.
import { goto, pushState } from "$app/navigation";
import { page } from "$app/state";
import { isHelpOpen, leaveHelpAction } from "../../ui/help-nav.ts";

/** Open help over whatever is on screen: the address becomes #/help and the screen underneath stays as it is. */
export async function openHelp(): Promise<void> {
  await pushState("#/help", { help: true });
}

/** Leave help the way the player got there (see leaveHelpAction). */
export async function leaveHelp(): Promise<void> {
  if (leaveHelpAction(page.state) === "back") history.back();
  else await goto("#/", { replaceState: true });
}

/** True while help is showing, by either way of getting there. Reactive: it reads the router's page state. */
export const helpOpen = (): boolean => isHelpOpen(page.state, page.route.id);

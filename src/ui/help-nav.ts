// Where the help page is, and how to leave it. Help is a shallow route when the player opens it from a screen (the address
// becomes #/help, the screen underneath stays mounted and a game in progress carries on) and a real route when it was
// loaded directly (an old bookmark, a typed address). DOM-free, so the rules are unit-tested; the shell applies them.

export interface HelpPageState {
  help?: boolean | undefined;
}

export const HELP_ROUTE = "/help";

/** True while the help page is showing, by either way of getting there. */
export function isHelpOpen(state: HelpPageState, routeId: string | null): boolean {
  return state.help === true || routeId === HELP_ROUTE;
}

/**
 * Leaving help: "back" when it was opened over a screen (history goes back to that screen exactly as it was), "home" when
 * it was loaded directly (replace the entry with the start address, so Back never leaves the app).
 */
export function leaveHelpAction(state: HelpPageState): "back" | "home" {
  return state.help === true ? "back" : "home";
}

// Words for the reasons a move can be refused. Core code returns stable keys; this is the
// only place they become text. Each variant adds its keys here (tests/unit/messages.test.ts
// fails if a core reason has no message).

const MESSAGES: Record<string, string> = {
  occupied: "That square is taken. Choose an empty one.",
  "out-of-range": "That square is not on the board.",
  "game-over": "The game is over.",
  "not-a-placement": "That is not a move you can make here.",
  "not-your-board": "Play in the highlighted board.",
  "invalid-move": "That is not a move you can make here.",
  "rotate-pending": "You scored. Turn a layer of the cube before the next move.",
  "no-rotation-due": "You only turn a layer after scoring a line.",
  "not-connected": "You are not connected to your friend.",
  "not-your-turn": "It is your friend's turn.",
  "out-of-sync": "Your game was out of step with your friend's, so it was refreshed.",
  "nothing-to-undo": "You have no move of your own to take back yet.",
  "undo-pending": "You have already asked to take a move back.",
  "closed-board": "That board is already decided. Choose an open board.",
};

const GENERIC = "That move is not allowed.";

export function refusalMessage(reason: string): string {
  return MESSAGES[reason] ?? GENERIC;
}

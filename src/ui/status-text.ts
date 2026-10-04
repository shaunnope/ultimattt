// The words of the status line: whose move it is, what a Twist player must do next, how a game ended. Pure: no DOM.

import type { Mark, Variant } from "../core/types.ts";
import { other } from "../core/types.ts";

export interface StatusContext {
  variant: Variant;
  status: "playing" | "won" | "draw" | "tie";
  winner: Mark | null;
  toMove: Mark;
  /** Twist only: a mark was just scored and a layer must be turned */
  phase?: "place" | "rotate";
  mode: "one-device" | "computer" | "two-device";
  /** Against the computer: the player's mark */
  humanMark?: Mark;
  /** On two devices: this device's mark */
  myMark?: Mark;
  resigned: Mark | null;
  /** The computer is choosing, or about to */
  thinking: boolean;
  /** Why a Twist game ended early on locked faces, or "" */
  lockNote: string;
  /** Ultimate: where the next move goes, or "" */
  where: string;
}

const withNote = (text: string, note: string): string => (note ? `${text} ${note}` : text);

/** One sentence for the status line. */
export function statusText(ctx: StatusContext): string {
  if (ctx.resigned) return `${ctx.resigned} resigned. ${other(ctx.resigned)} wins.`;
  if (ctx.status === "won") return withNote(`${ctx.winner!} wins!`, ctx.lockNote);
  if (ctx.status === "draw") return "It's a draw.";
  if (ctx.status === "tie") return withNote("It's a tie.", ctx.lockNote);
  const suffix = (turn: string): string => (ctx.variant === "ultimate" && ctx.where ? `${turn} ${ctx.where}` : turn);
  if (ctx.mode === "two-device") {
    const mine = ctx.toMove === ctx.myMark;
    if (ctx.variant === "cube" && ctx.phase === "rotate") return mine ? `${ctx.toMove} scored! Turn a layer of the cube.` : "Waiting for your friend to turn a layer.";
    return suffix(mine ? `Your move (${ctx.toMove}).` : `Waiting for your friend (${ctx.toMove}).`);
  }
  if (ctx.thinking) return "Computer is thinking…";
  if (ctx.variant === "cube") return ctx.phase === "rotate" ? `${ctx.toMove} scored! Turn a layer of the cube.` : `${ctx.toMove} to move.`;
  return suffix(ctx.mode === "computer" ? `Your move (${ctx.humanMark ?? ctx.toMove}).` : `${ctx.toMove} to move.`);
}

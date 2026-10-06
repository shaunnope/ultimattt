// The words of the status line (results, resignation, waiting, what a Twist player must do next, where to play, errors; a plain
// turn has none, the pill shows it) and the model of the current-player pill. Pure: no DOM.

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

/** One sentence for the status line; "" for a plain turn, which the pill shows instead. */
export function statusText(ctx: StatusContext): string {
  if (ctx.resigned) return `${ctx.resigned} resigned. ${other(ctx.resigned)} wins.`;
  if (ctx.status === "won") return withNote(`${ctx.winner!} wins.`, ctx.lockNote);
  if (ctx.status === "draw") return "It's a draw.";
  if (ctx.status === "tie") return withNote("It's a tie.", ctx.lockNote);
  // Ultimate keeps its where-to-play note; a plain turn is empty.
  const where = ctx.variant === "ultimate" ? ctx.where : "";
  if (ctx.mode === "two-device") {
    const mine = ctx.toMove === ctx.myMark;
    if (ctx.variant === "cube" && ctx.phase === "rotate") return mine ? `${ctx.toMove} scored. Turn a layer of the cube.` : "Waiting for your friend to turn a layer.";
    return mine ? where : withNote(`Waiting for your friend (${ctx.toMove}).`, where);
  }
  if (ctx.thinking) return "Computer is thinking…";
  if (ctx.variant === "cube" && ctx.phase === "rotate") return `${ctx.toMove} scored. Turn a layer of the cube.`;
  return where;
}

export interface Segment {
  mark: Mark;
  /** The player to move, while the game is playing */
  active: boolean;
  /** The winner, once the game is over */
  winner: boolean;
  /** Twist only */
  score?: number;
  /** This device's mark (two devices) or the human's (computer) */
  you: boolean;
}

export interface PillModel {
  /** X first, O second, on every device */
  segments: [Segment, Segment];
  /** The text for the live region */
  spoken: string;
}

export interface PillContext {
  variant: Variant;
  status: "playing" | "won" | "draw" | "tie";
  winner: Mark | null;
  toMove: Mark;
  /** Twist: the scores by the game's scoring rule */
  scores?: { X: number; O: number };
  mode: "one-device" | "computer" | "two-device";
  humanMark?: Mark;
  myMark?: Mark;
  resigned: Mark | null;
}

/** Who is highlighted, the Twist scores, and what to say aloud. */
export function pillModel(ctx: PillContext): PillModel {
  const over = ctx.resigned !== null || ctx.status !== "playing";
  const winner: Mark | null = ctx.resigned ? other(ctx.resigned) : ctx.status === "won" ? ctx.winner : null;
  const twist = ctx.variant === "cube" && ctx.scores !== undefined;
  const you = ctx.mode === "two-device" ? ctx.myMark : ctx.mode === "computer" ? ctx.humanMark : undefined;
  const segment = (mark: Mark): Segment => ({
    mark,
    active: !over && ctx.toMove === mark,
    winner: winner === mark,
    ...(twist ? { score: ctx.scores![mark] } : {}),
    you: you === mark,
  });
  const tally = twist ? `, X ${ctx.scores!.X}, O ${ctx.scores!.O}` : "";
  let lead: string;
  if (ctx.resigned) lead = `${ctx.resigned} resigned, ${other(ctx.resigned)} wins`;
  else if (ctx.status === "won") lead = `${ctx.winner!} wins`;
  else if (ctx.status === "draw") lead = "It's a draw";
  else if (ctx.status === "tie") lead = "It's a tie";
  else lead = `${ctx.toMove} to move`;
  return { segments: [segment("X"), segment("O")], spoken: `${lead}${ctx.resigned ? "" : tally}` };
}

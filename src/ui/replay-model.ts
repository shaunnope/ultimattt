// What the replay says at each position: the pill, the result line (only at the end), the readout and what is spoken. Pure: no
// DOM. The frames themselves come from core/replay.ts (every frame is the rules played to that point).

import type { CubeState } from "../core/cube.ts";
import type { Frame } from "../core/replay.ts";
import type { GameConfig, Mark } from "../core/types.ts";
import { other } from "../core/types.ts";
import { lockEndText } from "./cube-labels.ts";
import { pillModel, type PillModel } from "./status-text.ts";

export interface FrameView {
  /** The index shown, held to the ends of the game. */
  index: number;
  total: number;
  pill: PillModel;
  /** The result, at the last position only; a plain turn is shown by the pill alone. */
  result: string;
  readout: string;
  spoken: string;
}

/** How the game ended, in words, for the last position. */
function outcome(config: GameConfig, frames: readonly Frame[], resigned?: Mark): string {
  if (resigned) return `${resigned} resigned. ${other(resigned)} wins.`;
  const state = frames[frames.length - 1]!.state;
  const lockNote = config.variant === "cube" ? lockEndText(state as CubeState) : "";
  const note = lockNote ? ` ${lockNote}` : "";
  if (state.status === "won") return `${state.winner!} wins.${note}`;
  if (state.status === "draw") return "It's a draw.";
  if (state.status === "tie") return `It's a tie.${note}`;
  return "";
}

export function frameView(config: GameConfig, frames: readonly Frame[], at: number, resigned?: Mark): FrameView {
  const total = frames.length - 1;
  const index = Math.max(0, Math.min(total, at));
  const state = frames[index]!.state;
  const last = index === total;
  const result = last ? outcome(config, frames, resigned).trim() : "";
  const pill = pillModel({
    variant: config.variant,
    status: state.status,
    winner: state.winner,
    toMove: state.toMove,
    ...(config.variant === "cube" ? { scores: (state as CubeState).scores } : {}),
    mode: "one-device",
    resigned: last && resigned ? resigned : null,
  });
  const readout = `Move ${index} of ${total}`;
  return { index, total, pill, result, readout, spoken: `${readout}. ${result || pill.spoken}` };
}

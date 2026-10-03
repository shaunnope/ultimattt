// One place that knows which module implements which variant, so the UI, the AI worker,
// replay and the network code all go through the same shape (see contracts/core-api.md).

import type { GameConfig, Legality, Mark, Move, StateBase, Status } from "./types.ts";
import * as classic from "./classic.ts";
import * as ultimate from "./ultimate.ts";
import * as cube from "./cube.ts";

export type AnyGameState = classic.ClassicState | ultimate.UltimateState | cube.CubeState;

export interface Outcome {
  status: Status;
  winner: Mark | null;
  winLine?: number[];
}

export interface VariantModule<S extends StateBase> {
  newGame(config: GameConfig): S;
  legalMoves(state: S): Move[];
  isLegal(state: S, move: Move): Legality;
  apply(state: S, move: Move): S;
  status(state: S): Outcome;
  undo(state: S): S;
  fromMoves(config: GameConfig, moves: Move[]): S;
  hash(state: S): number;
}

export function moduleFor(config: GameConfig): VariantModule<AnyGameState> {
  switch (config.variant) {
    case "classic":
      return classic as VariantModule<AnyGameState>;
    case "ultimate":
      return ultimate as unknown as VariantModule<AnyGameState>;
    case "cube":
      return cube as unknown as VariantModule<AnyGameState>;
    default:
      throw new Error(`variant ${config.variant} is not implemented yet`);
  }
}

export function fromMoves(config: GameConfig, moves: Move[]): AnyGameState {
  return moduleFor(config).fromMoves(config, moves);
}

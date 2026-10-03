// Compact text for moves, and the replay link built from them (contracts/record-format.md).
// A link carries the seed, who played and the moves; the result is never carried, it is always
// recomputed by playing the moves through the rules, so a link cannot claim a result.
//
// Move tokens:
//   Classic  one character, 0-9 then a-o: the cell, reading along each row from the top left
//   Ultimate two characters: board 0-8, cell 0-8
//   Cube     two characters (face 0-5, cell 0-8) for a mark; "." axis layer way for a turn, e.g. ".x1+"
//            (way: "+" a quarter, "-" a quarter back, "2" a half turn)

import type { GameConfig, Level, Mark, Mode, Move, Variant } from "./types.ts";
import { parseSeed } from "./seed.ts";
import { decodeMoves, encodeMoves } from "./tokens.ts";
import { fromMoves } from "./variants.ts";

export { decodeMoves, encodeMove, encodeMoves } from "./tokens.ts";

export interface Players {
  mode: Mode;
  level?: Level;
  humanMark?: Mark;
}

export interface ReplayRecord {
  variant: Variant;
  seed: string;
  moves: Move[];
  players: Players;
  /** A resignation: rx = X resigned, ro = O resigned */
  end?: "rx" | "ro";
}

export function configFromRecord(record: ReplayRecord): GameConfig {
  const parsed = parseSeed(record.seed);
  const size = "error" in parsed ? 3 : (parsed.size ?? 3);
  const config: GameConfig = { variant: record.variant, size, mode: record.players.mode, seed: record.seed };
  if (record.players.level !== undefined) config.level = record.players.level;
  if (record.players.humanMark !== undefined) config.humanMark = record.players.humanMark;
  return config;
}

function gameText(players: Players): string {
  if (players.mode === "local") return "l";
  if (players.mode === "network") return "n";
  return `c${players.level ?? 3}${(players.humanMark ?? "X").toLowerCase()}`;
}

/** The link's query string, starting with "?". `nonce` only makes each link look different; it is not read back. */
export function packLink(record: ReplayRecord, nonce: number): string {
  const parts = [`watch=${nonce}`, `seed=${record.seed}`, `game=${gameText(record.players)}`, `moves=${encodeURIComponent(encodeMoves(record.variant, record.moves))}`];
  if (record.end) parts.push(`end=${record.end}`);
  return `?${parts.join("&")}`;
}

function parsePlayers(text: string): Players | { error: string } {
  if (text === "l") return { mode: "local" };
  if (text === "n") return { mode: "network" };
  const m = /^c([1-5])([xo])$/.exec(text);
  if (m) return { mode: "computer", level: Number(m[1]) as Level, humanMark: m[2] === "x" ? "X" : "O" };
  return { error: "This link says nothing sensible about who played." };
}

/** Read a replay link (a full URL or just its query). Never throws: bad links give { error }. */
export function unpackLink(link: string): ReplayRecord | { error: string } {
  const query = link.includes("?") ? link.slice(link.indexOf("?")) : link;
  const params = new URLSearchParams(query);
  const seed = params.get("seed");
  const game = params.get("game");
  const movesText = params.get("moves");
  if (!seed || !game || movesText === null) return { error: "This link is missing part of the game." };
  const parsedSeed = parseSeed(seed);
  if ("error" in parsedSeed) return { error: parsedSeed.error };
  const players = parsePlayers(game);
  if ("error" in players) return players;
  if (parsedSeed.variant === "cube" && players.mode === "computer") return { error: "The Cube has no computer opponent." };
  const moves = decodeMoves(parsedSeed.variant, movesText);
  if (!Array.isArray(moves)) return moves;
  const endText = params.get("end");
  if (endText !== null && endText !== "rx" && endText !== "ro") return { error: "This link has an unknown ending." };
  const record: ReplayRecord = { variant: parsedSeed.variant, seed: seed.trim().toUpperCase(), moves, players };
  if (endText) record.end = endText;
  try {
    fromMoves(configFromRecord(record), moves);
  } catch (e) {
    return { error: `This game cannot be played back: ${e instanceof Error ? e.message : "an illegal move"}.` };
  }
  return record;
}

/** The record of a game just played (or being watched): who played, the moves, and any resignation. */
export function recordFromGame(config: GameConfig, moves: readonly Move[], resigned?: Mark): ReplayRecord {
  const players: Players = { mode: config.mode };
  if (config.level !== undefined) players.level = config.level;
  if (config.humanMark !== undefined) players.humanMark = config.humanMark;
  const record: ReplayRecord = { variant: config.variant, seed: config.seed, moves: [...moves], players };
  if (resigned) record.end = resigned === "X" ? "rx" : "ro";
  return record;
}

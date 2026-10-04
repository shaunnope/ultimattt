// Compact text for moves, and the replay link built from them (contracts/record-format.md).
// A link carries the rules, the seed (computer games only), who played and the moves; the result is
// never carried, it is always recomputed by playing the moves through the rules, so a link cannot
// claim a result. 001 links, which have a seed and no rules, still open: the rules come from the seed.
// Move tokens are in tokens.ts.

import type { GameConfig, Level, Mark, Mode, Move } from "./types.ts";
import type { Rules } from "./rules.ts";
import { parseRulesCode, rulesCode } from "./rules.ts";
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
  rules: Rules;
  /** Present for computer games only */
  seed?: string;
  moves: Move[];
  players: Players;
  /** A resignation: rx = X resigned, ro = O resigned */
  end?: "rx" | "ro";
}

export function configFromRecord(record: ReplayRecord): GameConfig {
  const { variant, size, winLength, scoring, lockFaces } = record.rules;
  const config: GameConfig = { variant, size, winLength, scoring, lockFaces, mode: record.players.mode };
  if (record.players.mode === "computer" && record.seed !== undefined) config.seed = record.seed;
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
  const { variant, size, winLength, scoring, lockFaces } = record.rules;
  const parts = [`watch=${nonce}`, `rules=${rulesCode(variant, size, winLength, scoring, lockFaces)}`];
  if (record.players.mode === "computer" && record.seed) parts.push(`seed=${record.seed}`);
  parts.push(`game=${gameText(record.players)}`, `moves=${encodeURIComponent(encodeMoves(variant, record.moves))}`);
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
  const rulesText = params.get("rules");
  const seedText = params.get("seed");
  const game = params.get("game");
  const movesText = params.get("moves");
  if (!game || movesText === null || (!rulesText && !seedText)) return { error: "This link is missing part of the game." };

  const fromSeed = seedText ? parseSeed(seedText) : null;
  if (fromSeed && "error" in fromSeed) return { error: fromSeed.error };
  let rules: Rules;
  if (rulesText) {
    const parsed = parseRulesCode(rulesText);
    if ("error" in parsed) return { error: parsed.error };
    rules = parsed;
    if (fromSeed && (fromSeed.variant !== rules.variant || fromSeed.size !== rules.size || fromSeed.winLength !== rules.winLength)) {
      return { error: "The game and the seed in this link do not match." };
    }
  } else {
    // No rules: a 001 link. The seed prefix names them.
    if (!fromSeed || "error" in fromSeed) return { error: "This link is missing part of the game." };
    rules = { variant: fromSeed.variant, size: fromSeed.size, winLength: fromSeed.winLength, scoring: "lines", lockFaces: false };
  }

  const players = parsePlayers(game);
  if ("error" in players) return players;
  if (rules.variant === "cube" && players.mode === "computer") return { error: "Twist has no computer opponent." };
  if (players.mode === "computer" && !seedText) return { error: "This link is missing part of the game." };
  const moves = decodeMoves(rules.variant, movesText);
  if (!Array.isArray(moves)) return moves;
  const endText = params.get("end");
  if (endText !== null && endText !== "rx" && endText !== "ro") return { error: "This link has an unknown ending." };
  const record: ReplayRecord = { rules, moves, players };
  if (players.mode === "computer" && seedText) record.seed = seedText.trim().toUpperCase();
  if (endText) record.end = endText;
  try {
    fromMoves(configFromRecord(record), moves);
  } catch (e) {
    return { error: `This game cannot be played back: ${e instanceof Error ? e.message : "an illegal move"}.` };
  }
  return record;
}

/** The record of a game just played (or being watched): its rules, who played, the moves, and any resignation. */
export function recordFromGame(config: GameConfig, moves: readonly Move[], resigned?: Mark): ReplayRecord {
  const players: Players = { mode: config.mode };
  if (config.level !== undefined) players.level = config.level;
  if (config.humanMark !== undefined) players.humanMark = config.humanMark;
  const record: ReplayRecord = { rules: { variant: config.variant, size: config.size, winLength: config.winLength, scoring: config.scoring, lockFaces: config.lockFaces }, moves: [...moves], players };
  if (config.mode === "computer" && config.seed) record.seed = config.seed;
  if (resigned) record.end = resigned === "X" ? "rx" : "ro";
  return record;
}

// The save file: settings and the game in progress, in localStorage (or memory when that is
// unavailable). The game is stored as its config and its moves; the position is always rebuilt by
// playing the moves through the rules, so a save can never disagree with them.
// Schema 2 (schema 1 saves are migrated on read). An unknown or corrupt save is never overwritten: it is copied aside first.

import type { GameConfig, Mark, Move } from "../core/types.ts";
import { parseConfig } from "../core/config.ts";
import { legacyWinLength } from "../core/rules.ts";
import { isValidCode, normaliseCode } from "../core/pairing.ts";
import type { Settings } from "../core/settings.ts";
import { DEFAULT_SETTINGS, normalizeSettings } from "../core/settings.ts";
import { encodeMoves } from "../core/tokens.ts";
import { storageGet, storageSet } from "./storage.ts";

export const SAVE_KEY = "ttt.save";
export const BACKUP_KEY = "ttt.save.backup";

export interface SavedGame {
  config: GameConfig;
  /** Moves as compact tokens (contracts/record-format.md) */
  moves: string;
  startedAt: number;
  resigned?: Mark;
  /** Set for a game this device is hosting for a friend: the code to host it under again after a reload */
  hostCode?: string;
  /** Set for a game this device joined as a guest: the code to join again after a reload (never set together with hostCode) */
  joinCode?: string;
}

export interface SaveFile {
  schema: 2;
  settings: Settings;
  game: SavedGame | null;
}

export type ParseResult = { ok: true; save: SaveFile } | { ok: false; reason: "unknown-schema" | "corrupt" };

export function defaultSave(): SaveFile {
  return { schema: 2, settings: { ...DEFAULT_SETTINGS }, game: null };
}

export function savedGameFrom(config: GameConfig, moves: readonly Move[], startedAt: number, resigned?: Mark, hostCode?: string, joinCode?: string): SavedGame {
  const saved: SavedGame = { config, moves: encodeMoves(config.variant, moves), startedAt };
  if (resigned) saved.resigned = resigned;
  if (hostCode) saved.hostCode = hostCode;
  else if (joinCode) saved.joinCode = joinCode;
  return saved;
}

export function serializeSave(save: SaveFile): string {
  return JSON.stringify(save);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Schema 1 to 2 (contracts/record-format.md): drop the custom icons, add the palette and notation, give saved
 *  games and the remembered setup the win length 001 implied, and drop the seed from games without a computer.
 *  Pure. It throws only on a shape it cannot read, and the caller treats that like an unknown schema. */
export function migrate1to2(save: Record<string, unknown>): Record<string, unknown> {
  const withLength = (raw: unknown): unknown => {
    if (!isObject(raw)) return raw;
    const out: Record<string, unknown> = { ...raw };
    if (out.winLength === undefined && typeof out.variant === "string" && typeof out.size === "number") {
      out.winLength = legacyWinLength(out.variant as GameConfig["variant"], out.size);
    }
    return out;
  };
  const settings: Record<string, unknown> = isObject(save.settings) ? { ...save.settings } : {};
  delete settings.icons;
  settings.markPalette = "default";
  settings.cubeNotation = "words";
  if (settings.lastSetup !== undefined && settings.lastSetup !== null) settings.lastSetup = withLength(settings.lastSetup);
  let game: unknown = save.game ?? null;
  if (isObject(game)) {
    const config = withLength(game.config);
    if (isObject(config) && config.mode !== "computer") delete config.seed;
    game = { ...game, config };
  }
  return { ...save, schema: 2, settings, game };
}

const isMark = (v: unknown): v is Mark => v === "X" || v === "O";

function readGame(raw: unknown): SavedGame | null {
  if (typeof raw !== "object" || raw === null) return null;
  const g = raw as Record<string, unknown>;
  const config = parseConfig(g.config);
  if (!config || typeof g.moves !== "string" || typeof g.startedAt !== "number") return null;
  const game: SavedGame = { config, moves: g.moves, startedAt: g.startedAt };
  if (isMark(g.resigned)) game.resigned = g.resigned;
  if (typeof g.hostCode === "string" && isValidCode(g.hostCode)) game.hostCode = normaliseCode(g.hostCode);
  if (!game.hostCode && typeof g.joinCode === "string" && isValidCode(g.joinCode)) game.joinCode = normaliseCode(g.joinCode);
  return game;
}

export function parseSave(text: string | null): ParseResult {
  if (text === null || text === "") return { ok: true, save: defaultSave() };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, reason: "corrupt" };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.schema !== "number") return { ok: false, reason: "corrupt" };
  let current: Record<string, unknown> = obj;
  if (obj.schema === 1) {
    try {
      current = migrate1to2(obj);
    } catch {
      return { ok: false, reason: "unknown-schema" };
    }
  }
  if (current.schema !== 2) return { ok: false, reason: "unknown-schema" };
  return { ok: true, save: { schema: 2, settings: normalizeSettings(current.settings), game: readGame(current.game) } };
}

const NOTICE = "Your saved game could not be read, so a new one was started. The old save was kept aside.";

/** Keep the settings as they are and replace (or clear) the game in progress. */
export function saveGame(game: SavedGame | null): void {
  const { save } = loadSave();
  writeSave({ ...save, game });
}

/** Change some settings, keeping everything else in the save. */
export function updateSettings(patch: Partial<Settings>): void {
  const { save } = loadSave();
  writeSave({ ...save, settings: normalizeSettings({ ...save.settings, ...patch }) });
}

export function loadSave(): { save: SaveFile; notice?: string } {
  const raw = storageGet(SAVE_KEY);
  const result = parseSave(raw);
  if (result.ok) return { save: result.save };
  // Keep what could not be read; the next write replaces the save but never loses this copy.
  if (raw !== null) storageSet(BACKUP_KEY, raw);
  return { save: defaultSave(), notice: NOTICE };
}

/** Write the save. Whatever unreadable text is already there is copied to the backup key first. */
export function writeSave(save: SaveFile): boolean {
  const existing = storageGet(SAVE_KEY);
  if (existing && !parseSave(existing).ok) storageSet(BACKUP_KEY, existing);
  return storageSet(SAVE_KEY, serializeSave(save));
}

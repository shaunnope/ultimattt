// Game seeds. A seed exists only for a game with a computer player. It decides which mark a
// "let the game decide" player takes and every roll of the dice the computer makes, so the same
// seed and the same moves are always the same game.
//
// Written as "C53-BXK4-M9TR". The prefix is the rules code (variant letter, board size, win length);
// the eight characters after it are the seed proper. 001 prefixes (3X3, 4X4, 5X5, ULT, CUB) still read.
//
// Integer arithmetic only. Math.random differs between browsers and would make
// a replayed game differ. Only newSeed reads crypto, once, at game creation.

import type { Mark, Variant } from "./types.ts";
import { legacyWinLength, parseRulesCode, rulesCode } from "./rules.ts";

// No vowels and no 0 O 1 I, so a seed read aloud cannot be misheard or spell a word.
export const SEED_ALPHABET = "BCDFGHJKLMNPQRSTVWXYZ23456789";
const BODY_LENGTH = 8;

const LEGACY_PREFIXES = {
  "3X3": { variant: "classic", size: 3 },
  "4X4": { variant: "classic", size: 4 },
  "5X5": { variant: "classic", size: 5 },
  ULT: { variant: "ultimate", size: 3 },
  CUB: { variant: "cube", size: 3 },
} as const;

export type ParsedSeed =
  | { variant: Variant; size: 3 | 4 | 5; winLength: number; body: string }
  | { error: string };

// 32 bit string hash (cyrb53's mixing, folded to 32 bits).
export function hashString(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

// A small, fast, well mixed generator (mulberry32). Returns unsigned 32 bit integers.
export function randomSource(seedNumber: number): () => number {
  let a = seedNumber >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** Random source for one move of a game. Depends only on the seed and the move index,
 *  so undo and replay never depend on how many numbers were drawn before. */
export function rngFor(seed: string, moveIndex: number): () => number {
  return randomSource(hashString(`${seed}#${moveIndex}`));
}

function randomBody(): string {
  // Bytes at or above the limit would make some characters likelier than others.
  const limit = 256 - (256 % SEED_ALPHABET.length);
  let body = "";
  while (body.length < BODY_LENGTH) {
    const [byte] = globalThis.crypto.getRandomValues(new Uint8Array(1)) as Uint8Array & [number];
    if (byte < limit) body += SEED_ALPHABET[byte % SEED_ALPHABET.length];
  }
  return body;
}

export function newSeed(variant: Variant, size: 3 | 4 | 5, winLength: number): string {
  const body = randomBody();
  return `${rulesCode(variant, size, winLength)}-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function parseSeed(text: string): ParsedSeed {
  const clean = String(text ?? "").trim().toUpperCase();
  const match = /^([0-9A-Z]{3})-([0-9A-Z]{4})-([0-9A-Z]{4})$/.exec(clean);
  if (!match) return { error: "A seed looks like C53-BXK4-M9TR." };
  const [, prefix, a, b] = match as unknown as [string, string, string, string];
  const legacy = LEGACY_PREFIXES[prefix as keyof typeof LEGACY_PREFIXES];
  const rules = legacy ? { ...legacy, winLength: legacyWinLength(legacy.variant, legacy.size) } : parseRulesCode(prefix);
  if ("error" in rules) return { error: `Unknown game type "${prefix}" in the seed.` };
  const body = a + b;
  for (const ch of body) {
    if (!SEED_ALPHABET.includes(ch)) return { error: `The seed contains "${ch}", which is never used in seeds.` };
  }
  return { variant: rules.variant, size: rules.size as 3 | 4 | 5, winLength: rules.winLength, body };
}

/** The mark a player takes when they let the game decide. Fixed by the seed. */
export function pickMark(seed: string): Mark {
  return rngFor(seed, -1)() % 2 === 0 ? "X" : "O";
}

/** A mark drawn once at game setup for a game with no seed (two devices, "let the game decide"). */
export function randomMark(): Mark {
  const [byte] = globalThis.crypto.getRandomValues(new Uint8Array(1)) as Uint8Array & [number];
  return byte % 2 === 0 ? "X" : "O";
}

// Game seeds. A seed decides which mark a "let the game decide" player takes and
// every roll of the dice the computer makes, so the same seed and the same moves
// are always the same game.
//
// Written as "3X3-BXK4-M9TR". The prefix names the variant and size; the eight
// characters after it are the seed proper.
//
// Integer arithmetic only. Math.random differs between browsers and would make
// a replayed game differ. Only newSeed reads crypto, once, at game creation.

import type { Mark, Variant } from "./types.ts";

// No vowels and no 0 O 1 I, so a seed read aloud cannot be misheard or spell a word.
export const SEED_ALPHABET = "BCDFGHJKLMNPQRSTVWXYZ23456789";
const BODY_LENGTH = 8;

const PREFIXES = {
  "3X3": { variant: "classic", size: 3 },
  "4X4": { variant: "classic", size: 4 },
  "5X5": { variant: "classic", size: 5 },
  ULT: { variant: "ultimate", size: undefined },
  CUB: { variant: "cube", size: undefined },
} as const;

export type ParsedSeed =
  | { variant: Variant; size: 3 | 4 | 5 | undefined; body: string }
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

function prefixFor(variant: Variant, size: 3 | 4 | 5 | undefined): string {
  if (variant === "ultimate") return "ULT";
  if (variant === "cube") return "CUB";
  return `${size ?? 3}X${size ?? 3}`;
}

export function newSeed(variant: Variant, size?: 3 | 4 | 5): string {
  const body = randomBody();
  return `${prefixFor(variant, size)}-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function parseSeed(text: string): ParsedSeed {
  const clean = String(text ?? "").trim().toUpperCase();
  const match = /^([0-9A-Z]{3})-([0-9A-Z]{4})-([0-9A-Z]{4})$/.exec(clean);
  if (!match) return { error: "A seed looks like 3X3-BXK4-M9TR." };
  const [, prefix, a, b] = match as unknown as [string, string, string, string];
  const info = PREFIXES[prefix as keyof typeof PREFIXES];
  if (!info) return { error: `Unknown game type "${prefix}" in the seed.` };
  const body = a + b;
  for (const ch of body) {
    if (!SEED_ALPHABET.includes(ch)) return { error: `The seed contains "${ch}", which is never used in seeds.` };
  }
  return { variant: info.variant, size: info.size, body };
}

/** The mark a player takes when they let the game decide. Fixed by the seed. */
export function pickMark(seed: string): Mark {
  return rngFor(seed, -1)() % 2 === 0 ? "X" : "O";
}

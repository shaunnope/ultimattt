// Pairing two devices: the six-character code, the name the host registers under, the join link and
// plain-words explanations for connection failures. Pure: no network here.

import { SEED_ALPHABET } from "./seed.ts";

export const CODE_LENGTH = 6;
const PEER_PREFIX = "ttt-";

/** A random code. Bytes at or above the limit are skipped so every character is equally likely. */
export function generateCode(): string {
  const limit = 256 - (256 % SEED_ALPHABET.length);
  let code = "";
  while (code.length < CODE_LENGTH) {
    const [byte] = globalThis.crypto.getRandomValues(new Uint8Array(1)) as Uint8Array & [number];
    if (byte < limit) code += SEED_ALPHABET[byte % SEED_ALPHABET.length];
  }
  return code;
}

/** What was typed, tidied: upper case, letters and digits only, at most one code long. */
export function normaliseCode(input: string): string {
  return String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

export function isValidCode(input: string): boolean {
  const code = normaliseCode(input);
  return code.length === CODE_LENGTH && [...code].every((ch) => SEED_ALPHABET.includes(ch));
}

/** The name the host registers with the pairing service. */
export const peerIdFor = (code: string): string => PEER_PREFIX + normaliseCode(code);

/** The address a friend opens to join: this page with the code in it. */
export function joinLink(base: string, code: string): string {
  const clean = base.split("#")[0]!.split("?")[0]!;
  return `${clean}?join=${normaliseCode(code)}`;
}

/** The code in a page address (`?join=CODE`), if it is a good one. */
export function codeFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("join");
  if (value === null) return null;
  const code = normaliseCode(value);
  return isValidCode(code) && code.length === value.trim().length ? code : null;
}

export function describePeerError(error: { type?: string } | undefined): string {
  switch (error?.type) {
    case "peer-unavailable":
      return "Nobody is hosting with that code. Check it and try again.";
    case "unavailable-id":
      return "That code is already in use. Host again to get a new one.";
    case "network":
    case "server-error":
    case "socket-error":
    case "socket-closed":
      return "Cannot reach the pairing service. Everything else still works.";
    case "browser-incompatible":
      return "This browser cannot make peer-to-peer connections.";
    default:
      return "The connection failed.";
  }
}

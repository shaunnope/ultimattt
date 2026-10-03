import { test } from "node:test";
import assert from "node:assert/strict";
import { CODE_LENGTH, generateCode, normaliseCode, isValidCode, peerIdFor, joinLink, codeFromSearch, describePeerError } from "../../src/core/pairing.ts";
import { ICE_SERVERS, peerOptions } from "../../src/adapters/net.ts";
import { SEED_ALPHABET } from "../../src/core/seed.ts";

test("a pairing code is six characters from the same alphabet as seeds", () => {
  assert.equal(CODE_LENGTH, 6);
  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    assert.equal(code.length, 6);
    for (const ch of code) assert.ok(SEED_ALPHABET.includes(ch), `${code} has ${ch}`);
  }
});

test("codes are different each time and never use Math.random", () => {
  const random = Math.random;
  Math.random = () => {
    throw new Error("Math.random used");
  };
  try {
    const codes = new Set(Array.from({ length: 30 }, () => generateCode()));
    assert.ok(codes.size > 25);
  } finally {
    Math.random = random;
  }
});

test("typed codes are tidied: upper case, no spaces or dashes, six characters at most", () => {
  assert.equal(normaliseCode("bxk-4 m9"), "BXK4M9");
  assert.equal(normaliseCode("  bxk4m9tr!! "), "BXK4M9");
  assert.equal(normaliseCode(""), "");
  assert.equal(normaliseCode(undefined as unknown as string), "");
});

test("a code is valid only if it is six characters all from the alphabet", () => {
  assert.equal(isValidCode("BXK4M9"), true);
  assert.equal(isValidCode("bxk4m9"), true);
  assert.equal(isValidCode("BXK4M"), false);
  assert.equal(isValidCode("BXK4M0"), false); // no zero
  assert.equal(isValidCode("BXK4MA"), false); // no vowels
  assert.equal(isValidCode(""), false);
});

test("the host registers under a name made from the code", () => {
  assert.equal(peerIdFor("BXK4M9"), "ttt-BXK4M9");
});

test("a join link carries the code in the address, and the code is read back from it", () => {
  assert.equal(joinLink("https://someone.github.io/ultimattt/", "BXK4M9"), "https://someone.github.io/ultimattt/?join=BXK4M9");
  assert.equal(codeFromSearch("?join=bxk4m9"), "BXK4M9");
  assert.equal(codeFromSearch("?watch=1&join=BXK4M9"), "BXK4M9");
  assert.equal(codeFromSearch("?join=nope"), null);
  assert.equal(codeFromSearch(""), null);
  assert.equal(codeFromSearch("?watch=1"), null);
});

test("pairing uses STUN servers only: no TURN relay anywhere", () => {
  assert.ok(ICE_SERVERS.length >= 1);
  for (const server of ICE_SERVERS) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      assert.match(url, /^stun:/);
      assert.ok(!/turn/i.test(url), url);
    }
    assert.ok(!("username" in server) && !("credential" in server));
  }
});

test("PeerJS is given our own server list, so its built-in TURN relay is never used", () => {
  const options = peerOptions();
  assert.equal(options.config.iceServers, ICE_SERVERS);
  assert.equal(options.debug, 0);
});

test("connection failures are explained in plain words", () => {
  assert.match(describePeerError({ type: "peer-unavailable" }), /Nobody is hosting/i);
  assert.match(describePeerError({ type: "network" }), /pairing service/i);
  assert.match(describePeerError({ type: "server-error" }), /pairing service/i);
  assert.match(describePeerError({ type: "browser-incompatible" }), /browser/i);
  assert.match(describePeerError({ type: "something-new" }), /failed/i);
  assert.match(describePeerError(undefined), /failed/i);
});

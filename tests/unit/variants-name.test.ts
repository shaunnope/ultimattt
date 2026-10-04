import { test } from "node:test";
import assert from "node:assert/strict";
import { variantName } from "../../src/core/variants.ts";

test("the third mode is Twist-Tac-Toe in full and Twist in short, and its stored id is unchanged", () => {
  assert.equal(variantName("cube", "full"), "Twist-Tac-Toe");
  assert.equal(variantName("cube", "short"), "Twist");
});

test("Classic and Ultimate keep their names in both forms", () => {
  for (const form of ["full", "short"] as const) {
    assert.equal(variantName("classic", form), "Classic");
    assert.equal(variantName("ultimate", form), "Ultimate");
  }
});

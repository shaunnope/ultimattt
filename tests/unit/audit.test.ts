import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain .mjs script, no types
import { evaluateAudit, readLighthouse, summariseAxe, THRESHOLDS } from "../../scripts/audit.mjs";

const lhr = (accessibility: number, interactive: number) => ({
  categories: { accessibility: { score: accessibility } },
  audits: { interactive: { numericValue: interactive } },
});

test("the thresholds are the ones the release gate promises", () => {
  assert.equal(THRESHOLDS.accessibility, 0.9);
  assert.equal(THRESHOLDS.interactiveMs, 3000);
});

test("a good Lighthouse report and a clean axe run pass", () => {
  const report = { ...readLighthouse(lhr(0.97, 1800)), axe: summariseAxe([]) };
  assert.deepEqual(evaluateAudit(report), []);
});

test("an accessibility score below 90 fails", () => {
  const problems = evaluateAudit({ ...readLighthouse(lhr(0.89, 1800)), axe: summariseAxe([]) });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /accessibility/i);
  assert.match(problems[0], /89/);
  assert.deepEqual(evaluateAudit({ ...readLighthouse(lhr(0.9, 1800)), axe: summariseAxe([]) }), []);
});

test("a serious or critical axe violation fails; minor and moderate ones do not", () => {
  const violations = [
    { id: "color-contrast", impact: "serious", nodes: [{}, {}] },
    { id: "button-name", impact: "critical", nodes: [{}] },
    { id: "region", impact: "moderate", nodes: [{}] },
    { id: "tabindex", impact: "minor", nodes: [{}] },
  ];
  const axe = summariseAxe(violations);
  assert.equal(axe.serious, 3);
  assert.deepEqual(axe.rules.sort(), ["button-name", "color-contrast"]);
  const problems = evaluateAudit({ ...readLighthouse(lhr(0.95, 1800)), axe });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /color-contrast/);
  assert.deepEqual(evaluateAudit({ ...readLighthouse(lhr(0.95, 1800)), axe: summariseAxe(violations.slice(2)) }), []);
});

test("a first load that takes 3 seconds or more to become interactive fails", () => {
  assert.deepEqual(evaluateAudit({ ...readLighthouse(lhr(0.95, 2999)), axe: summariseAxe([]) }), []);
  const problems = evaluateAudit({ ...readLighthouse(lhr(0.95, 3000)), axe: summariseAxe([]) });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /interactive|first load/i);
});

test("a report missing a number fails rather than passing by default", () => {
  const problems = evaluateAudit({ ...readLighthouse({ categories: {}, audits: {} }), axe: summariseAxe([]) });
  assert.ok(problems.length >= 2);
});

test("every problem is reported, not just the first", () => {
  const problems = evaluateAudit({ ...readLighthouse(lhr(0.5, 9000)), axe: summariseAxe([{ id: "x", impact: "serious", nodes: [{}] }]) });
  assert.equal(problems.length, 3);
});

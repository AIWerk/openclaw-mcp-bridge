import test from "node:test";
import assert from "node:assert/strict";
import { pickRegisteredToolName } from "../index.ts";

test("auto mode: collision causes second server tool to be prefixed", () => {
  const globalNames = new Set<string>();

  // "auto" (default) — no prefix unless collision
  const first = pickRegisteredToolName("alpha", "search", "auto", new Set<string>(), globalNames);
  globalNames.add(first);

  const second = pickRegisteredToolName("beta", "search", "auto", new Set<string>(), globalNames);

  assert.equal(first, "search");
  assert.equal(second, "beta_search");
});

test("auto mode: no collision means no prefix", () => {
  const globalNames = new Set<string>();

  const first = pickRegisteredToolName("alpha", "search", "auto", new Set<string>(), globalNames);
  globalNames.add(first);

  const second = pickRegisteredToolName("beta", "list", "auto", new Set<string>(), globalNames);

  assert.equal(first, "search");
  assert.equal(second, "list");
});

test("auto mode: undefined defaults to auto", () => {
  const globalNames = new Set<string>();

  const first = pickRegisteredToolName("alpha", "search", undefined, new Set<string>(), globalNames);
  globalNames.add(first);

  const second = pickRegisteredToolName("beta", "search", undefined, new Set<string>(), globalNames);

  assert.equal(first, "search");
  assert.equal(second, "beta_search");
});

test("true mode: always prefixes", () => {
  const globalNames = new Set<string>();

  const name = pickRegisteredToolName("alpha", "search", true, new Set<string>(), globalNames);

  assert.equal(name, "alpha_search");
});

test("false mode: never prefixes, uses suffix on collision", () => {
  const globalNames = new Set<string>();

  const first = pickRegisteredToolName("alpha", "search", false, new Set<string>(), globalNames);
  globalNames.add(first);

  const second = pickRegisteredToolName("beta", "search", false, new Set<string>(), globalNames);

  assert.equal(first, "search");
  assert.equal(second, "search_2");
});

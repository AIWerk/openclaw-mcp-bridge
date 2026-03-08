import test from "node:test";
import assert from "node:assert/strict";
import { pickRegisteredToolName } from "../index.ts";

test("global collision causes second server tool to be prefixed", () => {
  const globalNames = new Set<string>();

  const first = pickRegisteredToolName("alpha", "search", false, new Set<string>(), globalNames);
  globalNames.add(first);

  const second = pickRegisteredToolName("beta", "search", false, new Set<string>(), globalNames);

  assert.equal(first, "search");
  assert.equal(second, "beta_search");
});

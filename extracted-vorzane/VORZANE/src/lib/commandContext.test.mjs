import assert from "node:assert/strict";
import { test } from "node:test";
import { isCurrentCommandOwner } from "./commandContext.ts";

test("command response belongs only to the same active account and auth generation", () => {
  const request = { userId: "player-a", generation: 7 };
  assert.equal(isCurrentCommandOwner(request, { userId: "player-a", generation: 7 }), true);
  assert.equal(isCurrentCommandOwner(request, { userId: "player-b", generation: 7 }), false);
  assert.equal(isCurrentCommandOwner(request, { userId: "player-a", generation: 8 }), false);
  assert.equal(isCurrentCommandOwner(request, { userId: null, generation: 8 }), false);
});

test("empty request owners are never treated as current", () => {
  assert.equal(isCurrentCommandOwner({ userId: "", generation: 1 }, { userId: "", generation: 1 }), false);
});

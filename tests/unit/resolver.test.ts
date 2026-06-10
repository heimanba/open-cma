import { test, expect } from "bun:test";
import { resolveRef, requireRef } from "../../src/executor/resolver.ts";
import { StateManager } from "../../src/state/state-manager.ts";

function makeState(): StateManager {
  const state = StateManager.initialize("/tmp/test-state.json");
  state.setResource({
    address: { type: "environment", name: "dev", provider: "qoder" },
    remote_id: "env_abc123",
    content_hash: "hash1",
  });
  state.setResource({
    address: { type: "agent", name: "researcher", provider: "qoder" },
    remote_id: "agent_xyz",
    version: 2,
    content_hash: "hash2",
  });
  return state;
}

test("resolveRef returns remote_id when resource exists", () => {
  const state = makeState();
  const id = resolveRef(state, { type: "environment", name: "dev", provider: "qoder" });
  expect(id).toBe("env_abc123");
});

test("resolveRef returns undefined when resource does not exist", () => {
  const state = makeState();
  const id = resolveRef(state, { type: "environment", name: "staging", provider: "qoder" });
  expect(id).toBeUndefined();
});

test("requireRef returns remote_id when resource exists", () => {
  const state = makeState();
  const id = requireRef(state, { type: "agent", name: "researcher", provider: "qoder" });
  expect(id).toBe("agent_xyz");
});

test("requireRef throws when resource is missing", () => {
  const state = makeState();
  expect(() =>
    requireRef(state, { type: "agent", name: "nonexistent", provider: "qoder" })
  ).toThrow(/not found in state/);
});

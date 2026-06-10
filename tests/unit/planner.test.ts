import { test, expect } from "bun:test";
import { resolve } from "path";
import { loadConfig } from "../../src/parser/index.ts";
import { buildPlan } from "../../src/planner/planner.ts";
import type { StateFile } from "../../src/types/state.ts";
import "../../src/providers/claude/index.ts";
import "../../src/providers/qoder/index.ts";

const FIXTURES = resolve(import.meta.dir, "../fixtures");

const emptyState: StateFile = {
  resources: [],
};

test("creates actions for all resources from empty state", async () => {
  const { config } = await loadConfig(resolve(FIXTURES, "minimal.yaml"));
  const plan = buildPlan(config, emptyState);

  const creates = plan.actions.filter((a) => a.action === "create");
  // Should create: env(dev) x2 + skill(code-review) x2 + agent(assistant) x2 = 6
  expect(creates.length).toBe(6);
});

test("produces no-op when state matches", async () => {
  const { config } = await loadConfig(resolve(FIXTURES, "minimal.yaml"));

  // First plan to get hashes
  const plan1 = buildPlan(config, emptyState);
  const creates = plan1.actions.filter((a) => a.action === "create");

  // Simulate state with matching hashes
  const state: StateFile = {
    resources: creates.map((a) => ({
      address: a.address,
      remote_id: `fake_${a.address.name}_${a.address.provider}`,
      content_hash: (a.after as any)?.content_hash ?? "",
    })),
  };

  const plan2 = buildPlan(config, state);
  const actionable = plan2.actions.filter((a) => a.action !== "no-op");
  expect(actionable.length).toBe(0);
});

test("detects deletes for resources removed from config", async () => {
  const state: StateFile = {
    resources: [
      {
        address: { type: "agent", name: "old-agent", provider: "claude" },
        remote_id: "agent_old",
        content_hash: "old_hash",
      },
    ],
  };

  const { config } = await loadConfig(resolve(FIXTURES, "minimal.yaml"));
  const plan = buildPlan(config, state);

  const deletes = plan.actions.filter((a) => a.action === "delete");
  expect(deletes.length).toBe(1);
  expect(deletes[0]!.address.name).toBe("old-agent");
});

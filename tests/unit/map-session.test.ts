import { test, expect, describe } from "bun:test";
import { mapSession as mapQoderSession } from "../../src/providers/qoder/mapper.ts";
import { mapSession as mapClaudeSession } from "../../src/providers/claude/mapper.ts";
import type { SessionBindings } from "../../src/types/session.ts";

function fullBindings(): SessionBindings {
  return {
    agent_id: "agent_123",
    agent_version: 2,
    environment_id: "env_456",
    vault_ids: ["vault_a", "vault_b"],
    memory_store_ids: ["ms_1", "ms_2"],
    title: "Research session",
    metadata: { team: "eng" },
  };
}

function minimalBindings(): SessionBindings {
  return {
    agent_id: "agent_min",
    environment_id: "env_min",
    vault_ids: [],
    memory_store_ids: [],
  };
}

describe("Qoder mapSession", () => {
  test("full bindings produce correct body", () => {
    const body = mapQoderSession(fullBindings()) as Record<string, unknown>;

    expect(body.agent).toEqual({ id: "agent_123", version: 2 });
    expect(body.environment_id).toBe("env_456");
    expect(body.vault_ids).toEqual(["vault_a", "vault_b"]);
    expect(body.memory_store_ids).toEqual(["ms_1", "ms_2"]);
    expect(body.title).toBe("Research session");
    expect(body.metadata).toEqual({ team: "eng" });
  });

  test("minimal bindings omit optional fields", () => {
    const body = mapQoderSession(minimalBindings()) as Record<string, unknown>;

    expect(body.agent).toEqual({ id: "agent_min" });
    expect(body.environment_id).toBe("env_min");
    expect(body.vault_ids).toBeUndefined();
    expect(body.memory_store_ids).toBeUndefined();
    expect(body.title).toBeUndefined();
    expect(body.metadata).toBeUndefined();
  });

  test("agent without version omits version from agent object", () => {
    const bindings = fullBindings();
    delete (bindings as Partial<SessionBindings>).agent_version;
    const body = mapQoderSession(bindings) as Record<string, unknown>;

    expect(body.agent).toEqual({ id: "agent_123" });
  });
});

describe("Claude mapSession", () => {
  test("full bindings produce correct body with resources array", () => {
    const body = mapClaudeSession(fullBindings()) as Record<string, unknown>;

    expect(body.agent).toEqual({
      id: "agent_123",
      type: "agent",
      version: 2,
    });
    expect(body.environment_id).toBe("env_456");
    expect(body.vault_ids).toEqual(["vault_a", "vault_b"]);
    expect(body.resources).toEqual([
      { type: "memory_store", memory_store_id: "ms_1" },
      { type: "memory_store", memory_store_id: "ms_2" },
    ]);
    expect(body.memory_store_ids).toBeUndefined();
    expect(body.title).toBe("Research session");
    expect(body.metadata).toEqual({ team: "eng" });
  });

  test("minimal bindings use agent_id string directly (no version)", () => {
    const body = mapClaudeSession(minimalBindings()) as Record<string, unknown>;

    expect(body.agent).toBe("agent_min");
    expect(body.environment_id).toBe("env_min");
    expect(body.vault_ids).toBeUndefined();
    expect(body.resources).toBeUndefined();
    expect(body.title).toBeUndefined();
  });

  test("memory_stores go to resources array, not memory_store_ids", () => {
    const bindings = minimalBindings();
    bindings.memory_store_ids = ["ms_x"];
    const body = mapClaudeSession(bindings) as Record<string, unknown>;

    expect(body.resources).toEqual([
      { type: "memory_store", memory_store_id: "ms_x" },
    ]);
    expect(body.memory_store_ids).toBeUndefined();
  });
});

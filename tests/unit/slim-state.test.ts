import { test, expect, describe } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { StateManager } from "../../src/state/state-manager.ts";
import { mapEnvironment as mapClaudeEnv, mapAgent as mapClaudeAgent } from "../../src/providers/claude/mapper.ts";
import { mapEnvironment as mapQoderEnv, mapAgent as mapQoderAgent } from "../../src/providers/qoder/mapper.ts";
import type { EnvironmentDecl, AgentDecl } from "../../src/types/config.ts";
import type { ResolvedAgentRefs } from "../../src/providers/interface.ts";

function tmpPath(): string {
  return join(tmpdir(), `state-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

const emptyRefs: ResolvedAgentRefs = {
  skill_ids: [],
  multiagent_agent_ids: [],
};

describe("StateManager backward compat", () => {
  test("loads legacy format with serial/lineage/attributes and outputs slim format", async () => {
    const path = tmpPath();
    const legacy = {
      version: 1,
      serial: 5,
      lineage: "abc-123",
      resources: [
        {
          address: { type: "agent", name: "a1", provider: "qoder" },
          remote_id: "agent_001",
          version: 2,
          content_hash: "h1",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-06-01T00:00:00Z",
          attributes: { foo: "bar" },
        },
      ],
    };
    await Bun.write(path, JSON.stringify(legacy));

    const sm = await StateManager.load(path);
    const r = sm.listResources();
    expect(r).toHaveLength(1);
    expect(r[0]!.remote_id).toBe("agent_001");
    expect(r[0]!.version).toBe(2);
    expect(r[0]!.content_hash).toBe("h1");
    expect((r[0] as any).created_at).toBeUndefined();
    expect((r[0] as any).updated_at).toBeUndefined();
    expect((r[0] as any).attributes).toBeUndefined();

    await sm.save();
    const saved = await Bun.file(path).json();
    expect(saved.serial).toBeUndefined();
    expect(saved.lineage).toBeUndefined();
    expect(saved.version).toBeUndefined();
    expect(saved.resources[0].created_at).toBeUndefined();
    expect(saved.resources[0].attributes).toBeUndefined();
  });

  test("loads already-slim format successfully", async () => {
    const path = tmpPath();
    const slim = {
      resources: [
        {
          address: { type: "environment", name: "dev", provider: "claude" },
          remote_id: "env_x",
          content_hash: "h2",
        },
      ],
    };
    await Bun.write(path, JSON.stringify(slim));

    const sm = await StateManager.load(path);
    const r = sm.listResources();
    expect(r).toHaveLength(1);
    expect(r[0]!.remote_id).toBe("env_x");
    expect(r[0]!.version).toBeUndefined();
  });
});

describe("State only contains load-bearing fields", () => {
  test("setResource stores only address/remote_id/version/content_hash", async () => {
    const path = tmpPath();
    const sm = StateManager.initialize(path);

    sm.setResource({
      address: { type: "agent", name: "test", provider: "qoder" },
      remote_id: "agent_t1",
      version: 1,
      content_hash: "abc",
    });
    await sm.save();

    const saved = await Bun.file(path).json();
    const r = saved.resources[0];
    const keys = Object.keys(r).sort();
    expect(keys).toEqual(["address", "content_hash", "remote_id", "version"]);
  });
});

describe("Claude metadata injection", () => {
  const envDecl: EnvironmentDecl = {
    config: { type: "cloud" },
  };

  const agentDecl: AgentDecl = {
    model: { claude: "claude-sonnet-4-6" },
    instructions: "test",
  };

  test("mapEnvironment injects cma.project and cma.resource", () => {
    const body = mapClaudeEnv("dev", envDecl, "my-project") as Record<string, any>;
    expect(body.metadata["cma.project"]).toBe("my-project");
    expect(body.metadata["cma.resource"]).toBe("dev");
  });

  test("mapAgent injects cma.project and cma.resource", () => {
    const body = mapClaudeAgent("assistant", agentDecl, emptyRefs, undefined, "my-project") as Record<string, any>;
    expect(body.metadata["cma.project"]).toBe("my-project");
    expect(body.metadata["cma.resource"]).toBe("assistant");
  });
});

describe("Qoder metadata injection", () => {
  const envDecl: EnvironmentDecl = {
    config: { type: "cloud" },
  };

  const agentDecl: AgentDecl = {
    model: { qoder: "gpt-4" },
    instructions: "test",
  };

  test("mapEnvironment injects cma.project and cma.resource", () => {
    const body = mapQoderEnv("dev", envDecl, "my-project") as Record<string, any>;
    expect(body.metadata["cma.project"]).toBe("my-project");
    expect(body.metadata["cma.resource"]).toBe("dev");
  });

  test("mapAgent injects cma.project and cma.resource", () => {
    const body = mapQoderAgent("assistant", agentDecl, emptyRefs, undefined, "my-project") as Record<string, any>;
    expect(body.metadata["cma.project"]).toBe("my-project");
    expect(body.metadata["cma.resource"]).toBe("assistant");
  });
});

describe("User metadata precedence", () => {
  test("user-declared cma.project is not overwritten (Claude)", () => {
    const decl: AgentDecl = {
      model: { claude: "claude-sonnet-4-6" },
      instructions: "test",
      metadata: { "cma.project": "user-override" },
    };
    const body = mapClaudeAgent("a1", decl, emptyRefs, undefined, "infra-project") as Record<string, any>;
    expect(body.metadata["cma.project"]).toBe("user-override");
  });

  test("user-declared cma.project is not overwritten (Qoder)", () => {
    const decl: AgentDecl = {
      model: { qoder: "gpt-4" },
      instructions: "test",
      metadata: { "cma.project": "user-override" },
    };
    const body = mapQoderAgent("a1", decl, emptyRefs, undefined, "infra-project") as Record<string, any>;
    expect(body.metadata["cma.project"]).toBe("user-override");
  });

  test("user-declared cma.resource is not overwritten (Claude env)", () => {
    const decl: EnvironmentDecl = {
      config: { type: "cloud" },
      metadata: { "cma.resource": "custom-name" },
    };
    const body = mapClaudeEnv("dev", decl, "proj") as Record<string, any>;
    expect(body.metadata["cma.resource"]).toBe("custom-name");
  });
});

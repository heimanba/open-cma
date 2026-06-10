import { describe, test, expect } from "bun:test";
import "../../src/providers/all.ts";
import { allProviders } from "../../src/providers/registry.ts";
import type { ProviderAdapter } from "../../src/providers/interface.ts";
import type { ResourceKind } from "../../src/providers/capabilities.ts";

const RESOURCE_KIND_METHODS: Record<
  ResourceKind,
  { methods: string[]; skip?: boolean }
> = {
  environment: { methods: ["createEnvironment", "updateEnvironment", "deleteEnvironment"] },
  vault: { methods: ["createVault", "deleteVault"] },
  skill: { methods: ["createSkill", "updateSkill", "deleteSkill"] },
  agent: { methods: ["createAgent", "updateAgent", "deleteAgent"] },
  memory_store: { methods: ["createMemoryStore", "deleteMemoryStore"] },
  session: { methods: ["createSession", "listSessions", "getSession", "deleteSession"] },
  mcp_server: { methods: [], skip: true },
  multiagent: { methods: [], skip: true },
};

const ALL_RESOURCE_KINDS: ResourceKind[] = [
  "environment", "vault", "skill", "agent",
  "memory_store", "mcp_server", "multiagent", "session",
];

const DUMMY_CONFIGS: Record<string, unknown> = {
  claude: { api_key: "sk-test-dummy" },
  qoder: { api_key: "pt-test-dummy" },
};

function createDummyAdapter(providerName: string): ProviderAdapter {
  const def = allProviders().find((p) => p.name === providerName);
  if (!def) throw new Error(`Provider '${providerName}' not registered`);
  const config = DUMMY_CONFIGS[providerName];
  if (!config) throw new Error(`No dummy config for '${providerName}'`);
  return def.createAdapter(def.configSchema.parse(config));
}

for (const providerDef of allProviders()) {
  describe(`Provider conformance: ${providerDef.name}`, () => {
    test("adapter.name matches registration name", () => {
      const adapter = createDummyAdapter(providerDef.name);
      expect(adapter.name).toBe(providerDef.name);
    });

    test("capabilities covers all ResourceKind values", () => {
      const declaredKinds = Object.keys(providerDef.capabilities);
      for (const kind of ALL_RESOURCE_KINDS) {
        expect(declaredKinds).toContain(kind);
      }
    });

    for (const kind of ALL_RESOURCE_KINDS) {
      const mapping = RESOURCE_KIND_METHODS[kind];
      if (mapping.skip) continue;

      const capability = providerDef.capabilities[kind];
      if (!capability) continue;

      if (capability.tier === "unsupported") {
        for (const method of mapping.methods) {
          test(`${kind}:${method} throws for unsupported tier`, async () => {
            const adapter = createDummyAdapter(providerDef.name);
            const fn = (adapter as any)[method];
            expect(typeof fn).toBe("function");

            let threw = false;
            let message = "";
            try {
              await fn.call(adapter, "dummy-id", {}, {});
            } catch (e: any) {
              threw = true;
              message = e.message ?? "";
            }
            expect(threw).toBe(true);
            expect(
              message.toLowerCase().includes("not supported") ||
              message.toLowerCase().includes("not implemented"),
            ).toBe(true);
          });
        }
      }

      if (capability.tier === "native") {
        for (const method of mapping.methods) {
          test(`${kind}:${method} is implemented (not a stub throw)`, async () => {
            const adapter = createDummyAdapter(providerDef.name);
            const fn = (adapter as any)[method];
            expect(typeof fn).toBe("function");

            let threw = false;
            let message = "";
            try {
              await fn.call(adapter, "dummy-id", {}, {});
            } catch (e: any) {
              threw = true;
              message = e.message ?? "";
            }

            if (threw) {
              const isStubThrow =
                message.toLowerCase().includes("not supported") ||
                message.toLowerCase().includes("not implemented");
              expect(isStubThrow).toBe(false);
            }
          });
        }
      }
    }
  });
}

import type { ProjectConfig } from "../types/config.ts";
import type { ResourceAddress, ResourceType } from "../types/state.ts";
import { addressKey } from "../types/state.ts";
import { getProvider } from "../providers/registry.ts";
import type { ProviderCapabilities, ResourceKind } from "../providers/capabilities.ts";
import { UserError } from "../errors.ts";

export interface DependencyGraph {
  nodes: Map<string, ResourceAddress>;
  edges: Map<string, Set<string>>;
}

export function buildDependencyGraph(
  config: ProjectConfig,
  targetProviders: string[]
): DependencyGraph {
  const nodes = new Map<string, ResourceAddress>();
  const edges = new Map<string, Set<string>>();

  function addNode(addr: ResourceAddress) {
    const key = addressKey(addr);
    nodes.set(key, addr);
    if (!edges.has(key)) edges.set(key, new Set());
  }

  function addEdge(from: ResourceAddress, to: ResourceAddress) {
    const fromKey = addressKey(from);
    const toKey = addressKey(to);
    edges.get(fromKey)?.add(toKey);
  }

  for (const provider of targetProviders) {
    const def = getProvider(provider);
    const caps = def?.capabilities;

    if (config.environments) {
      for (const name of Object.keys(config.environments)) {
        const decl = config.environments[name]!;
        if (decl.provider && decl.provider !== provider) continue;
        addNode({ type: "environment", name, provider });
      }
    }

    if (config.memory_stores) {
      for (const name of Object.keys(config.memory_stores)) {
        const decl = config.memory_stores[name]!;
        if (decl.provider && decl.provider !== provider) continue;
        if (isUnsupported(caps, "memory_store")) continue;
        addNode({ type: "memory_store", name, provider });
      }
    }

    if (config.vaults) {
      for (const name of Object.keys(config.vaults)) {
        const decl = config.vaults[name]!;
        if (decl.provider && decl.provider !== provider) continue;
        addNode({ type: "vault", name, provider });
      }
    }

    if (config.skills) {
      for (const name of Object.keys(config.skills)) {
        const decl = config.skills[name]!;
        if (decl.provider && decl.provider !== provider) continue;
        addNode({ type: "skill", name, provider });
      }
    }

    if (config.agents) {
      for (const name of Object.keys(config.agents)) {
        const decl = config.agents[name]!;
        if (decl.provider && decl.provider !== provider) continue;
        const agentAddr: ResourceAddress = { type: "agent", name, provider };
        addNode(agentAddr);

        if (decl.environment && config.environments?.[decl.environment]) {
          const envAddr: ResourceAddress = {
            type: "environment",
            name: decl.environment,
            provider,
          };
          if (nodes.has(addressKey(envAddr))) {
            addEdge(agentAddr, envAddr);
          }
        }

        if (decl.skills) {
          for (const skillName of decl.skills) {
            const skillAddr: ResourceAddress = { type: "skill", name: skillName, provider };
            if (nodes.has(addressKey(skillAddr))) {
              addEdge(agentAddr, skillAddr);
            }
          }
        }

        if (decl.vault) {
          const vaultAddr: ResourceAddress = { type: "vault", name: decl.vault, provider };
          if (nodes.has(addressKey(vaultAddr))) {
            addEdge(agentAddr, vaultAddr);
          }
        }

        if (decl.memory_stores) {
          for (const msName of decl.memory_stores) {
            const msAddr: ResourceAddress = {
              type: "memory_store",
              name: msName,
              provider,
            };
            if (nodes.has(addressKey(msAddr))) {
              addEdge(agentAddr, msAddr);
            }
          }
        }

        if (decl.multiagent && !isUnsupported(caps, "multiagent")) {
          for (const subName of decl.multiagent.agents) {
            const subAddr: ResourceAddress = { type: "agent", name: subName, provider };
            addEdge(agentAddr, subAddr);
          }
        }
      }
    }
  }

  return { nodes, edges };
}

function isUnsupported(
  caps: ProviderCapabilities | undefined,
  kind: ResourceKind
): boolean {
  return caps?.[kind]?.tier === "unsupported";
}

export function topologicalSort(graph: DependencyGraph): ResourceAddress[] {
  const visited = new Set<string>();
  const sorted: ResourceAddress[] = [];
  const visiting = new Set<string>();

  function visit(key: string) {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new UserError(`Circular dependency detected involving: ${key}`);
    }
    visiting.add(key);
    const deps = graph.edges.get(key) ?? new Set();
    for (const dep of deps) {
      visit(dep);
    }
    visiting.delete(key);
    visited.add(key);
    sorted.push(graph.nodes.get(key)!);
  }

  for (const key of graph.nodes.keys()) {
    visit(key);
  }

  return sorted;
}

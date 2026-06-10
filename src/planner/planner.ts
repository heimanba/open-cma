import type { ProjectConfig } from "../types/config.ts";
import type { StateFile, ResourceAddress } from "../types/state.ts";
import { addressKey } from "../types/state.ts";
import type { ExecutionPlan, PlannedAction } from "../types/plan.ts";
import { buildDependencyGraph, topologicalSort } from "../graph/dependency.ts";
import { computeResourceHash } from "./hasher.ts";
import { DiagnosticCollector } from "../diagnostics/diagnostics.ts";
import { getProvider } from "../providers/registry.ts";

export interface PlanOptions {
  providers?: string[];
  configPath?: string;
}

export function buildPlan(
  config: ProjectConfig,
  state: StateFile,
  options: PlanOptions = {}
): ExecutionPlan {
  const diagnostics = new DiagnosticCollector();
  const actions: PlannedAction[] = [];

  const targetProviders = options.providers ?? resolveTargetProviders(config);
  checkProviderCapabilities(config, targetProviders, diagnostics);

  const graph = buildDependencyGraph(config, targetProviders);
  const sorted = topologicalSort(graph);

  const stateIndex = new Map<string, (typeof state.resources)[number]>();
  for (const res of state.resources) {
    stateIndex.set(addressKey(res.address), res);
  }

  // Desired resources: create or update
  for (const address of sorted) {
    const key = addressKey(address);
    const desiredHash = computeResourceHash(address, config, options.configPath);
    const existing = stateIndex.get(key);
    const deps = getDependencies(address, graph);

    if (!existing) {
      actions.push({
        action: "create",
        address,
        reason: "Resource does not exist in state",
        after: { content_hash: desiredHash },
        dependencies: deps,
      });
    } else if (existing.content_hash !== desiredHash) {
      actions.push({
        action: "update",
        address,
        reason: "Content hash changed",
        before: { content_hash: existing.content_hash },
        after: { content_hash: desiredHash },
        dependencies: deps,
      });
    } else {
      actions.push({
        action: "no-op",
        address,
        reason: "No changes detected",
        dependencies: deps,
      });
    }

    stateIndex.delete(key);
  }

  // Remaining in state but not in config: delete (reverse order)
  const toDelete = Array.from(stateIndex.values()).reverse();
  for (const res of toDelete) {
    actions.push({
      action: "delete",
      address: res.address,
      reason: "Resource removed from configuration",
      before: { content_hash: res.content_hash },
      dependencies: [],
    });
  }

  return { actions, diagnostics: diagnostics.getAll() };
}

function resolveTargetProviders(config: ProjectConfig): string[] {
  const defaultProvider = config.defaults?.provider;
  if (!defaultProvider || defaultProvider === "all") {
    return Object.keys(config.providers);
  }
  return [defaultProvider];
}

function getDependencies(
  address: ResourceAddress,
  graph: ReturnType<typeof buildDependencyGraph>
): ResourceAddress[] {
  const key = addressKey(address);
  const depKeys = graph.edges.get(key) ?? new Set();
  return Array.from(depKeys)
    .map((k) => graph.nodes.get(k))
    .filter((n): n is ResourceAddress => n !== undefined);
}

function checkProviderCapabilities(
  config: ProjectConfig,
  providers: string[],
  diagnostics: DiagnosticCollector
): void {
  for (const providerName of providers) {
    const def = getProvider(providerName);
    if (!def) {
      diagnostics.error(
        "provider.unknown",
        `Provider '${providerName}' is not registered. Available: check provider imports.`
      );
      continue;
    }
    const caps = def.capabilities;

    if (config.memory_stores && caps.memory_store.tier === "unsupported") {
      for (const [name, decl] of Object.entries(config.memory_stores)) {
        if (!decl.provider || decl.provider === providerName) {
          diagnostics.error(
            `${providerName}.memory_store.unsupported`,
            `${caps.memory_store.reason}. ${caps.memory_store.remediation ?? ""}`.trim(),
            { type: "memory_store", name, provider: providerName }
          );
        }
      }
    }

    if (config.agents && caps.multiagent.tier === "unsupported") {
      for (const [name, agent] of Object.entries(config.agents)) {
        if (agent.multiagent) {
          if (!agent.provider || agent.provider === providerName) {
            diagnostics.error(
              `${providerName}.multiagent.unsupported`,
              `${caps.multiagent.reason}. ${caps.multiagent.remediation ?? ""}`.trim(),
              { type: "agent", name, provider: providerName }
            );
          }
        }
      }
    }
  }
}

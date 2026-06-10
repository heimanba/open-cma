import type { ProjectConfig } from "../types/config.ts";
import type { SessionBindings } from "../types/session.ts";
import { StateManager } from "../state/state-manager.ts";
import { requireRef } from "../executor/resolver.ts";
import { UserError } from "../errors.ts";

export interface SessionCreateOptions {
  environment?: string;
  vault?: string;
  memoryStores?: string[];
  title?: string;
  provider?: string;
}

export function resolveSessionProvider(
  agentName: string,
  config: ProjectConfig,
  overrideProvider?: string
): string {
  const agent = config.agents?.[agentName];
  if (!agent) {
    const available = Object.keys(config.agents ?? {}).join(", ");
    throw new UserError(
      `Agent '${agentName}' not found in config. Available agents: ${available || "(none)"}`
    );
  }

  if (overrideProvider) return overrideProvider;
  if (agent.provider) return agent.provider;

  const defaultProvider = config.defaults?.provider;
  if (defaultProvider && defaultProvider !== "all") return defaultProvider;

  const providers = Object.keys(config.providers);
  if (providers.length === 1) return providers[0]!;

  throw new UserError(
    `Agent '${agentName}' is deployed to multiple providers. Use --provider to specify one.`
  );
}

export function buildSessionBindings(
  agentName: string,
  config: ProjectConfig,
  provider: string,
  state: StateManager,
  options: SessionCreateOptions = {}
): SessionBindings {
  const agent = config.agents?.[agentName];
  if (!agent) {
    const available = Object.keys(config.agents ?? {}).join(", ");
    throw new UserError(
      `Agent '${agentName}' not found in config. Available agents: ${available || "(none)"}`
    );
  }

  const agentId = requireRef(state, { type: "agent", name: agentName, provider });
  const agentState = state.getResource({ type: "agent", name: agentName, provider });

  const envName = options.environment ?? agent.environment;
  if (!envName) {
    throw new UserError(
      `Agent '${agentName}' has no environment declared and --environment was not specified.`
    );
  }
  validateResourceInConfig(envName, "environment", config.environments);
  const environmentId = requireRef(state, { type: "environment", name: envName, provider });

  const vaultName = options.vault ?? agent.vault;
  const vaultIds: string[] = [];
  if (vaultName) {
    validateResourceInConfig(vaultName, "vault", config.vaults);
    vaultIds.push(requireRef(state, { type: "vault", name: vaultName, provider }));
  }

  const msNames = options.memoryStores ?? agent.memory_stores ?? [];
  const memoryStoreIds: string[] = [];
  for (const msName of msNames) {
    validateResourceInConfig(msName, "memory_store", config.memory_stores);
    memoryStoreIds.push(requireRef(state, { type: "memory_store", name: msName, provider }));
  }

  return {
    agent_id: agentId,
    agent_version: agentState?.version,
    environment_id: environmentId,
    vault_ids: vaultIds,
    memory_store_ids: memoryStoreIds,
    title: options.title,
  };
}

function validateResourceInConfig(
  name: string,
  type: string,
  resources?: Record<string, unknown>
): void {
  if (!resources?.[name]) {
    throw new UserError(`${type} '${name}' is not defined in config.`);
  }
}

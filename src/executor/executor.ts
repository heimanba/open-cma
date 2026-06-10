import type { ExecutionPlan, PlannedAction } from "../types/plan.ts";
import type { ProjectConfig } from "../types/config.ts";
import type { ProviderAdapter, RemoteResource } from "../providers/interface.ts";
import type { ResourceAddress } from "../types/state.ts";
import { StateManager } from "../state/state-manager.ts";
import { resolveAgentRefs } from "./resolver.ts";
import { computeResourceHash } from "../planner/hasher.ts";
import { addressKey } from "../types/state.ts";
import { ApiError } from "../providers/base-client.ts";
import { log } from "../utils/logger.ts";
import { UserError } from "../errors.ts";

export interface ActionResult {
  action: PlannedAction;
  status: "success" | "failed" | "skipped";
  error?: Error;
}

export interface ExecutionResult {
  results: ActionResult[];
  partial: boolean;
}

export async function executePlan(
  plan: ExecutionPlan,
  config: ProjectConfig,
  configPath: string,
  providers: Map<string, ProviderAdapter>,
  state: StateManager
): Promise<ExecutionResult> {
  const results: ActionResult[] = [];
  const failed = new Set<string>();

  const actionable = plan.actions.filter((a) => a.action !== "no-op");

  for (const action of actionable) {
    const key = addressKey(action.address);

    const depFailed = action.dependencies.some((d) => failed.has(addressKey(d)));
    if (depFailed) {
      results.push({ action, status: "skipped" });
      failed.add(key);
      continue;
    }

    const provider = providers.get(action.address.provider);
    if (!provider) {
      results.push({
        action,
        status: "failed",
        error: new Error(`Provider '${action.address.provider}' not configured`),
      });
      failed.add(key);
      continue;
    }

    try {
      const adopted = await executeAction(action, config, configPath, provider, state);
      results.push({ action, status: "success" });
      if (!adopted) {
        log.success(
          `${action.action} ${action.address.type}.${action.address.name} (${action.address.provider})`
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      results.push({ action, status: "failed", error });
      failed.add(key);
      log.error(
        `Failed to ${action.action} ${action.address.type}.${action.address.name}: ${error.message}`
      );
    }

    await state.save();
  }

  return {
    results,
    partial: results.some((r) => r.status === "failed"),
  };
}

async function executeAction(
  action: PlannedAction,
  config: ProjectConfig,
  configPath: string,
  provider: ProviderAdapter,
  state: StateManager
): Promise<boolean> {
  const { address } = action;
  const { type, name } = address;
  let adopted = false;

  if (action.action === "delete") {
    const existing = state.getResource(address);
    if (!existing) return false;
    const id = existing.remote_id;

    switch (type) {
      case "environment": await provider.deleteEnvironment(id); break;
      case "vault": await provider.deleteVault(id); break;
      case "skill": await provider.deleteSkill(id); break;
      case "agent": await provider.deleteAgent(id); break;
      case "memory_store": await provider.deleteMemoryStore(id); break;
    }
    state.removeResource(address);
    return false;
  }

  const isUpdate = action.action === "update";
  const existingId = isUpdate ? state.getResource(address)?.remote_id : undefined;

  let result;

  switch (type) {
    case "environment": {
      const decl = config.environments![name]!;
      if (isUpdate) {
        result = await provider.updateEnvironment(existingId!, name, decl);
      } else {
        try {
          result = await provider.createEnvironment(name, decl);
        } catch (err) {
          result = await recoverFromConflict(err, address, provider,
            (id) => provider.updateEnvironment(id, name, decl));
          adopted = true;
        }
      }
      break;
    }
    case "vault": {
      const decl = config.vaults![name]!;
      if (isUpdate) {
        try {
          result = await provider.createVault(name, decl);
          await provider.deleteVault(existingId!);
        } catch {
          await provider.deleteVault(existingId!);
          result = await provider.createVault(name, decl);
        }
      } else {
        try {
          result = await provider.createVault(name, decl);
        } catch (err) {
          result = await recoverFromConflict(err, address, provider,
            async (id) => { await provider.deleteVault(id); return provider.createVault(name, decl); });
          adopted = true;
        }
      }
      break;
    }
    case "skill": {
      const decl = config.skills![name]!;
      if (isUpdate) {
        result = await provider.updateSkill(existingId!, name, decl, configPath);
      } else {
        try {
          result = await provider.createSkill(name, decl, configPath);
        } catch (err) {
          result = await recoverFromConflict(err, address, provider,
            async (id) => { await provider.deleteSkill(id); return provider.createSkill(name, decl, configPath); });
          adopted = true;
        }
      }
      break;
    }
    case "memory_store": {
      const decl = config.memory_stores![name]!;
      if (isUpdate) {
        try {
          result = await provider.createMemoryStore(name, decl);
          await provider.deleteMemoryStore(existingId!);
        } catch {
          await provider.deleteMemoryStore(existingId!);
          result = await provider.createMemoryStore(name, decl);
        }
      } else {
        try {
          result = await provider.createMemoryStore(name, decl);
        } catch (err) {
          result = await recoverFromConflict(err, address, provider,
            async (id) => { await provider.deleteMemoryStore(id); return provider.createMemoryStore(name, decl); });
          adopted = true;
        }
      }
      break;
    }
    case "agent": {
      const decl = config.agents![name]!;
      const refs = resolveAgentRefs(name, config, address.provider, state);
      if (isUpdate) {
        result = await provider.updateAgent(existingId!, name, decl, refs);
      } else {
        try {
          result = await provider.createAgent(name, decl, refs);
        } catch (err) {
          result = await recoverFromConflict(err, address, provider,
            (id) => provider.updateAgent(id, name, decl, refs));
          adopted = true;
        }
      }
      break;
    }
    default:
      throw new UserError(`Unknown resource type: ${type}`);
  }

  const hash = computeResourceHash(address, config, configPath);
  state.setResource({
    address,
    remote_id: result.id,
    version: result.version,
    content_hash: hash,
  });
  return adopted;
}

async function recoverFromConflict(
  err: unknown,
  address: ResourceAddress,
  provider: ProviderAdapter,
  updateFn: (existingId: string) => Promise<RemoteResource>,
): Promise<RemoteResource> {
  if (!(err instanceof ApiError) || err.statusCode !== 409) throw err;

  const existing = await provider.findResource(address.type, address.name);
  if (!existing) throw err;

  log.adopt(
    `adopt ${address.type}.${address.name} (${address.provider}) — already existed remotely`
  );
  return updateFn(existing.id);
}

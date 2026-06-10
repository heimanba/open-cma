import { resolve } from "path";
import { loadConfig, resolveFileReferences } from "../../parser/index.ts";
import { buildDependencyGraph, topologicalSort } from "../../graph/dependency.ts";
import { log } from "../../utils/logger.ts";
import "../../providers/all.ts";
import type { ProjectConfig } from "../../types/config.ts";

export async function validateCommand(options: { file: string }) {
  const configPath = resolve(options.file);
  log.info(`Validating ${configPath}...`);

  const { config, errors } = await loadConfig(configPath);
  if (errors.length > 0) {
    for (const err of errors) log.error(err);
    process.exit(1);
  }

  // Resolve file references
  try {
    await resolveFileReferences(config, configPath);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Check references
  const refErrors = checkReferences(config);
  if (refErrors.length > 0) {
    for (const err of refErrors) log.error(err);
    process.exit(1);
  }

  // Check dependency graph (cycles)
  const providers = Object.keys(config.providers);

  try {
    const graph = buildDependencyGraph(config, providers);
    topologicalSort(graph);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  log.success("Configuration is valid.");
}

function checkReferences(config: ProjectConfig): string[] {
  const errors: string[] = [];
  const envNames = new Set(Object.keys(config.environments ?? {}));
  const skillNames = new Set(Object.keys(config.skills ?? {}));
  const vaultNames = new Set(Object.keys(config.vaults ?? {}));
  const memoryNames = new Set(Object.keys(config.memory_stores ?? {}));
  const agentNames = new Set(Object.keys(config.agents ?? {}));

  for (const [name, agent] of Object.entries(config.agents ?? {})) {
    if (agent.environment && !envNames.has(agent.environment)) {
      errors.push(`agent.${name}: references unknown environment '${agent.environment}'`);
    }
    for (const s of agent.skills ?? []) {
      if (!skillNames.has(s)) {
        errors.push(`agent.${name}: references unknown skill '${s}'`);
      }
    }
    if (agent.vault && !vaultNames.has(agent.vault)) {
      errors.push(`agent.${name}: references unknown vault '${agent.vault}'`);
    }
    for (const ms of agent.memory_stores ?? []) {
      if (!memoryNames.has(ms)) {
        errors.push(`agent.${name}: references unknown memory_store '${ms}'`);
      }
    }
    if (agent.multiagent) {
      for (const sub of agent.multiagent.agents) {
        if (!agentNames.has(sub)) {
          errors.push(`agent.${name}: multiagent references unknown agent '${sub}'`);
        }
        if (sub === name) {
          errors.push(`agent.${name}: multiagent cannot reference itself`);
        }
      }
    }
  }

  return errors;
}

import { resolve, dirname, basename } from "path";
import chalk from "chalk";
import * as p from "@clack/prompts";
import { loadConfig } from "../../parser/index.ts";
import { StateManager } from "../../state/state-manager.ts";
import { buildProviders } from "../../providers/registry.ts";
import "../../providers/all.ts";
import { log } from "../../utils/logger.ts";
import { deriveStatePath } from "../../utils/paths.ts";

export async function destroyCommand(options: { file: string; yes?: boolean; cascade?: boolean }) {
  const configPath = resolve(options.file);
  const statePath = deriveStatePath(configPath);

  const { config, errors } = await loadConfig(configPath, true);
  if (errors.length > 0) {
    for (const err of errors) log.error(err);
    process.exit(1);
  }

  const state = await StateManager.load(statePath);
  const resources = state.listResources();

  if (resources.length === 0) {
    log.info("No resources in state. Nothing to destroy.");
    return;
  }

  console.log(chalk.red(`\nDestroy ${resources.length} resource(s):\n`));
  for (const r of resources) {
    console.log(chalk.red(`  - ${r.address.type}.${r.address.name} (${r.address.provider}) [${r.remote_id}]`));
  }

  if (!options.yes) {
    const shouldDestroy = await p.confirm({ message: "Are you sure you want to destroy ALL resources?" });
    if (p.isCancel(shouldDestroy) || !shouldDestroy) {
      p.cancel("Destroy cancelled.");
      return;
    }
  }

  const projectName = basename(dirname(configPath));
  const providers = buildProviders(config.providers as Record<string, unknown>, projectName);

  const typeOrder: Record<string, number> = {
    agent: 0,
    skill: 1,
    memory_store: 2,
    vault: 3,
    environment: 4,
  };
  const sorted = [...resources].sort(
    (a, b) => (typeOrder[a.address.type] ?? 5) - (typeOrder[b.address.type] ?? 5)
  );

  const s = p.spinner();
  s.start(`Destroying ${sorted.length} resource(s)...`);

  let destroyed = 0;

  for (const r of sorted) {
    const provider = providers.get(r.address.provider);
    if (!provider) {
      log.warn(`No provider for '${r.address.provider}', skipping ${r.address.type}.${r.address.name}`);
      continue;
    }

    s.message(`Destroying ${r.address.type}.${r.address.name}...`);

    try {
      switch (r.address.type) {
        case "agent": await provider.deleteAgent(r.remote_id); break;
        case "skill": await provider.deleteSkill(r.remote_id); break;
        case "memory_store": await provider.deleteMemoryStore(r.remote_id); break;
        case "vault": await provider.deleteVault(r.remote_id); break;
        case "environment": await provider.deleteEnvironment(r.remote_id, options.cascade); break;
      }
      state.removeResource(r.address);
      destroyed++;
    } catch (err) {
      log.error(`Failed to destroy ${r.address.type}.${r.address.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  await state.save();
  s.stop(`Destroy complete. ${destroyed}/${sorted.length} resources removed.`);
}

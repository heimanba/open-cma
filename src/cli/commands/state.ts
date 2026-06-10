import { resolve } from "path";
import chalk from "chalk";
import { loadConfig, resolveFileReferences } from "../../parser/index.ts";
import { computeResourceHash } from "../../planner/hasher.ts";
import { StateManager } from "../../state/state-manager.ts";
import type { ResourceType } from "../../types/state.ts";
import { log } from "../../utils/logger.ts";
import { deriveStatePath } from "../../utils/paths.ts";
import "../../providers/all.ts";

export async function stateListCommand(options: { file: string }) {
  const statePath = deriveStatePath(resolve(options.file));
  const state = await StateManager.load(statePath);
  const resources = state.listResources();

  if (resources.length === 0) {
    log.info("No resources tracked in state.");
    return;
  }

  console.log(`\n${chalk.bold("Managed resources")} (${resources.length}):\n`);
  console.log(
    chalk.gray("  TYPE            NAME                PROVIDER   REMOTE ID")
  );
  console.log(chalk.gray("  " + "─".repeat(70)));

  for (const r of resources) {
    const type = r.address.type.padEnd(14);
    const name = r.address.name.padEnd(20);
    const provider = r.address.provider.padEnd(10);
    const id = r.remote_id.slice(0, 30);
    console.log(`  ${type}  ${name}${provider} ${chalk.dim(id)}`);
  }
  console.log();
}

export async function stateShowCommand(address: string, options: { file: string }) {
  const statePath = deriveStatePath(resolve(options.file));
  const state = await StateManager.load(statePath);

  // Parse address: provider.type.name or type.name
  const parts = address.split(".");
  let provider: string, type: string, name: string;
  if (parts.length === 3) {
    [provider, type, name] = parts as [string, string, string];
  } else if (parts.length === 2) {
    [type, name] = parts as [string, string];
    provider = "";
  } else {
    log.error("Address format: [provider.]type.name");
    process.exit(1);
  }

  const resources = state.listResources();
  const found = resources.find((r) => {
    const matchType = r.address.type === type;
    const matchName = r.address.name === name;
    const matchProvider = !provider || r.address.provider === provider;
    return matchType && matchName && matchProvider;
  });

  if (!found) {
    log.error(`Resource not found: ${address}`);
    process.exit(1);
  }

  console.log(JSON.stringify(found, null, 2));
}

export async function stateRemoveCommand(address: string, options: { file: string }) {
  const statePath = deriveStatePath(resolve(options.file));
  const state = await StateManager.load(statePath);

  const parts = address.split(".");
  if (parts.length < 2) {
    log.error("Address format: [provider.]type.name");
    process.exit(1);
  }

  let provider: string, type: string, name: string;
  if (parts.length === 3) {
    [provider, type, name] = parts as [string, string, string];
  } else {
    [type, name] = parts as [string, string];
    // Find first match
    const resources = state.listResources();
    const found = resources.find((r) => r.address.type === type && r.address.name === name);
    if (!found) {
      log.error(`Resource not found: ${address}`);
      process.exit(1);
    }
    provider = found.address.provider;
  }

  state.removeResource({ type: type as any, name, provider: provider as any });
  await state.save();
  log.success(`Removed ${address} from state (remote resource not deleted).`);
}

const VALID_RESOURCE_TYPES = new Set<string>(["environment", "vault", "memory_store", "skill", "agent"]);

export async function stateImportCommand(
  address: string,
  remoteId: string,
  options: { file: string; version?: string },
) {
  const parts = address.split(".");
  if (parts.length !== 3) {
    log.error("Address format: <provider>.<type>.<name> (all three segments required)");
    process.exit(1);
  }
  const [provider, type, name] = parts as [string, string, string];

  if (!VALID_RESOURCE_TYPES.has(type)) {
    log.error(`Invalid resource type: ${type}. Valid types: ${[...VALID_RESOURCE_TYPES].join(", ")}`);
    process.exit(1);
  }

  const configPath = resolve(options.file);
  const statePath = deriveStatePath(configPath);

  const { config, errors } = await loadConfig(configPath);
  if (errors.length > 0) {
    for (const err of errors) log.error(err);
    process.exit(1);
  }

  const resolved = await resolveFileReferences(config, configPath);
  const declMap: Record<string, unknown> | undefined =
    type === "environment" ? resolved.environments :
    type === "vault" ? resolved.vaults :
    type === "skill" ? resolved.skills :
    type === "agent" ? resolved.agents :
    type === "memory_store" ? resolved.memory_stores :
    undefined;
  if (!declMap || !(name in declMap)) {
    log.error(`Resource ${type}.${name} is not declared in ${options.file}`);
    process.exit(1);
  }

  const state = await StateManager.load(statePath);
  const resourceAddress = { type: type as ResourceType, name, provider: provider as any };

  if (state.getResource(resourceAddress)) {
    log.error(
      `Resource ${address} already exists in state. ` +
      `Run \`cma state rm ${address}\` first if you want to re-import.`
    );
    process.exit(1);
  }

  const hash = computeResourceHash(resourceAddress, resolved, configPath);
  const version = options.version ? Number(options.version) : undefined;

  state.setResource({
    address: resourceAddress,
    remote_id: remoteId,
    version,
    content_hash: hash,
  });
  await state.save();

  log.success(`Imported ${address} (remote_id: ${remoteId}) into state.`);
}

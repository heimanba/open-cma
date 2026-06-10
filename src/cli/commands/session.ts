import { resolve, dirname, basename } from "path";
import chalk from "chalk";
import { loadConfig, resolveFileReferences } from "../../parser/index.ts";
import { StateManager } from "../../state/state-manager.ts";
import { buildProviders } from "../../providers/registry.ts";
import {
  buildSessionBindings,
  resolveSessionProvider,
} from "../../session/session-manager.ts";
import { resolveRef } from "../../executor/resolver.ts";
import { log } from "../../utils/logger.ts";
import "../../providers/all.ts";

function formatTimestampCN(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(startIso: string, endIso?: string): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (isNaN(start)) return "-";
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h${m}m`;
}

const STATUS_CN: Record<string, string> = {
  idle: "空闲",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
};

interface SessionCreateOpts {
  file: string;
  environment?: string;
  vault?: string;
  memoryStores?: string;
  title?: string;
  provider?: string;
}

export async function sessionCreateCommand(
  agentName: string,
  options: SessionCreateOpts
) {
  const { adapter, config, state, provider } = await setup(
    options.file,
    agentName,
    options.provider
  );

  const bindings = buildSessionBindings(agentName, config, provider, state, {
    environment: options.environment,
    vault: options.vault,
    memoryStores: options.memoryStores
      ? options.memoryStores.split(",").map((s) => s.trim())
      : undefined,
    title: options.title,
  });

  const session = await adapter.createSession(bindings);
  log.success(`Session created: ${chalk.bold(session.id)}`);
  console.log(`  Agent:       ${agentName}`);
  console.log(`  Environment: ${session.environment_id}`);
  console.log(`  Status:      ${session.status}`);
  if (session.vault_ids.length)
    console.log(`  Vaults:      ${session.vault_ids.join(", ")}`);
  if (session.memory_store_ids.length)
    console.log(`  Memory:      ${session.memory_store_ids.join(", ")}`);
}

interface SessionListOpts {
  file: string;
  agent?: string;
  provider?: string;
}

export async function sessionListCommand(options: SessionListOpts) {
  const configPath = resolve(options.file);
  const statePath = resolve(dirname(configPath), "cma.state.json");
  const { config } = await loadConfig(configPath, true);
  const resolved = await resolveFileReferences(config, configPath);
  const state = await StateManager.load(statePath);

  let provider: string;
  if (options.agent) {
    provider = resolveSessionProvider(options.agent, resolved, options.provider);
  } else if (options.provider) {
    provider = options.provider;
  } else {
    const providers = Object.keys(config.providers as Record<string, unknown>);
    if (providers.length === 1) {
      provider = providers[0]!;
    } else {
      log.error("Multiple providers configured. Use --provider to specify one.");
      process.exit(1);
    }
  }

  const projectName = basename(dirname(configPath));
  const adapters = buildProviders(
    config.providers as Record<string, unknown>,
    projectName,
  );
  const adapter = adapters.get(provider);
  if (!adapter) {
    log.error(`Provider '${provider}' not configured.`);
    process.exit(1);
  }

  let agentId: string | undefined;
  if (options.agent) {
    agentId =
      resolveRef(state, { type: "agent", name: options.agent, provider }) ??
      undefined;
    if (!agentId) {
      log.error(
        `Agent '${options.agent}' not found in state. Run \`cma apply\` first.`
      );
      process.exit(1);
    }
  }

  const result = await adapter.listSessions(
    agentId ? { agent_id: agentId } : undefined
  );

  if (result.sessions.length === 0) {
    log.info("No sessions found.");
    return;
  }

  // Build reverse map: remote_id → agent name
  const agentNameMap = new Map<string, string>();
  for (const r of state.listResources()) {
    if (r.address.type === "agent") {
      agentNameMap.set(r.remote_id, r.address.name);
    }
  }

  const maxIdLen = Math.max(...result.sessions.map(s => s.id.length));
  const idWidth = Math.max(maxIdLen, 4) + 2;

  console.log(`\n${chalk.bold("Sessions")} (${result.sessions.length}):\n`);
  console.log(
    chalk.gray(`  ${"ID".padEnd(idWidth)} ${"名称".padEnd(20)} ${"智能体".padEnd(14)} ${"状态".padEnd(8)} ${"开始时间".padEnd(20)} 运行时长`)
  );
  console.log(chalk.gray("  " + "─".repeat(idWidth + 80)));

  for (const s of result.sessions) {
    const id = s.id.padEnd(idWidth);
    const title = (s.title ?? "").slice(0, 18).padEnd(20);
    const agent = (agentNameMap.get(s.agent_id) ?? s.agent_id.slice(0, 12)).padEnd(14);
    const statusLabel = STATUS_CN[s.status] ?? s.status;
    const statusText = statusLabel.padEnd(8);
    const status =
      s.status === "idle"
        ? chalk.green(statusText)
        : s.status === "processing"
          ? chalk.yellow(statusText)
          : s.status === "failed"
            ? chalk.red(statusText)
            : chalk.gray(statusText);
    const created = formatTimestampCN(s.created_at).padEnd(20);
    const duration = formatDuration(s.created_at, s.status === "idle" ? s.updated_at : undefined);
    console.log(`  ${chalk.bold(id)} ${title} ${chalk.cyan(agent)} ${status} ${chalk.dim(created)} ${duration}`);
  }
  console.log();

  if (result.has_more) {
    log.info("More sessions available. Use platform UI to see all.");
  }
}

interface SessionGetOpts {
  file: string;
  provider?: string;
}

export async function sessionGetCommand(
  sessionId: string,
  options: SessionGetOpts
) {
  const adapter = await setupDirect(options.file, options.provider);
  const session = await adapter.getSession(sessionId);

  console.log(`  ID:          ${chalk.bold(session.id)}`);
  console.log(`  Agent:       ${session.agent_id}`);
  console.log(`  Environment: ${session.environment_id}`);
  console.log(`  Status:      ${session.status}`);
  if (session.title) console.log(`  Title:       ${session.title}`);
  if (session.vault_ids.length)
    console.log(`  Vaults:      ${session.vault_ids.join(", ")}`);
  if (session.memory_store_ids.length)
    console.log(`  Memory:      ${session.memory_store_ids.join(", ")}`);
  console.log(`  Created:     ${session.created_at}`);
  console.log(`  Updated:     ${session.updated_at}`);
}

interface SessionDeleteOpts {
  file: string;
  provider?: string;
}

export async function sessionDeleteCommand(
  sessionId: string,
  options: SessionDeleteOpts
) {
  const adapter = await setupDirect(options.file, options.provider);
  await adapter.deleteSession(sessionId);
  log.success(`Session ${sessionId} deleted.`);
}

async function setup(
  file: string,
  agentName: string,
  overrideProvider?: string
) {
  const configPath = resolve(file);
  const statePath = resolve(dirname(configPath), "cma.state.json");
  const { config, errors } = await loadConfig(configPath, true);
  if (errors.length > 0) {
    for (const err of errors) log.error(err);
    process.exit(1);
  }
  const resolved = await resolveFileReferences(config, configPath);
  const state = await StateManager.load(statePath);
  const provider = resolveSessionProvider(agentName, resolved, overrideProvider);
  const projectName = basename(dirname(configPath));
  const adapters = buildProviders(
    config.providers as Record<string, unknown>,
    projectName,
  );
  const adapter = adapters.get(provider);
  if (!adapter) {
    log.error(`Provider '${provider}' not configured.`);
    process.exit(1);
  }
  return { adapter, config: resolved, state, provider };
}

async function setupDirect(file: string, overrideProvider?: string) {
  const configPath = resolve(file);
  const { config, errors } = await loadConfig(configPath, true);
  if (errors.length > 0) {
    for (const err of errors) log.error(err);
    process.exit(1);
  }
  const projectName = basename(dirname(configPath));
  const providers = buildProviders(
    config.providers as Record<string, unknown>,
    projectName,
  );

  let provider: string;
  if (overrideProvider) {
    provider = overrideProvider;
  } else {
    const keys = Array.from(providers.keys());
    if (keys.length === 1) {
      provider = keys[0]!;
    } else {
      log.error(
        "Multiple providers configured. Use --provider to specify one."
      );
      process.exit(1);
    }
  }

  const adapter = providers.get(provider);
  if (!adapter) {
    log.error(`Provider '${provider}' not configured.`);
    process.exit(1);
  }
  return adapter;
}

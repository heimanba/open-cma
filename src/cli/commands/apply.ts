import { resolve, dirname, basename } from "path";
import chalk from "chalk";
import * as p from "@clack/prompts";
import { loadConfig, resolveFileReferences } from "../../parser/index.ts";
import { buildPlan } from "../../planner/planner.ts";
import { StateManager } from "../../state/state-manager.ts";
import { executePlan } from "../../executor/executor.ts";
import { buildProviders } from "../../providers/registry.ts";
import "../../providers/all.ts";
import { log } from "../../utils/logger.ts";
import { deriveStatePath } from "../../utils/paths.ts";

export async function applyCommand(options: { file: string; yes?: boolean; provider?: string }) {
  const configPath = resolve(options.file);
  const statePath = deriveStatePath(configPath);

  const { config, errors } = await loadConfig(configPath, true);
  if (errors.length > 0) {
    for (const err of errors) log.error(err);
    process.exit(1);
  }

  const resolved = await resolveFileReferences(config, configPath);
  const state = await StateManager.load(statePath);

  const planOptions: { providers?: string[]; configPath?: string } = { configPath };
  if (options.provider && options.provider !== "all") {
    planOptions.providers = [options.provider];
  }

  const plan = buildPlan(resolved, state.getStateFile(), planOptions);

  if (plan.diagnostics.length > 0) {
    console.log("\nDiagnostics:");
    for (const d of plan.diagnostics) {
      const icon = d.severity === "error" ? "✗" : d.severity === "warning" ? "⚠" : "ℹ";
      const color = d.severity === "error" ? chalk.red : d.severity === "warning" ? chalk.yellow : chalk.blue;
      console.log(color(`  ${icon} ${d.code}`));
      if (d.resource) {
        console.log(`    Resource: ${d.resource.type}.${d.resource.name} (${d.resource.provider})`);
      }
      console.log(`    ${d.message}`);
    }
    console.log();

    const hasErrors = plan.diagnostics.some((d) => d.severity === "error");
    if (hasErrors) {
      log.error("Cannot apply: resolve the errors above first.");
      process.exit(1);
    }
  }

  const actionable = plan.actions.filter((a) => a.action !== "no-op");
  if (actionable.length === 0) {
    log.success("No changes. Infrastructure is up-to-date.");
    return;
  }

  const creates = actionable.filter((a) => a.action === "create");
  const updates = actionable.filter((a) => a.action === "update");
  const deletes = actionable.filter((a) => a.action === "delete");

  console.log(`\n${chalk.green(`${creates.length} to create`)}, ${chalk.yellow(`${updates.length} to update`)}, ${chalk.red(`${deletes.length} to destroy`)}\n`);

  for (const a of actionable) {
    const icon = a.action === "create" ? "+" : a.action === "update" ? "~" : "-";
    const color = a.action === "create" ? chalk.green : a.action === "update" ? chalk.yellow : chalk.red;
    console.log(color(`  ${icon} ${a.address.type}.${a.address.name} (${a.address.provider})`));
  }

  if (deletes.length > 0) {
    console.log(chalk.red.bold(`\n  ⚠ Resources to be DESTROYED:`));
    for (const a of deletes) {
      console.log(chalk.red(`    - ${a.address.type}.${a.address.name} (${a.address.provider})`));
    }
    console.log();
  }

  if (!options.yes) {
    const confirmMsg = deletes.length > 0
      ? `Apply changes? (will destroy ${deletes.length} resource(s))`
      : "Do you want to apply these changes?";
    const shouldApply = await p.confirm({ message: confirmMsg });
    if (p.isCancel(shouldApply) || !shouldApply) {
      p.cancel("Apply cancelled.");
      return;
    }
  }

  const projectName = basename(dirname(configPath));
  const providers = buildProviders(config.providers as Record<string, unknown>, projectName);

  const s = p.spinner();
  s.start("Applying changes...");

  const result = await executePlan(plan, resolved, configPath, providers, state);

  const succeeded = result.results.filter((r) => r.status === "success").length;
  const failed = result.results.filter((r) => r.status === "failed").length;
  const skipped = result.results.filter((r) => r.status === "skipped").length;

  s.stop("Apply finished.");

  if (failed > 0) {
    p.log.warning(`${succeeded} succeeded, ${failed} failed, ${skipped} skipped.`);
    process.exit(1);
  } else {
    p.log.success(`Apply complete! ${succeeded} actions executed successfully.`);
  }
}

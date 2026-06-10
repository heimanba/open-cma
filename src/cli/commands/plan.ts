import { resolve } from "path";
import chalk from "chalk";
import { loadConfig, resolveFileReferences } from "../../parser/index.ts";
import { buildPlan } from "../../planner/planner.ts";
import { StateManager } from "../../state/state-manager.ts";
import { log } from "../../utils/logger.ts";
import { deriveStatePath } from "../../utils/paths.ts";
import "../../providers/all.ts";

export async function planCommand(options: { file: string; provider?: string; json?: boolean }) {
  const configPath = resolve(options.file);
  const statePath = deriveStatePath(configPath);

  const { config, errors } = await loadConfig(configPath);
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

  // Output
  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  // Display diagnostics
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
  }

  // Display plan summary
  const creates = plan.actions.filter((a) => a.action === "create");
  const updates = plan.actions.filter((a) => a.action === "update");
  const deletes = plan.actions.filter((a) => a.action === "delete");

  if (creates.length === 0 && updates.length === 0 && deletes.length === 0) {
    log.success("No changes. Infrastructure is up-to-date.");
    return;
  }

  console.log("\nPlanned actions:\n");

  for (const a of creates) {
    console.log(chalk.green(`  + ${a.address.type}.${a.address.name} (${a.address.provider})`));
  }
  for (const a of updates) {
    console.log(chalk.yellow(`  ~ ${a.address.type}.${a.address.name} (${a.address.provider})`));
  }
  for (const a of deletes) {
    console.log(chalk.red(`  - ${a.address.type}.${a.address.name} (${a.address.provider})`));
  }

  console.log(
    `\nPlan: ${chalk.green(`${creates.length} to create`)}, ${chalk.yellow(`${updates.length} to update`)}, ${chalk.red(`${deletes.length} to destroy`)}.`
  );
}

import { Command } from "commander";
import { initCommand } from "./commands/init.ts";
import { validateCommand } from "./commands/validate.ts";
import { planCommand } from "./commands/plan.ts";
import { applyCommand } from "./commands/apply.ts";
import { destroyCommand } from "./commands/destroy.ts";
import { stateListCommand, stateShowCommand, stateRemoveCommand, stateImportCommand } from "./commands/state.ts";
import { sessionCreateCommand, sessionListCommand, sessionGetCommand, sessionDeleteCommand } from "./commands/session.ts";

export const program = new Command()
  .name("cma")
  .version("0.1.0")
  .description("Open Cloud Managed Agents — Declaratively manage AI agent infrastructure");

program
  .command("init")
  .description("Create a new cma.yaml template")
  .action(initCommand);

program
  .command("validate")
  .description("Validate the configuration file (offline)")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .action(validateCommand);

program
  .command("plan")
  .description("Show what changes would be applied (offline)")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .option("--provider <name>", "Target provider (claude/qoder/all)", "all")
  .option("--json", "Output as JSON")
  .action(planCommand);

program
  .command("apply")
  .description("Apply the planned changes to create/update/delete resources")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .option("-y, --yes", "Skip confirmation prompt")
  .option("--provider <name>", "Target provider (claude/qoder/all)", "all")
  .action(applyCommand);

program
  .command("destroy")
  .description("Destroy all managed resources")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .option("-y, --yes", "Skip confirmation prompt")
  .option("--cascade", "Auto-delete dependent resources (e.g., sessions referencing an environment)")
  .action(destroyCommand);

const stateCmd = program
  .command("state")
  .description("Manage state file");

stateCmd
  .command("list")
  .description("List all resources in state")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .action(stateListCommand);

stateCmd
  .command("show <address>")
  .description("Show details of a resource in state")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .action(stateShowCommand);

stateCmd
  .command("rm <address>")
  .description("Remove a resource from state without destroying it remotely")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .action(stateRemoveCommand);

stateCmd
  .command("import <address> <remote-id>")
  .description("Import an existing remote resource into state")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .option("--version <number>", "Resource version (for versioned resources like agents)")
  .action(stateImportCommand);

const sessionCmd = program
  .command("session")
  .description("Manage agent sessions (runtime)");

sessionCmd
  .command("create <agent-name>")
  .description("Create a new session for an agent")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .option("--environment <name>", "Override agent's declared environment")
  .option("--vault <name>", "Override agent's declared vault")
  .option("--memory-stores <names>", "Override agent's declared memory stores (comma-separated)")
  .option("--title <title>", "Session title")
  .option("--provider <name>", "Target provider (required for multi-provider agents)")
  .action(sessionCreateCommand);

sessionCmd
  .command("list")
  .description("List sessions from the provider")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .option("--agent <name>", "Filter by agent name")
  .option("--provider <name>", "Target provider")
  .action(sessionListCommand);

sessionCmd
  .command("get <session-id>")
  .description("Get details of a session")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .option("--provider <name>", "Target provider")
  .action(sessionGetCommand);

sessionCmd
  .command("delete <session-id>")
  .description("Delete a session")
  .option("-f, --file <path>", "Config file path", "cma.yaml")
  .option("--provider <name>", "Target provider")
  .action(sessionDeleteCommand);

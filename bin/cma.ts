#!/usr/bin/env bun
import { program } from "../src/cli/program.ts";
import { UserError } from "../src/errors.ts";
import { log } from "../src/utils/logger.ts";

program.parseAsync().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  log.error(message);

  if (!(err instanceof UserError)) {
    if (process.env.CMA_DEBUG) {
      console.error(err);
    } else {
      log.plain("  Run with CMA_DEBUG=1 for full details.");
    }
  }

  process.exit(1);
});

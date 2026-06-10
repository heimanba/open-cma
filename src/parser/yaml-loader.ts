import { parse as parseYaml } from "yaml";
import { projectConfigSchema } from "./schema.ts";
import { interpolateEnvVars } from "../utils/env.ts";
import type { ProjectConfig } from "../types/config.ts";

export interface LoadResult {
  config: ProjectConfig;
  errors: string[];
}

export async function loadConfig(
  filePath: string,
  resolveEnv = false
): Promise<LoadResult> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return { config: null as never, errors: [`File not found: ${filePath}`] };
  }

  let raw = await file.text();

  if (resolveEnv) {
    raw = interpolateEnvVars(raw, true);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { config: null as never, errors: [`YAML parse error: ${msg}`] };
  }

  const result = projectConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    );
    return { config: null as never, errors };
  }

  return { config: result.data as ProjectConfig, errors: [] };
}

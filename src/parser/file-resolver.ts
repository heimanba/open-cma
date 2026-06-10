import { resolve, dirname } from "path";
import { isFileReference, loadPrompt } from "../utils/prompt-loader.ts";
import type { ProjectConfig, AgentDecl, MemoryEntryDecl } from "../types/config.ts";
import { UserError } from "../errors.ts";

export interface ResolvedConfig extends ProjectConfig {
  _resolved: true;
}

export async function resolveFileReferences(
  config: ProjectConfig,
  configPath: string
): Promise<ResolvedConfig> {
  const basePath = configPath;
  const resolved = structuredClone(config) as ProjectConfig & { _resolved: true };

  if (resolved.agents) {
    for (const [name, agent] of Object.entries(resolved.agents)) {
      if (isFileReference(agent.instructions)) {
        (resolved.agents[name] as AgentDecl).instructions = await loadPrompt(
          agent.instructions,
          basePath
        );
      }
    }
  }

  if (resolved.memory_stores) {
    for (const [, store] of Object.entries(resolved.memory_stores)) {
      if (store.entries) {
        for (let i = 0; i < store.entries.length; i++) {
          const entry = store.entries[i]!;
          if (isFileReference(entry.content)) {
            const fullPath = resolve(dirname(basePath), entry.content);
            const file = Bun.file(fullPath);
            if (await file.exists()) {
              (store.entries[i] as MemoryEntryDecl).content = await file.text();
            } else {
              throw new UserError(
                `Memory entry file not found: ${fullPath} (entry key: ${entry.key})`
              );
            }
          }
        }
      }
    }
  }

  resolved._resolved = true;
  return resolved;
}

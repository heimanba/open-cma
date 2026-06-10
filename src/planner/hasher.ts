import { readdirSync, statSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { contentHash } from "../utils/hash.ts";
import type { ProjectConfig } from "../types/config.ts";
import type { ResourceAddress } from "../types/state.ts";

export function computeResourceHash(
  address: ResourceAddress,
  config: ProjectConfig,
  basePath?: string
): string {
  const decl = getDeclaration(address, config);
  if (!decl) return "";

  if (address.type === "skill" && basePath) {
    const skillDecl = decl as { source: string };
    const fileHash = computeSkillContentHash(skillDecl.source, basePath);
    return contentHash({ decl, fileHash });
  }

  return contentHash(decl);
}

function getDeclaration(
  address: ResourceAddress,
  config: ProjectConfig
): unknown | null {
  const { type, name } = address;
  switch (type) {
    case "environment":
      return config.environments?.[name] ?? null;
    case "vault":
      return config.vaults?.[name] ?? null;
    case "memory_store":
      return config.memory_stores?.[name] ?? null;
    case "skill":
      return config.skills?.[name] ?? null;
    case "agent":
      return config.agents?.[name] ?? null;
    default:
      return null;
  }
}

export function computeSkillContentHash(
  source: string,
  basePath: string
): string {
  const fullPath = resolve(dirname(basePath), source);
  const stat = statSync(fullPath, { throwIfNoEntry: false });

  if (stat?.isDirectory()) {
    const parts = collectFilesForHash(fullPath, "");
    return contentHash(parts.join("\n"));
  }

  if (stat?.isFile()) {
    const content = readFileSync(fullPath, "utf-8");
    return contentHash(content);
  }

  return "";
}

function collectFilesForHash(dir: string, base: string): string[] {
  const parts: string[] = [];
  const entries = readdirSync(dir).sort();
  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    const entryStat = statSync(fullPath, { throwIfNoEntry: false });
    const rel = base ? `${base}/${entry}` : entry;
    if (entryStat?.isFile()) {
      const content = readFileSync(fullPath, "utf-8");
      parts.push(`${rel}:${content}`);
    } else if (entryStat?.isDirectory()) {
      parts.push(...collectFilesForHash(fullPath, rel));
    }
  }
  return parts;
}

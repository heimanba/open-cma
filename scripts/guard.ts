import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const srcRoot = path.join(repoRoot, "src");
const testsRoot = path.join(repoRoot, "tests");

type GuardCheck = {
  name: string;
  run: () => Promise<boolean>;
};

function toRepoPath(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const skippedDirs = new Set(["node_modules", "dist", "out", ".git", ".claude"]);

async function collectFiles(
  dir: string,
  filter: (name: string) => boolean,
): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skippedDirs.has(entry.name)) continue;
      results.push(...(await collectFiles(path.join(dir, entry.name), filter)));
    } else if (entry.isFile() && filter(entry.name)) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 1. TypeScript-first
// ---------------------------------------------------------------------------

const jsExtensions = new Set([".js", ".mjs", ".cjs"]);

async function checkTypeScriptFirst(): Promise<boolean> {
  const violations: string[] = [];
  for (const root of [srcRoot, testsRoot]) {
    const files = await collectFiles(root, (name) =>
      jsExtensions.has(path.extname(name)),
    );
    violations.push(...files.map(toRepoPath));
  }
  if (violations.length > 0) {
    console.error("JavaScript files found in src/ or tests/:");
    for (const v of violations) console.error(`  - ${v}`);
    console.error("All source code must be TypeScript (.ts/.tsx).");
    return false;
  }
  console.log("TypeScript-first check passed.");
  return true;
}

// ---------------------------------------------------------------------------
// 2. Provider six-file structure
// ---------------------------------------------------------------------------

const requiredProviderFiles = new Set([
  "index.ts",
  "config.ts",
  "capabilities.ts",
  "client.ts",
  "mapper.ts",
  "adapter.ts",
]);

async function checkProviderStructure(): Promise<boolean> {
  const providersDir = path.join(srcRoot, "providers");
  const entries = await readdir(providersDir, { withFileTypes: true });
  const providerDirs = entries.filter(
    (e) => e.isDirectory() && !skippedDirs.has(e.name),
  );

  if (providerDirs.length === 0) {
    console.error("No provider directories found under src/providers/.");
    return false;
  }

  let ok = true;
  for (const dir of providerDirs) {
    const dirPath = path.join(providersDir, dir.name);
    const files = await readdir(dirPath);
    const tsFiles = new Set(files.filter((f) => f.endsWith(".ts")));

    const missing = [...requiredProviderFiles].filter((f) => !tsFiles.has(f));
    const extra = [...tsFiles].filter((f) => !requiredProviderFiles.has(f));

    if (missing.length > 0) {
      console.error(
        `Provider '${dir.name}' missing files: ${missing.join(", ")}`,
      );
      ok = false;
    }
    if (extra.length > 0) {
      console.error(
        `Provider '${dir.name}' has unexpected files: ${extra.join(", ")}`,
      );
      ok = false;
    }
  }
  if (ok) console.log("Provider structure check passed.");
  return ok;
}

// ---------------------------------------------------------------------------
// 3. Import .ts extensions
// ---------------------------------------------------------------------------

const relativeImportRe = /from\s+["'](\.\.?\/[^"']+)["']/g;

async function checkImportExtensions(): Promise<boolean> {
  const files = await collectFiles(srcRoot, (name) => name.endsWith(".ts"));
  const violations: string[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const match of line.matchAll(relativeImportRe)) {
        const specifier = match[1]!;
        if (!specifier.endsWith(".ts") && !specifier.endsWith(".tsx")) {
          violations.push(`${toRepoPath(file)}:${i + 1} → ${specifier}`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error("Relative imports must use .ts extension:");
    for (const v of violations) console.error(`  - ${v}`);
    return false;
  }
  console.log("Import extensions check passed.");
  return true;
}

// ---------------------------------------------------------------------------
// 4. Test layout
// ---------------------------------------------------------------------------

async function checkTestLayout(): Promise<boolean> {
  const files = await collectFiles(srcRoot, (name) =>
    /\.test\.tsx?$/.test(name),
  );
  if (files.length > 0) {
    console.error("Test files must live under tests/, not src/:");
    for (const f of files) console.error(`  - ${toRepoPath(f)}`);
    return false;
  }
  console.log("Test layout check passed.");
  return true;
}

// ---------------------------------------------------------------------------
// 5. Layer boundary enforcement
// ---------------------------------------------------------------------------

const importFromRe = /from\s+["']([^"']+)["']/g;

function extractImportedLayers(
  content: string,
  fileRepoPath: string,
): string[] {
  const layers: string[] = [];
  for (const match of content.matchAll(importFromRe)) {
    const specifier = match[1]!;
    if (!specifier.startsWith(".")) continue;

    const fileDir = path.dirname(
      path.join(repoRoot, fileRepoPath),
    );
    const resolved = path
      .relative(srcRoot, path.resolve(fileDir, specifier))
      .split(path.sep)[0];
    if (resolved) layers.push(resolved);
  }
  return layers;
}

async function checkLayerBoundaries(): Promise<boolean> {
  const files = await collectFiles(srcRoot, (name) => name.endsWith(".ts"));
  const violations: string[] = [];

  const businessLayers = new Set([
    "cli",
    "executor",
    "graph",
    "parser",
    "planner",
    "providers",
    "session",
    "state",
    "diagnostics",
  ]);

  for (const file of files) {
    const repoPath = toRepoPath(file);
    const content = await readFile(file, "utf8");
    const importedLayers = extractImportedLayers(content, repoPath);

    // types/ must only import from types/
    if (repoPath.startsWith("src/types/")) {
      for (const layer of importedLayers) {
        if (layer !== "types" && !layer.endsWith(".ts")) {
          violations.push(
            `${repoPath}: types/ imports from '${layer}/' (must only import within types/)`,
          );
        }
      }
    }

    // utils/ must not import business modules
    if (repoPath.startsWith("src/utils/")) {
      for (const layer of importedLayers) {
        if (businessLayers.has(layer)) {
          violations.push(
            `${repoPath}: utils/ imports from '${layer}/' (must not import business modules)`,
          );
        }
      }
    }

    // mapper.ts must not import client.ts
    if (repoPath.match(/src\/providers\/[^/]+\/mapper\.ts$/)) {
      if (content.includes('from "./client.ts"') || content.includes("from './client.ts'")) {
        violations.push(
          `${repoPath}: mapper.ts imports client.ts (mappers must be pure functions)`,
        );
      }
    }
  }

  if (violations.length > 0) {
    console.error("Layer boundary violations:");
    for (const v of violations) console.error(`  - ${v}`);
    return false;
  }
  console.log("Layer boundaries check passed.");
  return true;
}

// ---------------------------------------------------------------------------
// 6. types/ purity
// ---------------------------------------------------------------------------

async function checkTypesPurity(): Promise<boolean> {
  const files = await collectFiles(
    path.join(srcRoot, "types"),
    (name) => name.endsWith(".ts"),
  );
  const violations: string[] = [];

  for (const file of files) {
    const repoPath = toRepoPath(file);
    const content = await readFile(file, "utf8");

    if (/^class\s/m.test(content) || /\bclass\s+\w+/m.test(content)) {
      // filter out `import type` lines that might contain "class" in identifiers
      const nonImportLines = content
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("import"));
      if (nonImportLines.some((l) => /\bclass\s+\w+/.test(l))) {
        violations.push(`${repoPath}: contains class definition (types/ must be pure interfaces)`);
      }
    }

    if (/from\s+["']zod["']/.test(content)) {
      violations.push(`${repoPath}: imports zod (types/ must have zero runtime dependencies)`);
    }
  }

  if (violations.length > 0) {
    console.error("types/ purity violations:");
    for (const v of violations) console.error(`  - ${v}`);
    return false;
  }
  console.log("types/ purity check passed.");
  return true;
}

// ---------------------------------------------------------------------------
// 7. Zod boundary
// ---------------------------------------------------------------------------

const zodAllowedPaths = [
  "src/parser/schema.ts",
  "src/providers/registry.ts",
];
const zodAllowedPattern = /^src\/providers\/[^/]+\/config\.ts$/;

async function checkZodBoundary(): Promise<boolean> {
  const files = await collectFiles(srcRoot, (name) => name.endsWith(".ts"));
  const violations: string[] = [];

  for (const file of files) {
    const repoPath = toRepoPath(file);
    const content = await readFile(file, "utf8");

    if (!/from\s+["']zod["']/.test(content)) continue;

    const allowed =
      zodAllowedPaths.includes(repoPath) ||
      zodAllowedPattern.test(repoPath);

    if (!allowed) {
      violations.push(repoPath);
    }
  }

  if (violations.length > 0) {
    console.error(
      "Zod imports found outside allowed boundary (parser/schema.ts, providers/*/config.ts, providers/registry.ts):",
    );
    for (const v of violations) console.error(`  - ${v}`);
    return false;
  }
  console.log("Zod boundary check passed.");
  return true;
}

// ---------------------------------------------------------------------------
// 8. Mapper purity
// ---------------------------------------------------------------------------

const mapperBannedPatterns = [
  /\bfetch\s*\(/,
  /\bBun\.file\b/,
  /\bBun\.write\b/,
  /\bconsole\.\w+\s*\(/,
  /\bprocess\.(env|exit|argv)\b/,
  /\breadFileSync\b/,
  /\bwriteFileSync\b/,
  /\bawait\b/,
];

async function checkMapperPurity(): Promise<boolean> {
  const providersDir = path.join(srcRoot, "providers");
  const entries = await readdir(providersDir, { withFileTypes: true });
  const violations: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || skippedDirs.has(entry.name)) continue;
    const mapperPath = path.join(providersDir, entry.name, "mapper.ts");
    try {
      await stat(mapperPath);
    } catch {
      continue;
    }

    const content = await readFile(mapperPath, "utf8");
    const repoPath = toRepoPath(mapperPath);

    for (const pattern of mapperBannedPatterns) {
      if (pattern.test(content)) {
        violations.push(
          `${repoPath}: matches banned pattern ${pattern.source}`,
        );
      }
    }
  }

  if (violations.length > 0) {
    console.error("Mapper purity violations (mappers must be pure sync functions):");
    for (const v of violations) console.error(`  - ${v}`);
    return false;
  }
  console.log("Mapper purity check passed.");
  return true;
}

// ---------------------------------------------------------------------------
// 9. Banned packages
// ---------------------------------------------------------------------------

const bannedPackages = [
  "express",
  "dotenv",
  "ws",
  "better-sqlite3",
  "pg",
  "ioredis",
  "jest",
  "vitest",
];

async function checkBannedPackages(): Promise<boolean> {
  const files = await collectFiles(srcRoot, (name) => name.endsWith(".ts"));
  const violations: string[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const repoPath = toRepoPath(file);

    for (const pkg of bannedPackages) {
      const re = new RegExp(`from\\s+["']${pkg}["']`);
      if (re.test(content)) {
        violations.push(`${repoPath}: imports banned package '${pkg}'`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("Banned package imports found:");
    for (const v of violations) console.error(`  - ${v}`);
    return false;
  }
  console.log("Banned packages check passed.");
  return true;
}

// ---------------------------------------------------------------------------
// 10. Provider registration completeness
// ---------------------------------------------------------------------------

async function checkProviderRegistration(): Promise<boolean> {
  const providersDir = path.join(srcRoot, "providers");
  const entries = await readdir(providersDir, { withFileTypes: true });
  const providerDirs = entries
    .filter((e) => e.isDirectory() && !skippedDirs.has(e.name))
    .map((e) => e.name);

  const allTsPath = path.join(providersDir, "all.ts");
  const allContent = await readFile(allTsPath, "utf8");

  const missing: string[] = [];
  for (const dir of providerDirs) {
    const importPattern = `./${dir}/index.ts`;
    if (!allContent.includes(importPattern)) {
      missing.push(dir);
    }
  }

  if (missing.length > 0) {
    console.error(
      "Providers not registered in providers/all.ts:",
    );
    for (const m of missing)
      console.error(`  - ${m} (add: import "./${m}/index.ts";)`);
    return false;
  }
  console.log("Provider registration check passed.");
  return true;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const checks: GuardCheck[] = [
  { name: "TypeScript-first", run: checkTypeScriptFirst },
  { name: "provider structure", run: checkProviderStructure },
  { name: "import extensions", run: checkImportExtensions },
  { name: "test layout", run: checkTestLayout },
  { name: "layer boundaries", run: checkLayerBoundaries },
  { name: "types purity", run: checkTypesPurity },
  { name: "Zod boundary", run: checkZodBoundary },
  { name: "mapper purity", run: checkMapperPurity },
  { name: "banned packages", run: checkBannedPackages },
  { name: "provider registration", run: checkProviderRegistration },
];

async function runChecks(): Promise<boolean> {
  console.log(`Running ${checks.length} guard checks...\n`);
  const results: boolean[] = [];

  for (const check of checks) {
    try {
      results.push(await check.run());
    } catch (error) {
      console.error(`Guard check '${check.name}' threw unexpectedly:`);
      console.error(error);
      results.push(false);
    }
  }

  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;

  console.log(`\n${"─".repeat(40)}`);
  if (failed > 0) {
    console.error(`FAILED: ${failed}/${results.length} checks failed.`);
  } else {
    console.log(`PASSED: All ${results.length} checks passed.`);
  }

  return results.every(Boolean);
}

if (!(await runChecks())) {
  process.exitCode = 1;
}

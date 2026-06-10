import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const hooksDir = path.join(repoRoot, ".git", "hooks");

if (!existsSync(path.join(repoRoot, ".git"))) {
  console.log("Not a git repository, skipping hook installation.");
  process.exit(0);
}

if (!existsSync(hooksDir)) {
  mkdirSync(hooksDir, { recursive: true });
}

const preCommitHook = `#!/bin/sh
# Installed by OpenCMA scripts/install-hooks.ts

echo "Running guard checks..."
bun run guard
GUARD_EXIT=$?

echo "Running typecheck..."
bun run typecheck
TC_EXIT=$?

if [ $GUARD_EXIT -ne 0 ] || [ $TC_EXIT -ne 0 ]; then
  echo ""
  echo "Pre-commit checks failed. Fix the issues above before committing."
  exit 1
fi
`;

const hookPath = path.join(hooksDir, "pre-commit");
writeFileSync(hookPath, preCommitHook);
chmodSync(hookPath, 0o755);

console.log("Pre-commit hook installed.");

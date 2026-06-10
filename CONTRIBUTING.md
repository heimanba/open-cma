# Contributing to OpenCMA

## Types of Contributions

| Type | Complexity | What's Involved |
|------|-----------|----------------|
| **New provider** | Medium | 6 files under `src/providers/<name>/`, tests, fixture |
| **Bug fix** | Low | Fix + test that proves the fix |
| **New feature** | Medium–High | Implementation + tests + docs if user-facing |
| **Documentation** | Low | Improvements to README, docs/, or examples/ |

## Merge Requirements

Every PR must satisfy:

1. `bun run guard` passes (10 design-principle checks)
2. `bun run typecheck` passes
3. `bun test` passes (including provider conformance tests)
4. At least one maintainer approval
5. No unresolved review comments

## Adding a New Provider

1. Create `src/providers/<name>/` with the six required files:
   - `index.ts` — calls `registerProvider()`
   - `config.ts` — Zod schema for provider configuration
   - `capabilities.ts` — declares support tier for each ResourceKind
   - `client.ts` — extends `BaseApiClient`
   - `mapper.ts` — pure functions, no IO
   - `adapter.ts` — implements `ProviderAdapter`

2. Add `import "./<name>/index.ts"` to `src/providers/all.ts`

3. Add a test fixture: `tests/fixtures/<name>-only.yaml`

4. Verify conformance: `bun test tests/unit/provider-conformance.test.ts`

5. Add example configs under `examples/<name>/`

## Code Style

- **Language**: TypeScript only. No `.js` files.
- **Imports**: Always include `.ts` extension on relative imports.
- **Comments**: English. No narration. Only explain "why" when non-obvious.
- **Commits**: Conventional commits — `feat(scope):`, `fix(scope):`, `refactor(scope):`, `docs:`, `test:`, `chore:`.
- **PRs**: One concern per PR. Title in imperative mood. Body explains "why", not just "what".

## What We Don't Accept

- Replacing Bun with Node.js or Deno
- Replacing the YAML config format
- Introducing web frameworks (express, hono, etc.)
- Replacing Zod with another validation library
- Adding Terraform advanced features (modules, workspaces, remote backends)
- New runtime dependencies without justification
- GUI or web dashboard additions

## Development Setup

```sh
# Clone and install
git clone <repo-url>
cd opencma
bun install

# Pre-commit hook is installed automatically via `prepare` script

# Run checks
bun run guard       # Design-principle checks
bun run typecheck   # TypeScript compilation check
bun test            # Unit + conformance tests
```

## Questions?

Open a Discussion (not an Issue) for questions, ideas, or general conversation.

---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Architecture

### Directory Structure

```
src/
  cli/           User-facing commands (commander + clack)
  parser/        YAML → Zod validation → ProjectConfig
  graph/         Dependency DAG construction + topological sort
  planner/       State diff + execution plan generation
  executor/      Plan execution + state persistence (crash-safe)
  state/         State file CRUD (lineage, serial, resources)
  session/       Runtime session management (not tracked in state)
  providers/     Provider abstraction + concrete implementations
  types/         Pure interfaces and type definitions (no logic)
  utils/         Stateless utility functions
  diagnostics/   Diagnostic message collection
```

### Provider Pattern — Six-File Structure

Every provider lives under `src/providers/<name>/` with exactly these files:

| File | Responsibility |
|------|---------------|
| `index.ts` | Self-registration entry — calls `registerProvider()` |
| `config.ts` | Zod schema for provider-specific configuration |
| `capabilities.ts` | Static capability declaration (native/emulated/unsupported per ResourceKind) |
| `client.ts` | HTTP client extending `BaseApiClient` |
| `mapper.ts` | Pure functions — config → API request body transformation |
| `adapter.ts` | `ProviderAdapter` implementation — composes client + mapper |

New providers MUST also be imported in `src/providers/all.ts`.

### Design Principles

- **TypeScript-first**: No `.js/.mjs/.cjs` files in `src/` or `tests/`.
- **Import extensions**: All relative imports must use `.ts` suffix.
- **types/ is pure**: Only `type`, `interface`, `enum`, and pure functions. No `class`, no `zod`, no runtime dependencies.
- **Zod at the boundary**: `zod` imports only allowed in `parser/schema.ts`, `providers/*/config.ts`, and `providers/registry.ts`.
- **Mapper purity**: `providers/*/mapper.ts` must be pure synchronous functions — no IO, no `fetch`, no `await`, no `console`.
- **Tests outside src**: All `*.test.ts` files live under `tests/`, never inside `src/`.
- **Minimal dependencies**: Currently 6 runtime deps. Adding a new dependency requires justification.

### Layer Dependency Rules

- `types/` → imports only from within `types/`
- `utils/` → imports only third-party packages (chalk) or Node builtins, never business modules
- `providers/*/mapper.ts` → imports only from `types/` and `providers/interface.ts` (type-only)
- `planner/`, `graph/` → never import from `executor/` or `cli/` (no reverse dependencies)

### Validation (run before submitting)

```sh
bun run guard && bun run typecheck && bun test
```

### What We Don't Accept

- Replacing Bun with Node/Deno
- Replacing YAML with HCL/JSON/TOML
- Introducing ORM, web framework, or bundler dependencies
- Replacing Zod with Joi/Yup/ArkType
- Terraform advanced features (modules, workspaces, remote backends) unless explicitly requested
- Adding a GUI or web dashboard
- New runtime dependencies without a paragraph explaining why

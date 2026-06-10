## 1. Types & Interfaces

- [x] 1.1 Create `src/types/session.ts` with `SessionBindings`, `SessionInfo`, `SessionFilter`, `SessionListResult` types
- [x] 1.2 Add `"session"` to `ResourceKind` in `src/providers/capabilities.ts` and update both provider capability maps
- [x] 1.3 Extend `ProviderAdapter` in `src/providers/interface.ts` with `createSession`, `listSessions`, `getSession`, `deleteSession` methods

## 2. Resolver Refactor

- [x] 2.1 Add `resolveRef` and `requireRef` generic functions to `src/executor/resolver.ts`
- [x] 2.2 Refactor `resolveAgentRefs` to use `resolveRef`/`requireRef` internally, remove `environment_id`, `vault_ids`, `memory_store_ids` from `ResolvedAgentRefs`
- [x] 2.3 Update `src/executor/executor.ts` call site to match the trimmed `ResolvedAgentRefs`
- [x] 2.4 Verify `bun test` passes — existing agent create/update behavior unchanged

## 3. Qoder Session Implementation

- [x] 3.1 Add `mapSession()` to `src/providers/qoder/mapper.ts` — maps `SessionBindings` to Qoder `POST /sessions` body
- [x] 3.2 Implement `createSession`, `listSessions`, `getSession`, `deleteSession` in `src/providers/qoder/adapter.ts`

## 4. Claude Session Implementation

- [x] 4.1 Add `mapSession()` to `src/providers/claude/mapper.ts` — maps `SessionBindings` to Claude `POST /sessions` body (memory_stores via `resources` array)
- [x] 4.2 Implement `createSession`, `listSessions`, `getSession`, `deleteSession` in `src/providers/claude/adapter.ts`

## 5. Session Manager

- [x] 5.1 Create `src/session/session-manager.ts` — `buildSessionBindings()` that reads agent declaration, applies CLI overrides, calls `requireRef` for each binding, returns `SessionBindings`
- [x] 5.2 Handle edge cases: agent not in config, agent not provisioned, override resource not in config, multi-provider agent requiring `--provider` flag

## 6. CLI Commands

- [x] 6.1 Create `src/cli/commands/session.ts` with `session create <agent-name>`, `session list`, `session get <session-id>`, `session delete <session-id>` subcommands
- [x] 6.2 Add CLI flags: `--environment`, `--vault`, `--memory-stores`, `--title`, `--provider`
- [x] 6.3 Register session command in `src/cli/program.ts`

## 7. Testing

- [x] 7.1 Unit tests for `resolveRef` / `requireRef`
- [x] 7.2 Unit tests for `buildSessionBindings` (inheritance from agent, CLI overrides, error cases)
- [x] 7.3 Unit tests for `mapSession` (Qoder body format vs Claude body format)

## 8. Example & Documentation

- [x] 8.1 Add `examples/qoder/with-mcp/agent-iac.yaml` — standalone MCP example with vault + mcp_servers
- [x] 8.2 Update `docs/configuration.md` with session commands section

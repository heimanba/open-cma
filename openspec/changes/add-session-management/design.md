## Context

agent-iac follows a Terraform-like model: YAML declares desired state, `plan` diffs against remote state, `apply` executes changes. All resources (environment, vault, skill, memory_store, agent) flow through a single pipeline: Parser → Planner → Executor → Adapter → API.

Sessions are fundamentally different — they are runtime instances, not infrastructure definitions. Both Qoder and Claude APIs treat sessions as runtime objects created from infrastructure references (agent + environment + vault + memory_store). The agent YAML already declares these relationships, but they currently produce dead code in `resolver.ts` because the Agent Create API doesn't accept these fields — they belong to Session Create.

Industry tools (Terraform, Serverless Framework, Kubernetes) consistently separate definition management from instance operations. agent-iac should follow the same pattern.

## Goals / Non-Goals

**Goals:**
- Add `session` CLI subcommands that bypass the plan/apply pipeline and directly call provider APIs
- Make agent declarations the default session "template" — `session create researcher` reads `agents.researcher.environment/vault/memory_stores` to assemble bindings
- Support CLI flag overrides for environment/vault/memory_stores
- Refactor `resolver.ts` into a generic ref-resolution utility usable by both IaC executor and session manager
- Maintain provider abstraction — session operations go through `ProviderAdapter`, Qoder/Claude differences handled in mapper

**Non-Goals:**
- Session templates in YAML (deferred)
- Session persistence in state file (platforms provide `GET /sessions`)
- Message sending / event streaming (future runtime features)
- Batch session operations

## Decisions

### 1. Two-path architecture: IaC pipeline vs runtime commands

Session commands bypass Planner/Graph/Executor entirely and go CLI → SessionManager → Adapter → API.

**Why not run sessions through the existing pipeline:** Sessions are 1:N (multiple sessions per agent), have runtime state (idle/processing), and don't fit the plan/apply diff model. Forcing them through would require awkward hacks (count-based resources, ignoring runtime state in hash). A separate path is cleaner and matches industry practice (Serverless: `deploy` vs `invoke`).

**Alternative considered:** Sessions as IaC resources in YAML. Rejected because Terraform's own boundary is "manage capacity, not usage" — sessions are usage.

### 2. Agent declaration as session binding template

`session create <agent-name>` reads `agents.<name>.environment`, `agents.<name>.vault`, `agents.<name>.memory_stores` from config to assemble the Session Create body. CLI flags (`--environment`, `--vault`) override individual bindings.

**Why not require explicit session config:** The YAML already declares these relationships. Requiring a second declaration would be redundant. CLI overrides provide the flexibility for ad-hoc variations (e.g., `--environment staging`).

### 3. Resolver refactor: generic `resolveRef` / `requireRef`

Replace `resolveAgentRefs()` with two primitives:
- `resolveRef(state, address)` → `string | undefined` — look up one resource
- `requireRef(state, address)` → `string` — look up, throw if missing

Consumers (executor for agent create, session-manager for session create) compose their own ref sets from these primitives.

**Why not keep `resolveAgentRefs` and add `resolveSessionRefs`:** Each new consumer would require a new domain-specific function in resolver.ts. The generic approach means adding a new resource type or consumer never changes resolver.ts — only the consumer adds a `requireRef` call.

**Alternative considered:** Builder/class pattern (`new RefResolver(state, provider).require("agent", name)`). Marginally nicer API but adds indirection without real benefit at current scale.

### 4. ProviderAdapter interface extension

Add session methods directly to `ProviderAdapter`:
- `createSession(bindings)`, `listSessions(filter)`, `getSession(id)`, `deleteSession(id)`

**Why same interface, not a separate `RuntimeAdapter`:** The underlying HTTP client is identical. Splitting creates factory complexity without benefit. If runtime operations grow significantly (message send, streaming), splitting is straightforward later.

### 5. Qoder vs Claude mapper differences

Session Create body differs between providers:

| Field | Qoder | Claude |
|-------|-------|--------|
| memory_stores | `memory_store_ids: [...]` top-level | `resources: [{type:"memory_store", memory_store_id:...}]` |
| vault | `vault_ids: [...]` | `vault_ids: [...]` |

Each provider's `mapSession()` handles its own body shape, consistent with how `mapAgent()` already works.

## Risks / Trade-offs

**[Session depends on infrastructure state being current]** → `session create` reads state file to resolve remote IDs. If state is stale (manual API deletions), session create will fail with a clear error from `requireRef`. Mitigation: error message suggests `agent-iac plan` to sync state.

**[No local session tracking]** → Users must use `session list` to discover their sessions. No offline access. Trade-off accepted: storing session IDs locally adds staleness risk (sessions deleted externally).

**[CLI override complexity]** → `--memory-stores` flag accepts comma-separated names, which could be confusing. Mitigation: document clearly, validate names against config before resolving.

## ADDED Requirements

### Requirement: Generic single-resource ref resolution
The system SHALL provide a `resolveRef` function that looks up one resource's remote ID from state by its address (type, name, provider).

#### Scenario: Resource exists in state
- **WHEN** `resolveRef` is called with address `{type: "environment", name: "dev", provider: "qoder"}` and state contains this resource with remote_id `env_abc123`
- **THEN** it SHALL return `"env_abc123"`

#### Scenario: Resource not in state
- **WHEN** `resolveRef` is called with an address not present in state
- **THEN** it SHALL return `undefined`

### Requirement: Required ref resolution with error
The system SHALL provide a `requireRef` function that looks up a resource's remote ID and throws a descriptive error if not found.

#### Scenario: Resource exists
- **WHEN** `requireRef` is called with a valid address present in state
- **THEN** it SHALL return the remote_id string

#### Scenario: Resource missing
- **WHEN** `requireRef` is called with address `{type: "agent", name: "researcher", provider: "qoder"}` not present in state
- **THEN** it SHALL throw an error with message containing the resource type, name, and a suggestion to run `agent-iac apply`

### Requirement: Agent refs composition uses generic resolver
The executor's agent creation flow SHALL compose its refs (skill_ids, multiagent_agent_ids) using `resolveRef`/`requireRef` instead of the monolithic `resolveAgentRefs`.

#### Scenario: Agent with skills and multiagent
- **WHEN** the executor creates an agent with `skills: [code-review]` and `multiagent: {agents: [researcher]}`
- **THEN** it SHALL call `resolveRef` for each skill and each multiagent sub-agent to build the refs, producing the same result as the current `resolveAgentRefs`

#### Scenario: Agent with no refs
- **WHEN** the executor creates an agent with no skills, vault, environment, or multiagent
- **THEN** it SHALL produce an empty refs object without calling resolveRef

### Requirement: Dead code removal
The system SHALL remove the `environment_id`, `vault_ids`, and `memory_store_ids` fields from `ResolvedAgentRefs` and their resolution logic from the agent creation path, since these are consumed by session creation, not agent creation.

#### Scenario: ResolvedAgentRefs type
- **WHEN** inspecting the `ResolvedAgentRefs` interface after refactor
- **THEN** it SHALL contain only `skill_ids` and `multiagent_agent_ids` (and `environment_id`, `vault_ids`, `memory_store_ids` SHALL be removed)

#### Scenario: Existing agent creation still works
- **WHEN** running `agent-iac apply` with agents that declare environment, vault, and memory_stores
- **THEN** agent creation SHALL succeed identically to before the refactor (these fields were never sent to the Agent Create API)

## ADDED Requirements

### Requirement: Create session from agent declaration
The system SHALL create a session by reading the named agent's declared `environment`, `vault`, and `memory_stores` from config, resolving their remote IDs from state, and calling the provider's Session Create API.

#### Scenario: Basic session creation
- **WHEN** user runs `agent-iac session create researcher` and agent `researcher` declares `environment: dev` and `vault: api-credentials` and `memory_stores: [project-kb]`
- **THEN** the system SHALL resolve the remote IDs for agent `researcher`, environment `dev`, vault `api-credentials`, and memory_store `project-kb` from state, call the provider Session Create API with these bindings, and print the created session ID

#### Scenario: Agent with no optional bindings
- **WHEN** user runs `agent-iac session create assistant` and agent `assistant` declares only `environment: dev` (no vault, no memory_stores)
- **THEN** the system SHALL create a session with only agent_id and environment_id, omitting vault_ids and memory_store_ids

#### Scenario: Agent not found in config
- **WHEN** user runs `agent-iac session create nonexistent` and no agent named `nonexistent` exists in config
- **THEN** the system SHALL exit with an error message listing available agent names

#### Scenario: Agent not yet provisioned
- **WHEN** user runs `agent-iac session create researcher` but the agent has not been created via `apply` (no entry in state)
- **THEN** the system SHALL exit with an error indicating the agent must be provisioned first via `agent-iac apply`

### Requirement: CLI flag overrides for session bindings
The system SHALL allow CLI flags to override the agent's declared bindings when creating a session.

#### Scenario: Override environment
- **WHEN** user runs `agent-iac session create researcher --environment staging`
- **THEN** the system SHALL use environment `staging` instead of the agent's declared environment, resolving its remote ID from state

#### Scenario: Override vault
- **WHEN** user runs `agent-iac session create researcher --vault staging-credentials`
- **THEN** the system SHALL use vault `staging-credentials` instead of the agent's declared vault

#### Scenario: Title flag
- **WHEN** user runs `agent-iac session create researcher --title "Sprint Review"`
- **THEN** the created session SHALL have the title "Sprint Review"

#### Scenario: Override references non-existent resource
- **WHEN** user runs `agent-iac session create researcher --environment nonexistent`
- **THEN** the system SHALL exit with an error indicating environment `nonexistent` is not defined in config

### Requirement: List sessions from provider API
The system SHALL list sessions by querying the provider's Session List API, with optional filtering by agent name.

#### Scenario: List all sessions
- **WHEN** user runs `agent-iac session list`
- **THEN** the system SHALL call the provider's Session List API and display session ID, agent name, status, and created_at for each session

#### Scenario: List sessions filtered by agent
- **WHEN** user runs `agent-iac session list --agent researcher`
- **THEN** the system SHALL resolve the agent's remote ID from state and call the provider's Session List API with agent_id filter

#### Scenario: No sessions exist
- **WHEN** user runs `agent-iac session list` and no sessions exist on the platform
- **THEN** the system SHALL display an empty list message

### Requirement: Get session details
The system SHALL retrieve and display full details of a session by ID.

#### Scenario: Get existing session
- **WHEN** user runs `agent-iac session get sess_019e...`
- **THEN** the system SHALL call the provider's Session Get API and display session details including status, agent, environment, vault_ids, memory_store_ids, and usage

#### Scenario: Session not found
- **WHEN** user runs `agent-iac session get sess_nonexistent`
- **THEN** the system SHALL exit with an error indicating the session was not found

### Requirement: Delete session
The system SHALL delete a session by ID via the provider's Session Delete API.

#### Scenario: Delete existing session
- **WHEN** user runs `agent-iac session delete sess_019e...`
- **THEN** the system SHALL call the provider's Session Delete API and confirm deletion

#### Scenario: Delete non-existent session
- **WHEN** user runs `agent-iac session delete sess_nonexistent`
- **THEN** the system SHALL exit with an error indicating the session was not found

### Requirement: Provider-specific session mapping
The system SHALL map session bindings to the correct provider-specific API body format.

#### Scenario: Qoder session body
- **WHEN** creating a session on the Qoder provider with memory_store bindings
- **THEN** the system SHALL send `memory_store_ids` as a top-level array field and `vault_ids` as a top-level array field in the POST /sessions body

#### Scenario: Claude session body
- **WHEN** creating a session on the Claude provider with memory_store bindings
- **THEN** the system SHALL send memory stores inside the `resources` array as `{type: "memory_store", memory_store_id: ...}` objects, and `vault_ids` as a top-level array field

### Requirement: Provider resolution for session commands
The system SHALL determine which provider to use based on the agent's provider assignment or the default provider config.

#### Scenario: Agent with explicit provider
- **WHEN** user runs `agent-iac session create researcher` and agent `researcher` has `provider: qoder`
- **THEN** the system SHALL use the Qoder adapter for session creation

#### Scenario: Agent with default provider
- **WHEN** user runs `agent-iac session create researcher` and agent `researcher` has no explicit provider, and `defaults.provider` is `claude`
- **THEN** the system SHALL use the Claude adapter for session creation

#### Scenario: Multi-provider agent
- **WHEN** user runs `agent-iac session create researcher` and agent `researcher` is deployed to multiple providers
- **THEN** the system SHALL require a `--provider` flag and exit with an error if not specified

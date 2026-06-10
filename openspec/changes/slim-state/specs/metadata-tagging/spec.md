## ADDED Requirements

### Requirement: Inject agent-iac metadata on supported resources
For resource types whose provider API accepts metadata on create/update, the mapper SHALL inject `agent-iac.project` and `agent-iac.resource` metadata keys into the API request body.

#### Scenario: Claude Agent create with metadata injection
- **WHEN** mapper constructs the request body for creating a Claude Agent
- **THEN** the body's metadata object includes `agent-iac.project` set to the project name from config
- **THEN** the body's metadata object includes `agent-iac.resource` set to the agent's name in YAML

#### Scenario: Claude Environment update with metadata injection
- **WHEN** mapper constructs the request body for updating a Claude Environment
- **THEN** the body's metadata object includes `agent-iac.project` and `agent-iac.resource` keys

#### Scenario: Qoder Agent create with metadata injection
- **WHEN** mapper constructs the request body for creating a Qoder Agent
- **THEN** the body's metadata object includes `agent-iac.project` and `agent-iac.resource` keys

#### Scenario: Qoder Environment update with metadata injection
- **WHEN** mapper constructs the request body for updating a Qoder Environment
- **THEN** the body's metadata object includes `agent-iac.project` and `agent-iac.resource` keys

### Requirement: No metadata injection on unsupported resources
For resource types whose provider API does NOT accept metadata, the mapper SHALL NOT inject any metadata.

#### Scenario: Claude Skill create without metadata
- **WHEN** mapper constructs the request body for creating a Claude Skill
- **THEN** no agent-iac metadata is added (Claude Skill API does not accept metadata)

#### Scenario: Qoder Skill create without metadata
- **WHEN** mapper constructs the request body for creating a Qoder Skill
- **THEN** no agent-iac metadata is added (Qoder Skill create form does not accept metadata)

#### Scenario: Qoder Vault create without metadata
- **WHEN** mapper constructs the request body for creating a Qoder Vault
- **THEN** no agent-iac metadata is added (Qoder Vault create does not accept metadata)

#### Scenario: Qoder MemoryStore create without metadata
- **WHEN** mapper constructs the request body for creating a Qoder MemoryStore
- **THEN** no agent-iac metadata is added (Qoder MemoryStore create does not accept metadata)

### Requirement: User metadata takes precedence
If the user has declared a metadata key in YAML that conflicts with an `agent-iac.*` key, the user's value SHALL be preserved.

#### Scenario: User declares agent-iac.project in YAML
- **WHEN** user's YAML declares `metadata: { "agent-iac.project": "custom-value" }` on an agent
- **THEN** the request body's metadata uses `"custom-value"` for `agent-iac.project`, not the config project name

### Requirement: Metadata coverage matrix
The mapper SHALL inject metadata according to the following provider capability matrix:

| Resource | Claude | Qoder |
|----------|--------|-------|
| Agent | inject | inject |
| Environment | inject | inject |
| Vault | inject | skip |
| Skill | skip | skip |
| MemoryStore | N/A | skip |

#### Scenario: Coverage aligns with API capabilities
- **WHEN** a resource is created or updated through any provider
- **THEN** metadata injection occurs only for resource types and providers where the API accepts metadata on the create or update request body

## ADDED Requirements

### Requirement: 409 on create produces actionable error
When executor encounters `ApiError` with `statusCode === 409` during a **create** action, it SHALL replace the raw API error with an actionable diagnostic message that includes the `cma state import` command.

#### Scenario: Agent create hits 409
- **WHEN** `createAgent("assistant", ...)` throws `ApiError` with `statusCode === 409`
- **THEN** the error message SHALL contain:
  - The resource address (e.g., `agent.assistant`)
  - The phrase "already exists on remote"
  - A `cma state import` command template with the resource address

#### Scenario: Environment create hits 409
- **WHEN** `createEnvironment("dev", ...)` throws `ApiError` with `statusCode === 409`
- **THEN** the error message follows the same format as agent create 409

### Requirement: Only create actions trigger conflict diagnostic
The 409 conflict diagnostic SHALL only apply to create actions. Update and delete actions that receive 409 MUST propagate the original error unchanged.

#### Scenario: Update action hits 409
- **WHEN** `updateAgent(id, ...)` throws `ApiError` with `statusCode === 409` (version conflict)
- **THEN** the original `ApiError` propagates without modification

#### Scenario: Delete action hits 409
- **WHEN** `deleteEnvironment(id)` throws `ApiError` with `statusCode === 409` (in use)
- **THEN** the existing session cleanup logic handles it (not the conflict diagnostic)

### Requirement: Conflict diagnostic covers all resource types
The 409 diagnostic SHALL apply to create actions of all resource types: environment, agent, skill, vault, memory_store.

#### Scenario: Skill create hits 409
- **WHEN** `createSkill("my-skill", ...)` throws `ApiError` with `statusCode === 409`
- **THEN** the diagnostic message includes `cma state import <provider>.skill.my-skill <remote-id>`

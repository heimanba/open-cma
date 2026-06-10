## ADDED Requirements

### Requirement: State file path derived from config file name
The system SHALL derive the state file path by replacing the config file's `.yaml` or `.yml` extension with `.state.json`, in the same directory as the config file.

#### Scenario: Standard .yaml config
- **WHEN** the config file path is `project/agent-iac.yaml`
- **THEN** the state file path SHALL be `project/agent-iac.state.json`

#### Scenario: Full variant config
- **WHEN** the config file path is `project/agent-iac-full.yaml`
- **THEN** the state file path SHALL be `project/agent-iac-full.state.json`

#### Scenario: .yml extension
- **WHEN** the config file path is `project/my-project.yml`
- **THEN** the state file path SHALL be `project/my-project.state.json`

#### Scenario: Non-yaml extension fallback
- **WHEN** the config file path does not end with `.yaml` or `.yml`
- **THEN** the state file path SHALL be the config file path with `.state.json` appended

### Requirement: All commands use derived state path
The system SHALL use the derived state path in all commands that access state: `plan`, `apply`, `destroy`, `state list`, `state show`, `state rm`.

#### Scenario: Independent state per config
- **WHEN** a user runs `plan -f agent-iac.yaml` then `plan -f agent-iac-full.yaml`
- **THEN** each command SHALL read/write its own state file independently
- **THEN** resources from `agent-iac.yaml` SHALL NOT appear as deletions in the plan for `agent-iac-full.yaml`

### Requirement: Backward compatibility with default config
The system SHALL maintain backward compatibility: the default config file `agent-iac.yaml` produces state file `agent-iac.state.json`, identical to the previous hardcoded behavior.

#### Scenario: Default config unchanged
- **WHEN** the user runs `plan` without `-f` flag (defaults to `agent-iac.yaml`)
- **THEN** the state file used SHALL be `agent-iac.state.json` in the same directory

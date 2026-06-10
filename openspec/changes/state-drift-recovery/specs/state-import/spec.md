## ADDED Requirements

### Requirement: Import command accepts three-segment address and remote ID
`cma state import` SHALL accept arguments in the format `<provider>.<type>.<name> <remote-id>` and write a `ResourceState` entry to the state file.

#### Scenario: Import an agent
- **WHEN** user runs `cma state import qoder.agent.assistant agent_abc123`
- **THEN** state file contains a resource with address `{provider: "qoder", type: "agent", name: "assistant"}` and `remote_id: "agent_abc123"`

#### Scenario: Two-segment address rejected
- **WHEN** user runs `cma state import agent.assistant agent_abc123` (missing provider)
- **THEN** the command exits with an error message specifying the required format `<provider>.<type>.<name>`

### Requirement: Import computes content_hash from current config
The import command SHALL read the current configuration file, locate the resource declaration matching the address, and compute `content_hash` using `computeResourceHash`.

#### Scenario: Hash matches current config
- **WHEN** user imports `qoder.agent.assistant` and the config file declares agent `assistant`
- **THEN** the stored `content_hash` equals the hash computed from the current agent declaration

#### Scenario: Resource not found in config
- **WHEN** user imports `qoder.agent.ghost` but no agent named `ghost` exists in the config file
- **THEN** the command exits with an error message indicating the resource is not declared in the config

### Requirement: Import accepts optional version flag
The import command SHALL accept an optional `--version <number>` flag. When provided, the imported resource state includes the version.

#### Scenario: Import with version
- **WHEN** user runs `cma state import qoder.agent.assistant agent_abc123 --version 3`
- **THEN** the stored resource state has `version: 3`

#### Scenario: Import without version
- **WHEN** user runs `cma state import qoder.agent.assistant agent_abc123`
- **THEN** the stored resource state has `version: undefined`

### Requirement: Import rejects duplicate address
If a resource with the same address already exists in state, the import command SHALL reject the operation and suggest `cma state rm` first.

#### Scenario: Address already in state
- **WHEN** user runs `cma state import qoder.agent.assistant agent_abc123` and state already contains `qoder.agent.assistant`
- **THEN** the command exits with an error message suggesting to run `cma state rm qoder.agent.assistant` first

### Requirement: Import persists state to disk
After writing the resource entry, the import command SHALL call `state.save()` to persist changes.

#### Scenario: State file updated on disk
- **WHEN** import succeeds
- **THEN** the state file on disk contains the new resource entry

### Requirement: Import supports config file option
The import command SHALL accept the `-f, --file <path>` option to specify the config file path, consistent with other state subcommands.

#### Scenario: Custom config file
- **WHEN** user runs `cma state import -f cma-full.yaml qoder.agent.assistant agent_abc123`
- **THEN** the command reads `cma-full.yaml` for resource declarations and uses the corresponding state file

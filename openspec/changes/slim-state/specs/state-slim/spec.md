## ADDED Requirements

### Requirement: Slim StateFile type
StateFile SHALL only contain a `resources` array. The `version`, `serial`, and `lineage` fields SHALL be removed from the type definition.

#### Scenario: New state file structure
- **WHEN** StateManager initializes a new state file
- **THEN** the created StateFile object contains only `{ resources: [] }` with no version, serial, or lineage fields

#### Scenario: Saved state file format
- **WHEN** StateManager saves to disk
- **THEN** the JSON file contains only `{ "resources": [...] }` with no version, serial, or lineage keys

### Requirement: Slim ResourceState type
ResourceState SHALL only contain `address`, `remote_id`, `content_hash`, and optional `version` fields. The `created_at`, `updated_at`, and `attributes` fields SHALL be removed.

#### Scenario: Resource stored after create
- **WHEN** executor completes a create action and writes to state
- **THEN** the ResourceState entry contains only address, remote_id, content_hash, and version (if returned by provider)
- **THEN** no created_at, updated_at, or attributes fields are present

#### Scenario: Resource stored after update
- **WHEN** executor completes an update action and writes to state
- **THEN** the ResourceState entry contains only address, remote_id, content_hash, and version (if returned by provider)

### Requirement: Slim RemoteResource interface
RemoteResource SHALL only contain `id`, `type`, and optional `version`. The `attributes`, `created_at`, and `updated_at` fields SHALL be removed from the interface.

#### Scenario: Provider returns create result
- **WHEN** a provider adapter creates a resource and returns RemoteResource
- **THEN** the returned object contains only id, type, and optionally version

#### Scenario: Provider returns update result
- **WHEN** a provider adapter updates a resource and returns RemoteResource
- **THEN** the returned object contains only id, type, and optionally version

### Requirement: Backward-compatible state loading
StateManager.load() SHALL successfully load state files that contain extra fields (version, serial, lineage, created_at, updated_at, attributes) by ignoring them.

#### Scenario: Load legacy state file with all fields
- **WHEN** StateManager loads a state file containing version, serial, lineage, and resources with created_at, updated_at, attributes
- **THEN** loading succeeds without error
- **THEN** the in-memory state contains only the load-bearing fields (address, remote_id, content_hash, version)

#### Scenario: Load already-slim state file
- **WHEN** StateManager loads a state file that only contains `{ "resources": [...] }` with slim ResourceState entries
- **THEN** loading succeeds without error

#### Scenario: Save after loading legacy file
- **WHEN** StateManager loads a legacy state file and then saves
- **THEN** the written file uses the slim format (no version, serial, lineage, no timestamps or attributes on resources)

### Requirement: StateManager save removes serial increment
StateManager.save() SHALL NOT maintain or increment a serial counter. It SHALL write the state directly.

#### Scenario: Save without serial
- **WHEN** StateManager.save() is called
- **THEN** the file is written without a serial field
- **THEN** no serial counter is incremented

### Requirement: state show outputs slim format
The `state show` command SHALL output only the load-bearing fields of a ResourceState.

#### Scenario: Show a resource
- **WHEN** user runs `state show claude.agent.my-agent`
- **THEN** the JSON output contains address, remote_id, content_hash, and version (if present)
- **THEN** no created_at, updated_at, or attributes appear in the output

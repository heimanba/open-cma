## RENAMED Requirements

### Requirement: Project identity rename
All user-facing identifiers SHALL change from `agent-iac` to `cma` / `opencma` as defined in the design mapping table.

FROM: `agent-iac` (CLI command, config file prefix, state file prefix, provider label prefix)
TO: `cma` (CLI command, config/state file prefix, provider label prefix), `opencma` (npm package name, brand in docs as "OpenCMA")

#### Scenario: CLI command name
- **WHEN** user runs `cma plan`
- **THEN** the CLI SHALL execute the plan command (previously `agent-iac plan`)

#### Scenario: Default config file
- **WHEN** user runs any command without `--file` flag
- **THEN** the CLI SHALL look for `cma.yaml` (previously `agent-iac.yaml`)

#### Scenario: State file naming
- **WHEN** the system persists state
- **THEN** the state file SHALL be named `cma.state.json` (previously `agent-iac.state.json`)

#### Scenario: Provider metadata labels
- **WHEN** the system creates or updates Agent resources on any provider
- **THEN** metadata labels SHALL use `cma.*` prefix (previously `agent-iac.*`)

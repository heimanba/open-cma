## ADDED Requirements

### Requirement: Explicit delete warning in apply
The system SHALL display a separate, prominent warning when the execution plan includes delete actions, before the general confirmation prompt.

#### Scenario: Plan with deletes
- **WHEN** the user runs `apply` and the plan contains delete actions
- **THEN** the system SHALL display each resource to be deleted in red, grouped under a "Resources to be DESTROYED" header
- **THEN** the confirmation message SHALL explicitly state the number of resources to be destroyed

#### Scenario: Plan without deletes
- **WHEN** the user runs `apply` and the plan contains only create/update actions
- **THEN** the system SHALL NOT display the destroy warning
- **THEN** the confirmation message SHALL use the existing generic prompt

#### Scenario: Auto-approve with deletes
- **WHEN** the user runs `apply --yes` and the plan contains delete actions
- **THEN** the system SHALL still display the destroy warning (but skip the confirmation prompt)

## ADDED Requirements

### Requirement: POS sensitive operations are server-authorized
The API SHALL authorize every POS sensitive operation by tenant role and SHALL deny Cashier deletion, price override, refund, payment correction, manual drawer opening, and unrestricted reprint operations.

#### Scenario: Cashier attempts to delete an order
- **WHEN** a Cashier submits a delete request for an order in the assigned branch
- **THEN** the API returns a forbidden response and the order remains unchanged

#### Scenario: Manager performs an allowed sensitive operation
- **WHEN** an assigned Manager performs a supported sensitive operation with a valid reason
- **THEN** the API completes the operation and records the actor, terminal, branch, reason, before state, and after state

### Requirement: Branch access is explicit and consistent
The system SHALL treat an empty branch assignment as no branch access for non-Owner roles and SHALL apply the same rule to list, search, statistics, detail, and mutation operations.

#### Scenario: Manager has no assigned branches
- **WHEN** a Manager with an empty branch assignment requests POS orders, search results, or statistics
- **THEN** the API returns no business records and does not expose tenant-wide data

#### Scenario: Terminal and staff branches differ
- **WHEN** a staff member attempts a write outside the branch bound to the authenticated terminal
- **THEN** the API rejects the request even if the staff member is assigned to the other branch

### Requirement: Sensitive operation reasons are mandatory
The API SHALL require a non-empty normalized reason for cancellation, deletion, price override, refund, payment correction, manual drawer opening, and privileged reprint.

#### Scenario: Manager omits a reason
- **WHEN** a Manager requests a sensitive operation without a reason
- **THEN** validation fails before any business data changes

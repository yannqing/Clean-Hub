## ADDED Requirements

### Requirement: POS PIN login requires an enrolled terminal
The system SHALL allow POS PIN login only when the terminal is registered for the tenant, active, bound to a branch, and presents a valid server-issued terminal credential.

#### Scenario: Unregistered browser attempts PIN login
- **WHEN** a browser presents a locally generated device ID that has no active terminal enrollment
- **THEN** the API rejects login without enumerating tenant staff or PIN validity

#### Scenario: Disabled terminal attempts PIN login
- **WHEN** an enrolled terminal has inactive status
- **THEN** the API rejects login even when the PIN is correct

### Requirement: Terminal enrollment is privileged and auditable
Only Owner or authorized Manager roles SHALL enroll, rotate, rebind, disable, or unlock a terminal, and every change SHALL be audited.

#### Scenario: Manager enrolls a terminal
- **WHEN** an authorized Manager enrolls a terminal for an assigned branch
- **THEN** the API stores only a credential digest, returns the credential through a secure channel, and records the enrollment event

### Requirement: Login limits use server-known identity
PIN failure counters and lockouts SHALL be keyed by tenant and enrolled terminal identity, with an additional network-based limiter that cannot be reset by clearing browser storage.

#### Scenario: Local device storage is cleared
- **WHEN** repeated failed PIN attempts are followed by clearing local browser storage
- **THEN** the terminal or network lockout remains effective

### Requirement: POS audit records identify the terminal
Every authenticated POS write and authentication event SHALL include the trusted terminal record ID and bound branch in its audit metadata.

#### Scenario: POS order is updated
- **WHEN** an authenticated POS user changes an order
- **THEN** the audit record identifies both the user and enrolled terminal

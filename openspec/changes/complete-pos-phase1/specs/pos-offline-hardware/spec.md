## ADDED Requirements

### Requirement: POS sync state reflects the real queue
The POS shell SHALL display online state, pending operation count, replay activity, and blocking sync errors from the actual offline queue.

#### Scenario: Order is queued offline
- **WHEN** network access is unavailable and staff creates an eligible order
- **THEN** the POS stores the operation locally with a stable ULID and shows it as pending rather than synchronized

#### Scenario: Network returns
- **WHEN** connectivity returns with pending operations
- **THEN** the POS replays them in order, marks successful items synchronized, and visibly retains any failed item

### Requirement: Offline writes are isolated and idempotent
Offline queue storage SHALL be partitioned by tenant, branch, and enrolled terminal, and every replayed mutation SHALL use a stable entity ID and idempotency key.

#### Scenario: User changes tenant
- **WHEN** a terminal has pending operations for one tenant or branch
- **THEN** those operations are not exposed or replayed in another tenant or branch context

### Requirement: Desktop exposes a minimal hardware bridge
The Desktop preload SHALL expose typed scanner, printer, cash-drawer, and secure terminal credential capabilities without exposing unrestricted Node APIs.

#### Scenario: Scanner reads an order label
- **WHEN** a connected scanner emits a supported order or item code
- **THEN** the POS receives a normalized scan event and navigates to the matching record

### Requirement: Print and drawer actions are observable
Receipt and label print jobs SHALL have stable IDs, status, retry behavior, and audit records; manual drawer opening SHALL require authorization and a reason.

#### Scenario: Printer is unavailable
- **WHEN** staff submits a print job while the configured printer is unavailable
- **THEN** the job remains failed or pending with an actionable error and can be retried without creating duplicate audit success events

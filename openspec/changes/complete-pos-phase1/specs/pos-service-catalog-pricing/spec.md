## ADDED Requirements

### Requirement: POS staff can read the applicable service catalog
Authenticated POS roles SHALL be able to list active services and branch-applicable prices for their tenant without gaining tenant administration permissions.

#### Scenario: Cashier opens item selection
- **WHEN** a Cashier starts an order in the terminal branch
- **THEN** the POS shows only active services and effective prices available to that tenant and branch

### Requirement: Order items reference services and price snapshots
Every catalog-based order or ticket item SHALL store a service ID, service name snapshot, pricing unit, standard unit amount, charged unit amount, quantity or measurement, and currency.

#### Scenario: Cashier adds a per-item service
- **WHEN** a Cashier selects an item-priced service and enters quantity
- **THEN** the line total is calculated from the effective standard price and the saved item references that service

#### Scenario: Cashier adds a weight-priced service
- **WHEN** a Cashier selects a weight-priced service and records weight and bag count
- **THEN** the line total uses the measured weight while retaining the operational bag count

### Requirement: Garment intake captures operational details
The POS SHALL allow color, defects, notes, and item or bag identifiers to be recorded during intake without requiring free-text service names.

#### Scenario: Damaged garment is received
- **WHEN** staff records a visible defect while receiving a garment
- **THEN** the defect and optional note are saved with the service item and shown on the ticket

### Requirement: Price overrides are privileged
Only Manager or Owner roles SHALL override an effective standard price, and the API SHALL require a reason and audit both values.

#### Scenario: Cashier edits a unit amount
- **WHEN** a Cashier submits a charged unit amount different from the effective standard price
- **THEN** the API rejects the item change

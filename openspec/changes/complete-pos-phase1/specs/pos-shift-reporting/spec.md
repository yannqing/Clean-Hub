## ADDED Requirements

### Requirement: Staff shifts are persisted by branch and terminal
Clock-in, breaks, clock-out, opening float, and closing float SHALL be stored server-side with tenant, branch, user, and terminal identity.

#### Scenario: Cashier clocks in
- **WHEN** a Cashier clocks in on an enrolled terminal with no open shift
- **THEN** the API creates one open shift for that user, branch, and terminal

### Requirement: Handover closes the outgoing shift atomically
A handover SHALL record incoming staff, counted cash, outstanding work, notes, and calculated variance while closing the outgoing shift in one transaction.

#### Scenario: Handover succeeds
- **WHEN** outgoing and incoming staff are valid for the same branch and counted cash is submitted
- **THEN** the outgoing shift closes, the handover is stored, and a Z Report snapshot is created at one cutoff time

### Requirement: Z Report is an immutable snapshot
The system SHALL create an immutable Z Report containing order counts, gross sales, discounts, payments by method, refunds, corrections, expected cash, counted cash, variance, outstanding orders, and the report cutoff.

#### Scenario: Historical report is viewed after later transactions
- **WHEN** transactions occur after a Z Report cutoff
- **THEN** the historical report values remain unchanged and later transactions belong to a later shift or report

### Requirement: Shift reporting is branch-isolated
Users SHALL only view or create shifts, handovers, and Z Reports for branches allowed by both their role assignment and terminal binding.

#### Scenario: Manager requests another branch report
- **WHEN** a Manager requests a Z Report for an unassigned branch
- **THEN** the API returns forbidden without exposing report totals

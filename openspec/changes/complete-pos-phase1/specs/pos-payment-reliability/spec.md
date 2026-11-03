## ADDED Requirements

### Requirement: Every payment intent is idempotent
The POS client SHALL submit a unique idempotency key for cash and mobile payment intents, and the API SHALL atomically return the existing transaction for repeated keys without incrementing paid totals again.

#### Scenario: Cash payment is retried
- **WHEN** the same cash payment request is submitted twice with one idempotency key
- **THEN** exactly one payment transaction is stored and the order paid amount changes once

### Requirement: Gateway references are unique
The database SHALL prevent two active payment transactions in one tenant from sharing the same non-empty gateway and external reference.

#### Scenario: Concurrent mobile confirmations share a reference
- **WHEN** two requests attempt to confirm payments using the same gateway reference
- **THEN** one transaction succeeds and the other resolves to the existing transaction or returns a conflict without duplicate accounting

### Requirement: Refunds and payment corrections are controlled
Manager and Owner roles SHALL be able to create auditable refund or payment-correction records with a reason, while Cashier SHALL be denied.

#### Scenario: Manager records a refund
- **WHEN** a Manager submits a valid refund for a paid order with a reason
- **THEN** the system stores a linked refund transaction, updates derived balances, and preserves the original payment record

### Requirement: Payment totals are derived from immutable transactions
Order and Z Report payment totals SHALL be derived from successful payment, refund, and correction transactions rather than mutable client totals.

#### Scenario: Refunded order appears in report
- **WHEN** a paid order is partially refunded during a shift
- **THEN** the Z Report shows gross payment, refund, and net payment separately

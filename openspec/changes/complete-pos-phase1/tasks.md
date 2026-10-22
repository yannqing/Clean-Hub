## 1. Authorization and Terminal Security

- [x] 1.1 Add centralized POS role, sensitive-operation, and explicit branch-access helpers with unit or smoke coverage
- [x] 1.2 Apply server-side role and reason checks to order, ticket, customer, item-price, refund, reprint, and drawer-sensitive operations
- [x] 1.3 Make list, search, statistics, detail, and mutation branch scoping consistent for Owner, Manager, and Cashier
- [x] 1.4 Extend terminal settings schema and repository for credential digest, rotation, last-seen, and audit metadata without generating a migration yet
- [x] 1.5 Implement privileged terminal enrollment, lookup, lock, rebind, and credential rotation endpoints
- [x] 1.6 Require active enrolled terminal credentials for PIN login and bind authenticated POS context to the terminal branch
- [x] 1.7 Add API Client and POS UI handling for enrollment-required, terminal-disabled, and permission-denied states
- [x] 1.8 Add regression coverage for Cashier denial, empty branch assignments, cross-branch access, terminal enrollment, and lockout persistence

## 2. Payment Reliability and Order Identity

- [x] 2.1 Require idempotency keys for every POS payment request and generate stable keys in the POS client workflow
- [x] 2.2 Make cash and mobile payment creation transactionally idempotent and return existing transactions on retries
- [x] 2.3 Add tenant-scoped gateway/external-reference uniqueness to the payment schema without generating a migration yet
- [x] 2.4 Implement Manager/Owner refund and payment-correction API methods with reasons, immutable linked transactions, and audit events
- [x] 2.5 Add API Client and POS order-detail controls for refund/payment correction with Cashier denial
- [x] 2.6 Centralize the `OD-<suffix>` display-code contract and make list/global search resolve displayed codes safely
- [x] 2.7 Add payment retry, concurrent reference, refund authorization, and display-code search regression coverage

## 3. Service Catalog and Controlled Pricing

- [x] 3.1 Add a branch-scoped, Cashier-readable POS service catalog and effective-price endpoint
- [x] 3.2 Add typed API Client methods and POS queries for service catalog and effective prices
- [x] 3.3 Extend POS item DTOs and validation for service reference, pricing unit, standard-price snapshot, quantity/weight/bags, color, defects, and override reason
- [x] 3.4 Enforce catalog prices for Cashier and reasoned Manager/Owner overrides in order and ticket services
- [x] 3.5 Replace free-text order and ticket item entry with catalog selection and unit-aware intake controls
- [x] 3.6 Display standard versus overridden price and garment intake details on order, ticket, and print views
- [x] 3.7 Add catalog filtering, weight/bag calculation, and price-override authorization coverage

## 4. Offline and Hardware Operations

- [x] 4.1 Add browser and Desktop storage adapters that partition offline queues by tenant, branch, and terminal
- [x] 4.2 Queue eligible customer, order, and status writes with stable ULIDs/idempotency keys and replay them through API Client methods
- [x] 4.3 Replace the static POS sync badge with online, pending, replaying, and blocking-error state plus retry controls
- [x] 4.4 Implement a typed Electron preload bridge for secure terminal credentials, scanner events, printing, and cash-drawer commands
- [x] 4.5 Implement main-process hardware adapters and capability discovery using `packages/hardware`
- [x] 4.6 Complete scan navigation, receipt/label print jobs, retries, and authorized manual drawer opening in POS Web
- [x] 4.7 Add offline queue isolation/replay tests, hardware adapter tests, and supported-device failure-state tests

## 5. Shift Handover and Z Report

- [x] 5.1 Add ULID-based shift, handover, Z Report, and correction-event schemas with tenant/branch/device fields without generating a migration yet
- [x] 5.2 Implement branch-scoped staff listing and shift clock/break operations
- [x] 5.3 Implement atomic handover that closes the outgoing shift and creates an immutable Z Report snapshot
- [x] 5.4 Include gross sales, discounts, payments by method, refunds, corrections, expected/count cash, variance, and outstanding orders in report calculations
- [x] 5.5 Add API Client methods and replace localStorage-only handover with server-backed shift and report views
- [x] 5.6 Add shift concurrency, cutoff immutability, variance, and cross-branch authorization coverage

## 6. Database Migration and Integrated Verification

- [x] 6.1 Generate one consolidated Drizzle migration after terminal, payment, and shift schemas are complete and inspect SQL for duplicate-data preconditions
- [x] 6.2 Run database migration checks and `@cleanhub/db` typecheck
- [x] 6.3 Run focused typecheck, lint, tests, and builds for API Client, API, POS Web, Desktop, offline, and hardware workspaces
- [ ] 6.4 Exercise enrolled PIN login, catalog order, cash/mobile payment retry, refund, offline replay, scan/print, handover, and Z Report end-to-end

## 7. QA and Delivery Documentation

- [x] 7.1 Document the supported terminal enrollment and recovery procedure
- [x] 7.2 Add Phase 1 POS UAT cases for RBAC, branch isolation, payment idempotency, offline recovery, hardware failure, and shift close
- [x] 7.3 Record supported printer/scanner/drawer models and pilot rollout/rollback steps
- [x] 7.4 Reconcile implementation against all six capability specs and capture remaining limitations explicitly

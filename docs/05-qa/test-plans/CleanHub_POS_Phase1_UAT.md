# CleanHub POS Phase 1 UAT

## 1. Scope

This plan validates the `complete-pos-phase1` change for a single-store pilot and covers POS Web, Desktop, API, database constraints, offline replay, supported hardware, and shift close. A case passes only when the user-visible result, API result, database state, and required audit event agree.

## 2. Preconditions

- One tenant with two branches: Branch A and Branch B.
- Active Owner, Manager, and Cashier accounts; one Manager with no assigned branches.
- One enrolled active terminal for Branch A, one disabled terminal, and one unregistered browser.
- Active per-item and per-kg services with effective prices.
- A configured supported printer/scanner pair and a run without hardware for failure-state checks.
- Database access for verifying transaction counts, idempotency, audit metadata, shifts, handovers, and Z Reports.

## 3. Authorization And Isolation

| ID | Case | Expected result | Evidence |
| --- | --- | --- | --- |
| POS-RBAC-001 | Cashier calls order, ticket, customer, and item DELETE endpoints | Every request is forbidden; no record changes | API response, database snapshot |
| POS-RBAC-002 | Cashier submits a price different from the effective catalog price | Request is forbidden; standard price remains | API response, order item row |
| POS-RBAC-003 | Manager performs a supported override with a reason | Operation succeeds and audit includes before/after, reason, user, terminal, and branch | Audit row |
| POS-RBAC-004 | Manager repeats a sensitive operation without a reason | Validation fails before mutation | API response, unchanged version |
| POS-BRANCH-001 | Manager with `branchIds=[]` requests list, search, statistics, detail, and mutation endpoints | No tenant-wide data is returned and writes are forbidden | Responses for every endpoint class |
| POS-BRANCH-002 | Branch A terminal requests a Branch B record using a user assigned to both branches | Request is forbidden by terminal branch binding | API response, audit/security event |

## 4. Terminal Security

| ID | Case | Expected result | Evidence |
| --- | --- | --- | --- |
| POS-TERM-001 | Unregistered browser attempts a valid staff PIN | Login is rejected without revealing PIN or staff validity | Generic auth response, security event |
| POS-TERM-002 | Disabled enrolled terminal attempts a valid PIN | Login is forbidden | Auth response, terminal status |
| POS-TERM-003 | Clear browser local storage after repeated PIN failures | Existing terminal/network lock remains effective | Rate-limit state, auth response |
| POS-TERM-004 | Manager enrolls and then rotates a terminal credential | Old credential stops working; new credential works; only digest is stored | Database row, audit events |

## 5. Catalog And Pricing

| ID | Case | Expected result | Evidence |
| --- | --- | --- | --- |
| POS-CAT-001 | Cashier opens service selection | Only active tenant services and effective prices are returned | UI capture, API payload |
| POS-CAT-002 | Add a per-item service with quantity 3 | Total equals standard unit price multiplied by 3 | Saved item and order total |
| POS-CAT-003 | Add a per-kg service with weight and bag count | Charge uses weight; bag count remains available operationally | Ticket/order detail |
| POS-CAT-004 | Record color, defect, and note during intake | Details persist and appear on the ticket/label view | UI and database row |

## 6. Payments

| ID | Case | Expected result | Evidence |
| --- | --- | --- | --- |
| POS-PAY-001 | Submit the same cash request twice with one idempotency key | One transaction exists and paid total increments once | Transaction count, order balance |
| POS-PAY-002 | Confirm the same gateway reference concurrently | One active transaction owns the reference; no duplicate accounting | Unique constraint/result rows |
| POS-PAY-003 | Manager partially refunds a paid order with a reason | Linked refund is stored; gross, refund, and net remain separately derivable | Payment/refund rows, audit |
| POS-PAY-004 | Cashier attempts refund or correction | Request is forbidden | API response, no new transaction |

## 7. Offline And Hardware

| ID | Case | Expected result | Evidence |
| --- | --- | --- | --- |
| POS-OFF-001 | Disconnect network and create an eligible order | Stable ULID/idempotency key is queued and shell shows pending | Queue snapshot, UI capture |
| POS-OFF-002 | Restore network with multiple pending writes | Writes replay in order exactly once and pending count reaches zero | API rows, queue snapshot |
| POS-OFF-003 | First queued write fails permanently | Replay stops at the failure and UI exposes error/retry; later writes stay pending | UI capture, queue order |
| POS-OFF-004 | Switch tenant/branch with pending writes | Other scope cannot view or replay the queue | Storage keys, API traffic |
| POS-HW-001 | Scan valid ticket and order labels | Matching detail opens; ambiguous or unknown codes do not select an arbitrary record | Screen recording, API response |
| POS-HW-002 | Print one label, then retry after a printer failure | Job status and error are visible; retry does not duplicate success audit | Print jobs/audit |
| POS-HW-003 | Cashier attempts manual drawer open | Action is forbidden | API/Desktop response |

## 8. Shift And Z Report

| ID | Case | Expected result | Evidence |
| --- | --- | --- | --- |
| POS-SHIFT-001 | Cashier clocks in twice concurrently | Exactly one open shift exists | Shift rows, API responses |
| POS-SHIFT-002 | Complete handover with counted cash | Outgoing shift closes and handover/Z Report share one cutoff | Related rows and timestamps |
| POS-SHIFT-003 | Compare report to payments, refunds, discounts, and corrections | Gross, refund, net, expected cash, counted cash, and variance reconcile | Reconciliation worksheet |
| POS-SHIFT-004 | Post a transaction after report cutoff | Historical report remains unchanged | Before/after report payload |
| POS-SHIFT-005 | Branch A Manager requests Branch B report | Request is forbidden | API response |

## 9. Exit Criteria

- All P0 cases pass on the actual pilot terminal and database.
- No unresolved Critical or High defects in authorization, branch isolation, terminal security, payment idempotency, offline replay, or shift close.
- POS Web, API, API Client, Desktop, DB, offline, and hardware checks pass from a clean checkout.
- Hardware model, driver, connection mode, and tested firmware are recorded in the delivery acceptance evidence.

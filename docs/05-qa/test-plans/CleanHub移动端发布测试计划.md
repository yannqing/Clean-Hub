# CleanHub Mobile Release Test Plan

## Automated Checks

Run for every mobile release candidate:

```bash
pnpm --filter @cleanhub/mobile-web typecheck
pnpm --filter @cleanhub/mobile-web lint
pnpm --filter @cleanhub/mobile typecheck
pnpm --filter @cleanhub/mobile lint
```

## Required Flow Coverage

The repository does not currently include a mobile component or E2E runner. Until one is added, release owners must cover these flows manually on real devices and record results in the acceptance checklist.

| Flow | Required assertions |
| --- | --- |
| Login | Customer, delivery, and owner sessions can log in and refresh session state. |
| Customer order view | Customer can view active/history order or appointment data scoped to their tenant. |
| Payment entry | Customer can open the payment entry point and see fallback messaging if payment is unavailable. |
| Delivery status | Delivery user can move a task through allowed status transitions. |
| Delivery proof | Camera proof upload/compression path works online and queues safely offline. |
| Signature | Signature capture and sign-off state are preserved after navigation. |
| Printing | Printer connection/print entry points show success or clear fallback when printer support is unavailable. |

## Future Automation Backlog

Add a mobile E2E suite when the repo accepts a browser/device runner. Minimum automated tests should cover:

- Authentication happy path and failed login.
- Customer order/appointment list and payment entry.
- Delivery status update, proof capture fallback, and signature save.
- Printer connection unavailable state and print action validation.
- Forced-update prompt when app version is below minimum supported version.

## Release Decision

Do not release if any required automated check fails, if any core manual flow is blocked, or if camera/location/Bluetooth permission behavior is not recorded for the target platform.

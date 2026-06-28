# CleanHub Mobile Device Acceptance Checklist

Record one checklist per release candidate, platform, device model, OS version, app version, build number, environment, tester, and date.

## Permissions

| Item | Android | iOS | Result |
| --- | --- | --- | --- |
| Camera first-use prompt appears with delivery proof wording. |  |  |  |
| Camera denial shows recoverable guidance. |  |  |  |
| Location first-use prompt appears during active delivery action. |  |  |  |
| Location denial keeps the task usable with clear fallback. |  |  |  |
| Bluetooth prompt appears before printer discovery or connection. |  |  |  |
| Bluetooth denial shows retry/settings guidance. |  |  |  |

## Core Flows

| Flow | Expected result | Result |
| --- | --- | --- |
| Customer login | Customer enters the customer workspace for the selected tenant only. |  |
| Customer order view | Active/history orders or appointments render without cross-tenant data. |  |
| Payment entry | Payment screen or unavailable fallback opens from a customer order. |  |
| Delivery login | Delivery account enters assigned task list. |  |
| Delivery status | Pickup/in-progress/delivered transitions save online. |  |
| Offline delivery queue | Offline status/proof action queues and syncs after reconnect. |  |
| Camera proof | Image proof captures, compresses, uploads or queues. |  |
| Signature | Signature is captured and attached to sign-off action. |  |
| Portable print | Printer discovery/connection/print succeeds on supported device or shows fallback. |  |
| Forced update | Build below minimum supported version blocks usage and opens update URL. |  |

## Exit Criteria

All permission rows and core flows must be passed or explicitly waived by the release owner. Waivers must include risk, customer impact, and rollback plan.

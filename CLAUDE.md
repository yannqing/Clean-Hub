# CLAUDE.md

This file gives Claude Code project-specific context and development instructions.

## Project Summary

CleanHub is a multi-tenant SaaS platform for laundry, pressing, dry cleaning, car wash, POS, hardware integration, offline-first operations, local payments, and multi-store management.

The repo is a Turborepo + pnpm monorepo. It includes separate apps for SaaS admin, POS web, desktop shell, mobile shell, and API service, plus shared packages for domain logic, UI, database, offline sync, hardware abstraction, and i18n.

## Core Commands

Install dependencies:

```bash
pnpm install
```

Add a dependency to one workspace:

```bash
pnpm --filter @cleanhub/web-admin add <package>
pnpm --filter @cleanhub/web-admin add -D <package>
```

Do not add app/package-specific dependencies to the root `package.json`. Root dependencies should be repo-level tools only.

Run all apps:

```bash
pnpm dev
```

Run one app:

```bash
pnpm --filter @cleanhub/web-admin dev
pnpm --filter @cleanhub/pos-web dev
pnpm --filter @cleanhub/api dev
pnpm --filter @cleanhub/desktop dev
pnpm --filter @cleanhub/mobile dev
```

Run the normal local web-admin stack:

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm --filter @cleanhub/api dev
pnpm --filter @cleanhub/web-admin dev
```

Build all:

```bash
pnpm build
```

Typecheck all:

```bash
pnpm typecheck
```

Lint all:

```bash
pnpm lint
```

## Apps

- `apps/web-admin`: Next.js admin app for SaaS admin and tenant back office.
- `apps/pos-web`: Next.js POS frontend for in-store staff workflows. This should remain fast, offline-friendly, and optimized for cashier/scanner/printing usage.
- `apps/desktop`: Electron shell for the official Windows/macOS in-store POS runtime and local hardware integration.
- `apps/mobile`: Capacitor shell for customer-facing and delivery-facing Android/iOS workflows. Do not treat it as the default mobile cashier POS. It loads the static export of `apps/mobile-web`.
- `apps/mobile-web`: Next.js customer/delivery web UI loaded by `apps/mobile`. It is a client-rendered SPA with no route-guard proxy; authentication is enforced by `apps/api`. The session lives in Capacitor Preferences, which is native storage on a device. Do not serve this app as a website: in a browser Preferences resolves to `localStorage`, which does not meet the HttpOnly cookie rule the web apps follow.
- `apps/pos-mobile`: the Android and iOS POS, whose two platforms are built
  differently. **Android is a native Jetpack Compose app**, not a WebView:
  `MainActivity` is a plain `ComponentActivity` that starts `NativePosApp`, and
  the whole POS lives in
  `android/app/src/main/kotlin/com/cleanhub/pos/nativepos/` with its own API
  client, SQLite store, offline replay queue and hardware bridge. Its API origin
  is compiled into `BuildConfig.CLEANHUB_POS_API_BASE_URL`, and
  `CLEANHUB_POS_NATIVE_ANDROID=true` drops Capacitor's `server` field for a
  native package. **iOS is still a Capacitor shell** around the server-rendered
  `apps/pos-web`. See "Native Android POS" below before changing POS business
  rules.
- `apps/api`: standalone backend API service.

## Shared Packages

- `packages/ui`: shared UI primitives and shared web components.
- `packages/domain`: shared domain constants and rules.
- `packages/id`: shared ULID generation and validation helpers.
- `packages/db`: Drizzle/PostgreSQL schema.
- `packages/api-client`: shared API client.
- `packages/i18n`: multilingual copy and i18n helpers.
- `packages/offline`: offline sync primitives.
- `packages/hardware`: hardware abstractions for printers, scanners, and cash drawers.
- `packages/config`: shared TypeScript config.
- `packages/logger`: shared server-side logger based on Pino.

## Documentation Map

- Root README: `README.md`
- Chinese README: `README.zh-CN.md`
- Documentation index: `docs/README.md`
- Product PRD: `docs/01-product/prd/Clean_Hub-prd-v0.1.md`
- Phase 1 scope and acceptance: `docs/01-product/phase-scope/Clean_Hub-Phase_1范围与验收标准.md`
- Process guide: `docs/00-overview/项目开发流程与文档交付指南.md`
- API client guide: `docs/04-technical/api/Clean_Hub-API_Client使用说明.md`
- Database migration guide: `docs/04-technical/database/Clean_Hub-Drizzle数据库迁移操作详解.md`

## Architectural Notes

- `web-admin` and `pos-web` are separate Next.js apps.
- `pos-web` is the in-store staff POS UI. It can run in a browser for development, but the store cashier entry point should normally be the desktop shell.
- `desktop` owns Windows/macOS local hardware integration, including printing, scanners, cash drawer, local storage, offline sync runtime, and local device capabilities.
- `mobile` owns customer-facing and delivery-facing Android/iOS capabilities such as appointment booking, order status, pickup/delivery tracking, proof photos, GPS, Bluetooth portable printing, and push-style mobile workflows.
- Customer-facing mobile UI lives in `apps/mobile-web`, which `apps/mobile` loads; keep it there rather than growing it inside the shell.
- `apps/api` should own backend business APIs, payment webhooks, sync queues, audit logic, and third-party integrations.
- Avoid placing all backend business logic in Next.js route handlers.
- Use `@cleanhub/logger` for server-side logs. Do not add ad hoc file logging from business code.

## Auth And Route Guard

`web-admin` uses access token + refresh token stored in HttpOnly cookies.

Rules:

- Frontend JavaScript must not read tokens directly.
- Frontend API calls should rely on cookies with `credentials: "include"`.
- `apps/web-admin/src/proxy.ts` owns route guarding for `/`, `/login`, `/api-health`, `/saas/**`, and `/tenant/**`.
- Anonymous users should be redirected to `/login?next=<path>`.
- SaaS roles should only enter `/saas`; tenant roles should only enter `/tenant`.
- Refresh token handling should go through backend auth endpoints.
- Logout should call the backend logout endpoint so the API clears auth cookies.

## Mobile Payment Model

Customers do not pay through `apps/mobile` / `apps/mobile-web`. Staff collect
payment at the counter through the POS, which is the only path that moves real
money. The customer app is read-only about payment: it shows total, paid amount
and payment status, and tells the customer to settle at the counter.

Do not re-add a customer-facing payment entry point until a real PSP is
integrated. `apps/api/src/modules/mobile/payment` still has only
`MockPaymentGateway`, and `readGateway()` returns `"mock"` on every branch, so
any "is this the mock gateway?" guard is always true.

Customer-facing refund requests are unaffected and still supported.

## Native Android POS

`apps/pos-mobile` on Android does not run `apps/pos-web`. It is a separate
implementation of the same POS in Kotlin, roughly 10k lines under
`android/app/src/main/kotlin/com/cleanhub/pos/nativepos/`:

- `NativePosApp.kt` — the entire UI and its view-model logic
- `NativePosDatabase.kt` — local SQLite: catalog cache, cart, offline queue
- `NativePosSync.kt` — snapshot refresh and offline checkout replay
- `NativePosHardware.kt` — T1101 printer, scanner and cash drawer
- `NativePosApiClient.kt` / `NativePosSession.kt` — transport and credentials
- `NativePosStrings.kt` — every cashier-facing string, in zh-CN, en and fr

**All user-facing copy lives in `NativePosStrings.kt`.** Do not write a
display string inline; add a key and its three translations, then read it
through `copy.<key>`. Two rules follow from how that file is built:

- It is a **map**, not a data class with one parameter per string. A data
  class stops loading past roughly 254 parameters
  (`ClassFormatError: Too many arguments in method signature`), which
  compiles cleanly and only fails on a running terminal. `NativePosCopyTest`
  enforces what the compiler no longer can: same keys in all three
  languages, every accessor resolving, matching `%s`/`%d` placeholders.
- Classes built once and kept — `NativePosHardware`, `NativePosDatabase`,
  `NativePosApiClient` — take a **language supplier** (`() -> String?`),
  not a fixed language. The operator can switch language during setup or at
  the PIN screen; an explicit device choice takes precedence over the SaaS
  tenant default received at login. A handover must change the printer's
  error text too.

The API localises the errors it raises for POS and auth paths, so a
server-supplied message arrives in the terminal's language. The POS sends
`Accept-Language` on every request from `session.pinLanguageCode()`; the
catalogue is `apps/api/src/http/error-messages.ts`, keyed by the **English
message text**, not by the error code. When adding or rewording an error
message on a POS or auth path, add its `fr`/`zh-CN` translations there —
`pnpm --filter @cleanhub/api smoke:error-messages` names any message that
has drifted. Back-office modules keep English messages.

**Server business rules are duplicated here.** Changing any of these in
`apps/api` or `packages/domain` without changing the Kotlin lets the two drift
apart silently, and no test catches it:

- ticket and ticket-item state machines — `TICKET_STATUS_TRANSITIONS` and
  `TICKET_ITEM_STATUS_TRANSITIONS` mirror
  `pos/service-tickets/service-tickets.state-machine.ts`
- offline pricing, tax and rounding — `calculateNativeLocalPricing` mirrors
  `pos/orders/orders.financial.ts`
- currency minor units — the native code currently special-cases XOF/XAF only,
  while `packages/domain/src/currency.ts` lists sixteen zero-decimal currencies

Rules that must hold when touching the offline path:

- Money is `Long` minor units or `BigDecimal`. Never `Double`.
- A request that can be retried carries an idempotency key that survives the
  retry. Queued checkouts use a deterministic `"$orderId:cash"`; an online
  payment holds its key until the payment lands (`NativePaymentIdempotency`).
- Queued sales are independent of each other. One rejected sale must not stop
  the rest of the queue replaying.
- A replay is bounded by `NATIVE_REPLAY_MAX_ATTEMPTS`, matching
  `OFFLINE_QUEUE_MAX_ATTEMPTS` in `packages/offline`.
- Transport failures reach callers as `NativePosApiException` with status 0.
  `NativePosApiClient` wraps `IOException` for this: the replay loop classifies
  by status, and a raw `IOException` would slip past it.
- Offline work is stamped with `NativeServerClock.now()`, not the device clock.
  The server rejects cash payments dated more than five minutes ahead, so a fast
  tablet clock would write sales that can never be uploaded.
- Offline PINs are per user id (`NativeOfflinePinRoster` bounds the roster).
  One slot for the device locks the outgoing cashier out after a handover.
- The idle lock is enforced by the app (`NativeIdleLock`), and
  `lockTimeoutSeconds` is cached with the checkout settings so it still works
  offline.

Android unit tests live in `android/app/src/test` and run with:

```bash
cd apps/pos-mobile/android && ./gradlew :app:testDebugUnitTest
```

## Mobile Release Builds

Both mobile shells validate their own release configuration and refuse to build
an unsafe artifact.

```bash
pnpm --filter @cleanhub/mobile release:validate
pnpm --filter @cleanhub/pos-mobile release:validate
```

For `apps/mobile`, a release build requires real values; the defaults are
development placeholders and will be rejected:

```bash
CLEANHUB_MOBILE_ENV=prod
CLEANHUB_MOBILE_API_BASE_URL=https://<real-api-host>
CLEANHUB_MOBILE_UPDATE_URL=https://<real-update-host>
```

Android signing is supplied through `CLEANHUB_ANDROID_KEYSTORE_PATH`,
`CLEANHUB_ANDROID_KEYSTORE_PASSWORD`, `CLEANHUB_ANDROID_KEY_ALIAS` and
`CLEANHUB_ANDROID_KEY_PASSWORD`. Never commit a keystore or its passwords.
A release build without them now fails at Gradle configuration time rather
than producing an uninstallable unsigned APK.

The POS APK is published by `.github/workflows/release-pos-apk.yml` — push a
`pos-v*` tag or run it from the Actions tab. It signs from repository secrets
and verifies the artifact (signature, not debuggable, cleartext disabled, API
origin actually compiled in) before publishing a GitHub Release. The runbook,
including the one-time keystore and secret setup, is
`docs/06-delivery/rollout/CleanHub_POS安卓APK发布操作手册.md`.

An Android-only package does not need `CLEANHUB_POS_SERVER_URL`: that origin
is the iOS WebView's, and `capacitor.config.ts` drops it when
`CLEANHUB_POS_NATIVE_ANDROID=true`. Requiring it used to fail Android
releases for a value nothing reads.

Backups stay disabled on both Android apps. The session lives in Capacitor
Preferences, which is backed by `SharedPreferences`, so enabling backup would
sync auth tokens to the user's cloud account.

## High-Risk Product Areas

Be extra careful around:

- Multi-tenant isolation.
- Branch-level data visibility.
- POS speed and offline usability.
- Payment state, refunds, duplicate callbacks, and idempotency.
- Printing, labels, scanners, cash drawer, and hardware failures.
- Offline sync, device identity, conflict handling, soft deletion, and versioning.
- Audit logs for sensitive actions.

## Data Rules

For business data, assume:

- Tenant-scoped records need `tenant_id`.
- Branch-scoped records need `branch_id`.
- Audited records need created/updated user metadata.
- All business entity IDs must be ULID strings generated through `@cleanhub/id`.
- Database ID columns should be `varchar(26)` through `packages/db/src/schema/id.ts`; do not add auto-increment IDs or PostgreSQL `uuid` primary keys.
- Offline-capable records need ULID primary keys, stable device IDs, version/sync metadata, and soft deletion.
- High-risk actions need idempotency keys, especially payments, refunds, inventory movement, delivery confirmation, and sync operations.

## Development Guidelines

- Use existing repo patterns before adding new abstractions.
- Keep shared business logic in packages where multiple apps need it.
- Keep changes scoped to the user request.
- Do not revert unrelated changes.
- Do not introduce broad refactors unless needed for the task.
- Update documentation when changing project structure, commands, or developer workflows.

## API Client Rules

`packages/api-client` is the shared client for requests from frontend apps to `apps/api`.

Use this layering:

```text
page/component
  -> features/**/queries or features/**/actions
    -> apps/<app>/src/lib/api-client.ts
      -> packages/api-client
        -> apps/api
```

Rules:

- Put shared request behavior, typed API methods, error types, timeout, retry, cookie handling, and auth refresh hooks in `packages/api-client`.
- Organize API methods and DTO types by domain/resource, for example `src/saas/tenants.ts` and `src/saas/tenants.types.ts`; do not grow large catch-all client files.
- Keep app-specific environment wiring in `apps/<app>/src/lib/api-client.ts`.
- Do not scatter raw `fetch` calls through pages or feature modules unless there is a clear exception.
- Do not import Next.js APIs such as `redirect()` or `revalidatePath()` inside `packages/api-client`.
- When adding an API endpoint, update `packages/api-client` first, then call it from feature queries/actions.
- API client documentation: `docs/04-technical/api/Clean_Hub-API_Client使用说明.md`.

When adding a backend-backed frontend feature, use this flow:

```text
apps/api route/controller/service/repository/type
  -> packages/api-client typed method and DTOs
    -> apps/<app>/src/features/**/queries or actions
      -> app page/component
```

## Shared UI Package Rules

`packages/ui/src/components/ui` is the shadcn/ui generated component area. Treat files in this directory as vendor-style generated primitives.

Do not manually edit any file under:

```text
packages/ui/src/components/ui/
```

If a shadcn/ui primitive must be added or regenerated, use the shadcn CLI and keep the generated result close to the upstream pattern. Do not customize business behavior directly inside `components/ui`.

Place custom shared components outside `components/ui`, grouped by responsibility:

```text
packages/ui/src/components/layout/
packages/ui/src/components/forms/
packages/ui/src/components/data-display/
packages/ui/src/components/feedback/
```

Use this rule:

- shadcn/ui primitives go in `packages/ui/src/components/ui`.
- Company-level reusable web components go in other folders under `packages/ui/src/components`.
- App-specific shared components go in `apps/<app>/src/components`.
- Business-module components go in `apps/<app>/src/features/**/components`.
- Do not put CleanHub business logic into `packages/ui`.

## Frontend Organization Guidelines

For Next.js apps, use `features` as a business-module organization layer. It should complement, not replace, global folders like `components`, `lib`, `hooks`, `types`, `config`, and `services`.

Directory responsibilities:

- `app/`: route groups, layouts, pages, loading/error files, and route-level composition.
- `features/`: module-owned business logic and module-specific UI.
- `components/`: shared UI components used across multiple modules.
- `hooks/`: shared React hooks.
- `lib/`: shared utilities such as API client, auth helpers, permissions, session, and formatting.
- `services/`: shared service wrappers or reusable API access layers.
- `types/`: global/shared types.
- `config/`: navigation, routes, feature flags, and app config.

Feature modules can contain `.ts` and `.tsx` files. To keep them readable, put module-specific React components in `components/` inside the feature.

Recommended feature shape:

```text
src/features/saas/tenants/
  components/
    tenant-form.tsx
    tenant-table.tsx
    tenant-status-badge.tsx
  actions.ts
  queries.ts
  validators.ts
  types.ts
  constants.ts
```

For `apps/web-admin`, prefer the directory shape for actions, queries, and validators. This is the default for team development:

```text
src/features/saas/tenants/
  components/
    tenant-form.tsx
    tenant-table.tsx
    tenant-status-badge.tsx
  actions/
    create-tenant.action.ts
    update-tenant.action.ts
    suspend-tenant.action.ts
    index.ts
  queries/
    get-tenant-list.query.ts
    get-tenant-detail.query.ts
    index.ts
  validators/
    tenant-form.validator.ts
  types.ts
  constants.ts
```

Rules:

- Put module-specific components in `features/**/components`.
- Put reusable cross-module UI in `src/components`.
- Keep core backend business rules in `apps/api`; Next.js Server Actions should mainly adapt form submissions, call APIs, handle redirects, and trigger revalidation.
- Put Server Actions in `features/**/actions/` once a module has more than one operation.
- Put server-side read helpers in `features/**/queries/`.
- Put form/input validation in `features/**/validators/`.
- Single-file `actions.ts`, `queries.ts`, or `validators.ts` are acceptable only for tiny modules that are unlikely to grow.
- Do not confuse `validators.ts` with database schema. Database schema belongs in `packages/db` or `src/db/schema`.

## Verification

For app-specific changes, prefer narrow checks:

```bash
pnpm --filter <workspace-name> typecheck
pnpm --filter <workspace-name> lint
pnpm --filter <workspace-name> build
```

For broad changes:

```bash
pnpm typecheck
pnpm build
```

For database schema changes, also run:

```bash
pnpm db:generate
pnpm db:migrate
pnpm --filter @cleanhub/db typecheck
```

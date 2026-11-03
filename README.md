# CleanHub

CleanHub is a multi-tenant SaaS platform for laundry, pressing, dry cleaning, car wash, POS, hardware integration, offline-first operations, local payments, and multi-store management.

This repository is a Turborepo + pnpm monorepo. It contains separate apps for admin, POS, desktop, mobile, and API services, plus shared packages for domain logic, UI, database, offline sync, hardware abstraction, and i18n.

Chinese documentation is available in [README.zh-CN.md](./README.zh-CN.md).

## Tech Stack

- Package manager: `pnpm`
- Monorepo orchestration: `Turborepo`
- Web framework: `Next.js`
- UI styling: `Tailwind CSS`
- Desktop shell: `Electron`
- Mobile shell: `Capacitor`
- API: standalone TypeScript service
- Database layer: `Drizzle ORM` + PostgreSQL
- ID strategy: ULID via `@cleanhub/id`
- Logging: `@cleanhub/logger` backed by Pino
- Language: TypeScript

## Requirements

- Node.js `>=20`
- pnpm `>=10`

## Install

```bash
pnpm install
```

## Local Quick Start

For a normal local `web-admin + api + PostgreSQL + MinIO` development session, use this sequence:

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm --filter @cleanhub/api dev
pnpm --filter @cleanhub/web-admin dev
```

Then open:

```text
Web Admin: http://localhost:3000
API health: http://localhost:4000/health
```

Seed test accounts are created by database migrations. Use the accounts documented in the current Phase 1 and auth-related technical notes when testing login flows.

## Dependency Management

Run dependency installation from the repository root:

```bash
pnpm install
```

When adding a dependency for a specific app or package, always use `--filter` so the dependency is written to that workspace's `package.json`:

```bash
pnpm --filter @cleanhub/web-admin add zod
pnpm --filter @cleanhub/db add drizzle-orm
pnpm --filter @cleanhub/ui add sonner
```

For development-only dependencies:

```bash
pnpm --filter @cleanhub/web-admin add -D eslint-plugin-import
```

Only add dependencies to the root `package.json` when they are truly repo-level tools, such as Turborepo, Prettier, TypeScript, or shared build scripts.

When one workspace depends on another workspace package, use the workspace protocol:

```bash
pnpm --filter @cleanhub/web-admin add @cleanhub/ui@workspace:*
```

## Database

CleanHub uses Drizzle ORM with PostgreSQL. Local development can use the root Docker Compose file. The same local stack also starts MinIO for S3-compatible media object storage.

All business entity IDs use ULID strings. Database ID columns are stored as `varchar(26)`, not auto-increment integers and not PostgreSQL `uuid`. Generate IDs through `@cleanhub/id`.

Copy the example environment file first:

```bash
cp .env.example .env
```

Start the local PostgreSQL and MinIO containers:

```bash
pnpm db:up
```

MinIO is available at:

```text
S3 endpoint: http://localhost:9000
Console:     http://localhost:9001
Bucket:      cleanhub-media
```

The default local MinIO credentials are defined in `.env.example`. Production deployments should use a private bucket, strong dedicated access keys, and the same `OBJECT_STORAGE_*` environment variables.

Check container status or logs:

```bash
pnpm db:ps
pnpm db:logs
```

Generate a Drizzle migration after changing schema files in `packages/db/src/schema`:

```bash
pnpm db:generate
```

Apply generated migrations to the configured database:

```bash
pnpm db:migrate
```

Open Drizzle Studio:

```bash
pnpm db:studio
```

For early local prototyping only, `pnpm db:push` can push schema changes directly to the local database without creating migration files. Do not use `db:push` as the normal team workflow once migrations are being reviewed.

Stop the local PostgreSQL and MinIO containers:

```bash
pnpm db:down
```

## Run All Apps

```bash
pnpm dev
```

This runs all workspace `dev` scripts through Turborepo.

## Run One App

Use `pnpm --filter <workspace-name> dev` to start a single project.

### Web Admin

```bash
pnpm --filter @cleanhub/web-admin dev
```

URL:

```text
http://localhost:3000
```

### POS Web

```bash
pnpm --filter @cleanhub/pos-web dev
```

URL:

```text
http://localhost:3001
```

POS Web uses dual-token (access + refresh) authentication shared with Web Admin.
Each installation is enrolled to one tenant and branch at runtime; there is no
build-time tenant code. On first use, an owner or manager verifies their account,
selects an accessible branch, and names the terminal. The administrator session
is then cleared while the HttpOnly terminal credential remains, allowing staff
to sign in with a PIN.

Seed cashier accounts (requires `pnpm db:up` + `pnpm db:migrate` first):

```bash
pnpm db:seed
```

Sign-in credentials:

```text
Setup:    tenant.admin1@cleanhub.local / 123456
Email:    pos.cashier1@cleanhub.local   (also cashier2 / cashier3 / cashier4)
Password: 123456
PIN:      cashier1=111111, cashier2=222222, cashier3=333333, cashier4=444444
```

Select the POS development profile before starting the servers. For local
browser development, run:

```bash
pnpm pos:config:local
```

For Android/iPad development over the local network, run:

```bash
pnpm pos:config:lan
```

LAN mode detects the current private IPv4 address and updates the POS Web API
URL, Next.js development origin, API CORS origin, and Capacitor server URL as
one profile. Override the detected interface when necessary:

```bash
pnpm pos:config:lan -- --host 192.168.2.106
```

Run `pnpm pos:config` to inspect the active profile. Restart the API and POS
Web after switching; LAN mode also requires another Capacitor sync/install.

### API

```bash
pnpm --filter @cleanhub/api dev
```

Default URL:

```text
http://localhost:4000
```

### Desktop

```bash
pnpm --filter @cleanhub/desktop dev
```

The desktop app is currently an Electron shell placeholder. Full Electron launch and hardware integration will be implemented later.

### Mobile

Start the mobile web dev server:

```bash
pnpm --filter @cleanhub/mobile-web dev
```

Open the native Android project:

```bash
pnpm --filter @cleanhub/mobile dev
```

This command runs `cap open android`, so Android Studio must be installed and discoverable. If Capacitor cannot find it on Windows, set `CAPACITOR_ANDROID_STUDIO_PATH` to your `studio64.exe`, for example:

```powershell
$env:CAPACITOR_ANDROID_STUDIO_PATH = "C:\Program Files\Android\Android Studio\bin\studio64.exe"
pnpm --filter @cleanhub/mobile dev
```

For a permanent user-level setting:

```powershell
[Environment]::SetEnvironmentVariable("CAPACITOR_ANDROID_STUDIO_PATH", "C:\Program Files\Android\Android Studio\bin\studio64.exe", "User")
```

The mobile app is a Capacitor shell that loads the `@cleanhub/mobile-web` Next.js app during development.
Delivery proof photos and customer signatures use object storage: mobile-web requests a short-lived upload ticket from the API, uploads media directly to MinIO/S3, then submits the returned object key to the delivery API.

## Build

Build all workspaces:

```bash
pnpm build
```

Build one workspace:

```bash
pnpm --filter @cleanhub/web-admin build
```

## Typecheck

Typecheck all workspaces:

```bash
pnpm typecheck
```

Typecheck one workspace:

```bash
pnpm --filter @cleanhub/pos-web typecheck
```

## Lint

```bash
pnpm lint
```

## Workspace Structure

### Apps

- `apps/web-admin`: Next.js SaaS/admin/back-office.
- `apps/pos-web`: Next.js POS web app for in-store staff workflows such as intake, cashiering, printing, scanning, and order status updates.
- `apps/desktop`: Electron shell for the official Windows/macOS in-store POS app. It loads the POS UI and owns local hardware, local database, offline sync runtime, auto-update, and window control.
- `apps/mobile`: Capacitor shell for customer-facing and delivery-facing Android/iOS workflows. It is not the primary cashier POS surface.
- `apps/api`: Standalone TypeScript API service for auth, SaaS/Tenant APIs, audit, sync, webhooks, and integrations.

### Packages

- `packages/ui`: shared UI primitives.
- `packages/domain`: business constants and domain rules.
- `packages/id`: shared ULID generation and validation helpers.
- `packages/db`: Drizzle/PostgreSQL schema.
- `packages/api-client`: shared API client for requests from frontend apps to `apps/api`, including typed methods, errors, cookies, timeout, retry, and auth refresh hooks.
- `packages/i18n`: French/English copy placeholder.
- `packages/offline`: offline sync placeholder.
- `packages/hardware`: printer/scanner/cash-drawer abstractions placeholder.
- `packages/config`: shared TypeScript config.
- `packages/logger`: shared server-side logger based on Pino.

## Documentation

Project documentation lives under `docs`.

- `docs/00-overview`: project-level guides and documentation process.
- `docs/01-product`: PRD, phase scope, user flows, permissions, product topics, backlog.
- `docs/02-project-management`: planning, risks, meetings, status reports.
- `docs/03-design`: information architecture, wireframes, UI design, prototypes.
- `docs/04-technical`: TRD, architecture, API, database, offline, payments, hardware, deployment.
- `docs/05-qa`: test plans, test cases, UAT, test reports.
- `docs/06-delivery`: rollout, training, support, acceptance.
- `docs/99-archive`: archived documents.

See [docs/README.md](./docs/README.md) for the full documentation structure.

See [Clean_Hub-API_Client使用说明.md](./docs/04-technical/api/Clean_Hub-API_Client使用说明.md) for the API client guide.

## Development Notes

- `web-admin` and `pos-web` are independent Next.js apps.
- `pos-web` is the in-store staff POS UI. It should be optimized for speed, offline operation, keyboard/scanner workflows, and desktop POS usage.
- `desktop` is the official Windows/macOS POS runtime for stores. It should load `pos-web` and handle printers, scanners, cash drawers, local storage, offline sync, auto-update, and native window behavior.
- `mobile` is primarily for customer-facing and delivery-facing workflows such as appointment booking, order status, pickup/delivery tracking, customer notifications, proof photos, GPS, and Bluetooth portable printing.
- Do not treat `mobile` as a default mobile cashier POS unless a future phase explicitly defines that workflow.
- `api` should host backend business APIs, payment webhooks, sync queues, audit logic, and integrations instead of placing all backend logic inside Next.js route handlers.
- Frontend apps should call backend APIs through `packages/api-client`. Each app may keep a thin `src/lib/api-client.ts` adapter, but pages and feature modules should not scatter raw `fetch` calls.

## Terminal Boundaries

Use these boundaries when planning pages, routes, and shared packages:

```text
web-admin
  SaaS Admin and Tenant Admin for platform staff, owners, managers, and back-office users.

pos-web
  In-store staff POS web app. Runs in browser for development and can be loaded by desktop.

desktop
  Windows/macOS POS application shell. This is the normal store cashier entry point.

mobile
  Customer/delivery mobile app shell. It should load customer-facing or delivery-facing mobile web UI, not duplicate the desktop POS by default.
```

If customer mobile UI grows beyond a few routes, prefer introducing a dedicated `apps/customer-web` or `apps/mobile-web` Next.js app and let `apps/mobile` load it through Capacitor.

## Auth And Route Guard

`web-admin` uses an access token + refresh token model stored in HttpOnly cookies.

- Frontend JavaScript must not read tokens directly.
- Browser requests use cookies through `credentials: "include"`.
- `apps/web-admin/src/proxy.ts` protects `/`, `/login`, `/api-health`, `/saas/**`, and `/tenant/**`.
- Anonymous users are redirected to `/login?next=<path>`.
- SaaS roles are routed to `/saas`.
- Tenant roles are routed to `/tenant`.
- If the access token is expired, the route guard attempts refresh before rendering the page.
- Logout must call the backend logout endpoint so auth cookies are cleared by the API.

## API Development Flow

When adding a backend feature for a frontend app, use this order:

```text
apps/api
  -> route/controller/service/repository/type
packages/api-client
  -> request/response types and typed API method
apps/web-admin
  -> features/**/queries or features/**/actions
apps/web-admin
  -> app page or component
```

Rules:

- Put backend business rules in `apps/api`.
- Put shared request methods and DTO types in `packages/api-client`.
- Put app-specific client setup in `apps/<app>/src/lib/api-client.ts`.
- Put module-owned page adaptation in `features/**/queries` or `features/**/actions`.
- Pages and React components should not scatter raw `fetch` calls.

## Logging

Server-side logging should use `@cleanhub/logger`.

- API request and backend business logs should go through the shared logger.
- Do not write ad hoc file logs from business code.
- In Docker or production, logs should be collected from process stdout/stderr by the runtime platform.
- Client-side UI notifications should use UI feedback components such as Sonner, not the server logger.

## Frontend Code Organization

For Next.js apps, use `features` as a business-module organization layer. It does not replace global folders such as `components`, `lib`, `hooks`, `types`, `config`, or `services`.

Recommended responsibilities:

- `app/`: route groups, layouts, pages, loading/error files, and route-level composition.
- `features/`: business-module code and module-specific UI.
- `components/`: shared cross-module UI components.
- `hooks/`: shared React hooks.
- `lib/`: shared utilities such as API client, auth, session, permissions, and formatting.
- `services/`: reusable service wrappers or API access layers.
- `types/`: global/shared TypeScript types.
- `config/`: navigation, routes, feature flags, and app config.

Feature modules may contain both `.ts` and `.tsx` files. Keep module-specific React components under `components/` inside the feature:

```text
src/features/saas/tenants/
  components/
    tenant-form.tsx
    tenant-table.tsx
  actions.ts
  queries.ts
  validators.ts
  types.ts
```

For `web-admin`, the default feature shape is directory-based for actions, queries, and validators. This keeps module growth predictable for a team:

```text
src/features/saas/tenants/
  components/
    tenant-form.tsx
    tenant-table.tsx
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
```

Rules:

- Module-specific components go in `features/**/components`.
- Shared UI components go in `src/components`.
- Core backend business rules belong in `apps/api`; Next.js Server Actions should mainly adapt form submissions, call APIs, handle redirects, and trigger revalidation.
- Prefer `features/**/actions/` for Server Actions when a module has more than one operation.
- Prefer `features/**/queries/` for server-side read helpers.
- Prefer `features/**/validators/` for form/input validation.
- Single-file `actions.ts`, `queries.ts`, or `validators.ts` are allowed only for tiny modules that are unlikely to grow.
- Database schema belongs in `packages/db` or `src/db/schema`, not in feature validators.

## Pre-Commit Checks

Run the narrowest relevant checks before handing off code:

```bash
pnpm --filter @cleanhub/web-admin typecheck
pnpm --filter @cleanhub/web-admin lint
pnpm --filter @cleanhub/web-admin build
```

For API changes:

```bash
pnpm --filter @cleanhub/api typecheck
pnpm --filter @cleanhub/api build
```

For database schema changes:

```bash
pnpm db:generate
pnpm db:migrate
pnpm --filter @cleanhub/db typecheck
```

For shared package or broad monorepo changes:

```bash
pnpm typecheck
pnpm build
```

## License

This project is licensed under the [MIT License](./LICENSE).

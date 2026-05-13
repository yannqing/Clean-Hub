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

For a normal local `web-admin + api + PostgreSQL` development session, use this sequence:

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

CleanHub uses Drizzle ORM with PostgreSQL. Local development can use the root Docker Compose file.

All business entity IDs use ULID strings. Database ID columns are stored as `varchar(26)`, not auto-increment integers and not PostgreSQL `uuid`. Generate IDs through `@cleanhub/id`.

Copy the example environment file first:

```bash
cp .env.example .env
```

Start the local PostgreSQL container:

```bash
pnpm db:up
```

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

Stop the local PostgreSQL container:

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

```bash
pnpm --filter @cleanhub/mobile dev
```

The mobile app is currently a Capacitor shell placeholder. Android/iOS native platforms still need to be added before real mobile development.

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
- `apps/pos-web`: Next.js POS web shell shared by desktop and mobile wrappers.
- `apps/desktop`: Electron shell for Windows/macOS hardware integration.
- `apps/mobile`: Capacitor shell for Android/iOS device APIs.
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
- `pos-web` is intended to be reused by desktop and mobile shells where possible.
- `desktop` is responsible for Windows/macOS local hardware integration.
- `mobile` is responsible for Android/iOS device APIs such as camera, GPS, Bluetooth printing, and mobile workflows.
- `api` should host backend business APIs, payment webhooks, sync queues, audit logic, and integrations instead of placing all backend logic inside Next.js route handlers.
- Frontend apps should call backend APIs through `packages/api-client`. Each app may keep a thin `src/lib/api-client.ts` adapter, but pages and feature modules should not scatter raw `fetch` calls.

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

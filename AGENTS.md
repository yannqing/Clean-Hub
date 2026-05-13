# AGENTS.md

This file provides guidance for AI coding agents working in this repository.

## Project Overview

CleanHub is a multi-tenant SaaS platform for laundry, pressing, dry cleaning, car wash, POS, hardware integration, offline-first operations, local payments, and multi-store management.

The repository is a Turborepo + pnpm monorepo with multiple apps and shared packages.

## Tech Stack

- Package manager: `pnpm`
- Monorepo: `Turborepo`
- Web: `Next.js`
- Styling: `Tailwind CSS`
- Desktop: `Electron`
- Mobile: `Capacitor`
- API: standalone TypeScript service
- Database: `Drizzle ORM` + PostgreSQL
- Logging: `@cleanhub/logger` backed by Pino
- Language: TypeScript

## Important Commands

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

Build:

```bash
pnpm build
```

Typecheck:

```bash
pnpm typecheck
```

Lint:

```bash
pnpm lint
```

## Workspace Structure

### Apps

- `apps/web-admin`: Next.js SaaS admin and tenant back office.
- `apps/pos-web`: Next.js POS frontend, intended to be reused by desktop and mobile shells.
- `apps/desktop`: Electron shell for Windows/macOS hardware integration.
- `apps/mobile`: Capacitor shell for Android/iOS device APIs.
- `apps/api`: standalone TypeScript API service.

### Packages

- `packages/ui`: shared UI primitives and shared web components.
- `packages/domain`: shared business constants and domain rules.
- `packages/id`: shared ULID generation and validation helpers.
- `packages/db`: Drizzle/PostgreSQL schema.
- `packages/api-client`: shared API client.
- `packages/i18n`: multilingual copy and i18n helpers.
- `packages/offline`: offline sync logic.
- `packages/hardware`: printer/scanner/cash-drawer abstractions.
- `packages/config`: shared TypeScript config.
- `packages/logger`: shared server-side logger.

## Documentation

Documentation lives under `docs`.

- Product docs: `docs/01-product`
- Project management docs: `docs/02-project-management`
- Design docs: `docs/03-design`
- Technical docs: `docs/04-technical`
- QA docs: `docs/05-qa`
- Delivery docs: `docs/06-delivery`

Start with:

- `README.md`
- `README.zh-CN.md`
- `docs/README.md`
- `docs/01-product/prd/Clean_Hub-prd-v0.1.md`
- `docs/01-product/phase-scope/Clean_Hub-Phase_1范围与验收标准.md`
- `docs/04-technical/api/Clean_Hub-API_Client使用说明.md`
- `docs/04-technical/database/Clean_Hub-Drizzle数据库迁移操作详解.md`

## Development Guidelines

- Prefer existing project patterns and shared packages before introducing new abstractions.
- Keep business rules shared where possible, especially between POS, desktop, mobile, and API.
- Do not put all backend business logic into Next.js route handlers; use `apps/api` for backend services, webhooks, sync, audit, and integrations.
- Treat POS, offline sync, payment, printing, and audit flows as high-risk areas.
- Preserve tenant isolation from the first implementation. Business data should include `tenant_id`; branch-scoped data should include `branch_id`.
- All business entity IDs must use ULID strings generated through `@cleanhub/id`. Do not add auto-increment IDs or PostgreSQL `uuid` primary keys.
- In PostgreSQL/Drizzle, store ULIDs as `varchar(26)`. Use the helpers in `packages/db/src/schema/id.ts` for primary keys and foreign keys.
- For offline-capable records, plan ULID primary keys, stable device IDs, versioning, soft deletion, idempotency, and sync metadata.
- Use `packages/api-client` for frontend-to-API calls. App-level `src/lib/api-client.ts` files should be thin adapters only.
- Use `@cleanhub/logger` for server-side logs. Do not add ad hoc file logging from business code.
- Do not change unrelated files or revert user changes.

## Auth And Route Guard Rules

`web-admin` uses access token + refresh token stored in HttpOnly cookies.

Rules:

- Frontend JavaScript must not read tokens directly.
- Frontend API calls should rely on cookies with `credentials: "include"`.
- `apps/web-admin/src/proxy.ts` owns route guarding for `/`, `/login`, `/api-health`, `/saas/**`, and `/tenant/**`.
- Anonymous users should be redirected to `/login?next=<path>`.
- SaaS roles should only enter `/saas`; tenant roles should only enter `/tenant`.
- Refresh token handling should go through backend auth endpoints.
- Logout should call the backend logout endpoint so the API clears auth cookies.

## API Client Rules

`packages/api-client` is the shared client for calls from frontend apps to `apps/api`.

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

For Next.js apps, especially `apps/web-admin`, use `features` as a business-module organization layer. It does not replace global folders such as `components`, `lib`, `hooks`, `types`, `config`, or `services`.

Recommended boundaries:

- `app/`: Next.js route groups, layouts, pages, loading/error files, and route-level composition.
- `features/`: business-module code, grouped by domain or product area.
- `components/`: shared cross-module UI components.
- `hooks/`: shared cross-module React hooks.
- `lib/`: shared utilities such as API client, auth helpers, formatting, permissions, and session helpers.
- `services/`: shared service wrappers or API access layers when they are reused across modules.
- `types/`: global/shared TypeScript types.
- `config/`: navigation, routes, feature flags, environment-derived config.

Feature modules may contain both `.ts` and `.tsx` files. Keep module-owned React components under a nested `components/` folder so they do not mix with actions, queries, validators, and types.

Recommended feature module shape:

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

Use this rule:

- Module-specific components go in `features/**/components`.
- Shared UI components go in `src/components`.
- Core backend business rules belong in `apps/api`; Server Actions in Next.js should mainly adapt form submissions, call APIs, handle redirects, and trigger revalidation.
- Server Actions should usually go in `features/**/actions/` once a module has more than one operation.
- Server-side queries should usually go in `features/**/queries/`.
- Form/input validation schemas should usually go in `features/**/validators/`.
- Single-file `actions.ts`, `queries.ts`, or `validators.ts` are acceptable only for tiny modules that are unlikely to grow.
- Database schema belongs in `packages/db` or `src/db/schema`, not in `features/**/validators.ts`.

## Validation

Before handing off code changes, run the narrowest relevant checks:

```bash
pnpm --filter <workspace-name> typecheck
pnpm --filter <workspace-name> lint
pnpm --filter <workspace-name> build
```

For broad changes, run:

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

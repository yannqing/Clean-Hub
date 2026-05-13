# CleanHub 开发约束

本文档面向参与 CleanHub 开发的人类开发者，用于说明项目内必须遵守的代码组织边界。AI 工具的专用约束见 `AGENTS.md` 和 `CLAUDE.md`。

## 基本原则

- 优先遵循现有目录结构和命名风格。
- 不要把业务逻辑、UI 组件、数据库结构、接口调用混在同一层目录中。
- 不要修改和当前任务无关的文件。
- 涉及多租户、离线、支付、硬件、审计的改动，需要先确认数据边界和验收标准。

## 本地启动流程

普通 `web-admin + api + PostgreSQL` 本地开发，建议按下面顺序启动：

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm --filter @cleanhub/api dev
pnpm --filter @cleanhub/web-admin dev
```

常用地址：

```text
Web Admin: http://localhost:3000
API health: http://localhost:4000/health
```

## ID 与离线数据约束

CleanHub 是离线优先、多终端同步系统。所有业务实体主键和跨表引用 ID 必须使用 ULID，禁止使用数据库自增 ID，禁止新增 PostgreSQL `uuid` 主键。

规则：

- 业务表主键统一使用 ULID 字符串。
- PostgreSQL/Drizzle 中 ULID 字段统一使用 `varchar(26)`。
- 新增表结构时，优先使用 `packages/db/src/schema/id.ts` 中的 `ulidPrimaryKey()` 和 `ulidColumn()`。
- 应用层、API、POS、Desktop、Mobile、本地离线队列需要生成 ID 时，统一从 `@cleanhub/id` 导入 `createId()`。
- `tenantCode`、`pressingCode`、第三方支付 ID、外部订单号等业务编码或外部 ID 不属于主键，可以保留原始字符串。
- `device_id` 是稳定设备身份，也应由 `@cleanhub/id` 生成并持久化到设备本地。

## 依赖管理约束

本项目是 pnpm workspace monorepo。安装依赖时，默认在根目录执行：

```bash
pnpm install
```

给某一个 app 或 package 添加依赖时，必须使用 `--filter` 指定目标 workspace，不要直接在根目录执行 `pnpm add xxx`：

```bash
pnpm --filter @cleanhub/web-admin add zod
pnpm --filter @cleanhub/db add drizzle-orm
pnpm --filter @cleanhub/ui add sonner
```

开发依赖使用 `-D`：

```bash
pnpm --filter @cleanhub/web-admin add -D eslint-plugin-import
```

只有仓库级工具依赖才允许添加到根目录，例如 Turborepo、Prettier、TypeScript、共享构建脚本相关依赖。

workspace 内部包之间互相依赖时，使用 `workspace:*`：

```bash
pnpm --filter @cleanhub/web-admin add @cleanhub/ui@workspace:*
```

规则：

- App 专属依赖放到对应 `apps/<app>/package.json`。
- Package 专属依赖放到对应 `packages/<package>/package.json`。
- 根目录只放 monorepo 级工具依赖。
- 新增依赖后需要提交对应 `package.json` 和 `pnpm-lock.yaml`。

## 共享 UI 约束

`packages/ui` 是 monorepo 的共享 Web UI 包，供 `web-admin`、`pos-web` 以及通过 WebView 复用它们的 Electron/Capacitor 应用使用。

### 禁止手动修改 shadcn 生成区

以下目录是 shadcn/ui 生成的基础组件目录：

```text
packages/ui/src/components/ui/
```

这个目录只放 shadcn/ui primitives，例如：

```text
button.tsx
input.tsx
dialog.tsx
table.tsx
card.tsx
badge.tsx
```

开发者不要手动修改该目录下的任何文件，也不要把业务封装组件放进这个目录。

如果确实需要新增 shadcn/ui 基础组件，应使用 CLI：

```bash
pnpm dlx shadcn@latest add <component> --cwd packages/ui
```

### 自定义共享组件放置位置

公司级或项目级的通用组件，应放在 `packages/ui/src/components/` 下的其他分类目录：

```text
packages/ui/src/components/layout/
packages/ui/src/components/forms/
packages/ui/src/components/data-display/
packages/ui/src/components/feedback/
```

示例：

```text
packages/ui/src/components/layout/page-header.tsx
packages/ui/src/components/forms/search-input.tsx
packages/ui/src/components/data-display/empty-state.tsx
packages/ui/src/components/feedback/confirm-dialog.tsx
```

### 组件放置规则

- shadcn/ui 基础组件：`packages/ui/src/components/ui`
- 跨 app 复用的通用 Web 组件：`packages/ui/src/components/<category>`
- 某个 app 内共享但不适合全局复用的组件：`apps/<app>/src/components`
- 业务模块专属组件：`apps/<app>/src/features/**/components`
- 不要把 CleanHub 业务逻辑写进 `packages/ui`

## Feature 目录约束

`features` 是业务模块组织层，不替代 `components`、`lib`、`hooks`、`types`、`config`、`services`。

`web-admin` 默认采用目录形态组织 actions、queries、validators。这样比把所有内容都压成单文件更适合多人协作和模块增长。

推荐结构：

```text
apps/web-admin/src/features/saas/tenants/
  components/
  actions/
  queries/
  validators/
  types.ts
  constants.ts
```

规则：

- Server Actions 只做表单适配、调用 API、redirect、revalidate 等页面交互逻辑。
- 核心后端业务规则应放在 `apps/api`。
- 服务端查询函数放在 `queries/`。
- 表单和输入校验放在 `validators/`。
- 数据库表结构放在 `packages/db`，不要放在 `features`。
- 单文件 `actions.ts`、`queries.ts`、`validators.ts` 只适合非常小且几乎不会扩展的模块。

## 认证与路由守卫约束

`web-admin` 使用 access token + refresh token，并通过 HttpOnly Cookie 存储。

规则：

- 前端 JavaScript 不读取 token。
- API 请求通过 Cookie 自动携带登录态。
- `apps/web-admin/src/proxy.ts` 负责保护 `/`、`/login`、`/api-health`、`/saas/**`、`/tenant/**`。
- 未登录用户访问受保护页面时跳转到 `/login?next=<path>`。
- SaaS 角色只能进入 `/saas`。
- Tenant 角色只能进入 `/tenant`。
- access token 过期时，由路由守卫尝试调用 refresh 逻辑。
- 登出必须调用后端 logout 接口，由 API 清理认证 Cookie。

## API Client 约束

`packages/api-client` 是前端调用 `apps/api` 的统一封装。普通业务代码不要在页面或 feature 中到处手写 `fetch`。

推荐调用链：

```text
page/component
  -> features/**/queries 或 features/**/actions
    -> apps/<app>/src/lib/api-client.ts
      -> packages/api-client
        -> apps/api
```

规则：

- 通用请求逻辑、错误类型、Auth/SaaS/Tenant API 方法放在 `packages/api-client`。
- API client 按业务域和资源拆分，例如 `src/saas/tenants.ts`、`src/saas/tenants.types.ts`，不要把所有类型和接口方法堆进一个大文件。
- 各 app 的 `src/lib/api-client.ts` 只负责创建当前 app 的 client 实例，例如读取 API base URL、配置 cookie、配置 401 refresh 行为。
- `packages/api-client` 不应依赖 Next.js，不要在其中使用 `redirect()`、`revalidatePath()` 或 app 专属环境变量。
- 新增后端接口时，优先在 `packages/api-client` 补请求/响应类型和方法，再由 feature 的 query/action 调用。

新增一个前后端链路时，推荐顺序：

```text
apps/api
  -> route/controller/service/repository/type
packages/api-client
  -> 请求/响应类型和 API 方法
apps/web-admin
  -> features/**/queries 或 features/**/actions
apps/web-admin
  -> app page 或 component
```

详细说明见：

```text
docs/04-technical/api/Clean_Hub-API_Client使用说明.md
```

## 日志约束

服务端日志统一使用 `@cleanhub/logger`。

规则：

- API 请求日志、认证日志、后台业务日志应使用共享 logger。
- 不要在业务代码中自行写 `.log` 文件。
- Docker、测试环境、生产环境的日志应从 stdout/stderr 采集。
- 客户端 UI 消息提示使用 Sonner 等 UI 组件，不使用服务端 logger。

## 验证要求

改动完成后，至少运行和改动范围相关的检查。

单个 workspace：

```bash
pnpm --filter <workspace-name> typecheck
pnpm --filter <workspace-name> lint
pnpm --filter <workspace-name> build
```

跨 package 或全局结构改动：

```bash
pnpm typecheck
pnpm build
```

API 改动：

```bash
pnpm --filter @cleanhub/api typecheck
pnpm --filter @cleanhub/api build
```

Web Admin 改动：

```bash
pnpm --filter @cleanhub/web-admin typecheck
pnpm --filter @cleanhub/web-admin lint
pnpm --filter @cleanhub/web-admin build
```

数据库 schema 改动：

```bash
pnpm db:generate
pnpm db:migrate
pnpm --filter @cleanhub/db typecheck
```

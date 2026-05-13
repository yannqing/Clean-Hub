# CleanHub

CleanHub 是一套面向洗衣、压烫、干洗、洗衣房、洗车、POS、硬件接入、离线营业、本地支付、多门店管理的多租户 SaaS 平台。

本仓库是一个基于 Turborepo + pnpm 的 monorepo，包含后台管理、POS、桌面端、移动端、API 服务，以及多个共享 packages。

英文说明见 [README.md](./README.md)。

## 技术栈

- 包管理器：`pnpm`
- Monorepo 编排：`Turborepo`
- Web 框架：`Next.js`
- 样式：`Tailwind CSS`
- 桌面端壳：`Electron`
- 移动端壳：`Capacitor`
- API：独立 TypeScript 服务
- 数据库层：`Drizzle ORM` + PostgreSQL
- ID 策略：通过 `@cleanhub/id` 统一生成 ULID
- 日志：基于 Pino 的 `@cleanhub/logger`
- 开发语言：TypeScript

## 环境要求

- Node.js `>=20`
- pnpm `>=10`

## 安装依赖

```bash
pnpm install
```

## 本地快速启动

如果你要在本地启动常规的 `web-admin + api + PostgreSQL` 开发环境，建议按下面顺序执行：

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm --filter @cleanhub/api dev
pnpm --filter @cleanhub/web-admin dev
```

然后访问：

```text
Web Admin：http://localhost:3000
API health：http://localhost:4000/health
```

数据库 migration 中会创建本地测试账号。测试登录时，以当前 Phase 1 和认证相关技术文档中的账号说明为准。

## 依赖管理

安装项目依赖时，在仓库根目录执行一次即可：

```bash
pnpm install
```

给某一个 app 或 package 新增依赖时，必须使用 `--filter`，这样依赖才会写入对应 workspace 的 `package.json`：

```bash
pnpm --filter @cleanhub/web-admin add zod
pnpm --filter @cleanhub/db add drizzle-orm
pnpm --filter @cleanhub/ui add sonner
```

如果是开发依赖，使用 `-D`：

```bash
pnpm --filter @cleanhub/web-admin add -D eslint-plugin-import
```

只有真正属于整个仓库的工具依赖，才放到根目录 `package.json`，例如 Turborepo、Prettier、TypeScript、共享构建脚本相关依赖。

如果某个 workspace 依赖另一个 workspace 包，使用 workspace 协议：

```bash
pnpm --filter @cleanhub/web-admin add @cleanhub/ui@workspace:*
```

## 数据库

CleanHub 使用 Drizzle ORM + PostgreSQL。本地开发可以直接使用根目录的 Docker Compose。

所有业务实体 ID 统一使用 ULID 字符串。数据库 ID 字段使用 `varchar(26)`，不使用自增整数，也不使用 PostgreSQL `uuid` 主键。应用层需要生成 ID 时统一从 `@cleanhub/id` 导入。

先复制环境变量示例文件：

```bash
cp .env.example .env
```

创建并启动本地 PostgreSQL 容器：

```bash
pnpm db:up
```

查看容器状态或日志：

```bash
pnpm db:ps
pnpm db:logs
```

当你修改了 `packages/db/src/schema` 下的表结构后，生成 Drizzle migration：

```bash
pnpm db:generate
```

把已经生成的 migration 执行到当前配置的数据库：

```bash
pnpm db:migrate
```

打开 Drizzle Studio：

```bash
pnpm db:studio
```

仅在早期本地原型阶段，可以用 `pnpm db:push` 直接把 schema 推到本地数据库，不生成 migration 文件。等团队开始正式评审 migration 后，不建议把 `db:push` 作为常规协作流程。

停止本地 PostgreSQL 容器：

```bash
pnpm db:down
```

## 启动全部项目

```bash
pnpm dev
```

该命令会通过 Turborepo 启动所有 workspace 中的 `dev` 脚本。

## 单独启动某一个项目

使用 `pnpm --filter <workspace-name> dev` 可以只启动某一个项目。

### 启动 Web Admin

```bash
pnpm --filter @cleanhub/web-admin dev
```

访问地址：

```text
http://localhost:3000
```

### 启动 POS Web

```bash
pnpm --filter @cleanhub/pos-web dev
```

访问地址：

```text
http://localhost:3001
```

### 启动 API

```bash
pnpm --filter @cleanhub/api dev
```

默认地址：

```text
http://localhost:4000
```

### 启动 Desktop

```bash
pnpm --filter @cleanhub/desktop dev
```

当前 desktop 还是 Electron 壳的占位结构，后续需要继续完善真正的 Electron 启动逻辑和硬件集成。

### 启动 Mobile

```bash
pnpm --filter @cleanhub/mobile dev
```

当前 mobile 还是 Capacitor 壳的占位结构，还没有添加 Android / iOS native platform，因此暂时不会真正启动移动应用。

## 构建

构建所有 workspace：

```bash
pnpm build
```

构建某一个 workspace：

```bash
pnpm --filter @cleanhub/web-admin build
```

## 类型检查

检查所有 workspace：

```bash
pnpm typecheck
```

检查某一个 workspace：

```bash
pnpm --filter @cleanhub/pos-web typecheck
```

## Lint

```bash
pnpm lint
```

## 项目结构

### Apps

- `apps/web-admin`：Next.js SaaS 管理后台，用于平台管理、租户后台、报表和配置。
- `apps/pos-web`：Next.js POS 前端，后续会被 Desktop 和 Mobile 壳复用。
- `apps/desktop`：Electron 桌面端壳，用于 Windows/macOS 本地硬件集成。
- `apps/mobile`：Capacitor 移动端壳，用于 Android/iOS 设备能力。
- `apps/api`：独立 TypeScript API 服务，承载认证、SaaS/Tenant API、审计、同步、webhook 和第三方集成。

### Packages

- `packages/ui`：共享 UI 基础组件。
- `packages/domain`：共享业务常量和领域规则。
- `packages/id`：共享 ULID 生成和校验工具。
- `packages/db`：Drizzle/PostgreSQL 数据库 schema。
- `packages/api-client`：共享 API client，用于统一封装前端到 `apps/api` 的请求、错误、Cookie、超时和刷新登录态等逻辑。
- `packages/i18n`：法语/英语文案占位。
- `packages/offline`：离线同步能力占位。
- `packages/hardware`：打印机、扫码枪、钱箱等硬件抽象占位。
- `packages/config`：共享 TypeScript 配置。
- `packages/logger`：基于 Pino 的服务端共享日志工具。

## 文档目录

项目文档位于 `docs` 目录。

- `docs/00-overview`：项目级说明、文档指南、通用流程。
- `docs/01-product`：PRD、阶段范围、用户流程、权限、产品专题、Backlog。
- `docs/02-project-management`：项目计划、风险、会议、状态报告。
- `docs/03-design`：信息架构、线框图、UI 设计、交互原型。
- `docs/04-technical`：TRD、架构、API、数据库、离线、支付、硬件、部署。
- `docs/05-qa`：测试计划、测试用例、UAT、测试报告。
- `docs/06-delivery`：上线、培训、支持、验收。
- `docs/99-archive`：归档文档。

完整文档目录说明见 [docs/README.md](./docs/README.md)。

API Client 使用说明见 [Clean_Hub-API_Client使用说明.md](./docs/04-technical/api/Clean_Hub-API_Client使用说明.md)。

## 开发说明

- `web-admin` 和 `pos-web` 是两个独立的 Next.js 应用。
- `pos-web` 后续应尽量复用于桌面端和移动端壳，避免多端重复实现 POS 业务逻辑。
- `desktop` 负责 Windows/macOS 本地硬件能力，例如打印机、扫码枪、钱箱、本地数据库等。
- `mobile` 负责 Android/iOS 设备能力，例如摄像头、GPS、蓝牙打印、移动配送等。
- `api` 应承载后端业务 API、支付 webhook、同步队列、审计逻辑和第三方集成，不建议把全部后端业务塞进 Next.js route handlers。
- 前端调用后端 API 时，优先使用 `packages/api-client`。各 app 的 `src/lib/api-client.ts` 只做薄适配，不要在页面和 feature 中到处手写 `fetch`。

## 认证与路由守卫

`web-admin` 使用 access token + refresh token，并通过 HttpOnly Cookie 存储。

- 前端 JavaScript 不应该直接读取 token。
- 浏览器请求通过 `credentials: "include"` 自动携带 Cookie。
- `apps/web-admin/src/proxy.ts` 负责保护 `/`、`/login`、`/api-health`、`/saas/**`、`/tenant/**`。
- 未登录用户访问受保护页面时，会跳转到 `/login?next=<path>`。
- SaaS 角色进入 `/saas`。
- Tenant 角色进入 `/tenant`。
- access token 过期时，路由守卫会先尝试使用 refresh token 刷新，再决定是否放行。
- 登出必须调用后端 logout 接口，由 API 清理认证 Cookie。

## API 开发流程

当你要为前端新增一个后端能力时，推荐按下面顺序开发：

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

规则：

- 后端业务规则放在 `apps/api`。
- 共享请求方法和 DTO 类型放在 `packages/api-client`。
- app 自己的 client 创建逻辑放在 `apps/<app>/src/lib/api-client.ts`。
- 业务模块的页面适配逻辑放在 `features/**/queries` 或 `features/**/actions`。
- 页面和 React 组件中不要到处手写原始 `fetch`。

## 日志

服务端日志统一使用 `@cleanhub/logger`。

- API 请求日志和后端业务日志应通过共享 logger 输出。
- 业务代码不要自己随意写文件日志。
- Docker 或生产环境中，日志应由运行平台从进程 stdout/stderr 统一收集。
- 客户端 UI 提示使用 Sonner 等反馈组件，不使用服务端 logger。

## 前端代码组织规范

在 Next.js 应用中，`features` 用作**业务模块聚合层**。它不是为了替代 `components`、`lib`、`hooks`、`types`、`config`、`services` 等全局目录，而是补充一个按业务模块组织代码的位置。

推荐职责：

- `app/`：Next.js 路由、route group、layout、page、loading/error，以及页面级组装。
- `features/`：业务模块代码和模块专属 UI。
- `components/`：跨模块共享 UI 组件。
- `hooks/`：跨模块共享 React hooks。
- `lib/`：通用工具，例如 API client、auth、session、permissions、format 等。
- `services/`：可复用的服务封装或 API 访问层。
- `types/`：全局共享 TypeScript 类型。
- `config/`：导航、路由、feature flags、应用配置。

`features` 模块中可以同时包含 `.ts` 和 `.tsx` 文件。为了避免混乱，模块专属 React 组件应统一放在该模块内部的 `components/` 目录：

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

对于 `web-admin`，默认推荐 `actions`、`queries`、`validators` 都采用目录形态，这样多人协作和模块增长时更稳定：

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

规则：

- 模块专属组件放在 `features/**/components`。
- 跨模块共享组件放在 `src/components`。
- 核心后端业务规则应放在 `apps/api`；Next.js Server Actions 主要负责表单适配、调用 API、redirect 和 revalidate。
- 模块有多个操作时，Server Actions 优先放在 `features/**/actions/`。
- 服务端查询函数优先放在 `features/**/queries/`。
- 表单/输入校验优先放在 `features/**/validators/`。
- 只有非常小、几乎不会扩展的模块，才使用 `actions.ts`、`queries.ts`、`validators.ts` 单文件。
- 数据库表结构放在 `packages/db` 或 `src/db/schema`，不要和 `features/**/validators.ts` 混淆。

## 提交前检查

提交或交付代码前，按改动范围运行最小必要检查。

Web Admin 改动：

```bash
pnpm --filter @cleanhub/web-admin typecheck
pnpm --filter @cleanhub/web-admin lint
pnpm --filter @cleanhub/web-admin build
```

API 改动：

```bash
pnpm --filter @cleanhub/api typecheck
pnpm --filter @cleanhub/api build
```

数据库 schema 改动：

```bash
pnpm db:generate
pnpm db:migrate
pnpm --filter @cleanhub/db typecheck
```

共享 package 或全局结构改动：

```bash
pnpm typecheck
pnpm build
```

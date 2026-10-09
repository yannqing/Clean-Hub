# CleanHub API Client 使用说明

| 版本 | 修改日期 | 修改人 | 状态 | 说明 |
| ---- | -------- | ------ | ---- | ---- |
| v0.1 | 2026.05.12 | Codex | Draft | 说明 `packages/api-client` 的定位、使用方式和开发约束 |

---

## 1. 这是什么

`packages/api-client` 是 CleanHub 前端调用后端 API 的统一封装。

可以把它理解为：

> **前端和 `apps/api` 之间的统一请求入口。**

以后 `web-admin`、`pos-web`、Electron 壳、Capacitor 壳都可能调用同一个后端 API。如果每个 app 都自己写 `fetch`，就会出现很多重复逻辑：

- API 地址怎么拼。
- GET / POST / PATCH 怎么写。
- JSON 怎么序列化。
- Cookie 怎么携带。
- 401 怎么刷新登录态。
- 403 / 404 / 422 / 500 怎么处理。
- 请求超时怎么处理。
- 错误格式怎么统一。

所以这些通用规则应该放在 `packages/api-client`。

## 2. 放在哪里

推荐边界：

```text
packages/api-client
  通用 API client，所有 app 可复用

apps/web-admin/src/lib/api-client.ts
  web-admin 自己的薄适配层
```

也就是说：

- **核心封装写在 `packages/api-client`。**
- **具体 app 怎么创建 client，写在该 app 的 `src/lib/api-client.ts`。**

## 3. 为什么不是只写在 web-admin

如果只写在 `apps/web-admin/src/lib/api-client.ts`，后面 `pos-web`、desktop、mobile 还要再写一遍类似逻辑。

CleanHub 是多端项目，所以 API 请求规则应该共享：

```text
web-admin
pos-web
desktop
mobile
        -> packages/api-client -> apps/api
```

## 4. 普通开发者怎么用

大多数开发者不需要理解内部实现，只需要在 feature 的 `queries` 或 `actions` 中使用 `webAdminApi`。

示例：读取租户列表

```ts
import { webAdminApi } from "@/lib/api-client";

export async function getTenantListQuery() {
  return webAdminApi.saas.tenants.list();
}
```

示例：获取当前用户

```ts
import { webAdminApi } from "@/lib/api-client";

export async function getAuthSessionQuery() {
  return webAdminApi.auth.me();
}
```

示例：创建租户

```ts
import { webAdminApi } from "@/lib/api-client";

export async function createTenantAction(input: CreateTenantInput) {
  return webAdminApi.saas.tenants.create(input);
}
```

> **调用方式说明：** 所有业务调用统一使用按资源分组的方式，例如 `webAdminApi.saas.tenants.list()`、`webAdminApi.tenant.branches.get(id)`。每个资源是一个命名空间对象，其下挂该资源的方法。不再提供 `listTenants()`、`getTenant()` 这类扁平快捷方法。

## 5. 不推荐怎么用

不推荐在页面或 feature 里直接写：

```ts
await fetch("http://localhost:4000/saas/tenants");
```

原因是这样会绕过统一处理：

- 不一定携带 cookie。
- 不会自动处理 401。
- 错误格式不统一。
- 后续换 API base URL 时容易遗漏。
- 多个 app 行为不一致。

除非是非常特殊的请求，否则应优先使用 `webAdminApi` 或 `packages/api-client` 创建出的 client。

## 6. 当前代码结构

```text
packages/api-client/src/
  http-client.ts             核心请求封装
  errors.ts                  统一错误类型
  types.ts                   通用请求/响应类型
  cleanhub-client.ts         组合 auth / saas / tenant / pos
  index.ts                   统一导出

  auth/
    index.ts                 Auth API 聚合入口
    session.ts               登录、刷新、登出、当前用户
    types.ts                 Auth DTO 类型

  saas/
    index.ts                 SaaS Admin API 聚合入口
    identity/                身份与权限：users + roles
    security/                安全：security-events + security-settings
    backups/                 备份与恢复：backups + restore-requests
    audit/                   审计与日志：audit-logs + operation-logs
    tenants/                 租户管理
    feedback-tickets/        工单反馈
    overview/                概览
    platform-settings/       平台设置

  tenant/
    index.ts                 Tenant Admin API 聚合入口
    identity/                租户用户
    branches/                门店
    catalog/                 服务目录：services + prices
    backups/                 备份
    insights/                运营洞察：overview + reports + audit-logs
    hardware/                硬件配置
    notifications/           通知设置
    settings/                租户后台设置

  pos/
    index.ts                 POS API 聚合入口
    branches.ts              POS 终端可见的本店信息

  auth-client.ts             旧入口兼容转发
  saas-client.ts             旧入口兼容转发
  tenant-client.ts           旧入口兼容转发
  pos-client.ts              旧入口兼容转发

apps/web-admin/src/lib/
  api-client.ts        创建 web-admin 专用 API client
```

## 7. 内部做了什么

`packages/api-client` 当前支持：

- `GET`、`POST`、`PUT`、`PATCH`、`DELETE`。
- `baseUrl`。
- query params。
- JSON 请求体。
- FormData、Blob、text、void response。
- `credentials: "include"`，用于 HttpOnly Cookie。
- 请求超时。
- 请求重试。
- 统一错误类型。
- 401 后刷新 token 的扩展点。
- request id。
- beforeRequest / afterResponse / onError hook。
- idempotency key。

普通业务开发不需要每次都关心这些细节。

## 8. 和 HttpOnly Cookie 的关系

CleanHub Web Admin 使用：

```text
Access Token + Refresh Token + HttpOnly Cookie
```

前端 JavaScript 不能读取 HttpOnly Cookie，所以业务代码不应该手动拼：

```text
Authorization: Bearer xxx
```

API client 默认使用：

```ts
credentials: "include"
```

浏览器会自动把 Cookie 带给后端。

## 9. 错误处理方式

API client 会把错误统一成几类：

| 错误 | 说明 |
| ---- | ---- |
| `ApiHttpError` | 后端返回了非 2xx，例如 400、401、403、422、500 |
| `ApiNetworkError` | 网络请求失败 |
| `ApiTimeoutError` | 请求超时 |
| `ApiParseError` | 响应解析失败 |

业务页面可以根据错误类型决定展示什么状态。

示例：

```ts
import { ApiHttpError } from "@cleanhub/api-client";

try {
  await webAdminApi.saas.tenants.create(input);
} catch (error) {
  if (error instanceof ApiHttpError && error.status === 422) {
    // show validation errors
  }

  throw error;
}
```

## 10. 分层规则

### packages/api-client 可以做

- 通用 HTTP 请求。
- 通用错误模型。
- Auth / SaaS / Tenant API 方法封装。
- 请求重试、超时、统一 headers。
- 401 refresh 的扩展点。

### packages/api-client 不应该做

- 不应该直接依赖 Next.js。
- 不应该使用 `redirect()`、`revalidatePath()`。
- 不应该读取某个 app 专属环境变量。
- 不应该包含页面逻辑。
- 不应该包含 CleanHub 后端业务规则。

### app 的 lib/api-client.ts 可以做

- 从 app 自己的 env 读取 API base URL。
- 创建当前 app 专用 client。
- 配置当前 app 的 401 行为。
- 暴露给 `features/**/queries` 和 `features/**/actions` 使用。

## 11. 开发约束

新增 API 时，优先按这个顺序处理：

1. 后端 API 路径和请求/响应结构确认。
2. 在 `packages/api-client` 中补类型和方法。
3. 在 app 的 feature query/action 中调用。
4. 页面组件只消费 query/action，不直接散落 `fetch`。

示例：

```text
apps/web-admin/src/features/saas/tenants/
  queries/get-tenant-list.query.ts  -> 调 webAdminApi.saas.tenants.list()
  actions/create-tenant.action.ts   -> 调 webAdminApi.saas.tenants.create()
```

新增接口放置规则：

```text
SaaS 租户接口      -> packages/api-client/src/saas/tenants.ts
SaaS 用户接口      -> packages/api-client/src/saas/users.ts
SaaS 审计日志接口  -> packages/api-client/src/saas/audit-logs.ts
Tenant 门店接口    -> packages/api-client/src/tenant/branches.ts
Tenant 服务接口    -> packages/api-client/src/tenant/services.ts
Tenant 报表接口    -> packages/api-client/src/tenant/reports.ts
Auth 登录接口      -> packages/api-client/src/auth/session.ts
全新业务域         -> 新建 packages/api-client/src/<domain>/
```

请求/响应 DTO 类型不要全部堆到 client 文件里。推荐同资源拆分：

```text
tenants.ts          放 API 方法
tenants.types.ts    放请求/响应类型
```

如果某个类型是跨业务域的核心业务概念，优先评估是否应该放到 `packages/domain`，而不是放在某个 API client 子目录里。

## 12. 最小心智模型

如果只记一句话：

> **业务代码不要到处写 fetch。先看 `packages/api-client` 有没有方法；没有就补一个方法，再在 app 的 feature 里调用。**

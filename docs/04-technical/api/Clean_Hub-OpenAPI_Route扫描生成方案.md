# CleanHub OpenAPI 路由扫描生成方案（第一次开发阶段）

| 版本 | 修改日期 | 说明 |
| ---- | -------- | ---- |
| v0.3 | 2026.05.17 | 标记本文档适用于第一次开发阶段，后续 `app.ts` 修改规则放开后需同步更新 |
| v0.2 | 2026.05.17 | 实现时采用无额外依赖的 Node `.mjs` 脚本 |
| v0.1 | 2026.05.17 | 定义从 `app.ts` 和 `*.routes.ts` 扫描生成 `cleanhub.openapi.json` 的实现方案 |

---

## 0. 适用阶段

本文档适用于第一次开发阶段。

第一次开发阶段中，开发者可以本地临时修改 `apps/api/src/app.ts` 挂载接口，然后运行：

```bash
pnpm openapi:generate
```

生成 Apifox 可导入的：

```text
docs/04-technical/api/cleanhub.openapi.json
```

但提交前必须取消 `apps/api/src/app.ts` 的临时挂载改动。

后续如果团队规则调整为“开发者可以直接提交 `app.ts` 挂载改动”，本文档也需要同步更新。

## 1. 目标

本方案用于实现 Apifox 一键导入。

目标效果：

```text
开发者在 apps/api/src/app.ts 中本地临时或正式挂载接口
  -> 运行 pnpm openapi:generate
  -> 自动生成 docs/04-technical/api/cleanhub.openapi.json
  -> Apifox 导入 cleanhub.openapi.json
  -> 自动生成接口目录
```

本方案不要求 Apifox 直接读取 TypeScript 文件。Apifox 只导入标准 OpenAPI JSON 文件。

## 2. 为什么采用这个方案

当前项目后端是：

```text
TypeScript + Hono
```

当前后端 routes 写法是普通 Hono：

```ts
app.route("/saas/users", createSaasUsersRoutes());
routes.get("/:userId", getSaasUserController);
```

Apifox 不能直接解析这些 TypeScript 路由文件。它需要：

```text
OpenAPI / Swagger JSON
```

因此当前阶段最合适的方案是：

```text
从 app.ts + routes.ts 扫描出接口路径和方法
生成 cleanhub.openapi.json
让 Apifox 导入该 JSON
```

这样可以先解决“一键导入接口目录”的问题，又不需要立即重构 Hono routes。

## 3. 适用范围

适用于当前阶段：

- Phase 1.1 仍在开发中。
- 开发者需要 PR 前在 Apifox 自测。
- 开发者可能会本地临时挂载 `apps/api/src/app.ts` 做测试和联调。
- 项目尚未引入 `@hono/zod-openapi`。
- 需要快速生成 Apifox 可导入文件。

不适用于：

- 自动生成完整请求体字段。
- 自动生成完整响应结构。
- 自动推导复杂 Zod schema。
- 替代后续 OpenAPI-first 路由方案。

## 4. 文件规划

### 4.1 新增文件

```text
scripts/generate-openapi-from-routes.mjs
docs/04-technical/api/cleanhub.openapi.json
```

### 4.2 修改文件

```text
package.json
docs/04-technical/api/Clean_Hub-Apifox_OpenAPI协作规范.md
```

### 4.3 文件作用

| 文件 | 作用 |
| ---- | ---- |
| `scripts/generate-openapi-from-routes.mjs` | 扫描 `apps/api/src/app.ts` 和模块 `*.routes.ts`，生成 OpenAPI JSON |
| `docs/04-technical/api/cleanhub.openapi.json` | Apifox 一键导入的 OpenAPI 文件 |
| `package.json` | 增加 `openapi:generate` 命令 |
| `Clean_Hub-Apifox_OpenAPI协作规范.md` | 补充一键导入流程 |

## 5. 命令设计

根 `package.json` 增加命令：

```json
{
  "scripts": {
    "openapi:generate": "node scripts/generate-openapi-from-routes.mjs"
  }
}
```

开发者运行：

```bash
pnpm openapi:generate
```

输出文件：

```text
docs/04-technical/api/cleanhub.openapi.json
```

## 6. 生成逻辑

### 6.1 读取 API 入口

脚本读取：

```text
apps/api/src/app.ts
```

识别：

```ts
app.get("/health", ...)
app.route("/auth", createAuthRoutes({ authService }))
app.route("/saas/users", createSaasUsersRoutes())
app.route("/tenant/users", createTenantUserRoutes())
```

### 6.2 解析 import 映射

脚本从 `app.ts` 的 import 中建立映射：

```text
createAuthRoutes -> apps/api/src/modules/auth/auth.routes.ts
createSaasUsersRoutes -> apps/api/src/modules/saas-users/saas-users.routes.ts
createTenantUserRoutes -> apps/api/src/modules/users/users.routes.ts
```

### 6.3 读取模块 routes 文件

脚本读取每个 `*.routes.ts` 文件，识别：

```ts
routes.get("/")
routes.post("/login")
routes.get("/:userId")
routes.patch("/:userId")
routes.delete("/:id")
```

### 6.4 拼接完整路径

示例：

```ts
app.route("/saas/users", createSaasUsersRoutes());
routes.get("/:userId", getSaasUserController);
```

生成：

```text
GET /saas/users/{userId}
```

规则：

```text
Hono 路径参数 :userId -> OpenAPI 路径参数 {userId}
```

### 6.5 生成 tags

根据路径生成基础分组：

| 路径 | tag |
| ---- | --- |
| `/health` | `System` |
| `/auth/**` | `Auth` |
| `/saas/users/**` | `SaaS Users` |
| `/saas/backups/**` | `SaaS Backups` |
| `/saas/operation-logs/**` | `SaaS Operation Logs` |
| `/saas/security/**` | `SaaS Security` |
| `/tenant/**` | `Tenant` |

第一版可以用路径规则生成 tag，后续如需更精细可增加映射表。

## 7. OpenAPI 输出结构

生成文件基础结构：

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "CleanHub API",
    "version": "0.1.0"
  },
  "servers": [
    {
      "url": "http://localhost:4000",
      "description": "Local API"
    }
  ],
  "paths": {},
  "components": {
    "securitySchemes": {
      "cookieAuth": {
        "type": "apiKey",
        "in": "cookie",
        "name": "cleanhub_access_token"
      }
    },
    "schemas": {
      "ApiErrorResponse": {}
    }
  }
}
```

## 8. 鉴权规则

第一版使用路径规则判断鉴权。

不需要鉴权：

```text
GET /health
POST /auth/login
POST /auth/refresh
```

需要 Cookie 鉴权：

```text
GET /auth/me
POST /auth/logout
/saas/**
/tenant/**
```

OpenAPI 中对需要鉴权的接口添加：

```json
{
  "security": [
    {
      "cookieAuth": []
    }
  ]
}
```

## 9. 响应规则

第一版自动生成基础响应。

默认响应：

```text
200 OK
```

根据方法调整：

| 方法 | 默认成功状态 |
| ---- | ------------ |
| `GET` | `200` |
| `POST` | `200` |
| `PATCH` | `200` |
| `PUT` | `200` |
| `DELETE` | `204` |

特殊规则：

```text
POST /saas/users -> 201
POST /auth/logout -> 204
```

错误响应统一包含：

```text
401
403
404
422
500
```

错误响应 schema：

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string"
    },
    "code": {
      "type": "string"
    },
    "requestId": {
      "type": "string"
    }
  },
  "required": ["message", "code", "requestId"]
}
```

## 10. 第一版能力边界

第一版可以自动生成：

```text
接口方法
接口路径
path 参数
基础 tag
基础 summary
基础成功响应
通用错误响应
Cookie 鉴权说明
```

第一版暂不保证自动生成：

```text
query 参数具体字段
request body 具体字段
response body 具体结构
复杂 Zod schema
业务错误码明细
```

这些可以在后续版本中通过 schema map 或 `@hono/zod-openapi` 增强。

## 11. 开发者使用流程

### 11.1 本地临时测试接口

```text
1. 开发者完成模块 routes/controller/service/repository。
2. 本地临时修改 apps/api/src/app.ts 挂载接口。
3. 运行 pnpm openapi:generate。
4. Apifox 导入 docs/04-technical/api/cleanhub.openapi.json。
5. 启动 API。
6. Apifox 调用 POST /auth/login。
7. Apifox 测试接口。
8. 如需前后端联调，前端继续使用 http://localhost:4000。
9. 提交前取消 apps/api/src/app.ts 临时挂载改动。
10. 交付说明写正式挂载建议。
```

### 11.2 正式挂载后更新接口

```text
1. 杨序正式修改 apps/api/src/app.ts 挂载接口。
2. 运行 pnpm openapi:generate。
3. 提交更新后的 cleanhub.openapi.json。
4. Apifox 重新导入或覆盖导入 OpenAPI 文件。
5. 接口状态从 dev-only 改为 ready。
```

## 12. Apifox 导入流程

在 Apifox 中：

```text
导入数据
  -> OpenAPI / Swagger
  -> 选择文件
  -> docs/04-technical/api/cleanhub.openapi.json
  -> 确认导入
```

导入后，Apifox 会生成接口目录。

测试时环境使用：

```text
baseUrl = http://localhost:4000
```

如果 Apifox 界面左侧已经选择了 `http://localhost:4000` 作为服务地址，则接口路径中只需要填写：

```text
/health
/auth/login
/saas/users
```

## 13. 验收标准

实现完成后，应满足：

- [ ] `pnpm openapi:generate` 能成功运行。
- [ ] `docs/04-technical/api/cleanhub.openapi.json` 能成功生成。
- [ ] Apifox 能通过该 JSON 文件导入接口。
- [ ] 已挂载的 `app.get(...)` 和 `app.route(...)` 能出现在 OpenAPI 中。
- [ ] `routes.get("/:userId")` 能生成 `/xxx/{userId}`。
- [ ] `/health` 不带鉴权。
- [ ] `/saas/**` 和 `/tenant/**` 带 Cookie 鉴权说明。
- [ ] 不需要修改后端 `app.ts` 来提供 `/openapi.json`。
- [ ] 不影响 API 正常启动和业务接口行为。

## 14. 后续增强方向

### 14.1 Schema Map

后续可以增加：

```text
apps/api/src/openapi/manual-schemas.ts
```

用于补充：

```text
query 参数
request body
response body
业务错误码
```

### 14.2 OpenAPI URL

后续如果需要 Apifox 直接导入 URL，可以由杨序正式挂载：

```text
GET /openapi.json
```

该接口返回：

```text
docs/04-technical/api/cleanhub.openapi.json
```

### 14.3 `@hono/zod-openapi`

长期可以逐步迁移到：

```text
@hono/zod-openapi
```

让 routes、Zod schema 和 OpenAPI 更紧密地绑定。

但当前阶段不建议一口气重构全部 routes。

## 15. 推荐结论

当前阶段推荐先实现：

```text
从 app.ts + routes.ts 扫描生成 cleanhub.openapi.json
```

原因：

- 不需要重构 Hono routes。
- 不需要修改正式 API 行为。
- 能快速让 Apifox 一键导入接口目录。
- 适合当前 Phase 1.1 频繁新增接口的开发节奏。
- 后续可以平滑增强到 schema map 或 `@hono/zod-openapi`。

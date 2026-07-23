# CleanHub Apifox 与 OpenAPI 协作规范（第一次开发阶段）

| 版本 | 修改日期 | 说明 |
| ---- | -------- | ---- |
| v0.3 | 2026.05.17 | 标记本文档仅适用于第一次开发阶段，后续允许成员修改 `app.ts` 时需要更新规范 |
| v0.2 | 2026.05.17 | 补充 `pnpm openapi:generate` 生成 OpenAPI 文件并导入 Apifox 的流程 |
| v0.1 | 2026.05.17 | 约定 OpenAPI 文件、Apifox 导入、登录测试、个人开发入口和正式挂载流程 |

---

## 0. 适用阶段

本文档**仅适用于第一次开发阶段**。

第一次开发阶段的临时规则是：

```text
开发者可以本地临时修改 apps/api/src/app.ts 挂载接口
  -> 用于 Apifox 自测和前后端联调
  -> 提交前取消 apps/api/src/app.ts 临时挂载改动
  -> 正式挂载由杨序统一处理
```

这样做的目的：

- 让开发者在接口未正式挂载前也能本地测试和联调。
- 避免第一次集中开发时多人同时提交 `apps/api/src/app.ts` 造成公共入口混乱。
- 保持正式入口由杨序统一整理和挂载。

后续当接口结构稳定、`apps/api/src/app.ts` 已形成清晰路由分区后，可以调整为：

```text
开发者可以按规范直接提交 apps/api/src/app.ts 的路由挂载改动
```

届时必须先更新本文档，明确新的 `app.ts` 修改规则、分区规则和审核规则。

## 1. 目的

本文档用于统一 CleanHub 团队在**第一次开发阶段**的后端接口开发、OpenAPI 文档维护和 Apifox 测试协作方式。

目标是：

- 团队成员可以在 Apifox 中快速导入接口。
- 每个开发者写完接口后，可以尽早测试真实后端行为。
- 避免多人同时修改 `apps/api/src/app.ts` 造成冲突。
- 避免把未实现或未挂载接口误当成可测试接口。
- 保证登录、Cookie、鉴权、错误响应的测试方式一致。

## 2. 基本原则

CleanHub 的主后端是：

```text
apps/api
```

后端框架是 Hono，不是 Next.js route handler。因此 OpenAPI 和 Apifox 测试应以 `apps/api` 为准。

核心规则：

- `apps/api/src/app.ts` 是正式 API 入口，只由杨序修改。
- 业务模块负责人只维护自己模块内的 `routes/controller/service/repository`。
- 个人开发阶段允许本地临时修改 `apps/api/src/app.ts` 挂载自己的接口，用于 Apifox 自测和前后端联调。
- 本地临时挂载不能提交，提交前必须确认 `apps/api/src/app.ts` 不进入本次变更。
- 正式挂载仍由杨序统一处理，routes 整合方案先由李龙杰确认。
- Apifox 中只有真实可访问的接口才标记为可测试。
- 受保护接口必须先通过真实 `/auth/login` 登录后再测试。

## 3. 快速执行版

开发人员和 AI 编程工具优先按本节执行。

### 3.1 PR 前：开发者自测

开发者完成接口后，在提交 PR 前必须先用 Apifox 自测。

PR 前允许在本地临时修改正式入口文件，用于测试和联调：

```text
apps/api/src/app.ts
```

但这类修改只允许留在本地工作区，不能提交。

PR 前推荐流程：

```text
模块 routes/controller/service/repository
  -> 本地临时修改 apps/api/src/app.ts 挂载接口
    -> 启动本地 API
      -> POST {{baseUrl}}/auth/login
      -> Apifox 自测
      -> 前后端联调
      -> 提交前取消 app.ts 临时挂载改动
```

示例：

```text
CleanHub Local API
baseUrl = http://localhost:4000

POST {{baseUrl}}/auth/login
GET  {{baseUrl}}/saas/backups
```

### 3.2 PR 后：正式挂载与复测

PR 通过审核后，进入正式集成流程：

```text
1. 李龙杰确认 routes 整合方案、权限边界和审计要求。
2. 杨序统一修改 apps/api/src/app.ts 做正式挂载。
3. 许婧姝校验 OpenAPI 与 Apifox 接口。
4. Apifox 切换到 CleanHub Local API 环境。
5. 重新登录并测试正式接口。
```

正式环境：

```text
CleanHub Local API
baseUrl = http://localhost:4000
```

### 3.3 状态判断

```text
PR 前本地临时挂载可测：dev-only
PR 后正式入口可测：ready
只在计划文档中存在：planned
```

## 4. 文件位置约定

### 4.1 OpenAPI 文件

OpenAPI 静态文件统一放在：

```text
docs/04-technical/api/cleanhub.openapi.json
```

该文件用于 Apifox 的“导入 OpenAPI / Swagger”。

生成命令：

```bash
pnpm openapi:generate
```

该命令会扫描：

```text
apps/api/src/app.ts
apps/api/src/modules/**/**/*.routes.ts
```

并重新生成：

```text
docs/04-technical/api/cleanhub.openapi.json
```

Apifox 导入方式：

```text
导入数据
  -> OpenAPI / Swagger
  -> 选择 docs/04-technical/api/cleanhub.openapi.json
```

如果后续需要通过 URL 导入，可以在后端暴露：

```text
GET /openapi.json
```

并让该接口返回同一份 OpenAPI 内容。

### 4.2 正式 API 入口

正式入口文件：

```text
apps/api/src/app.ts
```

用途：

- 生产环境 API。
- 本地统一联调 API。
- 团队统一 Apifox 测试 API。
- 后续部署环境 API。

规则：

- 只由杨序修改。
- routes 整合方案先由李龙杰确认。
- 其他成员不要直接在该文件中新增 `app.route(...)`。

## 5. 负责人边界

根据 Phase 1.1 任务分工：

| 事项 | 负责人 |
| ---- | ------ |
| `apps/api/src/app.ts` 正式路由挂载 | 杨序 |
| routes 整合方案确认 | 李龙杰 |
| 代码审核、合并节奏、验收推进 | 李龙杰 |
| 反馈、系统日志、备份、安全模块开发 | 孙蕊蕊 |
| 接口文档、测试用例、验收记录 | 许婧姝 |
| OpenAPI 与 Apifox 导入规范维护 | 许婧姝主导，相关开发者配合 |

业务模块负责人需要在交付说明中写清楚：

```text
新增 routes 文件：
需要正式挂载的路径：
本地临时测试地址：
Apifox 测试环境：
Apifox 测试结果：
是否需要更新 OpenAPI：
```

## 6. 接口状态定义

OpenAPI 和 Apifox 中应区分接口状态。

| 状态 | 含义 | 是否可作为团队正式测试 |
| ---- | ---- | ---------------------- |
| `ready` | 已实现、已正式挂载、可通过正式 API 地址访问 | 是 |
| `dev-only` | 已实现、仅通过本地临时挂载可访问 | 否，只供个人开发测试和临时联调 |
| `planned` | 文档规划中，尚未实现或未确认 | 否 |
| `deprecated` | 已废弃，不建议继续使用 | 否 |

建议在 OpenAPI 的接口描述中标注：

```text
状态：ready
状态：dev-only
状态：planned
```

也可以使用 OpenAPI 扩展字段：

```json
{
  "x-cleanhub-status": "dev-only"
}
```

## 7. OpenAPI 收录规则

### 7.1 可以写入并标记为 ready 的接口

满足以下条件才标记为 `ready`：

- 后端代码已实现。
- 已在 `apps/api/src/app.ts` 正式挂载。
- 本地或联调环境可访问。
- 请求、响应和错误格式已确认。
- Apifox 中可以通过真实登录态测试。

### 7.2 可以写入但必须标记为 dev-only 的接口

满足以下条件可标记为 `dev-only`：

- 后端代码已实现。
- 开发者本地临时挂载后可访问。
- 尚未由杨序挂载到正式 `apps/api/src/app.ts`。

此类接口只能用于个人开发测试和临时前后端联调，不应作为团队统一验收依据。

### 7.3 不应作为可测试接口写入的接口

以下接口不要标记为可测试：

- 只存在于 TRD 文档中，代码尚未实现。
- routes 文件存在，但没有正式挂载，也没有本地临时挂载测试记录。
- 请求或响应结构未确认。
- 权限和鉴权逻辑未确认。

如需提前记录，可以放入规划文档，不要混入可测试 OpenAPI。

## 8. Apifox 环境约定

Apifox 中建议使用环境变量 `baseUrl`。

### 8.1 正式本地联调环境

```text
环境名：CleanHub Local API
baseUrl：http://localhost:4000
```

用途：

- 测试正式 `apps/api/src/app.ts` 已挂载接口。
- 团队统一联调。
- 验收前测试。

### 8.2 本地临时挂载环境

默认使用正式本地联调环境：

```text
环境名：CleanHub Local API
baseUrl：http://localhost:4000
```

开发者在本地临时修改 `apps/api/src/app.ts` 挂载接口后，直接用该环境完成 Apifox 自测和前后端联调。

提交前必须确认 `apps/api/src/app.ts` 的临时挂载改动没有进入提交。

## 9. 登录与 Cookie 测试规则

CleanHub Web Admin 使用 HttpOnly Cookie 鉴权。

Apifox 测试受保护接口时，必须先调用当前环境的真实登录接口：

```text
POST {{baseUrl}}/auth/login
```

登录成功后，后端会返回 `Set-Cookie`。Apifox 需要保存 Cookie，再继续请求：

```text
GET {{baseUrl}}/saas/users
GET {{baseUrl}}/saas/backups
GET {{baseUrl}}/tenant/users
```

注意：

- 测正式环境，就登录正式环境的 `/auth/login`。
- 测本地临时挂载接口，就登录本地 API 的 `/auth/login`。
- 不要手动复制前端页面里的 token。
- 不要让前端 JavaScript 读取 token。
- 不要用伪造 Cookie 代替真实登录，除非是在专门的单元测试中。
- 在多个 `localhost` Dev 环境之间切换时，建议清理 Apifox Cookie 后重新登录，避免旧 Cookie 影响测试结论。

## 10. Apifox 导入后的 Query 参数规则

OpenAPI 导入 Apifox 后，Apifox 可能会把可选 Query 参数自动列出来。

注意：

```text
参数值为空，但左侧仍然勾选时，Apifox 可能仍会发送该参数。
```

例如：

```text
GET /saas/users?q=&status=&limit=&offset=
```

这不是“不传参数”，而是“传入了空参数”。后端会按 Zod 校验处理，并可能返回：

```text
422 VALIDATION_ERROR
```

测试规则：

- 不需要的 Query 参数必须取消勾选或删除。
- 不要发送空字符串参数。
- 如果接口返回 `422 VALIDATION_ERROR`，先检查 Apifox 的 `Params` 是否有空值参数仍被勾选。
- 可选参数只有在需要筛选或分页时才填写。

以 `GET /saas/users` 为例：

正确：

```text
GET /saas/users
```

正确：

```text
GET /saas/users?limit=50&offset=0
```

正确：

```text
GET /saas/users?status=active&limit=50&offset=0
```

错误：

```text
GET /saas/users?q=&status=&limit=&offset=
```

`/saas/users` 的 Query 参数说明：

| 参数 | 是否必填 | 合法示例 | 说明 |
| ---- | -------- | -------- | ---- |
| `q` | 否 | `admin` | 搜索关键词；如果传入，不能为空 |
| `status` | 否 | `active` | 允许值：`invited`、`active`、`disabled`、`suspended` |
| `limit` | 否 | `50` | 必须大于 `0`，最大 `100` |
| `offset` | 否 | `0` | 必须大于等于 `0` |

## 11. PR 前个人开发测试与联调流程

开发者完成模块接口后，按以下流程自测：

```text
1. 完成本模块 routes/controller/service/repository。
2. 在本模块 routes 文件中声明子路由。
3. 本地临时修改 apps/api/src/app.ts 挂载本模块路由。
4. 启动本地 API。
5. 在 Apifox 选择 CleanHub Local API 环境。
6. 调用 POST {{baseUrl}}/auth/login 登录。
7. 调用本模块接口测试真实后端行为。
8. 如需要前后端联调，前端继续使用相同 baseUrl。
9. 修正请求体、响应体、错误码和权限问题。
10. 提交前取消 apps/api/src/app.ts 的临时挂载改动。
11. 使用 git status 确认 app.ts 没有进入本次提交。
12. 在交付说明中写明正式需要挂载的路径。
13. 如接口结构已稳定，提交 OpenAPI 更新建议。
```

示例交付说明：

```text
模块：saas-backups
新增 routes：apps/api/src/modules/saas-backups/backups.routes.ts
本地临时测试地址：http://localhost:4000
已测试接口：GET /saas/backups
正式挂载建议：app.route("/saas/backups", createSaasBackupRoutes())
提交说明：apps/api/src/app.ts 仅本地临时挂载，未提交
OpenAPI 状态建议：dev-only，正式挂载后改为 ready
```

## 12. 当前接口分类建议

截至本规范建立时，`apps/api/src/app.ts` 已挂载接口包括：

```text
GET  /health
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
GET  /saas/users
POST /saas/users
GET  /saas/users/:userId
PATCH /saas/users/:userId
GET  /tenant/users
```

以下 routes 文件存在，但需要确认是否已正式挂载后再标记为 `ready`：

```text
apps/api/src/modules/saas-ops/operation-logs.routes.ts
apps/api/src/modules/saas-backups/backups.routes.ts
apps/api/src/modules/saas-security/security-events.routes.ts
```

它们对应 Phase 1.1 中的：

```text
GET /saas/operation-logs
GET /saas/backups
GET /saas/security/events
```

未正式挂载前，可以通过本地临时挂载 `apps/api/src/app.ts` 做 Apifox 自测和临时前后端联调，但不要把它们作为团队统一可测试接口。

## 13. AI 编程工具阅读规则

当使用 AI 编程工具实现接口时，必须先读取本规范，并遵守以下规则：

```text
1. 可以本地临时修改 apps/api/src/app.ts 做测试和联调，但不要提交该文件改动。
2. 先在模块目录内完成 routes/controller/service/repository。
3. 如需 PR 前 Apifox 测试，使用本地临时挂载 apps/api/src/app.ts。
4. 受保护接口测试必须走 POST {{baseUrl}}/auth/login。
5. OpenAPI 中不要把未实现接口标为 ready。
6. 交付说明必须包含正式挂载建议和 Apifox 测试结果。
7. 如果任务要求正式修改 apps/api/src/app.ts，必须确认该任务由杨序执行或已获得明确授权。
```

AI 生成代码时应优先判断接口状态：

```text
已正式挂载并可测 -> ready
本地临时挂载可测 -> dev-only
计划文档中存在但代码未完成 -> planned
```

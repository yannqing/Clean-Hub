## Context

CleanHub 是 Turborepo + pnpm 单仓，已有 `web-admin`（后台）、`pos-web`（门店 POS）、`api`（后端）、`desktop`（Electron 壳）、`mobile`（Capacitor 壳）。当前真实状态（已逐一核对）：

- `apps/mobile` 仅为占位壳：`capacitor.config.ts` 指向 `webDir: "www"` 与 `server.url: http://localhost:3001`，`package.json` 的 dev 脚本是 "Mobile shell placeholder"，无任何 H5 业务，无 native platform。
- 后端无 mobile 模块：`apps/api/src/modules` 只有 `saas` / `tenant` / `pos`；`app.ts` 用 `createRequireAuthMiddleware` 守护 `/saas/* /tenant/* /pos/*`，CORS 已放行 `Authorization` 头。
- 认证只面向员工/后台：`auth.types.ts` 的 `AdminRole` 为 `super_admin|support|owner|manager|cashier`，`userType` 为 `saas|tenant`；`authRefreshTokens` 外键到 `users`（员工）。web-admin 走 HttpOnly Cookie。
- RBAC 数据驱动：`roles`（`scope: saas|tenant|pos` + `code`）、`userRoles`（含 `branchId`）。
- 业务表可复用：`customers` / `customerAccounts`（租户内手机号/邮箱唯一，**无凭证字段**）、`orders` / `orderItems`、`serviceTickets`（`sourceChannel` 已含 `app`）/`ticketItems`、`branches` / `userBranches`；`tenantFeatureFlags.deliveryEnabled` 仅为开关、无配送任务表。
- POS 业务 service 多为 `PosNotImplementedError` 脚手架。
- `packages/api-client` 已有 `auth/pos/saas/tenant`，无 mobile；`packages/offline` 仅类型占位。

关键外部约束（来自 TRD §9.5 T-02 与静态导出特性）：移动端**不打包 web-admin、不用 SSR/middleware/proxy**；Next.js `output: "export"` 不支持 cookies / server actions / proxy。因此移动端必须是纯客户端（CSR）+ Bearer Token 架构。

## Goals / Non-Goals

**Goals:**

- 一套 `apps/mobile-web` Next.js 静态导出代码，经 `apps/mobile` Capacitor 同时分发 Android/iOS。
- 跑通三条 MVP 链路：客户「登录→查单→预约」、配送员「登录→接任务→定位/拍照/签收→完成」、Owner「登录→看今日摘要」。
- 移动端 Bearer Token 认证与 web-admin/POS 的 Cookie 认证完全隔离，互不影响。
- 复用现有 ULID / 审计 / 软删 / version / 多租户 / RBAC 模式补齐数据模型。
- 轻离线：配送任务缓存 + 离线提交队列 + 幂等回放 + 最小冲突规则。

**Non-Goals（二期）:**

- 蓝牙打印；完整离线冲突合并（CRDT/三方合并）；真实 SMS/WhatsApp 供应商深度接入；会员积分/营销/评价/优惠券；地图路线优化与后台派单算法；后台持续定位；客户在线支付。
- 不改动 web-admin / POS / desktop 的现有认证与业务行为。
- 不实现 POS 端尚未实现的 service（仅按需为移动端查询读取既有数据）。

## Decisions

### D1：新建 `apps/mobile-web`（Next.js `output: "export"`，CSR），不复用 `pos-web`

- **理由**：移动端面向客户/配送/Owner，与门店收银 POS 是不同终端、不同认证（Bearer vs Cookie）、不同布局；静态导出 + 纯 CSR 才能被 Capacitor 打包。
- **备选**：① 复用 `pos-web` 加移动路由——会把收银 POS 与移动端的认证/打包/职责耦合，违反 PRD 终端边界；② 直接在 `apps/mobile` 写原生/纯 H5——失去 Next.js 与共享 UI 复用。均不取。
- **取舍**：静态导出后所有页面为 CSR，数据获取在客户端发起；放弃 SSR/SEO（移动 App 不需要）。

### D2：`apps/mobile` 作为 Capacitor 壳加载 `mobile-web` 产物

- 生产：`apps/mobile-web` 导出到静态目录，作为 `apps/mobile` 的 `webDir`，`cap sync` 到 Android/iOS；开发：壳指向 mobile-web dev server。引入 `@capacitor/geolocation`、`@capacitor/camera`、`@capacitor/preferences`（令牌与离线队列存储）。
- 现有 `capacitor.config.ts` 的 `server.url` 改为按环境注入（dev 用 dev server，prod 用打包产物），`appId/appName` 保留。

### D3：移动认证 = 独立 `/mobile/auth` + Bearer Token（响应体下发，原生存储）

- 新增 `apps/api/src/modules/mobile/auth`，登录成功在响应体返回 `accessToken/refreshToken/expiresAt`；新增**移动专用鉴权中间件**读取 `Authorization: Bearer`，挂在 `/mobile/*`（不复用面向 Cookie 的 `createRequireAuthMiddleware`）。
- **复用**现有 `token.service`（JWT 签发/校验）与 access token secret，仅改变传输方式（body 而非 cookie）与主体类型；登录限频复用 `login-lockout` 思路。
- **备选**：复用 web Cookie 认证——静态导出/跨域 WebView 下 cookie 不可控，被 TRD 明确禁止。不取。

### D4：三类身份建模

- **客户**：身份用既有 `customerAccounts`（租户内唯一手机号/邮箱），新增 `customer_credentials`（passwordHash，关联 account）与 `customer_auth_otps`（手机号 + code + 过期 + 用途 + 尝试次数）。
- **配送员**：建模为 `users`（`userType: tenant`）+ 新种子角色 `driver`（`roles.scope='tenant', code='driver'`，经 `userRoles` 绑定 branch）。在 `AdminRole` 联合类型补 `driver`。复用员工密码登录与 `authRefreshTokens`。
- **Owner**：复用既有 `owner` 角色用户，仅经 `/mobile/auth` 走 Bearer，授权只读看店。
- **理由**：配送员/ Owner 本质是租户员工，复用 `users`/RBAC 成本最低；客户是独立主体，需独立凭证表。

### D5：移动会话刷新令牌——客户用独立表，员工复用

- 员工（driver/owner）复用 `authRefreshTokens`（已 FK `users`）。
- 客户新增 `customer_auth_refresh_tokens`（FK `customer_accounts`，含 tokenHash/familyId/deviceId/expiresAt/revokedAt，对齐既有令牌轮换字段）。
- **备选**：单张多态 `mobile_refresh_tokens(subjectType, subjectId)` 统一两类主体——省一张表但失去外键完整性且与既有 `authRefreshTokens` 重复。MVP 取「员工复用 + 客户独立表」，边界清晰、可演进。

### D6：新增数据库领域（遵循仓库数据规范）

所有新表用 `ulidPrimaryKey()/ulidColumn()`、`tenant_id`（业务）、必要 `branch_id`、审计 `createdBy/updatedBy`、软删 `deletedAt/deletedBy`、`version`；offline 相关表带 `deviceId` 与幂等键。新增：

- `commerce/customer-auth.ts`：`customer_credentials`、`customer_auth_otps`、`customer_auth_refresh_tokens`。
- `appointments/appointments.ts`：`appointments`（type=pickup/dropoff、status=pending/accepted/cancelled/done、期望时间、地址、关联 customer/branch）。
- `delivery/delivery-tasks.ts`：`delivery_tasks`（assignee=driver userId、status 状态机、关联 order/ticket、客户地址快照）。
- `delivery/delivery-task-events.ts`：`delivery_task_events`（每次状态变更 + 经纬度 + 时间 + idempotencyKey + deviceId）。
- `delivery/delivery-proofs.ts`：`delivery_proofs`（任务关联、类型=取件/送达/签收、媒体引用、idempotencyKey）。
- 各领域建 `index.ts` 并在 `schema/index.ts` 注册；`commerce/index.ts` 追加 `customer-auth`。

### D7：配送任务状态机集中定义

状态：`pending_dispatch → en_route → arrived → picked_up → delivering → signed`，可旁路到 `exception`。状态转移表集中在 `delivery` service（或 `packages/domain`），controller 只调用 service 校验合法转移，非法转移返回 409 + 当前合法可选状态。签收写入 `delivery_proofs` 并置终态。

### D8：轻离线 = 客户端队列 + 服务端幂等

- `packages/offline` 补最小原语：`enqueue/peek/markSynced/replay`，持久化用 Capacitor Preferences（MVP）；每个离线操作生成 `idempotencyKey`（ULID）。
- 服务端：状态更新/凭证/签收接口接受 `idempotencyKey`，按 `(taskId, idempotencyKey)` 唯一约束去重；重复回放只生效一次。
- 冲突最小规则：服务端任务为终态（signed/done）时，拒绝较旧中间态覆盖，返回权威状态（HTTP 409 + 当前态）。
- **Non-Goal**：不做字段级三方合并；只做「终态保护 + 幂等去重 + 顺序回放」。

### D9：`packages/api-client` 新增 `src/mobile/*` + Bearer provider

- 新增 `mobile-client.ts` 与 `src/mobile/{auth,customer,delivery,owner}.ts(+ .types.ts)`，按域组织、不堆大文件（遵循 api-client 规范）。
- HTTP 层支持「token provider」注入 `Authorization` 头（从 `apps/mobile-web` 注入读取原生存储的 token 的函数），替代 cookie `credentials: include`。
- `apps/mobile-web/src/lib/api-client.ts` 做环境与 token 注入；页面经 `features/**/queries|actions` 调用，不散落 `fetch`。

### D10：拍照凭证上传（MVP 最小化）

- MVP：移动端把照片以 `multipart`/base64 经 `/mobile/delivery/.../proofs` 上传，API 落存储并在 `delivery_proofs` 存引用（路径/URL）。存储后端先用本地/对象存储抽象的最简实现，接口形态保持可替换。
- **Non-Goal**：CDN、缩略图、压缩流水线留二期。

## Risks / Trade-offs

- **[多租户/越权泄露]** 配送员看到他人任务、客户看他人订单、跨租户访问 → 所有 mobile 查询强制带令牌中的 `tenantId` 过滤，配送任务额外校验 `assignee == 当前 driver`；spec 中以隔离场景作为验收用例与测试。
- **[离线重复提交]** 网络抖动导致重复回放 → 全部高风险写操作（状态/凭证/签收）强制 `idempotencyKey` + 唯一约束；遵循仓库「高风险动作需幂等键」规范。
- **[状态机错乱]** 离线乱序回放 → 终态保护 + 合法转移校验，非法/过旧转移返回 409 不静默覆盖。
- **[Bearer 与 Cookie 双体系]** 误把移动中间件挂到 web 路由或反之 → 移动中间件只挂 `/mobile/*`，web/POS 维持 `createRequireAuthMiddleware`；两套互不引用。
- **[静态导出限制]** 误用 SSR/middleware/动态路由服务端能力 → `apps/mobile-web` 评审约束：无 server actions、无 middleware、无 `cookies()`；CI/构建以 `next build && export` 验证。
- **[OTP 无真实短信]** 验收受阻 → MVP 提供测试通道返回/读取验证码，真实供应商二期接入（接口形态预留）。
- **[配送员角色侵入既有 RBAC]** 新增 `driver` 角色与 `AdminRole` 联合类型 → 仅新增不改既有角色语义；种子脚本幂等。
- **[Capacitor 原生权限差异]** Android/iOS 权限配置不同 → 在两端 native 工程分别声明 GPS/相机权限，并对拒绝授权做降级提示。

## Migration Plan

1. Schema 先行：新增 `customer-auth`、`appointments`、`delivery/*` 表与 `driver` 角色种子 → `pnpm db:generate` → `pnpm db:migrate` → `pnpm --filter @cleanhub/db typecheck`。
2. 后端：`modules/mobile/{auth,customer,delivery,owner}` 与 `/mobile/*` 路由 + 移动鉴权中间件；`apps/api` typecheck/build。
3. api-client：新增 `src/mobile/*` 与 mobile-client；build。
4. 前端：`apps/mobile-web` 页面与 features；`next build`/export 通过。
5. 壳：`apps/mobile` 接 mobile-web 产物，`cap sync android/ios` 通过。
6. 离线：`packages/offline` 队列原语 + 客户端接入。
- **回滚**：移动端为纯新增（新 app + 新 `/mobile/*` 模块 + 新表），不改既有路由/认证；回滚=移除 `/mobile/*` 挂载并保留未引用的新表（或回退 migration），对 web/POS 零影响。

## Open Questions

- 配送任务的派单来源：MVP 是否允许后台/Owner 手动指派（写侧），还是仅消费既有数据 + 种子任务用于验收？（建议：MVP 先支持最简「指派给 driver」的写入或种子，保证配送链路可验收。）
- 客户预约是否需要选择 branch，还是按 tenant 默认 branch？（建议：MVP 关联 tenant 默认/单一 branch，多分店选择二期。）
- 凭证存储后端选型（本地卷 vs S3 兼容对象存储）：MVP 用抽象 + 最简实现，需经理确认部署侧存储。
- iOS 上架与签名证书是否本期需要，还是仅本地/内测构建通过即可。

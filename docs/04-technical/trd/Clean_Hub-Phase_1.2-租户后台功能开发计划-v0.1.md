# CleanHub Phase 1.2 租户后台功能开发计划 v0.1

| 版本 | 日期 | 状态 | 说明 |
| ---- | ---- | ---- | ---- |
| v0.1 | 2026-05-22 | Draft | 租户后台后端功能开发、AI 生成正式页面、团队任务分配与验收计划 |

---

## 1. 文档目的

本文档用于指导 CleanHub **第二次开发波次（Phase 1.2）**——租户后台（Tenant Admin）功能开发，重点解决以下问题：

- 明确租户后台需要开发的后端接口和基础前端页面。
- 明确与 Phase 1.1（SaaS 平台后台）的衔接规则：**首个 Owner 开通**、租户状态、功能开关、审计分域。
- 规划文件所有权，尽量避免多人同时修改同一个文件。
- 约束 AI 生成代码时的边界，降低权限、审计、租户隔离等关键偏差。
- 为测试、联调和验收提供统一依据。
- 为 **核心难点**（开户、员工 PIN、权限、备份边界等）提供逐步逻辑对照（§19）。

本次开发优先目标是跑通 **Owner / Manager** 在 `/tenant` 下的经营配置闭环（门店、员工、服务、价格），为后续 POS / Desktop 提供主数据。前端页面允许由 AI 先生成基础页面，视觉、交互和设计细节后续再统一调整。

---

## 2. 参考文档

开发前应阅读以下文档：

```text
README.md
README.zh-CN.md
docs/README.md
docs/03-design/ui-design/ClanHub Phase 1.1 UI.md
docs/01-product/prd/Clean_Hub-prd-v0.1.md
docs/01-product/phase-scope/Clean_Hub-Phase_1范围与验收标准.md
docs/01-product/backlog/Clean_Hub-Phase_1-Backlog初稿.md
docs/04-technical/trd/Clean_Hub-Phase_1-Web_Admin基础模块-TRD-v0.1.md
docs/04-technical/trd/Clean_Hub-Phase_1.1-SaaS平台功能开发计划-v0.1.md
docs/04-technical/api/Clean_Hub-API_Client使用说明.md
docs/04-technical/database/Clean_Hub-Drizzle数据库迁移操作详解.md
```

---

## 3. 项目背景

CleanHub 是面向洗衣、压烫、干洗、洗车、POS、硬件接入、本地支付和多门店管理的多租户 SaaS 平台。

Phase 1.1 已完成 SaaS 平台侧能力：创建试点租户（**仅租户组织数据**：`tenants`、`tenant_settings`、`tenant_feature_flags`）、平台成员、平台审计等。**未**包含「首个可登录的租户 Owner 账号」。

Phase 1.2 的目标是：

- **补齐 1.1 缺口**：SaaS 创建租户时**同一事务**开通首个 **Owner** 账号，使商户能立即登录租户后台（见 §3.1）。
- 商户 **Owner / Manager** 登录 `/tenant` 后，能配置本租户的门店、员工、服务目录与标准价格。
- 所有租户业务数据强制 `tenant_id` 隔离；门店级数据带 `branch_id`。
- 敏感写操作写入 `audit_logs`，供租户操作日志页与 SaaS 排查使用。
- **不在 Tenant Admin 实现离线能力**；断网营业由 `pos-web` + `desktop` + `packages/offline` 在后续开发实现。

本阶段不追求完整订单收银、完整报表 BI、完整通知供应商接入、完整 POS 闭环。

### 3.1 Phase 1.1 → 1.2 衔接缺口（P0，必须补齐）

| 现状（1.1 已实现） | 缺口 | 1.2 必须补齐 |
| ------------------ | ---- | ------------ |
| `POST /saas/tenants` 创建租户档案 | **未**创建 `users`（Owner） | 扩展创建租户流程，**同步创建首个 Owner** |
| 本地 seed 可登录 `/tenant` | 生产/试点不能依赖 seed | 验收用例：**SaaS 新建租户 → Owner 可登录** |
| 1.2 `tenant-users` 可建员工 | 无首个 Owner 则无人可进后台建员工 | 先有 Owner，再有员工 CRUD |

**结论**：1.1 与 1.2 **不是接不上**，而是 1.1 只做了「租户档案」，1.2 负责把「可登录的商户管理员」接上。若不在 1.2 补齐，整个租户后台无法验收。

**产品逻辑**（业务上可理解为三步，与 1.1 未实现部分对应）：

```text
① SaaS 创建租户（组织档案：tenants、settings、feature_flags）
② SaaS 为该租户创建「人」的账号（邮箱 + 密码 + PIN），写入 users
③ 将该用户绑定到该租户，角色 = Owner（user_roles）
```

**说明**：**租户（Tenant）本身不能登录**；能登录的是 **users 表里的商户员工账号**。`POST /saas/users`（1.1 已有）创建的是 **平台成员**（`userType=saas`，`tenantId=null`），**不能**用来给商户开店。

**登录链路**（补齐后）：

```text
SaaS super_admin 完成 ①②③（见 §12.0）
商户 Owner 在 /login：邮箱/手机 + 密码 + Tenant code（pressingCode）
  -> 进入 /tenant 工作台（tenant-overview，§12.1）
  -> 在 /tenant/users 继续创建 Manager / Cashier
```

### 3.2 核心概念速查

| 概念 | 是什么 | 能否登录 | 本阶段谁实现 |
| ---- | ------ | -------- | ------------ |
| **租户（Tenant）** | `tenants` 表中的一条商户组织记录 | 否 | 1.1 已有；1.2 扩展开户 |
| **Owner** | 该租户下的 **用户账号** + 角色 `owner` | 是，进 `/tenant` | 1.2 P0（赵付杰，§12.0） |
| **平台成员** | `userType=saas`，CleanHub 运营/客服 | 是，进 `/saas` | 1.1 已有（`POST /saas/users`） |
| **工作台概览** | Owner 登录后首页 `/tenant` 的经营数字卡片 | — | 1.2 P0（赵付杰，`GET /tenant/overview`） |

---

## 4. 本次开发目标

本次开发目标是完成租户后台基础功能闭环：

0. **（P0 衔接）** SaaS 创建租户时同步创建首个 **Owner** 账号（密码 + PIN，`status = active`）；SaaS 创建租户页展示初始 Owner 表单。
1. 租户用户（Owner / Manager）可以登录并进入 `/tenant` 工作台。
2. 可以查看本租户经营概览（指标可先占位，待订单 API 接入后替换）。
3. 可以管理门店：列表、创建、详情、编辑、启用/停用。
4. 可以管理员工：列表、**创建员工账号**（含 PIN）、编辑、启用/禁用（禁用后吊销 refresh token）。
5. 可以管理服务目录与标准价格（按件 / 按公斤等 Phase 1 计价方式）。
6. 可以查看本租户操作日志（审计日志，租户范围；支持按门店筛选）。
7. 可以查看/维护租户设置（语言、货币等；功能开关只读，来源于 SaaS 配置）。
8. P1：硬件配置、通知配置入口、基础报表、数据备份、个人中心流程页。
9. 前端页面由 AI 生成，先保证流程跑通，不要求最终视觉质量。
10. 补强 SaaS 侧审计查询：支持按 `tenantId` 筛选（小改动，与 1.2 联调）。

---

## 5. 本期不做内容

以下内容不纳入 Phase 1.2：

1. Tenant Admin **离线模式**、本地同步队列、Service Worker 离线缓存。
2. 完整 POS 下单、收款、打印、订单查询（留给 1.3 或 POS 专项）。
3. 完整客户管理、会员、营销、库存、HR。
4. 真实 WhatsApp/SMS/Email 通知发送与模板审核。
5. 真实执行数据库 备份/恢复命令；仅任务记录与恢复申请。
6. 细粒度按钮级权限编辑器。
7. SaaS 侧修改租户功能开关（仍在 `/saas`；Tenant 只读展示）。
8. 多门店高级对比报表、高级 BI。
9. 在 Tenant 模块中修改 `packages/ui/src/components/ui/**`。

---

## 6. 团队成员

| 姓名 | 分工原则 |
| ---- | ---- |
| 李龙杰 | 负责 **Day 1 阻塞项**：Tenant 经营主数据 **schema 初始定稿**（含 `hardware_configs` 等全部新表）、**`db:generate` / `db:migrate` / `schema/index.ts` 首次导出**、**Tenant `permission.helper` 初始扩展**、审计命名规范；代码审核、任务统筹与验收推进 |
| 杨序 | **Phase 1.2 后续 schema 补丁**（尤其 `hardware_configs`，李龙杰审核）；公共技术整合（`app.ts`、`packages/api-client` 租户聚合、集成检查）；**`tenant-users`**（员工 CRUD、PIN、禁用吊销 token、**`createTenantOwnerUser` helper**）；租户审计、SaaS `tenantId` 筛选；**硬件配置**（`tenant-hardware`） |
| 武帅杰 | 负责租户门店（branches）核心模块；**通知配置**（`tenant-notifications`，P1 占位为主）及对应前端 |
| 赵付杰 | **P0 阻塞**：`saas-tenants` 扩展 `initialOwner`（调用杨序提供的用户创建 helper）+ SaaS 创建租户页；**租户设置**（`tenant-settings`）；**工作台概览**（`tenant-overview` + `/tenant` 页）及对应前端 |
| 孙蕊蕊 | 负责服务目录、价格册、数据备份、基础报表及对应前端；操作日志页对接（消费杨序提供的 audit API） |
| 许婧姝 | 负责接口文档、测试用例、验收记录、AI 输出核查 |

分工原则：

- **数据库（初始 → 后续补丁）**：
  - **李龙杰（Day 1 阻塞）**：完成 Phase 1.2 **全部新表初始 schema**（含 **branches、services、prices、notification_settings、hardware_configs、user_branches（预留）**、`users.pin_hash` 等），写入 `packages/db/src/schema/**`；在同一 PR 内执行 `pnpm db:generate`、`pnpm db:migrate`，维护 **`packages/db/src/schema/index.ts` 首次导出**；并完成 **Tenant `permission.helper` 初始扩展**（`assertTenantContext`、`requireTenantRole`、`assertActiveTenant`、`requireFeatureEnabled`）；制定 §16 审计 `eventCategory` 命名表。
  - **杨序（后续）**：Phase 1.2 开发过程中，若 **`hardware_configs` 等表**需增删改字段、索引或约束，由杨序提交 **schema 补丁迁移 PR**（须先与李龙杰确认字段方案，李龙杰审核合并）；**不负责** Day 1 初始建表与首次迁移。
  - **模块负责人不得自行 `db:generate` 或新增表**；缺字段/缺表先报 **李龙杰** 定初始或变更方案；**初始**由李龙杰落库，**后续补丁**（尤其 `hardware_configs`）由杨序落迁移。
- **`hardware_configs`**：初始表结构由 **李龙杰** 在 Day 1 schema PR 中一并定义（§13.5）；杨序实现 `tenant-hardware` 业务时若需改表，走 **后续补丁** 流程，不自行改初始 PR。
- 公共路由挂载、`packages/api-client/src/tenant/index.ts`、**`app.ts` Tenant 路由统筹** 由杨序负责（须在 **李龙杰初始 schema PR 合并**、全员 `pnpm db:migrate` 之后），李龙杰审核合并顺序。
- **Day 1 开户链路（阻塞）**：**杨序** 上午优先交付 **`createTenantOwnerUser` helper**（放在 `tenant-users` 模块）；**赵付杰** 在同一日上午完成 §12.0（`POST /saas/tenants` + `initialOwner`，**调用该 helper**）并验证 Owner 登录 `/tenant`。
- **赵付杰** 下午做 `tenant-overview`、`tenant-settings` 骨架；**杨序** 下午启动 `tenant-users` 列表/创建接口（员工 CRUD 全量在 Day 2–3 收尾）。
- 武帅杰负责 P0 门店；赵付杰负责 SaaS 开户 UI + 工作台/设置；**员工管理复杂度最高，由杨序负责**。
- 杨序另负责硬件配置（P1）、集成与 audit；表结构补丁走 §13.0 后续流程。
- 孙蕊蕊负责服务/价格、备份、报表等；操作日志页前端与杨序的 `tenant-audit` API 联调。
- 许婧姝负责测试与验收文档。
- 所有人使用 AI 辅助开发，但必须人工核查权限、审计、租户隔离和错误处理。

---

## 7. 技术栈与项目结构

### 7.1 技术栈

与 Phase 1.1 一致：

| 类型 | 技术 |
| ---- | ---- |
| 包管理 | pnpm |
| Monorepo | Turborepo |
| 后端 API | TypeScript + Hono |
| 数据库 | PostgreSQL + Drizzle ORM |
| 前端 | Next.js（`apps/web-admin` 下 `(tenant)` 路由组） |
| 样式 | Tailwind CSS |
| API Client | `packages/api-client` |
| 日志 / 审计 | `@cleanhub/logger`、`audit_logs` + `writeAuditLog` |
| ID | `@cleanhub/id` ULID |

### 7.2 主要目录

```text
apps/api/src/modules/
  saas-tenants/          # 1.2 扩展：创建租户 + initialOwner（赵付杰，李龙杰审核）
  tenant-branches/
  tenant-users/
  tenant-services/
  tenant-prices/
  tenant-hardware/
  tenant-notifications/
  tenant-backups/
  tenant-audit/          # 租户范围审计日志查询
  tenant-overview/
  tenant-settings/
apps/web-admin/src/
  app/(tenant)/tenant/
  features/tenant/
packages/api-client/src/tenant/
packages/db/src/schema/
```

### 7.3 后端分层

与 Phase 1.1 相同：

```text
routes -> controller -> service -> repository -> db
```

- 请求校验使用 Zod。
- 业务逻辑不得写在 Next.js Route Handler 中。
- 敏感写操作必须调用 `writeAuditLog`（`apps/api/src/modules/audit/audit.helper.ts`）。

---

## 8. 核心开发原则

在 Phase 1.1 原则基础上，本阶段增加：

1. 所有 `/tenant/**` API 必须校验：`authContext.userType === "tenant"` 且 `authContext.tenantId` 非空。
2. SaaS 用户（`userType === "saas"`）访问 `/tenant/**` 必须返回 `403`（除未来明确设计的代操作接口）。
3. 查询与写入必须带 `tenant_id = authContext.tenantId`，禁止信任前端传入的 `tenantId` 覆盖当前租户。
4. 若 SaaS 在 Phase 1.1 已停用租户（`tenants.status !== active`），`/tenant/**` 统一返回 `403`。
5. 业务 API 必须尊重 `tenant_feature_flags`（只读）：未开通能力不得创建对应业务数据；API 返回 `403` 或 `FEATURE_DISABLED`，不能只隐藏菜单。
6. Manager 门店数据范围见 **§8.2（Phase 1.2 默认决策）**；schema 预留 `user_branches`（或等价关联）供后续 POS 使用。
7. 租户操作日志查询范围：**本租户全部记录**，可选 `branchId` 筛选；不是「仅门店级」独立日志表。
8. **不实现 Tenant 离线**；schema 保留 `version`、软删除字段，供后续 POS 同步使用。
9. 改价、禁员工、改门店、改服务等必须写 `audit_logs`，`eventCategory` 建议使用 `tenant_*` 前缀。

### 8.1 租户角色与权限矩阵（Phase 1.2 默认）

前端路由守卫见 `Clean_Hub-Phase_1-Web_Admin基础模块-TRD-v0.1.md` §5.2：`/tenant/**` 仅允许 `owner`、`manager` 进入；**Cashier 不得进入 Tenant 后台**（无 `/tenant` 菜单，API 返回 `403`）。

后端在 `assertTenantContext` 之后，按角色与模块校验（可与 `requireTenantRole` 组合；细粒度 `tenant:*` 权限点见 Web Admin TRD §5.3，Phase 1.2 以角色为主）：

| 模块 / 操作 | Owner | Manager | Cashier |
| ----------- | ----- | ------- | ------- |
| 进入 `/tenant` 路由 | ✅ | ✅ | ❌ |
| `GET /tenant/overview` | ✅ | ✅ | ❌ |
| 门店 CRUD / 启用停用 | ✅ | ✅ | ❌ |
| 员工列表 / 详情 | ✅ | ✅ | ❌ |
| 创建员工 / 编辑资料 / 重置 PIN / 禁用 | ✅ | ✅ | ❌ |
| 服务目录 / 价格维护 | ✅ | ✅ | ❌ |
| 操作日志查询 | ✅ | ✅ | ❌ |
| 租户设置 `PATCH` | ✅ | ❌ | ❌ |
| 租户设置 `GET`（含只读功能开关） | ✅ | ✅ | ❌ |
| 硬件 / 通知 / 备份 / 报表（P1） | ✅ | ✅（备份创建建议仅 Owner，见 §19.7） | ❌ |
| 个人中心（§12.13） | ✅ | ✅ | ❌ |
| `POST /auth/logout` | ✅ | ✅ | ✅（POS 侧，非 Tenant 页） |

实现注意：

- **Cashier**：`userType = tenant`，仅用于 POS（Phase 1.3）；不得调用任何 `/tenant/**` 写接口或配置读接口（除未来明确的 POS API）。
- **Owner**：租户内最高权限；**仅 Owner** 可 `PATCH /tenant/settings`。
- **Manager**：与 Owner 共享经营主数据写权限；**不可**改租户级设置与功能开关。
- 禁止通过 `POST /saas/users` 创建商户员工；商户员工仅 `POST /saas/tenants` + `initialOwner` 或 `POST /tenant/users`。

### 8.2 Manager 门店范围（Phase 1.2 默认决策）

为避免 `user_branches` 未落地时阻塞 P0，**本阶段采用下列固定方案**（验收与 Code Review 以此为准）：

| 项 | Phase 1.2 交付 | 后续波次 |
| -- | -------------- | -------- |
| `user_branches`（或等价表） | **李龙杰** 在初始 schema 中**预留**（`user_id` + `branch_id`）；创建/更新员工时 **可写入** `branchIds` | Phase 1.3+ 启用 API 层 `branch_id` 过滤 |
| 门店/服务/价格/员工 **列表与写操作** | Owner、Manager 均按 **全租户** `tenant_id` 过滤，**不按** `branchIds` 限制 | Manager 仅能见授权门店 |
| `GET /tenant/audit-logs` | Owner、Manager 均返回 **本租户全部** 日志；支持查询参数 `branchId` 筛选，**不**对 Manager 强制过滤 | Manager 默认仅授权门店 + `branch_id IS NULL` 的租户级记录 |
| 报表 `GET /tenant/reports/summary` | 全租户占位数据；`branchId` 参数可选但不强制 | 与门店范围一致 |

**结论**：文档与验收中「Manager 门店范围」在 1.2 **不作为 P0 阻塞项**；杨序在 `tenant-users` 落库 `branchIds` 即可，过滤逻辑留待 POS/多门店强化阶段。

---

## 9. 与 Phase 1.1 的衔接

| 衔接点 | Phase 1.1（SaaS） | Phase 1.2（Tenant） |
| ------ | ----------------- | ------------------- |
| 租户生命周期 | 创建/停用租户 | 停用后 Tenant API 拒绝访问 |
| 功能开关 | `tenant_feature_flags` 写入 | Tenant 只读展示；菜单与 API 按开关隐藏/拒绝 |
| 语言/货币 | `tenant_settings` 初始化 | 租户设置页可改 `defaultLanguage` 等，写审计 |
| 平台成员 vs 员工 | `saas` 用户 `tenantId = null` | `tenant` 用户必须带 `tenantId` |
| **首个 Owner** | 1.1 **未**创建租户侧 `users` | 1.2 扩展 `POST /saas/tenants` + `initialOwner`（§12.0） |
| 审计日志 | `/saas/audit-logs` 查全表 | `/tenant/audit-logs` 仅本租户；SaaS 增加 `tenantId` 筛选 |
| 登录审计 | `auth.*` 写入 `audit_logs` | 租户用户登录同样进入 `auth`，Tenant 日志页可见 |

创建租户时 SaaS 已初始化 `tenant_settings`、`tenant_feature_flags` 的，Phase 1.2 **不得重复实现** SaaS 侧初始化逻辑，只扩展 **首个 Owner 账号** 与 Tenant 后台能力。

---

## 10. 租户后台模块清单

| 模块 | 说明 | 优先级 |
| ---- | ---- | ---- |
| **SaaS 租户开户（衔接 1.1）** | 扩展 `POST /saas/tenants` + `initialOwner`；SaaS 创建租户页「首任管理员」区块（赵付杰） | **P0 阻塞** |
| 经营工作台 | 今日订单/营收等待办（可先统计占位） | P0 |
| 门店管理 | 门店 CRUD、启用/停用 | P0 |
| 员工管理 | 员工 CRUD、PIN、启用/禁用、token 吊销（**杨序**，§12.3） | P0 |
| 服务目录 | 分类、服务项目、计价方式、启用/停用 | P0 |
| 价格管理 | 标准价格维护 | P0 |
| 操作日志 | 本租户 `audit_logs` 查询，按门店筛选 | P0 |
| 租户设置 | 语言、货币、时区等；功能开关只读 | P0 |
| 基础报表 | 今日指标、支付方式汇总入口 | P1 |
| 硬件配置 | 打印机/扫码枪/钱箱配置入口 | P1 |
| 通知配置 | 渠道开关、模板占位 | P1 |
| 数据备份 | 本租户备份状态、手动备份、恢复申请 | P1 |
| 个人中心 | 资料、语言、改密入口 | P1 |

---

## 11. 租户平台功能布局

侧边栏与分组以 `apps/web-admin/src/config/navigation.ts` 中 `webAdminSidebarNavigation.tenant` 为准。下文按 **侧边栏 → 功能点 → 页面能力/字段** 三层描述，便于 AI 生成页面、前后端对齐和验收勾选。

**约定**

- **删除**：业务数据一律软删除（`deleted_at`），页面上以 **停用/禁用** 为主，不做物理删除按钮（除非未来单独审批流）。
- **权限**：Owner / Manager 可写主数据；Cashier 不可进入 Tenant 后台；具体见 **§8.1 权限矩阵**。
- **功能开关**：未开通业务线（`tenant_feature_flags`）时，对应侧边栏入口隐藏，且 API 返回 `403` / `FEATURE_DISABLED`。
- **占位**：依赖订单/POS API 的指标与列表，Phase 1.2 允许 Empty / 占位数字，须在页面标注「待订单模块接入」。

### 11.0 侧边栏结构总览

```text
Tenant Admin (/tenant)
├── Main（主菜单）
│   ├── 工作台 Dashboard          /tenant
│   ├── 用户管理 User Management  /tenant/users
│   └── 报表 Reports              /tenant/reports
├── Configuration Management（配置管理）
│   ├── 门店设置 Branch Settings           /tenant/branches
│   ├── 服务目录 Service Catalog           /tenant/services
│   ├── 价格册 Price Books                 /tenant/prices
│   ├── 硬件设备 Hardware Devices          /tenant/hardware
│   └── 通知配置 Notifications             /tenant/config/notifications
├── System Settings（系统设置）
│   ├── 操作日志 Operation Logs            /tenant/system/logs
│   ├── 数据备份 Data Backups              /tenant/system/backups
│   └── 租户设置 Tenant Settings        /tenant/system/settings
└── 顶栏 / 用户菜单（非侧边栏）
    ├── 个人中心 Profile                   /tenant/profile
    └── 退出登录                           POST /auth/logout
```

| 侧边栏分组 | 菜单项（中文 / 英文） | 路由 | 优先级 |
| ---------- | --------------------- | ---- | ------ |
| Main | 工作台 / Dashboard | `/tenant` | P0 |
| Main | 用户管理 / User Management | `/tenant/users` | P0 |
| Main | 报表 / Reports | `/tenant/reports` | P1 |
| Configuration Management | 门店设置 / Branch Settings | `/tenant/branches` | P0 |
| Configuration Management | 服务目录 / Service Catalog | `/tenant/services` | P0 |
| Configuration Management | 价格册 / Price Books | `/tenant/prices` | P0 |
| Configuration Management | 硬件设备 / Hardware Devices | `/tenant/hardware` | P1 |
| Configuration Management | 通知配置 / Notifications | `/tenant/config/notifications` | P1 |
| System Settings | 操作日志 / Operation Logs | `/tenant/system/logs` | P0 |
| System Settings | 数据备份 / Data Backups | `/tenant/system/backups` | P1 |
| System Settings | 租户设置 / Tenant Settings | `/tenant/system/settings` | P0 |
| 顶栏 | 个人中心 / Profile | `/tenant/profile` | P1 |

---

### 11.1 Main（主菜单）

#### 11.1.1 工作台（Dashboard）

- **路由**：`/tenant`
- **功能点**：查看经营概览；查看待办/快捷入口；跳转门店/员工/服务/报表（只读跳转，不在此页改数据）

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 经营概览卡片 | 今日订单数、今日营收、待取订单数、进行中订单数、待处理事项数（无订单 API 时可占位 `0` 或 `--`） |
| 快捷入口 | 门店管理、员工管理、服务目录、价格册、报表（按权限与功能开关显示） |
| 待办事项 | 待处理备份、配置未完成提示等（P1 可先占位列表） |

#### 11.1.2 用户管理（User Management）

- **路由**：`/tenant/users`
- **功能点**：查看员工列表；搜索与筛选；**创建员工账号**（非邀请制）；查看员工详情；编辑员工资料；分配角色与门店；**管理员重置员工 PIN**（须填写原因，写审计）；启用/禁用员工（禁用后吊销 refresh token，不可再登录）

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 员工列表 | 姓名、手机号、角色（Owner / Manager / Cashier）、绑定门店、账号状态、最近登录时间（可选）、搜索（姓名/手机）、筛选（门店 / 角色 / 状态）、分页 |
| 新建员工账号 | 姓名、手机号、角色、绑定门店（Manager 仅能在授权门店内分配）、**PIN（必填，4–6 位数字）**、初始密码（Owner / Manager 登录 Tenant 后台用；Cashier 可仅 PIN）、提交校验；创建成功后账号为 **`active`**，不走 `invited` 待激活流程 |
| 员工详情 / 编辑 | 基础资料、角色、门店绑定、启用状态、创建/更新时间；保存；**重置 PIN**（独立操作，见下表，不回显旧/新 PIN）；启用/禁用（写审计） |
| 重置 PIN 弹窗 | **新 PIN**（4–6 位数字）、**确认新 PIN**、**重置原因**（必填，如「员工遗忘 PIN」「岗位交接」「安全风险」）；仅 Owner / Manager 可操作；提交后写审计 |

#### 11.1.3 报表（Reports）

- **路由**：`/tenant/reports`
- **功能点**：查看经营摘要；按日期筛选；查看支付方式汇总；Z Report 入口占位

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 报表摘要 | 选定日期范围内：订单数、营收金额、现金/移动支付占比、待取/进行中订单数（依赖订单 API，未接入时 Empty） |
| 筛选 | 日期范围（今日 / 昨日 / 自定义）、门店（Owner 全部门店；Manager 授权门店） |
| 导出 / Z Report | 导出按钮、Z Report 入口占位（P1，不阻塞 1.2 验收） |

---

### 11.2 Configuration Management（配置管理）

#### 11.2.1 门店设置（Branch Settings）

- **路由**：`/tenant/branches`；详情 `/tenant/branches/[branchId]`
- **功能点**：查看门店列表；新建门店；查看门店详情；修改门店信息；启用/停用门店（软删除，不物理删除）

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 门店列表 | 门店名称、地址、电话、营业状态（启用/停用）、默认语言、默认货币、创建时间；搜索（名称/电话）；状态筛选；新建门店 |
| 新建门店 | 名称、地址、电话、营业时间、默认语言、默认货币、小票店名/电话/地址、Logo URL 预留、提交（写审计） |
| 门店详情 | 同上字段只读展示 + 编辑保存；启用/停用切换（写审计）；返回列表 |

#### 11.2.2 服务目录（Service Catalog）

- **路由**：`/tenant/services`
- **功能点**：查看服务分类与服务项目；新建/编辑分类（P1 可与服务合并）；新建/编辑服务；设置计价方式；启用/停用服务；按业务线功能开关控制入口

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 服务列表 | 分类名称、服务名称、计价方式（按件 `per_item` / 按公斤 `per_kg`）、状态、更新时间；搜索；分类筛选；新建服务 |
| 服务编辑 | 名称、所属分类、计价方式、描述（可选）、启用/停用；保存（写审计） |
| 业务线约束 | 未开通洗衣/洗车/配送等能力时，对应分类或服务不可创建（API + 菜单双重校验） |

#### 11.2.3 价格册（Price Books）

- **路由**：`/tenant/prices`
- **功能点**：查看标准价格列表；按服务/分类筛选；修改标准价格；查看改价影响提示；改价写审计

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 价格列表 | 服务名称、分类、计价单位、标准单价、币种、状态、最后修改时间；按服务/分类筛选；行内或弹窗编辑价格 |
| 改价交互 | 新价格输入、生效说明（已确认订单价格不变）、确认保存；保存后写 `tenant_price` 审计 |
| 空状态 | 无服务时引导先去服务目录配置 |

#### 11.2.4 硬件设备（Hardware Devices）

- **路由**：`/tenant/hardware`
- **功能点**：查看设备列表；按门店筛选；新建设备配置；编辑设备；绑定门店；启用/停用设备

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 设备列表 | 设备名称、设备类型（打印机 / 扫码枪 / 钱箱）、所属门店、连接方式（USB / 蓝牙 / 网络 / 其他，占位）、状态、更新时间 |
| 新建 / 编辑 | 名称、类型、门店、连接方式、扩展配置 JSON（占位）、启用/停用；保存（写审计） |

#### 11.2.5 通知配置（Notifications）

- **路由**：`/tenant/config/notifications`
- **功能点**：查看通知配置；开关各渠道；编辑默认语言与模板占位；查看发送记录列表占位（不真实发送）

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 渠道配置 | WhatsApp / SMS / Email 开关（占位）、默认通知语言、各场景模板 key 占位 |
| 发送记录 | 时间、渠道、场景、收件人、状态（占位列表，可 Empty） |
| 保存 | 更新配置写 `tenant_notification` 审计；不接入真实供应商 |

> 实现规矩见 **§12.7.1**（武帅杰按该节落地，勿自行接供应商 SDK）。

---

### 11.3 System Settings（系统设置）

#### 11.3.1 操作日志（Operation Logs）

- **路由**：`/tenant/system/logs`；详情可走抽屉或 `/tenant/system/logs/[logId]`（P1）
- **功能点**：查看本租户操作日志列表；多条件筛选；查看单条详情（含变更前后）；不可修改、不可删除

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 日志列表 | 操作时间、操作者、门店、事件分类（`eventCategory`）、事件类型（`eventType`）、对象类型/ID、结果（成功/失败）、IP、变更摘要 |
| 筛选 | 时间范围、事件分类/类型、操作人、门店（`branchId`）、成功/失败 |
| 日志详情 | `before` / `after` JSON、User-Agent、完整 metadata；只读 |

#### 11.3.2 数据备份（Data Backups）

- **路由**：`/tenant/system/backups`
- **功能点**：查看本租户备份任务记录；发起手动备份（仅创建任务记录）；提交数据恢复申请（不直接执行恢复）

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 备份列表 | 任务 ID、范围（租户）、状态（pending / running / succeeded / failed）、发起人、开始/结束时间、失败原因 |
| 手动备份 | 确认弹窗、创建备份任务（写审计）；不执行真实库级 dump |
| 恢复申请 | 选择备份记录、填写原因、提交申请（写审计）；状态跟踪占位 |

#### 11.3.3 租户设置（Tenant Settings）

- **路由**：`/tenant/system/settings`
- **功能点**：查看租户设置；修改默认语言/货币/时区；只读查看 SaaS 下发的功能开关；保存写审计

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 可编辑项 | 默认语言（en / fr / zh-CN）、默认货币、时区；保存 |
| 只读功能开关 | 洗衣、洗车、配送等业务线开关（来自 `tenant_feature_flags`，Tenant 不可改） |
| 说明文案 | 修改功能开关需联系平台方（跳转说明，不链到 `/saas`） |

---

### 11.4 顶栏 / 用户菜单（非侧边栏）

#### 11.4.1 个人中心（Profile）

- **路由**：`/tenant/profile`
- **功能点**：查看与编辑当前登录用户资料；修改个人界面语言；修改密码；查看登录设备列表（可占位）

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 个人资料 | 姓名、手机号、邮箱（若有）、角色、所属租户、绑定门店（只读） |
| 语言偏好 | 界面语言（覆盖租户默认，写入 `user_profiles.language`） |
| 安全 | 修改密码（旧密码 + 新密码）；登录设备列表占位 |

#### 11.4.2 退出登录

- **功能点**：调用 `POST /auth/logout`；清理 HttpOnly Cookie；跳转 `/login`

---

### 11.5 后续波次功能布局（参考，非 Phase 1.2 交付）

以下能力属于 Phase 1 产品全景或 Phase 1.3（POS/订单）范围，**不在本期实现**，仅作为租户后台扩展时的布局参考（与 PRD、Phase 1 范围文档对齐）。

#### 11.5.1 订单与收银（建议 Phase 1.3 + POS）

- **侧边栏（规划）**：订单中心
- **功能点**：订单查询；订单详情；状态跟踪；重印小票（占位）

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 订单查询 | 订单号、客户姓名/手机、订单状态、支付状态、订单金额、取件时间、下单门店、快速筛选（今日/待取/进行中）、分页 |
| 订单详情 | 行项目、计价明细、支付记录、状态时间线、操作人、备注 |

#### 11.5.2 客户管理（Phase 1 产品范围，Tenant 后台入口待定）

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 客户列表 | 姓名、手机号、地址、最近下单时间、搜索（手机/姓名/订单号） |
| 客户详情 | 基础资料、历史订单列表、快速下单入口（链到 POS） |

#### 11.5.3 价格中心（命名对齐 PRD，与 11.2.3 价格册对应）

Tenant Admin 本期以 **价格册（Price Books）** 交付标准价维护；完整「价格中心」可合并以下能力：

| 页面 / 区块 | 能力点与展示字段 |
| ----------- | ---------------- |
| 价格中心 | 衣物/服务分类、服务项目、按件/按公斤价格、启用/停用、价格修改提醒（已确认订单不受影响）、改价审计 |

---

### 11.6 侧边栏与路由对照（速查）

| 侧边栏 | 路由 | 优先级 |
| ------ | ---- | ------ |
| 工作台 | `/tenant` | P0 |
| 用户管理 | `/tenant/users` | P0 |
| 报表 | `/tenant/reports` | P1 |
| 门店设置 | `/tenant/branches`、`/tenant/branches/[branchId]` | P0 |
| 服务目录 | `/tenant/services` | P0 |
| 价格册 | `/tenant/prices` | P0 |
| 硬件设备 | `/tenant/hardware` | P1 |
| 通知配置 | `/tenant/config/notifications` | P1 |
| 操作日志 | `/tenant/system/logs` | P0 |
| 数据备份 | `/tenant/system/backups` | P1 |
| 租户设置 | `/tenant/system/settings` | P0 |
| 个人中心 | `/tenant/profile` | P1 |

### 11.7 SaaS 侧：租户开户与首任管理员（P0 衔接，赵付杰）

与 §12.0 对应，在 **SaaS 后台**（`/saas`）完成，非 Tenant 路由。

| 页面 | 路由 | 功能点 |
| ---- | ---- | ------ |
| 创建租户 | `/saas/tenants/new` | 租户基础信息 + **首任管理员**（姓名、邮箱、密码、PIN）；提交 `POST /saas/tenants`（含 `initialOwner`） |
| 租户详情（可选分步） | `/saas/tenants/[tenantId]` | 展示 Tenant code；若分步开户，提供「添加首任管理员」表单 → `POST /saas/tenants/:tenantId/owners` |
| 创建成功提示 | — | 展示 **Tenant code（pressingCode）**、管理员邮箱；提示商户前往 `/login` 登录 |

**勿与** `/saas/users`（平台成员管理）混淆：平台成员不进商户后台。

---

## 12. API 接口清单

- **§12.0**：SaaS 路径（`/saas/**`），`userType = saas`；用于 **补齐 1.1 租户开户**。
- **§12.1 起**：Tenant 路径（`/tenant/**`），`userType = tenant`；商户登录后使用。

### 12.0 SaaS 创建租户时开通首个 Owner（P0 衔接 1.1）

**背景**：Phase 1.1 的 `POST /saas/tenants` 只创建租户档案，**未**创建可登录的商户管理员。本阶段必须补齐，否则无法验收 Tenant 后台。

**与 `POST /saas/users` 的区别**：

| 接口 | 创建对象 | `userType` | 能否进 `/tenant` |
| ---- | -------- | ---------- | ---------------- |
| `POST /saas/users`（1.1） | 平台运营/客服 | `saas` | 否 |
| `POST /saas/tenants` + `initialOwner`（1.2） | 商户首任 Owner | `tenant` | 是 |

#### 12.0.1 推荐实现：扩展 `POST /saas/tenants`（单事务）

在 Phase 1.1 `POST /saas/tenants` 基础上**扩展请求体**（向后兼容：未传 `initialOwner` 时行为与现网一致；**1.2 验收要求必须传**）。

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| POST | `/saas/tenants` | 创建租户 + **同步创建首个 Owner**（扩展 body） | P0 |

**扩展请求体**（在 Phase 1.1 文档 §10.2 租户字段之外增加）：

```ts
type CreateSaasTenantRequest = {
  // ... 现有 tenants 字段（name, pressingCode, country, contactEmail 等）
  initialOwner: {
    displayName: string;
    email: string;              // 登录 identifier；可与 contactEmail 相同
    phone?: string;
    password: string;           // Tenant 后台登录必填
    pin: string;                // 4–6 位数字，POS/锁屏预留
  };
};
```

**同一事务内顺序**：

```text
写入 tenants
  -> tenant_settings、tenant_feature_flags（已有）
  -> 确保租户级 owner 角色存在（roles，tenant scope）
  -> 写入 users（userType=tenant, status=active, password_hash, pin_hash）
  -> user_profiles
  -> user_roles（role = owner）
  -> audit：tenant.created + tenant_user.created（或 user.created，metadata 含 tenantId）
```

**实现约定**：

- 仅创建 **1 个** Owner；禁止同一租户 0 个或多个 Owner 由本接口批量创建。
- `initialOwner.email` 在租户内唯一（`normalized_email` + `tenant_id`）。
- 响应可返回 `tenant` + `initialOwnerUserId`（不含密码/PIN）。
- **SaaS 前端**（`features/saas/tenants`）：见 §11.7。
- **负责人**：**赵付杰**（`saas-tenants` 扩展、`initialOwner` 同事务编排、SaaS 创建页）；**杨序**（`createTenantOwnerUser` / `createTenantEmployeeUser` helper 及 `tenant-users` 模块，§12.3）。`saas-tenants` 与 `tenant-users` PR 均由 **李龙杰** 审核；`packages/api-client` 分别由赵付杰（`saas/tenants*`）、杨序（`tenant/users*`）维护。

#### 12.0.2 可选：分步 API（产品两步 UI）

若产品希望 **先建租户、再在租户详情添加管理员**，可增加（与 12.0.1 **共用同一套** `createTenantOwnerUser` helper，保证行为一致）：

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| POST | `/saas/tenants/:tenantId/owners` | 为已存在租户创建 **首个** Owner（body 同 `initialOwner`） | P0 可选 |

约束：每个租户在「尚无 Owner」时允许调用一次；已有 Owner 后改由 Owner 在 `/tenant/users` 管理员工。验收时 **至少** 满足 12.0.1 或 12.0.2 一种路径端到端可用。

#### 12.0.3 SaaS 前端形态（二选一或组合）

| 形态 | 说明 |
| ---- | ---- |
| **单页开户** | `/saas/tenants/new` 同一表单：租户信息 + 「首任管理员」区块，一次提交 `initialOwner` |
| **分步开户** | 先提交租户 → 跳转 `/saas/tenants/[tenantId]` →「添加首任管理员」→ 调用 `POST .../owners` |

无论哪种 UI，后端须保证：**未创建 Owner 的租户不能视为开户完成**（列表/详情可展示「待开通管理员」状态）。

### 12.1 经营工作台（`tenant-overview`）

**含义**：商户 **Owner / Manager 登录 `/tenant` 之后看到的首页 Dashboard**（侧边栏「工作台」），**不是** SaaS 后台页面，也 **不是** 创建租户时的 `initialOwner` 表单。

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/overview` | 租户经营概览（订单模块未上线前可先返回占位 `0`） | P0 |

**与 §12.0 的关系**：须 **先** 完成 §12.0，Owner 能登录；**再** 对接本接口渲染 `/tenant` 页。

**「自杨序拆分」**：该模块原划给杨序，因实现量较小（只读聚合、无写审计），改由 **赵付杰** 与 `tenant-settings` 一并交付。

```ts
type TenantOverview = {
  todayOrderCount: number;
  todayRevenueAmount: number;
  pendingPickupCount: number;
  inProgressOrderCount: number;
  pendingTasksCount: number;
};
```

### 12.2 门店管理

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/branches` | 门店列表 | P0 |
| POST | `/tenant/branches` | 创建门店 | P0 |
| GET | `/tenant/branches/:branchId` | 门店详情 | P0 |
| PATCH | `/tenant/branches/:branchId` | 更新门店 | P0 |
| PATCH | `/tenant/branches/:branchId/status` | 启用/停用门店 | P0 |

### 12.3 员工管理（`tenant-users`，杨序）

本模块为 Phase 1.2 **技术复杂度最高**的 Tenant 写操作（PIN、禁用吊销 token、审计）。**`createTenantOwnerUser` helper 须先于 §12.0 `initialOwner` 合并**，供 `saas-tenants` 调用。

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/users` | 员工列表 | P0 |
| POST | `/tenant/users` | **创建员工账号**（非邀请） | P0 |
| GET | `/tenant/users/:userId` | 员工详情 | P0 |
| PATCH | `/tenant/users/:userId` | 更新员工资料（姓名、角色、门店等；**不含 PIN**） | P0 |
| PATCH | `/tenant/users/:userId/pin` | **管理员重置员工 PIN**（见下） | P0 |
| PATCH | `/tenant/users/:userId/status` | 启用/禁用；禁用吊销 refresh token | P0 |

**创建员工账号**（`POST /tenant/users`）请求体建议：

```ts
type CreateTenantUserRequest = {
  displayName: string;
  phone: string;
  role: "owner" | "manager" | "cashier";
  branchIds?: string[];       // Cashier / Manager 绑定门店
  pin: string;                // 必填，4–6 位数字；服务端哈希为 pin_hash 存储
  password?: string;          // Owner / Manager 登录 Tenant 后台；Cashier 可不传
};
```

**更新员工资料**（`PATCH /tenant/users/:userId`）仅改基础资料与角色/门店绑定，**不得**在此接口修改 PIN。

**重置 PIN**（`PATCH /tenant/users/:userId/pin`）——与「创建时设置 PIN」区分：

| 维度 | 创建账号（`POST`） | 重置 PIN（`PATCH .../pin`） |
| ---- | ------------------ | --------------------------- |
| 目的 | 首次为员工建立 POS/锁屏凭证 | 旧 PIN 不可用或需轮换时，由管理员代为设置**新 PIN** |
| 典型场景 | 新员工入职 | 员工**遗忘 PIN**；**岗位/设备交接**；怀疑 PIN 泄露（安全轮换） |
| 操作人 | Owner / Manager | Owner / Manager（Cashier **不可**重置他人 PIN） |
| 请求体 | `pin` 必填 | `pin` + **`reason` 必填**（trim 后 ≥ 1 字，建议 max 300，写入 `audit_logs.reason`） |
| 审计 | `user.created` | `user.pin_reset`（`before`/`after` **不含** PIN 明文或哈希；可记录 `targetUserId`） |

```ts
type ResetTenantUserPinRequest = {
  pin: string;       // 新 PIN，4–6 位数字
  reason: string;    // 必填：说明为何重置（遗忘 / 交接 / 安全等）
};
```

> Phase 1.2 **不做**员工自助「忘记 PIN」邮件/短信找回；遗忘场景由 Owner/Manager 在租户后台执行重置并留痕。POS 端改 PIN / 锁屏解锁属 Phase 1.3 `pos-web` 范围。

员工要求：

- `userType` 固定为 `tenant`。
- `tenantId` 必须为当前登录租户。
- 角色：Owner、Manager、Cashier（Phase 1 基础集）。
- **创建时 `pin` 必填**；使用与 `passwordHash` 相同的哈希策略写入 `users.pin_hash`（禁止明文落库、禁止写入审计日志）。
- 创建成功后 `status` 为 **`active`**；**不使用** `invited` 邀请待激活流程（与 Phase 1 范围「创建员工账号」一致）。
- Owner / Manager 须设置 `password`（Tenant 后台登录）；Cashier 本期以 PIN 为主（POS PIN 登录在 Phase 1.3 对接）。
- Cashier 不得访问 Tenant 敏感配置写接口（API 层校验）。

### 12.4 服务目录

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/service-categories` | 服务分类列表（可与 services 合并接口） | P1 |
| POST | `/tenant/service-categories` | 创建分类 | P1 |
| GET | `/tenant/services` | 服务列表 | P0 |
| POST | `/tenant/services` | 创建服务 | P0 |
| GET | `/tenant/services/:serviceId` | 服务详情 | P0 |
| PATCH | `/tenant/services/:serviceId` | 更新服务 | P0 |
| PATCH | `/tenant/services/:serviceId/status` | 启用/停用 | P0 |

服务字段建议：`name`、`categoryId`、`pricingUnit`（`per_item` | `per_kg`）、`status`、`businessLine`（与 §13.0 功能开关联动）。

业务规则与改价逻辑见 **§19.4、§19.5**。

### 12.5 价格管理

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/prices` | 价格列表（按服务） | P0 |
| POST | `/tenant/prices` | 新增价格项（若与 service 分开） | P1 |
| PATCH | `/tenant/prices/:priceId` | 更新标准价格 | P0 |

每服务标准价 1:1、改价审计等见 **§19.5**。

### 12.6 硬件配置

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/hardware-configs` | 硬件配置列表 | P1 |
| POST | `/tenant/hardware-configs` | 新建设备配置 | P1 |
| PATCH | `/tenant/hardware-configs/:configId` | 更新设备配置 | P1 |

实现边界见 **§19.7**（占位配置，不连真实设备）。

### 12.7 通知配置

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/notification-settings` | 获取通知配置 | P1 |
| PATCH | `/tenant/notification-settings` | 更新通知配置 | P1 |

#### 12.7.1 Phase 1.2 实现约定（配置占位，不发真消息）

**定位**：只持久化「租户想用什么渠道、哪些场景开通知、模板 key / 语言」；**不调用** WhatsApp / SMS / Email 供应商，不存 API Key，不做 webhook。真发送留待订单模块 + 供应商确认后另开任务。

**渠道（多选开关，非单选）**

| 渠道 | 字段 | 说明 |
| ---- | ---- | ---- |
| WhatsApp | `channels.whatsapp.enabled` | 产品主渠道，优先展示 |
| SMS | `channels.sms.enabled` | 备用 |
| Email | `channels.email.enabled` | 补充 |

**业务场景（模板占位）**：`order.created`、`order.ready`、`order.overdue_pickup`、`delivery.updated`（仅当 `delivery_enabled` 时展示/可编辑）。每项：`enabled` + `templateKey`（字符串占位即可）。

**守卫（必须）**

1. `requireFeatureEnabled(authContext, "notifications")`：读 `tenant_feature_flags.notifications_enabled`；SaaS 未开通则菜单隐藏且 API `403` / `FEATURE_DISABLED`。
2. `tenant_id` 一律来自 `authContext`，禁止信任 body 里的 `tenantId`。
3. 写接口：Owner / Manager；Cashier 拒绝。
4. PATCH 必须 `writeAuditLog`：`eventCategory = tenant_notification`，`eventType = notification_settings.updated`，带 `before` / `after`。

**数据**

- 表：`notification_settings`（**每租户一行**，`tenant_id` 唯一；Phase 1.2 不做门店级覆盖，`branch_id` 不建或恒为 null）。
- 配置内容放 **`settings` jsonb**（结构见下）；敏感凭证字段禁止入库。
- 发送记录：本阶段 **可不建表**；前端「发送记录」Tab 固定 Empty + 文案「真实发送将在订单与通知供应商接入后启用」。若建 `notification_deliveries` 仅允许 **只读空列表 API**，不得写入假「已发送」。

**GET / PATCH 载荷（约定形状）**

```ts
type TenantNotificationSettings = {
  defaultLanguage: "en" | "fr" | "zh-CN";
  channels: {
    whatsapp: { enabled: boolean };
    sms: { enabled: boolean };
    email: { enabled: boolean };
  };
  templates: Record<
    | "order.created"
    | "order.ready"
    | "order.overdue_pickup"
    | "delivery.updated",
    { enabled: boolean; templateKey: string }
  >;
  deliveryMode: "not_connected"; // 固定值，前端用来展示「未接入真实发送」
};
```

- 租户创建时由迁移/种子插入默认行（建议：WhatsApp+SMS 开、Email 关、各场景 `enabled: true`、`templateKey` 带租户默认语言后缀）。
- PATCH 用 Zod 校验上述字段；不允许 PATCH `notifications_enabled`（该字段只在 SaaS / 租户设置页只读展示）。

**后端模块**

- 目录：`apps/api/src/modules/tenant-notifications/`（`routes → controller → service → repository`）。
- 仅 **GET + PATCH**；禁止 `POST` 发消息、禁止 `test-send`（除非李龙杰单独立项）。
- `packages/api-client/src/tenant/notifications.ts` 暴露 `getNotificationSettings` / `updateNotificationSettings`。

**前端（武帅杰）**

- 页：`/tenant/config/notifications`；顶部 Banner 标明 **Delivery not connected in Phase 1.2**。
- 三块：渠道开关 | 场景模板表 | 发送记录（Empty）。
- 调用 api-client；保存成功 toast；错误走统一 Empty/Error 态。

**禁止事项**

- 不得引入 Twilio / Meta / SendGrid 等 SDK 或 env 密钥进 Tenant 模块。
- 不得在订单/状态变更里触发发送（1.2 无订单 API）。
- 不得让租户修改 `tenant_feature_flags.notifications_enabled`。

### 12.8 操作日志（审计）

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/audit-logs` | 查询本租户审计日志 | P0 |
| GET | `/tenant/audit-logs/:logId` | 审计详情 | P1 |

查询参数建议：

```text
branchId
actorUserId
eventCategory
eventType
entityType
entityId
success
dateFrom
dateTo
limit
offset
```

服务层强制：`audit_logs.tenant_id = authContext.tenantId`。  
Phase 1.2 **不对 Manager 做门店过滤**（见 §8.2）；`branchId` 仅作可选查询参数，Owner/Manager 均可查本租户全量日志。

### 12.9 租户设置

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/settings` | 租户设置 + 只读功能开关 | P0 |
| PATCH | `/tenant/settings` | 更新可编辑项（语言、货币、时区等） | P0 |

不可通过本接口修改 `tenant_feature_flags`（只读，改开关走 SaaS）。

**命名约定（产品 / 工程）**

| 层面 | 名称 |
| ---- | ---- |
| 菜单（中文） | **租户设置** |
| 菜单（英文） | Tenant Settings |
| 前端路由 | `/tenant/system/settings` |
| API | `GET` / `PATCH` `/tenant/settings` |
| 后端模块目录 | `tenant-settings/` |
| 数据库表 | `tenant_settings`（Phase 1.1 已有，不 rename 表） |
| 审计 `eventCategory` | `tenant_settings`；`eventType` 建议 `settings.updated` |

不使用「租户偏好 / Preferences」作为菜单或对外文案，避免与「个人语言偏好」混淆。

### 12.10 数据备份

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/backups` | 本租户备份任务列表 | P1 |
| POST | `/tenant/backups` | 创建手动备份任务记录 | P1 |
| POST | `/tenant/backups/:backupId/restore-requests` | 提交恢复申请 | P1 |

#### 12.10.1 Phase 1.2 实现约定（任务记录，不执行真实备份）

**定位**：与 SaaS 侧 `saas-backups`（Phase 1.1 §10.7）一致——只持久化备份任务与恢复申请，**不**执行 `pg_dump`、**不**自动恢复生产库。

**守卫**

1. `assertTenantContext` + `assertActiveTenant`。
2. 列表/创建备份、提交恢复申请：**Owner**；Manager 可 **GET** 列表（只读）或按产品统一为 Owner-only 写操作（推荐：**写仅 Owner**，见 §8.1）。
3. `tenant_id` 固定为 `authContext.tenantId`；`backup_jobs.tenant_id` 不得由 body 覆盖。
4. `scope` 固定为 `tenant`（禁止 Tenant 用户创建 `platform` 范围任务）。

**核心逻辑**

```text
POST /tenant/backups
  -> requireTenantRole(owner)   # 写操作推荐仅 Owner
  -> 插入 backup_jobs（scope=tenant, status=pending, tenant_id=authContext.tenantId）
  -> writeAuditLog（tenant_backup / backup_job.created）
  -> 返回任务记录（不触发真实备份命令）

POST /tenant/backups/:backupId/restore-requests
  -> 校验 backup 属于本租户且 scope=tenant
  -> 插入 restore_requests（status=pending）
  -> writeAuditLog（tenant_backup / restore_request.created）
  -> 不执行恢复；审批流留待 SaaS 或运维后台
```

**禁止**：在 Tenant 模块引入 shell 执行备份、直接 `DROP`/`RESTORE`、或让普通商户一键恢复生产数据。

实现可参考 `apps/api/src/modules/saas-backups/**`，复制分层与审计模式，替换为 Tenant 守卫与 `tenant_id` 注入（孙蕊蕊，`tenant-backups`）。

### 12.11 基础报表

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/reports/summary` | 报表摘要 | P1 |

### 12.12 Phase 1.1 补强（杨序）

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/audit-logs` | 增加查询参数 `tenantId`（可选） | P1 |

便于 SaaS Support 按租户排查：平台对该租户的操作 + 该租户用户登录 + 日后该租户经营操作。

### 12.13 个人中心（Profile，P1）

**定位**：当前登录 **租户用户** 的自服务资料与密码，**不**放在 `tenant-users`（后者管理他人账号）。复用 **`auth` 模块**，避免与员工 CRUD 混淆。

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/auth/me` | 已有；返回当前用户、角色、租户、门店绑定摘要 | P1 |
| PATCH | `/auth/me` | 更新本人 `displayName`、`user_profiles.language` | P1 |
| POST | `/auth/change-password` | 旧密码 + 新密码；写 `auth` 审计 | P1 |

**PATCH `/auth/me` 请求体建议**

```ts
type UpdateAuthMeRequest = {
  displayName?: string;
  language?: "en" | "fr" | "zh-CN";
};
```

**POST `/auth/change-password` 请求体建议**

```ts
type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};
```

**核心逻辑**

```text
PATCH /auth/me
  -> assertTenantContext（或 saas/tenant 均可，按 userType）
  -> 仅允许修改「当前 userId」的 profile
  -> 不写 PIN；改 PIN 仅能通过 /tenant/users/:id/pin（管理员重置）

POST /auth/change-password
  -> 校验 currentPassword
  -> 更新 password_hash
  -> 可选：吊销除当前会话外 refresh token
  -> writeAuditLog（auth / password.changed，不含密码明文）
```

**前端**：`/tenant/profile` 调用上述接口；「登录设备列表」Phase 1.2 **占位 Empty**。

**负责人**：实现放在 `apps/api/src/modules/auth/**`；**李龙杰审核**（涉及公共 auth）；前端可由 **赵付杰** 或各模块负责人在 P1 联调时补齐。

---

## 13. 数据库设计任务

Phase 1.1 已具备：`tenants`、`tenant_settings`、`tenant_feature_flags`、`users`、`audit_logs` 等。  
本阶段**新增**租户经营主数据表（**李龙杰 Day 1 初始定稿并落迁移**；**后续**表结构变更由杨序补丁，李龙杰审核）：

```text
branches
service_categories          # P1，可与 services 合并简化
services
prices                      # 或 price_items，与 TRD 对齐命名
hardware_configs
notification_settings
user_branches               # 预留；Phase 1.2 仅写入不过滤 API（§8.2、§13.7）
```

### 13.0 协作原则（初始：李龙杰；后续补丁：杨序）

| 步骤 | 负责人 | 交付物 |
| ---- | ------ | ------ |
| 1. 字段与表结构定稿（初始） | **李龙杰** | 表名、核心列、外键、`tenant_id` / 软删除 / `version` / `business_line`；**含 `hardware_configs`、`user_branches`** |
| 2. 写入 Drizzle schema 并首次迁移 | **李龙杰** | `packages/db/src/schema/**` + `pnpm db:generate` + `pnpm db:migrate` + `schema/index.ts` 导出（见数据库迁移文档） |
| 3. 后续 schema 补丁 | **杨序** | `hardware_configs` 等表的字段/索引调整；**须李龙杰确认方案并审核 PR** |
| 4. Tenant 权限 helper（初始版） | **李龙杰** | `permission.helper.ts` Tenant 扩展；他人**只调用、不直接改** |
| 5. 业务模块开发 | 武帅杰 / 赵付杰 / 孙蕊蕊 / 杨序 等 | 以 `tenant-*` 为主；赵付杰另改 **`saas-tenants`（`initialOwner`）**，**不改 schema** |

**Day 1 推荐顺序**：

```text
上午：李龙杰提交 初始 schema PR（含 hardware_configs 等）+ db:generate/migrate + permission.helper PR
      杨序（schema 合并后第一时间）：createTenantOwnerUser helper + app.ts 路由位
      赵付杰（helper 合并后）：§12.0 saas-tenants + initialOwner + 登录联调
中午：全员 pnpm db:migrate
下午：并行 tenant-*（须 Owner 已可登录）
      赵付杰：tenant-overview / tenant-settings 骨架
      杨序：tenant-users 列表/创建骨架
```

**功能开关与业务线**（`services` 等须遵守）：

| `requireFeatureEnabled` 参数 | `tenant_feature_flags` 列 | 影响的模块 |
| ---------------------------- | ------------------------- | ---------- |
| `laundry` | `laundry_enabled` | 洗衣类服务、价格 |
| `car_wash` | `car_wash_enabled` | 洗车类服务、价格 |
| `retail` | `retail_products_enabled` | 商品零售类服务、价格 |
| `delivery` | `delivery_enabled` | 配送相关（通知场景 `delivery.updated` 等） |
| `notifications` | `notifications_enabled` | `tenant-notifications` |

`services` 表须含 **`business_line`**（枚举与上表一致），创建/更新服务时校验对应开关。

### 13.1 通用字段要求

业务表建议包含：

```text
id                varchar(26) PK
tenant_id         varchar(26) NOT NULL
branch_id         varchar(26) NULL   # 门店级表必填
created_at        timestamptz
updated_at        timestamptz
created_by        varchar(26)
updated_by        varchar(26)
deleted_at        timestamptz NULL
deleted_by        varchar(26) NULL
version           integer DEFAULT 1
```

### 13.2 branches 核心字段建议

```text
name
address
phone
business_hours    jsonb 或 text
default_language
default_currency
receipt_name
receipt_phone
receipt_address
logo_url          nullable，Logo 预留
status            active | inactive
```

### 13.3 services / prices 核心字段建议

**services**：`categoryId`（P1 可合并）、`name`、`businessLine`（`laundry` | `car_wash` | `retail` | `delivery`，与 §13.0 功能开关映射一致）、`pricingUnit`（`per_item` | `per_kg`）、`status`。

**prices**：`serviceId`、`amount`、`currency`、`status`；改价写审计；改价前须校验关联服务的 `businessLine` 已开通。

### 13.4 users 扩展（员工 PIN，李龙杰初始 schema）

Phase 1.1 `users` 表无 PIN 字段。本阶段在 **`users`** 上增加：

```text
pin_hash          text NOT NULL   # 创建员工账号时必填；与 password_hash 同样哈希存储
```

约定：

- 创建员工时校验 `pin` 格式（建议 4–6 位数字，具体规则由 Zod 定稿）。
- 响应体与列表/详情 **永不返回** `pin`、`pin_hash`、`password`、`passwordHash`。
- 重置 PIN 走独立路由 `PATCH /tenant/users/:userId/pin`，`reason` 写入审计；`eventType` 建议 `user.pin_reset`；metadata 不含 PIN。

### 13.5 hardware_configs 核心字段建议

> **初始 schema**：由 **李龙杰** 在 Day 1 初始 PR 中定义并落迁移（下表为建议字段）。**后续**若 POS/Desktop 联调需增删字段，由 **杨序** 提交 schema 补丁 PR，**李龙杰** 审核字段方案后合并。

```text
branch_id
device_type       printer | scanner | cash_drawer
name
connection_type   usb | bluetooth | network | other
config            jsonb
status            active | inactive
```

### 13.6 notification_settings

- **粒度**：每租户一行（`tenant_id` UNIQUE），Phase 1.2 不用 `branch_id`。
- **列建议**：`id`、`tenant_id`、`settings`（jsonb，形状见 §12.7.1）、`created_at` / `updated_at` / `created_by` / `updated_by` / `version`（与 §13.1 通用字段对齐）。
- **`settings` 含义**：渠道开关 + 场景模板 key + `defaultLanguage`；**不存**供应商密钥与手机号池。

### 13.7 user_branches（预留，Phase 1.2 不过滤 API）

```text
user_id           varchar(26) NOT NULL  -> users.id
branch_id         varchar(26) NOT NULL  -> branches.id
tenant_id         varchar(26) NOT NULL  # 冗余便于租户隔离查询
created_at        timestamptz
```

- **用途**：创建/更新员工时写入 `branchIds`；Phase 1.2 **不**用于 list/audit 过滤（见 §8.2）。
- 唯一约束建议：`(user_id, branch_id)`。

### 13.8 索引与外键

- 所有表：`tenant_id` 索引。
- 门店级：`branch_id` 索引。
- 外键引用 `tenants.id`；软删除优先，不做物理删除。

---

## 14. 文件所有权规划

为减少冲突，严格按模块分配目录。**禁止跨目录修改他人模块**；改公共文件须先与李龙杰确认。

| 负责人 | 后端 | 前端 |
| ------ | ---- | ---- |
| 李龙杰 | **`packages/db` 初始 schema**（含 `hardware_configs` 等全部新表、首次 `db:generate` / `db:migrate`、`schema/index.ts` 首次导出）；`permission.helper.ts` Tenant **初始扩展**（他人只调用）；审计 eventCategory 规范 | 审核、合并顺序、验收 |
| 杨序 | **`packages/db` 后续补丁**；`app.ts`；`packages/api-client/src/tenant/index.ts`；**`tenant-users/**`**（含用户创建 helper）；`tenant-audit/**`；`tenant-hardware/**`；`saas-audit` `tenantId`；`packages/api-client/src/tenant/users*`；逐步替代 `modules/users` 租户路径 | `features/tenant/users/**`；`hardware/**` |
| 武帅杰 | `tenant-branches/**`；`tenant-notifications/**`；`packages/api-client/src/tenant/branches*`；`packages/api-client/src/tenant/notifications*` | `features/tenant/branches/**`；`config/notifications/**`；`app/(tenant)/tenant/branches/**` |
| 赵付杰 | **`saas-tenants` + `initialOwner`（P0 衔接，调用杨序 helper）**；`tenant-settings/**`；`tenant-overview/**`；`packages/api-client/src/saas/tenants*` | `features/saas/tenants/**`；`features/tenant/overview/**`；`features/tenant/settings/**`（或 `system/settings`） |
| 孙蕊蕊 | `tenant-services/**`；`tenant-prices/**`；`tenant-backups/**` | `features/tenant/services/**`；`prices/**`；`system/backups/**`；`reports/**`；`system/logs` 页面（对接 audit API） |
| 许婧姝 | 无核心业务代码 | 测试用例、接口说明、验收报告 |

公共文件规则（对齐 Phase 1.1 §14）：

1. **schema 初始**：Day 1 由 **李龙杰** 建立全部新表（含 `hardware_configs`）并完成首次 `db:generate` / `db:migrate`；合并前 **`packages/db/src/schema/**` 仅李龙杰可改**。
2. **`packages/db/src/schema/index.ts`**：首次导出由 **李龙杰** 在初始 PR 中完成；**后续** `hardware_configs` 等表结构变更由 **杨序** 补丁维护，**李龙杰审核**。
3. **`permission.helper.ts` Tenant 扩展**：由李龙杰编写**初始版本**并统一维护；其他成员只调用，不直接修改。
4. **`apps/api/src/app.ts` Tenant 路由块**：只由杨序修改（须在 **李龙杰初始 schema PR 合并**、全员 migrate 之后）。
5. **`packages/api-client/src/tenant/index.ts`**：由杨序整合导出，李龙杰审核合并顺序。
6. AI 若修改非本人目录，须撤回并由李龙杰协调。
7. **禁止**模块负责人在业务 PR 中自行 `db:generate` 新表。

---

## 15. 个人详细任务

### 15.1 李龙杰

职责：**Day 1 初始 schema（含迁移）与 permission.helper 定义**、**§8.1 权限矩阵与 §8.2 默认决策**、**§19 难点规范**、审计规范、代码审核、验收。

**Day 1 上午（阻塞项，须先于业务模块合并）**

1. 确认 Phase 1.2 任务拆分、文件边界与 5 日计划。
2. 建立并提交 **初始 schema PR**（`packages/db/src/schema/**`）：**branches**、**services**（含 `business_line`）、**prices**、**notification_settings**、**hardware_configs**（§13.5）、**user_branches**（§13.7，预留）；**`users.pin_hash`**（§13.4）；含 §13.1 通用字段与索引/外键约定；**同一 PR 内**执行 `pnpm db:generate`、`pnpm db:migrate`，维护 `schema/index.ts` 导出。
3. 提交 **Tenant `permission.helper` 初始扩展**：`assertTenantContext`、`requireTenantRole`、`assertActiveTenant`、`requireFeatureEnabled`（参数见 §13.0）；未开通时 `403` / `FEATURE_DISABLED`。
4. 制定租户侧 `audit_logs` 的 `eventCategory` / `eventType` 命名表（§16）。
5. 初始 schema PR 合并后，通知全员 `pnpm db:migrate`；**审核杨序后续 `hardware_configs` 等 schema 补丁 PR**（若有）。

**Day 1 下午起**

6. 审核杨序 `app.ts`、api-client 整合 PR。
7. 审核全部成员 PR；重点：租户隔离、审计、禁用 token、feature flag、**schema 初始仅李龙杰、后续补丁（尤其 `hardware_configs`）经杨序 + 李龙杰审核**。
8. 推进许婧姝测试与验收报告闭环。

### 15.2 杨序

职责：**`tenant-users`（P0，复杂度最高）**、后续 schema 补丁、公共整合与 **`app.ts` 统筹**、租户审计、SaaS 审计筛选、硬件配置（P1）。**不负责** Day 1 初始建表与首次迁移；**不负责** `saas-tenants` / `initialOwner` 编排（赵付杰），但须提供 **用户创建 helper**。

后端：

```text
# tenant-users（P0，优先于 audit 全量）
GET    /tenant/users
POST   /tenant/users
GET    /tenant/users/:userId
PATCH  /tenant/users/:userId
PATCH  /tenant/users/:userId/pin
PATCH  /tenant/users/:userId/status
# 共用 helper：createTenantOwnerUser / createTenantEmployeeUser（供 saas-tenants 调用）

GET  /tenant/audit-logs
GET  /tenant/audit-logs/:logId
GET  /saas/audit-logs?tenantId=   # 补强
GET    /tenant/hardware-configs
POST   /tenant/hardware-configs
PATCH  /tenant/hardware-configs/:configId
```

前端：

```text
/tenant/users                # P0 员工管理
/tenant/hardware             # P1 硬件配置页
```

任务：

1. **Day 1 上午（阻塞，须早于或并行赵付杰 initialOwner）**：在 `tenant-users` 模块交付 **`createTenantOwnerUser` helper**（密码/PIN 哈希、`user_roles`、审计）；`app.ts` 预留 `tenant/users` 与 `tenant-overview` 路由位；确认全员已 `pnpm db:migrate`。
2. **Day 1 下午**：`tenant-users` 列表/创建接口骨架；与赵付杰联调 `initialOwner` 调用 helper。
3. **Day 2–3**：完成 `tenant-users` 全量（PIN 重置、禁用吊销 token、前端 `/tenant/users`）；完成 `tenant-audit`；SaaS `audit-logs` 增加 `tenantId`。
4. Phase 1.2 期间：**后续 schema 补丁**（尤其 `hardware_configs`；李龙杰审核方案）。
5. **统筹**挂载全部 Tenant 路由到 `app.ts`；维护 `packages/api-client/src/tenant/index.ts`（汇总导出）。
6. **Day 4**：`tenant-hardware` API + 前端；集成检查收尾；为孙蕊蕊操作日志页提供 audit API 联调。
7. 配合李龙杰完成 typecheck / lint / build **集成检查**。

### 15.3 武帅杰

职责：门店管理（P0）；**通知配置**（P1，渠道/模板占位，难度低于服务与价格）。

后端：

```text
GET    /tenant/branches
POST   /tenant/branches
GET    /tenant/branches/:branchId
PATCH  /tenant/branches/:branchId
PATCH  /tenant/branches/:branchId/status
GET    /tenant/notification-settings
PATCH  /tenant/notification-settings
```

前端：

```text
/tenant/branches
/tenant/branches/[branchId]
/tenant/config/notifications    # P1，门店模块稳定后开展
```

重点：创建门店写审计；`tenant_id` 从 `authContext` 注入；停用不物理删除。通知配置更新写 `tenant_notification` 审计；不接入真实发送。

### 15.4 赵付杰

**职责总览**（建议按下列顺序执行）：

| 顺序 | 模块 | 说明 | 优先级 |
| ---- | ---- | ---- | ------ |
| 1 | **SaaS 租户开户** | `POST /saas/tenants` + `initialOwner`（**调用杨序 `createTenantOwnerUser`**）；SaaS 创建页 §11.7 | **P0 阻塞** |
| 2 | **tenant-overview** | `GET /tenant/overview` + `/tenant` Dashboard（占位统计） | P0 |
| 3 | **tenant-settings** | 租户设置读写；功能开关只读 | P0 |

**不再负责** `tenant-users`（已划归杨序，§15.2）。

后端：

```text
POST   /saas/tenants               # 扩展：initialOwner，同事务调用杨序 helper 创建 Owner
GET    /tenant/overview            # 经营概览（占位统计即可）
GET    /tenant/settings
PATCH  /tenant/settings
```

前端：

```text
/saas/tenants/new              # 创建租户 + 首任管理员（P0 阻塞）
/saas/tenants/[tenantId]       # 可选：分步添加首任管理员
/tenant                        # 工作台 Dashboard（tenant-overview）
/tenant/system/settings
```

任务：

1. **Day 1 上午（阻塞）**：待杨序 **`createTenantOwnerUser` helper** 可用后，扩展 `POST /saas/tenants` + `initialOwner`；更新 `packages/api-client` SaaS tenants DTO；SaaS 创建页；验证 Owner 登录 `/tenant`。
2. **Day 1 下午**（schema 合并后）：`tenant-overview`、`tenant-settings` GET 骨架。
3. **Day 2–3**：完成 overview、settings 全量及对应前端；工作台与设置页流程跑通。

重点：**先打通「SaaS 建租户 → Owner 登录 `/tenant`」**（依赖杨序 helper，不自行实现 PIN/密码哈希逻辑）。员工 CRUD、PIN 重置、禁用 token 由 **杨序** 在 `tenant-users` 交付。租户设置仅 Owner 可写。

### 15.5 孙蕊蕊

职责：服务目录、价格册、数据备份、基础报表及对应页面；**操作日志页**前端（对接杨序 `tenant-audit` API）。通知配置已划归武帅杰。

后端：

```text
GET/PATCH /tenant/services/**
GET/PATCH /tenant/prices/**
GET/POST  /tenant/backups/**
GET       /tenant/reports/summary    # P1
```

前端：

```text
/tenant/services
/tenant/prices
/tenant/system/backups
/tenant/system/logs          # 列表/筛选/详情，消费 tenant-audit API
/tenant/reports              # P1 报表页
```

重点：改价写审计；列表类模块保持与 Phase 1.1 反馈/备份模块相同分层风格。操作日志页不改 audit 后端，仅联调杨序接口。

### 15.6 许婧姝

职责：文档、测试、验收。

测试重点：

```text
POST /saas/tenants（含 initialOwner）后，Owner 可用 pressingCode + 邮箱 + 密码登录 /tenant（§12.0、验收标准 0）
Tenant 用户不能访问 /saas/**
SaaS 用户不能访问 /tenant/**
停用租户后 Tenant API 返回 403
未开通功能时对应 API 返回 403
创建门店/员工/改价写 audit_logs 且 tenant_id 正确
禁用员工后 refresh token 失效
/tenant/audit-logs 仅返回本租户数据（Phase 1.2 不对 Manager 强制门店过滤，§8.2）
/tenant/system/logs 页面可筛选门店（branchId 查询参数）
SaaS /saas/audit-logs?tenantId= 可筛选指定租户
未实现 Tenant 离线相关接口
```

交付：测试记录、接口字段说明、验收报告、未通过问题清单。

---

## 16. 审计日志规范（租户侧）

### 16.1 必须审计的操作

| 模块 | 操作 |
| ---- | ---- |
| 门店 | 创建、更新、停用 |
| 员工 | 创建、更新、禁用、重置 PIN |
| 服务 | 创建、更新、停用 |
| 价格 | 更新价格 |
| 硬件 | 创建、更新、绑定门店 |
| 通知 | 更新通知配置 |
| 租户设置 | 更新 `tenant_settings` |
| 备份 | 创建备份任务、提交恢复申请 |

### 16.2 eventCategory 建议

```text
tenant_branch
tenant_user
tenant_service
tenant_price
tenant_hardware
tenant_notification
tenant_settings
tenant_backup
```

### 16.3 写入示例

```ts
await writeAuditLog(db, {
  actorUserId: authContext.userId,
  tenantId: authContext.tenantId,
  branchId: input.branchId ?? null,
  eventCategory: "tenant_price",
  eventType: "price.updated",
  entityType: "price",
  entityId: price.id,
  before: { amount: before.amount },
  after: { amount: after.amount },
  ipAddress: meta?.ipAddress,
  userAgent: meta?.userAgent,
});
```

---

## 17. AI 开发提示词规范

每次让 AI 生成代码时，应包含：

```text
请按照 CleanHub 当前项目结构开发 Phase 1.2 租户后台。
编码前先阅读本文档 §8.1、§8.2、§19（核心难点逐步逻辑）。
前置已完成 Phase 1.1 SaaS 平台，请复用 audit.helper、permission.helper 模式。
不要修改无关文件。
不要修改 packages/ui/src/components/ui/**。
后端使用 routes -> controller -> service -> repository 分层。
请求校验使用 Zod。ID 使用 @cleanhub/id。主键 varchar(26)。
所有 /tenant API 必须校验 authContext.tenantId，写入数据必须带 tenant_id。
禁止信任前端传入的 tenantId 覆盖当前租户。
敏感写操作必须 writeAuditLog，eventCategory 使用 tenant_* 前缀。
必须检查 tenant.status 与 tenant_feature_flags。
不要实现 Tenant Admin 离线功能。
前端通过 webAdminApi / packages/api-client，禁止散落 fetch。
页面只需跑通流程。文案可先用英文。
不要修改 packages/db/src/schema/** 或自行 db:generate（Phase 1.2 初始 schema 仅李龙杰；后续补丁尤其 hardware_configs 仅杨序，李龙杰审核方案）。
不要修改 permission.helper.ts，除非李龙杰明确要求（他人只调用 Tenant helper）。
不要修改 app.ts、schema index、api-client tenant index，除非杨序/李龙杰明确要求。
参考 CLAUDE.md 和 AGENTS.md。
```

---

## 18. Code Review Checklist

```text
[ ] 是否只修改了自己负责的文件范围
[ ] 是否使用 routes/controller/service/repository 分层
[ ] 是否使用 Zod 校验
[ ] 是否使用 ULID
[ ] /tenant API 是否校验 tenant 用户与 tenantId
[ ] 停用租户是否拒绝访问
[ ] 功能开关是否在 API 层校验
[ ] 敏感写操作是否写 audit_logs（tenant_id 正确）
[ ] 禁用员工是否吊销 refresh token
[ ] 创建员工是否必填 PIN 且 pin_hash 已哈希存储（审计无 PIN 明文）
[ ] 创建员工是否为 active 账号（非 invited 邀请流）
[ ] 重置 PIN 是否走独立 `/pin` 接口且 reason 必填、写入 audit_logs.reason
[ ] 是否避免物理删除
[ ] 是否处理 401/403/404/409/422
[ ] 是否没有直接 fetch
[ ] 是否没有实现 Tenant 离线
[ ] 是否没有修改 packages/ui/src/components/ui/**
[ ] typecheck / lint / build 是否通过
```

---

## 19. 核心难点实现说明

本节对齐 Phase 1.1 文档 §19，给开发者提供**逐步逻辑对照**。编码前应先读 **§8.1、§8.2** 与本节，再进入具体模块。

### 19.1 SaaS 开户（`initialOwner`）与 `createTenantOwnerUser` helper

难点：

- Phase 1.1 只创建租户档案，没有可登录的商户 `users`。
- `saas-tenants` 与 `tenant-users` 分属不同负责人，**必须共用同一套**用户创建逻辑，避免 PIN/密码哈希不一致。

**边界**

| 调用方 | 允许操作 | 禁止 |
| ------ | -------- | ---- |
| `POST /saas/tenants`（赵付杰） | 同事务：租户档案 + `initialOwner` | 在 `saas-tenants` 内重复实现哈希/roles |
| `createTenantOwnerUser`（杨序，`tenant-users`） | 创建 `users` + `user_profiles` + `user_roles(owner)` + 审计 | 被 `POST /tenant/users` 以外路径绕过校验 |
| `POST /tenant/users` | 创建员工（非 Owner 或额外 Owner 需产品明确禁止） | 创建 `userType=saas` |

**核心逻辑（推荐：扩展 `POST /saas/tenants`）**

```text
POST /saas/tenants（含 initialOwner）
  -> requireSuperAdmin
  -> 校验 tenants 字段 + initialOwner（email/password/pin）
  -> 开启事务
  -> 插入 tenants
  -> 初始化 tenant_settings、tenant_feature_flags（1.1 已有逻辑，不重复实现）
  -> 调用 createTenantOwnerUser(tx, { tenantId, ...initialOwner, actorUserId })
       -> users（userType=tenant, status=active, password_hash, pin_hash）
       -> user_profiles
       -> user_roles（owner）
       -> writeAuditLog（tenant_user / user.created）
  -> writeAuditLog（saas_tenant / tenant.created）
  -> 提交事务
  -> 返回 tenant + initialOwnerUserId（无密码/PIN）
```

**实现注意**

- `initialOwner.email` 在**租户内**唯一（`normalized_email` + `tenant_id`）。
- 每个租户经本接口**仅创建 1 个** Owner；已有 Owner 时 `POST .../owners`（§12.0.2）应返回 `409`。
- 赵付杰 **不得**复制 PIN/密码哈希代码；只编排事务并调用杨序 helper。

### 19.2 租户员工、PIN 与会话失效

难点：

- Tenant 员工与 SaaS 平台成员不是同一类用户（`userType`、`tenantId`）。
- 禁用后 refresh token 仍有效会导致「已禁用仍可续签」。
- PIN 不得进入审计明文；创建与重置是两条路径。

**创建员工**

```text
POST /tenant/users
  -> assertTenantContext + assertActiveTenant
  -> requireTenantRole(owner, manager)
  -> 校验 displayName/phone/role/pin（4–6 位数字）/password（Owner·Manager 必填）
  -> phone、email 在租户内唯一
  -> userType=tenant, tenantId=authContext.tenantId, status=active
  -> 哈希 password、pin -> users 表
  -> user_profiles
  -> user_roles + user_branches（写入 branchIds，§13.7，不过滤 API）
  -> writeAuditLog（tenant_user / user.created）
```

**禁用员工**

```text
PATCH /tenant/users/:userId/status  { status: "disabled" }
  -> assertTenantContext + requireTenantRole(owner, manager)
  -> 目标用户 tenantId 必须等于 authContext.tenantId
  -> 禁止禁用自己
  -> 禁止禁用租户内最后一个 active Owner（至少保留 1 个 Owner）
  -> 更新 users.status = disabled
  -> 吊销该用户全部 auth_refresh_tokens
  -> writeAuditLog（tenant_user / user.disabled，含 reason 若有）
```

**重置 PIN**（独立路由，见 §12.3）

```text
PATCH /tenant/users/:userId/pin  { pin, reason }
  -> requireTenantRole(owner, manager)
  -> reason 必填，写入 audit_logs.reason
  -> 更新 pin_hash
  -> writeAuditLog（tenant_user / user.pin_reset，before/after 不含 pin/pin_hash）
```

**实现注意**

- 复用 1.1 `saas-users` 中 **吊销 refresh token** 的 repository 方法（抽公共函数，避免复制）。
- Cashier **不得**调用 `/tenant/users` 写接口。
- Phase 1.2 **不做**员工自助「忘记 PIN」；走管理员重置。

### 19.3 权限校验与 API 安全边界

难点：前端隐藏菜单不是安全边界；SaaS 与 Tenant 上下文不可混用。

**请求链路**

```text
/tenant/*
  -> createRequireAuthMiddleware
  -> assertTenantContext（userType=tenant, tenantId 非空）
  -> assertActiveTenant（tenants.status=active）
  -> requireTenantRole / requireFeatureEnabled（按接口）
  -> service：所有查询/写入带 tenant_id = authContext.tenantId
```

**推荐 Tenant helper**（李龙杰初始实现，他人只调用）

```ts
function assertTenantContext(authContext: AuthContext): void;
function requireTenantRole(
  authContext: AuthContext,
  allowedRoles: Array<"owner" | "manager">,
): void;
function assertActiveTenant(authContext: AuthContext): void;
function requireFeatureEnabled(
  authContext: AuthContext,
  feature: "laundry" | "car_wash" | "retail" | "delivery" | "notifications",
): void;
```

角色与模块对照见 **§8.1**。

### 19.4 功能开关与 `business_line`

```text
创建/更新 services
  -> requireFeatureEnabled(authContext, service.businessLine)
  -> 未开通则 403 / FEATURE_DISABLED

创建/更新 prices
  -> 加载关联 service.business_line
  -> 同样 requireFeatureEnabled
```

`tenant_feature_flags` **仅 SaaS 写入**；Tenant `GET /tenant/settings` 只读展示，禁止 PATCH 开关列。

### 19.5 服务目录与标准价格

难点：改价影响经营但不影响历史订单；需与功能开关联动。

**数据关系（Phase 1.2 建议）**

- 每个 `services` 行对应租户内一条经营服务；`prices` 与 `service_id` **1:1**（每服务一个当前标准价）；若已存在则 `PATCH` 改价，不重复插入。
- `prices.currency` 默认取 `tenant_settings.default_currency`。
- `amount` 必须 `> 0`；校验失败 `422`。

**改价**

```text
PATCH /tenant/prices/:priceId
  -> 查询 price + service，校验 tenant_id
  -> requireFeatureEnabled(service.businessLine)
  -> 记录 before.amount
  -> 更新 amount、updated_by
  -> writeAuditLog（tenant_price / price.updated）
```

产品提示（前端）：已确认订单价格不变；仅影响新单。

**停用服务**：`PATCH .../status` 软逻辑停用，不物理删除；关联价格可保持只读展示。

### 19.6 租户审计查询

```text
GET /tenant/audit-logs
  -> assertTenantContext
  -> requireTenantRole(owner, manager)
  -> WHERE tenant_id = authContext.tenantId
  -> 可选筛选：branchId, actorUserId, eventCategory, ...
  -> Phase 1.2 不按 Manager 的 user_branches 过滤（§8.2）

GET /tenant/audit-logs/:logId
  -> 同上 + 校验 log.tenant_id
```

SaaS 补强：`GET /saas/audit-logs?tenantId=` 可选筛选，便于支持人员排查。

### 19.7 通知、备份、硬件模块边界

**通知**（详见 §12.7.1）：只读写 `notification_settings` jsonb；不发消息、不接 SDK。

**备份**（详见 §12.10.1）：只写 `backup_jobs` / `restore_requests` 记录；不执行真实 dump/restore。

**硬件**（P1）：

```text
GET/POST/PATCH /tenant/hardware-configs
  -> requireTenantRole(owner, manager)
  -> tenant_id 注入；branch_id 须属于本租户
  -> config jsonb 占位（连接参数）；不调用 packages/hardware 真实设备
  -> 写审计 tenant_hardware
```

表结构变更走杨序 schema 补丁 + 李龙杰审核（§13.0）。

### 19.8 个人中心与 auth 复用

见 **§12.13**。要点：`PATCH /auth/me` 只改本人资料；改他人 PIN 走 `/tenant/users/:id/pin`；登录设备列表占位。

### 19.9 审计日志写入

复用 `apps/api/src/modules/audit/audit.helper.ts`；`eventCategory` 见 §16。

- `before` / `after` / `metadata` **不得**含 password、pin、token、密钥（helper 已过滤常见键，业务仍须避免写入哈希）。
- 关键写操作与业务更新同一事务。

### 19.10 并发、冲突与错误码

| 场景 | HTTP | code 建议 |
| ---- | ---- | --------- |
| 未登录 | 401 | `UNAUTHORIZED` |
| 非 Tenant 用户访问 `/tenant/**` | 403 | `FORBIDDEN` |
| 停用租户 / Cashier 访问 Tenant | 403 | `FORBIDDEN` |
| 功能未开通 | 403 | `FEATURE_DISABLED` |
| 资源不存在 | 404 | `*_NOT_FOUND` |
| pressingCode / email / phone 重复 | 409 | `DUPLICATE_*` |
| 已有 Owner 仍调 `POST .../owners` | 409 | `OWNER_ALREADY_EXISTS` |
| 禁用自己 / 最后 Owner | 422 | `INVALID_STATUS_TRANSITION` |
| Zod 校验失败 | 422 | `VALIDATION_ERROR` |

关键写操作使用事务；更新前查询 `before` 用于审计。

### 19.11 Phase 1.2 最容易跑偏的点

```text
用 POST /saas/users 创建商户管理员
在 saas-tenants 重复实现 PIN/密码哈希
禁用员工未吊销 refresh token
PIN 或 password 写入 audit_logs
只隐藏菜单不做 API feature flag 校验
信任 body.tenantId 覆盖 authContext.tenantId
Tenant 模块实现离线/sync
真实执行 pg_dump 或恢复数据库
通知模块接入 Twilio/Meta/SendGrid
Manager 门店过滤半成品导致 P0 阻塞（1.2 默认全租户，§8.2）
模块负责人自行 db:generate 新表
非本人目录修改 app.ts / permission.helper / schema
```

---

## 20. 验收命令

```bash
pnpm --filter @cleanhub/api typecheck
pnpm --filter @cleanhub/api lint
pnpm --filter @cleanhub/api build

pnpm --filter @cleanhub/api-client typecheck

pnpm db:generate
pnpm --filter @cleanhub/db typecheck

pnpm --filter @cleanhub/web-admin typecheck
pnpm --filter @cleanhub/web-admin lint
pnpm --filter @cleanhub/web-admin build

pnpm typecheck
pnpm build
```

---

## 21. 最终验收标准

本期通过标准：

0. **SaaS 完成租户开户**（§12.0.1 或 §12.0.2）后，首任 Owner 使用 **邮箱 + 密码 + Tenant code** **可登录** `/tenant`（不依赖 seed）；**不能**仅用 `POST /saas/users` 代替。
1. Owner/Manager 可登录并进入 `/tenant` 工作台。
2. 可完成门店 CRUD 与启用/停用，且带审计。
3. 可完成员工 CRUD 与禁用：创建时必填 PIN、直接为 `active` 账号（非邀请）；禁用后不可再续签登录。
4. 可完成服务与服务价格维护，改价有审计。
5. `/tenant/audit-logs` 仅返回本租户日志，可按门店筛选。
6. 租户设置可查看/更新；功能开关只读展示 SaaS 配置。
7. 停用租户（SaaS）后 Tenant API 返回 403。
8. 未开通功能（feature flag）时相关 API 拒绝访问。
9. SaaS `/saas/audit-logs` 支持 `tenantId` 筛选（补强项）。
10. P1 页面（硬件、通知、备份、报表、个人中心）至少流程可点通或合理 Empty。
11. 无 Tenant 离线相关实现。
12. API client 类型完整，前后端 typecheck 通过。
13. 构建通过。
14. 许婧姝完成测试记录与验收报告。
15. Phase 1.2 **不对 Manager 做门店级 API 过滤**（`user_branches` 可写入）；与 §8.2、§19.6 一致。

---

## 22. 风险与控制

| 风险 | 影响 | 控制方式 |
| ---- | ---- | -------- |
| schema 新增多表阻塞并行开发 | 进度延迟 | Day 1 上午李龙杰 **初始 schema + 首次迁移** + helper 合并后，下午模块并行 |
| 与 Phase 1.1 `users` 模块冲突 | 合并冲突 | **杨序**主导 `tenant-users` 新目录，旧路由逐步迁移 |
| `initialOwner` 依赖 helper 未就绪 | Day 1 开户阻塞 | **杨序**上午优先合并 `createTenantOwnerUser`；赵付杰 `saas-tenants` 紧随其后 |
| 权限/审计遗漏 | 越权或不可追溯 | 李龙杰审核 checklist；许婧姝按用例测试 |
| Manager 门店范围复杂 | 延期 | **已决策**：1.2 全租户可见 + 预留 `user_branches`（§8.2）；过滤留后续 |
| 报表无订单 API | 页面空 | 允许占位，文档标注依赖 1.3 |
| AI 改公共文件 | 冲突 | 同 1.1：撤回 + 李龙杰协调 |
| 与 SaaS 功能开关不一致 | 菜单与 API 不一致 | 统一读 `tenant_feature_flags`，SaaS 为唯一写入方 |
| 1.1 只建租户、无 Owner | **租户后台无法验收** | 1.2 P0：`POST /saas/tenants` + `initialOwner`（§3.1、§12.0） |
| 误用 `POST /saas/users` 当商户管理员 | 账号进不了 `/tenant` | 文档与 UI 区分「平台成员」与「首任 Owner」；验收标准 0 |

---

## 23. 交付物

1. **SaaS 租户开户**：`saas-tenants` 扩展（`initialOwner`）、`packages/api-client/src/saas/tenants*`、`features/saas/tenants` 创建页（赵付杰）。
2. 租户后台后端接口代码（`apps/api/src/modules/tenant-*`）。
3. `packages/api-client/src/tenant/**` 方法与 DTO。
4. 租户后台基础前端页面（`apps/web-admin` `(tenant)` 路由）。
5. 数据库 schema 与迁移（**初始**：李龙杰；**后续补丁**：杨序，李龙杰审核）。
6. 接口说明（许婧姝维护）。
7. 测试用例与执行记录（含 §12.0 开户 → 登录 `/tenant` 用例）。
8. 验收报告与未通过问题清单。
9. 风险与遗留事项（订单/POS/离线、Manager 门店过滤延后至 1.3+）。
10. 本文档 **§19 核心难点实现说明**（团队实现对照）。

---

## 24. 每日开发计划

### 24.1 Day 1：Schema、权限与 P0 后端

**李龙杰**

- 提交 **初始 schema PR**（含 `hardware_configs` 等全部新表 + `db:generate` / `db:migrate` / `schema/index.ts`）+ Tenant `permission.helper` PR + §16 审计命名表。
- 合并后通知全员 `pnpm db:migrate`。

**杨序（优先，阻塞 helper）**

- **上午**（李龙杰初始 schema 合并后）：交付 **`createTenantOwnerUser` helper** + `app.ts` 预留 `tenant/users`、`tenant/overview` 路由位。
- **下午**：`tenant-users` 列表/创建接口骨架。

**赵付杰（紧接 helper，阻塞登录链路）**

- **上午**（杨序 helper 合并后）：扩展 `POST /saas/tenants` + `initialOwner`（§12.0）；SaaS 创建租户页；验证 `/login` → `/tenant`。
- **下午**：`tenant-overview`、`tenant-settings` GET 骨架。

**全员**

- 李龙杰初始 schema PR 合并后执行 `pnpm db:migrate`，再开始各 `tenant-*` 业务模块。

**武帅杰 / 孙蕊蕊**

- **下午**（**Owner 可登录** 后）再开业务模块 PR：
  - 武帅杰：`tenant-branches` 列表、创建、详情、更新、状态接口。
  - 孙蕊蕊：`tenant-services`、`tenant-prices` 骨架（`business_line` + `requireFeatureEnabled`）。

**许婧姝**

- 编写 P0 API 测试用例与租户隔离用例。

### 24.2 Day 2：审计、守卫与 P0 收尾

**李龙杰**

- 审核 Day 1；检查租户隔离与审计写入。

**杨序**

- 完成 **`tenant-users` 全量**（PIN 重置、禁用吊销 token、`/tenant/users` 前端）；完成 `tenant-audit`；SaaS `audit-logs` 增加 `tenantId`；`app.ts` / api-client 聚合。

**赵付杰**

- 完成 `tenant-overview` API；完成 `tenant-settings` PATCH 与只读功能开关；变更写审计。

**武帅杰 / 孙蕊蕊**

- 补齐 P0 模块错误码、审计、feature flag 校验。

**杨序 + 许婧姝**

- 禁用员工 token 吊销联调（`tenant-users`）。

**许婧姝**

- 执行 P0 API 测试。

### 24.3 Day 3：前端流程页（P0）

**赵付杰**

- 工作台页对接 `tenant-overview` API；租户设置页流程跑通。

**杨序**

- `/tenant/users` 员工页流程跑通。

**孙蕊蕊**

- 操作日志页对接杨序 `tenant-audit` API；服务、价格页流程跑通。

**武帅杰**

- 门店页面流程跑通。

**许婧姝**

- 页面流程测试（Loading/Empty/Error）。

### 24.4 Day 4：P1 模块与联调

**杨序**

- 若 Day 2–3 未收尾，继续 `tenant-users` / audit；硬件配置页面与 `tenant-hardware` API；集成收尾。

**武帅杰**

- 通知配置页面与 `tenant-notification-settings` API（P1）。

**孙蕊蕊**

- 备份、报表页面与 API。

**全员**

- 修复联调问题；李龙杰统筹优先级。

**许婧姝**

- 回归测试与问题清单。

### 24.5 Day 5：验收

**李龙杰**

- 组织验收；确认 typecheck / build。

**许婧姝**

- 验收报告、接口文档定稿。

**杨序**

- 集成检查与遗留项记录。

---

## 25. 后续波次预告（非本文档范围）

| 波次 | 内容 |
| ---- | ---- |
| Phase 1.3（建议） | POS 下单/收款/打印、`pos-web` + `desktop`、**门店离线** |
| 产品 Phase 2 | 完整离线同步、多门店、会员、自动支付回调等 |

---

**文档维护**：许婧姝（测试与验收记录）；技术变更由李龙杰审核后更新版本号。

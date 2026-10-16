# CleanHub Phase 1.1 SaaS 平台功能开发计划 v0.1

| 版本 | 日期 | 状态 | 说明 |
| ---- | ---- | ---- | ---- |
| v0.1 | 2026-05-15 | Draft | SaaS 平台后端功能开发、AI 生成前端流程页面、团队任务分配与验收计划 |

---

## 1. 文档目的

本文档用于指导 CleanHub Phase 1.1 SaaS 平台功能开发，重点解决以下问题：

- 明确本次 SaaS 平台需要开发的后端接口和基础前端页面。
- 根据团队成员经验分配任务。
- 规划文件所有权，尽量避免多人同时修改同一个文件。
- 约束 AI 生成代码时的边界，降低权限、审计、租户隔离等关键偏差。
- 为测试、联调和验收提供统一依据。

本次开发优先目标是跑通 SaaS 平台功能流程。前端页面允许由 AI 先生成基础页面，视觉、交互和设计细节后续再统一调整。

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
docs/04-technical/api/Clean_Hub-API_Client使用说明.md
docs/04-technical/database/Clean_Hub-Drizzle数据库迁移操作详解.md
```

---

## 3. 项目背景

CleanHub 是面向洗衣、压烫、干洗、洗车、POS、硬件接入、离线营业、本地支付和多门店管理的多租户 SaaS 平台。

Phase 1.1 的 SaaS 平台后台主要服务平台管理员、支持人员和实施人员，目标是完成试点租户管理、平台成员管理、平台配置、审计日志、技术反馈、数据备份、安全事件和基础运营概览。

本阶段不追求完整商业化 SaaS 能力，不做复杂订阅计费、高级 BI、完整客服系统、自动灾备恢复、完整营销平台。

---

## 4. 本次开发目标

本次开发目标是完成 SaaS 平台基础功能闭环：

1. 平台管理员可以登录 SaaS 后台。
2. 平台管理员可以查看平台数据概览。
3. 平台管理员可以创建、查看、编辑、启用、停用租户。
4. 平台管理员可以维护租户基础配置和功能开关。
5. 平台管理员可以管理平台成员。
6. 平台管理员可以查看平台审计日志。
7. 平台管理员可以查看和处理轻量技术反馈。
8. 平台管理员可以查看系统日志摘要。
9. 平台管理员可以查看备份任务、发起手动备份任务、提交恢复申请。
10. 平台管理员可以查看安全事件和维护基础安全设置。
11. 前端页面由 AI 生成，先保证流程跑通，不要求最终视觉质量。

---

## 5. 本期不做内容

以下内容不纳入本次开发：

1. 完整 SaaS 订阅计费。
2. 自动扣费。
3. 多币种平台收入结算。
4. 高级 BI 和复杂趋势分析。
5. 完整客服工单系统。
6. SLA、聊天系统、知识库。
7. 真实 WhatsApp/SMS/Email 供应商接入。
8. 自动灾备恢复。
9. 普通用户自助恢复生产数据。
10. 复杂权限编辑器。
11. 完整营销自动化。
12. 完整 POS 业务闭环。
13. 完整 Tenant Admin 后端功能。

---

## 6. 团队成员与能力定位

| 姓名 | 分工原则 |
| ---- | ---- |
| 李龙杰 | 负责代码审核、任务统筹、进度协调、冲突协调、初始数据库基线、权限 helper、审计 helper 和验收推进 |
| 杨序 | 负责公共技术整合、SaaS 概览、平台设置、平台审计日志查询和公共能力接入 |
| 帅杰 | 负责 SaaS 租户管理核心模块 |
| 赵付杰 | 负责 SaaS 平台成员管理模块 |
| 许婧姝 | 负责接口文档、测试用例、验收记录、AI 输出核查 |
| 孙蕊蕊 | 负责反馈、日志、备份、安全等模块 |

分工原则：

- 初始数据库基线、权限 helper、审计 helper 交给李龙杰先完成。
- 公共技术整合、路由挂载和公共能力接入交给杨序。
- 代码审核、任务统筹、合并节奏和验收推进交给李龙杰。
- 帅杰、赵付杰负责边界清晰、业务价值高的核心模块。
- 孙蕊蕊负责列表、状态更新、简单任务记录类模块。
- 许婧姝主要保障文档和测试。
- 所有人使用 AI 辅助开发，但必须人工核查关键逻辑。

---

## 7. 技术栈与项目结构

### 7.1 技术栈

| 类型 | 技术 |
| ---- | ---- |
| 包管理 | pnpm |
| Monorepo | Turborepo |
| 后端 API | TypeScript + Hono |
| 数据库 | PostgreSQL + Drizzle ORM |
| 前端 | Next.js |
| 样式 | Tailwind CSS |
| API Client | packages/api-client |
| 日志 | @cleanhub/logger |
| ID | @cleanhub/id ULID |

### 7.2 主要目录

```text
apps/api
apps/web-admin
packages/db
packages/api-client
packages/domain
packages/id
packages/logger
```

### 7.3 后端分层

后端必须遵循：

```text
routes
  -> controller
    -> service
      -> repository
        -> db
```

要求：

- `routes` 只负责路由声明。
- `controller` 只负责 HTTP 输入输出。
- `service` 负责业务规则。
- `repository` 负责数据库查询。
- 请求校验使用 Zod。
- 不要把所有逻辑写在 controller。
- 不要把业务逻辑写到 Next.js route handler。

---

## 8. 核心开发原则

1. 所有业务实体 ID 必须使用 ULID。
2. PostgreSQL 中 ULID 使用 `varchar(26)`。
3. 不允许新增自增 ID。
4. 不允许新增 PostgreSQL `uuid` 主键。
5. 所有租户相关数据必须包含 `tenant_id`。
6. 门店级数据必须包含 `branch_id`。
7. SaaS 平台级数据允许 `tenant_id = null`。
8. 敏感写操作必须写入 `audit_logs`。
9. API 层必须做权限校验，不能只依赖前端隐藏按钮。
10. 前端调用 API 必须通过 `packages/api-client`。
11. 不允许在页面或 feature 中散落原始 `fetch`。
12. 不允许修改 `packages/ui/src/components/ui/**`。
13. 不允许多人同时修改同一个公共入口文件。
14. AI 生成代码后必须人工检查权限、审计、租户隔离和错误处理。

---

## 9. SaaS 平台模块清单

| 模块 | 说明 | 优先级 |
| ---- | ---- | ---- |
| SaaS 数据概览 | 平台租户、门店、订单、待处理事项 | P0 |
| 租户管理 | 租户列表、创建、详情、编辑、启用/停用 | P0 |
| 租户配置 | 默认语言、货币、业务类型、试点状态、功能配置 | P1 |
| 平台成员管理 | 平台管理员、支持人员、角色、状态 | P0 |
| 平台审计日志 | 平台敏感操作记录 | P0 |
| 技术反馈 | 轻量技术反馈入口，不做完整客服系统 | P1 |
| 系统日志 | 平台运行日志摘要，不直接读取本地日志文件 | P1 |
| 数据备份 | 备份状态、备份任务、恢复申请入口 | P1 |
| 安全管理 | 登录策略、密码策略、安全事件 | P1 |
| 平台设置 | 平台级默认配置 | P1 |
| 个人中心 | 当前用户资料、语言、密码入口 | P2 |

---

## 10. API 接口清单

### 10.1 SaaS 概览

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/overview` | 获取 SaaS 平台概览数据 | P0 |

返回内容建议：

```ts
type SaasOverview = {
  tenantCount: number;
  activeTenantCount: number;
  suspendedTenantCount: number;
  branchCount: number;
  todayOrderCount: number;
  todayRevenueAmount: number;
  pendingFeedbackCount: number;
};
```

### 10.2 租户管理

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/tenants` | 租户列表 | P0 |
| POST | `/saas/tenants` | 创建租户 | P0 |
| GET | `/saas/tenants/:tenantId` | 租户详情 | P0 |
| PATCH | `/saas/tenants/:tenantId` | 更新租户基础信息 | P0 |
| PATCH | `/saas/tenants/:tenantId/status` | 启用、停用、暂停租户 | P0 |
| GET | `/saas/tenants/:tenantId/settings` | 获取租户设置 | P1 |
| PATCH | `/saas/tenants/:tenantId/settings` | 更新租户设置 | P1 |
| GET | `/saas/tenants/:tenantId/feature-flags` | 获取租户功能开关 | P1 |
| PATCH | `/saas/tenants/:tenantId/feature-flags` | 更新租户功能开关 | P1 |

租户核心字段：

```ts
type Tenant = {
  id: string;
  name: string;
  pressingCode: string;
  status: "active" | "suspended" | "disabled";
  country: string;
  city?: string;
  defaultLanguage: "en" | "fr" | "zh-CN";
  defaultCurrency: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
};
```

创建租户时的语言预留要求：

- `POST /saas/tenants` 请求中必须包含或自动生成租户默认语言。
- 第一阶段允许值建议为 `en`、`fr`、`zh-CN`。
- 如果创建请求未传 `defaultLanguage`，后端应使用 `platform_settings.default_language`；如果平台默认语言也不存在，则兜底为 `en`。
- 创建租户成功后，应初始化 `tenant_settings.default_language`，供 Tenant Admin、POS、通知、小票和标签后续使用。
- 租户详情接口应返回租户默认语言，方便前端展示和后续编辑。
- 修改租户默认语言属于租户配置变更，必须写入审计日志。

### 10.3 平台成员管理

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/users` | 平台成员列表 | P0 |
| POST | `/saas/users` | 创建或邀请平台成员 | P0 |
| GET | `/saas/users/:userId` | 平台成员详情 | P0 |
| PATCH | `/saas/users/:userId` | 更新平台成员信息 | P0 |
| PATCH | `/saas/users/:userId/status` | 启用或禁用平台成员 | P0 |
| GET | `/saas/roles` | 平台角色列表 | P1 |
| PATCH | `/saas/users/:userId/roles` | 更新平台成员角色 | P1 |

平台成员要求：

- `userType` 必须是 `saas`。
- 平台成员不得绑定普通租户业务数据。
- 禁用用户后应使其 refresh token 失效。
- 创建、禁用、角色变更必须写审计日志。
- 平台成员创建或编辑时应保留 `user_profiles.language`，第一阶段可默认 `en`。
- 用户语言后续用于 SaaS Admin 界面语言选择，优先级高于平台默认语言。

### 10.4 审计日志

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/audit-logs` | 查询平台审计日志 | P0 |
| GET | `/saas/audit-logs/:auditLogId` | 查看审计日志详情 | P1 |

审计日志筛选条件：

```text
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

必须审计的操作：

- 创建租户。
- 更新租户。
- 启用/停用租户。
- 创建平台成员。
- 禁用平台成员。
- 修改平台成员角色。
- 修改租户设置。
- 修改功能开关。
- 创建备份任务。
- 提交恢复申请。
- 修改安全设置。

### 10.5 技术反馈

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/feedback-tickets` | 反馈工单列表 | P1 |
| GET | `/saas/feedback-tickets/:ticketId` | 反馈详情 | P1 |
| PATCH | `/saas/feedback-tickets/:ticketId/status` | 更新反馈状态 | P1 |
| PATCH | `/saas/feedback-tickets/:ticketId/assignee` | 更新负责人 | P1 |

反馈状态建议：

```text
open
in_progress
resolved
closed
```

说明：

- 本阶段只做轻量反馈入口。
- 不做完整客服系统。
- 不做 SLA。
- 不做聊天流。
- 不做知识库。

### 10.6 系统日志

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/operation-logs` | 查询平台运行日志摘要 | P1 |

要求：

- 不直接读取服务器 `.log` 文件。
- 不做完整 APM。
- 只展示结构化日志摘要。
- 可按级别、服务、租户、时间筛选。

### 10.7 数据备份

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/backups` | 查询备份任务列表 | P1 |
| POST | `/saas/backups` | 创建手动备份任务记录 | P1 |
| POST | `/saas/backups/:backupId/restore-requests` | 提交恢复申请 | P1 |
| GET | `/saas/restore-requests` | 查询恢复申请列表 | P1 |

注意：

- 本阶段不执行真实数据库备份命令。
- 本阶段不允许普通用户直接恢复生产数据。
- 只创建备份任务记录和恢复申请记录。
- 恢复申请需要后续人工审批流程。

### 10.8 安全管理

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/security/settings` | 获取平台安全设置 | P1 |
| PATCH | `/saas/security/settings` | 更新平台安全设置 | P1 |
| GET | `/saas/security/events` | 查询安全事件 | P1 |

安全事件包括：

- 登录失败。
- 权限拒绝。
- refresh token 异常。
- 用户禁用。
- 租户停用。
- 高权限设置变更。

### 10.9 平台设置

| 方法 | 路径 | 说明 | 优先级 |
| ---- | ---- | ---- | ---- |
| GET | `/saas/platform-settings` | 获取平台默认设置 | P1 |
| PATCH | `/saas/platform-settings` | 更新平台默认设置 | P1 |

---

## 11. 前端页面清单

本阶段前端页面由 AI 生成，目标是跑通流程，不追求最终 UI。

| 页面 | 路由 | 负责人 | 最低要求 |
| ---- | ---- | ---- | ---- |
| SaaS 概览 | `/saas` | 杨序 | 展示概览卡片、近期活动、快捷入口 |
| 租户列表 | `/saas/tenants` | 帅杰 | 表格、搜索、状态筛选、详情入口 |
| 创建租户 | `/saas/tenants/new` | 帅杰 | 表单提交、错误提示、成功跳转 |
| 租户详情 | `/saas/tenants/[tenantId]` | 帅杰 | 详情展示、编辑、启停按钮 |
| 租户设置 | `/saas/tenants/[tenantId]/settings` | 帅杰 | 设置表单、功能开关 |
| 平台成员 | `/saas/users` | 赵付杰 | 列表、邀请、编辑、禁用 |
| 审计日志 | `/saas/audit-logs` | 杨序 / 许婧姝测试 | 列表、筛选、详情摘要 |
| 技术反馈 | `/saas/feedback-tickets` | 孙蕊蕊 | 列表、状态更新、负责人更新 |
| 系统日志 | `/saas/system/logs` | 孙蕊蕊 | 日志摘要列表、筛选 |
| 数据备份 | `/saas/system/backups` | 孙蕊蕊 | 备份列表、手动备份、恢复申请 |
| 安全管理 | `/saas/system/security` | 孙蕊蕊 | 安全设置、安全事件列表 |
| 平台设置 | `/saas/config/platform-settings` | 杨序 | 平台默认设置表单 |
| 个人中心 | `/saas/profile` | 后期 | 当前用户资料展示 |

前端要求：

1. 必须通过 `webAdminApi` 调用接口。
2. 不允许直接写 `fetch`。
3. 表单字段只需覆盖后端必填字段。
4. 必须有 Loading、Empty、Error 状态。
5. 不要求复杂视觉设计。
6. 不新增复杂状态管理库。
7. 不修改 `packages/ui/src/components/ui/**`。
8. 页面文案可以先用英文，后期再统一 i18n。

---

## 12. 数据库设计任务

需要新增或扩展的 schema：

```text
tenants
tenant_settings
tenant_feature_flags
platform_settings
feedback_tickets
operation_logs
backup_jobs
restore_requests
security_settings
security_events
```

### 12.1 tenants 扩展字段建议

```text
status
country
city
default_language
default_currency
contact_name
contact_phone
contact_email
updated_at
deleted_at
version
```

### 12.2 通用字段要求

业务表建议包含：

```text
id
tenant_id
branch_id
created_at
updated_at
created_by
updated_by
deleted_at
deleted_by
version
```

平台级表可以没有 `tenant_id`，但如果记录与租户有关，必须保留 `tenant_id` 方便排查。

---

## 13. 文件所有权规划

为减少冲突，严格按模块分配文件。

| 负责人 | 后端文件范围 | 前端文件范围 |
| ---- | ---- | ---- |
| 李龙杰 | 负责初始数据库 schema 基线建立、公共 auth/audit/permission helper、公共入口方案确认和代码审核 | 负责代码审核、任务统筹、合并顺序、冲突协调和验收推进 |
| 杨序 | 李龙杰建立数据库基线后维护 `packages/db/src/schema/**`，并负责 `apps/api/src/app.ts`、`apps/api/src/modules/saas-audit/**`、`packages/api-client/src/saas/audit-logs*` | 公共入口、API client 聚合出口、SaaS overview/platform settings/audit logs 页面 |
| 帅杰 | `apps/api/src/modules/saas-tenants/**`、`packages/api-client/src/saas/tenants*` | `apps/web-admin/src/features/saas/tenants/**`、租户相关页面 |
| 赵付杰 | `apps/api/src/modules/saas-users/**`、`packages/api-client/src/saas/users*` | `apps/web-admin/src/features/saas/users/**`、平台成员页面 |
| 许婧姝 | 不负责核心业务代码 | 测试文档、接口文档、验收记录 |
| 孙蕊蕊 | `apps/api/src/modules/saas-feedback/**`、`saas-ops/**`、`saas-security/**`、`saas-backups/**` | 反馈、日志、备份、安全页面 |

公共文件规则：

1. 初始数据库 schema 基线由李龙杰先建立，至少包含表名、主键、核心字段、外键关系、审计字段和语言预留字段。
2. 初始数据库基线完成后，`packages/db/src/schema/**` 由杨序按李龙杰确认的方案继续维护和调整。
3. `apps/api/src/app.ts` 只由杨序修改。
4. `packages/db/src/schema/index.ts` 首次由李龙杰建立或确认，后续由杨序维护，李龙杰审核。
5. `packages/api-client/src/saas/index.ts` 由杨序负责技术整合，李龙杰负责审核合并顺序。
6. 权限 helper、审计 helper 由李龙杰编写初始版本并统一维护，其他成员只调用，不直接修改。
7. routes 整合骨架必须先由李龙杰确认方案，再由杨序实现或调整。
8. 其他成员不要直接修改公共入口文件。
9. 如确实需要改公共文件，先说明原因、字段和影响范围。
10. 不允许直接覆盖别人已完成的模块文件。

模块目录开发规则：

1. 每个人只在自己负责的模块目录内开发，不跨模块修改他人文件。
2. 帅杰只修改租户管理相关目录，例如 `apps/api/src/modules/saas-tenants/**`、`packages/api-client/src/saas/tenants*`、`apps/web-admin/src/features/saas/tenants/**`。
3. 赵付杰只修改平台成员相关目录，例如 `apps/api/src/modules/saas-users/**`、`packages/api-client/src/saas/users*`、`apps/web-admin/src/features/saas/users/**`。
4. 孙蕊蕊只修改反馈、系统日志、备份、安全相关目录，例如 `apps/api/src/modules/saas-feedback/**`、`apps/api/src/modules/saas-ops/**`、`apps/api/src/modules/saas-backups/**`、`apps/api/src/modules/saas-security/**`；平台审计日志查询由杨序负责。
5. 许婧姝只维护测试、接口文档和验收记录，不直接修改核心业务代码。
6. **如果 AI 生成代码时改到了非本人负责目录，应立即撤回这部分修改，并让李龙杰判断是否需要转交对应负责人处理。**
7. 该规则预计可以规避约 60%-80% 的同步协作冲突，尤其是多人同时修改 controller、service、API client、页面组件和公共入口文件造成的冲突。

---

## 14. 个人详细任务

### 14.1 杨序

职责：在李龙杰建立数据库基线、权限 helper 和审计 helper 后，负责公共技术整合、数据库后续维护、SaaS 概览、平台设置、平台审计日志查询和公共能力接入。

任务：

1. 基于李龙杰建立的初始数据库 schema 基线，补齐字段、索引、类型导出和必要调整。
2. 根据确认后的 schema 维护数据库迁移。
3. 在各接口中接入李龙杰提供的权限 helper 和审计 helper。
4. 实现 SaaS overview 接口。
5. 实现 platform settings 接口。
6. 实现平台审计日志查询接口，复用审计表和审计 helper 的字段设计。
7. 在 `platform_settings` 中预留 `default_language`，默认值建议为 `en`。
8. 统一挂载的 routes。
9. 按李龙杰确认的合并顺序整合 `packages/api-client/src/saas/index.ts`。
10. 配合李龙杰处理技术风险和公共文件冲突。

接口：

```text
GET /saas/overview
GET /saas/platform-settings
PATCH /saas/platform-settings
GET /saas/audit-logs
GET /saas/audit-logs/:auditLogId
```

重点注意：

- 所有写操作必须能记录 actor、entity、before、after。
- 公共 helper 不要写成业务大杂烩。
- 不能把所有 SaaS 逻辑放进原有 `saas.controller.ts`。
- 平台设置接口需要支持读取和更新 `default_language`，供没有租户上下文的 SaaS 页面兜底使用。
- 配合李龙杰保证 typecheck、lint、build 通过。

### 14.2 帅杰

职责：SaaS 租户管理。

后端任务：

```text
GET /saas/tenants
POST /saas/tenants
GET /saas/tenants/:tenantId
PATCH /saas/tenants/:tenantId
PATCH /saas/tenants/:tenantId/status
GET /saas/tenants/:tenantId/settings
PATCH /saas/tenants/:tenantId/settings
GET /saas/tenants/:tenantId/feature-flags
PATCH /saas/tenants/:tenantId/feature-flags
```

前端任务：

```text
/saas/tenants
/saas/tenants/new
/saas/tenants/[tenantId]
/saas/tenants/[tenantId]/settings
```

重点注意：

- 创建租户时必须生成 ULID。
- `pressingCode` 必须唯一。
- 创建租户时必须处理默认语言：优先使用请求中的 `defaultLanguage`，否则使用 `platform_settings.default_language`，再否则兜底 `en`。
- 创建租户后必须初始化 `tenant_settings.default_language`，不要只在前端保存语言。
- 更新租户设置时如果修改 `defaultLanguage`，必须写审计日志。
- 创建、更新、停用必须写审计日志。
- 停用租户不能删除历史数据。
- 租户详情不存在时返回 404。
- 前端页面先保证能提交、展示、跳转、报错。

### 14.3 赵付杰

职责：SaaS 平台成员管理。

后端任务：

```text
GET /saas/users
POST /saas/users
GET /saas/users/:userId
PATCH /saas/users/:userId
PATCH /saas/users/:userId/status
GET /saas/roles
PATCH /saas/users/:userId/roles
```

前端任务：

```text
/saas/users
平台成员列表
邀请成员表单
编辑成员表单
启用/禁用按钮
角色选择控件
```

重点注意：

- 平台用户 `userType` 必须是 `saas`。
- 不要混入 Tenant 用户逻辑。
- 禁用平台用户后应使 refresh token 失效。
- 角色修改必须写审计日志。
- Support 不应默认拥有 Super Admin 权限。
- 创建或编辑平台成员时保留用户语言字段 `user_profiles.language`，第一阶段默认 `en` 即可。

### 14.4 孙蕊蕊

职责：轻量运维模块、反馈、备份、安全。

后端任务：

```text
GET /saas/feedback-tickets
GET /saas/feedback-tickets/:ticketId
PATCH /saas/feedback-tickets/:ticketId/status
PATCH /saas/feedback-tickets/:ticketId/assignee
GET /saas/operation-logs
GET /saas/backups
POST /saas/backups
POST /saas/backups/:backupId/restore-requests
GET /saas/security/settings
PATCH /saas/security/settings
GET /saas/security/events
```

前端任务：

```text
/saas/feedback-tickets
/saas/system/logs
/saas/system/backups
/saas/system/security
```

重点注意：

- 备份接口只创建任务记录，不执行真实备份命令。
- 恢复申请只提交申请，不直接恢复生产数据。
- 系统日志不读取本地 `.log` 文件。
- 反馈模块不做完整客服系统。
- 状态更新需要写审计日志。

### 14.5 许婧姝

职责：文档、测试、验收。

任务：

1. 记录测试结果。
2. 整理验收报告。
3. 记录未通过问题和风险。

测试重点：

```text
未登录访问 /saas/** 被拒绝
Tenant 用户访问 /saas/** 被拒绝
Super Admin 可以访问 SaaS 页面
创建租户成功
重复 pressingCode 返回错误
停用租户成功并写审计日志
创建平台用户成功
禁用平台用户成功并写审计日志
审计日志可查询
反馈工单状态可更新
备份任务可创建
恢复申请不能直接执行恢复
系统日志可查询
安全事件可查询
```

### 14.6 李龙杰

职责：代码审核、任务统筹、进度协调、初始数据库基线、权限 helper、审计 helper 和验收推进。

任务：

1. 拆分每日任务并确认每个人的文件边界。
2. 先建立初始数据库 schema 基线。
3. 编写权限 helper 初始版本。
4. 编写审计 helper 初始版本。
5. 审核所有成员提交的代码。
6. 控制公共文件修改顺序，避免多人同时修改 `app.ts`、schema index、API client 聚合出口。
7. 重点审核权限、审计、租户隔离、错误码和 AI 是否改了无关文件。
8. 组织每日联调和问题清单更新。
9. 决定 bug 修复优先级，避免 P1 功能影响 P0 主流程。
10. 推进最终验收，确认许婧姝的测试记录和验收报告完整。

审核重点：

```text
是否越权访问 SaaS API
是否遗漏审计日志
是否多人修改同一个公共文件
是否直接 fetch 绕过 api-client
是否真实执行备份/恢复命令
是否把 P1 模块做得过重影响 P0 主流程
是否有 AI 生成的无关重构
```

---

## 15. 每日开发计划

### 15.1 Day 1：基础设施与 P0 接口

李龙杰：

- 确认任务拆分和文件边界。
- 确认公共文件修改顺序。
- 先确认 schema 初稿范围、表名、核心字段和迁移策略。
- 先建立初始数据库 schema 基线，让其他成员可以按表结构并行开发接口。
- 完成权限 helper 初始版本。
- 完成审计 helper 初始版本。
- 建立每日问题清单和代码审核节奏。

杨序：

- 基于李龙杰建立的初始数据库 schema 基线，补齐必要字段、索引、类型导出和迁移问题。
- 根据李龙杰确认后的字段方案，在 `platform_settings`、`tenant_settings`、`user_profiles` 中检查并落实语言预留字段和默认值规则。
- 接入李龙杰提供的权限 helper 和审计 helper。
- 按确认后的公共整合方案完成 routes 整合骨架。

帅杰：

- 完成租户列表。
- 完成创建租户。
- 创建租户逻辑中处理 `defaultLanguage` 和 `tenant_settings.default_language` 初始化。
- 完成租户详情。
- 完成更新租户。

赵付杰：

- 完成平台成员列表。
- 完成创建平台成员。
- 平台成员创建逻辑中保留 `user_profiles.language`，默认 `en`。
- 完成平台成员详情。
- 完成更新平台成员。

孙蕊蕊：

- 完成系统日志列表。
- 完成备份列表。
- 完成安全事件列表。

许婧姝：

- 完成 P0 接口测试用例。

### 15.2 Day 2：状态、配置与反馈

李龙杰：

- 审核 Day 1 代码。
- 检查权限、审计、租户隔离和公共文件冲突。
- 统筹 Day 2 合并顺序。

杨序：

- 修复 schema 和迁移问题。
- 补公共导出和路由挂载。
- 在 schema、权限 helper、审计 helper 稳定后，补齐平台审计日志查询接口。

帅杰：

- 完成租户状态修改。
- 完成租户 settings。
- 租户 settings 中支持查看和更新 `defaultLanguage`，并写入审计日志。
- 完成功能开关接口。

赵付杰：

- 完成用户状态修改。
- 完成角色列表。
- 完成用户角色绑定。

孙蕊蕊：

- 完成反馈工单列表。
- 完成反馈详情。
- 完成反馈状态修改。
- 完成反馈负责人修改。

许婧姝：

- 测试租户和用户模块。

### 15.3 Day 3：前端流程页面

李龙杰：

- 审核 Day 2 代码。
- 确认前端页面只做流程跑通，不做过度设计。
- 统筹 API client 与页面联调顺序。

杨序：

- 整合 API client。
- 完成 SaaS overview 页面。
- 完成平台设置页面基础流程。

帅杰：

- 生成租户列表页面。
- 生成创建租户页面。
- 生成租户详情页面。
- 生成租户设置页面。

赵付杰：

- 生成平台成员列表页面。
- 生成邀请成员表单。
- 生成编辑成员和禁用流程。

孙蕊蕊：

- 生成反馈页面。
- 生成日志页面。
- 生成备份页面。
- 生成安全页面。

许婧姝：

- 执行页面流程测试。

### 15.4 Day 4：联调与修复

李龙杰：

- 集中审核权限、审计、tenant isolation。
- 统筹联调问题修复优先级。
- 决定 P0/P1 问题处理顺序。

杨序：

- 修复公共类型和路由问题。

帅杰：

- 修复租户模块问题。
- 补充错误处理。

赵付杰：

- 修复成员模块问题。
- 补充角色和禁用边界。

孙蕊蕊：

- 修复反馈、日志、备份、安全模块问题。

许婧姝：

- 输出未通过问题清单。

### 15.5 Day 5：验收与交付

李龙杰：

- 组织最终代码审核。
- 统筹验收问题关闭。
- 确认测试记录、接口文档和验收报告完整。

杨序：

- 配合最终技术集成检查。
- 执行 typecheck、lint、build。

帅杰：

- 完成租户模块遗漏修复。

赵付杰：

- 完成成员模块遗漏修复。

孙蕊蕊：

- 完成运维模块遗漏修复。

许婧姝：

- 整理接口文档。
- 整理测试记录。
- 整理验收报告。

---

## 16. AI 开发提示词规范

每次让 AI 生成代码时，应包含以下约束：

```text
请按照 CleanHub 当前项目结构开发。
不要修改无关文件。
不要修改 packages/ui/src/components/ui/**。
后端使用 routes -> controller -> service -> repository 分层。
请求校验使用 Zod。
ID 使用 @cleanhub/id 生成 ULID。
数据库主键使用 varchar(26)。
不要使用自增 ID 或 uuid 主键。
API 必须校验 authContext.role。
SaaS 写操作必须写入 audit_logs。
不要物理删除业务数据。
前端不要直接 fetch，必须通过 webAdminApi。
页面只需要跑通流程，不追求最终 UI。
不要修改公共入口文件，除非该文件属于当前任务范围。
参考CLAUDE.md和AGENTS.md的规范
```

---

## 17. Code Review Checklist

每个 PR 必须检查：

```text
[ ] 是否只修改了自己负责的文件范围
[ ] 是否使用 routes/controller/service/repository 分层
[ ] 是否使用 Zod 校验请求
[ ] 是否使用 ULID
[ ] 是否没有新增自增 ID 或 uuid 主键
[ ] 是否做了 API 权限校验
[ ] 是否写入必要审计日志
[ ] 是否避免物理删除业务数据
[ ] 是否处理 401 / 403 / 404 / 409 / 422
[ ] 是否没有直接 fetch
[ ] 是否没有修改 packages/ui/src/components/ui/**
[ ] 是否通过 typecheck
[ ] 是否通过 lint
[ ] 是否通过 build
```

---

## 18. 验收命令

后端提交前：

```bash
pnpm --filter @cleanhub/api typecheck
pnpm --filter @cleanhub/api lint
pnpm --filter @cleanhub/api build
```

API client 提交前：

```bash
pnpm --filter @cleanhub/api-client typecheck
```

数据库 schema 修改后：

```bash
pnpm db:generate
pnpm --filter @cleanhub/db typecheck
```

前端页面提交前：

```bash
pnpm --filter @cleanhub/web-admin typecheck
pnpm --filter @cleanhub/web-admin lint
pnpm --filter @cleanhub/web-admin build
```

最终整体验收：

```bash
pnpm typecheck
pnpm build
```

---

## 19. 核心难点实现说明

本节用于给开发者提供实现思路和逻辑对照，重点约束第一阶段最容易由 AI 生成代码跑偏的功能。开发时应先对照本节，再进入具体编码。

### 19.1 租户生命周期与租户隔离

难点：

- 租户是 SaaS 平台的核心实体，字段设计和状态逻辑会影响后续 Tenant Admin、POS、订单、支付和报表。
- 租户停用不是删除，不能破坏历史数据。
- 所有租户相关业务数据必须围绕 `tenant_id` 做隔离。

核心逻辑：

```text
创建租户
  -> 校验当前用户必须是 super_admin
  -> 校验 name、pressingCode、country、defaultLanguage、defaultCurrency
  -> 校验 pressingCode 唯一
  -> 生成 ULID
  -> 写入 tenants
  -> 初始化 tenant_settings
  -> 初始化 tenant_feature_flags
  -> 写入 audit_logs
  -> 返回 TenantDetail
```

```text
更新租户
  -> 校验当前用户必须是 super_admin 或具备 SaaS 写权限
  -> 查询租户是否存在
  -> 记录 before
  -> 更新允许修改的字段
  -> 记录 after
  -> 写入 audit_logs
  -> 返回更新后的 TenantDetail
```

```text
停用租户
  -> 校验当前用户必须是 super_admin
  -> 查询租户是否存在
  -> 禁止物理删除租户
  -> 更新 status = suspended 或 disabled
  -> 可选：吊销该租户下用户的 refresh token
  -> 写入 audit_logs，必须记录停用原因
  -> Tenant API 后续访问时检查 tenant status
```

实现注意：

- `pressingCode` 冲突应返回 `409`。
- 租户不存在应返回 `404`。
- 字段校验失败应返回 `422`。
- 停用租户后不要删除 users、orders、payments、audit_logs。
- 不要把 SaaS 租户管理逻辑写入 Tenant Admin 模块。

建议文件：

```text
apps/api/src/modules/saas-tenants/tenants.routes.ts
apps/api/src/modules/saas-tenants/tenants.controller.ts
apps/api/src/modules/saas-tenants/tenants.service.ts
apps/api/src/modules/saas-tenants/tenants.repository.ts
apps/api/src/modules/saas-tenants/tenants.validation.ts
apps/api/src/modules/saas-tenants/tenants.types.ts
```

### 19.2 平台成员、角色与会话失效

难点：

- SaaS 平台成员和 Tenant 员工不是同一类用户。
- 禁用用户后，如果 refresh token 仍然有效，用户可能继续续签登录态。
- 角色变更是敏感操作，必须审计。

核心逻辑：

```text
创建平台成员
  -> 校验当前用户必须是 super_admin
  -> 校验 email/phone/displayName/role
  -> normalizedEmail 去重
  -> userType 固定为 saas
  -> tenantId 必须为 null
  -> 创建 users
  -> 创建 user_profiles
  -> 绑定 SaaS role
  -> 写入 audit_logs
  -> 返回 SaasUserDetail
```

```text
禁用平台成员
  -> 校验当前用户必须是 super_admin
  -> 禁止禁用自己，或至少禁止禁用最后一个 super_admin
  -> 查询目标用户是否为 SaaS 用户
  -> 更新 status = disabled
  -> 吊销该用户 refresh token
  -> 写入 audit_logs
```

```text
修改平台成员角色
  -> 校验当前用户必须是 super_admin
  -> 查询目标用户
  -> 记录 before roles
  -> 更新 user_roles
  -> 记录 after roles
  -> 写入 audit_logs
```

实现注意：

- SaaS 用户 `tenantId` 应为 `null`。
- Tenant 用户不能通过 `/saas/users` 接口被修改。
- Support 角色默认以读权限为主，不应默认拥有租户停用、平台成员禁用等高危写权限。
- 密码、token hash 等敏感字段不能返回给前端。

### 19.3 权限校验与 API 安全边界

难点：

- 前端隐藏菜单不是安全边界。
- API 必须根据 `authContext` 做最终判断。
- SaaS 用户和 Tenant 用户访问范围不同，不能混用。

推荐最小 helper：

```ts
function requireSaasRole(
  authContext: AuthContext,
  allowedRoles: Array<"super_admin" | "support">,
): void;

function requireSuperAdmin(authContext: AuthContext): void;

function assertSaasContext(authContext: AuthContext): void;
```

推荐权限规则：

| 操作 | 允许角色 |
| ---- | ---- |
| 查看 SaaS 概览 | `super_admin`, `support` |
| 查看租户列表/详情 | `super_admin`, `support` |
| 创建租户 | `super_admin` |
| 修改租户 | `super_admin` |
| 停用租户 | `super_admin` |
| 查看平台成员 | `super_admin`, `support` |
| 创建/禁用平台成员 | `super_admin` |
| 查看审计日志 | `super_admin`, `support` |
| 创建备份任务 | `super_admin` |
| 提交恢复申请 | `super_admin` |
| 修改安全设置 | `super_admin` |

实现逻辑：

```text
请求进入 /saas/*
  -> createRequireAuthMiddleware 解析 access token
  -> 写入 authContext
  -> 具体 controller 调用权限 helper
  -> 不符合权限则抛出 AuthError("FORBIDDEN")
  -> error-handler 返回 403
```

实现注意：

- 不要在 service 深处才发现无权限，controller 入口处先做粗粒度权限判断。
- 高风险写操作可以在 service 再做一次业务级校验。
- Tenant 用户访问 `/saas/**` 必须返回 `403`。
- 未登录访问 `/saas/**` 必须返回 `401` 或由现有 auth middleware 统一处理。

### 19.4 审计日志写入

难点：

- 审计日志不是普通运行日志，也不是财务流水。
- 它用于追踪敏感操作：谁、什么时候、对什么对象、做了什么、修改前后是什么。
- 对于关键写操作，业务更新成功但审计没写入，会造成后续无法追责。

推荐最小 helper：

```ts
type WriteAuditLogInput = {
  actorUserId: string;
  tenantId?: string | null;
  branchId?: string | null;
  eventCategory: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  success?: boolean;
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};
```

调用示例：

```ts
await writeAuditLog(db, {
  actorUserId: authContext.userId,
  tenantId: null,
  eventCategory: "saas_tenant",
  eventType: "tenant.status_updated",
  entityType: "tenant",
  entityId: tenant.id,
  reason: input.reason,
  before: { status: before.status },
  after: { status: updated.status },
});
```

必须审计的操作：

| 模块 | 操作 |
| ---- | ---- |
| 租户管理 | 创建租户、更新租户、停用/启用租户 |
| 租户配置 | 修改 settings、修改 feature flags |
| 平台成员 | 创建成员、禁用成员、修改角色 |
| 反馈工单 | 修改状态、修改负责人 |
| 备份恢复 | 创建备份任务、提交恢复申请 |
| 安全管理 | 修改安全设置、处理安全事件 |

实现注意：

- `before` 和 `after` 不能包含 password、token、密钥等敏感字段。
- 关键业务写操作建议和审计写入放在同一个事务中。
- 查询审计日志时应支持时间、操作类型、操作人、对象类型筛选。
- 普通管理员不能修改或删除审计日志。

### 19.5 数据库 schema 初稿

难点：

- schema 一旦频繁变化，会阻塞所有接口和前端 DTO。
- 第一阶段应保持“够用、可扩展、不超范围”。

第一阶段建议最小表：

```text
tenants
tenant_settings
tenant_feature_flags
platform_settings
feedback_tickets
operation_logs
backup_jobs
restore_requests
security_settings
security_events
```

通用字段建议：

```text
id varchar(26) primary key
tenant_id varchar(26) nullable
branch_id varchar(26) nullable
created_at timestamptz not null
updated_at timestamptz not null
created_by varchar(26) nullable
updated_by varchar(26) nullable
deleted_at timestamptz nullable
deleted_by varchar(26) nullable
version integer not null default 1
```

设计原则：

- 平台级配置可以没有 `tenant_id`。
- 与某个租户相关的日志、备份、反馈必须保留 `tenant_id`。
- Phase 1 不做复杂 RLS，但字段必须为后续 RLS 预留。
- 不要为 Phase 2/3 的复杂能力提前建过多表。
- 删除类操作优先软删除。

### 19.6 SaaS 对租户功能的配置

难点：

- 不同租户可能开通的业务能力不同，例如一个租户只做洗衣，另一个租户同时做洗衣、洗车和商品售卖。
- 这些能力不建议全部堆到 `tenants` 主表中，否则租户主体信息会越来越混乱。
- 第一阶段需要先建立清晰的租户功能配置边界，后续 Tenant Admin、POS、API 都可以基于它判断功能是否可用。

设计建议：

新建一张独立的商户权限/租户功能配置表，专门存储某个租户开通了哪些功能。

推荐表名：

```text
tenant_feature_flags
```

表职责：

```text
tenants
  -> 记录租户是谁，例如名称、Pressing Code、国家、状态、联系人

tenant_feature_flags
  -> 记录租户能用什么功能，例如洗衣、洗车、商品售卖、配送、通知
```

第一阶段推荐先做 5 个功能开关：

| 功能 | 字段建议 | 说明 |
| ---- | ---- | ---- |
| 洗衣/干洗核心业务 | `laundry_enabled` | 控制租户是否启用洗衣、压烫、干洗等主业务线 |
| 洗车业务 | `car_wash_enabled` | 控制租户是否启用洗车服务、洗车价格配置和洗车业务入口 |
| 商品售卖业务 | `retail_products_enabled` | 控制租户是否启用洗衣液、耗材、护理用品等零售商品售卖 |
| 取送/配送业务 | `delivery_enabled` | 控制租户是否启用上门取衣、配送状态、配送人员入口 |
| 通知能力 | `notifications_enabled` | 控制租户是否启用 WhatsApp/SMS/Email 通知配置和发送记录入口 |

推荐字段：

```text
id
tenant_id
laundry_enabled
car_wash_enabled
retail_products_enabled
delivery_enabled
notifications_enabled
created_at
updated_at
updated_by
version
```

示例：

```text
普通洗衣店租户
  laundry_enabled = true
  car_wash_enabled = false
  retail_products_enabled = false
  delivery_enabled = false
  notifications_enabled = true
```

```text
洗衣 + 洗车综合店租户
  laundry_enabled = true
  car_wash_enabled = true
  retail_products_enabled = true
  delivery_enabled = true
  notifications_enabled = true
```

SaaS 开启租户洗车业务的逻辑示例：

```text
Super Admin 打开租户功能配置页面
  -> 开启 Car Wash 开关
  -> 前端调用 PATCH /saas/tenants/:tenantId/feature-flags
  -> 后端校验当前用户必须是 super_admin
  -> 后端查询租户是否存在
  -> 后端查询当前 tenant_feature_flags
  -> 记录 before: { carWashEnabled: false }
  -> 更新 tenant_feature_flags.car_wash_enabled = true
  -> 记录 after: { carWashEnabled: true }
  -> 写入 audit_logs
  -> 返回最新 feature flags
```

后续使用方式：

```text
Tenant Admin 页面
  -> 读取 tenant_feature_flags
  -> car_wash_enabled = true 时显示洗车配置入口
  -> car_wash_enabled = false 时隐藏洗车配置入口

POS 页面
  -> 读取 tenant_feature_flags
  -> retail_products_enabled = true 时显示商品售卖入口
  -> delivery_enabled = true 时显示取送/配送入口

后端业务 API
  -> 不能只依赖前端隐藏
  -> 洗车相关 API 必须检查 car_wash_enabled
  -> 商品售卖相关 API 必须检查 retail_products_enabled
  -> 未开通功能时返回 403 或 FEATURE_DISABLED
```

实现注意：

- 第一阶段只做功能是否开启，不做复杂套餐计费。
- 修改功能开关必须写审计日志。
- 功能开关只决定功能可见和 API 是否允许使用，不自动生成完整业务数据。
- 开启某个功能后，具体服务项目、价格、门店配置仍由 Tenant Admin 后续配置。
- 不建议使用 `1/0` 整数字段，PostgreSQL + Drizzle 中推荐使用 `boolean`。

### 19.7 API client 与前端流程跑通

难点：

- 如果前端直接 `fetch`，后期 cookie、错误处理、refresh、类型都会散掉。
- 本阶段前端虽然由 AI 生成，但必须接入正确调用链。

调用链必须保持：

```text
page/component
  -> features/**/queries or actions
    -> apps/web-admin/src/lib/api-client.ts
      -> packages/api-client
        -> apps/api
```

新增接口顺序：

```text
1. apps/api 实现后端接口
2. packages/api-client 增加 typed method 和 DTO
3. apps/web-admin/src/features/** 增加 query/action
4. page/component 调用 query/action
```

前端最小状态：

```text
Loading
Empty
Error
Success
Permission denied
```

实现注意：

- 页面只需跑通流程，不追求最终 UI。
- 不要直接调用 `fetch`。
- 不要把复杂业务规则写进 React component。
- 表单提交失败时应展示后端错误信息。

### 19.8 多语言能力预留方案

难点：

- CleanHub 面向塞内加尔及西非法语区，后续至少需要支持英语和法语。
- 如果第一阶段完全不预留语言字段，后续会影响 SaaS Admin、Tenant Admin、POS、通知模板、小票和标签。
- 第一阶段不做完整 i18n 系统，但要把数据字段和语言选择优先级预留好。

预留原则：

```text
现在预留语言字段
现在不做完整翻译后台
现在不做在线翻译管理
现在不做复杂通知模板审核
后续再接入 packages/i18n 和完整语言切换
```

推荐预留字段：

| 层级 | 字段 | 用途 |
| ---- | ---- | ---- |
| 平台级 | `platform_settings.default_language` | SaaS Admin、登录页、无租户上下文时的兜底语言 |
| 租户级 | `tenant_settings.default_language` | Tenant Admin、POS、通知、小票和标签的租户默认语言 |
| 用户级 | `user_profiles.language` | 用户个人语言偏好，允许同一租户内不同管理员使用不同语言 |

语言优先级：

```text
user_profiles.language
  -> tenant_settings.default_language
  -> platform_settings.default_language
  -> "en"
```

第一阶段允许的语言值建议：

```text
en
fr
zh-CN
```

实现建议：

```text
登录后获取 authContext / profile
  -> 如果用户有 language，优先使用用户语言
  -> 否则如果有 tenant_settings.default_language，使用租户默认语言
  -> 否则如果有 platform_settings.default_language，使用平台默认语言
  -> 否则兜底使用 en
```

前端预留方式：

- 第一阶段页面可以先使用英文文案。
- 不要求完整翻译所有页面。
- 不要把大量文案散落在复杂业务逻辑中。
- 页面文案尽量集中在 feature 的 `constants.ts` 或 copy 对象中，方便后续迁移到 `packages/i18n`。
- 语言切换下拉框可以先预留入口，不要求第一阶段完整切换所有页面文案。

通知、小票和标签预留：

```text
通知模板后续应按 language + template_key 管理
小票和标签默认使用 tenant_settings.default_language
如后续需要门店级覆盖，再增加 branch_settings.default_language
```

实现边界：

- 第一阶段只预留字段和优先级规则。
- 第一阶段不做完整多语言翻译系统。
- 第一阶段不做在线翻译管理后台。
- 第一阶段不做复杂通知模板多语言审核。
- 后续正式多语言实现时，再统一接入 `packages/i18n`。

### 19.9 反馈、日志、备份、安全模块边界

难点：

- 这些模块很容易被 AI 写成完整客服系统、完整日志平台或真实备份系统，导致范围失控。
- Phase 1.1 只做 SaaS 后台可见性和基础操作入口。

反馈工单：

```text
只做：列表、详情、状态更新、负责人更新
不做：聊天、SLA、知识库、完整客服系统
```

系统日志：

```text
只做：结构化日志摘要查询
不做：读取本地 .log 文件、APM、分布式链路追踪
```

数据备份：

```text
只做：创建备份任务记录、查看任务状态、提交恢复申请
不做：真实执行 pg_dump、自动恢复、普通用户直接恢复生产数据
```

安全管理：

```text
只做：基础安全设置、安全事件列表
不做：完整风控平台、复杂 2FA 策略、异常登录自动处置
```

### 19.10 并发、冲突和错误码

难点：

- 多人用 AI 开发时容易遗漏冲突处理。
- 创建租户、创建用户、修改状态都可能出现重复或并发问题。

建议错误码：

| 场景 | HTTP 状态 |
| ---- | ---- |
| 未登录 | 401 |
| 无权限 | 403 |
| 资源不存在 | 404 |
| 唯一字段冲突 | 409 |
| 校验失败 | 422 |
| 服务端异常 | 500 |

建议处理：

- `pressingCode` 重复返回 `409`。
- email 重复返回 `409`。
- 非法状态流转返回 `422` 或 `409`。
- 更新前先查询当前数据，用于生成 `before`。
- 关键写操作尽量使用事务。

### 19.11 第一阶段最容易跑偏的点

开发者和李龙杰重点检查：

```text
是否把 SaaS 用户和 Tenant 用户混在一起
是否把审计日志当成普通 logger
是否直接删除租户或用户
是否遗漏写操作审计
是否只在前端做权限判断
是否直接 fetch 绕过 api-client
是否真实执行数据库备份命令
是否把反馈模块做成完整客服系统
是否把系统日志做成读取本地日志文件
是否在 components/ui 下直接改 shadcn 组件
是否多人同时修改 app.ts 或 saas/index.ts
```

---

## 20. 最终验收标准

本期通过标准：

1. SaaS Admin 可以登录并进入 `/saas`。
2. SaaS 概览页面可以展示基础数据。
3. 租户可以创建、查看、编辑、启用、停用。
4. 租户设置和功能开关可以查看和更新。
5. 平台成员可以创建、查看、编辑、禁用。
6. 平台成员角色可以查看和绑定。
7. 审计日志可以查询。
8. 反馈工单可以查看和更新状态。
9. 系统日志摘要可以查询。
10. 备份任务可以查看和创建。
11. 恢复申请只能提交申请，不能直接恢复生产数据。
12. 安全设置可以查看和更新。
13. 安全事件可以查询。
14. 所有 P0 写操作都有审计日志。
15. Tenant 用户不能访问 SaaS API。
16. 前端页面可以跑通主流程。
17. API client 类型完整。
18. 后端、API client、前端 typecheck 通过。
19. 构建通过。
20. 许婧姝完成测试记录和验收报告。

---

## 21. 风险与控制

| 风险 | 影响 | 控制方式 |
| ---- | ---- | ---- |
| AI 修改公共文件造成冲突 | 合并困难 | 公共文件由杨序技术整合，李龙杰审核合并顺序 |
| 权限遗漏 | 可能造成越权访问 | 李龙杰统一代码审核，许婧姝按用例测试 |
| 审计日志遗漏 | 敏感操作不可追溯 | 写操作 checklist 强制检查 |
| 前端页面质量不稳定 | 页面体验一般 | 本期只要求流程跑通，后期统一 UI |
| 数据库字段反复变更 | 影响多人开发 | Day 1 由李龙杰先定 schema 初稿 |
| 学生成员任务过难 | 进度不稳定 | 孙蕊蕊负责简单模块，许婧姝负责测试文档 |
| 备份误做真实恢复 | 数据安全风险 | 本期只做任务记录和恢复申请 |
| Tenant/SaaS 边界混乱 | 数据隔离风险 | API 层强制校验 role 和 tenant context |
| 原始 fetch 散落 | 后期维护困难 | 前端统一使用 `webAdminApi` |
| 页面和接口字段不一致 | 联调失败 | 许婧姝维护接口字段文档，开发前先对齐 |

---

## 22. 交付物

最终需要交付：

1. SaaS 平台后端接口代码。
2. SaaS 平台 API client 方法和 DTO 类型。
3. SaaS 平台基础前端页面。
4. 数据库 schema 和迁移。
5. 接口文档。
6. 测试用例。
7. 测试执行记录。
8. 未通过问题清单。
9. 最终验收报告。
10. 风险和遗留事项清单。

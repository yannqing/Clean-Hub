# CleanHub Phase 1 Backlog 初稿

| 版本 | 修改日期 | 修改人 | 状态 | 说明 |
| ---- | -------- | ------ | ---- | ---- |
| v0.1 | 2026.05.12 | yannqing | Draft | 基于 PRD、Phase 1 范围、Web Admin TRD 和当前项目结构生成的 Backlog 初稿 |

---

## 1. 文档定位

本文档是 CleanHub Phase 1 的 Backlog 初稿，用于把 PRD、TRD 和阶段范围拆解为可排期、可分配、可验收的研发任务。

> **说明：本文档不是最终排期。**  
> Backlog 负责描述“要做什么、为什么做、做到什么算完成”。具体 Sprint 排期、负责人、工期和上线时间，需要项目经理结合资源和依赖单独制定。

## 2. 拆分原则

本 Backlog 按以下层级拆分：

```text
Epic -> User Story -> Acceptance Criteria -> Engineering Tasks
```

字段说明：

| 字段 | 说明 |
| ---- | ---- |
| `Epic` | 一个较大的业务或技术模块 |
| `Story` | 一个用户可感知或业务可验收的能力 |
| `Priority` | P0 / P1 / P2 |
| `Owner` | 建议负责角色，不代表最终负责人 |
| `Dependencies` | 前置依赖 |
| `Acceptance Criteria` | 验收标准 |
| `Engineering Tasks` | 研发拆解任务 |

## 3. 优先级定义

| 优先级 | 定义 | Phase 1 判断口径 |
| ------ | ---- | ---------------- |
| **P0** | 没有它无法完成试点营业或核心后台配置 | 必须进入 Phase 1 |
| **P1** | 重要能力，影响效率、权限、安全或运维 | 原则上进入 Phase 1，资源不足时可拆小 |
| **P2** | 增强体验、扩展能力或后续优化 | 不阻塞 Phase 1，可后置 |

## 4. Epic 总览

| Epic ID | Epic | Priority | 目标 |
| ------- | ---- | -------- | ---- |
| EPIC-01 | Web Admin 基础框架与导航 | P0 | 建立 SaaS Admin / Tenant Admin 的页面框架和导航骨架 |
| EPIC-02 | 认证、登录态与权限守卫 | P0 | 完成 Web Admin 登录、Token 刷新、登出和路由保护 |
| EPIC-03 | SaaS 租户管理 | P0 | 平台方可创建和管理试点租户 |
| EPIC-04 | SaaS 用户与平台审计 | P1 | 平台方可管理内部账号并查看关键审计日志 |
| EPIC-05 | Tenant 门店与组织配置 | P0 | 租户可配置门店和基础营业信息 |
| EPIC-06 | Tenant 用户、角色与权限 | P0 | 租户可管理员工账号、角色和门店访问范围 |
| EPIC-07 | 服务目录与价格管理 | P0 | 租户可配置 POS 所需服务和基础价格 |
| EPIC-08 | 硬件配置入口 | P1 | 租户可维护打印机、扫码枪、钱箱等基础配置 |
| EPIC-09 | 基础报表入口 | P1 | 租户可查看 Phase 1 所需基础经营指标入口 |
| EPIC-10 | API Client、错误处理与页面状态 | P0 | 建立前后端调用、错误码、Loading/Empty/Error 状态规范 |
| EPIC-11 | 审计日志与安全事件 | P0 | 敏感操作必须可追溯 |
| EPIC-12 | Phase 1 验收与质量门禁 | P0 | 明确测试、构建、验收和发布准入标准 |

---

## 5. Epic 明细

## EPIC-01 Web Admin 基础框架与导航

**目标**：建立 SaaS Admin 和 Tenant Admin 两套后台的基础布局、侧边栏、顶部快捷 tabs 和页面骨架。

**Owner**：Frontend  
**Priority**：P0  
**Dependencies**：shadcn/ui、Next.js App Router、当前 web-admin 目录结构

### STORY-01-01 SaaS Admin 基础布局

**User Story**：作为平台管理员，我希望进入 `/saas` 后看到清晰的平台后台导航，以便管理租户、平台用户、配置和系统设置。

**Acceptance Criteria**：

- `/saas` 页面展示 SaaS Admin 侧边栏。
- 侧边栏包含 Workbench、Personal Center、User Management、Configuration Management、System Settings、Sign Out。
- 顶部 tabs 至少包含 Workbench、Tenants、Users、Logs。
- 页面在桌面端布局稳定，不出现明显重叠。

**Engineering Tasks**：

- 创建 SaaS Admin layout。
- 创建可复用 Admin Dashboard Shell。
- 配置 SaaS sidebar navigation。
- 配置 SaaS workspace tabs。
- 使用 shadcn Button、Badge、Card 等基础组件。

### STORY-01-02 Tenant Admin 基础布局

**User Story**：作为租户管理员，我希望进入 `/tenant` 后看到租户后台导航，以便管理门店、员工、服务、价格、硬件和报表。

**Acceptance Criteria**：

- `/tenant` 页面展示 Tenant Admin 侧边栏。
- 侧边栏包含 Workbench、Personal Center、User Management、Reports、Configuration Management、System Settings、Sign Out。
- Configuration Management 下包含 Branch Settings、Service Catalog、Price Books、Hardware Devices、Notifications。
- System Settings 下包含 Operation Logs、Data Backups、Tenant Preferences。

**Engineering Tasks**：

- 创建 Tenant Admin layout。
- 配置 Tenant sidebar navigation。
- 配置 Tenant workspace tabs。
- 创建 Tenant profile、system、config 相关占位页面。

### STORY-01-03 页面骨架占位规范

**User Story**：作为开发人员，我希望所有未实现页面都有统一占位风格，以便团队开发前能清楚知道页面职责。

**Acceptance Criteria**：

- 占位页面包含标题、说明和模块卡片。
- 占位内容全部使用英文。
- 不出现“空白页”或未处理的异常页面。

**Engineering Tasks**：

- 改造 PagePlaceholder。
- 为新增路由补充页面文件。
- 确保 `typecheck`、`lint`、`build` 通过。

---

## EPIC-02 认证、登录态与权限守卫

**目标**：完成 Web Admin 的认证闭环，采用 Access Token + Refresh Token + HttpOnly Cookie 模型。

**Owner**：Fullstack  
**Priority**：P0  
**Dependencies**：`apps/api` Auth Service、`packages/db` users / roles / refresh tokens / audit logs schema

### STORY-02-01 登录表单

**User Story**：作为管理员，我希望通过 `/login` 输入账号密码登录，以便进入对应后台。

**Acceptance Criteria**：

- 登录表单包含 identifier、password、tenant code 可选字段。
- 表单有 loading、field error、submit error 状态。
- 登录失败展示统一错误，不暴露账号是否存在。
- 登录成功后根据角色跳转 `/saas` 或 `/tenant`。

**Engineering Tasks**：

- 替换 LoginFormPlaceholder 为真实表单。
- 实现 login validator。
- 实现 `loginAction`。
- 调用 `POST /auth/login`。
- 登录成功后调用 `/auth/me` 或使用返回的 Auth Context。

### STORY-02-02 当前用户上下文

**User Story**：作为已登录管理员，我希望系统能识别我的角色、权限和租户上下文，以便展示正确菜单和页面。

**Acceptance Criteria**：

- `getCurrentUser()` 能读取当前 Auth Context。
- 前端不读取 token 明文。
- Auth Context 至少包含 userId、tenantId、role、permissions、branchIds。
- 页面刷新后仍能保持登录态。

**Engineering Tasks**：

- 实现 `GET /auth/me` 调用。
- 实现 `getCurrentUser`。
- 定义 Web Admin Auth Context 类型。
- 增加权限判断 helper。

### STORY-02-03 Token 刷新

**User Story**：作为已登录用户，我希望 access token 过期时系统自动刷新，以便不中断后台操作。

**Acceptance Criteria**：

- API 返回 401 且可刷新时，自动调用 `/auth/refresh`。
- refresh 成功后重试原请求。
- refresh 失败后清理登录态并跳转 `/login`。
- refresh token 轮换由 API 负责。

**Engineering Tasks**：

- 实现 apiClient 401 处理。
- 实现 refresh 请求。
- 定义不可重试错误规则，避免死循环。

### STORY-02-04 登出

**User Story**：作为管理员，我希望点击 Sign Out 后安全退出系统。

**Acceptance Criteria**：

- 点击 Sign Out 调用 `/auth/logout`。
- API 清理 HttpOnly Cookie。
- Web Admin 跳转 `/login`。
- 登出写入审计日志。

**Engineering Tasks**：

- 实现 `logoutAction`。
- 侧边栏 Sign Out 接入真实 action。
- API logout 完成后 redirect。

### STORY-02-05 路由守卫

**User Story**：作为系统负责人，我希望未授权用户不能访问 SaaS 或 Tenant 页面，以便保护租户数据。

**Acceptance Criteria**：

- 未登录访问 `/saas/**` 或 `/tenant/**` 跳转 `/login`。
- Tenant 用户访问 `/saas/**` 返回 403。
- SaaS 用户访问 `/tenant/**` 返回 403，除非未来存在明确代操作流程。
- Manager 仅能访问授权门店范围。

**Engineering Tasks**：

- 在 SaaS layout 增加 auth guard。
- 在 Tenant layout 增加 auth guard。
- 增加 403 页面或权限拒绝组件。
- API 层保留最终权限校验。

---

## EPIC-03 SaaS 租户管理

**目标**：平台方可以创建、查看、编辑、启用/停用试点租户。

**Owner**：Fullstack  
**Priority**：P0  
**Dependencies**：tenant schema、Auth/RBAC、Audit

### STORY-03-01 租户列表

**User Story**：作为 Super Admin，我希望查看租户列表，以便了解平台当前管理的商户。

**Acceptance Criteria**：

- `/saas/tenants` 展示租户列表。
- 支持按名称或 pressing code 搜索。
- 支持按状态筛选。
- 列表展示 name、pressing code、status、country、city、created at。
- Empty 和 Error 状态清晰。

**Engineering Tasks**：

- 补充 TenantSummary 类型。
- 实现租户列表 API。
- 实现 getTenantListQuery。
- 创建租户表格组件。
- 增加搜索和筛选 UI。

### STORY-03-02 创建租户

**User Story**：作为 Super Admin，我希望创建试点租户，以便新门店可以进入 CleanHub。

**Acceptance Criteria**：

- `/saas/tenants/new` 展示创建租户表单。
- 必填字段包含 name、pressing code、country、default language、default currency。
- pressing code 必须唯一。
- 创建成功后进入租户详情页。
- 创建租户写入审计日志。

**Engineering Tasks**：

- 实现 tenant form validator。
- 实现 createTenantAction。
- 实现 `POST /saas/tenants`。
- DB 增强 tenants schema。
- 写入 `audit_logs`。

### STORY-03-03 租户详情

**User Story**：作为 Super Admin，我希望查看租户详情，以便确认租户基础配置和状态。

**Acceptance Criteria**：

- `/saas/tenants/[tenantId]` 展示租户基础信息。
- 展示门店数量、用户数量、状态和创建时间。
- 若租户不存在，展示 404。

**Engineering Tasks**：

- 实现 getTenantDetailQuery。
- 实现 `GET /saas/tenants/:tenantId`。
- 创建详情页面信息组件。

### STORY-03-04 租户启用/停用

**User Story**：作为 Super Admin，我希望启用或停用租户，以便控制试点租户的访问。

**Acceptance Criteria**：

- 可从租户详情或设置页面修改租户状态。
- 停用租户后，该租户用户无法继续访问 Tenant Admin。
- 操作必须记录原因。
- 操作必须写入审计日志。

**Engineering Tasks**：

- 实现 updateTenantStatusAction。
- 实现 `PATCH /saas/tenants/:tenantId/status`。
- 增加状态变更确认弹窗。
- 写入审计日志 before/after。

---

## EPIC-04 SaaS 用户与平台审计

**目标**：平台方可以管理内部管理员账号，并查看平台级敏感操作日志。

**Owner**：Fullstack  
**Priority**：P1  
**Dependencies**：RBAC、Audit、Auth

### STORY-04-01 平台用户列表

**User Story**：作为 Super Admin，我希望查看平台用户，以便管理内部操作人员。

**Acceptance Criteria**：

- `/saas/users` 展示平台用户列表。
- 展示 email、name、role、status、last login。
- 支持启用/禁用用户。

**Engineering Tasks**：

- 实现 SaaS user list API。
- 创建平台用户表格。
- 实现用户状态更新 action。

### STORY-04-02 邀请平台用户

**User Story**：作为 Super Admin，我希望邀请平台支持人员，以便他们协助租户管理和排障。

**Acceptance Criteria**：

- 可输入 email、name、role。
- 支持角色 super_admin、support。
- 邀请后用户状态为 invited。
- 邀请操作写入审计日志。

**Engineering Tasks**：

- 实现 inviteSaasUserAction。
- 实现 `POST /saas/users/invitations`。
- 预留邮件发送接口。

### STORY-04-03 平台审计日志

**User Story**：作为 Super Admin，我希望查看平台审计日志，以便追踪敏感操作。

**Acceptance Criteria**：

- `/saas/audit-logs` 展示审计日志。
- 支持按 actor、event type、时间范围筛选。
- 展示成功/失败状态和原因。

**Engineering Tasks**：

- 实现 audit log query。
- 创建审计日志表格。
- API 支持分页和筛选。

---

## EPIC-05 Tenant 门店与组织配置

**目标**：租户 Owner / Manager 可以配置门店基础信息，为 POS 营业做准备。

**Owner**：Fullstack  
**Priority**：P0  
**Dependencies**：branches schema、Tenant Auth Context

### STORY-05-01 门店列表

**User Story**：作为 Owner，我希望查看门店列表，以便管理租户下的营业门店。

**Acceptance Criteria**：

- `/tenant/branches` 展示门店列表。
- 展示名称、地址、电话、状态、默认语言、默认货币。
- Manager 只看到授权门店。

**Engineering Tasks**：

- 新增 branches schema。
- 实现 branch list API。
- 实现 getBranchListQuery。
- 创建门店表格。

### STORY-05-02 创建门店

**User Story**：作为 Owner，我希望创建门店，以便配置试点营业地点。

**Acceptance Criteria**：

- 支持创建门店名称、地址、电话、营业时间、默认语言、默认货币。
- 创建后门店归属当前 tenant。
- 创建门店写入审计日志。

**Engineering Tasks**：

- 实现 branch form validator。
- 实现 createBranchAction。
- 实现 `POST /tenant/branches`。
- API 强制写入 tenant_id。

### STORY-05-03 编辑门店

**User Story**：作为 Owner 或 Manager，我希望编辑门店信息，以便维护实际营业配置。

**Acceptance Criteria**：

- 支持编辑基础信息和营业状态。
- Manager 只能编辑授权门店。
- 修改记录 before/after。

**Engineering Tasks**：

- 实现 updateBranchAction。
- 实现 `PATCH /tenant/branches/:branchId`。
- 增加权限校验。
- 写入审计日志。

---

## EPIC-06 Tenant 用户、角色与权限

**目标**：租户可以创建和管理员工账号，并控制角色与门店访问范围。

**Owner**：Fullstack  
**Priority**：P0  
**Dependencies**：users、roles、permissions、user_roles schema

### STORY-06-01 员工列表

**User Story**：作为 Owner，我希望查看员工列表，以便管理门店人员。

**Acceptance Criteria**：

- `/tenant/users` 展示员工列表。
- 展示姓名、邮箱/手机号、角色、门店范围、状态。
- Manager 不能管理 Owner。

**Engineering Tasks**：

- 实现 tenant user list API。
- 实现 getTenantUserListQuery。
- 创建员工表格。

### STORY-06-02 邀请员工

**User Story**：作为 Owner，我希望邀请员工账号，以便他们登录 Tenant Admin 或 POS。

**Acceptance Criteria**：

- 可配置姓名、邮箱/手机号、角色、门店范围。
- 支持 Owner、Manager、Cashier 基础角色。
- 新员工状态为 invited 或 active，具体由认证流程确认。
- 操作写入审计日志。

**Engineering Tasks**：

- 实现 inviteTenantUserAction。
- 实现员工表单 validator。
- 实现 API 和 DB 写入。

### STORY-06-03 禁用员工

**User Story**：作为 Owner，我希望禁用员工账号，以便离职员工不能继续访问系统。

**Acceptance Criteria**：

- 禁用后员工不能登录。
- 禁用后相关 refresh token 被吊销。
- 禁用操作写入审计日志。

**Engineering Tasks**：

- 实现 updateTenantUserAction。
- API 吊销用户 token。
- 写入审计日志。

---

## EPIC-07 服务目录与价格管理

**目标**：租户可以配置 POS 下单所需服务项目和基础价格。

**Owner**：Fullstack  
**Priority**：P0  
**Dependencies**：services schema、prices schema、Audit

### STORY-07-01 服务目录列表

**User Story**：作为 Owner 或 Manager，我希望查看服务目录，以便确认 POS 可售服务。

**Acceptance Criteria**：

- `/tenant/services` 展示服务分类和服务项目。
- 展示服务名称、分类、计价方式、状态。
- 支持启用/停用。

**Engineering Tasks**：

- 新增 services schema。
- 实现 service list API。
- 创建服务表格。

### STORY-07-02 创建和编辑服务

**User Story**：作为 Owner 或 Manager，我希望创建或编辑服务项目，以便配置门店业务。

**Acceptance Criteria**：

- 支持服务名称、分类、计价方式、默认状态。
- 计价方式至少支持 per item、per kg。
- 修改服务写入审计日志。

**Engineering Tasks**：

- 实现 createServiceAction。
- 实现 updateServiceAction。
- 实现 validator 和 API。

### STORY-07-03 价格管理

**User Story**：作为 Owner 或 Manager，我希望维护服务价格，以便 POS 可以正确计价。

**Acceptance Criteria**：

- `/tenant/prices` 展示价格表。
- 支持按服务维护标准价格。
- 已确认订单不受后续价格修改影响。
- 价格修改必须写入审计日志。

**Engineering Tasks**：

- 新增 price books / price items schema。
- 实现 price list API。
- 实现 updatePriceBookAction。
- 预留价格快照规则给 POS 订单使用。

---

## EPIC-08 硬件配置入口

**目标**：租户可以维护 Phase 1 所需硬件配置，供 POS、desktop、mobile 后续读取。

**Owner**：Fullstack / Hardware  
**Priority**：P1  
**Dependencies**：hardware configs schema、硬件型号确认

### STORY-08-01 硬件设备列表

**User Story**：作为 Owner 或 Manager，我希望查看门店硬件设备，以便确认打印机、扫码枪、钱箱配置。

**Acceptance Criteria**：

- `/tenant/hardware` 展示设备列表。
- 展示设备名称、类型、门店、连接方式、状态。
- 支持按门店筛选。

**Engineering Tasks**：

- 新增 hardware_configs schema。
- 实现 device list API。
- 创建设备表格。

### STORY-08-02 绑定或编辑设备

**User Story**：作为 Owner 或 Manager，我希望绑定设备到门店，以便 POS 使用正确硬件。

**Acceptance Criteria**：

- 支持 printer、scanner、cash drawer 类型。
- 支持 USB、Bluetooth、Network 等连接方式字段。
- 修改硬件配置写入审计日志。

**Engineering Tasks**：

- 实现 bindDeviceAction。
- 实现 updateDeviceAction。
- 实现设备配置表单。

---

## EPIC-09 基础报表入口

**目标**：Tenant Admin 提供 Phase 1 所需基础经营指标入口。

**Owner**：Fullstack  
**Priority**：P1  
**Dependencies**：订单、支付、报表 API 后续接入

### STORY-09-01 Tenant 报表工作台

**User Story**：作为 Owner 或 Manager，我希望查看今日基础经营数据，以便快速了解门店状态。

**Acceptance Criteria**：

- `/tenant/reports` 展示今日订单数、今日营收、支付方式汇总、待取订单数。
- 当前无真实订单 API 时允许展示空状态。
- 权限不足用户不能访问敏感报表。

**Engineering Tasks**：

- 实现 report summary query。
- 创建 summary cards。
- 接入 API 后替换 placeholder。

### STORY-09-02 Z Report 入口

**User Story**：作为 Owner 或 Manager，我希望进入 Z Report 入口，以便后续完成日结。

**Acceptance Criteria**：

- 报表页面预留 Z Report 入口。
- 展示当前阶段支持和不支持的字段。
- 不误导用户认为高级 BI 已完成。

**Engineering Tasks**：

- 创建 Z Report placeholder。
- 定义报表字段类型。
- 等支付和订单模块完成后接入真实数据。

---

## EPIC-10 API Client、错误处理与页面状态

**目标**：建立 Web Admin 与 API 的统一调用方式，避免每个页面重复处理错误和刷新 token。

**Owner**：Frontend / Fullstack  
**Priority**：P0  
**Dependencies**：Auth API、错误码规范

### STORY-10-01 Web Admin API Client

**User Story**：作为开发人员，我希望有统一 API client，以便所有页面调用 API 的方式一致。

**Acceptance Criteria**：

- 支持 GET、POST、PATCH、DELETE。
- 自动携带 cookie。
- 统一处理 JSON 请求和响应。
- 统一处理 401、403、404、409、422、500。

**Engineering Tasks**：

- 实现 `apiClient`。
- 定义 ApiError 类型。
- 增加 refresh token retry。
- 增加基础日志。

### STORY-10-02 页面状态规范

**User Story**：作为用户，我希望页面加载、无数据、错误和无权限状态清晰，以便知道系统当前状态。

**Acceptance Criteria**：

- 列表页有 loading、empty、error。
- 表单页有 saving、saved、field error。
- 无权限展示 403。
- 资源不存在展示 404。

**Engineering Tasks**：

- 创建 EmptyState 组件。
- 创建 ErrorState 组件。
- 创建 PermissionDenied 组件。
- 在主要页面接入。

---

## EPIC-11 审计日志与安全事件

**目标**：所有敏感操作必须记录审计日志，满足后续追责和运维排查。

**Owner**：Backend / Fullstack  
**Priority**：P0  
**Dependencies**：audit_logs schema、Auth Context

### STORY-11-01 认证审计

**User Story**：作为系统负责人，我希望登录、登出、刷新 token 异常被记录，以便排查安全问题。

**Acceptance Criteria**：

- 登录成功写入审计。
- 登录失败写入审计，但不泄露密码。
- 登出写入审计。
- refresh token reuse 写入高风险审计。

**Engineering Tasks**：

- 完善 auth audit event。
- 统一 event type 命名。
- 增加 metadata 脱敏规则。

### STORY-11-02 业务操作审计

**User Story**：作为 Owner 或平台管理员，我希望关键配置变更可追溯，以便定位误操作。

**Acceptance Criteria**：

- 租户创建/停用写入审计。
- 员工禁用写入审计。
- 服务和价格修改写入审计。
- 硬件配置修改写入审计。

**Engineering Tasks**：

- 创建 audit helper。
- 在 API 层统一写入。
- 审计表记录 actor、tenant、branch、entity、before、after。

---

## EPIC-12 Phase 1 验收与质量门禁

**目标**：确保 Phase 1 进入验收前具备基本质量、可维护性和可交付性。

**Owner**：PM / QA / Tech Lead  
**Priority**：P0  
**Dependencies**：核心功能实现

### STORY-12-01 开发质量门禁

**User Story**：作为技术负责人，我希望每次交付前通过基本检查，以便减少低级问题进入主分支。

**Acceptance Criteria**：

- `pnpm --filter @cleanhub/web-admin typecheck` 通过。
- `pnpm --filter @cleanhub/web-admin lint` 通过。
- `pnpm --filter @cleanhub/web-admin build` 通过。
- 涉及 DB/API 时，对应 workspace typecheck/build 通过。

**Engineering Tasks**：

- 明确 PR checklist。
- 增加 CI 任务。
- 约定模块 owner review。

### STORY-12-02 Phase 1 验收准备

**User Story**：作为项目经理，我希望 Phase 1 有明确验收清单，以便客户和团队共同确认是否达标。

**Acceptance Criteria**：

- 验收场景来自 `Clean_Hub-Phase_1范围与验收标准.md`。
- 每个 P0 场景都有测试记录。
- 未完成项进入遗留问题清单。
- 阻塞问题不能进入正式上线。

**Engineering Tasks**：

- 拆分 UAT 测试用例。
- 建立缺陷等级规则。
- 建立上线前检查表。

---

## 6. 第一轮建议开发顺序

建议不要让所有人同时从业务页面开始写。第一轮应先把地基打通：

1. EPIC-01 Web Admin 基础框架与导航。
2. EPIC-10 API Client、错误处理与页面状态。
3. EPIC-02 认证、登录态与权限守卫。
4. EPIC-03 SaaS 租户管理。
5. EPIC-05 Tenant 门店与组织配置。
6. EPIC-06 Tenant 用户、角色与权限。
7. EPIC-07 服务目录与价格管理。
8. EPIC-11 审计日志与安全事件。
9. EPIC-08 硬件配置入口。
10. EPIC-09 基础报表入口。
11. EPIC-12 Phase 1 验收与质量门禁。

## 7. 建议并行分工

| 小组 | 负责范围 | 注意事项 |
| ---- | -------- | -------- |
| Frontend Foundation | App shell、页面状态、表单/table 基础组件 | 避免修改 `packages/ui/src/components/ui` |
| Auth / Security | 登录、token、route guard、RBAC | 必须与 API 和 DB schema 同步 |
| SaaS Admin | 租户管理、平台用户、平台审计 | 不要混入 Tenant 业务逻辑 |
| Tenant Admin | 门店、员工、服务、价格、硬件、报表 | 所有请求必须带 tenant context |
| Backend API | Auth API、SaaS API、Tenant API、Audit | API 是最终权限边界 |
| QA / PM | 验收用例、缺陷管理、UAT | 以 Phase 1 验收标准为准 |

## 8. 当前未决问题

| 问题 | 影响 | 建议 |
| ---- | ---- | ---- |
| API 框架尚未最终确定 | 影响路由和中间件实现 | 尽快确认使用 Fastify、Hono、Express 或其他方案 |
| branches/services/prices/hardware schema 尚未实现 | 阻塞 Tenant Admin 真实数据 | 先完成 Phase 1 最小 schema |
| 权限矩阵未单独成文 | 影响 RBAC 实现和测试 | 补充 `docs/01-product/permissions` 文档 |
| 页面清单和用户流程未单独成文 | 影响 UI/UX 和验收 | 补充页面清单与关键流程 |
| 支付和 POS 不在本 Backlog 详细展开 | Web Admin 报表数据依赖后续模块 | 支付、POS、离线应单独拆 Backlog |

## 9. Definition of Ready

一个 Story 进入 Sprint 前，至少需要满足：

- 业务目标清楚。
- 验收标准清楚。
- 依赖已识别。
- 设计或页面骨架已确认。
- API / DB 影响已确认。
- 不存在重大未决范围问题。

## 10. Definition of Done

一个 Story 完成时，至少需要满足：

- 功能实现完成。
- 验收标准全部通过。
- 权限和租户隔离规则通过检查。
- 敏感操作写入审计日志。
- Loading / Empty / Error / Permission Denied 状态处理完成。
- 相关 typecheck、lint、build 通过。
- 必要测试用例已补充或记录。
- 文档或 API 变更已同步。


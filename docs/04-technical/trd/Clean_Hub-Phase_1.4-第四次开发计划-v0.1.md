# CleanHub Phase 1.4 第四次开发计划 v0.3

| 版本 | 日期       | 状态  | 说明                                    |
| ---- | ---------- | ----- | --------------------------------------- |
| v0.1 | 2026-06-08 | Draft | POS 订单与客户闭环；支付与硬件 SDK 后置 |

前序波次见 `Clean_Hub-Phase_1.3-第三次开发计划-v0.1.md`。

---

## 1. 文档目的

本文档定义 Phase 1.4（第四次开发波次）的范围、分工与验收标准。在前三次波次（SaaS 平台、租户主数据、门店与 POS 壳层）基础上，交付 **门店营业最小闭环**：

Cashier 登录 POS → 搜索或新建客户 → 创建订单 → 计价 → 确认收件 → 查询与更新状态 → 取件交付。

开发重心在 `apps/pos-web` 与订单/客户 API；租户后台以订单查询、统计为主；SaaS 平台不在本波次改动范围内。

**本波次包含**：客户与订单、POS PIN 登录（Owner/Manager/Cashier）、POS 界面、状态流转、计价快照、审计、工作台/报表接入真实订单数据。

**本波次不包含**：支付、Wave/Orange Money、钱箱、打印 SDK、offline 生产同步、Mobile。（支付与硬件见 §20）

---

## 2. 参考文档

开发前应阅读：

```text
README.md
docs/01-product/phase-scope/Clean_Hub-Phase_1范围与验收标准.md
docs/01-product/prd/Clean_Hub-prd-v0.1.md
docs/04-technical/trd/Clean_Hub-Phase_1-Web_Admin基础模块-TRD-v0.1.md
docs/04-technical/trd/Clean_Hub-Phase_1.1-SaaS平台功能开发计划-v0.1.md
docs/04-technical/trd/Clean_Hub-Phase_1.2-租户后台功能开发计划-v0.1.md
docs/04-technical/trd/Clean_Hub-Phase_1.2-租户审计eventCategory命名表.md
docs/04-technical/trd/Clean_Hub-Phase_1.3-第三次开发计划-v0.1.md
docs/04-technical/api/Clean_Hub-API_Client使用说明.md
docs/04-technical/database/Clean_Hub-Drizzle数据库迁移操作详解.md
docs/04-technical/trd/Clean_Hub-Phase_1.2-PDF对齐-SaaS租户管理与账号边界补丁-v0.1.md  # §3.6 PIN 冻结口径
```

---

## 3. 项目背景

### 3.1 与前序波次关系

| 波次       | 文档       | 已完成（预期）                         | 本波次承接                |
| ---------- | ---------- | -------------------------------------- | ------------------------- |
| 第一次     | Phase 1.1  | SaaS 平台、`/saas/**`                  | 不扩展                    |
| 第二次     | Phase 1.2  | 租户主数据：员工、服务、价格、审计骨架 | 读取 services/prices 计价 |
| 第三次     | Phase 1.3  | 门店 CRUD、Manager 单店过滤、POS 壳层  | Cashier 登录、订单闭环    |
| **第四次** | **本文档** | —                                      | 客户 + 订单 + POS 主流程  |

### 3.2 终端与角色

```text
SaaS 平台（/saas）           → 本波次不改动
租户后台（/tenant）          → Owner / Manager：password 登录；订单查询、报表/工作台（次要）
POS（pos-web + desktop）     → Owner / Manager / Cashier：PIN 登录；下单、查单、改状态（主要）
Mobile                       → 本波次不做
```

**双凭证模型**（对齐 `Clean_Hub-Phase_1.2-PDF对齐-SaaS租户管理与账号边界补丁-v0.1.md` §3.2）：

| 凭证 | 入口 | 适用角色 |
| ---- | ---- | -------- |
| **password** | `/auth/login` → web-admin `/tenant` | Owner、Manager |
| **PIN** | `/pos/auth/login` → `pos-web` | Owner、Manager、Cashier |

| 角色            | Back Office（password） | POS（PIN）   | 本波次                                      |
| --------------- | ----------------------- | ------------ | ------------------------------------------- |
| **Owner**       | `/tenant` ✅ 主入口      | ✅ 可选顶班   | 报表/概览；可 PIN 登 POS 下单/查单           |
| **Manager**     | `/tenant` ✅ 主入口      | ✅ 可选顶班   | 绑定店报表/订单查询；可 PIN 登 POS           |
| **Cashier**     | **禁止** `/tenant`      | ✅ **主入口** | 日常收银全流程；**不得**进租户后台         |

Cashier **不得**访问 `/tenant/**`（`proxy.ts` 与 API 均拒绝）。Owner/Manager 订单后台查询走 `/tenant/orders`；**营业写操作**（建单、确认、状态流转）走 `/pos/**`（与 Cashier 共用 POS API，权限按角色区分，见 §8.1）。

### 3.3 仓库状态与待交付项

Day 1 阻塞项完成后，下表按「已完成 / 待交付」维护，避免重复开工。

| 项 | 状态（截至 v0.3） | 本波次剩余工作 |
| --- | --- | --- |
| `commerce.ts`（customers / orders / order_items） | ✅ Day 1 已定稿 | 字段变更仍走李龙杰 |
| `AdminRole` + `permission.helper` POS 守卫 | ✅ Day 1 已扩展 | `proxy.ts` Cashier 拦截（§8.4） |
| 审计命名表 `tenant_customer` / `tenant_order` | ✅ 已补充 | 实现侧按 §16 写入 |
| `tenant-customers` / `tenant-orders` 模块 | ❌ 待交付 | 武帅杰 / 赵付杰 Day 2 起 |
| `pos-auth` + `pos-web` 主流程 | ❌ 待交付 | 杨序 Day 1 起 |
| `proxy.ts` 拒绝 Cashier 进 `/tenant` | ❌ 待交付 | 李龙杰 Day 1–2（§14.1） |
| `GET /tenant/overview` 订单指标 | 硬编码 `0` | 赵付杰 接真实统计 |
| Cashier 验收账号 | 视 seed 而定 | Owner/Manager 在 `/tenant/users` 建 Cashier（现网 API 已支持 `cashier` 角色） |

---

## 4. 本次开发目标

### 4.1 P0 目标

1. **数据库**：新增 `customers`、`orders`、`order_items` 及必要索引；字段含 `tenant_id`、`branch_id`、ULID 主键、审计元数据。
2. **客户模块**（武帅杰）：租户范围内客户 CRUD、按手机/姓名搜索、同手机号候选列表。
3. **订单模块**（赵付杰）：创建草稿、添加行项目、自动计价、确认订单（生成订单号、状态 `received`）、列表/详情、状态流转、改价（权限 + 审计）。
4. **POS 认证**（杨序）：Pressing Code + PIN 登录（**Owner / Manager / Cashier**）；选店；会话写入 `branchId`；`device_id` 本地持久化（POS 端）。
5. **POS 收银 UI**（杨序）：登录 → 选店 → 搜索或新建客户 → 下单 → 确认 → 列表/详情/改状态；布局适配 **1280×800** 横屏。
6. **权限**：`assertPosContext` 允许 `owner` / `manager` / `cashier` 访问 `/pos/**`；Cashier **禁止** `/tenant/**`；Owner/Manager 订单后台查询经 `/tenant/orders`。
7. **路由挂载**：李龙杰 单点更新 `app.ts`、`packages/api-client` 聚合（§13）。
8. **审计**：客户与订单写操作写入 `audit_logs`（§17）。
9. **端到端**：SaaS 建租户 → Owner 配服务/价格/员工(Cashier) → Cashier POS 登录 → 建单 → Owner 工作台见今日订单数。

### 4.2 P1 目标

10. **租户订单页**（孙蕊蕊）：`/tenant/orders` 列表 + 详情；P1 在详情提供改价/取消（须 `reason`）；Owner/Manager 按 `branchScope` 过滤。
11. **`GET /tenant/reports/summary`**：今日订单数、待取/进行中数量接真实数据（营收可先为订单金额汇总，不含支付渠道）。概览卡片走 `GET /tenant/overview`。
12. **`apps/desktop`**：开发态加载 `pos-web` URL，不含硬件桥接。
13. **扫码查单**：POS 订单搜索框支持 HID 扫码枪键盘输入（不集成厂商 SDK）。
14. **租户后台 i18n**（赵付杰）：`/tenant` 业务页文案接入与 SaaS 侧一致的 i18n 体系（见 §10.1）。
15. **SaaS 安全页 UI 可见性统一**（孙蕊蕊）：`SecuritySettingsForm` / `SecurityPageView` 中用 `feature-visibility` 替代注释隐藏（见 §10.2）。
16. **SaaS 用户创建验证器**（孙蕊蕊）：`createSaasUserBodySchema.password` 最小长度与平台默认密码策略对齐（见 §10.3）。
17. **全平台 PIN 统一 6 位**（孙蕊蕊，§10.4）：API、表单、seed 对齐；杨序 `pos-auth` 引用同一套 domain 规则。

### 4.3 非目标

- 支付记录、Wave / Orange Money、钱箱、小票/标签打印。
- `packages/offline` 同步队列生产可用。
- 会员、积分、营销、库存、洗车完整流程。
- Tenant Admin 内下单（下单仅在 POS）。
- POS 端折扣/改价 UI（确认后改价走租户后台 P1）。
- 订单物理删除（本波次仅 `cancelled` + 权限控制）。
- `order_status_events` 独立表（用 `audit_logs` 即可）。

---

## 5. 本期不做内容

1. `payments` 表及 `/tenant/payments`、`/pos/payments` 路由。
2. `packages/hardware` 驱动、POS-T1101 SDK、ESC/POS 联调。
3. Z Report 完整日结（可保留入口，数据待支付波次补齐）。
4. 离线录单与服务端冲突合并。
5. 修改 `packages/ui/src/components/ui/**`（仍走 shadcn CLI）。
6. 业务 PR 自行 `db:generate` 新表；缺字段走李龙杰（初始）或指定补丁流程（§14.0）。

---

## 6. 团队成员

| 姓名       | 本波次分工原则                                               |
| ---------- | ------------------------------------------------------------ |
| **李龙杰** | Day 1：schema、`permission.helper`、`domain/pin` 骨架；Day 2：`proxy.ts` Cashier 拦截；**`app.ts` 与 api-client 单点挂载**；代码审核、验收统筹 |
| **武帅杰** | **独立模块** `tenant-customers` 全栈后端；不修改 orders、pos、auth 核心文件 |
| **杨序**   | **独立模块** `pos-auth` 后端 + **`apps/pos-web/**` 全部** + `apps/desktop` 开发加载 + `packages/api-client/src/pos/**`；不修改 tenant-orders、web-admin |
| **赵付杰** | **`tenant-orders` 后端**；`tenant-overview` / `tenant-reports` 接真实订单统计；**租户侧 i18n**（参考 SaaS）；`packages/api-client` tenant orders 导出 |
| **孙蕊蕊** | P1：订单查询页；安全页 feature-visibility；password 校验；PIN 6 位统一（§10.2–10.4） |
| **许婧姝** | 测试用例                                                     |

**协作约定**：

- 武帅杰、杨序各自负责独立模块目录，PR 不得交叉修改对方模块或 `app.ts`。
- 赵付杰 的订单模块自 Day 2 起依赖武帅杰 的客户 API，需先对齐 DTO；开发阶段可先 mock `customerId`。
- 杨序 的 POS 依赖订单与客户 API；可先完成登录与 mock 数据，Day 3 再切真实接口。

---

## 7. 技术栈与项目结构

与 Phase 1.3 一致。本波次新增/重点目录：

```text
packages/db/src/schema/
  commerce.ts              # 李龙杰 Day 1：customers, orders, order_items

apps/api/src/modules/
  tenant-customers/        # 武帅杰
  tenant-orders/           # 赵付杰
  pos-auth/                # 杨序（PIN 登录：owner/manager/cashier、选店会话）

apps/pos-web/src/
  app/                     # 杨序：login, branch-select, orders/*
  features/                # 杨序：pos 业务组件
  lib/api-client.ts        # 杨序：POS 侧薄适配

apps/web-admin/src/
  app/(tenant)/tenant/orders/   # 孙蕊蕊 P1
  features/tenant/orders/       # 孙蕊蕊 P1
  i18n/messages/tenant/         # 赵付杰 P1：en、zh-CN、types
  i18n/use-tenant-i18n.ts       # 赵付杰 P1
  config/feature-visibility.ts  # 孙蕊蕊 P1：扩展页面级可见性

packages/api-client/src/
  tenant/customers.ts      # 武帅杰（或李龙杰聚合导出）
  tenant/orders.ts           # 赵付杰
  pos/                       # 杨序：auth, orders, customers 调用封装
```

---

## 8. 权限与角色

### 8.1 路由与角色矩阵

| 模块 / 操作                    | Owner    | Manager       | Cashier               |
| ------------------------------ | -------- | ------------- | --------------------- |
| `/auth/login`（password）→ `/tenant` | ✅ | ✅ | ❌ |
| `/tenant/**` 写接口            | ✅        | ✅（见下表）   | ❌                     |
| `GET /tenant/orders`           | ✅ 全租户 | ✅ 绑定店      | ❌                     |
| `POST /pos/auth/login`（PIN）  | ✅        | ✅             | ✅                     |
| `POST /pos/orders`             | ✅        | ✅             | ✅                     |
| `PATCH /pos/orders/:id/status` | ✅        | ✅             | ✅（正向流转）         |
| 订单改价                       | ✅ P1（须审计） | ✅ P1（须审计） | ❌                     |
| 订单取消                       | ✅ P1          | ✅ P1          | ❌（Cashier 无取消权） |

> **租户后台不提供建单**：没有 `POST /tenant/orders`，建单统一走 `POST /pos/orders`。
>
> **改价 / 取消（P1）**：API 为 `PATCH /tenant/orders/:id/price` 与 `PATCH /tenant/orders/:id/status`（取消时 `status=cancelled`）。Owner 与 Manager 权限相同；请求体须带 `reason`（见 §9）；审计 eventType 为 `order.price_overridden`、`order.cancelled`。本波次不做 POS 改价页，顶班改价走租户后台订单详情（§14.5）或 API 手测。
>
> **Manager 写权限**：与 Phase 1.2 §8.1 一致——客户、员工、服务、价格、门店（在授权范围内）等主数据可写；**订单营业写操作**（建单、确认、正向状态）走 `/pos/**`，不在 `/tenant` 里下单。

| Manager 可写的 `/tenant` 模块（本波次相关） | 说明 |
| --- | --- |
| customers、users、services、prices、branches（授权店） | 沿用 1.2 |
| orders | **仅** P1 的改价/取消 PATCH；无建单 |

### 8.2 POS 上下文守卫（李龙杰 · Day 1）

新增 helper（`apps/api/src/modules/auth/permission.helper.ts` 或 `pos-context.helper.ts`）：

| 函数                                        | 行为                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `assertPosContext(authContext)`             | 要求 `role ∈ { owner, manager, cashier }` 且 `tenantId` 非空         |
| `requirePosBranchId(authContext, branchId)` | **Owner**：租户内任意门店；**Manager/Cashier**：`user_branches` 绑定店或会话 `branchIds` |
| `assertPosCatalogRead(authContext)`         | 上述 POS 角色可读 `/pos/catalog/services`（只读 services/prices）    |

### 8.3 门店数据范围

订单列表/详情/写入均须：

- `tenantId` 来自 `authContext`，禁止 body 覆盖。
- `branchId` 来自 POS 会话当前店：Owner 可选租户内任意店；Manager/Cashier 须在绑定店范围内。`/tenant/orders` 查询仍走既有 `branchScope`（1.3 已交付）。

### 8.4 路由守卫与会话（李龙杰 · Day 1–2）

Cashier 不能进租户后台，需要 **前端 + API 两层** 一起拦，不能只做一边。

**`apps/web-admin/src/proxy.ts`**

- `AdminRole` 扩展为含 `cashier`。
- 访问 `/tenant/**` 时：仅 `owner`、`manager` 放行；`cashier` 重定向到 POS 基址（环境变量 `NEXT_PUBLIC_POS_WEB_URL`，本地默认 `http://localhost:3001`）或返回 403。
- `cashier` 登录后默认落地页为 POS，**不得**落到 `/tenant`。

**`apps/api`**

- `/tenant/**` 继续用 `assertTenantContext`（已排除 `cashier`）。
- `/pos/**` 用 `assertPosContext`。

**Cookie 与双会话**

POS 与 web-admin **共用** 同一套 HttpOnly cookie 名（与现网 `/auth/login` 一致）。因此：

- Cashier 只应通过 `/pos/auth/login` 拿会话；即使手动打开 web-admin，也会被 `proxy.ts` 拦下。
- Owner/Manager **password 会话**与 **PIN 会话**互斥：后登录的会覆盖 cookie。顶班收银前如需保留后台会话，应使用不同浏览器/无痕窗口，或先登出再 PIN 登录。验收场景 E.3 按此口径执行。

---

## 9. 订单状态机

Phase 1 产品范围（`Clean_Hub-Phase_1范围与验收标准.md` §3.7）：

```text
draft → received → in_progress → ready → delivered
                  ↘ cancelled（须权限 + 原因 + 审计）
```

| 状态          | 说明           | 典型触发      |
| ------------- | -------------- | ------------- |
| `draft`       | 编辑中，未确认 | 创建订单      |
| `received`    | 已收件，待生产 | POS 确认订单  |
| `in_progress` | 处理中         | 店员更新      |
| `ready`       | 待取           | 生产完成      |
| `delivered`   | 已交付         | 取件确认      |
| `cancelled`   | 已取消         | Manager/Owner |

**本波次支付字段**：订单可增加 `payment_status = unpaid` 占位，默认 `unpaid`；不接支付模块。

**状态变更规则**：

- Owner / Manager / Cashier 在 POS 均可：`draft→received`，以及 `received → in_progress → ready → delivered` 正向流转（不允许跳步）。
- 改价、取消仅 Owner/Manager，走 `PATCH /tenant/orders/:id/*`（P1）；Cashier 在 POS 与租户后台均不可操作。
- 每次状态变更写 `audit_logs`，eventType 为 `order.status_changed`（取消用 `order.cancelled`）。

**敏感操作须带原因**（对齐 Phase 1 §3.6 / §3.7 / 场景 11）：

| 操作 | API | 请求体 | 审计 |
| --- | --- | --- | --- |
| 改价 | `PATCH /tenant/orders/:id/price` | `reason` 必填（1–500 字）；金额字段见 §12.2 | `order.price_overridden`，`reason` 写入 `audit_logs.reason` |
| 取消 | `PATCH /tenant/orders/:id/status` | `status: "cancelled"` + `reason` 必填 | `order.cancelled` |
| 正向改状态（POS） | `PATCH /pos/orders/:id/status` | `status` 必填；`reason` 本波次可选 | `order.status_changed` |

**折扣与下单时改价（本波次范围）**：

- **P0**：POS 下单按服务价格自动计价；`orders.discount_amount` 默认 `0`，不在 POS 做折扣 UI。
- **P1**：确认后改价走 `PATCH .../price`（可调 `total_amount` / `discount_amount` / 行级金额，赵付杰与杨序对齐 DTO）。
- Phase 1 产品里的「下单时手动改价/折扣」完整体验，本波次不单独做 POS 入口；若验收需要，用租户后台 P1 改价 API 覆盖。

**`order_status_events` 表**：本波次 **不建**，状态历史以 `audit_logs` + 订单当前 `status` 为准。

---

## 10. P1 配套任务

以下任务与 P0 主路径并行。其中 **PIN 6 位规则**建议李龙杰 Day 1 先在 `packages/domain` 落骨架（`PIN_DIGIT_PATTERN`），杨序 `pos-auth` 直接引用；孙蕊蕊 D4 再统一 API 表单与 seed，避免两套正则。

### 10.1 租户后台 i18n（赵付杰）

SaaS 侧已实现 `useSaasI18n` 与 `messages/saas/*`；租户侧 `features/tenant/**` 仍有较多硬编码英文，本波次需补齐。

**工作项**（结构参照 SaaS 侧现有实现）：

- 新建 `i18n/messages/tenant/{en,zh-CN,types}.ts`，按模块划分文案（overview、branches、users、services、prices、settings、logs、hardware、notifications、backups、reports、orders）
- 新建 `useTenantI18n()`，在 `locale-provider` 挂载 `messages.tenant`
- 扩展 `WebAdminMessages`，迁移 `features/tenant/**` 页面文案

**范围**：仅 `/tenant` 与 `features/tenant/**`；不修改 `pos-web` 及已有 SaaS 文案。法语 locale 若尚未启用，本波次先完成 en、zh-CN。

**验收**：切换语言后，主要租户页面（含订单查询页）无硬编码英文；`pnpm --filter @cleanhub/web-admin typecheck` 通过。

### 10.2 SaaS 安全页 UI 可见性（孙蕊蕊）

侧栏已用 `feature-visibility` 控制入口，但安全页仍通过注释隐藏「刷新令牌天数」「安全事件列表」等区块，需改为配置驱动。

1. 在 `feature-visibility.ts` 增加页面级开关：`saasSecurityRefreshTokenDays`、`saasSecurityEventList`（默认 `false`）
2. `SecuritySettingsForm`、`SecurityPageView` 按开关条件渲染，移除注释块
3. 隐藏刷新令牌输入框时，提交仍携带服务端当前的 `refreshTokenDays`（与现有行为一致）
4. 在配置文件头部补充各开关用途说明

**验收**：开关关闭时页面正常、无控制台报错；开启后对应区块可用。不修改 `packages/ui/src/components/ui/**`。

### 10.3 SaaS 用户 password 校验（孙蕊蕊）

`createSaasUserBodySchema.password` 当前为 `min(1)`，校验过宽。服务层虽有 `assertPasswordMeetsPolicy`，请求体应在 Zod 层提前拒绝明显不符合长度的密码。

- 将 `min(1)` 调整为与 `security-policy.ts` 默认值 `passwordMinLength: 8` 一致（建议从 domain 或共享常量引用，避免 magic number）
- 检查同模块及其他建用户入口是否存在相同写法
- 手测：7 位密码在到达 service 层前应返回 422

Zod 负责拦截明显过短；动态策略校验仍由 service 层处理。

### 10.4 全平台 PIN 统一为 6 位（孙蕊蕊）

**规则依据**：PDF 对齐补丁 §3.6 — 全平台 PIN 为恰好 6 位数字（`/^\d{6}$/`），取代 Phase 1.2 文档中的「4～6 位」表述。

Changelog PDF 中的 4 位 PIN 指锁屏、换班等场景；本波次 Cashier 使用 Pressing Code + PIN 登录，仍写入 `users.pin_hash`，格式统一为 6 位。PR 说明中注明与 PDF 原文的差异即可。

**分工**：李龙杰 Day 1 提交 `packages/domain/src/pin.ts` 骨架；杨序 `pos-auth` 直接引用；孙蕊蕊 D4 统一 API 表单、seed 与其余 `^\d{4,6}$` 扫尾，不单独再定义正则。

**产品规则**

| 项         | 说明                                                         |
| ---------- | ------------------------------------------------------------ |
| 格式       | 6 位数字，允许前导零（如 `000123`）                          |
| 存储       | 仅写入 `pin_hash`（`hashPin`）；明文不得进入数据库、审计或 API 响应 |
| 适用范围   | SaaS 开户 Owner PIN、租户建员工 `initialPin`、seed、系统生成的重置 PIN |
| 不在本任务 | 修改哈希算法；reset-pin 仍由系统随机生成 6 位（不支持管理员手填 PIN） |

**共享规则**（`packages/domain/src/pin.ts`，由 `index.ts` 导出）

```typescript
export const PIN_DIGIT_LENGTH = 6 as const;
export const PIN_DIGIT_PATTERN = /^\d{6}$/;

export function validatePinDigits(pin: string): string | null {
  return PIN_DIGIT_PATTERN.test(pin) ? null : "PIN must be exactly 6 digits.";
}
```

`@cleanhub/domain` 保持零依赖，供 API 与 web-admin 共用。API 侧示例：`z.string().regex(PIN_DIGIT_PATTERN, "...")`。

**待对齐文件**

| 位置                                           | 现状                                  | 目标                                         |
| ---------------------------------------------- | ------------------------------------- | -------------------------------------------- |
| `saas-tenants/tenants.validation.ts`           | 允许 4–6 位                           | 6 位，引用 domain                            |
| `tenant-users/tenant-users.validation.ts`      | 已为 6 位                             | 改为引用 domain                              |
| `users/users.validation.ts`（遗留）            | 已为 6 位                             | 同上                                         |
| `tenant-form.validator.ts` / `tenant-form.tsx` | Owner PIN 允许 4–6 位，输入无长度限制 | 6 位；`maxLength={6}`、`inputMode="numeric"` |
| `tenant-user-list-view.tsx`                    | 文案已写 6 位，缺少提交前校验         | 增加 `validatePinDigits`                     |
| `0001_seed_development_accounts.sql`           | 注释 PIN 为 `1234`                    | 改为 `123456`，重算 `pin_hash`               |

seed 更新：使用 `hashPin('123456')` 生成 hash，替换 SQL 中各账号的 `pin_hash`（当前各行 hash 相同，替换一处即可）。

**校验链路**

```text
表单输入限制 → web-admin validatePinDigits → API Zod → hashPin → pin_hash
响应与审计均不得包含 PIN 明文
```

**孙蕊蕊负责范围**（domain 骨架除外）：上述 validation 文件、SaaS/租户 PIN 相关表单、`messages/saas` 中 Owner PIN 文案、seed SQL。

**不在孙蕊蕊范围内**：`tenant-users.service`（重置逻辑已为 6 位）、`auth.service`、`pos-auth/**`（杨序）、`hashPin` 实现。

**验收**

- `123456` 可用于开户与建员工；`1234`、`12345`、`abc123` 在 API 层返回 422
- 表单在提交请求前应提示格式错误
- `reset-pin` 返回的临时 PIN 为 6 位
- seed 注释与数据库 hash 一致
- 相关 workspace typecheck 通过；PIN 相关代码不再使用 `^\d{4,6}$`（`pos-auth` 由杨序合入时一并检查）

---

## 11. 数据模型（李龙杰 · Day 1 初始 schema）

> 文件建议：`packages/db/src/schema/commerce.ts`，由 `schema/index.ts` 导出。  
> 模块负责人 **不得** 自行 `db:generate`；字段变更先与李龙杰确认。

### 11.1 `customers`

| 字段                        | 类型           | 说明               |
| --------------------------- | -------------- | ------------------ |
| `id`                        | varchar(26) PK | ULID               |
| `tenant_id`                 | varchar(26) FK | 租户隔离           |
| `full_name`                 | varchar(200)   | 姓名               |
| `phone`                     | varchar(32)    | 手机号，租户内索引 |
| `address`                   | text           | 可选               |
| `notes`                     | text           | 备注               |
| `created_at` / `updated_at` | timestamptz    | 审计               |
| `created_by` / `updated_by` | varchar(26)    | 操作人             |
| `deleted_at`                | timestamptz    | 软删除             |

索引：`(tenant_id, phone)`、`tenant_id + deleted_at`。

### 11.2 `orders`

| 字段                                                   | 类型           | 说明                                                |
| ------------------------------------------------------ | -------------- | --------------------------------------------------- |
| `id`                                                   | varchar(26) PK | ULID                                                |
| `tenant_id` / `branch_id`                              | FK             | 隔离与门店归属                                      |
| `customer_id`                                          | FK             | 客户                                                |
| `order_number`                                         | varchar(32)    | 确认后生成的展示号，租户内唯一                      |
| `status`                                               | enum           | §9 状态机                                           |
| `payment_status`                                       | enum           | 本波次固定 `unpaid`                                 |
| `subtotal_amount` / `discount_amount` / `total_amount` | numeric        | 金额                                                |
| `currency`                                             | varchar(3)     | 默认门店/租户货币                                   |
| `pickup_date`                                          | date           | 取件日期                                            |
| `notes`                                                | text           | 订单备注                                            |
| `confirmed_at`                                         | timestamptz    | 确认时间                                            |
| `created_by`                                           | FK users       | 收银员                                              |
| `device_id`                                            | varchar(64)    | POS 终端标识，可选                                  |
| 标准审计字段                                           |                | `created_at`、`updated_at`、`version`、`deleted_at` |

### 11.3 `order_items`

| 字段                               | 类型        | 说明              |
| ---------------------------------- | ----------- | ----------------- |
| `id`                               | PK ULID     |                   |
| `order_id` / `tenant_id`           | FK          |                   |
| `service_id`                       | FK services | 服务引用          |
| `service_name`                     | varchar     | **快照**          |
| `pricing_unit`                     | enum        | per_item / per_kg |
| `unit_price`                       | numeric     | **快照**          |
| `quantity`                         | numeric     | 件数或公斤        |
| `line_amount`                      | numeric     | 行小计            |
| `color` / `notes` / `defect_notes` | text        | 衣物明细          |
| `sort_order`                       | integer     | 行序              |

**计价规则**：创建/更新行项目时读取当前 `prices`；**确认订单**时将价格写入行快照；已确认订单不随后台改价变化。

---

## 12. API 接口清单

### 12.1 POS 路由（Owner/Manager/Cashier · 杨序挂载请求 / 李龙杰注册）

前缀建议：`/pos`（与 `/tenant` 分离，便于守卫）。

| 方法  | 路径                      | 说明                                       | 负责人                         |
| ----- | ------------------------- | ------------------------------------------ | ------------------------------ |
| POST  | `/pos/auth/login`         | Pressing Code + PIN；返回 session / cookie | 杨序                           |
| POST  | `/pos/auth/select-branch` | 多店用户选当前店（Owner 全店 / 他角色绑定店） | 杨序                           |
| GET   | `/pos/auth/me`            | 当前 POS 会话上下文                        | 杨序                           |
| POST  | `/pos/auth/logout`        | 登出                                       | 杨序                           |
| GET   | `/pos/catalog/services`   | 只读服务+价格（下单用）                    | 业务：赵付杰；路由：`pos-catalog.routes.ts` 薄转发（杨序） |
| GET   | `/pos/customers`          | 搜索客户                                   | 武帅杰 service；杨序 `pos-customers.routes.ts` 转发 |
| POST  | `/pos/customers`          | 快速新建客户                               | 同上；守卫 `assertPosContext` |
| POST  | `/pos/orders`             | 创建草稿订单                               | 赵付杰                         |
| POST  | `/pos/orders/:id/items`   | 新增行项目                                 | 赵付杰                         |
| PATCH | `/pos/orders/:id/items/:itemId` | 更新行（数量、备注等，仅 `draft`）   | 赵付杰                         |
| DELETE | `/pos/orders/:id/items/:itemId` | 删除行（仅 `draft`）              | 赵付杰                         |
| POST  | `/pos/orders/:id/confirm` | 确认 → received + order_number             | 赵付杰                         |
| PATCH | `/pos/orders/:id/status`  | 状态流转                                   | 赵付杰                         |
| GET   | `/pos/orders`             | 列表（本店、日期、状态筛选）               | 赵付杰                         |
| GET   | `/pos/orders/:id`         | 详情                                       | 赵付杰                         |
| GET   | `/pos/orders/lookup`      | 按 order_number / 扫码值查询               | 赵付杰                         |

**实现方式**：`/pos/orders` 可在 `tenant-orders` 模块内复用 service 层，由 `pos-orders.routes.ts` 导出单独 factory；或由赵付杰 提供共享 service，杨序 仅写 `pos-auth` 与 POS 薄路由。**禁止** 杨序 修改 `tenant-orders` 业务逻辑文件。

### 12.2 租户路由（Owner / Manager）

| 方法  | 路径                        | 说明                | 负责人    |
| ----- | --------------------------- | ------------------- | --------- |
| GET   | `/tenant/customers`         | 列表/搜索           | 武帅杰    |
| POST  | `/tenant/customers`         | 创建                | 武帅杰    |
| GET   | `/tenant/customers/:id`     | 详情 + 历史订单摘要 | 武帅杰    |
| PATCH | `/tenant/customers/:id`     | 更新                | 武帅杰    |
| GET   | `/tenant/orders`            | 列表（branchScope） | 赵付杰    |
| GET   | `/tenant/orders/:id`        | 详情                | 赵付杰    |
| PATCH | `/tenant/orders/:id/status` | Owner/Manager 取消或后台改状态（P1） | 赵付杰 P1 |
| PATCH | `/tenant/orders/:id/price`  | Owner/Manager 改价（P1）            | 赵付杰 P1 |

**P1 PATCH 请求体约定**（赵付杰 实现，写入 validation）：

```typescript
// PATCH /tenant/orders/:id/status — 取消
{ status: "cancelled"; reason: string }  // reason 必填

// PATCH /tenant/orders/:id/price — 改价（字段以实现为准，至少含 reason）
{ reason: string; totalAmount?: string; discountAmount?: string; items?: ... }
```

正向状态流转以 POS `PATCH /pos/orders/:id/status` 为主；租户后台除取消外，本波次可不单独做「改状态」UI。

### 12.3 概览与报表（赵付杰）

| 方法 | 路径                      | 变更                                                         |
| ---- | ------------------------- | ------------------------------------------------------------ |
| GET  | `/tenant/overview`        | `todayOrderCount`、`pendingPickupCount`、`inProgressOrderCount` 接 `orders` 聚合 |
| GET  | `/tenant/reports/summary` | 按日订单数、订单金额汇总（不含支付渠道）                     |

### 12.4 `app.ts` 挂载计划（李龙杰）

| 批次        | 时间       | 内容                                                         |
| ----------- | ---------- | ------------------------------------------------------------ |
| **Batch A** | Day 1 下午 | 无（仅 schema + helper）                                     |
| **Batch B** | Day 2      | `/tenant/customers`（武帅杰模块合并后）                      |
| **Batch C** | Day 3      | `/tenant/orders` + `/pos/auth` + `/pos/orders` + `/pos/catalog` + `/pos/customers` |

业务 PR **不得** 修改 `apps/api/src/app.ts`。合并后由模块负责人做 curl/前端联调验证。

---

## 13. 文件所有权规划

| 负责人     | 后端                                                         | 前端                                                      | api-client                           |
| ---------- | ------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------ |
| **李龙杰** | `schema/commerce.ts`；`permission.helper`；**`proxy.ts` Cashier 拦截**；**`app.ts`**；**`packages/api-client` 聚合**；Day 1 可落 `packages/domain/pin.ts` 骨架 | — | 审核导出 |
| **武帅杰** | **`tenant-customers/**`**                                    | —                                                         | **`tenant/customers.ts`**            |
| **杨序**   | **`pos-auth/**`**；`/pos/*` 路由文件（薄层，调 orders/customers service） | **`apps/pos-web/**`**；**`apps/desktop/**`**              | **`packages/api-client/src/pos/**`** |
| **赵付杰** | **`tenant-orders/**`**；`tenant-overview`；`tenant-reports`  | **`features/tenant/**` i18n（§10.1）**；overview 数据对接 | **`tenant/orders.ts`**               |
| **孙蕊蕊** | validation、seed；`saas-users.validation`（PIN 规则引用 domain） | 订单查询页 + P1 改价/取消入口；security 可见性；PIN 表单 | — |
| **许婧姝** | —                                                            | —                                                         | 测试与验收文档                       |

**隔离约束（武帅杰 / 杨序）**：

1. 武帅杰 **仅** 修改 `packages/db`（经李龙杰 PR）、`tenant-customers/**`、`api-client/tenant/customers.ts`。
2. 杨序 **仅** 修改 `pos-auth/**`、`apps/pos-web/**`、`apps/desktop/**`、`api-client/src/pos/**`；POS 路由文件若需注册 orders，只写 `pos/*.routes.ts` 转发至赵付杰 service，**不编辑** `tenant-orders/*.service.ts`。
3. 二人 PR 均 **不得** 包含 `app.ts`、`web-admin`、`tenant-orders`、`tenant-customers` 交叉目录。
4. 集成问题由李龙杰 协调接口契约会议（Day 1 晚或 Day 2 上午），书面确认 DTO。

---

## 14. 个人详细任务

### 14.0 数据库变更流程

- **Day 1 初始表**：李龙杰 提交 `commerce.ts` + migration，合并后全员 `pnpm db:migrate`。

### 14.1 李龙杰

**Day 1（阻塞）**

1. 定稿 §11 schema，执行 `db:generate`、`db:migrate`。
2. 扩展 API 侧 `AdminRole` 与 `assertPosContext`、`requirePosBranchId`（Owner 全店、他角色绑定店）。
3. 审计命名表补充 `tenant_customer`、`tenant_order`（§16）。
4. **`packages/domain/src/pin.ts` 骨架**（`PIN_DIGIT_LENGTH`、`PIN_DIGIT_PATTERN`），供杨序 `pos-auth` 与后续孙蕊蕊统一引用。
5. `pnpm --filter @cleanhub/db typecheck`、`pnpm --filter @cleanhub/api typecheck`。

**Day 2–5**

6. **`apps/web-admin/src/proxy.ts`**：Cashier 禁止 `/tenant/**`，默认跳转 POS（§8.4）。
7. 按 §12.4 挂载 Batch B/C。
8. 维护 `packages/api-client/src/tenant/index.ts`、`pos/index.ts` 导出。
9. Code review、验收脚本、Phase 1 场景 1/2/7/8/11 组织（不含支付/打印）。

### 14.2 武帅杰 — `tenant-customers`（独立模块）

**范围**：`apps/api/src/modules/tenant-customers/**` + `packages/api-client/src/tenant/customers.ts`。

**Day 2**

1. `GET/POST /tenant/customers`、`GET/PATCH /tenant/customers/:id`。
2. 搜索：手机号精确/前缀、姓名模糊；同手机号返回候选列表（Phase 1 §3.4）。
3. 租户隔离、`assertTenantContext` 或 POS 读接口复用 service。
4. 审计：`tenant_customer` / `customer.created|updated`（§17）。
5. 单元测试或 API 手测清单提交 PR；**不含** `app.ts`（李龙杰 Batch B 挂载）。

**Day 3**

6. 详情页返回 `recentOrders` 摘要（只读 join `orders`，赵付杰 提供 repository 方法或武帅杰 只读查询，事先对齐 SQL 边界）。
7. 配合赵付杰 / 杨序 联调客户搜索与创建。

**交付标准**：Owner 在租户侧可 CRUD 客户；POS 可通过 API 搜索/创建客户；模块 PR 不触碰 orders、pos-web。

### 14.3 杨序 — `pos-auth` + `pos-web` + `desktop`（独立模块）

**范围**：`apps/api/src/modules/pos-auth/**`、`apps/pos-web/**`、`apps/desktop/**`、`packages/api-client/src/pos/**`、POS 侧 `pos/*.routes.ts`（薄转发）。

**Day 1–2**

1. **`pos-auth`**：`POST /pos/auth/login`（Pressing Code + PIN）；`pin` 校验引用 `@cleanhub/domain`（李龙杰 Day 1 骨架）；角色 **`owner` / `manager` / `cashier`**；Manager/Cashier 校验 `user_branches`，Owner 可选全租户门店。
2. `select-branch`、`/pos/auth/me`、`logout`；Cookie 与 web-admin **同名** HttpOnly（§8.4）；登录成功跳转 `pos-web`，不写 `/tenant`。
3. **`pos-web` 壳层**：1280×800 Layout、顶栏（店名、收银员、登出）、主导航（新单、订单列表、设置占位）。
4. **`device_id`**：`localStorage` 生成 ULID 并持久化，创建订单时带给 API。
5. 登录页 + 选店页 UI；`apps/desktop` 开发模式加载 `pos-web` dev URL。

**Day 3–4**

6. 客户搜索/新建页（调武帅杰 API）。
7. 下单向导：选服务（catalog）、行项目、计价展示、确认订单。
8. 订单列表/详情、状态按钮（Received → In Progress → Ready → Delivered）。
9. 扫码查单：搜索框 autofocus，接受 HID 输入。

**Day 5**

10. 与赵付杰 订单 API 全链路联调；修复 POS 侧问题；**不修改** `tenant-orders` 内部实现。

**交付标准**：Cashier 可独立完成 §17.1 场景 A–E；Owner/Manager 可用 PIN 登 POS 顶班收银（P1 手测即可）；PR 仅限 pos 相关目录。

### 14.4 赵付杰 — `tenant-orders` + 概览/报表 + 租户 i18n

**范围**：

- 后端：`apps/api/src/modules/tenant-orders/**`、`tenant-overview`/`tenant-reports` 统计逻辑
- 前端 i18n：`apps/web-admin/src/i18n/messages/tenant/**`、`use-tenant-i18n.ts`、`features/tenant/**` 文案迁移
- api-client：`packages/api-client/src/tenant/orders.ts`

**Day 2–5（订单，P0）**

1. Orders service：创建 draft、行项目增删改（§12.1，仅 `draft`）、计价（读 `services`/`prices`）、confirm 生成 `order_number`。
2. `GET /tenant/orders`、`GET /tenant/orders/:id`（branchScope）。
3. POS 订单路由所需 service；状态机校验 §9。
4. P1：`PATCH .../price`、`PATCH .../status`（取消），**`reason` 必填**，审计见 §9。
5. `GET /pos/catalog/services` 只读封装（或提供 service 供杨序转发）。
6. 更新 `getTenantOverview` 聚合；`GET /tenant/reports/summary` 接订单表。
7. 与杨序 POS、武帅杰 客户 API 联调。

**Day 4–5（i18n，P1，可与订单并行）**

8. 按 §10.1 完成 `messages/tenant` 结构与 `useTenantI18n`。
9. 优先迁移：**overview、branches、users、services、prices、settings**（与日常联调页面一致）。
10. 为孙蕊蕊订单页提供 `messages/tenant.orders` 文案键（含改价/取消相关 copy）。

**i18n 约束**：参照 SaaS 模块命名与文件分层；**不修改** `messages/saas/**`、**不修改** `features/saas/**`（孙蕊蕊 负责 security 页见 §14.5）。

### 14.5 孙蕊蕊（P1）

任务细节见 §10.2–10.4，建议按以下顺序推进：

1. **订单页（P1）**：`/tenant/orders` 列表 + 详情；Owner/Manager 在详情页提供 **改价、取消** 入口（弹窗填 `reason`，调 §12.2 PATCH）。列表与只读字段用 `useTenantI18n`（依赖赵付杰 §10.1）。
2. **安全页可见性**：`feature-visibility` 替代注释隐藏（§10.2）。
3. **password 校验**：`createSaasUserBodySchema.password` 最小长度 8（§10.3）。
4. **PIN 6 位统一**：D4 对齐 API 表单与 seed（§10.4）；`pos-auth` 已在 Day 1 引用 domain 骨架，此处做全仓扫尾。

**负责范围**：`feature-visibility.ts`、`features/tenant/orders/**`（含 P1 改价/取消 UI）、`features/saas/security/**`、`features/saas/tenants/**`（PIN 相关）、`features/tenant/users/**`（PIN 表单）、相关 validation、seed、`messages/saas`（Owner PIN 文案）。

**禁止修改**：`features/tenant/**` 其余 i18n（赵付杰）、`tenant-orders`、`pos-auth/**`、`hashPin` 实现。

### 14.6 许婧姝

1. P0：客户、订单、POS PIN（Cashier 主路径）、状态流转、**Cashier 访问 `/tenant` 被拦**（proxy + API）。
2. P1：订单详情改价/取消（含 `reason` + 审计）、语言切换、password 422、security 开关、PIN 6 位。
3. 对照 Phase 1 §6.3 场景 1、2、3、7、8、**11**（权限与敏感操作原因）。

---

## 15. 排期建议（5 个工作日）

| 日   | 李龙杰                   | 武帅杰                 | 杨序                              | 赵付杰                          |
| ---- | ------------------------ | ---------------------- | --------------------------------- | ------------------------------- |
| D1   | schema + POS 权限 helper | 阅读契约、客户模块骨架 | pos-auth 开发、pos-web Layout     | 订单 module 骨架、计价算法草案  |
| D2   | Batch B 挂载 customers   | 客户 API 完成          | 登录/选店 UI、desktop 加载        | 订单 CRUD service               |
| D3   | Batch C 挂载 pos+orders  | 客户联调、recentOrders | 下单 UI（由 mock 切换至真实 API） | POS 订单路由、overview 统计     |
| D4   | review                   | 联调缓冲               | 列表/状态/扫码                    | 报表、改价 P1；tenant i18n 结构 |
| D5   | 验收                     | 联调缓冲               | 全链路                            | 全链路；i18n 迁移收尾           |

**并行（D4–D5）**：孙蕊蕊 — 订单页（含改价/取消）、PIN 表单与 seed 扫尾、security 可见性、password 校验；许婧姝 — D3 起编写用例，D5 验收。

---

## 16. 审计 eventCategory 扩展

在 `Clean_Hub-Phase_1.2-租户审计eventCategory命名表.md` 基础上新增：

| eventCategory     | 模块 | eventType 示例                                               |
| ----------------- | ---- | ------------------------------------------------------------ |
| `tenant_customer` | 客户 | `customer.created`、`customer.updated`                       |
| `tenant_order`    | 订单 | `order.created`、`order.confirmed`、`order.status_changed`、`order.price_overridden`、`order.cancelled` |

写入约定与 1.2 一致：`tenantId`/`branchId` 来自 `authContext`；禁止记录 PIN 明文。

---

## 17. 验收标准

### 17.1 P0 必须通过

**场景 A — 新客户下单（Phase 1 §6.3 场景 1，无支付）**

1. Cashier POS 登录并选店。
2. 新建客户（姓名、手机）。
3. 新建订单，添加 3 个按件服务行，录入颜色/备注/取件日。
4. 确认订单。

通过：订单号生成；状态 `received`；金额正确；`tenant_id`/`branch_id`/操作人正确；Owner 工作台 `todayOrderCount ≥ 1`。

**场景 B — 老客户下单（场景 2）**

1. 手机号搜索客户，展示候选。
2. 创建新订单并关联该客户。

**场景 C — 按公斤下单（场景 3）**

1. 选择 per_kg 服务，输入重量，计价正确。

**场景 D — 状态流转（Phase 1 场景 7、8 子集）**

1. 搜索/扫码打开订单。
2. `received → in_progress → ready → delivered`。

**场景 E — 权限**

1. Cashier 访问 `/tenant` 返回 403 或重定向。
2. Cashier 在 POS 不能改价、不能取消。
3. Owner/Manager 用 password 可进 `/tenant`；PIN 与 password 会话互斥规则见 §8.4。

### 17.2 P1

- Owner/Manager PIN 登录 POS，完成选店并建单、确认（顶班收银）。
- Manager 在 `/tenant/orders` 查看本店订单；Owner 可看全租户。
- Owner 或 Manager 在订单详情执行 **改价、取消**，填写 `reason`，审计可查。
- `GET /tenant/reports/summary` 返回真实订单计数。
- 租户后台切换 en / zh-CN 后，已迁移页面无硬编码英文（§10.1）。
- `feature-visibility` 控制安全页区块显示，无注释块隐藏逻辑（§10.2）。
- 创建 SaaS 用户时 password 少于 8 位返回 422（§10.3）。
- PIN 全平台 6 位：开户/建员工、`1234` 被拒、seed 为 `123456`（§10.4）。

### 17.3 不在本波次验收

- 现金/Wave/Orange 支付、钱箱、小票/标签打印、Z Report 支付分项、离线同步。

---

## 18. 风险与依赖

| 风险                   | 影响                | 缓解                                                     |
| ---------------------- | ------------------- | -------------------------------------------------------- |
| 客户/订单 API 契约延迟 | POS 界面无法联调    | Day 1 晚对齐 DTO；杨序 阶段内使用 mock                   |
| 多人改 `app.ts`        | 合并冲突            | 仅李龙杰 修改；Batch 挂载                                |
| 计价与价格快照不一致   | 财务纠纷            | 确认订单时写快照；单测覆盖                               |
| Cashier 验收账号缺失   | 无法验 POS          | Owner/Manager 在 `/tenant/users` 建 Cashier；§10.4 更新 seed `pin_hash` |
| `proxy.ts` 未拦 Cashier | Cashier 误入后台 | 李龙杰 Day 2 必交付 §8.4 |
| 改价仅有 API 无 UI     | 场景 11 难验收      | 孙蕊蕊 订单详情 P1 入口（§14.5） |
| 武帅杰/杨序 目录互侵   | 进度互相阻塞        | §13 隔离约束 + review 拒绝交叉文件                       |
| 租户 i18n 未就绪       | 孙蕊蕊 订单页硬编码 | 赵付杰 D4 先交付 `useTenantI18n` 骨架与 orders 模块 copy |

---

## 19. api-client 分层

```text
pos-web 页面
  → apps/pos-web/src/lib/api-client.ts
  → packages/api-client/src/pos/*
  → apps/api /pos/**

web-admin 租户订单页
  → apps/web-admin/src/lib/api-client.ts
  → packages/api-client/src/tenant/orders.ts、customers.ts
  → apps/api /tenant/**
```

POS 与 Tenant 导出 **分目录**，避免 `pos-web` 引用 tenant 后台专用方法。

---

## 20. 后续波次预告（非本文档范围）

**Phase 1.4b / 第五次建议**：

- `payments` 表；现金记录；Wave/Orange **待确认**流程；钱箱触发。
- `packages/hardware` PoC；POS-T1101 / OCPP 小票；标签机 OCBP-M810。
- `packages/offline` 队列 PoC。
- Z Report 与支付渠道汇总。

依赖本波次订单与客户数据稳定后再开。


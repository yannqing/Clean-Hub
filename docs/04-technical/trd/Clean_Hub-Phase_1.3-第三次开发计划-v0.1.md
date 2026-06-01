# CleanHub Phase 1.3 第三次开发计划 v0.1

| 版本 | 日期 | 状态 | 说明 |
| ---- | ---- | ---- | ---- |
| v0.1 | 2026-05-31 | Draft | 门店管理闭环、店长单店权限、租户 API 收口、POS 平板壳层与终端架构说明 |
| v0.2 | 2026-06-01 | Draft | 任务整合 |

---

## 1. 文档目的

本文档用于指导 CleanHub **第三次开发波次（Phase 1.3 第一周）**，在 Phase 1.1（SaaS 平台）、Phase 1.2（租户后台主数据）基础上，完成以下目标：

- 明确**无独立「门店管理平台」**的产品与技术边界：店长能力在**租户后台**（`/tenant`）实现。
- 交付**门店（branches）全栈 CRUD** 与审计，对齐构设文档 Multi-branch 与 Branch Manager 单店范围。
- 实现 **Manager 按授权门店过滤**（`user_branches`），从 Phase 1.2「全租户可见」根据权限进行可见适配。
- **收口** Phase 1.2 租户模块联调缺口（**杨序**）；**`apps/api/src/app.ts` 与 `packages/api-client/src/tenant/index.ts` 由李龙杰单点整合**（§11.3）。
- 交付 **POS 平板壳层**（对标 **POS-T1101 · 1280×800**，非完整收银）与 **终端架构说明**（含参考硬件映射），为第四次开发（POS 订单闭环 + 硬件 PoC）铺路。

---

## 2. 参考文档

开发前应阅读：

```text
README.md
README.zh-CN.md
docs/README.md
docs/01-product/prd/Clean_Hub-prd-v0.1.md
docs/01-product/phase-scope/Clean_Hub-Phase_1范围与验收标准.md
docs/04-technical/trd/Clean_Hub-Phase_1.1-SaaS平台功能开发计划-v0.1.md
docs/04-technical/trd/Clean_Hub-Phase_1.2-租户后台功能开发计划-v0.1.md
docs/04-technical/trd/Clean_Hub-Phase_1.2-租户审计eventCategory命名表.md
docs/04-technical/trd/Clean_Hub-Phase_1-Web_Admin基础模块-TRD-v0.1.md
docs/04-technical/api/Clean_Hub-API_Client使用说明.md
docs/04-technical/database/Clean_Hub-Drizzle数据库迁移操作详解.md
docs/04-technical/trd/Contract CleanHub EN Clean.pdf
docs/04-technical/trd/CleanHub EN Changelog.pdf
```

---

## 3. 项目背景

### 3.1 与前序波次关系

| 波次 | 文档 | 已完成（预期） | 本波次承接 |
| ---- | ---- | -------------- | ---------- |
| 第一次 | Phase 1.1 | SaaS 平台、`/saas/**`、平台审计 | 不扩展 SaaS 业务范围 |
| 第二次 | Phase 1.2 | Owner 开户、员工/服务/价格、租户审计骨架 | 门店模块、路由收口、Manager 过滤 |
| **第三次** | **本文档** | — | 门店 + 权限 + POS 壳 + 架构文档 |
| 第四次 | 计划另文档 | — | POS 登录、订单、离线 PoC |

### 3.2 产品架构（必读）

构设与 PRD 约定：

```text
SaaS 平台后台（/saas）          → 平台运营：建租户、功能开关
租户后台 / Back Office（/tenant）→ Owner / Manager：门店、员工、服务、价格、日志
POS（pos-web + desktop / Android APK）→ Cashier / 现场：收银、下单（本波次仅壳层；参考机 POS-T1101）
Mobile（Capacitor）             → 客户/配送；Owner 手机看店（后续；≠ POS 一体机）
```

**结论**：

- **不存在** `apps/store-admin` 或独立「门店管理平台」。
- **店长（Manager）** 使用与 Owner **相同的** `web-admin` → `/tenant`，差异在**角色与数据范围**（单店、无跨店）。
- **Cashier** 不得进入 `/tenant`；仅使用 POS（第四次开发实现登录与下单）。

构设 §3.7 角色对照（Changelog）：

| 角色 | 数据范围 | Back Office | POS |
| ---- | -------- | ----------- | --- |
| Owner / Admin | 全部门店 | 全量配置与报表 | 可选 |
| Branch Manager | **单店**、无跨店 | 本店运营 | 可选 |
| Cashier | 单店 | **禁止** | **仅 POS** |

### 3.3 Phase 1.2 遗留与本波次衔接

1.2 已规划但仓库/集成可能未完成的事项，按**工作类型**分工如下（勿与「第三次新功能」混为一谈）：

**A. 路由与 API Client 挂载（历史遗留 + 本波次，均归李龙杰）**

第二次开发结束时，部分 `apps/api/src/modules/**` 已存在，但 **`apps/api/src/app.ts` 未注册**、**`packages/api-client/src/tenant/index.ts` 未聚合导出**——属**历史挂载遗留**，不是本波次新写的业务模块。第三次由**李龙杰**一次性收口（§11.3）：

| 项 | 说明 | 负责人 |
| -- | ---- | ------ |
| **Batch A（Day 1）** | 补挂 1.2 已有模块：`overview`、`settings`、`services`、`prices`、`backups`、`reports`、`hardware-configs`（若存在）等 | **李龙杰** |
| **Batch B（Day 2）** | 武帅杰 `tenant-branches` 模块合并后，补挂 `/tenant/branches` | **李龙杰** |
| **`api-client` 聚合** | `packages/api-client/src/tenant/index.ts` 导出与上述路由对齐 | **李龙杰** |

**B. 1.2 模块代码与联调（杨序承接，不含 `app.ts` / `index.ts` 挂载）**

| 遗留项 | 说明 | 第三次负责人 |
| ------ | ---- | ------------ |
| `tenant-users` / `tenant-audit` | 模块逻辑须接 `branchScope`、`user_branches` 写入与 Manager 过滤 | **杨序** |
| Manager 门店过滤 | 1.2 §8.2 延后；`branchScope` helper 由李龙杰 Day 1 交付，杨序在 audit/users 接入 | 李龙杰 + **杨序** |
| `pos-web` / `desktop` / `mobile` | 占位；本波次 POS 仅壳层 + 架构文档 | **杨序** |

**C. 本波次新建（非「未挂载」遗留）**

| 项 | 说明 | 负责人 |
| -- | ---- | ------ |
| `tenant-branches` 全栈 | 1.2 仅规划；**第三次**交付后端（武帅杰）、前端与 `api-client/branches*`（赵付杰）；路由挂载仍走李龙杰 **Batch B** | 武帅杰 / 赵付杰 + **李龙杰** 挂路由 |

### 3.4 Phase 1 参考硬件

第三次 **不集成 SDK**，但 POS 壳层与《终端架构说明》须按下列设备口径设计，详见 **§22**。

| 类型 | 型号 | 用途 | 本波次 |
| ---- | ---- | ---- | ------ |
| **POS 一体机（主参考）** | **POS-T1101** | 11" Android 1280×800；内置 80/58mm 小票机、2D 扫码、2.4" 客显、RJ12 钱箱口 | 壳层 UI 对标 |
| POS 一体机（备选） | POS-T8 | 小屏 Android 一体机；第二收银/移动 | 架构文档提及 |
| POS 一体机（备选） | POS-1566 | 大屏固定收银 | 架构文档提及 |
| 外接小票机 | OCPP-80S / M086 / 762B | PC 柜台 + `desktop` 外接 ESC/POS | 第四次后硬件阶段 |
| 标签机 | OCBP-M810 | 矩阵/水洗标（CPCL） | 硬件阶段 |
| 扫码枪 | OCBS-W287 | 2.4G+蓝牙无线 | T1101 可先用内置扫码头 |
| 钱箱 | TM-AA-5D | RJ12 脉冲开抽屉 | 硬件阶段 |

**部署形态**（构设对齐）：

- **一体机**：`pos-web` → Android APK 装到 POS-T1101（同构设「同一 APK、角色分界面」）。
- **PC 柜台**：`apps/desktop`（Electron）+ 外接 OCPP 小票机 / OCBS 扫码枪 / 钱箱。
- **`apps/mobile`**：客户/配送方向，**不是** POS-T1101 上的收银 App。

---

## 4. 本次开发目标

### 4.1 P0 目标

1. **门店管理**：Owner / Manager 在 `/tenant/branches` 完成列表、创建、详情、编辑、启用/停用。
2. **店长单店权限**：Manager 仅能见、能改**绑定门店**；Owner 见全租户门店。
3. **员工门店绑定**：创建/更新员工时写入 `user_branches`；列表与审计支持按店筛选。
4. **API 集成收口**：`apps/api/src/app.ts` 与 `packages/api-client/src/tenant/index.ts` 由**李龙杰**挂载/聚合本阶段 `/tenant/**` 路由（见 §11.2、§11.3）；业务模块 PR **不得**修改 `app.ts`。
5. **审计**：门店写操作写入 `audit_logs`（`tenant_branch`，见命名表）。
6. **端到端**：SaaS 建租户 → Owner 建 2 店 → 建 Manager（绑 A 店）→ Manager 只见 A 店。

### 4.2 P1 目标

7. **POS 平板壳层**：横屏 Layout（**对标 POS-T1101 · 1280×800**）、顶栏、主导航占位、选店占位、触控尺寸规范。
8. **终端架构说明 v0.1**：四端边界 + **参考硬件映射** + POS 打包路径（见 §15、§22）。
9. **Phase 1.2 联调收尾**：工作台、设置、操作日志、服务/价格页与 API 挂载验证。
10. **通知配置**（武帅杰 · P1）：`tenant-notifications` 占位，不发真实消息。

### 4.3 非目标

- 完整 POS 下单、收款、打印、Z 报表。
- Wave / Orange Money 真实接入。
- 离线同步生产可用、断电恢复。
- Owner 手机 App 全功能。
- 客户/配送 Mobile 业务页。
- 仅 Owner 可「开新店」的硬规则（可 P1；时间紧则第四次）。

---

## 5. 本期不做内容

1. 订单、支付、客户 CRM 完整模块。
2. `packages/ui/src/components/ui/**` 手改（仍走 shadcn CLI）。
3. Tenant Admin 离线模式。
4. Manager 跨店报表对比、高级 BI。
5. 真实硬件联调（厂商 `POS_sdk`、CPCL 标签、蓝牙打印、钱箱脉冲、客显副屏 SDK）。
6. 在 `packages/hardware` 或 Capacitor 插件中接入 OCOM / OCPP / OCBP 驱动。
7. 新建数据库表（`branches`、`user_branches` 已在 1.2 schema）；本波次**禁止**业务 PR 自行 `db:generate` 新表，缺字段走杨序补丁 + 李龙杰审核。

---

## 6. 团队成员

| 姓名 | 本波次分工原则 |
| ---- | -------------- |
| **李龙杰** | **Day 1 实现** `branchScope` helper（§8.2.1）；**`apps/api/src/app.ts` 租户路由单点整合**（§11.3）；**`packages/api-client/src/tenant/index.ts` 聚合**；§8 Manager 单店权限规范；代码审核、验收统筹；终端架构文档评审 |
| **杨序** | **承接 1.2 未完成**：`tenant-users` / `tenant-audit` **调用** `branchScope` 接过滤、`user_branches` 写入；集成检查；**POS 壳层（POS-T1101 1280×800）+ desktop 开发加载**；终端架构说明 |
| **武帅杰** | **`tenant-branches` 后端 API（P0）**：CRUD、状态、审计、与 `branchScope` 对接；通知配置 P1 |
| **赵付杰** | **租户后台主流程 UI（P0）**：工作台、设置、**门店管理页面**；`packages/api-client` branches；端到端 Owner 开户→建店联调 |
| **孙蕊蕊** | 操作日志页对接 audit；服务/价格/备份/报表路由与页面对接验证 |
| **许婧姝** | 第三次测试用例、验收记录、接口说明更新 |

---

## 7. 技术栈与项目结构

与 Phase 1.2 一致，不重复列举。本波次新增/重点目录：

```text
apps/api/src/modules/
  tenant-branches/          # 武帅杰：后端 API（新建）
apps/api/src/modules/auth/
  branch-scope.helper.ts    # 李龙杰（Day 1；或扩 permission.helper）
apps/web-admin/src/
  app/(tenant)/tenant/branches/     # 赵付杰（Next.js App Router 页面，≠ apps/api/src/app.ts）
  features/tenant/branches/         # 赵付杰
apps/pos-web/src/           # 杨序：平板壳 layout
apps/desktop/src/           # 杨序：加载 pos-web（开发态）
packages/api-client/src/tenant/
  branches.ts               # 赵付杰：补全 CRUD
docs/04-technical/trd/
  Clean_Hub-Phase_1.3-终端架构说明-v0.1.md   # 杨序起草，李龙杰评审（P1 产出）
```

---

## 8. 权限与角色（本波次实现口径）

### 8.1 路由与角色

| 模块 / 操作 | Owner | Manager | Cashier |
| ----------- | ----- | ------- | ------- |
| 进入 `/tenant/**` | ✅ | ✅ | ❌ |
| 门店列表/详情 | 全租户 | **仅绑定门店** | ❌ |
| 创建门店 `POST /tenant/branches` | ✅ | ✅（P1 可改为仅 Owner；**当前版本 Owner+Manager 均可**，第四次可收紧） | ❌ |
| 编辑/停用门店 | 全租户 | **仅绑定门店** | ❌ |
| 员工 CRUD | 全租户 | 全租户员工列表 **建议本波次仍全租户**；创建时 `branchIds` 限 Manager 授权店内 | ❌ |
| `PATCH /tenant/settings` | ✅ | ❌ | ❌ |
| 操作日志 | 全租户，可 `branchId` 筛 | **默认仅本店** + 租户级 `branch_id IS NULL` 可选 | ❌ |
| POS `pos-web` | 可选 | 可选 | 第四次主路径 |

### 8.2 Manager 单店过滤规则

**数据来源**：`user_branches`（`user_id` + `branch_id` + `tenant_id`）。

| API / 场景 | Owner | Manager |
| ---------- | ----- | ------- |
| `GET /tenant/branches` | `tenant_id` 下全部未删门店 | **仅** `user_branches` 中的 `branch_id` |
| `GET/PATCH /tenant/branches/:id` | 任意本租户门店 | `id` 须在绑定列表内，否则 **404** |
| `GET /tenant/audit-logs` | 全部 + 可选 `branchId` 查询参数 | 强制 `branchId IN (绑定店)`；可选包含 `branch_id IS NULL` 的租户级记录 |
| `POST /tenant/users` 的 `branchIds` | 任意本租户门店 | 只能分配 **自己绑定的店**（Manager 通常仅 1 店） |

**实现位置**：共享 helper 见 **§8.2.1**（**李龙杰 · Day 1**）；各模块只调用，不各自实现过滤逻辑。

### 8.2.1 `branchScope` helper 规范

业务规则即 §8.2（Owner 全店、Manager 仅绑定店），。李龙杰按下列 API **直接实现**并提 PR：

| 函数 | 行为 |
| ---- | ---- |
| `resolveAllowedBranchIds(authContext, db?)` | `owner` → `'all'`；`manager` → 查 `user_branches` 得 `branchId[]`（空数组表示无绑定店） |
| `assertBranchAccess(authContext, branchId, db?)` | Owner 通过；Manager 若 `branchId` 不在绑定列表 → **404**（与门店详情越权一致） |
| `assertBranchIdsSubset(authContext, branchIds, db?)` | Manager 创建/更新员工时：`branchIds` 须 ⊆ 绑定店；否则 **403** |

**文件**：`apps/api/src/modules/auth/branch-scope.helper.ts`（推荐新建；可从 `permission.helper` 导出 re-export）。

**约束**：

- `tenantId` 仅来自 `authContext`，禁止信任请求 body。
- 与现有 `assertTenantContext` 配合：先租户上下文，再门店范围。

**调用方**（合并 helper PR 后接入）：武帅杰 `tenant-branches`；杨序 `tenant-audit` / `tenant-users`（Day 2）。

### 8.3 Cashier 守卫

- **产品规则**（不变）：Cashier **不得**进入 `/tenant`；仅使用 POS（第四次开发）。
- **本波次**：**不预设**演示账号、seed 脚本或 `cashier` 专用测试用户；**不将** Cashier 403 列入 P0 验收。
- **实现现状**：`assertTenantContext` / `permission.helper` 已仅允许 `owner` | `manager`；非二者访问 `/tenant/**` → **403**。待第四次 POS 再补充 `cashier` 角色与真实收银账号流程。
- `web-admin` `proxy.ts`：保持 `/tenant` 仅 `owner`、`manager`（与 Web Admin TRD 一致）。

### 8.4 `user_branches` 写入

- **实现位置**：`apps/api/src/modules/users` 或 `tenant-users`（**杨序**维护；`app.ts` 仍走 `/tenant/users` 挂载）。
- **创建/更新员工**（`POST/PATCH /tenant/users`）：当 body 含 `branchIds` 时，事务内写入 `user_branches`（先删后插或 upsert，须在同一 `tenant_id` 下）。
- **Manager 创建员工**：`branchIds` 须 ⊆ 该 Manager 的绑定门店（§8.2）；Owner 可分配任意本租户门店。
- **验收**：Owner 建 Manager 并绑 A 店 → `user_branches` 有记录 → Manager 登录后 `branchScope` 仅返回 A 店。

---

## 9. 功能清单与优先级

### 9.1 门店管理 — 后端 API（武帅杰 · P0）

| 编号 | 功能点 | 说明 |
| ---- | ------ | ---- |
| B-01 | 门店列表 API | `GET /tenant/branches`；名称/电话搜索；状态筛选；接 `branchScope` |
| B-02 | 创建门店 API | `POST`；字段见 §11.1 |
| B-03 | 门店详情 API | `GET /tenant/branches/:branchId` |
| B-04 | 编辑门店 API | `PATCH` 更新 |
| B-05 | 启用/停用 API | `PATCH .../status`；`deletedAt` 软删策略与 1.2 schema 一致 |
| B-06 | 审计 | `branch.created` / `branch.updated` / `branch.status_changed` |
| B-07 | 租户隔离 | `tenantId` 仅来自 `authContext` |
| B-08 | Manager 过滤 | 列表/详情/写操作接 `branchScope`（李龙杰 helper · §8.2.1） |

### 9.1.1 门店管理 — 前端与 api-client（赵付杰 · P0）

| 编号 | 功能点 | 说明 |
| ---- | ------ | ---- |
| B-F01 | 门店列表页 | `/tenant/branches`；搜索、状态筛选、跳转详情 |
| B-F02 | 新建门店 | 表单提交 `POST`；校验与错误提示 |
| B-F03 | 门店详情/编辑 | `/tenant/branches/[branchId]`；PATCH 更新、启用/停用 |
| B-F04 | api-client | `packages/api-client/src/tenant/branches*` 全方法 |
| B-F05 | 主流程联调 | 工作台入口 → 门店列表 → 建店；与 overview/settings 导航一致 |

### 9.2 店长权限与集成（李龙杰 / 杨序 · P0）

| 编号 | 功能点 | 负责人 | 说明 |
| ---- | ------ | ------ | ---- |
| M-01 | `branchScope` helper | **李龙杰 · Day 1** | 按 §8.2.1 实现；阻塞武帅杰 / 杨序过滤接入 |
| M-02 | `app.ts` 挂载 | **李龙杰** | 见 §11.2、§11.3（Batch A/B） |
| M-03 | `tenant-audit` Manager 过滤 | 杨序 | 列表默认限店；调用 M-01；**承接 1.2** |
| M-04 | `tenant-users` 校验 `branchIds` | 杨序 | Manager 分配门店不得超出绑定范围；**写入 `user_branches`**（§8.4）；调用 M-01；**承接 1.2** |
| M-05 | `api-client` 聚合 | **李龙杰** | `packages/api-client/src/tenant/index.ts` |
| M-06 | 集成检查 | 杨序 | typecheck / lint 相关 workspace |

### 9.3 租户后台 UI 收口（赵付杰 / 孙蕊蕊 · P0/P1）

| 编号 | 功能点 | 负责人 |
| ---- | ------ | ------ |
| L-01 | `GET /tenant/overview` + `/tenant` 工作台 | 赵付杰 |
| L-02 | `GET/PATCH /tenant/settings` | 赵付杰 |
| L-03 | 门店管理前端 | 赵付杰（见 §9.1.1） |
| L-04 | `/tenant/system/logs` 接 audit API | 孙蕊蕊 |
| L-05 | services / prices / backups / reports 路由可访问 | 孙蕊蕊 + 李龙杰挂载 |

### 9.4 POS 平板壳层（杨序 · P1）

| 编号 | 功能点 | 说明 |
| ---- | ------ | ---- |
| P-01 | 横屏 Layout | 顶栏：店名、用户、离线占位 |
| P-02 | 主导航占位 | 收件/订单/设置（空页面即可） |
| P-03 | 断点与触控 | **对标 POS-T1101**：1280×800 横屏；按钮 ≥48px；正文 ≥16px；金额 ≥20px |
| P-04 | 当前门店占位 | 本地 state 或读 branches 列表（Mock 亦可） |
| P-05 | `desktop` dev 加载 | `loadURL(pos-web dev)` 可配置 |
| P-06 | 法语默认 | `lang="fr"` |
| P-07 | 硬件能力占位 | 顶栏或设置页预留「打印 / 扫码 / 客显」入口（**无 SDK 调用**；第四次对接 POS-T1101 内置与外设） |

### 9.5 终端架构文档（杨序 · P1）

| 编号 | 功能点 | 说明 |
| ---- | ------ | ---- |
| T-01 | 四端边界图 | SaaS / Tenant / POS / Mobile |
| T-02 | Mobile 约束 | 不打包 web-admin；不用 SSR/middleware/proxy |
| T-03 | POS 鉴权约定 | Cookie + API；不读 HttpOnly token |
| T-04 | 端口与构建 | pos-web 3001；后续 static export 决策 |
| T-05 | 参考硬件映射 | POS-T1101 / POS-T8 / POS-1566 / OCPP / OCBP / OCBS / 钱箱；一体机 APK vs PC+外设 vs `mobile` 边界（见 §22） |
| T-06 | Phase 4 前置决策 | POS-T1101 上 **WebView 壳 + pos-web** vs **原生 SDK 桥接**（打印/扫码/客显）；本波次只写结论与备选，不实现 |

### 9.6 通知配置（武帅杰 · P1）

与 Phase 1.2 §12.7 一致：`GET/PATCH /tenant/notification-settings`，不发真实消息。

---

## 10. 前端路由与页面

### 10.1 租户后台（web-admin）

| 页面 | 路由 | 负责人 | 优先级 |
| ---- | ---- | ------ | ------ |
| 门店列表 | `/tenant/branches` | 赵付杰 | P0 |
| 门店详情/编辑 | `/tenant/branches/[branchId]` | 赵付杰 | P0 |
| 工作台 | `/tenant` | 赵付杰 | P0 收口 |
| 租户设置 | `/tenant/system/settings` | 赵付杰 | P0 收口 |
| 操作日志 | `/tenant/system/logs` | 孙蕊蕊 | P0 收口 |
| 员工管理 | `/tenant/users` | 杨序（1.2） | 验证 branchIds |
| 服务/价格/备份/报表 | 既有路由 | 孙蕊蕊 | 联调 |
| 通知配置 | `/tenant/config/notifications` | 武帅杰 | P1 |

### 10.2 POS（pos-web）

| 页面 | 路由 | 负责人 | 优先级 |
| ---- | ---- | ------ | ------ |
| 壳层首页 | `/` | 杨序 | P1 |
| Layout | `app/layout.tsx` + 门店壳组件 | 杨序 | P1 |
| 硬件占位 | 设置或顶栏「打印/扫码/客显」disabled 入口 | 杨序 | P1（P-07） |

---

## 11. API 接口清单

### 11.1 门店管理 `tenant-branches`（武帅杰 · 后端；前端见 §9.1.1、§10.1）

| 方法 | 路径 | 说明 | 角色 |
| ---- | ---- | ---- | ---- |
| GET | `/tenant/branches` | 列表；Manager 过滤 | Owner、Manager |
| POST | `/tenant/branches` | 创建 | Owner、Manager |
| GET | `/tenant/branches/:branchId` | 详情 | Owner、Manager（须有权） |
| PATCH | `/tenant/branches/:branchId` | 更新 | Owner、Manager（须有权） |
| PATCH | `/tenant/branches/:branchId/status` | 启用/停用 | Owner、Manager（须有权） |

**字段**（与 `packages/db/src/schema/tenant.ts` → `branches` 一致）：

- `name`、`address`、`phone`、`businessHours`（jsonb）
- `defaultLanguage`、`defaultCurrency`
- `receiptName`、`receiptPhone`、`receiptAddress`、`logoUrl`
- `status`：`active` | `inactive`

**写审计**（`writeAuditLog`）：

```ts
eventCategory: "tenant_branch"
eventType: "branch.created" | "branch.updated" | "branch.status_changed"
branchId: <门店 id>
tenantId: authContext.tenantId
```

### 11.2 本波次须挂载的既有租户 API（李龙杰 · Day 1）

| 前缀 | 模块目录 | 说明 |
| ---- | -------- | ---- |
| `/tenant/overview` | `tenant-overview` | 赵付杰 |
| `/tenant/settings` | `tenant-settings` | 赵付杰 |
| `/tenant/users` | `users` / `tenant-users` | 杨序 |
| `/tenant/audit-logs` | `tenant-audit` | 杨序 |
| `/tenant/services` | `tenant-services` | 孙蕊蕊 |
| `/tenant/prices` | `tenant-prices` | 孙蕊蕊 |
| `/tenant/backups` | `tenant-backups` | 孙蕊蕊 |
| `/tenant/reports` | `tenant-reports` | 孙蕊蕊 |
| `/tenant/notification-settings` | `tenant-notifications` | 武帅杰 P1 |
| `/tenant/hardware-configs` | `tenant-hardware` | 若 1.2 已完成则一并挂载 |
| `/tenant/branches` | `tenant-branches` | 武帅杰 · **Day 2 模块就绪后由李龙杰挂载**（见 §11.3） |

**规则**：`apps/api/src/app.ts` 中 Tenant 路由块**仅李龙杰**修改；合并前须杨序审核（与 1.2 模块一致性）。**禁止**武帅杰、赵付杰、孙蕊蕊等业务 PR 夹带 `app.ts` 变更。

### 11.3 `app.ts` 路由挂载 SOP（李龙杰单点整合）

> **命名辨析（避免口头混淆）**
>
> | 路径 | 含义 | 本波次负责人 |
> | ---- | ---- | ------------ |
> | `apps/api/src/app.ts` | 后端 API 入口，`app.route("/tenant/...")` | **李龙杰**（唯一修改人） |
> | `apps/web-admin/src/app/**` | Next.js **App Router 前端页面** | **赵付杰** 等（与 `app.ts` 无关） |
> | `packages/api-client/src/tenant/index.ts` | 前端 API 客户端聚合导出 | **李龙杰** |

**原则**：各模块负责人在 `apps/api/src/modules/**` 内交付 `*.routes.ts`；**路由注册集中由李龙杰在 `app.ts` 完成**，避免多人改同一文件导致 Git 冲突。

**流程**：

1. **模块开发者**（武帅杰 / 赵付杰 / 孙蕊蕊等）提交 PR：**仅含** `modules/tenant-xxx/**`，**不含** `app.ts`。**李龙杰** 在独立 PR（或每日一次批量 PR）中更新 `app.ts` + 必要时 `packages/api-client/src/tenant/index.ts`。
4. **杨序** 审核：prefix 无重复、与 1.2 模块挂载一致、Tenant 块完整。
5. **赵付杰 / 模块负责人** 做 **挂载验证**（curl / Postman / 前端联调），**不自行改** `app.ts`。

**两批挂载计划**：

| 批次 | 时间 | 内容 |
| ---- | ---- | ---- |
| **Batch A** | Day 1 上午 | §11.2 中 **1.2 遗留**路由：`overview`、`settings`、`services`、`prices`、`backups`、`reports`、`hardware-configs`（若存在）等 |
| **Batch B** | Day 2 | 武帅杰 `tenant-branches` 合并后，李龙杰追加 `app.route("/tenant/branches", ...)` |

**合并顺序（强制）**：

```text
Day 1：李龙杰 Batch A（app.ts）→ 全员可联调 1.2 模块
Day 2：武帅杰 tenant-branches 模块 PR（无 app.ts）→ 李龙杰 Batch B（app.ts 一行）→ 赵付杰 branches 前端
```

**PR 描述模板**：

```markdown
## 请求挂载 app.ts
- 模块：tenant-branches
- Factory：createTenantBranchesRoutes
- Prefix：/tenant/branches
- 合并状态：本 PR 已合 main
- 联调人：赵付杰
```

---

## 12. 文件所有权规划

| 负责人 | 后端 | 前端 | 文档 |
| ------ | ---- | ---- | ---- |
| **李龙杰** | **`branch-scope.helper.ts`（Day 1）**；**`app.ts`**；**`packages/api-client/src/tenant/index.ts`**；禁止业务 PR 新表（审核） | 审核、验收 | 终端架构评审 |
| **杨序** | **`tenant-audit` 过滤**；**`tenant-users` branchIds 校验**（承接 1.2） | `apps/pos-web/**` 壳层；`apps/desktop` 加载 | `Clean_Hub-Phase_1.3-终端架构说明-v0.1.md` 起草 |
| **武帅杰** | `tenant-branches/**`（后端）；`tenant-notifications/**`（P1） | `config/notifications/**`（P1） | — |
| **赵付杰** | `tenant-overview`；`tenant-settings`（**挂载验证**，不改 `app.ts`） | `features/tenant/overview`；`settings`；`/tenant`；**`features/tenant/branches/**`**；**`web-admin/src/app/(tenant)/tenant/branches/**`**；`packages/api-client/.../branches*` | — |
| **孙蕊蕊** | — | `system/logs`；`services`；`prices`；`backups`；`reports` | — |
| **许婧姝** | — | — | 测试用例、验收报告 |

**公共规则**（延续 1.2）：

1. **`apps/api/src/app.ts`**：**仅李龙杰**修改 Tenant/SaaS 路由注册；杨序审核。业务 PR **禁止**夹带 `app.ts`。
2. **`apps/web-admin/src/app/**`**：前端页面路由，归各模块前端负责人（如赵付杰）；**不是** `app.ts`，不得口头简称为「改 app」而不说明是 API 还是 web-admin。
3. 禁止跨目录改他人模块。
4. 本波次**不新增表**；`user_branches` 已存在则只写业务逻辑（§8.4）。
5. 禁止修改 `packages/ui/src/components/ui/**`。
6. **`tenant-branches` 模块边界**：`apps/api/.../tenant-branches/**` 归武帅杰；`features/tenant/branches/**`、`web-admin/.../branches/**`、`packages/api-client/.../branches*` 归赵付杰。联调通过接口契约与 PR review，不互相改对方目录，不自行改 `app.ts`。

---

## 13. 个人详细任务

### 13.1 李龙杰

**职责**：`branchScope` 实现、**`app.ts` / `api-client` 整合**、权限规范、审核、验收。

**Day 1（阻塞，优先上午）**

1. **实现** `branch-scope.helper.ts`（§8.2.1）：
   - `resolveAllowedBranchIds`
   - `assertBranchAccess`
   - `assertBranchIdsSubset`
2. 从 `apps/api/src/modules/auth/index.ts` 导出；`pnpm --filter @cleanhub/api typecheck` 通过。

**Day 1（下午，可与 helper PR 并行）**

4. **`app.ts` Batch A**：挂载 §11.2 中 **1.2 遗留** `/tenant/**` 路由（**不含** `/tenant/branches`）。
5. 更新 `packages/api-client/src/tenant/index.ts` 导出（1.2 模块）。

**Day 2**

6. **`app.ts` Batch B**：武帅杰 `tenant-branches` 合并后，追加 `app.route("/tenant/branches", ...)`。
7. 同步 `api-client` 中 `branches` 等导出（与赵付杰对齐字段）。

**后续**

8. 审核武帅杰 `tenant-branches` 后端 PR：租户隔离、审计、Manager 404 越权店。
9. 审核赵付杰门店前端与 `api-client/branches` PR：表单校验、错误态、无散落 fetch。
10. Day 3–5：组织 **Owner / Manager** 两角色验收（Cashier 留第四次 POS）。
11. 评审《终端架构说明》v0.1。
12. 推进集成 typecheck / build。

### 13.2 杨序

**职责**：**承接 1.2 未完成**（`tenant-audit` / `tenant-users` + `branchScope` 接入）、POS 壳（**POS-T1101 · 1280×800**）、架构文档（含 §22 硬件映射）。

**Day 1**

1. 等李龙杰 **§8.2.1** `branchScope` PR 合并后，与武帅杰对齐调用方式。
2. 审核李龙杰 **Batch A** `app.ts` / `api-client` PR（顺序、无重复 prefix、与 1.2 模块一致）。
3. 与赵付杰对齐：Day 2 起 `api-client/branches` 与后端接口字段（由李龙杰挂载后联调）。

**Day 2**

4. `tenant-audit`：Manager 列表强制 branch 过滤。
5. `tenant-users`：`user_branches` 写入（§8.4）；Manager 提交 `branchIds` 校验 ⊆ 绑定店。
6. 与武帅杰、赵付杰联调：Manager 用户只见单店；门店页可完整 CRUD。

**Day 3**

10. `pos-web`：平板 Layout（**1280×800**）、顶栏、导航占位、P-07 硬件能力占位（无 SDK）。
11. `desktop`：开发环境加载 `pos-web` URL（环境变量）。

**Day 4**

12. 起草 `Clean_Hub-Phase_1.3-终端架构说明-v0.1.md`（含 T-05/T-06、§22 映射、WebView vs 原生 SDK 决策）。
13. 集成检查：api + web-admin + pos-web typecheck。

**Day 5**

14. 修复联调问题；遗留项清单（交第四次）。

**负载说明**：若 Day 3–4 POS/架构与 Day 2 联调冲突，**优先保证杨序完成 1.2 audit/users 过滤**；POS 壳层可降为 P1 最小占位（顶栏 + 空白主区），架构文档 v0.1 不晚于 Day 5 中午。`app.ts` Batch A/B 由李龙杰保障，不占用杨序排期。

### 13.3 武帅杰

**职责**：门店模块 **后端 API**（P0）；通知配置 P1。

**后端**（`apps/api/src/modules/tenant-branches/`）：

```text
routes → controller → service → repository → validation → types → errors
```

**Day 1**

1. **等李龙杰 §8.2.1 `branchScope` 合并后**，搭建模块骨架；`GET/POST` 列表与创建（调用 `resolveAllowedBranchIds` / `assertBranchAccess`）。
2. 写审计；`requireTenantRole(['owner','manager'])`。
3. **PR 不含 `app.ts`**。

**Day 2**

4. `GET/PATCH/:branchId`、`PATCH .../status`。
5. 与赵付杰对齐接口 DTO，供 `api-client` 与前端联调。

**Day 3**

5. 配合赵付杰联调 Manager 过滤与越权 404。
6. 修复 API 层验收问题。

**Day 4–5**

7. P1：`tenant-notifications` API 占位（若 P0 已验收）。
8. 修复集成与验收问题。

**重点**：

- `tenant_id` 禁止来自 body。
- 停用 = 状态变更 + 软删字段，不物理 DELETE。
- 错误码：越权店 **404**（防枚举）。
- **不修改** `features/tenant/branches/**` 与 `packages/api-client/**/branches*`（赵付杰负责）。

### 13.4 赵付杰

**职责**：租户后台 **主流程 UI（P0）**：工作台、设置、门店页面、`api-client/branches`、Owner 端到端联调。

**Day 1**

1. 等待李龙杰 **Batch A** `app.ts` PR 合并（§11.3）；**不自行修改** `apps/api/src/app.ts`。
2. 验证 `GET /tenant/overview`、`GET/PATCH /tenant/settings` 联调。
3. 阅读 §11.1 字段与 §9.1.1，准备门店页与 `api-client` 结构。

**Day 2**

4. `/tenant` 工作台对接 overview（占位指标可仍为 0）。
5. `/tenant/system/settings`：Owner 可写；Manager 只读或隐藏保存按钮。
6. `packages/api-client/src/tenant/branches*` 全方法（对齐武帅杰 Day2 接口）。

**Day 3**

7. `/tenant/branches` 列表、新建页（替换 `PagePlaceholder`）。
8. `/tenant/branches/[branchId]` 详情/编辑、启用/停用。
9. 与杨序联调 Manager 单店可见性。

**Day 4–5**

10. 主流程验收：SaaS 建租户 → Owner 登录 → 建 2 店 → 导航与设置页正常。
11. 修复联调与 UI 问题。

### 13.5 孙蕊蕊

**职责**：操作日志与服务/价格等页面对接。

**Day 1–2**

1. `/tenant/system/logs` 接 `tenant-audit` API（筛选含 `branchId`）。
2. 验证 services、prices、backups、reports 在路由挂载后可访问。

**Day 3–5**

3. 页面 Empty/Error 态；与杨序 audit 联调 Manager 过滤展示。
4. 参与回归测试。

### 13.6 许婧姝

**职责**：测试与验收文档。

**Day 1**

1. 编写第三次 P0 测试用例（见 §17）。

**Day 2–4**

2. API 测试：门店 CRUD、租户隔离、Manager 过滤。
3. 页面流程测试。

**Day 5**

4. 验收报告；未通过项清单；接口说明更新（branches）。

---

## 14. POS 平板适配规范

**主参考设备**：OCOM **POS-T1101**（11" Android 一体机，1280×800 横屏，内置 80/58mm 小票机、2D 扫码头、2.4" 客显、RJ12 钱箱口）。

| 项 | 规范 |
| -- | ---- |
| 目标设备 | **POS-T1101** 1280×800 横屏（主）；备选 POS-T8（小屏）、POS-1566（大屏）仅文档提及 |
| 视口设计 | 以 **1280×800** 为设计稿基准；壳层在 1024×600 ~ 1920×1080 横屏下无严重溢出 |
| 触控 | 主按钮 min **48×48px**；列表行高 ≥56px；收银高频区建议 ≥56px 热区 |
| 字体 | 正文 ≥16px；金额/合计 ≥20px；客显区文案可更大（占位即可） |
| 语言 | 默认 `fr` |
| Next 约束 | 壳层以 Client Component 为主；不依赖 `web-admin/proxy.ts` |
| 离线条 | 顶栏「离线 · N 待同步」占位即可 |
| 硬件 UI | 预留打印/扫码/客显入口（disabled 或 toast「第四次接入」）；**本波次不调用** 厂商 SDK |
| 部署对照 | 一体机 = `pos-web` APK on POS-T1101；PC 柜台 = `desktop` + OCPP 外设（第四次） |

---

## 15. 验收标准

### 15.1 P0 功能验收

| # | 场景 | 预期 |
| - | ---- | ---- |
| 1 | Owner 门店 CRUD | 可建店，可编辑、可停用，审计可查 |
| 2 | Manager 绑 A 店 | 登录后列表仅 A；访问 B 店详情 404 |
| 3 | Manager 改 A 店 | 成功并写审计 |
| 4 | 租户隔离 | 租户 T1 不能访问 T2 的 `branchId` |
| 5 | api-client | 前端门店页走 api-client，无散落 fetch |
| 6 | 路由挂载 | Postman/curl 可访问 §11.2 **Batch A + B** 已挂载接口（含 `/tenant/branches`） |

### 15.2 P1 验收（尽量）

| # | 场景 | 预期 |
| - | ---- | ---- |
| 7 | POS 壳层 | **1280×800** 横屏无严重溢出；顶栏可见；硬件占位入口存在且无 SDK 调用 |
| 8 | desktop | 能打开 pos-web 开发页 |
| 9 | 终端架构文档 | 含 §22 硬件映射与 WebView/SDK 决策；评审通过并入库 |
| 10 | Cashier 403（可选） | 若临时手工建 cashier 用户：任意 `/tenant/**` → 403；**无预设 seed 要求** |

### 15.3 代码质量

```bash
pnpm --filter @cleanhub/api typecheck
pnpm --filter @cleanhub/web-admin typecheck
pnpm --filter @cleanhub/pos-web typecheck
pnpm --filter @cleanhub/api-client typecheck
```

---

## 16. 测试用例（许婧姝 · 摘要）

### 16.1 门店 API

- Owner：`POST /tenant/branches` 成功 → `GET` 列表含新店 → `PATCH` 更新 → `PATCH status` 停用。
- Manager：仅绑定店出现在列表；`GET` 未绑定 `branchId` → 404。
- 未登录：→ 401。

### 16.2 审计

- 创建门店后 `GET /tenant/audit-logs?eventCategory=tenant_branch` 含 `branch.created`。

### 16.3 集成

- `pnpm db:migrate` 后全员本地可启动 api + web-admin。

---

## 17. 每日开发计划

### 17.1 Day 1（周一）：阻塞项 — 路由收口 + 门店 API 起步

| 人员 | 任务 |
| ---- | ---- |
| **李龙杰** | **`branchScope` helper（§8.2.1，上午阻塞）**；下午 **`app.ts` Batch A** + `api-client` 聚合（Batch A 不依赖 helper） |
| **杨序** | 审核李龙杰 Batch A PR；梳理 1.2 `tenant-audit` / `tenant-users` 待接入项 |
| **武帅杰** | 等李龙杰 helper 合并后：`tenant-branches` GET/POST + 接 `branchScope`（**无 app.ts**） |
| **赵付杰** | 等 Batch A 合并后验证 overview/settings；梳理门店页与 `api-client/branches` |
| **孙蕊蕊** | 梳理 logs/services 页面待联调项 |
| **许婧姝** | P0 测试用例初稿 |

**合并顺序**：李龙杰 **`branchScope` helper** → 武帅杰 `tenant-branches`（无 app.ts）∥ 李龙杰 **Batch A** `app.ts` → 李龙杰 **Batch B** 挂 `/tenant/branches`（Day 2）→ 杨序 **audit/users** 过滤。

### 17.2 Day 2（周二）：门店 API 全量 + api-client + 过滤联调

| 人员 | 任务 |
| ---- | ---- |
| **武帅杰** | branches 详情/更新/状态 API；模块 PR 合并 |
| **赵付杰** | `api-client/branches` 全量；工作台/设置页联调 |
| **李龙杰** | **`app.ts` Batch B**；审核 branches 后端 PR |
| **杨序** | audit/users 过滤 + `user_branches`；与武帅杰、赵付杰联调 Manager |
| **孙蕊蕊** | logs 页接 audit API |
| **许婧姝** | API 自动化/手工测试 |

### 17.3 Day 3（周三）：门店前端 + 两角色验证

| 人员 | 任务 |
| ---- | ---- |
| **赵付杰** | `/tenant/branches` 全流程页面 |
| **武帅杰** | API 联调与 bugfix |
| **杨序** | 端到端：Owner 建店 + Manager 单店 |
| **孙蕊蕊** | 各自页面收尾 |
| **许婧姝** | 页面测试 |
| **李龙杰** | 中期验收走查；审核门店前端 PR |

### 17.4 Day 4（周四）：POS 壳 + 架构文档 + P1

| 人员 | 任务 |
| ---- | ---- |
| **杨序** | pos-web Layout（**1280×800**）；P-07 硬件占位；desktop load；终端架构说明 v0.1（含 §22 映射） |
| **武帅杰** | 通知配置 P1（可选） |
| **全员** | 修联调 bug |
| **许婧姝** | 回归测试 |

### 17.5 Day 5（周五）：验收

| 人员 | 任务 |
| ---- | ---- |
| **李龙杰** | 主持验收；typecheck/build |
| **许婧姝** | 验收报告定稿 |
| **杨序** | 遗留项（第四次 POS 订单） |
| **全员** | 修复阻塞项 |

---

## 18. 风险与应对

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| 1.2 门店模块零实现 | 第三周后端与前端并行压力大 | 前后端分轨：武帅杰 Day1–2 交付 API；赵付杰 Day2–3 交付页面与 api-client |
| **`app.ts` 多人修改** | 合并冲突、路由重复 | **§11.3 SOP**：仅李龙杰改；模块 PR 禁止夹带；Batch A/B 分批 |
| **`app.ts` vs `web-admin/src/app`** 口头混淆 | 改错文件、联调阻塞 | §11.3 命名表；周会统一说法「API app.ts / 前端 app 目录」 |
| 杨序负载集中 | 1.2 audit/users + POS + 架构文档延期 | §13.2：P0 优先 1.2 过滤；POS 可最小占位 |
| 李龙杰负载集中 | helper + Batch A/B + 审核 | §13.1：helper 上午优先；Batch A 可与 helper 并行 |
| **`branchScope` Day 1 未合并** | 武帅杰 / 杨序无法接 Manager 过滤 | 李龙杰上午优先交付 §8.2.1 PR |
| Manager 过滤漏接口 | 数据泄露 | 清单：branches、audit、users.branchIds |
| **`user_branches` 未写入** | Manager 绑定无效 | §8.4：杨序在 tenant-users 创建/更新时写入 |
| POS 与 web-admin 混用 | Mobile 后续返工 | 第四天必须产出架构说明 |
| POS-T1101 原生 SDK vs `pos-web` Next.js | 第四次打印/扫码返工 | 架构说明 T-06 写清 WebView 桥接 vs 原生；壳层按 1280×800 设计，不假设 PC 浏览器 |
| 误把 `apps/mobile` 当 POS | 打包与权限错误 | §3.4 / §22 明确：收银 APK = `pos-web`，`mobile` = 客户/配送 |
| 仅 Owner 可开店未做 | Manager 误开新店 | P1 或第四次；文档写清当前允许双方 |

---

## 19. 第四次开发预告（非本文档范围）

第四次建议聚焦 **POS 最小营业闭环** 与 **硬件 PoC**：

- POS 登录（Pressing Code + PIN）、选店、`device_id`
- 订单 schema + 创建/列表/详情 + 状态流转
- `packages/offline` 队列 PoC
- `desktop` 正式集成；**POS-T1101** 上 `pos-web` APK 或 WebView 壳 PoC
- **硬件**：`packages/hardware` 对接 POS-T1101 内置打印/扫码（或 OCPP 外接小票机）；钱箱脉冲；标签机 OCBP-M810 可后置
- `GET /tenant/overview` 接真实订单统计

详见后续 `Clean_Hub-Phase_1.3-第四次开发计划-v0.1.md`（待编写）。

---

## 20. 附录：角色与入口速查

| 角色 | 登录 | 第三次主要能力 |
| ---- | ---- | -------------- |
| super_admin / support | `/saas` | 不在本波次范围 |
| Owner | `/login` → `/tenant` | 多店 CRUD、全员、设置 |
| Manager | `/login` → `/tenant` | **单店**经营、本店日志 |
| Cashier | 第四次 POS（**POS-T1101 / desktop**） | **禁止** `/tenant` |

---

## 21. 附录：Phase 1 参考硬件清单

> 来源：团队本地 OCOM 设备资料（`POS-T1101`、`OCPP-*` 等文件夹）。第三次 **仅文档与 UI 对标**，不下载/集成厂商 SDK。

### 21.1 POS 一体机（收银主设备）

| 型号 | 屏幕 | 内置能力 | CleanHub 对应 |
| ---- | ---- | -------- | ------------- |
| **POS-T1101** | 11" **1280×800** | 80/58mm 小票、2D 扫码、2.4" 客显、RJ12 钱箱 | **`pos-web` APK 主参考**；第三次壳层设计稿 |
| POS-T8 | 8" 级小屏 | 一体机形态，便携/副收银 | 架构文档备选 |
| POS-1566 | 15.6" 大屏 | 固定柜台 | 架构文档备选 |

### 21.2 外设（PC 柜台 / `desktop` 场景）

| 型号 | 类型 | 协议/说明 | 接入波次 |
| ---- | ---- | --------- | -------- |
| OCPP-80S / M086 / 762B | 热敏小票机 | ESC/POS，USB/网口 | 第四次+ |
| OCBP-M810 | 标签打印机 | CPCL，水洗标/矩阵码 | 硬件专项 |
| OCBS-W287 | 无线扫码枪 | 2.4G + 蓝牙 | 第四次+（T1101 可先用内置扫码头） |
| TM-AA-5D | 钱箱 | RJ12 脉冲 | 第四次+ |

### 21.3 软件边界（避免混淆）

| 终端 | App | 运行环境 | 第三次 |
| ---- | --- | -------- | ------ |
| 门店收银 | `pos-web` | POS-T1101 APK 或 `desktop` Electron | 壳层 + 架构 |
| 客户/配送 | `mobile`（Capacitor） | 手机 Android/iOS | 不在本波次 |
| 总部/店长 | `web-admin` `/tenant` | 浏览器 | P0 门店管理 |

### 21.4 第四次硬件接入检查项（预告）

1. 厂商是否提供 **Android WebView JSBridge**（打印/扫码/客显）或仅原生 SDK。
2. `pos-web` 构建产物形态：`standalone` server vs **static export**（影响 APK 内嵌）。
3. 内置打印机纸宽 80 vs 58mm 与小票模板字段。
4. `device_id` 与门店绑定策略（与 `branches` / 终端注册表）。


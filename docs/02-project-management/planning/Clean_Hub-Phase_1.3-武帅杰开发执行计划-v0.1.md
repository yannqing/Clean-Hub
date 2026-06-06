# CleanHub Phase 1.3 武帅杰开发执行计划 v0.1

| 项 | 内容 |
| --- | --- |
| 文档状态 | In Progress：代码已实现，待运行时验收 |
| 编制日期 | 2026-06-06 |
| 负责人 | 武帅杰 |
| 对齐基线 | `origin/dev` @ `c416093` |
| 需求来源 | `docs/04-technical/trd/Clean_Hub-Phase_1.3-第三次开发计划-v0.1.md` |
| 外部参考 | `Clean_Hub-Phase_1.3-第三次开发计划-v0.1.pdf`（快照，仅作对照） |

---

## 1. 结论先行

武帅杰在 Phase 1.3 的直接责任范围为：

1. **P0：`tenant-branches` 后端 API**
   - 门店列表、创建、详情、编辑、启用/停用。
   - 租户隔离、Manager 单店权限、越权返回 404。
   - 门店创建、更新、状态变更审计。
2. **P1：`tenant-notifications` 通知配置**
   - `GET/PATCH /tenant/notification-settings`。
   - 仅配置占位，不发送真实短信、WhatsApp 或邮件。
   - 当前仓库已存在后端、API Client 与租户后台页面，后续以回归验收和必要修复为主。

截至 2026-06-06，以上两块均已有代码合入 `dev`，但 `tenant-branches` **尚未接入 `branchScope`**。因此本次开工重点不是重新搭建模块，而是完成 **P0 权限补缺、回归验证、验收证据和文档闭环**。

---

## 2. 需求与仓库对齐结论

### 2.1 可信源优先级

遇到描述冲突时，按以下顺序执行：

1. 最新 `origin/dev` 上的仓库文档与代码。
2. `docs/04-technical/trd/Clean_Hub-Phase_1.3-第三次开发计划-v0.1.md`。
3. 外部 PDF 快照。

外部 PDF 与仓库 Markdown 的主体分工一致，但 PDF 仍存在“由杨序执行 Batch A/B”一类旧表述。当前仓库口径明确：

- `apps/api/src/app.ts`：仅李龙杰修改。
- `packages/api-client/src/tenant/index.ts`：由李龙杰集中整合。
- 武帅杰的业务 PR 不得夹带上述文件变更。

### 2.2 最新仓库状态

| 项目 | 当前状态 | 结论 |
| --- | --- | --- |
| 本地 `dev` | 已快进到 `origin/dev@c416093` | 已对齐 |
| `tenant-branches` | PR #39 已合入；路由已挂载 | 已实现主体，仍有 P0 权限缺口 |
| `tenant-notifications` | PR #33 已合入；端到端页面与 API 已存在 | 转为回归验收 |
| `branch-scope.helper.ts` | 已存在 | 可直接调用，不重复实现 |
| `tenant-users` / `tenant-audit` | 已接入部分门店范围能力 | 联调依赖，不属于武帅杰目录 |
| 自动化测试 | 未发现 branches / notifications 测试文件 | 必须补验收证据；测试框架另行评审 |

本次基线检查未启动 PostgreSQL、API 或 Web Admin，因此接口验收矩阵当前仍为“待执行”，不能以 typecheck/build 通过代替功能验收。

### 2.3 已发现的 P0 缺口

当前 `apps/api/src/modules/tenant-branches/branches.service.ts` 只校验了 Owner/Manager 角色和租户状态，没有调用：

- `resolveAllowedBranchIds`
- `assertBranchAccess`

直接影响：

- Manager 调用 `GET /tenant/branches` 时可能看到租户下全部门店。
- Manager 可能读取、编辑或停用未绑定门店。
- Phase 1.3 验收要求“Manager 仅见绑定店、越权详情返回 404”尚未满足。

---

## 3. 文件所有权与协作边界

### 3.1 武帅杰可直接修改

```text
apps/api/src/modules/tenant-branches/**
apps/api/src/modules/tenant-notifications/**
apps/web-admin/src/app/(tenant)/tenant/config/notifications/**       # 仅 P1 必要修复
apps/web-admin/src/features/tenant/notifications/**                   # 仅 P1 必要修复
docs/02-project-management/reports/Clean_Hub-Phase_1.3-武帅杰开发验收记录-v0.1.md
```

### 3.2 需要协作但不得自行修改

| 路径 / 模块 | 负责人 | 武帅杰的动作 |
| --- | --- | --- |
| `apps/api/src/modules/auth/branch-scope.helper.ts` | 李龙杰 | 调用现有 helper；发现问题提 Issue/PR review 意见 |
| `apps/api/src/app.ts` | 李龙杰 | 请求挂载或调整，不在业务 PR 修改 |
| `packages/api-client/src/tenant/branches*` | 赵付杰 | 对齐 DTO；变更接口契约前先沟通 |
| `packages/api-client/src/tenant/index.ts` | 李龙杰 | 不修改 |
| `apps/web-admin/src/features/tenant/branches/**` | 赵付杰 | 联调和反馈，不直接修改 |
| `apps/api/src/modules/tenant-users/**` | 杨序 | 联调 `user_branches` 写入 |
| `apps/api/src/modules/tenant-audit/**` | 杨序 | 联调门店审计查询 |
| API / 测试验收文档 | 许婧姝 | 提供接口结果和验收证据 |

### 3.3 明确禁止

- 不从请求 body、query 或 path 获取 `tenantId` 作为可信租户上下文。
- 不新增数据库表，不自行运行并提交 `db:generate` 产物。
- 不手改 `packages/ui/src/components/ui/**`。
- 不在业务 PR 中修改 `apps/api/src/app.ts`。
- 不在门店后端 PR 中夹带前端 branches 或 API Client branches 改动。
- 不复用已删除远端的旧分支继续开发。

---

## 4. 开发工作分解

### 4.1 P0：门店权限补缺

目标：让 `tenant-branches` 完整满足 Owner 全店、Manager 仅绑定店的权限规则。

#### 列表接口

`GET /tenant/branches`

- Service 调用 `resolveAllowedBranchIds(authContext, db)`。
- Owner 得到 `"all"`，保持租户内全量查询。
- Manager 得到 `branchId[]`，Repository 必须额外按允许 ID 过滤。
- Manager 没有绑定门店时返回空数组，不得回退为全租户查询。
- 继续保留 `tenantId`、`deletedAt`、搜索、状态、分页过滤。

#### 详情与写接口

以下接口在读写前调用 `assertBranchAccess(authContext, branchId, db/tx)`：

```text
GET   /tenant/branches/:branchId
PATCH /tenant/branches/:branchId
PATCH /tenant/branches/:branchId/status
```

要求：

- 未绑定门店统一返回 404，防止枚举。
- 其他租户的门店也返回 404。
- 更新与状态变更在事务内校验权限并写审计。
- 保留现有乐观锁 `version` 与 409 冲突语义。

门店权限属于数据泄露风险。修复 PR 应优先补聚焦的 service/repository 测试；若仓库尚未批准 API 测试框架，则不得临时向根目录添加依赖，必须提交完整的接口验收证据，并登记后续自动化测试建设任务。

#### 审计

继续验证：

```text
eventCategory: tenant_branch
eventType: branch.created | branch.updated | branch.status_changed
branchId: 实际门店 ULID
tenantId: authContext.tenantId
```

### 4.2 P0 已锁定决策

| 决策项 | 本阶段结论 |
| --- | --- |
| Manager 是否能创建门店 | **不能**；`POST /tenant/branches` 仅 Owner 可调用，Manager 返回 403 |
| 停用与软删关系 | 停用只修改 `status=inactive`；`deletedAt` 保留给未来独立删除能力 |
| 自动化测试 | 不混入权限修复 PR；另开测试基建 PR，权限修复 PR 提供运行时验收证据 |

本阶段不修改数据库字段，不自动将新门店写入 Manager 的 `user_branches`。

### 4.3 P1：通知配置回归

当前通知配置已是端到端实现，默认不重新开发。P0 验收通过后再执行以下回归：

- `GET /tenant/notification-settings` 可读取或初始化租户配置。
- `PATCH /tenant/notification-settings` 可更新配置并写审计。
- 不跨租户读写。
- 功能开关关闭时按现有权限 helper 拒绝访问。
- `deliveryMode` 保持 `not_connected`，不接真实消息服务。
- 不增加真实供应商密钥、Webhook 或发送任务。

---

## 5. 实施排期

| 阶段 | 工作 | 交付门禁 |
| --- | --- | --- |
| Day 0：基线确认 | 同步 `dev`；确认决策；创建修复分支；记录基线 commit | 已完成：`dev@c416093` |
| Day 1：P0 修复 | branches 列表过滤；详情/更新/状态权限校验；Owner-only 创建 | 已实现并通过静态门禁；运行时待验收 |
| Day 2：联调与 PR | 与赵付杰、杨序联调；验证审计、租户隔离、乐观锁；提交 PR | P0 验收矩阵有证据；PR 不越权改文件 |
| Day 3：P1 与收尾 | notifications 回归；修复必要问题；更新验收记录 | P1 结果明确；遗留项有负责人和后续阶段 |

P0 未通过时，不开始通知配置扩展。

---

## 6. Git 分支与提交规范

### 6.1 命名规则

分支名应优先表达“改什么、为什么改”，推荐结构：

```text
<type>/<scope>-<intent>-<owner>-<YYYYMMDD>
```

| 部分 | 规则 | 示例 |
| --- | --- | --- |
| `type` | `feat` 新能力；`fix` 修复已存在或已验收要求中的缺陷；`docs` 仅文档；`refactor` 不改变行为的重构 | `fix` |
| `scope` | 使用最小可识别模块名，不使用宽泛的 `tenant` | `tenant-branches` |
| `intent` | 写清具体行为或问题，不只写阶段名 | `manager-scope` |
| `owner` | 多人协作时保留负责人缩写 | `wsj` |
| 日期 | 分支创建日期，格式固定 | `20260606` |

Phase 编号用于计划、Issue、PR 描述和文档追踪，通常不放进代码分支名。仅当分支本身是阶段计划文档时，才保留 `phase1.3`。

本次 Manager 门店范围属于已存在代码未满足 Phase 1.3 P0 验收标准，因此使用 `fix`。如果门店模块尚不存在、首次实现 CRUD，则应使用 `feat`。

### 6.2 开门店权限修复分支

每次开发必须从最新 `dev` 新开分支：

```bash
git fetch --prune origin
git switch dev
git pull --ff-only origin dev
git status --short --branch
git switch -c fix/tenant-branches-manager-scope-wsj-YYYYMMDD
```

本轮建议：

```text
fix/tenant-branches-manager-scope-wsj-20260606
```

通知配置如发现具体缺陷，按缺陷行为另开分支和 PR，例如：

```text
fix/tenant-notifications-audit-wsj-YYYYMMDD
```

不得创建 `fix/tenant-notifications-wsj-YYYYMMDD` 这类没有说明具体问题的分支。
不得把 branches 与 notifications 混进同一个 PR。

### 6.3 提交前检查

```bash
git status --short
git diff --check
git diff --stat
git diff -- apps/api/src/modules/tenant-branches
git diff --exit-code dev -- apps/api/src/app.ts
git diff --exit-code dev -- packages/api-client/src/tenant/index.ts
git diff --exit-code dev -- apps/web-admin/src/features/tenant/branches
```

最后三条必须无输出并以成功状态退出。

### 6.4 Commit 建议

每个 commit 只表达一个可审查目的：

```text
fix(tenant-branches): enforce manager branch scope
test(tenant-branches): cover manager branch access
docs(phase-1.3): record wsj verification results
fix(tenant-notifications): <具体修复内容>
```

避免使用 `update`、`fix bug`、`修改代码` 等无法追踪范围的提交信息。

### 6.5 推送与 PR

```bash
git push -u origin fix/tenant-branches-manager-scope-wsj-YYYYMMDD
gh pr create \
  --base dev \
  --head fix/tenant-branches-manager-scope-wsj-YYYYMMDD \
  --title "fix(tenant-branches): enforce manager branch scope"
```

PR 审核人：

- 李龙杰：权限规则、目录边界、`branchScope` 调用。
- 杨序：`user_branches` 与 Manager 端到端联调。
- 赵付杰：前端/API DTO 联调确认。

不要对共享分支强推。个人分支确需重写历史时，只允许 `--force-with-lease`，且须确认没有其他人基于该分支开发。

---

## 7. PR 描述写法

```markdown
## 目标
补齐 tenant-branches 的 Manager 单店范围控制，满足 Phase 1.3 P0 验收。

## 修改范围
- apps/api/src/modules/tenant-branches/...
- docs/02-project-management/reports/Clean_Hub-Phase_1.3-武帅杰开发验收记录-v0.1.md

## 未修改
- apps/api/src/app.ts
- packages/api-client/src/tenant/index.ts
- apps/web-admin/src/features/tenant/branches/**

## 权限与数据边界
- tenantId 仅来自 authContext
- Manager 列表仅返回 user_branches 授权店
- 未授权详情/更新/状态变更返回 404

## 验证
- [ ] API typecheck
- [ ] API lint
- [ ] API build
- [ ] Owner 门店 CRUD
- [ ] Manager 仅见 A 店
- [ ] Manager 访问 B 店返回 404
- [ ] T1 访问 T2 门店返回 404
- [ ] 审计日志可查

## 风险与待确认
- Manager 创建门店语义
- inactive 与 deletedAt 语义
```

---

## 8. 文档交付规范

### 8.1 本轮必须维护

```text
docs/02-project-management/planning/Clean_Hub-Phase_1.3-武帅杰开发执行计划-v0.1.md
docs/02-project-management/reports/Clean_Hub-Phase_1.3-武帅杰开发验收记录-v0.1.md
```

### 8.2 文档内容要求

开发验收记录必须写清：

- 日期、基线 commit、开发分支、最终 commit、PR 链接。
- 实际修改文件和未修改边界。
- 每个接口的 Owner / Manager / 跨租户验证结果。
- 执行过的命令、结果和警告。
- 未通过项、风险、负责人和计划解决阶段。
- 任何接口契约变化及已通知的协作者。

### 8.3 文档变更规则

- 项目计划放 `docs/02-project-management/planning`。
- 开发状态与验收记录放 `docs/02-project-management/reports`。
- API 契约变更放 `docs/04-technical/api`，并与许婧姝协作更新。
- 权限或状态语义发生决策变化时，更新 TRD 或新增 ADR；不得只在聊天中口头确认。
- 不把密钥、Cookie、Token、`.env` 内容、真实客户数据写入文档。
- 版本升级时更新文档顶部版本表，历史结论不覆盖删除。

---

## 9. 验证与验收

### 9.1 最低命令门禁

```bash
pnpm --filter @cleanhub/api typecheck
pnpm --filter @cleanhub/api lint
pnpm --filter @cleanhub/api build
pnpm --filter @cleanhub/api-client typecheck
pnpm --filter @cleanhub/web-admin typecheck
git diff --check
```

当前基线检查结果：

| 检查 | 2026-06-06 基线结果 |
| --- | --- |
| `@cleanhub/api typecheck` | 通过 |
| `@cleanhub/api lint` | 通过，存在 1 条非本任务 warning：`apps/api/src/modules/users/users.repository.ts` 未使用 `userBranches` |
| `@cleanhub/api build` | 通过 |
| `@cleanhub/api-client typecheck` | 通过 |
| `@cleanhub/web-admin typecheck` | 通过 |

### 9.2 P0 验收矩阵

| 场景 | 必须结果 |
| --- | --- |
| Owner 列表 | 返回本租户全部未删除门店 |
| Manager 绑 A 店后列表 | 只返回 A 店 |
| Manager 无绑定店列表 | 返回空数组 |
| Manager 读/改/停用 A 店 | 成功并写审计 |
| Manager 读/改/停用 B 店 | 404 |
| T1 用户访问 T2 门店 | 404 |
| 旧 `version` 更新门店 | 409 |
| 创建/更新/状态变更 | `tenant_branch` 审计记录完整 |

### 9.3 P1 验收矩阵

| 场景 | 必须结果 |
| --- | --- |
| 读取通知配置 | 返回当前租户配置 |
| 更新通知配置 | 保存并写审计 |
| 功能开关关闭 | 按现有 helper 拒绝 |
| 真实消息发送 | 不发生 |

### 9.4 Definition of Done

- P0 验收矩阵全部通过。
- 代码仅修改责任目录。
- 无新增跨租户数据暴露风险。
- 质量门禁通过；新增警告为 0。
- PR 已审核并合入 `dev`。
- 验收记录已填写，遗留项已明确负责人和阶段。

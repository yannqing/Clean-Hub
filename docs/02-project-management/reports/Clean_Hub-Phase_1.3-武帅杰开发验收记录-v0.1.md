# CleanHub Phase 1.3 武帅杰开发验收记录 v0.1

| 项 | 内容 |
| --- | --- |
| 文档状态 | 门店与通知运行时验收通过；待审核合入 |
| 负责人 | 武帅杰 |
| 验收日期 | 2026-06-06 |
| 基线 commit | `c416093` |
| 开发分支 | `fix/tenant-branches-manager-scope-wsj-20260606` |
| 最终 commit | `dd5ebf4` |
| PR | [#51 fix(tenant-branches): enforce manager branch scope](https://github.com/yannqing/Clean-Hub/pull/51) |
| 审核人 | 李龙杰 / 杨序 / 赵付杰 |

> 本文档只记录实际执行结果。未执行的检查不得填写为“通过”。

---

## 1. 本次范围

### 1.1 计划修改

```text
apps/api/src/modules/tenant-branches/branches.service.ts
apps/api/src/modules/tenant-branches/branches.repository.ts
```

### 1.2 明确未修改

- [x] `apps/api/src/app.ts`
- [x] `packages/api-client/src/tenant/index.ts`
- [x] `apps/web-admin/src/features/tenant/branches/**`
- [x] 数据库 schema / migration
- [x] 其他人员负责的业务目录

### 1.3 接口或权限契约变化

```text
Manager 列表仅返回 user_branches 授权门店；未授权门店读写返回 404；
POST /tenant/branches 收紧为仅 Owner，Manager 返回 403；
停用仅修改 status=inactive，不修改 deletedAt。
```

---

## 2. 开发结果摘要

| 交付项 | 状态 | 说明 |
| --- | --- | --- |
| Manager 门店列表过滤 | 通过 | `resolveAllowedBranchIds` + repository `inArray` |
| Manager 详情越权 404 | 通过 | `BranchScopeError` 转 `BRANCH_NOT_FOUND` |
| Manager 更新越权 404 | 通过 | 事务内校验 |
| Manager 状态变更越权 404 | 通过 | 事务内校验 |
| Manager 创建门店 403 | 通过 | 创建接口仅允许 Owner |
| 租户隔离 | 通过 | T1 Owner / Manager 访问 T2 门店均返回 404 |
| 门店审计 | 通过 | 三类 `tenant_branch` 审计均可查 |
| 通知配置回归 | 通过 | 功能开关、初始化、读写、审计与占位语义均通过 |

---

## 3. 权限与 API 验收

### 3.1 测试数据

| 对象 | 标识 | 说明 |
| --- | --- | --- |
| Tenant T1 | `01KRERJN800000000000000001` | `CLEAN-001` |
| Tenant T2 | `01KRERJN810000000000000002` | `CLEAN-002` |
| Owner T1 | `01KRERJN8B0000000000000012` | 开发种子账号 |
| Manager T1 | `01KTES72Y5605EXF34KJJ22MZD` | 仅绑定 Branch A |
| 无门店 Manager | `01KTES73192KKPK00RB5T9TKA1` | 无 `user_branches` 记录 |
| Branch A | `01KTES72JJ49JENVDK8ANC03FR` | Manager 已授权 |
| Branch B | `01KTES72K9D08HX9ZHZR0SPF3K` | Manager 未授权 |
| Branch T2 | `01KTES72KSDQTHFQXJ5QF2CYCC` | 跨租户门店 |

不得在本文档记录密码、Cookie、Token 或真实客户信息。

测试 Manager 由 Owner 通过 `/tenant/users` 创建并写入 `user_branches`。为通过当前密码登录端点完成角色验收，本地数据库仅对测试 Manager 的 `password_hash` 使用开发种子账号哈希；未提交数据库数据、密码或脚本。

### 3.2 门店 API

| # | 身份 | 操作 | 预期 | 实际 | 结果 | 证据 / 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Owner T1 | `GET /tenant/branches` | 返回 T1 全部门店 | 返回 Branch A、B | 通过 | T2 门店未出现 |
| 2 | Manager T1 | `GET /tenant/branches` | 只返回 Branch A | 仅返回 Branch A | 通过 | |
| 3 | 无门店 Manager | `GET /tenant/branches` | 返回空数组 | `[]` | 通过 | |
| 4 | Manager T1 | `GET /tenant/branches/{A}` | 200 | 200 | 通过 | |
| 5 | Manager T1 | `GET /tenant/branches/{B}` | 404 | 404 `BRANCH_NOT_FOUND` | 通过 | |
| 6 | Manager T1 | `PATCH /tenant/branches/{B}` | 404 | 404 `BRANCH_NOT_FOUND` | 通过 | |
| 7 | Manager T1 | `PATCH /tenant/branches/{B}/status` | 404 | 404 `BRANCH_NOT_FOUND` | 通过 | |
| 8 | Manager T1 | `POST /tenant/branches` | 403 | 403 `FORBIDDEN` | 通过 | |
| 9 | Owner T1 | 访问 Branch T2 | 404 | 404 `BRANCH_NOT_FOUND` | 通过 | |
| 10 | Manager T1 | 访问 Branch T2 | 404 | 404 `BRANCH_NOT_FOUND` | 通过 | |
| 11 | Owner T1 | 使用旧 `version` 更新 | 409 | 409 `BRANCH_VERSION_CONFLICT` | 通过 | |
| 12 | Owner T1 | 创建、更新、状态变更 | 均成功 | 均成功 | 通过 | Branch A 最终 `version=5` |
| 13 | Manager T1 | 更新、启用 Branch A | 均成功 | 均成功 | 通过 | |
| 14 | Owner T1 | 停用 Branch A | 不修改 `deletedAt` | `deletedAt=NULL` | 通过 | |

### 3.3 审计

| 操作 | 预期 eventCategory | 预期 eventType | 实际 | 结果 |
| --- | --- | --- | --- | --- |
| 创建门店 | `tenant_branch` | `branch.created` | 可查 | 通过 |
| 更新门店 | `tenant_branch` | `branch.updated` | 可查 | 通过 |
| 状态变更 | `tenant_branch` | `branch.status_changed` | 可查 | 通过 |

T1 共查到 6 条本轮 `tenant_branch` 审计，覆盖三种事件类型。

### 3.4 通知配置 P1

| 场景 | 预期 | 实际 | 结果 |
| --- | --- | --- | --- |
| `GET /tenant/notification-settings` | 返回当前租户配置 | 首次初始化，重复读取保持同一 ID；Owner / Manager 均可读 | 通过 |
| `PATCH /tenant/notification-settings` | 保存并写审计 | Owner / Manager 更新成功；版本从 1 增至 3；2 条更新审计 | 通过 |
| 功能开关关闭 | 拒绝访问 | T1 / T2 的 GET 与 T1 的 PATCH 均返回 403 `FEATURE_DISABLED` | 通过 |
| 租户隔离 | 每个租户只读写自己的配置 | T1 / T2 分别初始化出不同 `tenantId` 与配置 ID | 通过 |
| 关闭后重新启用 | 保留已有配置 | 配置与版本保持 | 通过 |
| 真实消息发送 | 不发生 | `deliveryMode=not_connected`，未配置或调用真实供应商 | 通过 |

---

## 4. 质量检查

| 命令 | 结果 | 关键输出 / 警告 |
| --- | --- | --- |
| `pnpm --filter @cleanhub/api typecheck` | 通过 | |
| `pnpm --filter @cleanhub/api lint` | 通过，有基线 warning | `apps/api/src/modules/users/users.repository.ts` 未使用 `userBranches` |
| `pnpm --filter @cleanhub/api build` | 通过 | |
| `pnpm --filter @cleanhub/api-client typecheck` | 通过 | |
| `pnpm --filter @cleanhub/web-admin typecheck` | 通过 | |
| `git diff --check` | 通过 | |

---

## 5. 文件边界复核

```bash
git diff --stat dev...HEAD
git diff --exit-code dev -- apps/api/src/app.ts
git diff --exit-code dev -- packages/api-client/src/tenant/index.ts
git diff --exit-code dev -- apps/web-admin/src/features/tenant/branches
```

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| PR 只包含计划范围文件 | 通过 | 仅两个 `tenant-branches` 后端文件 |
| `app.ts` 无改动 | 通过 | |
| API Client 聚合无改动 | 通过 | |
| branches 前端无改动 | 通过 | |

---

## 6. 决策、风险与遗留

| 类型 | 内容 | 负责人 | 处理阶段 | 状态 |
| --- | --- | --- | --- | --- |
| 决策 | Manager 不允许创建门店 | 已确认 | Phase 1.3 | 已落实 |
| 决策 | inactive 只改 `status`，不改 `deletedAt` | 已确认 | Phase 1.3 | 已落实 |
| 风险 | branches / notifications 尚无自动化测试 | 武帅杰 | 独立测试基建 PR | 待处理 |
| 已解决 | Docker Desktop daemon 异常，数据库端口拒绝连接 | 武帅杰 | 本轮验收 | 已通过应用级重启恢复；迁移成功 |
| 遗留 | Manager 前端仍可能显示创建门店表单 | 赵付杰 | 后续前端 PR | API 已返回 403 |

---

## 7. 验收结论

```text
通过：门店权限、租户隔离、乐观锁、审计、停用语义与通知配置运行时验收全部通过。
```

未通过项及下一步：

```text
1. 单独建立 API 权限测试基建 PR，将本轮手工验收矩阵自动化。
2. 赵付杰后续隐藏 Manager 的创建门店表单。
```

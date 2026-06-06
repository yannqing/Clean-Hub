# CleanHub Phase 1.3 武帅杰开发验收记录 v0.1

| 项 | 内容 |
| --- | --- |
| 文档状态 | 静态门禁通过；运行时待验收 |
| 负责人 | 武帅杰 |
| 验收日期 | 2026-06-06（静态检查） |
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
| Manager 门店列表过滤 | 已实现，待运行时验收 | `resolveAllowedBranchIds` + repository `inArray` |
| Manager 详情越权 404 | 已实现，待运行时验收 | `BranchScopeError` 转 `BRANCH_NOT_FOUND` |
| Manager 更新越权 404 | 已实现，待运行时验收 | 事务内校验 |
| Manager 状态变更越权 404 | 已实现，待运行时验收 | 事务内校验 |
| Manager 创建门店 403 | 已实现，待运行时验收 | 创建接口仅允许 Owner |
| 租户隔离 | 静态复核通过，待运行时验收 | 继续使用 `authContext.tenantId` |
| 门店审计 | 未改动，待运行时回归 | |
| 通知配置回归 | 未执行 | 不属于首个代码 PR |

---

## 3. 权限与 API 验收

### 3.1 测试数据

| 对象 | 标识 | 说明 |
| --- | --- | --- |
| Tenant T1 | 待填写 | |
| Tenant T2 | 待填写 | |
| Owner T1 | 待填写 | |
| Manager T1 | 待填写 | 仅绑定 Branch A |
| Branch A | 待填写 | Manager 已授权 |
| Branch B | 待填写 | Manager 未授权 |
| Branch T2 | 待填写 | 跨租户门店 |

不得在本文档记录密码、Cookie、Token 或真实客户信息。

### 3.2 门店 API

| # | 身份 | 操作 | 预期 | 实际 | 结果 | 证据 / 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Owner T1 | `GET /tenant/branches` | 返回 T1 全部门店 | 待填写 | 待执行 | |
| 2 | Manager T1 | `GET /tenant/branches` | 只返回 Branch A | 待填写 | 待执行 | |
| 3 | 无门店 Manager | `GET /tenant/branches` | 返回空数组 | 待填写 | 待执行 | |
| 4 | Manager T1 | `GET /tenant/branches/{A}` | 200 | 待填写 | 待执行 | |
| 5 | Manager T1 | `GET /tenant/branches/{B}` | 404 | 待填写 | 待执行 | |
| 6 | Manager T1 | `PATCH /tenant/branches/{B}` | 404 | 待填写 | 待执行 | |
| 7 | Manager T1 | `PATCH /tenant/branches/{B}/status` | 404 | 待填写 | 待执行 | |
| 8 | Manager T1 | `POST /tenant/branches` | 403 | 待填写 | 待执行 | |
| 9 | Owner T1 | 访问 Branch T2 | 404 | 待填写 | 待执行 | |
| 10 | Owner T1 | 使用旧 `version` 更新 | 409 | 待填写 | 待执行 | |
| 11 | Owner T1 | 创建、更新、状态变更 | 均成功 | 待填写 | 待执行 | |

### 3.3 审计

| 操作 | 预期 eventCategory | 预期 eventType | 实际 | 结果 |
| --- | --- | --- | --- | --- |
| 创建门店 | `tenant_branch` | `branch.created` | 待填写 | 待执行 |
| 更新门店 | `tenant_branch` | `branch.updated` | 待填写 | 待执行 |
| 状态变更 | `tenant_branch` | `branch.status_changed` | 待填写 | 待执行 |

### 3.4 通知配置 P1

| 场景 | 预期 | 实际 | 结果 |
| --- | --- | --- | --- |
| `GET /tenant/notification-settings` | 返回当前租户配置 | 待填写 | 待执行 |
| `PATCH /tenant/notification-settings` | 保存并写审计 | 待填写 | 待执行 |
| 功能开关关闭 | 拒绝访问 | 待填写 | 待执行 |
| 真实消息发送 | 不发生 | 待填写 | 待执行 |

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
| 阻塞 | Docker daemon 未运行，`.env` 数据库端口拒绝连接 | 环境负责人 | 运行时验收前 | 待处理 |

新增遗留项：

```text
运行时 API 验收未执行：Docker daemon 不可用，且 DATABASE_URL 对应端口连接被拒绝。
待数据库恢复后执行本文档 §3.2、§3.3 的全部场景。
```

---

## 7. 验收结论

```text
有条件通过：代码实现与静态质量门禁通过，运行时 API 验收待数据库环境恢复后完成。
```

未通过项及下一步：

```text
1. 恢复 PostgreSQL 环境后完成 Owner / Manager / 跨租户 / 409 / 审计验收。
2. 单独建立 API 权限测试基建 PR。
3. 赵付杰后续隐藏 Manager 的创建门店表单。
```

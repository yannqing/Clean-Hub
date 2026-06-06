# CleanHub Phase 1.3 武帅杰开发验收记录 v0.1

| 项 | 内容 |
| --- | --- |
| 文档状态 | 待执行 |
| 负责人 | 武帅杰 |
| 验收日期 | 待填写 |
| 基线 commit | 待填写 |
| 开发分支 | 待填写 |
| 最终 commit | 待填写 |
| PR | 待填写 |
| 审核人 | 李龙杰 / 杨序 / 赵付杰 |

> 本文档只记录实际执行结果。未执行的检查不得填写为“通过”。

---

## 1. 本次范围

### 1.1 计划修改

```text
待填写
```

### 1.2 明确未修改

- [ ] `apps/api/src/app.ts`
- [ ] `packages/api-client/src/tenant/index.ts`
- [ ] `apps/web-admin/src/features/tenant/branches/**`
- [ ] 数据库 schema / migration
- [ ] 其他人员负责的业务目录

### 1.3 接口或权限契约变化

```text
无 / 待填写
```

---

## 2. 开发结果摘要

| 交付项 | 状态 | 说明 |
| --- | --- | --- |
| Manager 门店列表过滤 | 待执行 | |
| Manager 详情越权 404 | 待执行 | |
| Manager 更新越权 404 | 待执行 | |
| Manager 状态变更越权 404 | 待执行 | |
| 租户隔离 | 待执行 | |
| 门店审计 | 待执行 | |
| 通知配置回归 | 待执行 | |

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
| 8 | Owner T1 | 访问 Branch T2 | 404 | 待填写 | 待执行 | |
| 9 | Owner T1 | 使用旧 `version` 更新 | 409 | 待填写 | 待执行 | |
| 10 | Owner T1 | 创建、更新、状态变更 | 均成功 | 待填写 | 待执行 | |

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
| `pnpm --filter @cleanhub/api typecheck` | 待执行 | |
| `pnpm --filter @cleanhub/api lint` | 待执行 | |
| `pnpm --filter @cleanhub/api build` | 待执行 | |
| `pnpm --filter @cleanhub/api-client typecheck` | 待执行 | |
| `pnpm --filter @cleanhub/web-admin typecheck` | 待执行 | |
| `git diff --check` | 待执行 | |

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
| PR 只包含计划范围文件 | 待执行 | |
| `app.ts` 无改动 | 待执行 | |
| API Client 聚合无改动 | 待执行 | |
| branches 前端无改动 | 待执行 | |

---

## 6. 决策、风险与遗留

| 类型 | 内容 | 负责人 | 处理阶段 | 状态 |
| --- | --- | --- | --- | --- |
| 决策 | Manager 是否允许创建门店 | 李龙杰 | Phase 1.3 / Phase 1.4 | 待确认 |
| 决策 | inactive 与 `deletedAt` 的语义 | 李龙杰 | Phase 1.3 | 待确认 |
| 风险 | branches / notifications 尚无自动化测试 | 待指定 | 后续测试建设 | 待处理 |

新增遗留项：

```text
无 / 待填写
```

---

## 7. 验收结论

```text
待填写：通过 / 有条件通过 / 不通过
```

未通过项及下一步：

```text
待填写
```

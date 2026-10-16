# Clean Hub Phase 1.2 — 租户侧审计 eventCategory / eventType 命名表

> 对应开发计划 §16。租户经营写操作须 `writeAuditLog`，`eventCategory` 使用 `tenant_*` 前缀。  
> 实现参考：`apps/api/src/modules/audit/audit.helper.js`。

## eventCategory（固定枚举）

| eventCategory | 模块 | 说明 |
| ------------- | ---- | ---- |
| `tenant_branch` | 门店 | branches CRUD、停用 |
| `tenant_user` | 员工 | users CRUD、禁用、PIN 重置 |
| `tenant_service` | 服务目录 | services CRUD、停用 |
| `tenant_price` | 标准价格 | prices 改价 |
| `tenant_hardware` | 硬件配置 | hardware_configs |
| `tenant_notification` | 通知配置 | notification_settings |
| `tenant_settings` | 租户设置 | tenant_settings |
| `tenant_backup` | 备份与恢复 | backup_jobs、restore_requests |
| `tenant_customer` | 客户 | customers CRUD |
| `tenant_order` | 订单 | orders 创建、确认、状态、改价、取消 |

## eventType 建议（按模块）

### tenant_branch

| eventType | 说明 |
| --------- | ---- |
| `branch.created` | 创建门店 |
| `branch.updated` | 更新门店 |
| `branch.status_changed` | 启用/停用 |

### tenant_user

| eventType | 说明 |
| --------- | ---- |
| `user.created` | 创建员工 |
| `user.updated` | 更新员工 |
| `user.status_changed` | 禁用/启用 |
| `user.pin_reset` | 管理员重置 PIN（metadata 禁止含 PIN 明文） |

### tenant_service

| eventType | 说明 |
| --------- | ---- |
| `service.created` | 创建服务 |
| `service.updated` | 更新服务 |
| `service.status_changed` | 停用/启用 |

### tenant_price

| eventType | 说明 |
| --------- | ---- |
| `price.updated` | 改价（`before`/`after` 含 `amount`） |

### tenant_hardware

| eventType | 说明 |
| --------- | ---- |
| `hardware_config.created` | 创建设备配置 |
| `hardware_config.updated` | 更新设备配置 |

### tenant_notification

| eventType | 说明 |
| --------- | ---- |
| `notification_settings.updated` | 更新通知 JSON 配置 |

### tenant_settings

| eventType | 说明 |
| --------- | ---- |
| `settings.updated` | 更新 tenant_settings |

### tenant_backup

| eventType | 说明 |
| --------- | ---- |
| `backup_job.created` | 创建备份任务记录 |
| `restore_request.created` | 提交恢复申请 |

### tenant_customer

| eventType | 说明 |
| --------- | ---- |
| `customer.created` | 创建客户 |
| `customer.updated` | 更新客户 |

### tenant_order

| eventType | 说明 |
| --------- | ---- |
| `order.created` | 创建草稿订单 |
| `order.confirmed` | 确认收件（生成 `order_number`） |
| `order.status_changed` | 状态流转 |
| `order.price_overridden` | 改价（`before`/`after` 含金额） |
| `order.cancelled` | 取消订单 |

## 写入约定

- `tenantId`：必须为 `authContext.tenantId`（禁止信任 body 覆盖）。
- `branchId`：门店级操作填写；租户级可 `null`。
- `entityType` / `entityId`：与业务实体一致（如 `price`、`price.id`）。
- 禁止在 `before` / `after` / `metadata` 中出现：`password`、`passwordHash`、`pin`、`pinHash`、`token` 等（`audit.helper` 已过滤常见键）。

## 示例

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

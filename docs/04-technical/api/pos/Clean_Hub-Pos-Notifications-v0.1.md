# Clean Hub POS 通知中心接口文档 v0.1

## 1. 范围

本文件描述 POS 通知中心本期开放的 HTTP 接口。通知中心只实现 POS 站内收件箱能力，不开放 HTTP 发送接口，不接入 WhatsApp、SMS、Email、模板管理、定时发送或多渠道配置。

本期收件箱以 `notification_deliveries` 为操作单元，读取时关联 `notifications` 获取标题、内容、类型与关联对象。

## 2. 通用约束

- Base URL: `/pos/notifications`
- 认证：必须登录 POS，并携带当前租户上下文。
- 租户隔离：接口只能访问当前 `tenant_id`、当前登录 `user_id` 的 POS 投递记录。
- 收件箱范围：仅返回 `channel = "pos"`、`status = "sent"`、`recipient_type = "user"`、`recipient_id = 当前用户`、`notifications.scope = "pos"` 的记录。
- 默认列表不返回 `read_status = "archived"` 的记录；只有显式筛选 `readStatus=archived` 时返回归档记录。
- 写操作必须由后端 service 包事务，并写入 audit log。
- 归档不可逆，归档后默认列表不再显示。

## 3. 枚举

### noticeType

| 值 | 说明 |
| --- | --- |
| `business` | 业务通知 |
| `system` | 系统通知 |

### readStatus

| 值 | 说明 |
| --- | --- |
| `unread` | 未读 |
| `read` | 已读 |
| `archived` | 已归档 |

### priority

| 值 | 说明 |
| --- | --- |
| `low` | 低 |
| `normal` | 普通 |
| `high` | 高 |
| `critical` | 紧急 |

### relatedType

| 值 | 说明 |
| --- | --- |
| `ticket` | 工单 |
| `order` | 订单 |

## 4. 数据结构

### PosNotificationInboxItem

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 投递记录 ULID，对应 `notification_deliveries.id` |
| `notificationId` | `string` | 通知内容 ULID，对应 `notifications.id` |
| `tenantId` | `string \| null` | 租户 ID |
| `noticeType` | `noticeType` | 通知类型 |
| `readStatus` | `readStatus` | 阅读状态 |
| `priority` | `priority` | 优先级 |
| `title` | `string` | 标题 |
| `content` | `string` | 内容 |
| `relatedType` | `relatedType \| null` | 关联对象类型 |
| `relatedId` | `string \| null` | 关联对象 ID |
| `senderType` | `system \| user \| customer \| scheduler` | 发送方类型 |
| `senderId` | `string \| null` | 发送方 ID |
| `sentAt` | `string \| null` | 送达时间，ISO 字符串 |
| `readAt` | `string \| null` | 阅读时间，ISO 字符串 |
| `createdAt` | `string` | 创建时间，ISO 字符串 |
| `updatedAt` | `string` | 更新时间，ISO 字符串 |
| `version` | `number` | 乐观锁版本 |

## 5. 接口

### 5.1 通知列表

`GET /pos/notifications`

#### Query

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `noticeType` | `business \| system` | 否 | 通知类型 |
| `readStatus` | `unread \| read \| archived` | 否 | 阅读状态 |
| `priority` | `low \| normal \| high \| critical` | 否 | 优先级 |
| `relatedType` | `ticket \| order` | 否 | 关联对象类型 |
| `q` | `string` | 否 | 按标题、内容、关联 ID 搜索 |
| `limit` | `number` | 否 | 每页数量，默认 50 |
| `offset` | `number` | 否 | 偏移量，默认 0 |

#### Response 200

```json
{
  "data": [
    {
      "id": "01J...",
      "notificationId": "01J...",
      "tenantId": "01J...",
      "noticeType": "business",
      "readStatus": "unread",
      "priority": "normal",
      "title": "订单已创建",
      "content": "订单 OD-00000001 已创建。",
      "relatedType": "order",
      "relatedId": "01J...",
      "senderType": "system",
      "senderId": null,
      "sentAt": "2026-06-29T08:00:00.000Z",
      "readAt": null,
      "createdAt": "2026-06-29T08:00:00.000Z",
      "updatedAt": "2026-06-29T08:00:00.000Z",
      "version": 1
    }
  ],
  "total": 1
}
```

#### 排序

后端固定按 `notification_deliveries.created_at desc` 返回。前端按今天、昨天、更早做展示分组。

### 5.2 通知概览

`GET /pos/notifications/overview`

#### Response 200

```json
{
  "unreadCount": 3,
  "urgentUnreadCount": 1,
  "businessCount": 5,
  "systemCount": 2
}
```

### 5.3 标记单条已读

`PATCH /pos/notifications/{deliveryId}/read`

#### Path

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `deliveryId` | `string` | 是 | `notification_deliveries.id` |

#### Body

无业务字段。客户端发送空对象。

```json
{}
```

#### Response 200

返回更新后的 `PosNotificationInboxItem`。

#### 业务规则

- 只能操作当前登录用户的 POS 投递记录。
- `unread` 可更新为 `read`。
- `read` 重复标记已读保持幂等。
- `archived` 不允许标记已读。

### 5.4 全部标记已读

`PATCH /pos/notifications/read-all`

#### Body

无业务字段。客户端发送空对象。

```json
{}
```

#### Response 200

```json
{
  "updated": 3
}
```

#### 业务规则

- 仅更新当前登录用户、当前租户、POS channel、sent 状态的未读投递记录。
- 已归档记录不会被更新。

### 5.5 归档单条通知

`PATCH /pos/notifications/{deliveryId}/archive`

#### Path

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `deliveryId` | `string` | 是 | `notification_deliveries.id` |

#### Body

无业务字段。客户端发送空对象。

```json
{}
```

#### Response 200

返回更新后的 `PosNotificationInboxItem`。

#### 业务规则

- 只能操作当前登录用户的 POS 投递记录。
- `unread`、`read` 可更新为 `archived`。
- 归档时若 `read_at` 为空，后端自动写入当前时间。
- `archived` 归档后默认列表不再显示。

## 6. 错误码

| HTTP 状态 | code | 说明 |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | 参数校验失败 |
| `404` | `NOTIFICATION_NOT_FOUND` | 通知投递不存在或无权访问 |
| `422` | `NOTIFICATION_ARCHIVED` | 已归档通知不允许执行该操作 |

## 7. 内部投递服务

本期提供内部 service：`createPosNotificationDelivery(input)`，供工单、订单等业务事件调用。该能力不是 HTTP 接口，不对 POS 前端直接开放。

内部投递服务写入：

- `notifications`: 通知标题、内容、类型、关联对象、payload、幂等键。
- `notification_deliveries`: POS channel、用户收件人、发送状态、阅读状态、优先级。

若传入 `idempotencyKey`，后端会复用同租户下已有通知内容，并避免为同一用户重复创建同一 POS 投递。

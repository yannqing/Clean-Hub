# Clean Hub POS Orders API（订单管理）

> 版本：v0.1
> 子系统：pos
> 后端模块：`apps/api/src/modules/pos/orders/`
> API Client：`packages/api-client/src/pos/orders.ts`
> 路由前缀：`/pos/orders`，挂载于 `apps/api/src/modules/pos/pos.routes.ts`

## 1. 通用约定

| 项 | 约定 |
| --- | --- |
| Base URL | 本地开发：`http://localhost:4000` |
| 请求体 / 响应体 | `application/json; charset=utf-8` |
| 鉴权 | `/pos/**` 需要登录态 Cookie，请求需带 `credentials: "include"` |
| ID | 26 位 ULID 字符串，正则 `^[0-9A-HJKMNP-TV-Z]{26}$` |
| 金额 | 字符串，最多 2 位小数，例如 `"12.50"` |
| 数量 | 字符串，最多 3 位小数，例如 `"2"`、`"1.500"` |
| 时间 | ISO 8601 字符串，例如 `"2026-06-22T08:30:00.000Z"` |
| 分页 | `limit` 默认 50，最大 100；`offset` 默认 0 |
| 乐观锁 | 修改订单、状态、条目时必须提交当前 `version` |
| 数据隔离 | 后端强制 `tenant_id` 隔离；门店数据通过 `branch_id` 做 POS 权限校验 |
| 删除 | 删除订单和条目均为软删除 |
| 审计 | 创建、修改、删除、状态流转、收款、条目增删改均写 audit log |

## 2. 枚举

### 2.1 订单类型 `orderType`

```text
manual | ticket
```

### 2.2 订单状态 `status`

```text
draft | received | paid | delivered | cancelled
```

状态流转规则：

```text
draft    -> received | cancelled
received -> cancelled
paid     -> delivered
delivered、cancelled 为终态
```

说明：

- `paid` 状态由成功支付流水累加后自动计算，不能通过状态接口手动设置。
- `delivered` 必须在订单已结清后才能流转。
- 已支付订单不能取消。

### 2.3 支付状态 `paymentStatus`

```text
unpaid | partial | paid | refunded
```

说明：

- `paymentStatus` 由 `payment_transactions` 中成功流水累加计算，不应直接手改。
- 当前实现支持 `unpaid`、`partial`、`paid`；退款本期未接入。

### 2.4 订单条目来源 `sourceType`

```text
ticket_item | subscription | delivery_fee | product
```

手工新增条目仅允许：

```text
subscription | delivery_fee | product
```

### 2.5 支付方式 `paymentMethod`

```text
cash | card | app
```

当前里程碑仅支持 `cash` 收款；提交 `card` 或 `app` 会返回 `PAYMENT_NOT_SUPPORTED`。

### 2.6 概览周期 `period`

```text
all | today | week | month
```

## 3. 数据结构

### 3.1 PosOrderSummary

```jsonc
{
  "id": "01K00000000000000000000000",
  "tenantId": "01K00000000000000000000001",
  "branchId": "01K00000000000000000000002",
  "customerId": "01K00000000000000000000003",
  "customerName": "张小明",
  "orderType": "manual",
  "status": "received",
  "totalAmount": "80.00",
  "paymentStatus": "unpaid",
  "paidAmount": "0.00",
  "paidAt": null,
  "expireAt": "2026-06-30T15:59:59.000Z",
  "notes": "客户要求加急",
  "itemCount": 2,
  "createdAt": "2026-06-22T08:30:00.000Z",
  "updatedAt": "2026-06-22T08:30:00.000Z",
  "version": 1
}
```

### 3.2 PosOrderDetail

`PosOrderDetail = PosOrderSummary + items`

```jsonc
{
  "...": "PosOrderSummary fields",
  "items": [
    {
      "id": "01K00000000000000000000004",
      "orderId": "01K00000000000000000000000",
      "ticketId": null,
      "sourceType": "product",
      "sourceId": "01K00000000000000000000005",
      "itemName": "洗衣服务",
      "quantity": "2",
      "unitAmount": "40.00",
      "lineAmount": "80.00",
      "createdAt": "2026-06-22T08:30:00.000Z",
      "updatedAt": "2026-06-22T08:30:00.000Z",
      "version": 1
    }
  ]
}
```

### 3.3 PosPaymentTransaction

```jsonc
{
  "id": "01K00000000000000000000006",
  "orderId": "01K00000000000000000000000",
  "paymentMethod": "cash",
  "amount": "80.00",
  "paymentStatus": "paid",
  "paidAt": "2026-06-22T09:10:00.000Z",
  "createdAt": "2026-06-22T09:10:00.000Z"
}
```

### 3.4 PosOrderOverview

```jsonc
{
  "tenantId": "01K00000000000000000000001",
  "branchId": null,
  "period": "today",
  "orderCount": 8,
  "totalAmount": "240.00",
  "paidAmount": "92.00",
  "unpaidCount": 4,
  "partialCount": 1,
  "paidCount": 3,
  "deliveredCount": 2,
  "cancelledCount": 0,
  "paymentMethods": [
    {
      "method": "cash",
      "amount": "92.00",
      "count": 3
    }
  ]
}
```

## 4. 错误响应

模块内业务错误响应格式：

```json
{
  "message": "Order was not found.",
  "code": "ORDER_NOT_FOUND",
  "requestId": "01K00000000000000000000007"
}
```

| code | HTTP | 说明 |
| --- | --- | --- |
| `ORDER_NOT_FOUND` | 404 | 订单不存在、已删除或跨租户 |
| `ORDER_ITEM_NOT_FOUND` | 404 | 订单条目不存在或已删除 |
| `PAYMENT_NOT_SUPPORTED` | 422 | 当前里程碑不支持该支付方式 |
| `CUSTOMER_NOT_FOUND` | 404 | 客户档案不存在或已删除 |
| `CUSTOMER_DISABLED` | 422 | 客户档案已停用，不能创建订单 |
| `SERVICE_TICKET_NOT_FOUND` | 404 | 工单不存在或已删除 |
| `SERVICE_TICKET_EMPTY` | 422 | 工单没有可用于创建订单的条目 |
| `TICKET_ITEM_ALREADY_ORDERED` | 409 | 工单条目已经关联到订单 |
| `INVALID_STATUS_TRANSITION` | 422 | 非法订单状态流转 |
| `ORDER_ALREADY_PAID` | 422 | 已支付订单不能编辑、重复收款或取消 |
| `ORDER_NOT_PAID` | 422 | 未结清订单不能交付 |
| `ORDER_CANNOT_BE_DELETED` | 422 | 当前订单状态不允许删除 |
| `VERSION_CONFLICT` | 409 | 乐观锁版本冲突，需要刷新后重试 |
| `VALIDATION_ERROR` | 422 | 业务校验失败；Zod 参数错误由全局错误处理返回 |

鉴权和门店权限错误走全局 AuthError，常见为 `401`、`403`。

## 5. 接口清单

### 5.1 查询订单列表

```http
GET /pos/orders
```

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `status` | enum 或 enum[] | 否 | 订单状态；支持重复 query |
| `paymentStatus` | enum | 否 | 支付状态 |
| `orderType` | enum | 否 | `manual` 或 `ticket` |
| `customerId` | ULID | 否 | 客户档案 ID |
| `branchId` | ULID | 否 | 门店 ID |
| `q` | string | 否 | 模糊搜索订单 ID、客户姓名，1-120 字符 |
| `createdAfter` | ISO datetime | 否 | 创建时间下限，包含 |
| `createdBefore` | ISO datetime | 否 | 创建时间上限，不包含 |
| `limit` | int | 否 | 默认 50，范围 1-100 |
| `offset` | int | 否 | 默认 0 |

请求示例：

```http
GET /pos/orders?paymentStatus=unpaid&orderType=manual&limit=20&offset=0
Cookie: cleanhub_access=...
```

响应 `200 OK`：

```jsonc
{
  "data": [
    {
      "...": "PosOrderSummary"
    }
  ],
  "total": 8
}
```

权限与隔离：

- 强制当前租户。
- `cashier` 仅能看到自己授权门店。
- `owner`、`manager` 根据当前 POS 上下文和 `branchIds` 范围过滤。
- 若传 `branchId`，后端会校验当前用户是否有该门店权限。

### 5.2 创建订单

```http
POST /pos/orders
```

支持两种创建方式：手工订单 `manual`、工单订单 `ticket`。

#### 5.2.1 创建手工订单

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderType` | `"manual"` | 是 | 固定为 `manual` |
| `branchId` | ULID | 是 | 门店 ID |
| `customerId` | ULID | 是 | 客户档案 ID |
| `items` | array | 是 | 订单条目，1-100 条 |
| `items[].sourceType` | enum | 是 | `subscription`、`delivery_fee`、`product` |
| `items[].sourceId` | ULID | 是 | 来源对象 ID |
| `items[].itemName` | string | 是 | 1-200 字符 |
| `items[].quantity` | decimal string | 是 | 大于 0，最多 3 位小数 |
| `items[].unitAmount` | money string | 是 | 大于 0，最多 2 位小数 |
| `expireAt` | ISO datetime 或 null | 否 | 过期时间 |
| `notes` | string 或 null | 否 | 备注，最多 2000 字符 |

请求示例：

```json
{
  "orderType": "manual",
  "branchId": "01K00000000000000000000002",
  "customerId": "01K00000000000000000000003",
  "items": [
    {
      "sourceType": "product",
      "sourceId": "01K00000000000000000000005",
      "itemName": "洗衣服务",
      "quantity": "2",
      "unitAmount": "40.00"
    }
  ],
  "expireAt": "2026-06-30T15:59:59.000Z",
  "notes": "客户要求加急"
}
```

响应 `201 Created`：

```jsonc
{
  "...": "PosOrderDetail"
}
```

业务规则：

- 客户档案必须存在且 `status = active`。
- 用户必须有 `branchId` 对应门店权限。
- `totalAmount` 由条目 `quantity * unitAmount` 累加计算。
- 初始 `paymentStatus = unpaid`，`paidAmount = 0`。
- 手工订单创建后状态为 `received`。

#### 5.2.2 从工单创建订单

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderType` | `"ticket"` | 是 | 固定为 `ticket` |
| `ticketId` | ULID | 是 | 服务工单 ID |
| `ticketItemIds` | ULID[] | 否 | 指定工单条目；不传则使用该工单全部有效条目 |
| `expireAt` | ISO datetime 或 null | 否 | 过期时间 |
| `notes` | string 或 null | 否 | 备注，最多 2000 字符 |

请求示例：

```json
{
  "orderType": "ticket",
  "ticketId": "01K00000000000000000000008",
  "ticketItemIds": ["01K00000000000000000000009"],
  "expireAt": null,
  "notes": "从工单生成订单"
}
```

响应 `201 Created`：

```jsonc
{
  "...": "PosOrderDetail"
}
```

业务规则：

- 工单必须存在且未删除。
- 用户必须有工单所属门店权限。
- 工单客户必须存在且 `status = active`。
- 工单条目不能为空；指定 `ticketItemIds` 时必须全部找到。
- 同一工单条目不能重复生成订单，否则返回 `TICKET_ITEM_ALREADY_ORDERED`。
- `order_items.sourceType` 自动写为 `ticket_item`，`sourceId` 为 `ticket_items.id`。

### 5.3 查询订单概览

```http
GET /pos/orders/overview
```

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `period` | enum | 否 | `all`、`today`、`week`、`month`；默认 `today` |
| `branchId` | ULID | 否 | 指定门店概览 |

请求示例：

```http
GET /pos/orders/overview?period=month
Cookie: cleanhub_access=...
```

响应 `200 OK`：

```jsonc
{
  "...": "PosOrderOverview"
}
```

统计口径：

- `orderCount`、`totalAmount`、各状态数量来自 `orders`。
- `paidAmount`、`paymentMethods` 来自 `payment_transactions` 中 `paymentStatus = paid` 的流水。
- `period=all` 不加时间过滤。
- `period=today` 从 UTC 当日 00:00 开始。
- `period=week` 从 UTC 今日往前 6 天开始。
- `period=month` 从 UTC 当月 1 日 00:00 开始。

### 5.4 查询订单详情

```http
GET /pos/orders/{orderId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderId` | ULID | 是 | 订单 ID |

响应 `200 OK`：

```jsonc
{
  "...": "PosOrderDetail"
}
```

错误：

- `ORDER_NOT_FOUND`：订单不存在、已删除或跨租户。
- 403：当前用户无订单所属门店权限。

### 5.5 修改订单基本信息

```http
PATCH /pos/orders/{orderId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderId` | ULID | 是 | 订单 ID |

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderType` | enum | 否 | `manual` 或 `ticket` |
| `expireAt` | ISO datetime 或 null | 否 | 过期时间 |
| `notes` | string 或 null | 否 | 备注，最多 2000 字符 |
| `version` | int | 是 | 当前订单版本 |

请求示例：

```json
{
  "expireAt": "2026-07-01T15:59:59.000Z",
  "notes": "客户改为次日取件",
  "version": 1
}
```

响应 `200 OK`：

```jsonc
{
  "...": "PosOrderDetail"
}
```

业务规则：

- 至少提交 `orderType`、`expireAt`、`notes` 中一个字段。
- 已支付、有成功收款、已交付、已取消订单不能编辑。
- `version` 不匹配返回 `VERSION_CONFLICT`。

### 5.6 删除订单

```http
DELETE /pos/orders/{orderId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderId` | ULID | 是 | 订单 ID |

响应：

```http
204 No Content
```

业务规则：

- 仅允许删除 `draft`、`received`、`cancelled` 且 `paidAmount = 0` 的订单。
- 删除为软删除，写入 `deletedAt`、`deletedBy`。
- 不符合条件返回 `ORDER_CANNOT_BE_DELETED`。

### 5.7 修改订单状态

```http
POST /pos/orders/{orderId}/status-changes
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderId` | ULID | 是 | 订单 ID |

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `to` | enum | 是 | 目标状态 |
| `note` | string | 否 | 状态变更备注，最多 2000 字符 |
| `version` | int | 是 | 当前订单版本 |

请求示例：

```json
{
  "to": "delivered",
  "note": "客户已取件",
  "version": 3
}
```

响应 `200 OK`：

```jsonc
{
  "...": "PosOrderDetail"
}
```

业务规则：

- 不能通过此接口切回 `draft`。
- 不能通过此接口设置 `paid`，该状态由支付流水自动计算。
- `draft -> received | cancelled`。
- `received -> cancelled`。
- `paid -> delivered`。
- `delivered`、`cancelled` 为终态。
- `delivered` 要求 `paymentStatus = paid`。
- `cancelled` 要求 `paidAmount = 0`。

### 5.8 查询订单支付流水

```http
GET /pos/orders/{orderId}/payments
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderId` | ULID | 是 | 订单 ID |

响应 `200 OK`：

```jsonc
{
  "data": [
    {
      "...": "PosPaymentTransaction"
    }
  ]
}
```

业务规则：

- 订单必须存在且当前用户有订单所属门店权限。
- 只返回未软删除的支付流水。
- 按 `createdAt` 倒序返回。

### 5.9 创建订单支付流水（收款）

```http
POST /pos/orders/{orderId}/payments
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderId` | ULID | 是 | 订单 ID |

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `paymentMethod` | enum | 是 | 当前仅支持 `cash` |
| `amount` | money string | 是 | 本次收款金额，大于 0 |

请求示例：

```json
{
  "paymentMethod": "cash",
  "amount": "80.00"
}
```

响应 `201 Created`：

```jsonc
{
  "...": "PosOrderDetail"
}
```

业务规则：

- 当前仅支持现金收款，非 `cash` 返回 `PAYMENT_NOT_SUPPORTED`。
- `cancelled`、`delivered` 订单不能收款。
- 已结清订单不能重复收款。
- 本次收款后累计 `paidAmount` 不能超过 `totalAmount`。
- 写入 `payment_transactions` 后重新计算订单 `paidAmount`、`paidAt`、`paymentStatus`。
- 当累计收款达到订单总额时，订单 `paymentStatus` 变为 `paid`，订单 `status` 自动变为 `paid`。
- 订单行在事务中加 `FOR UPDATE` 锁，避免并发超收。

### 5.10 新增订单条目

```http
POST /pos/orders/{orderId}/items
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderId` | ULID | 是 | 订单 ID |

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `sourceType` | enum | 是 | `subscription`、`delivery_fee`、`product` |
| `sourceId` | ULID | 是 | 来源对象 ID |
| `itemName` | string | 是 | 1-200 字符 |
| `quantity` | decimal string | 是 | 大于 0，最多 3 位小数 |
| `unitAmount` | money string | 是 | 大于 0，最多 2 位小数 |

请求示例：

```json
{
  "sourceType": "product",
  "sourceId": "01K00000000000000000000005",
  "itemName": "配送费",
  "quantity": "1",
  "unitAmount": "5.00"
}
```

响应 `201 Created`：

```jsonc
{
  "...": "PosOrderDetail"
}
```

业务规则：

- 已有成功收款、`paid`、`delivered`、`cancelled` 订单不能新增条目。
- 新增后重新计算 `orders.totalAmount`。
- 新增后重新计算支付状态。

### 5.11 修改订单条目

```http
PATCH /pos/orders/{orderId}/items/{itemId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderId` | ULID | 是 | 订单 ID |
| `itemId` | ULID | 是 | 订单条目 ID |

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `itemName` | string | 否 | 1-200 字符 |
| `quantity` | decimal string | 否 | 大于 0，最多 3 位小数 |
| `unitAmount` | money string | 否 | 大于 0，最多 2 位小数 |
| `version` | int | 是 | 当前条目版本 |

请求示例：

```json
{
  "quantity": "3",
  "unitAmount": "40.00",
  "version": 1
}
```

响应 `200 OK`：

```jsonc
{
  "...": "PosOrderDetail"
}
```

业务规则：

- 至少提交 `itemName`、`quantity`、`unitAmount` 中一个字段。
- 已有成功收款、`paid`、`delivered`、`cancelled` 订单不能修改条目。
- `lineAmount` 由 `quantity * unitAmount` 重新计算。
- 修改后重新计算订单总额和支付状态。
- `version` 不匹配返回 `VERSION_CONFLICT`。

### 5.12 删除订单条目

```http
DELETE /pos/orders/{orderId}/items/{itemId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `orderId` | ULID | 是 | 订单 ID |
| `itemId` | ULID | 是 | 订单条目 ID |

响应 `200 OK`：

```jsonc
{
  "...": "PosOrderDetail"
}
```

业务规则：

- 已有成功收款、`paid`、`delivered`、`cancelled` 订单不能删除条目。
- 删除为软删除，写入 `deletedAt`、`deletedBy`。
- 删除后重新计算订单总额和支付状态。

## 6. API Client 调用入口

`packages/api-client/src/pos/orders.ts` 暴露：

| 方法 | HTTP |
| --- | --- |
| `posApi.pos.orders.list(query, options)` | `GET /pos/orders` |
| `posApi.pos.orders.overview(query, options)` | `GET /pos/orders/overview` |
| `posApi.pos.orders.get(orderId, options)` | `GET /pos/orders/{orderId}` |
| `posApi.pos.orders.create(input, options)` | `POST /pos/orders` |
| `posApi.pos.orders.update(orderId, input, options)` | `PATCH /pos/orders/{orderId}` |
| `posApi.pos.orders.remove(orderId, options)` | `DELETE /pos/orders/{orderId}` |
| `posApi.pos.orders.changeStatus(orderId, input, options)` | `POST /pos/orders/{orderId}/status-changes` |
| `posApi.pos.orders.listPayments(orderId, options)` | `GET /pos/orders/{orderId}/payments` |
| `posApi.pos.orders.pay(orderId, input, options)` | `POST /pos/orders/{orderId}/payments` |
| `posApi.pos.orders.createItem(orderId, input, options)` | `POST /pos/orders/{orderId}/items` |
| `posApi.pos.orders.updateItem(orderId, itemId, input, options)` | `PATCH /pos/orders/{orderId}/items/{itemId}` |
| `posApi.pos.orders.deleteItem(orderId, itemId, options)` | `DELETE /pos/orders/{orderId}/items/{itemId}` |

POS 前端调用链必须保持：

```text
page/component -> features/orders/queries/actions -> apps/pos-web/src/lib/api-client.ts -> packages/api-client -> apps/api
```

页面和组件内不要直接散落 `fetch`。

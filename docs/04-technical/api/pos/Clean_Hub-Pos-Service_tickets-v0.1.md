# Clean Hub POS Service Tickets API（工单管理）

> 版本：v0.1
> 子系统：pos
> 模块：service-tickets（工单管理）
> 后端模块：`apps/api/src/modules/pos/service-tickets/`
> API Client：`packages/api-client/src/pos/service-tickets.ts`
> 路由前缀：`/pos/service-tickets`，挂载于 `apps/api/src/modules/pos/pos.routes.ts`

## 1. 通用约定

| 项 | 约定 |
| --- | --- |
| Base URL | 本地开发：`http://localhost:4000` |
| 请求体 / 响应体 | `application/json; charset=utf-8` |
| 鉴权 | `/pos/**` 需要登录态 Cookie，请求需带 `credentials: "include"`（双 token：access + refresh，存在 HttpOnly Cookie） |
| 请求追踪 | 响应头 `x-request-id`；错误体含 `requestId` |
| ID | 26 位 ULID 字符串，正则 `^[0-9A-HJKMNP-TV-Z]{26}$` |
| 金额 | 字符串（避免浮点丢失），最多 2 位小数，例如 `"12.50"` |
| 数量 | 整数，范围 1–9999，例如 `1`、`3` |
| 时间 | ISO 8601 字符串（UTC），例如 `"2026-06-22T08:30:00.000Z"` |
| 分页 | `limit` 默认 50，最大 100；`offset` 默认 0 |
| 多值筛选 | query 重复传参，例 `?status=pending&status=in_progress` |
| 乐观锁 | 修改工单状态时必须提交当前 `version` |
| 数据隔离 | 后端强制 `tenant_id` 隔离；门店数据通过 `branch_id` 做 POS 权限校验；所有查询均带 `deleted_at IS NULL` 软删隔离 |
| 删除 | 删除工单和工单项目均为软删除 |
| 审计 | 创建、修改、删除、状态流转、项目增删改与状态变更均写 audit log（`eventCategory = pos_service_ticket`） |

## 2. 鉴权与权限

- 全部 `/pos/**` 路径强制登录态中间件，未登录返回 `401`。
- 仅允许 POS 角色：`owner` / `manager` / `cashier`（`assertPosContext`）。
- 分支隔离：
  - 写操作（创建 / 修改 / 删除 / 状态变更 / 项目增删改）调用 `requirePosBranchId(authContext, branchId)`：`owner` 不受限；`manager` / `cashier` 仅能操作其 `user_branches` 或 token 内 `branchIds` 内的分支，越权返回 `403`。
  - 列表查询：`cashier` 仅能看到自己绑定的门店；`owner` / `manager` 默认看全部门店（除非 token 显式带 `branchIds`）。
- 业务线开关：`ticketType` 对应租户 feature flag，需 `requireFeatureEnabled`：
  - `laundry` → `laundry`
  - `car_wash` → `car_wash`
  - `retail` → `retail`
  - `delivery` → `delivery`
- 停用客户拦截：创建工单时若 `customers.status != 'active'` 返回 `CUSTOMER_DISABLED` (422)。

## 3. 枚举与状态机

### 3.1 工单类型 `ticketType`（复用 `business_line` 枚举）

```text
laundry | car_wash | retail | delivery
```

### 3.2 工单状态 `ticketStatus`

```text
draft | pending | in_progress | ready_to_pick | picked_up | cancelled | exception
```

新建工单初始状态恒为 `draft`。

工单状态流转规则：

```text
draft         -> pending | cancelled
pending       -> in_progress | cancelled
in_progress   -> ready_to_pick | exception
ready_to_pick -> picked_up | exception   <- picked_up 须校验关联订单已结算
exception     -> in_progress | cancelled
picked_up     -> （终态）
cancelled     -> （终态）
```

> `ready_to_pick -> picked_up` 触发结算校验，调用 `areLinkedOrdersSettled`：要求所有关联订单 `payment_status = 'paid'`。若工单尚无关联订单，视为无未结算义务，允许取件。

### 3.3 工单优先级 `priority`

```text
normal | urgent | critical   （默认 normal）
```

### 3.4 来源渠道 `sourceChannel`

```text
pos | app | phone | whatsapp   （默认 pos）
```

### 3.5 工单项目类型 `itemType`

```text
cloth | car | shoe | carpet   （可空）
```

### 3.6 工单项目状态 `itemStatus`

```text
pending_wash | washing | done | ready_to_pick | exception
```

新建工单项目初始状态为 `pending_wash`。

项目状态流转规则：

```text
pending_wash  -> washing
washing       -> done | exception
done          -> ready_to_pick | washing   <- washing 为返工
exception     -> washing                   <- retry
ready_to_pick -> （终态）
```

### 3.7 `ticketNo` / `labelCode` 生成规则

- `ticketNo`：`TK-YYMMDD-{当日分支序号:04d}`，例 `TK-260622-0007`。租户内唯一（`unique(tenant_id, ticket_no)`）。序号为该分支当日已创建工单数 +1，在调用方事务内 `count(*)` 计算并由唯一索引兜底并发。
- `labelCode`：`{ticketNo}-{工单内项目序号:03d}`，例 `TK-260622-0007-003`。租户内唯一（`unique(tenant_id, label_code)`）。序号为该工单内未软删项目数 +1。创建项目时会对父工单加 `FOR UPDATE` 行锁，保证序号串行。

## 4. 错误响应

模块内业务错误（`ServiceTicketError`）响应格式：

```json
{
  "message": "Service ticket was not found.",
  "code": "SERVICE_TICKET_NOT_FOUND",
  "requestId": "01K00000000000000000000009"
}
```

| code | HTTP | 说明 |
| --- | --- | --- |
| `SERVICE_TICKET_NOT_FOUND` | 404 | 工单不存在、已删除或跨租户 |
| `SERVICE_TICKET_ITEM_NOT_FOUND` | 404 | 工单项目不存在或已删除 |
| `INVALID_STATUS_TRANSITION` | 422 | 工单状态流转非法 |
| `INVALID_ITEM_STATUS_TRANSITION` | 422 | 项目状态流转非法 |
| `CUSTOMER_NOT_FOUND` | 404 | 客户档案不存在或已删除 |
| `CUSTOMER_DISABLED` | 422 | 客户档案已停用，不能创建工单 |
| `PICKUP_REQUIRES_SETTLEMENT` | 422 | 取件前关联订单未结清 |
| `VERSION_CONFLICT` | 409 | 乐观锁版本不匹配，需刷新后重试 |
| `VALIDATION_ERROR` | 422 | 业务校验失败；Zod 参数错误由全局错误处理返回 |

鉴权与门店权限错误走全局 `AuthError`，常见为 `401`（未登录）与 `403`（无门店权限）；租户未开通业务线时由权限校验返回 `403`。

## 5. 数据结构

### 5.1 ServiceTicketSummary（列表行）

```jsonc
{
  "id": "01K00000000000000000000010",
  "tenantId": "01K00000000000000000000001",
  "branchId": "01K00000000000000000000002",
  "customerId": "01K00000000000000000000003",
  "customerName": "张小明",
  "assistantId": "01K00000000000000000000004",
  "ticketNo": "TK-260622-0007",
  "ticketType": "laundry",
  "ticketStatus": "pending",
  "priority": "normal",
  "sourceChannel": "pos",
  "expectedPickupAt": "2026-06-24T10:00:00.000Z",
  "completedAt": null,
  "cancelledAt": null,
  "itemCount": 2,
  "totalAmount": "80.00",
  "createdAt": "2026-06-22T08:30:00.000Z",
  "updatedAt": "2026-06-22T08:30:00.000Z",
  "version": 1
}
```

> `itemCount`、`totalAmount` 由子查询实时计算（未软删项目数、未软删项目 `lineAmount` 之和）。

### 5.2 ServiceTicketDetail

`ServiceTicketDetail = ServiceTicketSummary + remark + items`

```jsonc
{
  "...": "ServiceTicketSummary 字段",
  "remark": "客户要求无接触取件",
  "items": [
    {
      "id": "01K00000000000000000000011",
      "ticketId": "01K00000000000000000000010",
      "itemType": "cloth",
      "itemName": "西装",
      "itemCategory": "外套",
      "itemStatus": "pending_wash",
      "itemColor": "黑色",
      "itemBrand": "Armani",
      "itemMaterial": null,
      "quantity": 1,
      "unitAmount": "30.00",
      "lineAmount": "30.00",
      "serviceId": "01K00000000000000000000012",
      "labelCode": "TK-260622-0007-001",
      "defectNotes": "袖口有污渍",
      "specialRequest": null,
      "remark": null,
      "sortOrder": 0,
      "createdAt": "2026-06-22T08:31:00.000Z",
      "updatedAt": "2026-06-22T08:31:00.000Z",
      "version": 1
    }
  ]
}
```

> `items` 按 `sortOrder` 升序、再按 `createdAt` 升序返回，**不含**关联订单信息（订单需另调 6.8）。

### 6.3 ServiceTicketOverview

```jsonc
{
  "tenantId": "01K00000000000000000000001",
  "branchId": "01K00000000000000000000002",
  "byStatus": {
    "draft": 3,
    "pending": 5,
    "in_progress": 2,
    "ready_to_pick": 1
  },
  "overdueCount": 2,
  "todayCreatedCount": 8,
  "todayPickedUpCount": 4
}
```

统计口径：

- `byStatus`：按 `ticketStatus` 分组的工单数。
- `overdueCount`：`ticketStatus IN (pending, in_progress, ready_to_pick)` 且 `expected_pickup_at <= now()`。
- `todayCreatedCount` / `todayPickedUpCount`：按 UTC 当日 00:00 切分；`todayPickedUpCount` 取 `ticketStatus = picked_up` 且 `completed_at` 在今日的工单。

### 6.4 RelatedOrderSummary（关联订单行）

```jsonc
{
  "id": "01K00000000000000000000013",
  "orderType": "ticket",
  "status": "paid",
  "paymentStatus": "paid",
  "totalAmount": "80.00",
  "paidAmount": "80.00",
  "createdAt": "2026-06-22T08:35:00.000Z"
}
```

## 6. 接口清单

> 路由声明顺序敏感：`/overview`、`/:ticketId/orders`、`/:ticketId/items`、`/:ticketId/status-changes` 等具体路径先于通用 `/:ticketId` 注册（见 `service-tickets.routes.ts`）。

### 6.1 查询工单列表

```http
GET /pos/service-tickets
```

Query 参数（均可选）：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `status` | enum 或 enum[]（可重复） | 按工单状态过滤 |
| `priority` | enum | 按优先级 |
| `ticketType` | enum | 按业务线 |
| `sourceChannel` | enum | 按来源渠道 |
| `customerId` | ULID | 按客户档案 |
| `branchId` | ULID | 按门店（后端校验该门店权限） |
| `assistantId` | ULID | 按接待店员 |
| `q` | string | 模糊搜索 `ticketNo` / 客户姓名，1-120 字符 |
| `expectedPickupBefore` | ISO datetime | `expected_pickup_at <=` |
| `expectedPickupAfter` | ISO datetime | `expected_pickup_at >` |
| `limit` | int | 默认 50，范围 1-100 |
| `offset` | int | 默认 0 |

请求示例：

```http
GET /pos/service-tickets?status=pending&status=in_progress&ticketType=laundry&limit=20&offset=0
Cookie: cleanhub_access=...
```

响应 `200 OK`：

```jsonc
{
  "data": [
    { "...": "ServiceTicketSummary" }
  ],
  "total": 8
}
```

权限与隔离：

- 强制当前租户，且 `deleted_at IS NULL`。
- `cashier` 仅能看到自己绑定的门店；`owner` / `manager` 默认看全部门店。
- 结果按 `createdAt` 倒序返回。

### 6.2 创建工单

```http
POST /pos/service-tickets
```

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `customerId` | ULID | 是 | 客户档案 ID |
| `branchId` | ULID | 是 | 门店 ID |
| `ticketType` | enum | 是 | 业务线 |
| `priority` | enum | 否 | 默认 `normal` |
| `sourceChannel` | enum | 否 | 默认 `pos` |
| `assistantId` | ULID 或 null | 否 | 接待店员 ID |
| `expectedPickupAt` | ISO datetime 或 null | 否 | 预计取件时间 |
| `remark` | string | 否 | 备注，最多 2000 字符 |

请求示例：

```json
{
  "customerId": "01K00000000000000000000003",
  "branchId": "01K00000000000000000000002",
  "ticketType": "laundry",
  "priority": "normal",
  "sourceChannel": "pos",
  "assistantId": "01K00000000000000000000004",
  "expectedPickupAt": "2026-06-24T10:00:00.000Z",
  "remark": "客户要求无接触取件"
}
```

响应 `201 Created`：

```jsonc
{
  "...": "ServiceTicketDetail（含空 items）"
}
```

业务规则：

- 用户必须有 `branchId` 对应门店权限。
- 客户档案必须存在且 `status = active`。
- 租户必须开通对应业务线 feature flag。
- 初始状态恒为 `draft`，自动生成 `ticketNo`。

可能错误：`CUSTOMER_NOT_FOUND` / `CUSTOMER_DISABLED` / `FEATURE_DISABLED` / 403 无门店权限 / `VALIDATION_ERROR`。

### 6.3 工单概览

```http
GET /pos/service-tickets/overview
```

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `branchId` | ULID | 否 | 指定门店概览（后端校验权限） |

请求示例：

```http
GET /pos/service-tickets/overview?branchId=01K00000000000000000000002
Cookie: cleanhub_access=...
```

响应 `200 OK`：

```jsonc
{
  "...": "ServiceTicketOverview"
}
```

### 6.4 查询工单详情

```http
GET /pos/service-tickets/{ticketId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketId` | ULID | 是 | 工单 ID |

响应 `200 OK`：

```jsonc
{
  "...": "ServiceTicketDetail（含 items，不含关联订单）"
}
```

错误：

- `SERVICE_TICKET_NOT_FOUND` (404)：工单不存在、已删除或跨租户。
- 403：当前用户无工单所属门店权限。

### 6.5 修改工单基本信息

```http
PATCH /pos/service-tickets/{ticketId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketId` | ULID | 是 | 工单 ID |

请求体（任意字段子集，不能含 `ticketStatus`）：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketType` | enum | 否 | 业务线 |
| `priority` | enum | 否 | 优先级 |
| `sourceChannel` | enum | 否 | 来源渠道 |
| `assistantId` | ULID 或 null | 否 | 接待店员 ID |
| `expectedPickupAt` | ISO datetime 或 null | 否 | 预计取件时间 |
| `remark` | string 或 null | 否 | 备注，最多 2000 字符 |

请求示例：

```json
{
  "priority": "urgent",
  "expectedPickupAt": "2026-06-25T10:00:00.000Z",
  "remark": "更新备注"
}
```

响应 `200 OK`：

```jsonc
{
  "...": "ServiceTicketDetail"
}
```

业务规则：

- 至少提交一个可改字段。
- 不能通过此接口修改 `ticketStatus`，状态走 6.7。
- 修改后 `version + 1`。
- 若改 `ticketType`，仍需对应业务线 feature flag 开通。

### 6.6 删除工单

```http
DELETE /pos/service-tickets/{ticketId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketId` | ULID | 是 | 工单 ID |

响应：

```http
204 No Content
```

业务规则：

- 软删除（置 `deletedAt` / `deletedBy`，`version + 1`）。
- 工单项目的软删不在此接口单独处理，删除工单后项目在列表查询中随工单一并不可见。
- 错误：`SERVICE_TICKET_NOT_FOUND` (404) / 403 无门店权限。

### 6.7 修改工单状态

```http
POST /pos/service-tickets/{ticketId}/status-changes
```

事件式端点（非 `PATCH /status`），支持乐观锁与备注。

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketId` | ULID | 是 | 工单 ID |

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `to` | enum | 是 | 目标状态 |
| `version` | int | 是 | 调用方读取工单时的 `version`，用于乐观锁 |
| `note` | string | 否 | 状态变更备注，最多 2000 字符，写入审计 `metadata.note` |

请求示例：

```json
{
  "to": "picked_up",
  "note": "客户已取走，订单已结清",
  "version": 3
}
```

响应 `200 OK`：

```jsonc
{
  "...": "ServiceTicketDetail（含新状态与新 version）"
}
```

业务规则：

- 必须满足工单状态机合法转移，否则 `INVALID_STATUS_TRANSITION` (422)。
- `ready_to_pick -> picked_up`：触发结算校验，未结清返回 `PICKUP_REQUIRES_SETTLEMENT` (422)。
- 状态变更自动写入时间戳：`picked_up` 写 `completedAt`；`cancelled` 写 `cancelledAt`。
- `version` 不匹配返回 `VERSION_CONFLICT` (409)，需刷新重试。

### 6.8 关联订单查询

```http
GET /pos/service-tickets/{ticketId}/orders
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketId` | ULID | 是 | 工单 ID |

响应 `200 OK`：

```jsonc
{
  "data": [
    { "...": "RelatedOrderSummary" }
  ]
}
```

业务规则：

- 通过 `order_items.ticket_id` 反查关联订单（去重）。
- 按 `createdAt` 倒序返回。
- 错误：`SERVICE_TICKET_NOT_FOUND` (404) / 403 无门店权限。

### 6.9 新增工单项目

```http
POST /pos/service-tickets/{ticketId}/items
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketId` | ULID | 是 | 工单 ID |

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `itemName` | string | 是 | 名称，1-200 字符 |
| `itemType` | enum | 否 | 类型 |
| `itemCategory` | string | 否 | 分类，最多 80 字符 |
| `itemColor` | string | 否 | 颜色，最多 40 字符 |
| `itemBrand` | string | 否 | 品牌，最多 80 字符 |
| `itemMaterial` | string | 否 | 材质，最多 80 字符 |
| `quantity` | int | 否 | 数量，1-9999，默认 1 |
| `unitAmount` | money string | 是 | 单价，最多 2 位小数 |
| `serviceId` | ULID 或 null | 否 | 关联服务 ID |
| `defectNotes` | string | 否 | 瑕疵，最多 2000 字符 |
| `specialRequest` | string | 否 | 特殊要求，最多 2000 字符 |
| `remark` | string | 否 | 备注，最多 2000 字符 |
| `sortOrder` | int | 否 | 排序，0-99999，默认 0 |

请求示例：

```json
{
  "itemName": "西装",
  "itemType": "cloth",
  "itemCategory": "外套",
  "itemColor": "黑色",
  "itemBrand": "Armani",
  "quantity": 1,
  "unitAmount": "30.00",
  "serviceId": "01K00000000000000000000012",
  "defectNotes": "袖口有污渍"
}
```

响应 `201 Created`：

```jsonc
{
  "...": "ServiceTicketItem"
}
```

业务规则：

- 自动生成 `labelCode`（租户内唯一）。
- 自动计算 `lineAmount = quantity × unitAmount`。
- 初始 `itemStatus = pending_wash`。
- 创建时对父工单加 `FOR UPDATE` 行锁，保证 `labelCode` 序号串行。
- 写入后自动 `service_tickets.version + 1`（父工单感知结构变化）。
- 错误：`SERVICE_TICKET_NOT_FOUND` (404) / `VALIDATION_ERROR` / 403 无门店权限。

### 6.10 修改工单项目

```http
PATCH /pos/service-tickets/{ticketId}/items/{itemId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketId` | ULID | 是 | 工单 ID |
| `itemId` | ULID | 是 | 工单项目 ID |

请求体（任意字段子集，不含 `itemStatus`）：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `itemName` | string | 否 | 1-200 字符 |
| `itemType` | enum | 否 | 类型 |
| `itemCategory` | string 或 null | 否 | 分类，最多 80 字符 |
| `itemColor` | string 或 null | 否 | 颜色，最多 40 字符 |
| `itemBrand` | string 或 null | 否 | 品牌，最多 80 字符 |
| `itemMaterial` | string 或 null | 否 | 材质，最多 80 字符 |
| `quantity` | int | 否 | 1-9999 |
| `unitAmount` | money string | 否 | 最多 2 位小数 |
| `serviceId` | ULID 或 null | 否 | 关联服务 ID |
| `defectNotes` | string 或 null | 否 | 瑕疵，最多 2000 字符 |
| `specialRequest` | string 或 null | 否 | 特殊要求，最多 2000 字符 |
| `remark` | string 或 null | 否 | 备注，最多 2000 字符 |
| `sortOrder` | int | 否 | 0-99999 |

请求示例：

```json
{
  "unitAmount": "35.00",
  "defectNotes": "袖口 + 领口污渍"
}
```

响应 `200 OK`：

```jsonc
{
  "...": "ServiceTicketItem"
}
```

业务规则：

- 至少提交一个可改字段。
- 不能通过此接口修改 `itemStatus`，状态走 6.11。
- 改 `quantity` 或 `unitAmount` 时自动重算 `lineAmount`。
- 修改后项目 `version + 1`。
- 错误：`SERVICE_TICKET_ITEM_NOT_FOUND` (404) / `VALIDATION_ERROR` / 403 无门店权限。

### 6.11 修改工单项目状态

```http
POST /pos/service-tickets/{ticketId}/items/{itemId}/status-changes
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketId` | ULID | 是 | 工单 ID |
| `itemId` | ULID | 是 | 工单项目 ID |

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `to` | enum | 是 | 目标项目状态 |

请求示例：

```json
{
  "to": "done"
}
```

响应 `200 OK`：

```jsonc
{
  "...": "ServiceTicketItem（含新状态）"
}
```

业务规则：

- 必须满足项目状态机合法转移，否则 `INVALID_ITEM_STATUS_TRANSITION` (422)。
- 修改后项目 `version + 1`。
- 错误：`SERVICE_TICKET_ITEM_NOT_FOUND` (404) / 403 无门店权限。

### 6.12 删除工单项目

```http
DELETE /pos/service-tickets/{ticketId}/items/{itemId}
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ticketId` | ULID | 是 | 工单 ID |
| `itemId` | ULID | 是 | 工单项目 ID |

响应：

```http
204 No Content
```

业务规则：

- 软删除（`deletedAt` / `deletedBy`，`version + 1`）。
- 删除后自动 `service_tickets.version + 1`（父工单感知结构变化）。
- 错误：`SERVICE_TICKET_ITEM_NOT_FOUND` (404) / 403 无门店权限。

## 7. API Client 调用入口

`packages/api-client/src/pos/service-tickets.ts` 通过 `createPosApi` 暴露为 `posApi.pos.serviceTickets` 命名空间：

| 方法 | HTTP |
| --- | --- |
| `posApi.pos.serviceTickets.list(query, options)` | `GET /pos/service-tickets` |
| `posApi.pos.serviceTickets.create(input, options)` | `POST /pos/service-tickets` |
| `posApi.pos.serviceTickets.getOverview(query, options)` | `GET /pos/service-tickets/overview` |
| `posApi.pos.serviceTickets.get(ticketId, options)` | `GET /pos/service-tickets/{ticketId}` |
| `posApi.pos.serviceTickets.update(ticketId, input, options)` | `PATCH /pos/service-tickets/{ticketId}` |
| `posApi.pos.serviceTickets.remove(ticketId, options)` | `DELETE /pos/service-tickets/{ticketId}` |
| `posApi.pos.serviceTickets.changeStatus(ticketId, input, options)` | `POST /pos/service-tickets/{ticketId}/status-changes` |
| `posApi.pos.serviceTickets.getRelatedOrders(ticketId, options)` | `GET /pos/service-tickets/{ticketId}/orders` |
| `posApi.pos.serviceTickets.createItem(ticketId, input, options)` | `POST /pos/service-tickets/{ticketId}/items` |
| `posApi.pos.serviceTickets.updateItem(ticketId, itemId, input, options)` | `PATCH /pos/service-tickets/{ticketId}/items/{itemId}` |
| `posApi.pos.serviceTickets.changeItemStatus(ticketId, itemId, input, options)` | `POST /pos/service-tickets/{ticketId}/items/{itemId}/status-changes` |
| `posApi.pos.serviceTickets.removeItem(ticketId, itemId, options)` | `DELETE /pos/service-tickets/{ticketId}/items/{itemId}` |

调用示例：

```ts
import { posApi } from "@/lib/api-client";

// 列表
const { data, total } = await posApi.pos.serviceTickets.list({
  status: ["pending", "in_progress"],
  ticketType: "laundry",
  limit: 20,
});

// 详情
const ticket = await posApi.pos.serviceTickets.get(ticketId);

// 创建
const created = await posApi.pos.serviceTickets.create({
  customerId,
  branchId,
  ticketType: "laundry",
  expectedPickupAt: "2026-06-24T10:00:00.000Z",
});

// 状态流转（带乐观锁）
const updated = await posApi.pos.serviceTickets.changeStatus(ticketId, {
  to: "picked_up",
  version: ticket.version,
  note: "客户已取走",
});

// 新增项目
const item = await posApi.pos.serviceTickets.createItem(ticketId, {
  itemName: "西装",
  itemType: "cloth",
  unitAmount: "30.00",
});

// 工作台概览
const overview = await posApi.pos.serviceTickets.getOverview({ branchId });
```

POS 前端调用链必须保持：

```text
page/component -> features/service-tickets/queries/actions -> apps/pos-web/src/lib/api-client.ts -> packages/api-client -> apps/api
```

页面和组件内不要直接散落 `fetch`。调用约定见 `docs/04-technical/api/Clean_Hub-API_Client使用说明.md`。

## 附：审计事件

所有写操作落 `audit_logs`，`eventCategory = pos_service_ticket`：

| eventType | 触发 | before / after |
| --- | --- | --- |
| `pos.service_ticket.created` | 创建工单 | after = ServiceTicketSummary |
| `pos.service_ticket.updated` | 修改基本信息 | before/after = ServiceTicketAuditSnapshot |
| `pos.service_ticket.status_changed` | 状态变更 | before/after = `{ ticketStatus }`，metadata.note |
| `pos.service_ticket.deleted` | 软删除 | before = audit snapshot，after = `{deleted:true}` |
| `pos.service_ticket.item_added` | 新增项目 | after = `{ itemId, labelCode }` |
| `pos.service_ticket.item_updated` | 改项目 | metadata.itemId |
| `pos.service_ticket.item_status_changed` | 项目状态变更 | before/after = `{ itemStatus }`，metadata.itemId |
| `pos.service_ticket.item_removed` | 软删项目 | metadata.itemId |

# Clean Hub — POS Service Tickets API（工单管理）

> 版本：v0.1
> 适配里程碑：第四次里程碑 · 客户接待 / 工单管理
> 后端模块：`apps/api/src/modules/pos/service-tickets/`
> 客户端模块：`packages/api-client/src/pos/service-tickets.ts`
> 路由前缀：`/pos/service-tickets`（挂载于 `apps/api/src/modules/pos/pos.routes.ts`）

## 目录

1. [通用约定](#1-通用约定)
2. [鉴权与权限](#2-鉴权与权限)
3. [枚举与状态机](#3-枚举与状态机)
4. [错误码](#4-错误码)
5. [接口清单](#5-接口清单)
   - [5.1 查询工单列表](#51-查询工单列表)
   - [5.2 创建工单](#52-创建工单)
   - [5.3 工单概览](#53-工单概览)
   - [5.4 查询工单详情](#54-查询工单详情)
   - [5.5 修改工单基本信息](#55-修改工单基本信息)
   - [5.6 删除工单](#56-删除工单)
   - [5.7 修改工单状态](#57-修改工单状态)
   - [5.8 关联订单查询](#58-关联订单查询)
   - [5.9 新增工单项目](#59-新增工单项目)
   - [5.10 修改工单项目](#510-修改工单项目)
   - [5.11 修改工单项目状态](#511-修改工单项目状态)
   - [5.12 删除工单项目](#512-删除工单项目)
6. [客户端用法](#6-客户端用法)

---

## 1. 通用约定

| 项 | 约定 |
| --- | --- |
| Base URL | 本地开发：`http://localhost:4000` |
| 请求体 / 响应体 | `application/json; charset=utf-8` |
| ID | 26 位 ULID 字符串（`^[0-9A-HJKMNP-TV-Z]{26}$`） |
| 金额 | 字符串（避免浮点丢失），最多 2 位小数，例 `"12.50"` |
| 时间 | ISO 8601 字符串（UTC），例 `"2026-06-22T08:30:00.000Z"` |
| 鉴权 | 双 token（access + refresh）存在 HttpOnly Cookie；请求带 `credentials: "include"` |
| 请求追踪 | 响应头 `x-request-id`；错误体含 `requestId` |
| 列表分页 | `limit`（默认 50，最大 100）+ `offset`（默认 0）；响应为 `{ "data": [...] }`，不返回 total |
| 多值筛选 | query 重复传参，例 `?status=pending&status=in_progress` |

## 2. 鉴权与权限

- 全部 `/pos/**` 路径强制 `createRequireAuthMiddleware`，未登录返回 401。
- 仅允许 POS 角色：`owner` / `manager` / `cashier`（`assertPosContext`）。
- 数据隔离：每个查询都强制 `tenant_id = 当前租户` 且 `deleted_at IS NULL`（软删隔离）。
- 分支隔离：
  - 写操作（创建 / 修改 / 删除 / 状态变更 / 项目增删改）调用 `requirePosBranchId(authContext, branchId)`：
    - `owner` 不受限；
    - `manager` / `cashier` 仅能操作其 `user_branches` 内或 token 内 `branchIds` 内的分支，越权返回 403。
  - 列表查询：`cashier` 只看到自己绑定的门店；`owner` / `manager` 默认看全部门店（除非 token 显式带 `branchIds`）。
- 业务线开关：`ticketType` 对应租户 feature flag，需 `requireFeatureEnabled`：
  - `laundry` → `laundryEnabled`
  - `car_wash` → `carWashEnabled`
  - `retail` → `retailProductsEnabled`
  - `delivery` → `deliveryEnabled`
- 停用客户拦截：创建工单时若 `customers.status != 'active'` 返回 `CUSTOMER_DISABLED` (422)。

## 3. 枚举与状态机

### 工单类型 `ticketType`（复用 `business_line` 枚举）
`laundry` | `car_wash` | `retail` | `delivery`

### 工单状态 `ticketStatus`
`draft` | `pending` | `in_progress` | `ready_to_pick` | `picked_up` | `cancelled` | `exception`

### 工单状态流转图
```
draft         → pending | cancelled
pending       → in_progress | cancelled
in_progress   → ready_to_pick | exception
ready_to_pick → picked_up | exception     ← picked_up 须校验关联订单已结算
exception     → in_progress | cancelled
picked_up     → （终态）
cancelled     → （终态）
```
> `ready_to_pick → picked_up` 由 `requiresSettlementCheck` 触发，调用 `areLinkedOrdersSettled`：要求所有关联订单 `payment_status IN ('paid', 'refunded')`。若工单尚无关联订单，视为无未结算义务，允许取件。

### 工单优先级 `priority`
`normal` | `urgent` | `critical`（默认 `normal`）

### 来源渠道 `sourceChannel`
`pos` | `app` | `phone` | `whatsapp`（默认 `pos`）

### 工单项目类型 `itemType`
`cloth` | `car` | `shoe` | `carpet`（可空）

### 工单项目状态 `itemStatus`
`washing` | `done` | `ready_to_pick`（默认 `washing`）

### 项目状态流转
```
washing       → done
done          → ready_to_pick | washing（返工）
ready_to_pick → （终态）
```

### `ticketNo` / `labelCode` 生成规则
- `ticketNo`：`TK-YYMMDD-{当日分支序号:04d}`，例 `TK-260622-0007`。租户内唯一（`unique(tenant_id, ticket_no)`）。
- `labelCode`：`{ticketNo}-{工单内项目序号:03d}`，例 `TK-260622-0007-003`。租户内唯一（`unique(tenant_id, label_code)`）。
- 序号在调用方事务内 `count(*)` 计算并通过唯一索引兜底；并发冲突由 `(tenant_id, ticket_no)` 索引保证。

## 4. 错误码

模块错误类 `ServiceTicketError`，由控制器捕获并按 `status` 序列化：

| code | HTTP | 说明 |
| --- | --- | --- |
| `SERVICE_TICKET_NOT_FOUND` | 404 | 工单不存在 / 已删除 / 跨租户 |
| `SERVICE_TICKET_ITEM_NOT_FOUND` | 404 | 工单项目不存在 |
| `INVALID_STATUS_TRANSITION` | 422 | 工单状态流转非法 |
| `INVALID_ITEM_STATUS_TRANSITION` | 422 | 项目状态流转非法 |
| `CUSTOMER_NOT_FOUND` | 404 | 客户档案不存在 |
| `CUSTOMER_DISABLED` | 422 | 客户已停用，不能新建工单 |
| `BRANCH_NOT_ALLOWED` | 403 | 无该门店权限（透传 AuthError `FORBIDDEN`） |
| `FEATURE_DISABLED` | 403 | 租户未开通该业务线 |
| `PICKUP_REQUIRES_SETTLEMENT` | 422 | 取件前关联订单未结清 |
| `VERSION_CONFLICT` | 409 | 乐观锁版本不匹配，需刷新重试 |
| `VALIDATION_ERROR` | 422 | 入参校验失败（Zod），含 `validationErrors` |

错误体示例：
```json
{
  "message": "Ticket cannot be picked up until all linked orders are paid.",
  "code": "PICKUP_REQUIRES_SETTLEMENT",
  "requestId": "01HXXXXXXXXXXXXXX"
}
```

> 鉴权 / 角色相关错误走全局 `AuthError`（401/403）。Zod 校验失败由全局处理器返回 422 `VALIDATION_ERROR` 并附 `validationErrors`。

---

## 5. 接口清单

### 数据结构

**ServiceTicketSummary**（列表行）
```jsonc
{
  "id": "01HXXXXXXXXXXXXXX",
  "tenantId": "01HYYYYYYYYYYYYYY",
  "branchId": "01HZZZZZZZZZZZZZZ",
  "customerId": "01HCCCCCCCCCCCCCC",
  "customerName": "张三",
  "assistantId": null,
  "ticketNo": "TK-260622-0007",
  "ticketType": "laundry",
  "ticketStatus": "pending",
  "priority": "normal",
  "sourceChannel": "pos",
  "expectedPickupAt": "2026-06-24T10:00:00.000Z",
  "completedAt": null,
  "cancelledAt": null,
  "itemCount": 2,
  "totalAmount": "45.00",
  "createdAt": "2026-06-22T08:30:00.000Z",
  "updatedAt": "2026-06-22T08:30:00.000Z",
  "version": 1
}
```

**ServiceTicketDetail = ServiceTicketSummary +**
```jsonc
{
  "remark": "客户要求无接触取件",
  "items": [
    {
      "id": "01HIIIIIIIIIIIIII",
      "ticketId": "01HXXXXXXXXXXXXXX",
      "itemType": "cloth",
      "itemName": "西装",
      "itemCategory": "外套",
      "itemStatus": "washing",
      "itemColor": "黑色",
      "itemBrand": "Armani",
      "itemMaterial": null,
      "quantity": 1,
      "unitAmount": "30.00",
      "lineAmount": "30.00",
      "serviceId": "01HSSSSSSSSSSSSSS",
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

---

### 5.1 查询工单列表

**`GET /pos/service-tickets`**

Query 参数（均可选）：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `status` | enum 或 enum[]（可重复） | 按工单状态过滤 |
| `priority` | enum | 按优先级 |
| `ticketType` | enum | 按业务线 |
| `sourceChannel` | enum | 按来源渠道 |
| `customerId` | ULID | 按客户档案 |
| `branchId` | ULID | 按门店 |
| `assistantId` | ULID | 按接待店员 |
| `q` | string | 模糊搜索 `ticketNo` / 客户名 |
| `expectedPickupBefore` | ISO | `expected_pickup_at <=` |
| `expectedPickupAfter` | ISO | `expected_pickup_at >` |
| `limit` | int ≤100 | 默认 50 |
| `offset` | int | 默认 0 |

请求示例：
```http
GET /pos/service-tickets?status=pending&status=in_progress&ticketType=laundry&limit=20&offset=0
Cookie: cleanhub_access=...
```

响应 `200 OK`：
```json
{
  "data": [
    { "id": "01HX...", "ticketNo": "TK-260622-0007", "...": "ServiceTicketSummary" }
  ]
}
```

---

### 5.2 创建工单

**`POST /pos/service-tickets`**

请求体：
```json
{
  "customerId": "01HCCCCCCCCCCCCCC",
  "branchId": "01HZZZZZZZZZZZZZZ",
  "ticketType": "laundry",
  "priority": "normal",
  "sourceChannel": "pos",
  "assistantId": "01HUUUUUUUUUUUUUU",
  "expectedPickupAt": "2026-06-24T10:00:00.000Z",
  "remark": "客户要求无接触取件"
}
```

字段说明：`customerId` / `branchId` / `ticketType` 必填；`priority` 默认 `normal`，`sourceChannel` 默认 `pos`；新建工单初始状态恒为 `draft`。

响应 `201 Created`：`ServiceTicketDetail`（含空 `items`）。

可能的错误：`CUSTOMER_NOT_FOUND` / `CUSTOMER_DISABLED` / `FEATURE_DISABLED` / `BRANCH_NOT_ALLOWED` / `VALIDATION_ERROR`。

---

### 5.3 工单概览

**`GET /pos/service-tickets/overview`**

Query 参数：`branchId`（可选 ULID）。

响应 `200 OK`：
```json
{
  "tenantId": "01HYYYYYYYYYYYYYY",
  "branchId": "01HZZZZZZZZZZZZZZ",
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

> `overdueCount`：`ticketStatus IN (pending, in_progress, ready_to_pick)` 且 `expected_pickup_at <= now()`。
> “今天”按 UTC 日切。

---

### 5.4 查询工单详情

**`GET /pos/service-tickets/:ticketId`**

响应 `200 OK`：`ServiceTicketDetail`（含 `items`，**不含**关联订单，订单另调 5.8）。

错误：`SERVICE_TICKET_NOT_FOUND` (404) / `BRANCH_NOT_ALLOWED` (403)。

---

### 5.5 修改工单基本信息

**`PATCH /pos/service-tickets/:ticketId`**

请求体（任意字段子集，不能含 `ticketStatus`）：
```json
{
  "priority": "urgent",
  "expectedPickupAt": "2026-06-25T10:00:00.000Z",
  "remark": "更新备注"
}
```

可改字段：`ticketType` / `priority` / `sourceChannel` / `assistantId` / `expectedPickupAt` / `remark`。状态走 5.7。

响应 `200 OK`：`ServiceTicketDetail`。

---

### 5.6 删除工单

**`DELETE /pos/service-tickets/:ticketId`**

软删除（置 `deleted_at` / `deleted_by`，version +1）。`ticket_items` 由 DB 层 `ON DELETE CASCADE`（但软删不触发物理级联，items 仍在原数据中视为孤儿——本期保持简单，软删工单后 items 不单独软删）。

响应 `204 No Content`（无响应体）。

错误：`SERVICE_TICKET_NOT_FOUND` (404)。

---

### 5.7 修改工单状态

**`POST /pos/service-tickets/:ticketId/status-changes`**

事件式端点（非 `PATCH /status`），支持乐观锁与备注。

请求体：
```json
{
  "to": "picked_up",
  "note": "客户已取走，订单已结清",
  "version": 3
}
```

字段：
- `to`：目标状态（必须满足状态机合法转移）。
- `version`：调用方读取工单时的 `version`，用于乐观锁；不匹配返回 `VERSION_CONFLICT` (409)。
- `note`：可选，写入审计 `metadata.note`。

业务校验：
- 合法转移：否则 `INVALID_STATUS_TRANSITION` (422)。
- `ready_to_pick → picked_up`：触发结算校验，未结清返回 `PICKUP_REQUIRES_SETTLEMENT` (422)。
- 状态变更自动写入时间戳：`picked_up` → 写 `completed_at`；`cancelled` → 写 `cancelled_at`。

响应 `200 OK`：`ServiceTicketDetail`（含新状态与新 version）。

---

### 5.8 关联订单查询

**`GET /pos/service-tickets/:ticketId/orders`**

返回该工单关联的订单（通过 `order_items.ticket_id` 反查，去重）。

响应 `200 OK`：
```json
{
  "data": [
    {
      "id": "01HOOOOOOOOOOOOOO",
      "orderType": "ticket",
      "status": "paid",
      "paymentStatus": "paid",
      "totalAmount": "45.00",
      "paidAmount": "45.00",
      "createdAt": "2026-06-22T08:35:00.000Z"
    }
  ]
}
```

---

### 5.9 新增工单项目

**`POST /pos/service-tickets/:ticketId/items`**

请求体：
```json
{
  "itemName": "西装",
  "itemType": "cloth",
  "itemCategory": "外套",
  "itemColor": "黑色",
  "itemBrand": "Armani",
  "itemMaterial": null,
  "quantity": 1,
  "unitAmount": "30.00",
  "serviceId": "01HSSSSSSSSSSSSSS",
  "defectNotes": "袖口有污渍",
  "specialRequest": null,
  "remark": null,
  "sortOrder": 0
}
```

- `itemName` 必填；`quantity` 默认 1；`unitAmount` 必填（字符串）。
- 系统自动：生成 `labelCode`，计算 `lineAmount = quantity × unitAmount`，初始 `itemStatus = washing`。
- `serviceId` 关联 `services` 表（可空）。
- 写入后自动 `service_tickets.version + 1`（父工单感知结构变化）。

响应 `201 Created`：`ServiceTicketItem`。

---

### 5.10 修改工单项目

**`PATCH /pos/service-tickets/:ticketId/items/:itemId`**

请求体（任意字段子集，不含 `itemStatus`）：
```json
{
  "unitAmount": "35.00",
  "defectNotes": "袖口 + 领口污渍"
}
```

改 `quantity` 或 `unitAmount` 时自动重算 `lineAmount`。状态走 5.11。

响应 `200 OK`：`ServiceTicketItem`。

---

### 5.11 修改工单项目状态

**`POST /pos/service-tickets/:ticketId/items/:itemId/status-changes`**

请求体：
```json
{ "to": "done" }
```

校验：必须满足项目状态机，否则 `INVALID_ITEM_STATUS_TRANSITION` (422)。

响应 `200 OK`：`ServiceTicketItem`（新状态）。

---

### 5.12 删除工单项目

**`DELETE /pos/service-tickets/:ticketId/items/:itemId`**

软删除（`deleted_at` / `deleted_by`，version +1），并触发父工单 `version + 1`。

响应 `204 No Content`。

错误：`SERVICE_TICKET_ITEM_NOT_FOUND` (404)。

---

## 6. 客户端用法

`@cleanhub/api-client` 已通过 `createPosApi` 暴露 `serviceTickets` 命名空间，无需 app 层额外接线：

```ts
import { posApi } from "@/lib/api-client";

// 列表
const { data } = await posApi.pos.serviceTickets.list({
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

调用约定见 `docs/04-technical/api/Clean_Hub-API_Client使用说明.md`：feature 层走 `queries/` / `actions/`，不直接在页面里 `fetch`。

---

## 附：审计事件

所有写操作落 `audit_logs`，`eventCategory = pos_service_ticket`：

| eventType | 触发 | before / after |
| --- | --- | --- |
| `pos.service_ticket.created` | 创建工单 | after = ServiceTicketSummary |
| `pos.service_ticket.updated` | 修改基本信息 | before/after = ServiceTicketAuditSnapshot |
| `pos.service_ticket.status_changed` | 状态变更 | before/after = `{ ticketStatus }`，metadata.note |
| `pos.service_ticket.deleted` | 软删除 | before = audit snapshot, after = `{deleted:true}` |
| `pos.service_ticket.item_added` | 新增项目 | after = `{itemId, labelCode}` |
| `pos.service_ticket.item_updated` | 改项目 | metadata.itemId |
| `pos.service_ticket.item_status_changed` | 项目状态变更 | before/after = `{itemStatus}`，metadata.itemId |
| `pos.service_ticket.item_removed` | 软删项目 | metadata.itemId |

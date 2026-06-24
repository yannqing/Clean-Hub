# 客户管理 API

> POS 客户管理模块接口文档。客户管理基于 **账户(account) + 档案(profile)** 双实体模型:一个账户可拥有多个档案。

## 目录

- [通用约定](#通用约定)
- [鉴权](#鉴权)
- [数据模型](#数据模型)
- [错误码](#错误码)
- [接口列表](#接口列表)
  - [1. 创建客户账户](#1-创建客户账户)
  - [2. 在账户下创建档案](#2-在账户下创建档案)
  - [3. 查询账户下档案列表](#3-查询账户下档案列表)
  - [4. 混合查询客户列表](#4-混合查询客户列表)
  - [5. 查询账户详情](#5-查询账户详情)
  - [6. 查询档案详情](#6-查询档案详情)
  - [7. 编辑账户](#7-编辑账户)
  - [8. 编辑档案](#8-编辑档案)
  - [9. 切换账户状态](#9-切换账户状态)
  - [10. 切换档案状态](#10-切换档案状态)
  - [11. 删除账户(级联)](#11-删除账户级联)
  - [12. 删除档案](#12-删除档案)

---

## 通用约定

| 项目 | 说明 |
|---|---|
| Base URL | `http://localhost:4000`(本地开发) |
| Content-Type | `application/json` |
| 主键 ID | ULID 字符串,长度 26,如 `01KVWB69ZS14Y3X6EJ8X2CMYC4` |
| 时间格式 | ISO 8601 UTC,如 `2026-06-24T08:15:51.291Z` |
| 金额/统计字段 | 会员等级(tier)、余额(balance)、订单数、最后到店时间本期不实现 |

---

## 鉴权

所有 `/pos/*` 接口均需要登录,凭据通过 **HttpOnly Cookie**(`access_token`)携带,前端无需手动读取。

**登录方式:**

```
POST /auth/login
```

```json
{
  "identifier": "pos.cashier1@cleanhub.local",
  "password": "123456",
  "tenantCode": "CLEAN-001"
}
```

登录成功后,响应头返回 `Set-Cookie: access_token=...; HttpOnly`,后续请求自动携带。未登录访问返回 `401`。

> 所有客户数据按租户(tenant)隔离,登录身份决定可见数据范围。

---

## 数据模型

### 账户(PosCustomerAccount)

账户是计费/联系的主体,由手机号或邮箱唯一标识。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string(ULID) | 账户 ID |
| `accountName` | string | 账户名,1-200 字符 |
| `phone` | string \| null | 手机号,最长 32,租户内唯一 |
| `email` | string \| null | 邮箱,最长 320,租户内唯一(存储小写) |
| `status` | `"active"` \| `"disabled"` | 状态 |
| `createdAt` | string(ISO) | 创建时间 |
| `updatedAt` | string(ISO) | 更新时间 |
| `version` | number | 乐观锁版本号 |

### 档案(PosCustomerProfile)

档案是挂在账户下的具体客户(人)。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string(ULID) | 档案 ID |
| `customerAccountId` | string(ULID) | 所属账户 ID |
| `fullName` | string | 姓名,1-200 字符 |
| `phone` | string \| null | 手机号,最长 32 |
| `email` | string \| null | 邮箱,最长 320 |
| `relationship` | string \| null | 关系(本人/家人等),最长 80 |
| `address` | string \| null | 地址,最长 1000 |
| `notes` | string \| null | 备注,最长 2000 |
| `status` | `"active"` \| `"disabled"` | 状态 |
| `createdAt` | string(ISO) | 创建时间 |
| `updatedAt` | string(ISO) | 更新时间 |
| `version` | number | 乐观锁版本号 |

> 档案归属规则:**新增档案必须在账户下**,档案的 `customerAccountId` 创建后不可更改。

---

## 错误码

所有业务错误返回如下结构:

```json
{
  "message": "错误描述",
  "code": "ERROR_CODE",
  "requestId": "01KVWAN27KE1N3Y93NV1Y6CARB"
}
```

| code | HTTP status | 说明 |
|---|---|---|
| `POS_ACCOUNT_NOT_FOUND` | 404 | 账户不存在 |
| `POS_CUSTOMER_NOT_FOUND` | 404 | 档案不存在 |
| `POS_PHONE_CONFLICT` | 409 | 手机号已被占用 |
| `POS_EMAIL_CONFLICT` | 409 | 邮箱已被占用 |
| `POS_ACCOUNT_DISABLED` | 403 | 账户已停用,不能新建档案 |
| `POS_CUSTOMER_ALREADY_DISABLED` | 409 | 客户已停用,不能重复停用 |
| `POS_CUSTOMER_NOT_DISABLED` | 409 | 客户未停用,不能启用 |
| `POS_PHONE_OR_EMAIL_REQUIRED` | 400 | 手机号和邮箱至少填一个 |

---

## 接口列表

### 1. 创建客户账户

**URL**: `POST /pos/accounts`

**入参**(Body):

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `accountName` | string | 是 | 账户名,1-200 字符 |
| `phone` | string | 二选一 | 手机号,最长 32 |
| `email` | string | 二选一 | 邮箱,最长 320 |

> `phone` 与 `email` 至少填一个,否则返回 `POS_PHONE_OR_EMAIL_REQUIRED`。

**出参**:返回创建后的账户完整对象,字段见[账户数据模型](#账户poscustomeraccount)。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string(ULID) | 账户 ID |
| `accountName` | string | 账户名 |
| `phone` | string \| null | 手机号 |
| `email` | string \| null | 邮箱 |
| `status` | `"active"` \| `"disabled"` | 状态(新建为 `active`) |
| `createdAt` | string(ISO) | 创建时间 |
| `updatedAt` | string(ISO) | 更新时间 |
| `version` | number | 乐观锁版本号(新建为 1) |

**请求示例**:

```http
POST /pos/accounts
Content-Type: application/json

{
  "accountName": "文档演示账户",
  "phone": "13720260624001",
  "email": "demo20260624001@cleanhub.local"
}
```

**响应示例**(201 Created):

```json
{
  "id": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
  "accountName": "文档演示账户",
  "phone": "13720260624001",
  "email": "demo20260624001@cleanhub.local",
  "status": "active",
  "createdAt": "2026-06-24T08:15:51.291Z",
  "updatedAt": "2026-06-24T08:15:51.291Z",
  "version": 1
}
```

**错误响应**(409 手机号冲突):

```json
{
  "message": "A customer account with this phone already exists.",
  "code": "POS_PHONE_CONFLICT",
  "requestId": "01KVWAN27KE1N3Y93NV1Y6CARB"
}
```

---

### 2. 在账户下创建档案

**URL**: `POST /pos/accounts/{accountId}/customers`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `accountId` | path | string(ULID) | 是 | 所属账户 ID |
| `fullName` | body | string | 是 | 姓名,1-200 字符 |
| `phone` | body | string | 否 | 手机号,最长 32 |
| `email` | body | string | 否 | 邮箱,最长 320 |
| `relationship` | body | string | 否 | 关系,最长 80 |
| `address` | body | string | 否 | 地址,最长 1000 |
| `notes` | body | string | 否 | 备注,最长 2000 |

> 若账户已停用,返回 `POS_ACCOUNT_DISABLED`。

**出参**:返回创建后的档案完整对象,字段见[档案数据模型](#档案poscustomerprofile)。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string(ULID) | 档案 ID |
| `customerAccountId` | string(ULID) | 所属账户 ID |
| `fullName` | string | 姓名 |
| `phone` | string \| null | 手机号 |
| `email` | string \| null | 邮箱 |
| `relationship` | string \| null | 关系 |
| `address` | string \| null | 地址 |
| `notes` | string \| null | 备注 |
| `status` | `"active"` \| `"disabled"` | 状态(新建为 `active`) |
| `createdAt` | string(ISO) | 创建时间 |
| `updatedAt` | string(ISO) | 更新时间 |
| `version` | number | 乐观锁版本号(新建为 1) |

**请求示例**:

```http
POST /pos/accounts/01KVWB69ZS14Y3X6EJ8X2CMYC4/customers
Content-Type: application/json

{
  "fullName": "李四",
  "phone": "13820260624002",
  "email": "lisi20260624@cleanhub.local",
  "relationship": "本人",
  "address": "上海市浦东新区",
  "notes": "VIP客户"
}
```

**响应示例**(201 Created):

```json
{
  "id": "01KVWB6P2B154M3CGD39ZZ6SND",
  "customerAccountId": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
  "fullName": "李四",
  "phone": "13820260624002",
  "email": "lisi20260624@cleanhub.local",
  "relationship": "本人",
  "address": "上海市浦东新区",
  "notes": "VIP客户",
  "status": "active",
  "createdAt": "2026-06-24T08:16:03.662Z",
  "updatedAt": "2026-06-24T08:16:03.662Z",
  "version": 1
}
```

---

### 3. 查询账户下档案列表

**URL**: `GET /pos/accounts/{accountId}/customers`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `accountId` | path | string(ULID) | 是 | 账户 ID |

**出参**:

| 字段 | 类型 | 说明 |
|---|---|---|
| `data` | array | 档案摘要列表 |
| `data[].id` | string(ULID) | 档案 ID |
| `data[].customerAccountId` | string(ULID) | 所属账户 ID |
| `data[].fullName` | string | 姓名 |
| `data[].phone` | string \| null | 手机号 |
| `data[].email` | string \| null | 邮箱 |
| `data[].status` | `"active"` \| `"disabled"` | 状态 |
| `data[].createdAt` | string(ISO) | 创建时间 |

**请求示例**:

```http
GET /pos/accounts/01KVWB69ZS14Y3X6EJ8X2CMYC4/customers
```

**响应示例**(200 OK):

```json
{
  "data": [
    {
      "id": "01KVWB6P2B154M3CGD39ZZ6SND",
      "customerAccountId": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
      "fullName": "李四",
      "phone": "13820260624002",
      "email": "lisi20260624@cleanhub.local",
      "status": "active",
      "createdAt": "2026-06-24T08:16:03.662Z"
    }
  ]
}
```

---

### 4. 混合查询客户列表

**URL**: `GET /pos/customers`

**入参**(Query):

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `q` | string | 否 | - | 模糊搜索(账户名/手机号/邮箱、档案名/手机号/邮箱),最长 200 |
| `resultType` | `"account"` \| `"profile"` | 否 | 混合 | 结果类型筛选 |
| `status` | `"active"` \| `"disabled"` | 否 | - | 状态筛选 |
| `limit` | number | 否 | 50 | 每页条数,1-100 |
| `offset` | number | 否 | 0 | 偏移量,≥0 |

**出参**:

| 字段 | 类型 | 说明 |
|---|---|---|
| `data` | array | 混合列表,每项含 `kind`(`account`/`profile`) |
| `total` | number | 符合条件的总条数(用于分页) |
| `limit` | number | 当前每页条数 |
| `offset` | number | 当前偏移量 |

> 不传 `resultType` 时,账户和档案混合返回并按 `createdAt` 倒序;`total` 为两类之和。

**请求示例**:

```http
GET /pos/customers?q=李&limit=5&offset=0
```

**响应示例**(200 OK):

```json
{
  "data": [
    {
      "kind": "profile",
      "profile": {
        "id": "01KVWB6P2B154M3CGD39ZZ6SND",
        "customerAccountId": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
        "accountName": "文档演示账户",
        "fullName": "李四",
        "phone": "13820260624002",
        "email": "lisi20260624@cleanhub.local",
        "status": "active",
        "createdAt": "2026-06-24T08:16:03.662Z"
      }
    }
  ],
  "total": 1,
  "limit": 5,
  "offset": 0
}
```

**仅看账户的请求示例**:

```http
GET /pos/customers?resultType=account&limit=5
```

**仅看账户的响应示例**:

```json
{
  "data": [
    {
      "kind": "account",
      "account": {
        "id": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
        "accountName": "文档演示账户",
        "phone": "13720260624001",
        "email": "demo20260624001@cleanhub.local",
        "status": "active",
        "createdAt": "2026-06-24T08:15:51.291Z"
      }
    }
  ],
  "total": 7,
  "limit": 5,
  "offset": 0
}
```

---

### 5. 查询账户详情

**URL**: `GET /pos/accounts/{accountId}`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `accountId` | path | string(ULID) | 是 | 账户 ID |

**出参**:返回账户完整对象,字段见[账户数据模型](#账户poscustomeraccount)。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string(ULID) | 账户 ID |
| `accountName` | string | 账户名 |
| `phone` | string \| null | 手机号 |
| `email` | string \| null | 邮箱 |
| `status` | `"active"` \| `"disabled"` | 状态 |
| `createdAt` | string(ISO) | 创建时间 |
| `updatedAt` | string(ISO) | 更新时间 |
| `version` | number | 乐观锁版本号 |

**请求示例**:

```http
GET /pos/accounts/01KVWB69ZS14Y3X6EJ8X2CMYC4
```

**响应示例**(200 OK):

```json
{
  "id": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
  "accountName": "文档演示账户",
  "phone": "13720260624001",
  "email": "demo20260624001@cleanhub.local",
  "status": "active",
  "createdAt": "2026-06-24T08:15:51.291Z",
  "updatedAt": "2026-06-24T08:15:51.291Z",
  "version": 1
}
```

---

### 6. 查询档案详情

**URL**: `GET /pos/customers/{customerId}`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `customerId` | path | string(ULID) | 是 | 档案 ID |

**出参**:返回档案完整对象,字段见[档案数据模型](#档案poscustomerprofile)。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string(ULID) | 档案 ID |
| `customerAccountId` | string(ULID) | 所属账户 ID |
| `fullName` | string | 姓名 |
| `phone` | string \| null | 手机号 |
| `email` | string \| null | 邮箱 |
| `relationship` | string \| null | 关系 |
| `address` | string \| null | 地址 |
| `notes` | string \| null | 备注 |
| `status` | `"active"` \| `"disabled"` | 状态 |
| `createdAt` | string(ISO) | 创建时间 |
| `updatedAt` | string(ISO) | 更新时间 |
| `version` | number | 乐观锁版本号 |

**请求示例**:

```http
GET /pos/customers/01KVWB6P2B154M3CGD39ZZ6SND
```

**响应示例**(200 OK):

```json
{
  "id": "01KVWB6P2B154M3CGD39ZZ6SJ75",
  "customerAccountId": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
  "fullName": "李四",
  "phone": "13820260624002",
  "email": "lisi20260624@cleanhub.local",
  "relationship": "本人",
  "address": "上海市浦东新区",
  "notes": "VIP客户",
  "status": "active",
  "createdAt": "2026-06-24T08:16:03.662Z",
  "updatedAt": "2026-06-24T08:16:03.662Z",
  "version": 1
}
```

---

### 7. 编辑账户

**URL**: `PATCH /pos/accounts/{accountId}`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `accountId` | path | string(ULID) | 是 | 账户 ID |
| `accountName` | body | string | 否 | 账户名,1-200 字符 |
| `phone` | body | string \| null | 否 | 手机号,传 null 清空 |
| `email` | body | string \| null | 否 | 邮箱,传 null 清空 |

> 至少传一个字段,否则报错。修改手机号/邮箱时仍校验唯一性。

**出参**:返回更新后的账户完整对象(同[接口 5 出参](#5-查询账户详情)),`updatedAt` 刷新、`version` 自增。

**请求示例**:

```http
PATCH /pos/accounts/01KVWB69ZS14Y3X6EJ8X2CMYC4
Content-Type: application/json

{
  "accountName": "文档演示账户-已更新"
}
```

**响应示例**(200 OK):

```json
{
  "id": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
  "accountName": "文档演示账户-已更新",
  "phone": "13720260624001",
  "email": "demo20260624001@cleanhub.local",
  "status": "active",
  "createdAt": "2026-06-24T08:15:51.291Z",
  "updatedAt": "2026-06-24T08:20:00.000Z",
  "version": 2
}
```

---

### 8. 编辑档案

**URL**: `PATCH /pos/customers/{customerId}`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `customerId` | path | string(ULID) | 是 | 档案 ID |
| `fullName` | body | string | 否 | 姓名,1-200 字符 |
| `phone` | body | string \| null | 否 | 手机号 |
| `email` | body | string \| null | 否 | 邮箱 |
| `relationship` | body | string \| null | 否 | 关系 |
| `address` | body | string \| null | 否 | 地址 |
| `notes` | body | string \| null | 否 | 备注 |

**出参**:返回更新后的档案完整对象(同[接口 6 出参](#6-查询档案详情)),`updatedAt` 刷新、`version` 自增。

**请求示例**:

```http
PATCH /pos/customers/01KVWB6P2B154M3CGD39ZZ6SND
Content-Type: application/json

{
  "fullName": "李四-已更新",
  "notes": "Super VIP"
}
```

**响应示例**(200 OK):

```json
{
  "id": "01KVWB6P2B154M3CGD39ZZ6SND",
  "customerAccountId": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
  "fullName": "李四-已更新",
  "phone": "13820260624002",
  "email": "lisi20260624@cleanhub.local",
  "relationship": "本人",
  "address": "上海市浦东新区",
  "notes": "Super VIP",
  "status": "active",
  "createdAt": "2026-06-24T08:16:03.662Z",
  "updatedAt": "2026-06-24T08:20:00.000Z",
  "version": 2
}
```

---

### 9. 切换账户状态

**URL**: `POST /pos/accounts/{accountId}/status-changes`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `accountId` | path | string(ULID) | 是 | 账户 ID |
| `status` | body | `"active"` \| `"disabled"` | 是 | 目标状态 |
| `reason` | body | string | 否 | 变更原因,最长 500 |

> 幂等校验:账户已是目标状态时返回 `POS_CUSTOMER_ALREADY_DISABLED` 或 `POS_CUSTOMER_NOT_DISABLED`。

**出参**:返回状态变更后的账户完整对象(同[接口 5 出参](#5-查询账户详情)),`status` 为目标状态、`version` 自增。

**请求示例**(停用):

```http
POST /pos/accounts/01KVWB69ZS14Y3X6EJ8X2CMYC4/status-changes
Content-Type: application/json

{
  "status": "disabled",
  "reason": "测试停用"
}
```

**响应示例**(200 OK):

```json
{
  "id": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
  "accountName": "文档演示账户-已更新",
  "phone": "13720260624001",
  "email": "demo20260624001@cleanhub.local",
  "status": "disabled",
  "createdAt": "2026-06-24T08:15:51.291Z",
  "updatedAt": "2026-06-24T08:21:00.000Z",
  "version": 3
}
```

**重新启用**:

```json
{ "status": "active" }
```

---

### 10. 切换档案状态

**URL**: `POST /pos/customers/{customerId}/status-changes`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `customerId` | path | string(ULID) | 是 | 档案 ID |
| `status` | body | `"active"` \| `"disabled"` | 是 | 目标状态 |
| `reason` | body | string | 否 | 变更原因,最长 500 |

**出参**:返回状态变更后的档案完整对象(同[接口 6 出参](#6-查询档案详情)),`status` 为目标状态、`version` 自增。

**请求示例**:

```http
POST /pos/customers/01KVWB6P2B154M3CGD39ZZ6SND/status-changes
Content-Type: application/json

{
  "status": "disabled",
  "reason": "客户要求暂停服务"
}
```

**响应示例**(200 OK):

```json
{
  "id": "01KVWB6P2B154M3CGD39ZZ6SND",
  "customerAccountId": "01KVWB69ZS14Y3X6EJ8X2CMYC4",
  "fullName": "李四-已更新",
  "phone": "13820260624002",
  "email": "lisi20260624@cleanhub.local",
  "relationship": "本人",
  "address": "上海市浦东新区",
  "notes": "Super VIP",
  "status": "disabled",
  "createdAt": "2026-06-24T08:16:03.662Z",
  "updatedAt": "2026-06-24T08:21:00.000Z",
  "version": 3
}
```

---

### 11. 删除账户(级联)

**URL**: `DELETE /pos/accounts/{accountId}`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `accountId` | path | string(ULID) | 是 | 账户 ID |

> **软删除**。删除账户时,**该账户下所有档案一并软删除**(级联)。删除后该账户及其档案不再出现在任何查询中。

**出参**:无响应体(HTTP 204 No Content)。

**请求示例**:

```http
DELETE /pos/accounts/01KVWB69ZS14Y3X6EJ8X2CMYC4
```

**响应**(204 No Content):

```
(无响应体)
```

**删除后查询**(验证级联):

```http
GET /pos/accounts/01KVWB69ZS14Y3X6EJ8X2CMYC4
```

```json
{
  "message": "Customer account was not found.",
  "code": "POS_ACCOUNT_NOT_FOUND",
  "requestId": "01KVWBJF6RKCJRVHTA3GVMGXBT"
}
```

---

### 12. 删除档案

**URL**: `DELETE /pos/customers/{customerId}`

**入参**:

| 字段 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `customerId` | path | string(ULID) | 是 | 档案 ID |

> **软删除**。删除档案**不影响**所属账户和其他档案。

**出参**:无响应体(HTTP 204 No Content)。

**请求示例**:

```http
DELETE /pos/customers/01KVWB6P2B154M3CGD39ZZ6SND
```

**响应**(204 No Content):

```
(无响应体)
```

---

## 附:业务规则速查

| 规则 | 说明 |
|---|---|
| 新增档案必须在账户下 | 嵌套路由 `POST /pos/accounts/:id/customers` |
| 一账户对应多档案 | 账户 1:N 档案 |
| 删除账户级联 | 账户软删 → 其下档案全部软删 |
| 删除档案不级联 | 只删当前档案 |
| 唯一性 | 手机号、邮箱在租户内唯一(含编辑场景,排除自身) |
| 停用账户不可建档案 | 停用账户下新增档案返回 403 |
| 停用客户不能用于接待 | 各业务模块(工单/订单)自行实现拦截,客户模块只暴露 status |
| 数据隔离 | 所有查询按 tenant 隔离 + 过滤软删 |
| 乐观锁 | 所有写操作 version+1 |
| 软删除 | 所有删除均为软删(deleted_at + deleted_by),查询自动过滤 |

## Why

客户移动端当前只能查看订单与 `paymentStatus`，无法自助在线支付;现有 `payment_transactions` 表是为 POS 员工开单设计的（`createdBy` 必填指向 users、无幂等键、无网关/回调字段、无退款记录)。要让客户在手机上完成"查看订单 → 在线支付 → 状态可信回写 → 必要时申请退款"，需要补齐在线支付网关接入、回调对账与退款申请闭环。支付是高风险域(重复回调、幂等、对账)，必须单独认真做。

## What Changes

- 新增客户自助在线支付:客户对未支付/部分支付订单发起 `app` 渠道支付，创建支付意图并返回网关支付参数/跳转。
- 新增支付网关适配抽象:provider 无关的 `PaymentGateway` 接口（创建支付、校验回调、查询、发起退款），首个具体 provider 留作部署期决策。
- 新增回调对账:接收网关异步回调，校验签名、幂等去重，按结果更新 `payment_transactions` 与订单 `paymentStatus`/`paidAmount`/`paidAt`/`status`。
- 新增支付状态查询:客户可查询某次支付的最新状态（支付中/成功/失败)。
- 新增退款申请闭环:客户在移动端发起退款申请，由后台审批(同意→发起网关退款并对账;拒绝→记录原因);移动端不直接退款。
- 数据:扩展 `payment_transactions`（幂等键、发起方类型、网关标识/外部单号、原始回调引用),新增回调事件表与退款申请表。

## Capabilities

### New Capabilities
- `customer-payment`: 客户自助在线支付、支付状态查询，以及网关回调的幂等对账。
- `refund-request`: 客户发起退款申请与后台审批，审批通过后的网关退款与对账。

### Modified Capabilities
<!-- 既有 POS/订单 spec 不在本变更范围;订单支付字段的回写属实现联动,不改其他 capability 的 spec 级行为。 -->

## Impact

- 数据库:`payment_transactions` 增加 `idempotency_key`(tenant 唯一)、`initiator_type`(staff/customer)、`gateway`/`external_id`、回调引用，并放开 `created_by` 以支持客户发起;新增 `payment_callbacks`(回调幂等)与 `refund_requests` 表。
- 后端:新增 `apps/api/src/modules/mobile/payment`（发起支付、状态查询、退款申请)与网关回调入口(webhook，含签名校验与幂等);对账 use-case 更新订单与交易状态。
- API Client:`packages/api-client/src/mobile` 新增支付发起/查询/退款申请方法与 DTO。
- 前端:`apps/mobile-web` 客户端订单页新增支付入口、支付结果页与退款申请;Owner/后台审批界面（最小可用)。
- 高风险:重复回调、并发支付、金额一致性、幂等键、对账与订单状态机一致性需严格保证（CLAUDE.md 高风险域)。
- 依赖/配置:网关 SDK 与密钥、回调签名密钥、回调公网地址等环境配置。

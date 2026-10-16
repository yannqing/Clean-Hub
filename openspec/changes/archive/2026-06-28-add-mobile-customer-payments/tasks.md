## 1. 数据库

- [x] 1.1 扩展 `payment_transactions`:加 `idempotency_key`(tenant 唯一)、`initiator_type`(staff/customer)、`gateway`、`external_id`，放开 `created_by` 为可空（或加客户发起方引用）
- [x] 1.2 新增 `payment_callbacks` 表（gateway、external_id、event、验签结果、原始 payload、处理状态、唯一约束）
- [x] 1.3 新增 `refund_requests` 表（订单/交易、金额、原因、状态、审批人、时间戳、软删）
- [x] 1.4 `pnpm db:generate`、`pnpm db:migrate`、`pnpm --filter @cleanhub/db typecheck` 通过

## 2. 网关适配抽象

- [x] 2.1 定义 `PaymentGateway` 接口（createPayment/verifyCallback/queryPayment/createRefund）
- [x] 2.2 实现 mock/sandbox 适配（用于本地与测试，可模拟成功/失败/重复回调）
- [x] 2.3 网关配置加载与按租户/部署选型注入

## 3. 客户支付后端（customer-payment）

- [x] 3.1 新建 `apps/api/src/modules/mobile/payment`（service/repository/types/controller/routes）
- [x] 3.2 发起支付:校验订单归属与应付余额、幂等键去重、创建 pending 交易、调用 `createPayment` 返回支付参数
- [x] 3.3 支付状态查询:仅本租户本人交易
- [x] 3.4 对账 use-case:按累计已付金额更新订单 `paymentStatus`/`paidAmount`/`paidAt`/`status`（numeric 精确比较，version 乐观锁）

## 4. 回调入口（customer-payment）

- [x] 4.1 网关 webhook 路由:验签 → 写/查 `payment_callbacks` 幂等 → 单事务对账 → 标记已处理
- [x] 4.2 重复回调去重与已处理幂等返回
- [x] 4.3 用 `@cleanhub/logger` 记录回调与对账（脱敏），保留原始 payload 备查

## 5. 退款（refund-request）

- [x] 5.1 客户发起退款申请:校验可退余额与归属，创建 pending 申请
- [x] 5.2 后台审批接口:权限校验，approve→调用 `createRefund` 置处理中，reject→记录原因
- [x] 5.3 退款回调对账:交易/订单置 `refunded` 并更新已付金额
- [x] 5.4 审批界面所需查询（待审批列表、申请详情）

## 6. API Client

- [x] 6.1 `packages/api-client/src/mobile` 新增发起支付/查询状态/退款申请方法与 DTO
- [x] 6.2 后台退款审批方法与 DTO（如放在 owner/后台 client）
- [x] 6.3 `pnpm --filter @cleanhub/api-client typecheck` 通过

## 7. 前端（apps/mobile-web）

- [x] 7.1 客户订单页支付入口:发起支付、跳转/凭据处理、支付结果页（轮询或回跳确认状态）
- [x] 7.2 退款申请界面:发起与查看申请状态
- [x] 7.3 后台退款审批最小界面（approve/reject）
- [x] 7.4 `pnpm --filter @cleanhub/mobile-web typecheck` 与 `lint` 通过

## 8. 测试与校验

- [x] 8.1 发起支付 smoke:幂等、超额/越权拒绝
- [x] 8.2 回调对账 smoke:首次成功、重复回调去重、验签失败拒绝、部分支付累计（用 mock 网关）
- [x] 8.3 退款 smoke:申请→审批→退款回调对账，越权审批拒绝、超额拒绝
- [x] 8.4 运行 `pnpm typecheck` 与相关 `lint`，全部通过

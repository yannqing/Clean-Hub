## Context

`orders` 有 `paymentStatus`(unpaid/paid/partial/refunded)、`paidAmount`、`paidAt`;`payment_transactions` 已存在但面向 POS 员工开单(`createdBy` 必填 users、`paymentMethod` cash/card/app、status pending/paid/refunded/failed)，缺幂等键、网关字段、回调与退款记录。客户移动端只读订单。本变更在既有交易表上扩展，补客户自助在线支付、网关回调对账与退款申请。约束:支付为最高风险域——重复回调、幂等、并发、金额与订单状态一致性必须严格保证;遵循 CLAUDE.md（高风险动作需 idempotency key;业务进 `apps/api`)。

## Goals / Non-Goals

**Goals:**
- 客户对未支付/部分支付订单发起 `app` 在线支付并完成。
- provider 无关的网关适配抽象，回调签名校验 + 幂等去重 + 对账。
- 支付状态可查询;订单支付字段与状态可信回写。
- 客户退款申请 + 后台审批 + 审批通过后的网关退款与对账。

**Non-Goals:**
- 绑定某一具体支付 provider（仅定义适配接口，具体实现按部署期决策)。
- POS 现金/刷卡开单流程改造（保持现状)。
- 订阅/分期/钱包余额等高级支付形态。
- 移动端直接退款（明确走"申请→审批")。

## Decisions

### 决策 1:provider 无关的 PaymentGateway 适配
定义 `PaymentGateway` 接口:`createPayment`、`verifyCallback`、`queryPayment`、`createRefund`。具体 provider（区域支付/卡/移动钱包)作为适配实现，按部署期选型注入。
- 理由:避免厂商绑定，便于多区域;与项目"local payments / 多区域"定位一致。
- 备选:直接写死单一 provider（否决:难以多区域复用)。

### 决策 2:支付意图复用并扩展 payment_transactions
不新建意图表，扩展 `payment_transactions`:加 `idempotency_key`(tenant 唯一)、`initiator_type`(staff/customer)、`gateway`、`external_id`(网关单号)。客户发起时创建 `pending` 交易并向网关 `createPayment`，返回支付参数;`created_by` 放开为可空或以客户标识区分发起方。
- 理由:订单与交易关系已建好，复用减少分叉;幂等键防重复发起。
- 备选:独立 `payment_intents` 表（否决:与既有交易表语义重叠，增加对账复杂度)。

### 决策 3:回调幂等用独立回调表
新增 `payment_callbacks` 记录每次网关回调（gateway、external_id、event、签名校验结果、原始 payload、处理状态)，对 `(gateway, external_id, event)` 或网关事件 id 建唯一约束。回调处理:先验签 → 查重(已处理直接返回 200)→ 在单事务内更新交易与订单 → 标记回调已处理。
- 理由:网关会重发回调，必须幂等;独立表留存原始回调便于审计与排查。

### 决策 4:对账在单事务内推进订单状态机
回调成功时在同一事务:更新交易 `paid`/`failed`/`refunded`，按累计 `paidAmount` 与 `totalAmount` 计算订单 `paymentStatus`(unpaid/partial/paid/refunded)与 `status`、写 `paidAt`。金额比较用精确数值(numeric)避免浮点。
- 理由:交易与订单状态强一致;部分支付按累计金额判定。

### 决策 5:退款走"申请→审批→网关退款"
新增 `refund_requests`(订单/交易、金额、原因、状态 pending/approved/rejected/refunded、审批人)。客户提交申请;后台审批通过后调用 `createRefund`，网关退款回调再对账为 `refunded`。移动端不暴露直接退款。
- 理由:退款是高风险，需人工管控与审计。

### 决策 6:幂等与并发守卫
发起支付以 `idempotency_key` 去重;回调以回调唯一键去重;交易/订单更新用 `version` 乐观锁;同一订单并发支付通过"未完成支付交易"约束或金额校验避免超额收款。

## Risks / Trade-offs

- [网关重复回调导致重复入账] → 回调唯一键 + 幂等处理 + 事务内对账。
- [客户并发发起多笔支付] → 幂等键 + 订单维度未结交易校验 + 金额上限(不超过应付)。
- [回调伪造] → 强制签名校验，验签失败拒绝且记录。
- [交易成功但订单状态未更新（部分失败)] → 单事务对账，失败整体回滚 + 回调可重放。
- [`created_by` 非空约束阻止客户发起] → 迁移放开为可空或引入 `initiator_type` + 客户引用。
- [退款金额超出已付] → 审批与发起退款时校验可退余额。
- [provider 未定导致无法联调] → 适配接口先行 + 提供 sandbox/mock 适配用于本地与测试。

## Migration Plan

1. 迁移:扩展 `payment_transactions` 字段，新增 `payment_callbacks`、`refund_requests`，放开 `created_by`。
2. 上线网关适配接口 + mock/sandbox 适配，打通发起→回调→对账链路（不接真实 provider)。
3. 接入首个真实 provider 适配与回调验签、环境配置。
4. 前端上线客户支付入口、结果页与退款申请;后台上线退款审批最小界面。
5. 灰度放量并监控对账一致性与回调成功率。
- 回滚:支付为新增能力,可关闭移动端支付入口与回调路由;已产生交易数据保留,不影响 POS 与既有订单。

## Open Questions

- 首个支付 provider 选型（区域/卡/移动钱包)与合规要求。
- `created_by` 放开方式:改可空 vs 引入 `initiator_type` 并以客户引用记录发起方。
- 退款审批归属（Owner / 门店运营 / SaaS 后台)与权限。
- 是否需要支持多次部分支付与最低支付额。

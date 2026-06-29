# customer-payment Specification

## Purpose
Define customer-initiated online payment flows, including idempotent payment creation, customer-scoped status queries, and gateway callback reconciliation.
## Requirements
### Requirement: 客户发起在线支付

已认证客户 SHALL 能对本人未支付或部分支付的订单发起在线支付。发起 MUST 携带幂等键，金额 MUST NOT 超过订单应付余额，并只能作用于本租户本人的订单。

#### Scenario: 成功发起支付

- **WHEN** 客户对一笔未支付订单发起在线支付
- **THEN** 系统创建一笔待支付交易并返回网关支付参数（跳转或支付凭据）

#### Scenario: 重复发起保持幂等

- **WHEN** 客户以相同幂等键重复发起同一笔支付
- **THEN** 系统返回首次发起的支付，不创建重复交易

#### Scenario: 超额或越权被拒

- **WHEN** 发起金额超过应付余额，或订单不属于该客户
- **THEN** 系统拒绝发起并返回校验/鉴权错误

### Requirement: 支付状态查询

客户 SHALL 能查询本人某次支付的最新状态。查询 MUST 只返回本租户本人交易。

#### Scenario: 查询支付状态

- **WHEN** 客户查询一笔本人发起的支付
- **THEN** 系统返回该支付的最新状态（支付中/成功/失败）

### Requirement: 网关回调幂等对账

系统 SHALL 接收支付网关回调，校验签名后幂等处理，并在单事务内更新交易与订单。重复回调 MUST NOT 造成重复入账。

#### Scenario: 首次成功回调对账

- **WHEN** 网关回调通知一笔支付成功且签名校验通过
- **THEN** 系统将交易置为已支付，并按累计已付金额更新订单的支付状态与已付金额、支付时间

#### Scenario: 重复回调被去重

- **WHEN** 网关对同一支付事件重复回调
- **THEN** 系统识别为已处理并幂等返回，不再重复更新订单

#### Scenario: 验签失败拒绝

- **WHEN** 回调签名校验失败
- **THEN** 系统拒绝处理并记录该回调，不修改任何交易或订单

#### Scenario: 部分支付按累计金额判定

- **WHEN** 一笔订单收到不足额支付的成功回调
- **THEN** 系统将订单标记为部分支付并累计已付金额

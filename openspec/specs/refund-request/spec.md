# refund-request Specification

## Purpose
Define customer refund request and approval workflows, including customer-scoped requests, authorized back-office approval, gateway refund initiation, and refund callback reconciliation.
## Requirements
### Requirement: 客户发起退款申请

已认证客户 SHALL 能对本人已支付的订单发起退款申请并填写原因。申请金额 MUST NOT 超过可退余额，且只能针对本租户本人的订单。客户 MUST NOT 能直接触发退款。

#### Scenario: 提交退款申请

- **WHEN** 客户对一笔已支付订单提交退款申请
- **THEN** 系统创建一条待审批的退款申请并记录金额与原因

#### Scenario: 超出可退余额被拒

- **WHEN** 退款申请金额超过该订单可退余额
- **THEN** 系统拒绝该申请并返回校验错误

#### Scenario: 客户不能直接退款

- **WHEN** 客户尝试绕过审批直接发起退款
- **THEN** 系统不提供该能力，仅接受退款申请

### Requirement: 后台审批退款

具备权限的后台角色 SHALL 能审批退款申请。审批通过 MUST 触发网关退款并在退款回调后对账;审批拒绝 MUST 记录原因且不发生退款。

#### Scenario: 审批通过并发起退款

- **WHEN** 后台角色批准一条待审批退款申请
- **THEN** 系统调用网关发起退款并将申请置为处理中，待退款回调对账为已退款

#### Scenario: 审批拒绝

- **WHEN** 后台角色拒绝一条退款申请并填写原因
- **THEN** 系统将申请置为已拒绝并记录原因，不发生退款

#### Scenario: 退款回调对账

- **WHEN** 网关回调通知退款成功且签名校验通过
- **THEN** 系统将相关交易与订单标记为已退款并更新已付金额

#### Scenario: 越权审批被拒

- **WHEN** 无审批权限的主体尝试审批退款
- **THEN** 系统拒绝并返回鉴权错误

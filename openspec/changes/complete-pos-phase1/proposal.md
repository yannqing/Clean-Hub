## Why

CleanHub POS 已具备客户、工单、订单和基础收款能力，但敏感操作授权、终端绑定、支付幂等、标准服务计价、离线硬件以及交班日结仍未达到 Phase 1 门店试点要求。这些缺口会造成越权、跨店数据暴露、重复记账或断网停业，因此需要在扩大试点前形成可验证的营业闭环。

## What Changes

- 在 API 层统一约束 POS 敏感操作权限与分店范围，Cashier 不得删除业务记录或任意改价，受控操作必须记录原因和审计信息。
- 要求 POS 终端先注册并绑定门店后才能使用 PIN 登录，服务端使用可信终端身份执行禁用、限流和审计。
- 为所有支付方式强制幂等，唯一约束外部流水号，并补充退款或支付修正入口。
- POS 下单和工单录入改为使用租户服务目录与标准价格，支持计件、重量、袋数、颜色、瑕疵以及有权限的价格覆盖。
- 将 Desktop 硬件桥、扫码、标签/小票打印、钱箱和离线写入队列接入 POS，展示真实同步状态并支持失败重试。
- 将交接班和 Z Report 持久化到服务端，生成不可变的班次汇总并包含支付、退款、折扣和差异信息。
- 统一可展示、可扫描和可搜索的订单标识，补充 POS 权限、分店、支付、离线和关键营业流程的自动化测试与验收记录。

## Capabilities

### New Capabilities
- `pos-access-control`: POS 敏感操作的角色授权、分店隔离、操作原因与设备审计要求。
- `pos-terminal-enrollment`: 终端注册、门店绑定、禁用、PIN 登录限流与可信终端上下文要求。
- `pos-payment-reliability`: 现金及移动支付幂等、外部流水唯一性、退款与支付修正要求。
- `pos-service-catalog-pricing`: 服务目录选品、标准价格、计件/称重录入和受控改价要求。
- `pos-offline-hardware`: Desktop 硬件桥、扫描、打印、钱箱、离线队列和同步状态要求。
- `pos-shift-reporting`: 服务端交接班、Z Report 不可变快照和差异审计要求。

### Modified Capabilities

无。

## Impact

- API：`apps/api/src/modules/auth`、`apps/api/src/modules/pos/**`，并新增或扩展终端、服务目录、支付修正、交接班和报表端点。
- 前端：`apps/pos-web/src/features/**` 与 POS shell，改造下单、搜索、权限呈现、同步状态、扫码、打印、交班和报表流程。
- Desktop/共享包：`apps/desktop`、`packages/offline`、`packages/hardware`、`packages/api-client`。
- 数据库：预计扩展终端、支付幂等/外部流水、交接班与 Z Report 数据模型；所有业务实体继续使用 ULID，并保持 tenant/branch 隔离。
- 验证：新增 API 集成或 smoke 测试、POS Web 自动化测试以及 Phase 1 硬件/断网/UAT 记录。
- **BREAKING**：未注册或已禁用的终端将不能再通过 POS PIN 登录；Cashier 现有的删除和任意改价调用将返回权限错误。

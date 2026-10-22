## Why

一次针对 `apps/mobile-web` 的走查发现四处"看起来做了但没做完"的体验缺口：客户端首页 Tab 与订单 Tab 内容完全重复、Owner 派单看板要求手工输入门店/配送员的 ULID、金额格式化在不同角色页面里各写死一种货币且互相矛盾、以及整个应用只有一个入口页导致任何业务详情都无法被深链或分享/恢复。这些问题不影响后端数据正确性，但直接拉低移动端三个角色（客户/配送员/门店主）的可用性与专业度，且都可以在现有后端能力（`tenants.defaultCurrency`、`tenant/branches`、POS staff 列表)基础上补齐，不需要新的后端领域建模。

## What Changes

- 客户端首页 Tab 改为展示与"订单"Tab 不同的概览内容（今日/近期状态摘要、下一次预约、常用入口），不再直接复用 `ActivityView` 全量列表。
- Owner 派单看板的门店 (`branchId`) 与配送员 (`assigneeUserId`) 输入框替换为基于真实数据的选择器（下拉/搜索选择），移除靠记忆手打 ULID 的交互。
- 新增移动端只读接口：门店列表（按租户过滤）与配送员列表（按租户与门店过滤），供上述选择器使用。
- 金额格式化统一改为读取当前租户的 `defaultCurrency`，替换 Owner 页硬编码的 `XOF` 与配送端硬编码的 `EUR`，客户端支付/退款金额展示同步对齐。
- 为客户订单/工单详情、配送任务详情引入可恢复的视图状态（通过 URL 查询参数 + 浏览器历史），使这些详情可以被刷新、分享链接、返回键正确恢复，同时不违反 `mobile-shell` 现有"静态导出、无 SSR/中间件/服务端 cookie"的约束。

## Capabilities

### New Capabilities
- `mobile-currency-formatting`: 移动端统一按当前租户 `defaultCurrency` 格式化金额与货币符号的能力，供客户端、配送端、Owner 端共用，替代目前各页面各自硬编码货币的做法。

### Modified Capabilities
- `customer-mobile`: 新增"查看首页运营概览"需求，首页 Tab 不再与订单列表内容相同。
- `delivery-dispatch`: 派单看板新增"按门店/配送员列表选择而非手工输入 ID"的需求，新增门店列表与配送员列表查询能力。
- `mobile-shell`: 新增"业务详情视图可通过 URL 状态恢复/分享"的需求，明确该能力必须在静态导出、无 SSR 的约束下实现。

## Impact

- 代码：`apps/mobile-web/src/features/customer/components/customer-home.tsx`、`apps/mobile-web/src/features/owner/components/owner-home.tsx`、`apps/mobile-web/src/features/owner/{actions,queries}/`、`apps/mobile-web/src/features/delivery/components/delivery-home.tsx`、新增 `apps/mobile-web/src/lib`（或等价位置）下的货币格式化工具、`apps/mobile-web/src/app` 路由结构。
- API：`apps/api/src/modules/mobile/owner/*`（新增门店列表、配送员列表只读端点，复用/包装 `tenant/branches` 与 POS staff 数据）；不改变现有写操作端点的行为与权限模型。
- 数据：不新增表；复用 `tenants.defaultCurrency`（已存在）与现有 `branches`/staff 数据，不做 schema 迁移。
- 无 BREAKING：均为新增只读端点与前端展示层调整，不改变既有 API 契约或客户端已保存的数据格式。

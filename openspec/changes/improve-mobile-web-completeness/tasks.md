## 1. 租户货币格式化（`mobile-currency-formatting`）

- [x] 1.1 在移动端登录响应（`apps/api/src/modules/mobile/auth`）与 Owner 今日摘要响应（`apps/api/src/modules/mobile/owner`）中补充当前租户 `defaultCurrency` 字段，读取自 `tenants.defaultCurrency`
- [x] 1.2 更新 `@cleanhub/api-client` 对应的类型定义（`MobileAuthContext` / `MobileOwnerTodaySummary` 等），补充 `currency` 字段
- [x] 1.3 新增共享货币格式化工具（如 `packages/i18n` 或 `apps/mobile-web/src/lib/currency.ts`），封装 `Intl.NumberFormat` + 传入的 `currency` 码
- [x] 1.4 将 `owner-home.tsx` 硬编码的 `formatMoney(value, locale)`（`XOF`）改为调用共享工具并传入登录/摘要下发的 `currency`
- [x] 1.5 将 `delivery-home.tsx` 硬编码的 `formatMoney(value, locale)`（`EUR`）改为调用共享工具并传入登录下发的 `currency`
- [x] 1.6 检查 `customer-home.tsx` 中金额展示（订单余额、支付、退款表单）是否有独立硬编码货币，统一改为共享工具
- [ ] 1.7 手动验证：为两个不同 `defaultCurrency` 的租户各登录一次客户/配送员/门店主账号，确认三端金额展示的货币码均与租户配置一致且互不残留

## 2. 派单看板门店/配送员选择器（`delivery-dispatch`）

- [x] 2.1 在 `apps/api/src/modules/mobile/owner` 下新增只读端点：门店列表（按 `tenantId` 过滤，复用 `tenant/branches` 仓储查询逻辑）
- [x] 2.2 新增只读端点：配送员列表（按 `tenantId` 及可选 `branchId` 过滤，复用 `pos/staff` 仓储查询逻辑，筛选配送员角色）
- [x] 2.3 为以上两个端点补充与其他 `mobile/owner/*` 端点一致的鉴权中间件，并验证跨租户请求返回空/403
- [x] 2.4 在 `@cleanhub/api-client` 中新增对应的类型与调用方法
- [x] 2.5 在 `apps/mobile-web/src/features/owner/queries` 新增门店列表、配送员列表查询封装
- [x] 2.6 将 `owner-home.tsx` 中 `branchId` 的纯文本输入替换为门店下拉/搜索选择器
- [x] 2.7 将 `owner-home.tsx` 中 `assigneeUserId`（派单/改派/接受预约动作里的指派人）纯文本输入替换为基于所选门店的配送员选择器
- [ ] 2.8 手动验证：门店主在派单看板依次选择门店、配送员并完成派单/改派/接受预约，确认不再需要手打任何 ID

## 3. 客户端首页概览（`customer-mobile`）

- [x] 3.1 在 `customer-home.tsx` 中为 `resume`（首页）Tab 编写独立的概览组件，与 `orders` Tab 使用的 `ActivityView` 区分开
- [x] 3.2 基于已加载的 `activity`、`appointments` 数据在前端聚合：下一条待处理事项、进行中/待取数量统计
- [x] 3.3 抽出与订单 Tab 共用的状态分组函数（复用 `getActivityStatusGroup` 等既有逻辑），确保首页统计口径与订单列表一致
- [x] 3.4 在首页概览中加入"发起新预约"快捷入口，复用现有 `AppointmentFormSheet`
- [x] 3.5 补充空状态：客户无任何预约/进行中订单/工单时展示引导文案而非空白
- [ ] 3.6 手动验证：分别在"有进行中订单"“无任何记录”两种账号下查看首页，确认展示内容与订单 Tab 统计一致且不再是重复列表

## 4. 详情视图 URL 恢复（`mobile-shell`）

- [x] 4.1 设计 URL 查询参数约定（如 `?view=order&id=<id>`、`?view=task&id=<id>`），确认与 Capacitor 静态导出打包方式兼容（不使用 Next.js 动态路由段）
- [x] 4.2 在 `customer-home.tsx` 中为订单/工单详情 Sheet 打开/关闭时同步 `history.pushState`/`history.replaceState`，页面加载时读取查询参数还原 `selectedActivity`
- [x] 4.3 在 `delivery-home.tsx` 中为任务详情做同样的 URL 同步与还原
- [x] 4.4 处理无效/跨租户/跨账号标识：请求详情失败时展示未找到或无权限提示，并清理 URL 中的无效参数
- [ ] 4.5 在 Android/iOS（Capacitor 模拟器或真机）验证物理返回键/侧滑手势与 `pushState` 历史栈的交互，若行为异常则按设计文档中的退化方案调整（仅支持深链进入，不强求逐级返回）
- [ ] 4.6 手动验证：刷新详情页面、通过带参数的链接直接打开应用，确认能正确恢复到对应订单/任务详情

## 5. 回归检查

- [x] 5.1 `pnpm --filter @cleanhub/mobile-web typecheck`
- [x] 5.2 `pnpm --filter @cleanhub/mobile-web lint`
- [x] 5.3 `pnpm --filter @cleanhub/mobile-web build`（确认静态导出仍然成功）
- [x] 5.4 `pnpm --filter @cleanhub/api typecheck`（如涉及新增端点）
- [ ] 5.5 手动过一遍客户/配送员/门店主三个角色的登录与核心业务路径，确认本次四项改动均未影响既有功能

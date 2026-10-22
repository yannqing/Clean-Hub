## Context

`apps/mobile-web` 是通过 Next.js `output: "export"` 静态导出、由 `apps/mobile` 的 Capacitor 壳打包的单一 H5 应用（见 `mobile-shell` 规格）。当前实现是"单入口 + 客户端角色分支"的结构：`app/page.tsx` 只渲染 `MobileAuthShell`，登录后按 `authContext.role` 在同一组件树里切换 `CustomerHome` / `DeliveryHome` / `OwnerHome`，没有使用 Next.js 的多路由文件。

本次改动涉及四个互相独立、但都属于"移动端体验完整度"范畴的问题：

1. 客户端首页（`resume`）Tab 与订单（`orders`）Tab 渲染同一个 `ActivityView`（`customer-home.tsx:1682`），首页没有独立内容。
2. Owner 派单看板的 `branchId`、`assigneeUserId` 是纯文本输入（`owner-home.tsx` 第 1035-1057 行附近），要求操作者记住并手打 ULID。
3. 金额格式化在 `owner-home.tsx` 硬编码 `XOF`，`delivery-home.tsx` 硬编码 `EUR`，后端 `payment.config.ts` 默认值也是 `XOF`；而 `tenants` 表已有 `defaultCurrency` 字段（`packages/db/src/schema/tenancy/tenants.ts:65`），只是没有任何移动端接口把它下发给前端。
4. 客户订单/工单详情、配送任务详情目前只存在于 React state 里（`selectedActivity` / `selectedTaskId`），刷新页面或收到外部链接（如邮件通知里的"查看订单"）都无法直接定位到对应详情。

后端已有可复用的数据源：`apps/api/src/modules/tenant/branches/branches.routes.ts`（门店 CRUD，供 web-admin 用）与 `apps/api/src/modules/pos/staff/staff.routes.ts`（POS 员工列表）。这两个都不在 `mobile/owner` 鉴权域下，需要新增一层只读、按租户+移动端鉴权收窄的包装端点，而不是直接把 tenant/pos 路由暴露给移动端 token。

## Goals / Non-Goals

**Goals:**
- 客户端首页展示与订单列表不同的、有信息增量的概览内容。
- Owner 派单看板的门店/配送员选择改为从真实列表中选，杜绝手打 ULID。
- 移动端三个角色的金额展示统一来自租户的 `defaultCurrency`，不再有硬编码货币冲突。
- 客户订单/工单详情与配送任务详情可以通过 URL 恢复/分享，且不破坏 `mobile-shell` 的静态导出、无 SSR/无服务端 cookie 约束。

**Non-Goals:**
- 不引入真实支付网关（mock 支付网关的替换是独立的、优先级更高的问题，不在本次范围）。
- 不修复 OTP 测试端点的安全问题（另开变更处理）。
- 不实现原生蓝牙打印（另开变更处理）。
- 不改变 Owner 看店的读写权限模型；`delivery-dispatch` 已允许 Owner/门店运营执行派单类写操作，本次只优化"如何选择目标"这一交互层，不新增或收紧写操作的授权范围。
- 不引入完整的 Next.js 服务端路由/SSR；深链能力必须在客户端路由（历史 API + 查询参数）内实现。

## Decisions

**1. 客户端首页改为独立的"概览"视图，而不是复用 `ActivityView`**
首页展示：最近一条待处理事项（下一个预约或最新一条未完结订单/工单）、简要统计（进行中/待取数量）、常用入口（发起预约、查看全部订单）。数据来自现有 `getCustomerOrdersAndTickets` 与 `getCustomerAppointments` 的已加载结果做前端聚合，不新增后端查询，避免额外接口成本。
- 备选方案：调用后端新增一个"客户首页摘要"聚合接口。放弃原因：现有数据已经在 `fetchCustomerSnapshot` 里一次性拉取，前端聚合即可满足展示需求，没必要为此新增后端端点和维护成本。

**2. 新增 `GET /mobile/owner/branches` 与 `GET /mobile/owner/drivers` 只读端点，而不是直接复用 `tenant/branches` 或 `pos/staff`**
移动端 Owner 的鉴权上下文（`MobileAuthContext`，来自 `loginOwner`）与 web-admin/POS 的会话体系不同。新增两个薄包装端点：内部调用现有 `branches` 仓储按 `tenantId` 查询、`pos staff` 仓储按 `tenantId`（可选 `branchId`）查询角色为配送员的员工，返回精简字段（`id`, `name`, `status`）供选择器使用。
- 备选方案：让移动端直接携带 owner token 调用 `tenant/branches`。放弃原因：会把两套鉴权中间件耦合在一起，且 `tenant/branches` 返回字段面向后台管理场景（含地址、税号等），需要额外裁剪；新增薄端点更符合仓库里"移动端有独立 `mobile/*` 模块"的现有分层。

**3. 货币格式化：新增 `packages/i18n` 或 `apps/mobile-web/src/lib` 下的共享 `formatTenantMoney` 工具，货币码来自登录响应/今日摘要接口**
`MobileAuthContext` 或 `MobileOwnerTodaySummary` 增加 `currency` 字段（从 `tenants.defaultCurrency` 读出），前端三个角色页面统一改为调用同一个格式化函数，删除各自的 `formatMoney` 硬编码实现。
- 备选方案：让每个页面各自从某个 config 读取货币码。放弃原因：会重复当前"各页面各写一份"的问题模式；集中成一个共享工具 + 后端下发的字段才能保证一致性。
- 备选方案：把货币码放进 JWT。放弃原因：货币是可变的门店配置，不适合放进有效期较长的 token，改为随查询接口下发更符合"配置随请求更新"的语义。

**4. 深链接：客户端路由状态用 URL 查询参数 + `history.pushState`，不引入 Next.js 动态路由**
`mobile-shell` 要求纯静态导出、无 SSR。给 `customer-home.tsx` 与 `delivery-home.tsx` 增加一层"选中项 ⇄ URL 查询参数"的双向同步（如 `?view=order&id=xxx`），使用浏览器原生 History API 而非 Next.js `useRouter`/动态段，这样仍然只有一个静态 HTML 入口，符合 Capacitor `webDir` 打包要求；外部链接（邮件通知、分享）可以直接带上这些查询参数打开对应详情。
- 备选方案：引入 Next.js App Router 的多页面 + `generateStaticParams`。放弃原因：订单/任务 ID 是运行时动态数据，无法在构建期枚举，与静态导出模式冲突；`mobile-shell` 规格明确禁止依赖 SSR。
- 备选方案：不做 URL 同步，只做"应用内跳转记忆"（如 localStorage 记住最后打开的详情）。放弃原因：无法满足"外部链接可直接打开详情"的诉求，价值有限。

## Risks / Trade-offs

- **[风险] 新增门店/配送员列表端点如果权限校验疏漏，可能让 Owner 看到跨租户数据** → 复用现有 `tenant/branches` 与 `pos/staff` 仓储的按 `tenantId` 查询逻辑，并在薄包装端点上追加与其他 `mobile/owner/*` 端点一致的鉴权中间件与集成测试（校验跨租户请求返回空/403）。
- **[风险] 货币字段下发依赖登录态或摘要接口刷新，若客户端缓存了旧的 `authContext` 可能显示过期货币** → 货币码随 `getOwnerTodaySummary`/`getMobileSession` 等已有的“每次进入页面都会刷新”的接口下发，而不是只在登录时写入一次；本身这些页面已有轮询/刷新逻辑（如 `loadSummary`、`focus` 事件刷新），可以直接复用。
- **[风险] URL 查询参数同步与 Capacitor WebView 的历史栈行为在 Android 返回键上可能不一致** → 需要在 `apps/mobile` 侧手动验证 Android 物理返回键与 iOS 侧滑手势对 `history.pushState` 状态的响应，若行为不一致则退化为"仅支持深链进入，不支持返回键逐级回退"。
- **[权衡] 首页概览复用前端已加载数据而非新建聚合接口**，意味着首页展示的“进行中数量”等统计口径必须与订单/工单列表的筛选口径保持一致，否则数字会对不上；实现时需要抽出共享的统计函数而不是各写一份。

## Migration Plan

1. 后端：新增 `mobile/owner` 只读端点（门店列表、配送员列表）与 `authContext`/摘要接口的 `currency` 字段，均为新增字段/新增端点，不改变现有响应结构，可平滑上线。
2. 前端：先接入货币格式化（风险最低、无跨端依赖），再接入门店/配送员选择器，再做客户端首页概览，最后做 URL 深链同步（改动面最大，放在最后独立验证）。
3. 每一步完成后按 `apps/mobile-web` 现有的手动/`run` 验证方式在浏览器与（如可行）Capacitor 模拟器中验证；无自动化测试覆盖，需人工过一遍客户/配送员/门店主三个角色的关键路径。
4. 回滚策略：四项改动彼此独立、互不依赖，任一项如需回滚，仅需还原对应前端组件与其新增的后端端点/字段，不影响其他三项。

## Open Questions

- Owner 端配送员选择器是否需要区分“在职/离职”“今日排班”等状态过滤，还是先只做“本租户全部配送员”的简单列表？（本次先按最小可用实现：全部启用状态的配送员，排班过滤留待后续）
- 客户端首页概览的“常用入口”具体包含哪些操作（是否包含发起退款申请），需要产品侧确认后再定稿 UI 细节，不影响本次数据与路由层的设计。

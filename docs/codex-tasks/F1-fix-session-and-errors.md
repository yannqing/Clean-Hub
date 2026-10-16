# Codex 任务卡 · F1：修 2 个真 bug（会话过期卡死 + 订单页误报错误）

> 原则：简单、精准、最小改动。只修下面 3 处，别顺手重构别的。纯前端，不改后端。
> 根因已由主控实测定位，直接按指示改即可。

## Bug A — 会话过期后页面永久卡在骨架屏（owner 端最明显）
根因：`apps/mobile-web/src/features/owner/components/owner-home.tsx` 里每个加载器的 `finally` 把「关闭 loading」错误地挡在 `if (!signal?.aborted)` 里。请求被 abort（React StrictMode 重挂载 / 会话过期重试）时就永远不 `setIsLoading(false)` → 一直显示 `MobilePageSkeleton`。

改法（owner-home.tsx，涉及 loadSummary/loadBranches/loadDrivers/loadBoard 等所有加载器，约 242-245 / 265-268 / 306-311 / 339-344 / 379-386 行）：
- **loading 标志一定要在 finally 里无条件关闭**：`setIsLoading(false)` / `setIsBoardLoading(false)` / `setIsDirectoryLoading(false)` 等**不要**再用 `if (!signal?.aborted)` 包住，直接调用。
- **只有「写数据」和 `setError` 才保留 `if (!signal?.aborted)` 守卫**（避免把过期请求的数据/错误写进 UI）。
- 同步检查 `apps/mobile-web/src/features/delivery/components/delivery-home.tsx` 是否有相同 `if (!signal?.aborted) setIsLoading(false)` 模式，有就一并这样改。

## Bug B — 会话过期不回登录页（三端通用）
根因：`apps/mobile-web/src/lib/api-client.ts` 刷新失败时只清了本地 token（clearMobileSession），但没通知 React 外壳，外壳还拿着旧 session 渲染角色首页 → 首页所有请求 401，卡住/报错，不回登录。

改法（最简、集中，一次修好三端）：在 `apps/mobile-web/src/features/auth/components/mobile-auth-shell.tsx` 的启动逻辑里，`loadStoredAuthState()` 拿到 session 后、渲染角色首页之前，**用 `apiClient.mobile.auth.me()` 校验一次**：
- 成功 → 照常进入对应角色首页。
- 抛错（401/会话失效）→ 调用现有的 `clearMobileSession()` / 清空 session state，回到登录页。
- 校验期间沿用现有的 boot loading（`auth.loading` spinner），不要新增骨架。
- 注意：`apiClient.mobile.auth.me()` 已存在（`packages/api-client/src/mobile/auth.ts`）。不要改 api-client 契约。

## Bug C — 订单(跟踪)页顶部误报红色 "Internal server error"（数据其实已加载）
根因：`apps/mobile-web/src/features/customer/components/customer-home.tsx` 的 `fetchCustomerSnapshot()`（约 152 行）用 `Promise.all` 并发 6 个请求；后台自动刷新时只要其中一个（如 orders / refund-requests）偶发 500，整个 `Promise.all` 就 reject → 顶部弹阻塞式红横幅，盖在已经正常显示的订单上方，很吓人。

改法（customer-home.tsx）：
1. 把 `fetchCustomerSnapshot` 的 `Promise.all`（152 行）改成 `Promise.allSettled`：某个子请求失败时保留其余成功的数据（失败项用上一次的值/空值兜底），不要整体 reject。
2. 后台刷新失败**不要盖阻塞横幅**：`loadCustomerData("refresh")` 的 catch（约 281-282 行）里，**已有数据时不要 `setError`**（保留旧数据，静默或最多一个轻提示）；只有首屏 boot、且没有任何数据时才显示错误横幅。
3. 首屏 boot 成功后 `errorKey` 逻辑保持不变。

## 不要做
- 不改后端、不改 api-client 契约、不装依赖、不动 packages/ui。
- 不重构组件结构、不加新功能、不碰其它页面。

## 验收（自检）
```
pnpm --filter @cleanhub/mobile-web typecheck    # 0 error
pnpm --filter @cleanhub/mobile-web lint
```
手动（dev http://localhost:3002）：
- 造一个过期/无效会话（清 token 或用旧 token）打开 → **应回到登录页**，不再卡骨架屏。
- owner 登录后概览正常加载；断网/接口 500 时显示错误而**不是永久骨架**。
- customer 订单页：后台刷新即使某接口 500，**不再弹 "Internal server error" 红横幅**盖住已加载的订单。
返回：改了哪几个文件 + 每个 bug 的改动点。不要 commit（主控审查后提交）。

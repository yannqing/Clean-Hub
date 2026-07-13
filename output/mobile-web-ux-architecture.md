# mobile-web UX 改造 · 架构方案

> 日期：2026-07-07 ｜ 依据：PRD（output/mobile-web-ux-prd.md）
> 原则：纯前端；组件下沉到 app 级共享层；三个上帝组件按 Tab 拆分；API 层零改动。

## 1. 目标目录结构

```text
apps/mobile-web/src/
  components/                       # app 级公共组件（本次核心新增）
    mobile-tab-bar.tsx              # 通用底部导航
    skeletons.tsx                   # SkeletonBlock / SkeletonCard / SkeletonMetricTile / SkeletonList
    empty-state.tsx                 # 统一空态
    status-badge.tsx                # 统一状态徽章（tone: neutral|info|success|warning|danger）
    metric-tile.tsx                 # 指标磁贴（可点下钻）
    section-card.tsx                # 运营卡容器
    alert-banner.tsx                # error|warning|info|cache 横幅
    pull-to-refresh.tsx             # 下拉刷新容器（touch 事件，无新依赖）
    status-timeline.tsx             # 垂直状态时间轴
    form-sheet.tsx                  # 底部表单 Sheet 基座（header+错误位+内容+sticky footer）
    confirm-sheet.tsx               # （已有，保留）
    workspace-header.tsx            # （已有，扩展 menuChildren 插槽，供“我的”迁移前过渡）
  hooks/
    use-auto-refresh.ts             # focus/visibilitychange 自动刷新（从 customer-home 抽出）
    use-tab-history.ts              # Tab ↔ URL(?tab=) 同步 + popstate 返回
  features/
    customer/components/
      customer-home.tsx             # 瘦身为编排层：TabBar + 4 个 Tab 容器 + Sheet 编排
      tabs/
        customer-overview-tab.tsx
        customer-orders-tab.tsx
        customer-appointments-tab.tsx
        customer-profile-tab.tsx
      customer-views.tsx            # 保留纯展示组件；TabBar/EmptyState/StatusBadge 改用公共组件
      customer-form-sheets.tsx      # 改用 FormSheet 基座 + inline 校验
    delivery/components/
      delivery-home.tsx             # 瘦身为编排层：TabBar + tasks/profile Tab + Sheet 编排
      tabs/
        delivery-tasks-tab.tsx      # 分段筛选 + 任务列表
        delivery-profile-tab.tsx    # 司机信息/设备/离线队列/语言/登出
      delivery-task-list.tsx        # 卡片信息增强；Banner 改 AlertBanner
      delivery-task-detail-sheet.tsx# 移除打印区；地址→导航深链按钮
      delivery-task-action-sheets.tsx# 异常 Sheet 前接 ConfirmSheet
      lib/navigation.ts             # 新增：地图导航深链（Capacitor 平台探测 + web 回退）
    owner/components/
      owner-home.tsx                # 瘦身为编排层：TabBar + 4 Tab + ActionSheet 编排
      tabs/
        owner-overview-tab.tsx      # 指标 + 预约汇总 + 配送汇总（激活 deliverySummary）
        owner-dispatch-tab.tsx      # 筛选卡 + 预约卡 + 派单卡
        owner-refunds-tab.tsx       # 退款审批（前端门店过滤）
        owner-profile-tab.tsx       # 租户信息/语言/登出
      owner-board-components.tsx    # 保留业务展示件；通用件换公共组件
      owner-task-detail-sheet.tsx   # 新增：任务/预约下钻详情 Sheet
```

## 2. 状态与数据流（不变项 + 变更项）

**不变**：queries/actions → `@/lib/api-client` → `packages/api-client` 分层；幂等键、离线队列、支付轮询、token 刷新单飞锁全部保持。

**变更**：
1. 三端 home 从「上帝组件」拆为「编排层 + Tab 容器」。**状态所有权下放**：Tab 私有数据（如 owner 退款列表）移入对应 Tab 容器；跨 Tab 共享状态（session、筛选器、selectedTask、Sheet 开关）留在 home 编排层，经 props 下传——不引入全局状态库。
2. `useTabHistory(tabs, defaultTab)`：`?tab=` 写 URL（replaceState 首次 / pushState 切换），popstate 恢复；与 customer 现有 detail-url 深链共存（detail 参数优先）。
3. `useAutoRefresh(callback, { minIntervalMs })`：统一三端回前台刷新；owner/delivery 补齐该能力。
4. `PullToRefresh`：容器级 touch 手势（scrollTop===0 时下拉超阈值触发），与页面滚动互斥；刷新回调复用各 Tab 已有 load 函数。

## 3. 关键设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 组件放哪 | `apps/mobile-web/src/components`，不进 packages/ui | 仅 mobile-web 使用；CLAUDE.md 规定 app 级共享放 app 内；避免动 vendor 区 |
| Tab 实现 | 受控 state + URL 同步，不用 Next.js 多路由 | 保持 SPA/离线壳架构不变，改造面最小；路由化留待后续迭代 |
| 下拉刷新 | 自研轻量 touch 容器 | 不新增依赖；Capacitor WebView 内行为可控 |
| 时间轴数据 | 前端由状态枚举推导阶段序列 | 后端无时间线接口；订单/工单状态机是稳定枚举 |
| owner 下钻详情 | 复用 board 列表项已有字段渲染详情 Sheet | 不新增 API；`delivery.getTask` 对 owner 角色的权限未验证，不冒险 |
| 打印死 UI | 移除 UI 入口，保留 lib 代码 | 后端/硬件就绪后可快速恢复；不给用户永久禁用按钮 |
| 导航深链 | `geo:`(Android) / `maps://`(iOS) / Google Maps URL(web 回退) | 纯前端；地址 encodeURIComponent 进 query |
| i18n | 新 key 进三语文件，TranslationKey 类型兜底 | 现有机制；类型不同步会编译报错 |

## 4. i18n key 规划（新增，三语同步）

```text
common.pullToRefresh.{pull,release,refreshing}
common.timeline.*（阶段通用词）
common.tabs.profile / common.actions.{navigate,call,viewAll}
customer.timeline.*（order/ticket 阶段文案）
delivery.tabs.{tasks,profile} / delivery.filters.{all,todo,inProgress,done}
delivery.actions.navigate / delivery.confirm.exception.*
delivery.profile.*（设备/队列区块）
owner.tabs.{overview,dispatch,refunds,profile}
owner.scope.{todayTenant,branchAllDates}
owner.deliverySummary.*（激活死数据的四行文案——已有 key 则复用）
```

> 实施时先盘点已有 key，能复用不新增；新增 key 由主控统一写入三语文件（避免并行 agent 冲突）。

## 5. 并行实施与文件所有权（防冲突）

| 批次 | 内容 | 文件所有权 | 方式 |
|---|---|---|---|
| Batch 0 | 公共组件 + hooks + i18n key（全部新文件 + 三语文件） | components/ hooks/ i18n | **主控串行完成**（共享地基，不并行） |
| Batch 1 | customer / delivery / owner 三端改造 | 各自 features/<端>/ 目录，互不相交 | **3 个 agent 并行**（worktree 隔离），禁止碰 components/hooks/i18n/其他端 |
| Batch 2 | 集成验收：typecheck/lint/build + Playwright 三端截图走查 + 修复 | 全仓 | 主控串行 |

并行 agent 约束：若发现公共组件缺口/需要新 i18n key，**报告给主控**统一补充，不得自行修改共享文件。

## 6. 验证方案

1. `pnpm --filter @cleanhub/mobile-web typecheck && lint && build` 全绿。
2. Playwright（已有 mcp）移动视口 390×844 三端走查截图：登录→各 Tab→详情 Sheet→关键操作弹层。
3. 行为回归清单：支付回跳轮询、离线队列重放、详情深链返回键、语言切换三语、登出。

# mobile-web UX 改造 · 调研结论（research）

> 日期：2026-07-07 ｜ 调研方式：4 个并行研究 agent 全量读码（customer / delivery / owner / 后端+共享层）
> 范围：apps/mobile-web 三端（customer 客户端、delivery 骑手端、owner 店主端）

## 1. 总体结论

- **数据层健康**：三端所有业务数据均接真实后端 API（`/mobile/*`），无 mock 假数据；支付/派单/状态流转均带幂等键。数据不是问题，**问题集中在信息架构与交互层**。
- **信息架构不统一**：
  - customer 端已有底部 4 Tab（resume/orders/appointments/profile），达标；
  - **owner 端 = 单页长滚动堆叠**（指标+筛选+预约卡+派单卡+退款卡全在一屏滚），无任何导航——用户抱怨的「全部展示在一页」主要就是这里；
  - delivery 端 = 单一「今日任务」列表 + Sheet 分层，无一级导航、无筛选分段。
- **公共组件几乎为零**：`packages/ui` 只有 13 个 shadcn 原语；TabBar/骨架屏/空态/状态徽章/指标磁贴/横幅在三端各自手写了 3 遍，风格不一致。
- **上帝组件**：customer-home.tsx 1191 行、delivery-home.tsx 993 行、owner-home.tsx 827 行，各持 20~30 个 useState。

## 2. 三端关键发现速览

### customer（最完善）
- ✅ 4 Tab + 8 个底部 Sheet + 空态齐全 + 焦点自动刷新 + 支付幂等 + 详情深链（返回键可关 Sheet）
- ❌ 无骨架屏（spinner）、无下拉刷新、Tab 不进历史栈、无 inline 表单校验、订单进度只有一个 Badge 无时间轴、概览指标不可点下钻、无搜索分页

### delivery（骨架好，断点明确）
- ✅ 「列表→详情 Sheet→动作 Sheet」三级分层清晰；离线队列+缓存+自动重放、拍照压缩预签名上传、电子签名、GPS 注入全部真实可用
- ❌ 无 Tab/筛选分段（取送/状态混排）；**导航完全缺失**（地址纯文本，Navigation 图标是装饰）；**打印是死 UI**（`connectPortablePrinter` 恒返回 unavailable，按钮永久禁用）；证据照仅单张；异常上报（不可逆）无二次确认；无下拉刷新/骨架屏；卡片信息过薄（无件数/金额/时间窗）
- 后端已有 dispatch/reassign/cancel API 但骑手端未接（接单语义缺失）

### owner（最原始，重灾区）
- ✅ 「预约受理→生成任务→派单/改派/取消→退款审批」调度主链真实打通；概览数字为真实 SQL 统计
- ❌ **单页长滚动无任何导航**；列表加载态用文字「加载中」；无回前台自动刷新（customer 有，口径倒挂）；汇总口径混乱（预约汇总=今日租户级 vs 列表=门店级全历史；`summary.deliverySummary` 取了但从未展示=死数据）；退款列表忽略门店筛选；「显示更多」是假分页（后端返回全量历史）；任务不可下钻（无详情/时间线/凭证照片）；指标磁贴不可点；原生 `<select>` 与整体风格割裂

## 3. 后端 API 现实约束（决定改造边界）

**已有、前端可直接用**：三端登录/刷新、customer 全套 CRUD+预约+支付(mock)+退款、delivery 任务/状态/凭证/签名/派单看板、owner 今日汇总/门店/骑手/预约受理、退款审批、媒体预签名上传。

**缺失（前端做不了，需后端新接口，不在本次改造范围）**：
- 客户自助下单（服务目录/报价/建单）
- 配送 GPS 轨迹上报/实时位置
- 应用内通知列表/推送 token
- owner 历史区间统计/多维报表（现仅 today）
- delivery 历史任务列表（现仅 today）
- 真实支付网关（现 mock）
- 评价/评分

**纯前端即可补的能力**（本次重点）：导航深链（地址→地图 App URL）、订单状态时间轴（状态枚举本地渲染）、`deliverySummary` 死数据激活、指标下钻（本地过滤）、退款门店过滤（前端过滤）、所有 IA/组件/交互升级。

## 4. 共享层现状

- `packages/ui`：Sheet（底部抽屉，移动端核心）/Button/Badge/Input/Select/Card 等 13 原语 + sonner Toaster。**无 Tabs、无 Skeleton、无 EmptyState、无底部导航组件**。
- `apps/mobile-web/src/components`：仅 confirm-sheet / workspace-header / language-switcher / i18n-provider / update-required，共 5 个。
- i18n：fr/en/zh-CN 三语对齐（各 ~735 行），TranslationKey 类型安全，按 `common/auth/customer/delivery/owner` 组织。新增 UI 文案需同步三份文件。
- api 分层规范：feature queries/actions → `apps/mobile-web/src/lib/api-client.ts` → `packages/api-client`，无裸 fetch，可直接沿用。

## 5. 结论 → 改造方向

1. **统一信息架构**：三端全部底部 Tab 化（owner 拆单页为 4 Tab；delivery 增加 Tab+分段筛选；customer 保持并微调）。
2. **建立 mobile-web 公共组件层**（仅 mobile-web 使用，按 CLAUDE.md 放 `apps/mobile-web/src/components/`）：TabBar、Skeleton、EmptyState、StatusBadge、MetricTile、SectionCard、AlertBanner、PullToRefresh、StatusTimeline、FormSheet 基座。
3. **交互升级**：骨架屏、下拉刷新、回前台自动刷新（三端统一）、指标下钻、不可逆操作确认、inline 校验、导航深链。
4. **数据/流程贯通**：owner 汇总口径统一+deliverySummary 激活+任务下钻详情；delivery 导航/电话行动化+打印死 UI 处理；customer 订单进度时间轴。
5. **顺带治理**：三个上帝组件按 Tab 拆分为子容器（行为不变的结构化重构）。

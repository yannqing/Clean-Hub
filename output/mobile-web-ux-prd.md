# mobile-web UX 改造 · PRD

> 日期：2026-07-07 ｜ 依据：output/mobile-web-ux-research.md
> 目标：解决「全部展示在一页、无主流 UX 交互、无公共组件统一」三大问题，让三端数据/业务流程合理贯通。
> 边界：**纯前端改造，不新增后端接口，不改变现有 API 契约与业务规则**。需要后端的能力（自助下单/评价/通知中心/历史报表等）明确列为「后续迭代」，本次不做。

## 0. 范围分级

| 级别 | 内容 | 本次是否做 |
|---|---|---|
| P0 | 三端信息架构 Tab 化、公共组件层、加载/空/错误态统一、下拉刷新、确认弹窗、导航深链、订单时间轴、owner 口径修正 | ✅ 做 |
| P1 | 上帝组件拆分（随 Tab 化自然完成）、指标下钻、退款门店过滤、打印死 UI 处理 | ✅ 做 |
| 后续迭代 | 自助下单、评价、消息中心、真实支付、GPS 轨迹、历史报表、蓝牙打印、多张证据照 | ❌ 不做（需后端） |

## 1. Customer 客户端（保持 4 Tab，交互升级）

| # | 需求 | 验收标准 |
|---|---|---|
| C1 | 列表/首页骨架屏 | 首屏与订单列表加载时显示卡片骨架（非 spinner），加载完成无布局跳动 |
| C2 | 下拉刷新 | 4 个 Tab 列表页支持下拉刷新手势，带刷新指示；保留现有焦点自动刷新 |
| C3 | 订单进度时间轴 | 订单/工单详情 Sheet 内展示阶段时间轴（如 已接收→处理中→可取件→已送达），当前阶段高亮，取消/异常态正确显示 |
| C4 | 概览指标可下钻 | 首页 3 个指标卡可点：进行中→orders Tab（对应筛选）、可取件→orders Tab（对应筛选）、预约→appointments Tab |
| C5 | Tab 进历史栈 | 切 Tab 写入 URL（?tab=），系统返回键回上一个 Tab 而非直接退出；详情深链行为保持 |
| C6 | 表单 inline 校验 | 预约/地址/资料表单：字段失焦即时校验、错误显示在字段下方；提交失败自动滚动到首个错误字段 |
| C7 | 统一公共组件替换 | 空态/徽章/横幅/骨架/TabBar 全部替换为公共组件，视觉不回退 |

## 2. Delivery 骑手端（新增 Tab + 任务流强化）

| # | 需求 | 验收标准 |
|---|---|---|
| D1 | 底部 Tab：任务 / 我的 | 「任务」=现有今日任务流；「我的」=司机信息、设备/离线队列状态、语言切换、登出（替代汉堡菜单） |
| D2 | 任务列表分段筛选 | 顶部分段 chips：全部 / 待办 / 进行中 / 已完成（终态），默认「待办」；分段计数徽章 |
| D3 | 任务卡片信息增强 | 卡片展示：任务类型（取/送）、时间窗、客户名、地址、订单金额与支付状态、待同步标记 |
| D4 | 导航深链 | 详情内地址可一键唤起地图导航（geo: / Google Maps / Apple Maps 回退链），电话保持 tel: |
| D5 | 打印死 UI 处理 | 打印机连接恒不可用 → 移除详情内打印区（保留 printing.ts 代码，UI 入口下线），不再展示永久禁用按钮 |
| D6 | 异常上报二次确认 | 异常提交（不可逆、锁死任务）前弹 ConfirmSheet 明确后果 |
| D7 | 下拉刷新 + 骨架屏 + 回前台自动刷新 | 与 customer 端一致的三件套 |
| D8 | 统一公共组件替换 | 同 C7 |

## 3. Owner 店主端（单页拆 4 Tab，重灾区重构）

| # | 需求 | 验收标准 |
|---|---|---|
| O1 | 底部 Tab：概览 / 派单 / 退款 / 我的 | 概览=指标+今日汇总；派单=筛选+预约受理+任务派发；退款=审批列表；我的=租户信息、语言、登出 |
| O2 | 概览页重组 | 4 指标磁贴 + 预约汇总 + **配送汇总（激活 summary.deliverySummary 死数据）**；各汇总行可点跳转对应 Tab；明确标注口径「今日 · 全租户」 |
| O3 | 派单页口径统一 | 预约/任务列表明确标注「按门店 · 全部日期」；门店/骑手/状态筛选迁入派单页顶部，替换原生 select 为 shadcn Select |
| O4 | 任务/预约下钻详情 | 派单列表项可点开详情 Sheet：完整信息 + 状态操作按钮集中于此（列表项保留主操作） |
| O5 | 退款页门店过滤 | 退款列表尊重当前门店筛选（前端按 branchId 过滤，全部门店时显示租户级） |
| O6 | 回前台自动刷新 + 下拉刷新 + 骨架屏 | 与 customer 端一致 |
| O7 | 统一公共组件替换 | 同 C7 |

## 4. 公共组件层（apps/mobile-web/src/components/）

新增（全部 lucide 图标、无 emoji、复用现有 blue/slate 设计语言）：

| 组件 | 职责 | 替换对象 |
|---|---|---|
| MobileTabBar | 通用底部导航（fixed + 安全区 + 徽章计数 + aria） | customer 手写 TabBar，owner/delivery 新增 |
| MobileSkeleton / SkeletonCard | 列表卡骨架、指标骨架 | 三端 spinner/文字加载 |
| EmptyState | 图标+标题+说明+可选动作按钮 | 三端各自手写空态 |
| StatusBadge | 统一状态徽章（色板映射由调用方传入） | 三端三套 Badge 实现 |
| MetricTile | 指标磁贴（可选 onClick 下钻） | owner/customer 各自实现 |
| SectionCard | 标题+动作+内容的运营卡容器 | owner OperationalCard、customer 区块 |
| AlertBanner | error/warning/info/cache 四态横幅 | 三端各自横幅 |
| PullToRefresh | 触摸下拉刷新容器（原生 touch 实现，无新依赖） | 无（新能力） |
| StatusTimeline | 垂直状态时间轴 | 无（新能力，C3 用） |
| FormSheet | 底部表单 Sheet 基座（sticky footer + 安全区 + 错误横幅位） | 三端 8+ 个 Sheet 的重复布局 |
| useAutoRefresh | focus/visibilitychange 自动刷新 hook | customer 内联逻辑，owner/delivery 缺失 |

## 5. 非功能要求

- i18n：所有新增文案进 `packages/i18n` 三语文件（fr/en/zh-CN），沿用 `customer/delivery/owner/common` 子树；不得硬编码文案。
- 不改后端、不改 `packages/api-client` 契约（仅允许前端调用已有方法）。
- 现有业务行为（幂等键、离线队列、支付轮询、深链返回键）不得回退。
- 验证门禁：`pnpm --filter @cleanhub/mobile-web typecheck && lint && build` 全绿；三端手工冒烟（Playwright 截图走查）。
- 图标仅 lucide-react；禁止 emoji 图标；禁止紫粉渐变；沿用现有 blue-600 主色 + slate 中性色。

## 6. 不做清单（防蔓延）

- 不新增任何后端路由/DB 变更
- 不接真实支付网关
- 不做地图内嵌视图（仅深链）
- 不做骑手接单/抢单语义（需产品定义）
- 不动 packages/ui（组件放 mobile-web 本地，符合 CLAUDE.md 分层）

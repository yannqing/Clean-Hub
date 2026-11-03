# mobile-web UX 改造 · UIUX 规范

> 日期：2026-07-07 ｜ 依据：research + PRD
> 基调：沿用现有品牌语言（blue-600 主色 + slate 中性），只做「统一与升级」，不做视觉重制。禁 emoji 图标、禁紫粉渐变；图标一律 lucide-react。

## 1. 设计 token（沿用现有，明确成文）

| Token | 值（Tailwind） | 用途 |
|---|---|---|
| 主色 | `blue-600`（hover `blue-700`，浅底 `blue-50`，文字 `blue-700/900`） | 主按钮、激活 Tab、链接、强调 |
| 中性 | `slate-950/800/600/400/200/100/50` | 文字层级、边框、底色 |
| 成功 | `emerald-600` / 浅底 `emerald-50` 边 `emerald-200` | 完成态、成功横幅 |
| 警告 | `amber-600` / 浅底 `amber-50` 边 `amber-200` | 待处理、警告横幅、缓存提示 |
| 危险 | `red-600` / 浅底 `red-50` 边 `red-200` | 异常/取消/删除/错误横幅 |
| 信息 | `sky-600` / 浅底 `sky-50` | 进行中状态 |
| 圆角 | 卡片/按钮 `rounded-md`，Sheet 顶部 `rounded-t-2xl`（跟随现有 Sheet） | 统一 |
| 阴影 | `shadow-sm`，不用重投影 | 卡片 |
| 页宽 | `max-w-md mx-auto`，左右 `px-5` | 三端一致 |
| 安全区 | 顶 `pt-[max(24px,env(safe-area-inset-top))]`，底部导航含 `env(safe-area-inset-bottom)` | 三端一致 |
| 触控目标 | 主按钮 `h-12`、次按钮 `h-11`、最小可点 44px | 移动端可用性 |
| 字体 | 沿用 globals.css 现有配置 | 不动 |

## 2. 组件规范

### MobileTabBar
- `fixed inset-x-0 bottom-0`，白底 + 顶部 1px `border-slate-200`，内含安全区 padding；页面主体加 `pb-24` 防遮挡。
- 每项：lucide 图标 20px + 11px 标签，激活态 `text-blue-700`（图标 `stroke-[2.25]`）+ 顶部 2px 指示条；非激活 `text-slate-500`。
- 支持 `badgeCount`（红点数字，`bg-red-600 text-white`，>99 显示 99+）。
- `role="tablist"` / `aria-selected`，最多 5 项。
- Tab 图标约定：customer（Home, ListChecks, CalendarClock, User）；delivery（ClipboardList, User）；owner（LayoutDashboard, Send, ReceiptText, User）。

### 骨架屏（skeletons）
- 基元 `SkeletonBlock`：`animate-pulse rounded-md bg-slate-200/80`。
- `SkeletonCard`（列表卡）：头行 60% 宽 + 两行 100%/40%；`SkeletonMetricTile`：2×2 网格用。
- 规则：**首次加载用骨架，二次刷新保留旧数据 + 顶部细进度提示**；骨架数量 = 预期条目 3 个。

### EmptyState
- 居中：圆底图标容器（`bg-slate-100 text-slate-500`，lucide 图标 24px）+ 标题 `text-sm font-medium text-slate-900` + 说明 `text-sm text-slate-600` + 可选主按钮。
- 虚线边框卡片样式对齐现有（`border-dashed border-slate-200`）。

### StatusBadge
- 统一五种 tone：neutral(slate) / info(sky) / success(emerald) / warning(amber) / danger(red)；样式 `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium`，浅底+同系边+深字。
- 各端保留自己的「状态→tone+文案」映射表，组件只管渲染。

### MetricTile
- 白卡：小标签（`text-xs text-slate-600`）+ 数值（`text-2xl font-semibold tabular-nums`）+ 可选图标。
- 可点时：整卡 `<button>`，右上角 ChevronRight 提示，按压 `active:bg-slate-50`；不可点则纯 div。

### SectionCard
- 头部：标题（`text-sm font-semibold`）+ 右侧动作位（如「查看全部」）；内容区自定义；沿用白卡 `border-slate-200 shadow-sm`。

### AlertBanner
- 四态：error(red)/warning(amber)/info(sky)/cache(slate)；结构 = 图标（AlertCircle/TriangleAlert/Info/DatabaseZap）+ 文案 + 可选动作按钮；`rounded-md border px-3 py-2 text-sm`。

### PullToRefresh
- 阈值 64px，指示器：下拉时 RefreshCw 图标随距离旋转，触发后 spin；文案 `common.pullToRefresh.*` 三态。
- 仅当容器 `scrollTop === 0` 时接管手势；刷新中锁定重复触发。

### StatusTimeline
- 垂直：节点圆点 + 连接线；已完成 `bg-blue-600` 实心 + Check 图标，当前 `border-blue-600` 空心 + 脉冲，未来 `bg-slate-200`；取消/异常终态用 red 节点收尾。
- 节点内容：阶段名（必需）+ 说明（可选）。

### FormSheet
- 结构：SheetHeader（标题+描述，`pr-8 text-left`）→ 错误 AlertBanner 固定位 → 滚动内容区 → sticky footer（`-mx-5 border-t bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3`，主按钮 `h-11` 全宽或双列）。
- 高度 `max-h-[92dvh]`；对齐现有 ConfirmSheet 视觉。

## 3. 交互规范

| 场景 | 规范 |
|---|---|
| 加载 | 首载骨架；操作按钮内 Loader2 spin + disabled；同屏同刻仅一个主 loading |
| 刷新 | 下拉刷新 + 回前台自动刷新（间隔 ≥15s 节流）+ 保留手动刷新按钮（owner） |
| 错误 | 页级：AlertBanner(error)+重试按钮；操作级：Sheet 内横幅；成功一律 toast |
| 确认 | 不可逆操作（异常上报、取消任务、拒绝预约/退款、删除地址/联系人）必须 ConfirmSheet，文案写明后果 |
| 表单校验 | 失焦即时校验 + 字段下方红字（`text-xs text-red-600`）+ 提交时滚动到首错字段；必填字段标 `*` |
| Sheet 层级 | 最多两层（详情 Sheet → 动作 Sheet）；关闭顺序 = 返回键逐层关 |
| Tab 切换 | 即时切换不转场；未读/待办 Tab 显示徽章计数；切换写 URL 支持返回键 |
| 下钻 | 列表项整卡可点（`active:bg-slate-50`）+ 右侧 ChevronRight；操作按钮 `stopPropagation` |
| 触达反馈 | 所有可点元素有 `active:` 态；主操作按钮防双击（pending disabled） |
| 无障碍 | 图标按钮必带 aria-label；`aria-live` 保留（customer 已有）；对比度 ≥ 4.5:1 |

## 4. 三端页面蓝图（线框级）

### Owner（重灾区 → 4 Tab）
```text
[概览]                      [派单]                    [退款]            [我的]
 头部(租户/日期/状态)         筛选卡(门店|骑手|状态)      门店过滤提示        租户信息卡
 4×MetricTile(可点)          预约 SectionCard          退款卡列表          语言切换
 预约汇总卡→派单Tab            (汇总行+列表+受理/拒绝)     (通过/拒绝,        登出按钮
 配送汇总卡(激活死数据)        派单 SectionCard           带ConfirmSheet)
  →派单Tab                    (汇总行+列表+派/改/取消)
 口径标注:今日·全租户          列表项→详情Sheet
```

### Delivery（2 Tab + 分段）
```text
[任务]                                  [我的]
 头部(司机名)                            司机信息卡
 离线队列 Banner(如有)                    设备/离线队列状态卡
 分段chips: 全部|待办|进行中|已完成        语言切换
 任务卡列表(类型|时间窗|金额|待同步)        登出
  →详情Sheet(时间轴位置+导航/电话按钮
    +证据照+主操作sticky)
  →动作Sheet(异常带确认|拍照|签名)
```

### Customer（4 Tab 保持，升级点标注）
```text
[首页]              [订单]               [预约]          [我的]
 下一步卡           筛选chips(保持)        预约列表         (保持)
 3×MetricTile(可点) 订单卡列表            +新建预约        +inline校验
 快捷按钮(保持)      →详情Sheet          (FormSheet化)
                     +StatusTimeline
全局: 骨架屏 + PullToRefresh + Tab写URL
```

## 5. 自检清单（每个 UI PR 交付前）

- [ ] 无 emoji 字符（U+2600-27BF, U+1F300-1FAFF）；图标全部 lucide-react
- [ ] 颜色仅用 §1 token；无紫粉渐变、无随意 hex
- [ ] 文案全部走 i18n（fr/en/zh-CN 三语齐）
- [ ] 底部导航不遮挡内容（pb-24）；安全区完整
- [ ] 加载/空/错误三态齐备；不可逆操作有确认
- [ ] typecheck / lint / build 全绿

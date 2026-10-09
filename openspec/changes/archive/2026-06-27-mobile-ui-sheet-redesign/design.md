## Context

`apps/mobile-web` 是一套静态导出（`output: "export"`，无 SSR/middleware/proxy）的 Next.js 代码，由 `apps/mobile` 的 Capacitor 壳打包为 Android/iOS。当前由 `MobileAuthShell` 根据登录角色直接渲染 `DeliveryHome` / `OwnerHome` / `CustomerHome`，三者均把详情、表单、多步操作纵向平铺在单页：

- 配送端 [delivery-home.tsx:745-1029](apps/mobile-web/src/features/delivery/components/delivery-home.tsx#L745-L1029)：选中任务后一屏铺开「详情 + 状态推进 + 异常 + 拍照 + 签名」5 段。
- 客户端 [customer-home.tsx:796](apps/mobile-web/src/features/customer/components/customer-home.tsx#L796) 详情就地展开；[customer-home.tsx:940-1018](apps/mobile-web/src/features/customer/components/customer-home.tsx#L940-L1018) 预约表单常驻铺开；底部 Tab 实为顶部 sticky。
- `@cleanhub/ui` 已有居中 `Dialog`（基于 `radix-ui` 的 Dialog primitive，见 [dialog.tsx](packages/ui/src/components/ui/dialog.tsx)），但**无 Bottom Sheet**，且移动端未引用任何浮层。

约束：`packages/ui/src/components/ui` 为 shadcn 生成区，需贴近上游写法新增 primitive，不在其中写业务逻辑；默认法语；满足移动触控可用性基线与 `safe-area`。本设计落地用户已确认的方向：**三角色全做 + 底部 Sheet 为主 + 基于现有 Radix Dialog 自建 Sheet**。

## Goals / Non-Goals

**Goals:**

- 在 `packages/ui` 新增可复用的 Bottom Sheet primitive，复用 `@radix-ui/react-dialog`，零新增运行时依赖，风格对齐现有 `dialog.tsx`。
- 三角色从「平铺堆叠」改为「列表/概览主屏 + Sheet 浮层操作」，每屏单焦点。
- 配送端消除超长滚动：详情走 Sheet，主状态推进走固定底部操作栏，异常/拍照/签名走二级 Sheet。
- 客户端底部 Tab 下移到底部；订单/工单详情、预约表单 Sheet 化。
- 保持后端 API、DTO、状态机、权限隔离、离线同步队列完全不变。

**Non-Goals:**

- 不改 `apps/api`、`packages/api-client` 的任何方法/DTO，不改状态机与权限边界。
- 不引入 `vaul` 或其他第三方 drawer 库。
- 不重构离线同步队列、鉴权与租户上下文逻辑。
- 不做多语言扩展（保持法语默认）。
- 不触碰 `desktop` / `pos-web` / `web-admin`。

## Decisions

### 决策 1：Bottom Sheet 基于现有 Radix Dialog 自建

新增 `packages/ui/src/components/ui/sheet.tsx`，封装 `@radix-ui/react-dialog`，导出 `Sheet` / `SheetTrigger` / `SheetClose` / `SheetContent` / `SheetHeader` / `SheetFooter` / `SheetTitle` / `SheetDescription`，镜像 `dialog.tsx` 的结构与 `data-slot` 风格。`SheetContent` 支持 `side` 变体（`bottom` 为移动端默认，保留 `right/left/top` 以备复用），底部变体固定贴底、圆角顶、带下拉指示条，内容区可滚动并贴 `env(safe-area-inset-bottom)`。

- 备选 A：引入 `vaul` —— 否决，新增依赖，本期不需要原生级拖拽。
- 备选 B：维持就地展开 —— 否决，正是当前问题根因。
- 可访问性：Radix 自带 focus trap / ESC / `aria-*`，`SheetContent` 必须含 `SheetTitle`（可视或 `sr-only`）。

### 决策 2：信息架构改为「一屏一焦点」

- **配送端**：任务列表为主屏 → 点任务打开**任务详情 Sheet（近全高）**，详情底部为固定主操作栏（状态推进按钮）；「异常 / 拍照 / 签名」从详情内按钮触发**二级 Sheet**（单一表单，关闭回详情）。嵌套深度限两层。
- **客户端**：4 个底部 Tab（首页/订单/预约/我的）下移到底部；`orders` 列表项点击 → 详情 Sheet；`appointments` 顶部「+ 新建预约」按钮 → 表单 Sheet，列表常驻为主屏。
- **店主端**：保持只读概览为主屏，节奏统一；如需指标明细走轻量 Sheet，不引入任何写操作入口。

### 决策 3：固定主操作栏与 safe-area

每屏的主 CTA（配送状态推进、Sheet 内提交）置于贴底固定栏，`padding-bottom` 取 `max(…, env(safe-area-inset-bottom))`；Sheet 同样适配，避免被刘海/手势条遮挡。

### 决策 4：状态管理沿用现有 useState

各 home 组件维持现有 `useState`/`useTransition`，仅新增 Sheet 开关状态（如 `activeSheet` / `detailOpen`）。不引入新状态库，降低回归面。

## Risks / Trade-offs

- [Radix Dialog 无原生拖拽下滑关闭] → 用下拉指示条 + 遮罩点击 + 关闭控件关闭；如后续确需真·拖拽再评估 `vaul`。
- [Sheet 嵌套过深（详情 → 二级表单）] → 限两层；二级 Sheet 打开时详情保持挂载；信息密度过高时退化为详情内分段。
- [静态导出 / Capacitor WebView] → Sheet 为 `"use client"` 组件，Portal 渲染至 `body`，无 SSR 风险，与 `output: "export"` 兼容。
- [键盘弹出遮挡 Sheet 内输入] → Sheet 内容区可滚动，输入聚焦时滚入可视区。
- [交互改动面大的回归风险] → 后端契约零改动；按角色分步改造，每步做前端运行时验证 + UI 走查。

## Migration Plan

纯前端增量，无数据迁移。顺序：① `packages/ui` 落 Sheet 并 `typecheck`/`build`；② 配送端改造（问题最重）→ 运行时验证；③ 客户端改造 → 验证；④ 店主端微调 → 验证。回滚为组件级，可按角色单独 revert。

## Open Questions

- Sheet 是否需要真·拖拽手势关闭（当前指示条 + 遮罩已够用）。
- 配送详情二级动作用「二级 Sheet」还是「详情内分段 Tab」，实现时按信息密度最终定（默认二级 Sheet）。
- 客户订单详情 Sheet 是否需要半高/全高 snap（默认自适应内容、超高可滚动）。

## 1. Bottom Sheet 组件（packages/ui）

- [x] 1.1 新增 `packages/ui/src/components/ui/sheet.tsx`，封装 `@radix-ui/react-dialog`，导出 `Sheet` / `SheetTrigger` / `SheetClose` / `SheetContent` / `SheetHeader` / `SheetFooter` / `SheetTitle` / `SheetDescription`，对齐 `dialog.tsx` 的 `data-slot` 与 `cn` 风格
- [x] 1.2 `SheetContent` 支持 `side` 变体（默认 `bottom`），底部变体贴底、顶部圆角、带下拉指示条、内容区可滚动并以 `env(safe-area-inset-bottom)` 适配 safe-area
- [x] 1.3 在 `packages/ui/src/components/ui/index.ts` 导出 sheet；运行 `pnpm --filter @cleanhub/ui typecheck` 与 `pnpm --filter @cleanhub/ui build` 通过

## 2. 配送端改造（DeliveryHome，问题最重）

- [x] 2.1 将任务列表设为主屏，移除选中任务后就地铺开的 5 段 section（[delivery-home.tsx:745-1029](apps/mobile-web/src/features/delivery/components/delivery-home.tsx#L745-L1029)）
- [x] 2.2 点击任务打开「任务详情 Sheet（近全高）」：承载客户/地址/电话/关联订单工单摘要，新增 `detailOpen` 开关状态
- [x] 2.3 任务详情 Sheet 内置固定底部主操作栏，承载状态推进按钮（沿用 `nextStatusOptions` 与 `handleStatusUpdate`，状态机/接口不变）
- [x] 2.4 异常上报、拍照取证、客户签名改为从详情 Sheet 触发的二级 Sheet（单一表单，关闭回详情，嵌套不超过两层）；签名 canvas 在 Sheet 内正常绘制
- [x] 2.5 顶部保留同步状态条与 Sync 按钮；确认离线队列、GPS/相机调用、`runAction` 逻辑未改动
- [x] 2.6 运行 `pnpm --filter @cleanhub/mobile-web dev` 做配送端运行时验证 + UI 走查（法语、触控、safe-area、Sheet 手势关闭与焦点）

## 3. 客户端改造（CustomerHome）

- [x] 3.1 将 4 个 Tab 主导航由顶部 sticky 下移为底部 Tab Bar（[customer-home.tsx:532-553](apps/mobile-web/src/features/customer/components/customer-home.tsx#L532-L553)），并适配 `env(safe-area-inset-bottom)`
- [x] 3.2 `orders` 列表项点击改为打开「详情 Sheet」，移除就地展开的 `ActivityDetailPanel` 堆叠（[customer-home.tsx:796](apps/mobile-web/src/features/customer/components/customer-home.tsx#L796)）
- [x] 3.3 `appointments` 的「新建预约」表单由常驻铺开改为顶部「+ 新建预约」按钮触发的表单 Sheet（[customer-home.tsx:940-1018](apps/mobile-web/src/features/customer/components/customer-home.tsx#L940-L1018)），列表常驻为主屏；保留 `handleCreateAppointment` 逻辑
- [x] 3.4 运行客户端运行时验证 + UI 走查（详情/预约 Sheet 流程、Tab 切换、错误/成功提示位置）

## 4. 店主端微调（OwnerHome）

- [x] 4.1 保持只读概览主屏与无写操作语义，统一卡片/间距节奏；如需指标明细以轻量 Sheet 呈现（不新增任何写入口）
- [x] 4.2 运行店主端运行时验证 + UI 走查

## 5. 整体验证与收尾

- [x] 5.1 自检：移动端三角色页面详情/表单/破坏性操作均经 Sheet 承载，无就地纵向堆叠，无 emoji 充当图标，颜色取自既有 token
- [x] 5.2 确认 `apps/api`、`packages/api-client`、离线同步、鉴权/租户逻辑零改动（仅前端 diff）
- [x] 5.3 运行 `pnpm --filter @cleanhub/mobile-web typecheck`、`pnpm --filter @cleanhub/mobile-web lint`、`pnpm --filter @cleanhub/mobile-web build` 全部通过

## Why

当前 `apps/mobile-web` 的三个角色页面（配送 / 客户 / 店主）把详情、表单与多步操作全部纵向平铺在单个滚动页里，**全应用零浮层**（已确认无任何 Dialog/Sheet/Drawer 使用）。配送端选中任务后会一次性铺开「详情 + 状态推进 + 异常 + 拍照 + 签名」5 大操作区，单手现场操作需反复长滚动查找当前动作，不符合主流移动端「一屏一焦点 + 浮层承载操作」的交互范式，直接影响可用性与现场效率。

## What Changes

- 在 `@cleanhub/ui` 新增基于现有 `@radix-ui/react-dialog` 的 **Bottom Sheet 组件**（底部抽屉），作为移动端详情、表单与确认操作的统一浮层载体，**零新增运行时依赖**。
- **配送端 `DeliveryHome`**：任务列表作为主屏，任务详情、状态推进、异常上报、拍照取证、客户签名由「一屏全铺」拆分为按需 Sheet + 固定底部主操作栏，消除超长滚动。
- **客户端 `CustomerHome`**：订单/工单详情改为底部 Sheet 呈现；「新建预约」表单由常驻铺开改为按需 Sheet 触发；底部 Tab 主导航由当前顶部 sticky 下移到底部。
- **店主端 `OwnerHome`**：保持只读概览语义，统一卡片与间距节奏，必要明细走轻量 Sheet。
- 沉淀**统一移动端交互基线**：底部 Tab 主导航、Sheet 浮层、固定主操作栏、一屏一焦点信息架构、手势关闭与可访问性。
- **不改动**任何后端 API、数据契约、权限隔离、状态机或离线同步逻辑。

## Capabilities

### New Capabilities

<!-- 本次不引入新的业务能力；Bottom Sheet 组件属于实现载体，归入 design/tasks。 -->

（无）

### Modified Capabilities

- `mobile-shell`: 在现有「移动端 UI 基线」之上新增「移动端交互模式与信息架构基线」需求——详情/表单/破坏性确认通过底部 Sheet 承载，主导航采用底部 Tab，关键操作走固定底部主操作栏，每屏聚焦单一任务、避免无限纵向堆叠。该需求约束所有角色页面的呈现形态，但不改变各角色的后端数据行为与权限边界。

## Impact

- **代码**：`packages/ui`（新增 sheet 组件）、`apps/mobile-web` 的 `delivery-home.tsx` / `customer-home.tsx` / `owner-home.tsx` / `mobile-auth-shell.tsx`。
- **依赖**：复用已安装的 `@radix-ui/react-dialog`，无新增运行时依赖。
- **不受影响**：`apps/api`、`packages/api-client` 的方法与 DTO、离线同步队列、鉴权 / 租户上下文逻辑保持不变。
- **验证重点**：前端运行时验证 + UI 走查（默认法语、触控可用性基线、Sheet 手势关闭与焦点可访问性、`safe-area` 适配）。

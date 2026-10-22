## Why

PRD 把 CleanHub 的第五类产品形态定义为 **Customer / Delivery Mobile**（客户预约、订单状态、通知、取送追踪 + 配送员任务、GPS、拍照、签收），但仓库里 `apps/mobile` 目前只是 Capacitor 占位壳，没有任何 H5 业务页面，后端也没有面向移动端的认证、预约、配送任务模块。经理要求用 Next.js H5 + Capacitor 分发 Android/iOS 的方式落地移动端一期。

本变更把"移动端一期"正式立项为一个**最小可用闭环（MVP）**：客户、配送员、Owner 三条链路真实可跑，而不是一次性建出完整移动平台。

> 范围说明：Phase 1 范围文档原本把客户/配送移动端列为"为 Phase 2 预留架构"。本变更是经过经理确认的**范围提前**，因此用独立 change 立项并约束边界，避免移动端被混成"客户 App + 配送 App + 移动 POS + 老板看店"四件事。移动端**不是**默认收银 POS，门店正式收银入口仍是 Desktop Shell + POS Client。

## What Changes

- **新增 `apps/mobile-web`**：Next.js 移动 H5 业务应用，采用 `output: "export"` 静态导出（不使用 SSR / middleware / proxy / cookie），一套代码同时供 Android/iOS 打包。
- **改造 `apps/mobile`**：Capacitor 壳从占位变为真正加载 `mobile-web` 的导出产物（生产）或 dev 地址（开发），并配置 GPS、相机原生权限与 `cap sync` 流程。
- **新增移动端认证**：基于 Bearer Token（响应体返回、原生安全存储、`Authorization` 头携带）的 `/mobile/auth` 认证域，与 web-admin 的 HttpOnly Cookie 体系隔离。支持客户手机号验证码登录、客户账号密码登录、配送员密码登录、Owner 密码登录、刷新与登出。
- **新增客户侧能力**：查看资料与地址、查看订单/工单状态、创建上门取衣/送洗预约、查看与取消未处理预约。
- **新增配送侧能力**：配送员今日任务列表、任务详情、GPS 定位上报、拍照凭证上传、客户签收、状态流转（待出发→已出发→已到达→已取件→配送中→已签收→异常）。
- **新增 Owner 手机看店**：只读经营摘要（今日订单数、营收、待取、进行中、预约/配送摘要）。
- **新增轻离线能力**：已加载的配送任务本地缓存；状态更新、照片、签收离线排队，恢复网络后按 idempotency key 回放且不重复；最小冲突规则（服务端已完成态不被客户端旧态覆盖）。
- **新增后端移动模块**：`apps/api` 增加 `modules/mobile/{auth,customer,delivery,owner}`，挂载 `/mobile/*` 路由与移动专用鉴权中间件。
- **新增数据库表**：客户凭证与 OTP、移动会话刷新令牌、预约、配送任务/任务事件/配送凭证；并为配送员补 `driver` 角色种子。
- **新增移动 API client**：`packages/api-client` 增加 `src/mobile/*`，使用 Bearer Token provider 而非 cookie。
- **落地 `packages/offline`**：把当前的类型占位补成最小离线队列原语（入队、持久化、回放）。
- **二期边界（本变更不做，BREAKING 风险点显式排除）**：蓝牙打印、完整离线冲突合并、真实 SMS/WhatsApp 供应商深度接入、会员积分/营销/评价/优惠券、地图路线优化与后台派单算法、后台持续定位。

## Capabilities

### New Capabilities

- `mobile-shell`: 移动端运行时与打包能力——`apps/mobile-web` 的 Next.js 静态导出形态、`apps/mobile` 的 Capacitor 封装、租户/pressing code 上下文进入、GPS/相机原生权限声明，以及 build → `cap sync` → Android/iOS 的产物链路。
- `mobile-auth`: 移动端基于 Bearer Token 的认证域——客户验证码登录、客户账号密码登录、配送员密码登录、Owner 密码登录、令牌刷新与登出，以及客户凭证/OTP/移动会话存储与三类角色的访问隔离。
- `customer-mobile`: 客户侧业务能力——个人资料与地址查看、订单/工单状态查看、创建上门取衣/送洗预约、查看与取消未处理预约。
- `delivery-mobile`: 配送员侧业务能力——今日任务列表、任务详情、GPS 定位上报、拍照凭证上传、客户签收，以及配送任务状态机流转。
- `owner-mobile`: Owner 只读手机看店能力——本租户今日订单数、营收、待取、进行中、预约与配送摘要。
- `mobile-offline-sync`: 移动端轻离线能力——配送任务本地缓存、状态/照片/签收离线排队、按 idempotency key 幂等回放与最小冲突规则。

### Modified Capabilities

<!-- openspec/specs/ 当前为空（greenfield），本变更不修改既有 spec 的需求，全部为新增能力。 -->

（无）

## Impact

- **新增应用**：`apps/mobile-web`（Next.js + `output: export`）。
- **改造应用**：`apps/mobile`（Capacitor 配置、原生权限、加载 mobile-web 产物、`cap sync` 脚本）。
- **后端**：`apps/api` 新增 `modules/mobile/{auth,customer,delivery,owner}` 及其 controller/routes/service/repository/types；`app.ts` 挂载 `/mobile/*` 与移动鉴权中间件；新增上传凭证存储接入点。
- **数据库**：`packages/db` 新增 schema —— `commerce/customer-auth`（客户凭证 + OTP）、`identity/mobile-sessions`（移动刷新令牌，多主体）、`appointments/*`（预约）、`delivery/*`（配送任务、任务事件、配送凭证）；新增 `driver` 角色种子；需要 `pnpm db:generate` + `pnpm db:migrate`。
- **API Client**：`packages/api-client` 新增 `src/mobile/*`（auth/customer/delivery/owner + 类型）与 `mobile-client`（Bearer Token provider）。
- **离线包**：`packages/offline` 由类型占位补成最小离线队列原语。
- **认证体系**：新增移动 Bearer 认证路径，需与现有 `AdminRole` 角色模型对齐（扩展 `driver`），但不改动 web-admin / POS 的 Cookie 认证行为。
- **依赖**：`apps/mobile` 引入 `@capacitor/geolocation`、`@capacitor/camera`、`@capacitor/preferences`（或安全存储）等插件；`apps/mobile-web` 引入 Next.js 与移动端 UI 依赖。
- **高风险区**：多租户隔离、配送任务的权限可见性（配送员只能看分配给自己的任务）、离线回放幂等与重复提交、状态机冲突、上传凭证的体积与失败处理。

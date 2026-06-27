## 1. 脚手架与依赖（mobile-shell）

- [ ] 1.1 新建 `apps/mobile-web` Next.js 应用，配置 `next.config` 为 `output: "export"`（禁用 SSR/middleware/proxy），命名 workspace `@cleanhub/mobile-web`
- [ ] 1.2 接入共享配置：`@cleanhub/config`（tsconfig）、eslint、`@cleanhub/ui`、`@cleanhub/i18n`（默认 `fr`）、`@cleanhub/api-client`
- [ ] 1.3 为 `apps/mobile` 增加 Capacitor 插件依赖：`@capacitor/geolocation`、`@capacitor/camera`、`@capacitor/preferences`
- [ ] 1.4 在 `turbo`/根脚本中登记 mobile-web 的 dev/build/lint/typecheck，确认不把 app 级依赖加到根 `package.json`

## 2. 数据库 schema 与迁移（mobile-auth / customer-mobile / delivery-mobile）

- [x] 2.1 新增 `packages/db/src/schema/commerce/customer-auth.ts`：`customer_credentials`（passwordHash，FK `customer_accounts`）、`customer_auth_otps`（phone+code+purpose+expiresAt+attempts）、`customer_auth_refresh_tokens`（tokenHash/familyId/deviceId/expiresAt/revokedAt）
- [x] 2.2 新增领域 `packages/db/src/schema/appointments/appointments.ts`：`appointments`（tenant_id、branch_id、customer_id、type=pickup/dropoff、status=pending/accepted/cancelled/done、expectedAt、address、审计/软删/version）
- [x] 2.3 新增领域 `packages/db/src/schema/delivery/delivery-tasks.ts`：`delivery_tasks`（tenant_id、branch_id、assignee userId、status 状态机、关联 order/ticket、客户地址快照、审计/软删/version）
- [x] 2.4 新增 `packages/db/src/schema/delivery/delivery-task-events.ts`：`delivery_task_events`（task_id、fromStatus/toStatus、lat/lng、deviceId、idempotencyKey、createdAt），对 `(task_id, idempotency_key)` 建唯一约束
- [x] 2.5 新增 `packages/db/src/schema/delivery/delivery-proofs.ts`：`delivery_proofs`（task_id、type=pickup/dropoff/signature、mediaRef、deviceId、idempotencyKey），对 `(task_id, idempotency_key)` 建唯一约束
- [x] 2.6 为新领域建 `index.ts` 并在 `packages/db/src/schema/index.ts` 注册；`commerce/index.ts` 追加 `customer-auth`
- [x] 2.7 新增 `driver` 角色种子（`roles.scope='tenant', code='driver'`）与必要权限种子，保证幂等
- [x] 2.8 运行 `pnpm db:generate`、`pnpm db:migrate`、`pnpm --filter @cleanhub/db typecheck` 全部通过

## 3. 后端：移动认证模块（mobile-auth）

- [x] 3.1 在 `apps/api/src/modules/mobile/auth` 建 `auth.{routes,controller,service,repository,types}.ts`
- [x] 3.2 实现客户手机号验证码登录：请求 OTP（写 `customer_auth_otps`）+ 校验 OTP 登录；提供测试通道获取验证码（无真实 SMS）
- [x] 3.3 实现客户账号密码登录：校验 `customer_credentials`，复用密码哈希与失败锁定策略
- [x] 3.4 实现配送员密码登录：复用 `users` + 校验 `driver` 角色，返回含 tenant/branch/role 的令牌上下文
- [x] 3.5 实现 Owner 密码登录：复用 `users` + 校验 `owner` 角色，返回只读看店上下文
- [x] 3.6 令牌签发与刷新：复用 `token.service` 在响应体下发 access/refresh；客户写 `customer_auth_refresh_tokens`，员工复用 `authRefreshTokens`，实现刷新轮换与登出吊销
- [x] 3.7 新增移动鉴权中间件 `mobile-auth.middleware`（读取 `Authorization: Bearer`，解析主体类型/tenant/role），仅供 `/mobile/*` 使用
- [ ] 3.8 编写认证隔离与登录用例（客户/配送/Owner/跨租户/错误 OTP/错误密码锁定）

## 4. 后端：客户业务模块（customer-mobile）

- [x] 4.1 在 `apps/api/src/modules/mobile/customer` 建模块文件，统一强制按令牌 `tenantId` + 客户身份过滤
- [x] 4.2 实现查看本人资料与地址（基于 `customer_accounts`/`customers`），拒绝越权读取
- [x] 4.3 实现查看本人订单/工单列表与详情（读取 `orders`/`service_tickets`，归属校验）
- [x] 4.4 实现创建上门取衣/送洗预约（写 `appointments`，状态 pending）
- [x] 4.5 实现查看预约列表与取消未处理预约（pending→cancelled；已处理拒绝取消）

## 5. 后端：配送业务模块（delivery-mobile / mobile-offline-sync）

- [x] 5.1 在 `apps/api/src/modules/mobile/delivery` 建模块文件，强制 `tenantId` + `assignee == 当前 driver` 过滤
- [x] 5.2 实现今日任务列表与任务详情（仅本人任务；越权返回 403/404）
- [x] 5.3 实现配送任务状态机（集中转移表）：合法转移写 `delivery_task_events`（含 lat/lng），非法/过旧转移返回 409 + 当前态
- [x] 5.4 实现拍照凭证上传接口（multipart/base64 → 存储抽象 → `delivery_proofs`），关联任务与类型
- [x] 5.5 实现客户签收并置终态（写签收 `delivery_proofs` + 终态事件）
- [x] 5.6 全部写操作接受 `idempotencyKey` 并按唯一约束去重；终态保护（已完成不被旧态覆盖）
- [x] 5.7 （按 Open Question）支持最简任务指派/种子数据，保证配送链路可端到端验收
- [x] 5.8 编写配送权限隔离、状态机非法转移、幂等回放、终态冲突用例

## 6. 后端：Owner 看店模块（owner-mobile）

- [x] 6.1 在 `apps/api/src/modules/mobile/owner` 建模块文件，强制本租户范围且只读
- [x] 6.2 实现今日经营摘要（订单数、营收、待取、进行中、预约/配送摘要），聚合既有表
- [x] 6.3 确认无任何写操作入口；编写跨租户隔离与只读用例

## 7. 后端：路由挂载与集成（全部能力）

- [x] 7.1 新增 `apps/api/src/modules/mobile/mobile.routes.ts` 聚合 `auth/customer/delivery/owner`
- [x] 7.2 在 `app.ts` 挂载 `/mobile/*`：`/mobile/auth` 公开，其余经 `mobile-auth.middleware` 守护（不复用 cookie 中间件）
- [x] 7.3 确认 CORS 允许移动来源与 `Authorization` 头；`pnpm --filter @cleanhub/api typecheck`、`build`、`lint` 通过

## 8. API Client：移动客户端（全部能力）

- [x] 8.1 在 `packages/api-client` 的 HTTP 层支持注入式 token provider（`Authorization: Bearer`），替代 cookie `credentials: include`
- [x] 8.2 新增 `src/mobile-client.ts` 与 `src/mobile/{auth,customer,delivery,owner}.ts(+ .types.ts)`，按域组织、避免大文件
- [x] 8.3 在 `src/index.ts` 导出 mobile client；`pnpm --filter @cleanhub/api-client typecheck`、`build` 通过

## 9. 前端：mobile-web 基座与认证（mobile-shell / mobile-auth）

- [ ] 9.1 搭建 `apps/mobile-web/src/lib/api-client.ts`：环境 base URL + 从原生存储读取 token 的 provider 注入
- [ ] 9.2 实现 token 安全存储/读取/清除（Capacitor Preferences）与登录态守卫（纯 CSR，无 middleware）
- [ ] 9.3 实现租户上下文进入页（输入 pressing code → 解析租户；无效阻止进入）
- [ ] 9.4 实现登录页：客户验证码登录、客户密码登录、配送员/Owner 密码登录（按角色进入不同主页）
- [ ] 9.5 用 `features/**/queries|actions` 封装认证调用，不散落 `fetch`

## 10. 前端：客户侧页面（customer-mobile）

- [ ] 10.1 我的资料与地址页
- [ ] 10.2 订单/工单列表与详情页（状态展示）
- [ ] 10.3 创建上门取衣/送洗预约页
- [ ] 10.4 预约列表与取消未处理预约

## 11. 前端：配送侧页面（delivery-mobile / mobile-offline-sync）

- [ ] 11.1 今日任务列表页（仅本人任务）
- [ ] 11.2 任务详情页（客户/地址/电话/订单摘要）
- [ ] 11.3 状态流转操作 + GPS 上报（`@capacitor/geolocation`，权限拒绝降级提示）
- [ ] 11.4 拍照凭证上传（`@capacitor/camera`，权限拒绝降级提示）
- [ ] 11.5 客户签收并完成任务
- [ ] 11.6 接入离线队列：离线时操作入队并显示"待同步"，恢复网络自动回放

## 12. 前端：Owner 看店页面（owner-mobile）

- [ ] 12.1 看店首页：今日订单数/营收/待取/进行中/预约与配送摘要（只读）

## 13. 轻离线能力（mobile-offline-sync）

- [ ] 13.1 在 `packages/offline` 实现最小队列原语：`enqueue/peek/markSynced/replay` + Preferences 持久化
- [ ] 13.2 为每个离线操作生成 `idempotencyKey`（ULID，经 `@cleanhub/id`）
- [ ] 13.3 实现配送任务本地缓存（断网可查看已加载任务）
- [ ] 13.4 实现恢复网络后顺序回放与失败重试；与后端幂等/终态保护联调

## 14. Capacitor 壳与打包（mobile-shell）

- [ ] 14.1 配置 `apps/mobile` 加载 mobile-web 产物（prod）/ dev server（dev），按环境注入 `server.url`/`webDir`
- [ ] 14.2 添加 Android/iOS 平台，声明 GPS、相机原生权限
- [ ] 14.3 `apps/mobile-web` `next build` 导出 → `cap sync android` 与 `cap sync ios` 均通过

## 15. 验收与全量校验（对照 specs 验收场景）

- [ ] 15.1 Android/iOS 都能打开同一套 mobile H5；默认法语
- [ ] 15.2 客户：输入 pressing code → 验证码登录（测试通道）/ 密码登录 → 查订单/工单 → 创建预约（后台/Owner 可见）→ 取消未处理预约
- [ ] 15.3 配送员：登录仅见本人任务 → 授权 GPS 后状态更新带经纬度 → 上传取件/送达照片 → 客户签收完成
- [ ] 15.4 配送员：离线完成状态/照片/签收，恢复网络后同步成功且不重复（幂等）；服务端终态不被旧态覆盖
- [ ] 15.5 Owner：登录看今日关键指标（仅本租户、只读）
- [ ] 15.6 权限隔离：客户不能访问配送/看店、配送员不能看未分配客户、跨租户均被拒
- [ ] 15.7 构建闭环：`pnpm typecheck`、`pnpm build`、mobile-web export、`cap sync android/ios`、`pnpm --filter @cleanhub/db typecheck` 全部通过

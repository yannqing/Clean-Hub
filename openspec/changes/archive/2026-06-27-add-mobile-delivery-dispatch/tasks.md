## 1. 数据库

- [x] 1.1 `delivery_tasks` 增加可空 `appointment_id`（引用 `appointments`)与 `(tenant_id, appointment_id)` 部分唯一约束（忽略 NULL）
- [x] 1.2 视需要为派单/改派审计补字段（如 dispatchedBy/dispatchedAt），并补必要索引
- [x] 1.3 `pnpm db:generate` 生成迁移、`pnpm db:migrate`、`pnpm --filter @cleanhub/db typecheck` 通过

## 2. 派单后端（delivery-dispatch）

- [x] 2.1 新增门店派单鉴权:校验操作者对目标 `branchId` 的管理权限（owner/门店运营）
- [x] 2.2 派单接口:将 `pending_dispatch` 任务指派给指定配送员（version 乐观锁 + 幂等键 + 仅待派发可派）
- [x] 2.3 改派接口:把未终态任务改派给另一配送员并写事件时间线
- [x] 2.4 取消接口:取消未终态任务、记录原因并写时间线
- [x] 2.5 放开 `createAssignedTask` 的"仅能自派"限制，区分自派与门店派单来源
- [x] 2.6 用 `@cleanhub/logger` 记录派单/改派/取消等高风险动作

## 3. 派单看板（delivery-dispatch）

- [x] 3.1 待派发任务查询:本门店 `pending_dispatch` 列表（客户、地址、ETA）
- [x] 3.2 已派发任务查询:按配送员/状态/时间过滤，强制租户+门店隔离
- [x] 3.3 看板 DTO 与类型定义

## 4. 预约运营（appointment-operations）

- [x] 4.1 接受/拒绝预约接口:门店权限校验，仅 `pending` 可处理，记录处理人/时间/原因
- [x] 4.2 预约转配送:接受时在单事务内置预约 accepted、建待派发任务、写双向关联（防重复转化）
- [x] 4.3 配送进度回写:任务 `signed` 联动预约 `done`；取消联动按产品规则回退
- [x] 4.4 在配送状态流转处接入预约联动 use-case（非数据库触发器）

## 5. API Client

- [x] 5.1 `packages/api-client/src/mobile` 新增派单/改派/取消方法与 DTO
- [x] 5.2 新增预约接受/拒绝/转化方法与 DTO，调整看板查询类型
- [x] 5.3 `pnpm --filter @cleanhub/api-client typecheck` 通过

## 6. 前端（apps/mobile-web）

- [x] 6.1 Owner/门店派单看板:待派发/已派发列表、过滤、派单/改派/取消操作
- [x] 6.2 预约处理界面:接受/拒绝、查看转化出的配送任务
- [x] 6.3 `pnpm --filter @cleanhub/mobile-web typecheck` 与 `lint` 通过

## 7. 测试与校验

- [x] 7.1 派单/改派/取消 smoke:含幂等、并发守卫、越权拒绝
- [x] 7.2 预约转配送 smoke:含防重复转化与状态回写
- [x] 7.3 更新 owner/customer 相关 smoke 中受影响的断言
- [x] 7.4 运行 `pnpm typecheck` 与相关 `lint`，全部通过

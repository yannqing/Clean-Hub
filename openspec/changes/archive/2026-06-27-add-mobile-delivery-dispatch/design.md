## Context

配送任务表 `delivery_tasks` 已具备 `assigneeUserId`(可空)、`status`(起始 `pending_dispatch`)、`branchId`、`orderId`/`ticketId` 关联与状态时间戳;但 service 层 `createAssignedTask` 强制把任务派给操作者本人,且只有配送员角色能进配送模块。`appointments` 表有完整生命周期(pending/accepted/cancelled/done),但与 `delivery_tasks` 无任何关联,接单后不会生成配送任务。Owner 模块当前只读(today summary)。本变更补齐"派单 + 预约转化"的运营闭环。

约束:多租户/门店隔离;派单与改派是高风险动作,需幂等键与并发保护;预约转配送需防重复;遵循 CLAUDE.md 分层(业务规则进 `apps/api`,共享 client 进 `packages/api-client`)。

## Goals / Non-Goals

**Goals:**
- 门店/Owner 可把 `pending_dispatch` 任务派给指定配送员,并支持改派、取消。
- 派单看板:待派发 + 已派发任务,按配送员/状态/时间过滤,展示 ETA。
- 预约接受/拒绝;接受后由预约生成配送任务并双向关联;配送完成回写预约 `done`。
- 派单/改派/转化全部幂等且并发安全。

**Non-Goals:**
- 地图可视化派单、自动路线优化、智能调度算法(后续)。
- 跨门店调度与配送员排班(后续)。
- 配送员侧任务流转/凭证(已在既有 delivery-mobile,不改)。

## Decisions

### 决策 1:派单鉴权改为门店运营角色
新增"门店运营/Owner 可派单"的鉴权路径:派单接口校验操作者属本租户且对目标 `branchId` 有管理权限,而非要求 `assigneeUserId === 自己`。配送员自派路径保留但不再是唯一来源。
- 备选:复用配送员上下文放开校验(否决:越权风险,职责不清)。

### 决策 2:派单/改派用乐观并发 + 幂等键
派单与改派以 `version` 乐观锁更新 `assigneeUserId` 与 `status`,并要求 `idempotency_key`;仅允许对 `pending_dispatch`(派单)或未进入终态的任务(改派/取消)操作。
- 理由:与既有配送状态更新一致(`updateTaskStatus` 已用 version + from-status 守卫),避免重复派发。

### 决策 3:预约转配送以 appointment_id 防重
`delivery_tasks` 增加可空 `appointment_id`(引用 `appointments`),并对 `(tenant_id, appointment_id)` 建唯一约束(忽略 NULL),保证一个预约只能转化出一个有效配送任务。接受预约的动作在单事务内:置 `appointments.accepted`、建 `delivery_tasks`、写关联。
- 备选:仅靠应用层判断(否决:并发下可能重复转化)。

### 决策 4:配送进度回写预约状态
配送任务到达终态时联动预约:`signed` → 预约 `done`;`cancelled` → 视情况回退预约。通过 service 编排(非数据库触发器),在状态流转处调用预约联动 use-case。
- 备选:数据库触发器(否决:业务规则进 DB 难维护,违背 CLAUDE.md)。

### 决策 5:派单看板查询落点
看板查询放在 owner/dispatch 模块,提供 `待派发列表` 与 `已派发列表(按配送员/状态/时间过滤)`,ETA 取 `expectedAt`。复用 `delivery_tasks` 既有索引(`tenant_branch_status`、`tenant_assignee_expected`)。

## Risks / Trade-offs

- [同一任务被并发派给两名配送员] → version 乐观锁 + 仅 `pending_dispatch` 可派 + 幂等键。
- [预约重复转化出多个任务] → `(tenant_id, appointment_id)` 唯一约束 + 单事务。
- [回写预约状态与配送状态不一致] → 联动在 service 同一事务/同一流程内执行,失败整体回滚。
- [放开派单鉴权引入越权] → 严格按 `branchId` 管理权限校验,补充审计日志(高风险动作)。
- [改派后旧配送员仍持有缓存任务] → 改派写事件时间线;配送员侧拉取以服务端为准。

## Migration Plan

1. 迁移:`delivery_tasks` 加 `appointment_id` 与唯一约束;必要的派单审计字段。
2. 上线派单/改派/取消接口与门店派单鉴权(配送员自派保持兼容)。
3. 上线预约接受/拒绝/转化与状态回写。
4. 前端上线 Owner/门店派单看板与预约处理界面。
- 回滚:接口为新增,回滚不影响既有配送员流程与既有预约数据。

## Open Questions

- "门店管理权限"如何界定(owner 角色即可,还是需要更细的门店运营角色)?取决于现有 RBAC。
- 取消配送任务时预约应回到 `accepted` 还是 `cancelled`?需产品确认。
- ETA 暂用 `expectedAt`;是否需要基于位置的动态 ETA 放入后续地图阶段。

## Why

目前配送任务只能由配送员给自己创建（`delivery.service.ts` 的 `createAssignedTask` 强制 `assigneeUserId === 自己`），Owner/门店无法把待办派给配送员;客户预约（`appointments`)创建后也没有"接单 → 生成配送任务"的闭环,预约状态与配送进度互相割裂。这使得"客户预约 → 门店派单 → 配送 → 完成"无法在系统内连贯流转。

## What Changes

- 新增门店/Owner 侧派单能力:把 `pending_dispatch` 配送任务指派给指定配送员、改派、取消;放开"仅能自派"的限制并改为基于角色与租户/门店的派单鉴权。
- 新增派单看板:Owner/门店可查看待派发与已派发任务、按配送员/状态/时间过滤,展示预计时间(ETA)。
- 新增预约运营闭环:门店可接受/拒绝客户预约,接受后由预约生成配送任务（带回 `appointment_id` 关联），并将配送进度回写预约状态(accepted→done / 异常)。
- 配送任务来源扩展:除自派外,支持由派单或预约转化创建;任务携带来源关联(预约/订单/工单)。
- 调度增强(基础):任务列表给出 ETA 与基础排序;地图派单与路线优化列为后续非目标。

## Capabilities

### New Capabilities
- `delivery-dispatch`: 门店/Owner 对配送任务的派单、改派、取消与派单看板（含 ETA 与过滤）。
- `appointment-operations`: 门店对客户预约的接受/拒绝、由预约转化为配送任务，以及配送进度回写预约状态。

### Modified Capabilities
<!-- 配送员侧今日任务/状态机等既有需求不变;任务创建来源的变化属实现细节,不改 delivery-mobile 的 spec 级行为。 -->

## Impact

- 数据库:`delivery_tasks` 增加 `appointment_id` 关联（可空,引用 `appointments`);`appointments` 增加指向生成任务的引用或反查;新增/调整状态联动所需字段与索引。
- 后端:`apps/api/src/modules/mobile/delivery` 放开自派限制并新增派单/改派/取消接口与基于门店的派单鉴权;新增 `appointments` 运营接口(接受/拒绝/转化);可能新增 owner 派单看板查询。
- API Client:`packages/api-client/src/mobile` 新增派单、预约运营方法与 DTO。
- 前端:`apps/mobile-web` Owner/门店侧新增派单看板与预约处理界面;配送员任务来源不变。
- 高风险:派单改派需幂等与并发保护(避免同一任务重复派发/状态错乱);预约转配送需防重复转化。

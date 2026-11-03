## Context

POS Web 已通过共享 API Client 调用独立 API，数据库已有终端设置、订单、支付、服务目录和审计基础表，`packages/offline` 也提供顺序重放队列。但当前授权散落在各 service，浏览器设备 ID 可自行生成，现金支付未完整使用幂等约束，Desktop 与硬件/离线包没有业务接线，staff/shift/handover 仍是 501 scaffold。

本变更横跨 API、数据库、API Client、POS Web、Desktop 和共享包。设计必须保持 tenant/branch 隔离、ULID 主键、HttpOnly 会话和现有前后端分层，并优先形成可在单店试点的闭环。

## Goals / Non-Goals

**Goals:**

- 在服务端建立一致且可测试的 POS 角色与门店授权规则。
- 只允许已登记、启用并绑定门店的可信终端执行 PIN 登录和 POS 写操作。
- 让现金与移动支付在重试、并发和回调场景下保持幂等。
- 让前台按租户服务目录和标准价录单，并记录受控改价原因。
- 接通 Desktop 硬件桥、关键写操作离线队列、同步状态和失败重试。
- 持久化班次、交班和 Z Report，并覆盖关键营业流程测试。

**Non-Goals:**

- 不在本变更中实现供应链、库存采购、复杂促销或会计总账。
- 不支持任意第三方打印机协议；一期以现有 ESC/POS 抽象和可替换适配器为边界。
- 不在浏览器中保存访问令牌，也不绕过现有 API Client 分层。
- 不把全部 POS 数据离线镜像；一期只缓存营业必需读取数据并排队关键写操作。

## Decisions

### 1. API 服务层是授权真源

新增集中式 POS 授权策略，明确 Owner、Manager、Cashier 的敏感操作矩阵，并由每个 service 在读取实体和写入前执行。Owner 可访问租户全部门店；Manager/Cashier 只能访问显式分配且与终端绑定一致的门店；空 `branchIds` 表示无门店权限。前端按同一能力模型隐藏或禁用入口，但不承担安全职责。

选择该方案而不是仅隐藏 UI，因为 API 可能被直接调用，且当前越权正发生在 service 层。

### 2. 终端注册使用服务端签发凭据

复用 `pos_terminal_settings` 作为终端登记记录，增加可轮换的凭据摘要、签发/最后使用时间。Owner/Manager 在已有完整会话下登记终端，API 通过 HttpOnly Cookie（Desktop 通过安全 bridge 持久化）签发原始凭据。PIN 登录同时校验 deviceId、凭据、active 状态和 branch 绑定；未登记终端一律拒绝。

仅依赖 localStorage deviceId 的替代方案不能证明设备身份，因此不采用。

### 3. 数据库约束是支付幂等最后防线

客户端为每次支付意图生成 ULID 幂等键，服务端对所有支付方式强制要求，并在事务中复用已存在的结果。移动支付外部流水采用 tenant + gateway + externalId 的非空唯一约束。冲突时读取并返回已有交易，而不是重复累计订单实收。

### 4. 标准服务目录驱动录单

新增 Cashier 可读、按当前 tenant/branch 过滤的 POS 服务目录端点。订单/工单项目保存 `serviceId` 和价格快照；计价输入根据服务单位支持 quantity、weight 或 bags。价格覆盖只允许 Manager/Owner，并强制 reason，审计同时保存标准价与覆盖价。

### 5. 离线写入采用 ULID 和顺序重放

POS 在联网时仍直接调用 API；网络不可用时，仅把被允许的客户创建、订单创建和状态事件写入现有 `OfflineQueue`。记录在入队前生成 ULID 与幂等键，按门店和设备隔离存储，恢复网络后顺序重放。冲突或永久失败停留在队列并显示可操作错误，不伪装为“已同步”。

### 6. Desktop preload 暴露最小硬件能力

Electron preload 仅暴露类型化的 scan、print、drawer 和 secure terminal credential API；主进程调用 `packages/hardware` 适配器。POS Web 通过运行时 bridge 检测能力，浏览器开发模式使用明确的 unavailable adapter。打印任务具有 ULID、状态和重试，不把 Node/Electron API直接暴露给页面。

### 7. 班次与日结是服务端不可变记录

新增 shift、handover 和 z-report 表。交班事务锁定当前班次、记录现金实点和差异，并创建不可变 Z Report 快照；更正通过单独事件实现，不覆盖历史快照。统计以支付和业务事件为源，客户端 localStorage 只保存未提交草稿。

### 8. 订单展示码必须可稳定解析

保留 ULID 为主键，定义统一的 `OD-<ULID末8位>` 展示码解析与后端查询规则；全局搜索、扫码和列表共用同一常量/方法。若短码不唯一，API 返回冲突而不随意选择订单。

## Risks / Trade-offs

- [终端凭据迁移会使旧终端失效] → 提供 Owner/Manager 重新登记流程和明确错误信息，不保留未登记登录后门。
- [短订单码理论上可能碰撞] → 查询必须检测多结果并要求完整 ULID/扫码值消歧。
- [离线冲突会阻塞后续队列] → UI 显示首个失败项并提供重试/取消；所有写操作保持幂等。
- [交班汇总与实时数据可能竞争] → 在数据库事务中确定截止时间并写入快照，截止后的交易进入下一班次。
- [硬件型号差异] → 通过 adapter 和 capability discovery 隔离；一期验收固定支持清单。

## Migration Plan

1. 增加终端凭据、支付唯一约束、班次/交班/Z Report 表并运行迁移；迁移前检查重复外部流水。
2. 部署兼容读取的新 API 与 API Client，再部署 POS Web/Desktop。
3. 由门店管理员重新登记试点终端，验证 branch 绑定后启用严格 PIN 登录。
4. 先在单门店启用支付幂等、服务目录和交班日结，再开启离线与硬件能力。
5. 回滚时保留新增表和审计数据；可通过功能开关停用离线/硬件入口，但不得恢复未登记终端登录或 Cashier 越权。

## Open Questions

- 首批试点打印机、扫码枪和钱箱的具体型号需在硬件 UAT 前确认。
- 退款是否必须双人复核由运营确认；实现默认 Manager/Owner 单人授权并强制原因。

# CleanHub POS Phase 1 实施对照与限制

## 1. 目的与结论

本文对照 OpenSpec 变更 `complete-pos-phase1` 的六项 capability，记录实现落点、验证证据和剩余限制。结论基于 2026-07-22 的分支验证结果。

六项 capability 的代码、数据库模型、API Client 和 POS/Desktop 接线均已完成，相关类型检查、lint、构建和 smoke 通过。独立临时 PostgreSQL 上已跑通终端登记、PIN 登录、目录下单、支付重试、退款、打印失败审计、交班和 Z Report 链路。

当前仍不满足完整试点验收：没有实体打印机、扫码枪和钱箱验证；应用内浏览器未连接，扫描页面与离线 UI 的完整可见流程未自动化执行。因此 OpenSpec 任务 `6.4` 保持未完成，本变更暂不归档。

## 2. Capability 对照

| Capability | 实现状态 | 主要实现 | 验证证据 | 当前限制 |
| --- | --- | --- | --- | --- |
| `pos-access-control` | 已实现 | API 集中角色、敏感操作、原因和 branch/terminal 访问检查；订单、工单、客户、退款、改价、重打和开箱调用服务端授权；审计包含 actor、terminal、branch、reason、before/after | access-control 与 service smoke；API/POS lint、typecheck；Cashier、空分店、跨店覆盖 | 试点环境仍需按 UAT 使用真实 Owner/Manager/Cashier 账号复核全部入口 |
| `pos-terminal-enrollment` | 已实现 | 终端凭据只保存摘要；登记、查询、轮换、绑定、启停、锁定和恢复 API；PIN 登录校验 active terminal、branch 和 HttpOnly 凭据；失败计数使用服务端终端/网络身份 | terminal-security smoke；临时库真实登记和 Owner PIN 登录；会话返回正确 terminal branch | 终端登记 UI 仍依赖管理流程/API；浏览器 Cookie 清理和网络限流需在试点终端实测 |
| `pos-payment-reliability` | 已实现 | 现金与移动支付强制 idempotency key；tenant/gateway/external reference 唯一约束；不可变退款和支付修正；订单短码统一解析 | order/payment 与 payment-adjustment smoke；临时库现金和 Wave 首次/重试、确认、退款链路；Z Report 分离退款 | 支付修正已提供 API/UI；第三方支付网关并发回调仍需接入真实网关验收 |
| `pos-service-catalog-pricing` | 已实现 | branch 有效服务目录；订单/工单保存 service、计价单位、标准价和成交价快照；支持数量、重量、袋数、颜色、瑕疵和标识；Manager/Owner 改价强制原因 | catalog/order/access smoke；临时库使用有效目录创建订单；POS Web 生产构建 | 复杂促销和折扣不在本次范围；真实称重设备未接入 |
| `pos-offline-hardware` | 部分验收 | tenant/branch/terminal 分区离线队列；稳定实体 ID 和幂等重放；同步状态与失败重试；typed Desktop bridge；扫码导航；持久化打印任务、失败重试、特权重打和开箱授权 | offline、POS offline operations、hardware、Desktop、API hardware smoke；临时库稳定订单 ID 重放和打印失败幂等审计 | 新离线账户不能在同一离线链路继续创建依赖服务端 account ID 的 profile；无已认证硬件型号；默认 Desktop 钱箱 adapter 不可用；未执行实体打印/开箱和真实扫码 E2E |
| `pos-shift-reporting` | 已实现 | 服务端 shift、break、handover 和不可变 Z Report；交班事务统一 cutoff；按支付方式汇总 gross/refund/correction/net、现金差异和未完成订单 | staff/shift smoke；临时库真实 clock-in、支付、退款、handover 和 Z Report；退款 `1.00`、expected cash `124.00`、variance `0.00` | 当前没有折扣业务来源，`discountAmount` 固定为 `0.00`；Z Report 历史更正事件已有 schema，但尚无单独 API/UI |

## 3. 集成验证记录

### 3.1 自动化检查

以下检查在当前工作区通过：

- API、API Client、POS Web、Desktop、DB、offline 和 hardware typecheck。
- API、POS Web 和 Desktop lint。
- API、API Client、POS Web 和 Desktop build；POS Web 使用 Next.js 生产构建通过。
- terminal security、access control、order/payment、payment adjustment、staff/shift、API hardware、Desktop、offline、POS offline operations、hardware 和 DB client smoke/test。
- 迁移 `0000` 至 `0008` 在隔离 PostgreSQL 中按 Drizzle journal 顺序成功执行，随后 seed 成功。

### 3.2 临时数据库端到端结果

使用独立 PostgreSQL 16 临时库完成以下真实 API/数据库链路：

1. Owner 完整登录并登记 `pos-e2e-terminal`，数据库仅保存 credential digest。
2. 已登记终端使用 Owner PIN 登录，会话 branch 与终端绑定一致。
3. 查询 branch 有效目录和客户，按目录标准价创建带收衣信息的订单。
4. 以相同订单 ID 重放创建请求，返回同一订单。
5. 现金支付首次写入、同 key 重试幂等；Wave 支付首次 pending、同 key 重试幂等，再确认 paid。
6. 对原现金支付创建 `1.00` 退款并保留原交易。
7. Manager/Owner 开箱授权成功；打印机不可用结果以同一 job/attempt 重试时审计幂等。
8. 完成交班并读取不可变 Z Report，退款、现金应收和差异与交易一致。

这项记录不能替代 POS 页面、断网恢复和实体硬件 UAT。

## 4. 明确限制与发布门槛

- 当前没有通过认证的打印机、扫码枪或钱箱品牌/型号，不能对外宣称具体硬件兼容。
- Desktop 钱箱 adapter 默认不可用；只有专用 adapter 和 capability 检查通过后才允许试点开箱。
- 本次没有执行实体打印机、钱箱或真实扫码枪端到端测试；打印只验证了失败状态、重试和审计。
- 折扣字段已进入 Z Report 快照，但当前没有折扣 domain/source，因此报告固定为 `0.00`。
- Z Report 历史更正事件表已存在，但尚无独立的报告更正 API/UI；支付修正 API/UI 不等同于修改历史报告。
- 离线创建新账户后，不能在同一离线队列中继续创建依赖服务端账户 ID 的 profile；账户、订单和状态操作本身可独立排队重放。
- 根 `.env` 指向的外部 PostgreSQL 已存在业务表但没有 Drizzle migration history。直接执行 `pnpm db:migrate` 会从早期 migration 重建并在已存在对象处失败；必须先由数据库负责人确认并建立 migration baseline，禁止手工跳过或直接套用 `0008`。
- 完整 `6.4` 仍需在可控试点环境完成 POS 页面 PIN 登录、真实断网/恢复、扫码导航、实体打印重试、实体开箱、交班和历史报表复核。

## 5. 相关交付材料

- UAT 用例：`docs/05-qa/test-plans/CleanHub_POS_Phase1_UAT.md`
- 终端登记与恢复：`docs/06-delivery/rollout/CleanHub_POS终端登记与恢复说明.md`
- 硬件支持与试点发布：`docs/06-delivery/rollout/CleanHub_POS硬件支持与试点发布说明.md`
- Consolidated migration：`packages/db/drizzle/0008_puzzling_bushwacker.sql`

## Context

通知 6 张表已存在:`notification_templates`(按 tenant+code+locale 唯一)、`notification_configs`(triggerEvent/triggerCron + channel + recipient)、`notifications`(含 idempotencyKey 唯一)、`notification_deliveries`(status/attemptCount/maxAttempts/nextRetryAt/externalId)、`notification_preferences`、`notification_settings`。结构支持多渠道、模板、重试与幂等,但没有任何运行时代码消费它们。本变更只补运行时,不改表结构（除非首发缺字段)。约束:多租户隔离;高风险动作幂等;发送失败要可重试且可观测;遵循 CLAUDE.md（业务进 `apps/api`，日志用 `@cleanhub/logger`)。

## Goals / Non-Goals

**Goals:**
- 事件 → 配置匹配 → 模板渲染 → 写投递(pending) → Email 发送 → 状态/重试 的完整链路。
- Email 渠道适配（SMTP，provider 无关)，记录 externalId 与失败原因。
- 独立 cron 驱动发送与重试,带退避与最大尝试次数。
- 幂等:同一业务事件不重复发通知;同一投递不重复发送。
- 多语言模板选取(fr/en/zh)与回退。

**Non-Goals:**
- WhatsApp/SMS/Push 渠道（仅打通可扩展的渠道抽象，首发只实现 Email)。
- 站内通知中心 UI、已读管理界面。
- 模板可视化编辑后台（仅预置首发模板 + 基础 CRUD 视需要)。

## Decisions

### 决策 1:渠道适配器抽象，首发只实现 Email/SMTP
定义 `ChannelAdapter` 接口(`send(delivery, rendered) -> { externalId, status }`)，首发实现 `EmailAdapter`(SMTP / nodemailer)。SMTP 与自托管定位一致、provider 无关，后续可换托管邮件服务不改上层。
- 备选:直接绑定某邮件 SaaS（暂否决:厂商绑定);一次实现多渠道（否决:超出首发范围)。

### 决策 2:事件驱动 + 配置匹配
业务流程在关键节点发布领域事件（如 `order.created`、`order.completed`、`ticket.overdue`、`delivery.status_changed`)。通知服务按 `notification_configs.triggerEvent` 匹配启用的配置,逐条生成通知。事件发布用进程内事件总线/直接调用 use-case（不引入额外消息中间件)。
- 备选:外部消息队列（否决:当前规模过重,后续可演进)。

### 决策 3:两段式——入队与发送分离
触发时只渲染并写 `notifications` + `notification_deliveries`(status=pending)，不在请求路径同步发邮件;实际发送由独立 cron worker 消费 pending。
- 理由:业务请求不被 SMTP 延迟/失败阻塞;天然支持重试与限流。
- 幂等:`notifications.idempotency_key`（tenant 唯一)由 `事件类型 + 业务实体 id + config` 派生,重复事件不重复入队。

### 决策 4:重试与退避用既有投递字段
worker 扫描 `status=pending` 或 `status=failed 且 next_retry_at<=now 且 attempt_count<max_attempts` 的投递;发送后更新 status/sentAt/externalId 或 failedReason，并按指数退避设置 `next_retry_at` 与 `attempt_count`。达到 `max_attempts` 置终态 failed。
- 运行形态:独立 cron 进程，与对象存储清理 cron 一致(不在 API 进程内常驻定时器)。

### 决策 5:收件人与 locale 解析
客户类通知收件人取 `customers.email`;为空、或被 `notification_preferences`/`notification_settings`/tenant `notificationsEnabled` 关闭时跳过并记录原因（不算失败重试)。locale 解析顺序:通知/配置指定 locale → 租户默认 locale → 回退到存在的模板语言;模板按 `(tenant, templateCode, locale)` 选取。
- 说明:`customers` 暂无 locale 列,客户级语言偏好列为 Open Question。

### 决策 6:首发模板与默认配置预置
提供一批系统级 Email 模板（fr/en/zh)与默认 `notification_configs`（订单创建/完成、逾期取件、配送状态更新），通过种子脚本/迁移装载,租户可覆盖。

## Risks / Trade-offs

- [重复事件导致重复通知] → `idempotency_key` 唯一约束 + 派生键稳定。
- [SMTP 失败/超时阻塞业务] → 两段式 + cron 异步发送，请求路径不发邮件。
- [无限重试或风暴] → `max_attempts` + 指数退避 + 频率限制(`frequency_limit`/`frequency_window_minutes`)。
- [发给已关闭通知的用户] → 发送前校验 preferences/settings/tenant flag。
- [多 worker 重复发送同一投递] → 领取投递时用行级锁/乐观状态流转(pending→sending)保证单次。
- [缺邮箱/缺模板静默丢失] → 记录可观测的跳过原因,纳入日志与指标。

## Migration Plan

1. 预置系统 Email 模板(fr/en/zh)与默认配置（种子/迁移)。
2. 上线通知服务与 Email 适配器、Email/SMTP 环境变量。
3. 在订单/配送/工单流程接入事件触发点（先灰度少量事件)。
4. 上线独立 cron worker 消费 pending 与重试。
5. 逐步放开更多事件类型并监控投递成功率。
- 回滚:关闭事件触发与 cron 即停止发送;已入队投递可标记 cancelled,不影响业务数据。

## Open Questions

- 客户级语言偏好是否需要在 `customers` 增加 locale 列（影响 locale 解析与多语言模板)。
- SMTP 具体服务/发信域名与 SPF/DKIM 配置（部署侧)。
- worker 领取并发模型(单实例 cron 即可,还是需要多实例 + 锁)。

## 1. 依赖与配置

- [x] 1.1 添加 SMTP 邮件发送依赖（如 nodemailer）到 `apps/api`
- [x] 1.2 在 `.env.example` 增加 Email 配置（SMTP host/port/secure/user/pass、默认发件人、默认 locale）
- [x] 1.3 文档补充 Email/SMTP 配置与本地测试（如 MailHog/Mailpit）说明

## 2. 通知运行时服务（notification-delivery）

- [x] 2.1 新建 `apps/api/src/modules/notifications`（service/render/repository/types）
- [x] 2.2 配置匹配:按 `triggerEvent` 查启用的 `notification_configs`
- [x] 2.3 模板渲染:按 `(tenant, templateCode, locale)` 选取并渲染，含 locale 回退（fr/en/zh）
- [x] 2.4 入队:写 `notifications`(派生 `idempotency_key` 去重) + `notification_deliveries`(pending)
- [x] 2.5 发送前校验:租户 `notificationsEnabled`、`notification_preferences`/`settings`、收件人邮箱有效性，跳过并记录原因
- [x] 2.6 用 `@cleanhub/logger` 记录入队/跳过/发送关键日志

## 3. Email 渠道适配器

- [x] 3.1 定义 `ChannelAdapter` 接口（send → externalId/status）
- [x] 3.2 实现 `EmailAdapter`（SMTP 发送、组装收件人/主题/正文）
- [x] 3.3 发送结果落库:成功写 `external_id`/`sent_at`/sent；失败写 `failed_reason` 并安排重试

## 4. 发送/重试 cron

- [x] 4.1 新增独立 cron 进程入口（与对象存储清理 cron 一致的运行形态）
- [x] 4.2 领取投递:`pending` 或到期可重试的 `failed`，用状态流转/行级锁防重复发送
- [x] 4.3 重试与退避:指数退避设置 `next_retry_at`/`attempt_count`，达 `max_attempts` 置终态失败
- [x] 4.4 频率限制:遵循 `frequency_limit`/`frequency_window_minutes`

## 5. 事件触发接线

- [x] 5.1 定义领域事件与进程内发布机制（order.created/completed、ticket.overdue、delivery.status_changed 等）
- [x] 5.2 在订单流程接入触发点
- [x] 5.3 在配送状态流转接入触发点（与阶段1配送闭环对齐）
- [x] 5.4 在工单逾期/取件相关流程接入触发点

## 6. 首发模板与默认配置

- [x] 6.1 预置系统级 Email 模板（fr/en/zh）:订单创建、订单完成、逾期取件、配送状态更新
- [x] 6.2 预置默认 `notification_configs`（事件→模板→Email 渠道→收件人=客户）
- [x] 6.3 提供种子/迁移脚本装载，允许租户覆盖

## 7. 测试与校验

- [x] 7.1 入队 smoke:幂等去重、无配置不入队、开关/收件人校验跳过
- [x] 7.2 渲染 smoke:locale 选取与回退
- [x] 7.3 发送/重试 smoke:成功落 externalId、失败重试与退避、达上限置终态（用本地 SMTP 测试）
- [x] 7.4 `pnpm --filter @cleanhub/db typecheck`（如有模板种子涉及）与 `pnpm typecheck`、相关 `lint` 通过

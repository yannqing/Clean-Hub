## Why

通知的数据库结构已就绪（`packages/db/src/schema/platform/notifications.ts`:模板、配置、通知、投递、偏好、设置 6 张表，channel 含 `email`、含重试与幂等字段），但缺少运行时:没有发送服务、没有 Email 渠道适配器、没有事件触发接线、没有重试调度。客户在订单创建/完成、逾期取件、配送更新等关键节点拿不到真实通知。本变更补齐通知运行时，并按既定决策首发 Email 渠道。

## What Changes

- 新增通知运行时服务:由业务事件触发，按 `notification_configs` 匹配 → 用 `notification_templates`（按 locale)渲染 → 写 `notifications` + `notification_deliveries`(pending)，以 `idempotency_key` 去重。
- 新增 Email 渠道适配器:通过 SMTP（自托管，provider 无关)发送，写回 `external_id` 与投递状态(sent/failed/failed_reason)。
- 新增发送与重试调度:独立 cron 扫描 pending 及到期可重试的 failed 投递，按 `max_attempts`/`next_retry_at` 重试。
- 接入关键业务事件:订单创建、订单完成、逾期取件、配送状态更新等触发对应通知配置。
- 收件人解析:客户类通知解析到 `customers.email`;缺邮箱或被偏好/设置关闭时按规则跳过并记录。
- 多语言模板:模板按 locale 选取，支持 fr/en/zh,缺失语言回退租户默认 locale。

## Capabilities

### New Capabilities
- `notification-delivery`: 通知运行时——事件触发、模板渲染、投递入队、Email 发送、状态与重试管理。

### Modified Capabilities
<!-- 通知相关数据表已存在但无既有 spec;本变更为纯新增能力,不修改其他 capability 的 spec 级行为。 -->

## Impact

- 后端:新增 `apps/api/src/modules/notifications`（service/渲染/渠道适配/repository/types);在订单、配送、工单等流程挂事件触发点。
- 依赖:新增 SMTP 邮件发送依赖（如 nodemailer)与 Email 配置环境变量(host/port/user/pass/from)。
- 调度:新增独立 cron 进程驱动发送/重试（与对象存储清理 cron 一致的运行形态）。
- 数据:复用既有 6 张通知表;需要为首发场景预置一批 Email 模板（fr/en/zh)与默认 `notification_configs`。
- 配置:tenant 级 `notificationsEnabled`（owner summary 已有该 flag)与 `notification_settings`/`notification_preferences` 作为发送前的开关校验。
- 前端:本阶段不含站内信 UI;Push/站内通知中心列为后续。

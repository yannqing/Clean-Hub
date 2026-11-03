# 用户端与 POS 联调回归说明

## 本次业务边界

用户端不发起收款，不提供模拟支付入口。收款由门店 POS 完成；用户端读取真实账务结果。离线退出会清除当前会话，将注销任务保存至原刷新凭据过期；启动或恢复网络后继续撤销，任务凭据不会用于恢复登录。

客户在 POS 登记后，店主或经理可在 Android POS 的客户详情中发放或重置 App 登录密码，查看密码开通状态、商家编码和登录标识。客户使用商家编码和电话/邮箱登录，首次使用初始密码时必须修改密码。修改后旧刷新凭证撤销，界面返回登录流程。

上门取件预约在签收后完成取件；店主在移动端预约卡片上办理“门店收件”，创建来源为 App 的 POS 工单。门店随后在 POS 检查物品，添加服务及价格并收款。送回预约必须选择同一客户、同一门店的就绪工单，且项目已全部计费、关联订单均已结清。配送签收与工单、订单、预约更新在同一数据库事务内完成。

退款审批只确认申请，不改变实收。店主登记实际退款时，现金必须确认已经退还，非现金必须填写渠道退款凭证。混合收款按原收款记录分配，全部校验通过后才写入 POS 退款流水；重复提交不会重复退款。财务报表排除已由 POS 流水计入的客户退款申请，防止双计。

客户隐藏联系人不会删除门店档案，历史工单和订单仍可查看。顾客缓存及配送员缓存、离线队列按租户和账号隔离；不自动认领旧版没有账号标记的全局队列，以免把旧账号操作记到新账号。升级前有旧版待同步配送操作时，应由原配送员联网完成同步后再升级；无法同步的旧记录需核对任务后处理。

## 发布顺序与配置

1. 备份数据库，先执行迁移 `0073_brainy_blonde_phantom.sql`，再部署 API 和管理端，最后发布用户端及 POS APK。迁移增加预约工单关联、App 联系人隐藏标记、退款流水关联及远程版本策略。
2. 如果旧数据中同一订单存在多条 `pending/approved/processing` 退款申请，新增唯一索引会拒绝迁移。先核对并处理重复的未结申请；不要自动将申请标记成已退款。
3. 原生 API 源站使用 HTTPS，`MOBILE_NATIVE_ORIGINS=https://localhost,capacitor://localhost`，分别支持 Android 和 iOS 本地页面。该例外只适用于带移动端标记的 `/mobile/**` 请求，不能放宽 Web 登录的同源限制。
4. 短信验证码使用 `SMS_WEBHOOK_URL` 和可选的 `SMS_WEBHOOK_TOKEN`。生产地址必须为 HTTPS。请求为 JSON `{ idempotencyKey, tenantId, to, message }`，成功必须返回 2xx。需要实际完成短信供应商接入才能发送验证码；没有配置时隐藏验证码登录，保留密码登录。生产禁止 `MOBILE_AUTH_TEST_OTP_ENABLED=true`。
5. 推送需要原生 Firebase 项目配置和服务端推送凭证。关闭邮件发送不会停止推送与逾期提醒。未连接真实短信、FCM 服务时，本地回归不代表已验证运营商或真机推送。
6. SaaS 平台设置可配置用户 App 最低版本和 HTTPS 更新地址。客户端启动、恢复前台及联网时刷新策略，断网时保留最近验证的策略。此配置用于用户 App `com.cleanhub.app`，不替代 POS 的发版流程。
7. 用户 App 发布必须使用真实 `CLEANHUB_MOBILE_API_BASE_URL`、`CLEANHUB_MOBILE_UPDATE_URL` 和签名配置，不能使用开发默认域名。本次开发回归未上传 APK 或修改生产环境。

## 可重复验证

所有数据库集成测试只允许连接本机数据库，使用独立测试租户，完成后回滚全部测试记录。

```bash
pnpm --filter @cleanhub/api test:integration:mobile-readiness
pnpm --filter @cleanhub/api smoke:cors-origin
pnpm --filter @cleanhub/api smoke:notification-channels
pnpm --filter @cleanhub/api smoke:payment
pnpm --filter @cleanhub/api smoke:pos-payment-adjustments
pnpm --filter @cleanhub/api smoke:error-messages
pnpm --filter @cleanhub/i18n smoke:parity
pnpm check:native-pos-parity
pnpm --filter @cleanhub/mobile-web test:e2e:readiness
```

浏览器回归使用生产静态导出并拦截全部移动 API，不读取或修改线上租户。默认使用 Playwright Chromium；本机没有该浏览器时可安装 Chromium，或通过 `MOBILE_TEST_BROWSER_PATH` 指向已有 Chrome 可执行文件。截图与运行跟踪保存在 `/tmp`。

数据库回归覆盖审批不改实收、混合退款完整性与幂等、退款报表去重、联系人隐藏后历史可见、预约重试及重复拦截、签收失败回滚与成功联动、门店收件幂等、顾客追踪隔离、订单与预约历史分页、POS 登录开通状态、验证码重发限制、停用租户的会话撤销。

浏览器回归覆盖法语订单及税务展示、历史币种、离线订单/预约详情、远程最低版本、短暂刷新失败时保留凭证、配送员缓存及队列隔离、离线退出的注销重试。

真实门店验收还应走一遍：发放密码 → 首次改密 → 取件预约 → 派单取件 → 门店收件 → POS 完成服务、结款 → 申请送回 → 客户签收，以及真实渠道退款凭证登记。首次生产发布前需单独验证真机网络、短信和推送。

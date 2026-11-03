# CleanHub POS 终端登记与恢复说明

## 1. 适用范围

本说明适用于 `complete-pos-phase1` 之后的 POS Web/Desktop 终端。POS PIN 登录只允许已登记、启用并绑定门店的终端；浏览器自行生成的 `deviceId` 不是授权凭据。

终端原始凭据由 API 在登记或轮换时生成，仅通过 `HttpOnly` Cookie 下发。前端 JavaScript、日志、截图和数据库均不得保存或展示原始凭据，数据库只保存摘要。

## 2. 登记前检查

- 使用 Owner，或已分配目标门店的 Manager 完成完整账号登录。
- 确认目标 tenant 与 branch 均为 active。
- 确认终端显示的 `deviceId` 与待登记设备一致。
- 确认系统时间正确，浏览器/Desktop 允许站点 Cookie。
- 记录终端标签，建议格式为 `<门店简称>-<柜台编号>`。

## 3. 首次登记

登记调用：

```text
POST /pos/auth/devices
{
  "deviceId": "<terminal device id>",
  "label": "<branch-counter label>",
  "branchId": "<branch ULID>"
}
```

也可通过共享客户端调用 `posApi.pos.terminalAuth.bindDevice(...)`。成功响应返回终端摘要，凭据只通过 `Set-Cookie` 写入 `cleanhub_pos_terminal_credential`。

登记后必须验证：

1. 使用该门店员工 PIN 登录成功。
2. `/auth/me` 的会话包含正确 terminal 与 branch 上下文。
3. 请求其他门店业务数据被拒绝。
4. `pos_terminal.enrolled` 审计事件包含 tenant、branch、actor、terminal 和请求元数据。

## 4. 日常状态管理

查询终端：

```text
GET /pos/auth/devices/:deviceId
GET /pos/auth/terminals/:deviceId
```

修改标签、绑定门店或启停终端：

```text
PATCH /pos/auth/devices/:deviceId
{
  "label": "<optional label>",
  "branchId": "<optional branch ULID>",
  "status": "active | inactive",
  "reason": "<required operational reason>"
}
```

锁定与解锁：

```text
PATCH /pos/auth/terminals/:deviceId/lock
{
  "lockState": "locked | unlocked",
  "reason": "<required operational reason>"
}
```

所有修改仅允许 Owner 或具备目标门店权限的 Manager 执行，并必须保留原因和审计事件。

## 5. 凭据轮换

以下情况必须立即轮换：设备维修或转交、Cookie/用户配置被复制、凭据疑似泄露、终端从异常备份恢复。

```text
POST /pos/auth/devices/:deviceId/credential-rotation
{
  "reason": "<required rotation reason>"
}
```

轮换完成后，旧凭据立即失效，当前响应通过 `HttpOnly` Cookie 安装新凭据。随后执行一次 PIN 登录和 refresh 测试，并确认 `credentialVersion` 增加、`pos_terminal.credential_rotated` 审计事件存在。

## 6. 故障恢复

### 终端丢失或疑似被复制

1. 从另一台已授权管理终端将原设备设为 `inactive` 或 `locked`。
2. 检查该 terminalId 最近的登录、订单、支付和敏感操作审计。
3. 不要复用原 `deviceId` 给替换设备；新设备使用新 ID 重新登记。

### Cookie 被清除

清除 Cookie 后终端不得退化为“未登记也能 PIN 登录”。由 Owner/Manager 在同一设备完成完整账号认证，然后对现有终端执行凭据轮换；禁止直接修改数据库摘要。

### 终端迁移门店

1. 完成当前班次交班和离线队列同步。
2. 先将终端设为 `inactive`。
3. 通过 `PATCH /pos/auth/devices/:deviceId` 修改 `branchId` 并填写原因。
4. 轮换凭据并重新启用。
5. 验证旧门店数据不可访问，新门店 PIN 登录和打印配置正常。

### PIN 失败锁定

确认不是攻击或错误门店后，由授权 Manager 执行 unlock。清除 localStorage 或更换浏览器不能解除服务端 terminal/network 限流。

## 7. 回滚与安全底线

- 应用版本回滚不得恢复未登记终端 PIN 登录。
- 不得在数据库、环境变量、工单或聊天中复制原始终端凭据。
- 不得通过删除终端记录来规避审计；停用或轮换并保留历史记录。
- 数据库迁移回滚前必须确认新版本终端会话已失效，否则停止回滚。

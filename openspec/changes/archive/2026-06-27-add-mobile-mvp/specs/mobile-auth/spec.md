## ADDED Requirements

### Requirement: 移动端基于 Bearer Token 的认证

移动端认证 SHALL 在 `/mobile/auth` 提供独立认证域，登录成功后在响应体中返回 access token 与 refresh token，由移动端存入原生安全存储并在后续请求通过 `Authorization: Bearer` 头携带。该认证域 MUST 不使用 HttpOnly cookie，且不影响 web-admin / POS 现有 Cookie 认证行为。

#### Scenario: 登录返回令牌而非 cookie

- **WHEN** 任一角色通过 `/mobile/auth` 成功登录
- **THEN** 响应体返回 access token、refresh token 与过期时间，且响应不设置认证用的 HttpOnly cookie

### Requirement: 客户手机号验证码登录

系统 SHALL 支持客户通过手机号 + 一次性验证码（OTP）登录。在没有接入真实 SMS 供应商时，MUST 提供测试通道用于获取验证码以完成端到端验收。

#### Scenario: 请求并使用验证码登录成功

- **WHEN** 客户提交手机号请求验证码，并随后提交正确且未过期的验证码
- **THEN** 系统校验通过并返回该客户的认证令牌

#### Scenario: 验证码错误或过期

- **WHEN** 客户提交错误或已过期的验证码
- **THEN** 系统拒绝登录、不返回令牌，并对尝试次数做限制

### Requirement: 客户账号密码登录

系统 SHALL 支持客户使用账号（手机号/邮箱）+ 密码登录。

#### Scenario: 密码正确

- **WHEN** 客户提交正确的账号与密码
- **THEN** 系统返回该客户的认证令牌

#### Scenario: 密码错误触发失败计数

- **WHEN** 客户连续多次提交错误密码
- **THEN** 系统拒绝登录并按锁定策略限制后续尝试

### Requirement: 配送员账号密码登录

系统 SHALL 支持配送员（租户用户，持 `driver` 角色）使用账号密码登录并获得仅限配送端的访问范围。

#### Scenario: 配送员登录获得配送范围令牌

- **WHEN** 持 `driver` 角色的用户通过 `/mobile/auth` 登录成功
- **THEN** 返回的令牌上下文包含其 tenant、所属 branch 与 `driver` 角色，可访问配送端接口

### Requirement: Owner 账号密码登录

系统 SHALL 支持 Owner（租户用户，持 `owner` 角色）登录并获得只读看店访问范围。

#### Scenario: Owner 登录获得只读范围令牌

- **WHEN** 持 `owner` 角色的用户通过 `/mobile/auth` 登录成功
- **THEN** 返回的令牌上下文包含其 tenant 与 `owner` 角色，可访问 Owner 只读看店接口

### Requirement: 令牌刷新与登出

系统 SHALL 支持使用 refresh token 刷新 access token，并支持登出以吊销当前会话。

#### Scenario: 刷新令牌轮换

- **WHEN** 客户端使用有效的 refresh token 请求刷新
- **THEN** 系统签发新的 access token（并按轮换策略更新 refresh token），旧 refresh token 失效

#### Scenario: 登出吊销会话

- **WHEN** 客户端调用登出
- **THEN** 对应的 refresh token 被吊销，之后用它刷新会被拒绝

### Requirement: 移动端角色访问隔离

系统 SHALL 按角色与租户隔离移动端接口访问：客户不能访问配送/看店接口，配送员不能访问看店接口与未分配资源，且任何角色不能跨租户访问。

#### Scenario: 客户令牌访问配送接口被拒

- **WHEN** 使用客户令牌请求配送端接口
- **THEN** 系统返回 403 且不泄露配送数据

#### Scenario: 跨租户访问被拒

- **WHEN** 使用某租户的令牌访问另一租户的资源
- **THEN** 系统返回 403/404 且不泄露其他租户数据

# mobile-shell Specification

## Purpose
TBD - created by archiving change add-mobile-mvp. Update Purpose after archive.
## Requirements
### Requirement: 单套 H5 同时分发 Android 与 iOS

系统 SHALL 通过一套 `apps/mobile-web` Next.js 代码，采用 `output: "export"` 静态导出，由 `apps/mobile` 的 Capacitor 壳同时打包为 Android 与 iOS 应用。导出产物 MUST 不依赖 SSR、middleware、proxy 或服务端 cookie。

#### Scenario: 静态导出产物可被 Capacitor 同步

- **WHEN** 执行 `apps/mobile-web` 的 build/export 并对 `apps/mobile` 运行 `cap sync`
- **THEN** Android 与 iOS native project 都能加载到同一份 web assets（含 `index.html`）且无构建错误

#### Scenario: 不使用服务端运行时能力

- **WHEN** 检查 `apps/mobile-web` 的页面与数据获取实现
- **THEN** 不存在 SSR 页面、Next middleware、proxy 或对 HttpOnly cookie 的读写，所有后端访问均为客户端发起的带 Bearer Token 的请求

### Requirement: 租户上下文进入

移动端 SHALL 要求用户先进入某个租户上下文（通过租户的 pressing code / tenant code），之后所有业务请求都带上该租户上下文。

#### Scenario: 使用有效 pressing code 进入

- **WHEN** 用户在入口页输入有效的 pressing code
- **THEN** 应用解析到对应 tenant 并进入该租户上下文，后续登录与业务请求都归属该 tenant

#### Scenario: 使用无效 pressing code

- **WHEN** 用户输入不存在或已停用的 pressing code
- **THEN** 应用提示无效并阻止进入，不暴露其他租户的数据

### Requirement: 原生设备权限声明

移动端 SHALL 为配送端所需的 GPS 定位与相机拍照声明并申请对应的 Android/iOS 原生权限。

#### Scenario: 申请定位权限

- **WHEN** 配送员首次触发需要定位的操作
- **THEN** 系统弹出原生定位权限申请；用户拒绝时给出可重试的降级提示而非崩溃

#### Scenario: 申请相机权限

- **WHEN** 配送员首次触发拍照凭证
- **THEN** 系统弹出原生相机权限申请；用户拒绝时给出可重试的降级提示而非崩溃

### Requirement: 移动端 UI 基线

移动端 SHALL 以法语为默认语言，并满足移动触控可用性基线（关键操作按钮易点按、正文与金额清晰可读）。

#### Scenario: 默认法语

- **WHEN** 用户首次打开应用且未切换语言
- **THEN** 界面以法语（`fr`）展示

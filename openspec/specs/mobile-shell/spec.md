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

### Requirement: 移动端交互模式与信息架构基线

移动端 SHALL 以「一屏一焦点」组织各角色页面：列表或概览作为主屏，详情、表单与破坏性确认 MUST 通过底部 Sheet（bottom sheet）浮层承载，而非在主屏内就地纵向堆叠多段操作区。包含多个并列视图的角色页面 SHALL 采用底部 Tab 作为主导航；每屏的关键主操作 SHALL 通过固定底部主操作栏呈现。Sheet 与固定操作栏 MUST 适配 `safe-area`，满足触控可用性，并可经遮罩点击或关闭控件关闭、保留焦点管理。该需求约束各角色页面的呈现形态，MUST NOT 改变各角色既有的后端数据行为、状态机与权限边界。

#### Scenario: 详情通过 Sheet 呈现而非就地堆叠

- **WHEN** 用户在任一角色主屏点击某个列表项查看详情
- **THEN** 详情通过底部 Sheet 浮层呈现、主屏列表保持为背景，且不在主屏内追加纵向堆叠的详情区块

#### Scenario: 表单与破坏性操作通过按需 Sheet 触发

- **WHEN** 用户发起新建预约、上报异常、拍照凭证或客户签名等表单/破坏性操作
- **THEN** 对应表单在按需打开的 Sheet 中完成，关闭后回到原主屏或上一层，主屏不常驻铺开该表单

#### Scenario: 多视图角色采用底部 Tab 主导航

- **WHEN** 角色页面包含多个并列视图（如客户端 首页 / 订单 / 预约 / 我的）
- **THEN** 主导航以底部 Tab 形式呈现，便于单手拇指可达

#### Scenario: 关键主操作走固定底部操作栏

- **WHEN** 某屏存在明确的主操作（如配送任务状态推进或 Sheet 内提交）
- **THEN** 该主操作通过固定底部操作栏呈现，用户无需长滚动即可触达

#### Scenario: Sheet 适配 safe-area 与可访问性

- **WHEN** 在带刘海或底部手势条的设备上打开 Sheet
- **THEN** Sheet 内容与底部按钮不被系统区域遮挡，且支持点击遮罩或关闭控件关闭并正确管理焦点


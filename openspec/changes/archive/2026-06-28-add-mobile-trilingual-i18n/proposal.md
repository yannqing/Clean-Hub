## Why

移动端界面目前是硬编码法语（如 `mobile-auth-shell.tsx` 的 "Client OTP"/"Livreur" 等），`packages/i18n` 仅声明了 `supportedLocales = ["en","fr","zh-CN"]` 与一个极小词典，没有真正的运行时(无消息目录、无翻译函数、无 Provider、无 locale 检测/持久化)。按既定决策移动端需支持法语/英语/中文三语，必须先补 i18n 运行时并把界面文案抽离为可翻译资源。

## What Changes

- 扩展 `packages/i18n` 为可用的轻量 i18n 运行时:按 locale 组织消息目录、提供翻译函数与参数插值、React Provider/Hook、缺失 key 回退。
- 提供 fr/en/zh-CN 三语消息目录,覆盖移动端现有界面文案。
- 抽离 `apps/mobile-web` 硬编码文案(尤其法语)到消息目录，组件改用翻译函数。
- 新增语言解析与持久化:按 设备/用户偏好 → 租户默认 → `defaultLocale` 解析当前语言,用 Capacitor Preferences 持久化用户所选语言。
- 新增语言切换入口,允许用户在 fr/en/zh-CN 间切换并即时生效。
- 统一 locale 代码:使三语 locale 标识与通知模板 locale 等其它用法保持一致（如统一 `zh-CN`)。

## Capabilities

### New Capabilities
- `mobile-i18n`: 移动端三语(fr/en/zh-CN)国际化运行时、消息目录、语言解析/持久化与切换。

### Modified Capabilities
<!-- 既有功能 spec 行为不变;本变更只把界面文案国际化,不改业务行为。 -->

## Impact

- 共享:`packages/i18n` 从占位扩展为运行时（消息目录结构、翻译函数、React Provider/Hook、类型)。
- 前端:`apps/mobile-web` 全量文案抽离与替换、根布局接入 Provider、新增语言切换组件。
- 一致性:与 Email 通知模板的 locale 选取（fr/en/zh)对齐 locale 代码,避免 `zh` 与 `zh-CN` 混用。
- 配置:`defaultLocale` 与租户默认语言的关系需明确（当前 i18n 默认 `en`，但界面多为法语)。
- 非目标提示:web-admin/pos 等其它应用的国际化不在本变更范围。

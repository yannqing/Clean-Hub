## Context

`packages/i18n` 现仅导出 `supportedLocales(["en","fr","zh-CN"])`、`defaultLocale("en")` 与 `businessLineLabels` 小词典,没有翻译运行时。`apps/mobile-web` 文案硬编码（多为法语)，未消费 i18n。Email 通知模板已按 locale 选取（阶段 2 用到 fr/en/zh)。本变更补移动端三语运行时并抽离文案，同时统一 locale 代码避免 `zh` 与 `zh-CN` 混用。约束:移动端为静态导出 + Capacitor 壳，需可在 WebView 持久化语言;遵循 CLAUDE.md（共享逻辑进 `packages`，不把业务塞进 UI 包)。

## Goals / Non-Goals

**Goals:**
- `packages/i18n` 提供消息目录、翻译函数(带插值)、React Provider/Hook、缺失回退。
- fr/en/zh-CN 三语目录覆盖移动端现有界面。
- 语言解析(偏好→租户默认→defaultLocale)与 Capacitor Preferences 持久化。
- 用户可切换语言并即时生效。
- locale 代码在 i18n 与通知模板间统一。

**Non-Goals:**
- web-admin / pos-web / desktop 的国际化（仅移动端)。
- 复数/日期/货币的完整 ICU 格式化体系（先支持基础插值，复数按需)。
- 翻译管理平台/自动化提取流水线（先用仓库内目录)。

## Decisions

### 决策 1:轻量自研运行时，不引入重型 i18n 框架
在 `packages/i18n` 实现:按 locale 的扁平/分组 message 目录、`t(key, params)` 插值、`I18nProvider` + `useTranslation` Hook、缺失 key 回退到 defaultLocale 并告警。
- 理由:移动端文案量可控,自研轻量、零额外依赖、便于静态导出;与既有 `businessLineLabels` 风格一致。
- 备选:引入 i18next/next-intl（暂否决:体量与配置成本偏高,后续若需可平滑迁移目录)。

### 决策 2:消息目录结构与类型安全
目录按模块/页面分组(auth、customer、delivery、owner、common)，每 locale 一份;以类型约束 key 一致性(三语 key 必须齐全)，缺失在类型/测试层暴露。
- 理由:防止漏翻译;按模块组织便于维护。

### 决策 3:locale 代码统一为 en/fr/zh-CN
以 `supportedLocales` 现有值为准统一标识;通知模板等其它 locale 用法对齐到同一集合,提供归一化 helper(把 `zh` 视作 `zh-CN`)。
- 理由:避免 `zh` 与 `zh-CN` 混用导致模板/文案选取错配。

### 决策 4:语言解析与持久化
解析顺序:用户已保存的偏好 → 租户默认语言 → 设备语言(若在支持集) → `defaultLocale`。用户切换后写 Capacitor Preferences(WebView 下 fallback localStorage)。
- 说明:`defaultLocale` 当前为 `en`,但界面历史为法语;默认语言取值（en vs fr)列为 Open Question,由产品定。

### 决策 5:抽离策略
分模块逐步抽离硬编码文案:先抽 auth/customer/delivery/owner 的可见文案为 key，补齐三语;保留业务无关的纯标识不翻译。抽离时不改业务逻辑。
- 理由:范围可控、可分批验收，降低回归风险。

## Risks / Trade-offs

- [漏翻译/key 不齐] → 类型约束 + 测试校验三语 key 完整性 + 缺失回退告警。
- [默认语言与历史法语不一致造成体验跳变] → 明确默认语言决策并在解析顺序中以租户默认兜底。
- [静态导出下语言切换不生效] → Provider 在客户端运行 + Preferences 持久化,切换即时重渲染。
- [locale 代码不统一引发模板错配] → 统一集合 + 归一化 helper，并回归通知模板选取。
- [大量文案改动引入回归] → 分模块抽离、逐步替换、保留快照/组件测试。

## Migration Plan

1. 扩展 `packages/i18n` 运行时(目录结构、`t`、Provider/Hook、回退、归一化 helper)。
2. 建立 common + auth 模块三语目录,根布局接入 Provider，落地语言切换与持久化。
3. 逐模块抽离 customer/delivery/owner 文案并补齐三语。
4. 对齐通知模板 locale 代码。
5. 回归与三语完整性校验。
- 回滚:i18n 运行时为增量;未抽离的文案保持原样,可分模块回退。

## Open Questions

- 移动端默认语言取 `en` 还是 `fr`（与目标客户群相关)?
- 是否需要客户级语言偏好落库（与阶段 2 通知模板 locale、`customers` 是否加 locale 列联动)?
- 复数/日期/货币格式化是否本阶段纳入,还是仅基础插值。

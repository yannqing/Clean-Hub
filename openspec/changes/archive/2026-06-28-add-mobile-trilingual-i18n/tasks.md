## 1. i18n 运行时（packages/i18n）

- [x] 1.1 设计消息目录结构（按 common/auth/customer/delivery/owner 分组，每 locale 一份）
- [x] 1.2 实现 `t(key, params)` 翻译函数与参数插值，缺失 key 回退默认语言并告警
- [x] 1.3 实现 `I18nProvider` 与 `useTranslation` Hook
- [x] 1.4 实现 locale 归一化 helper（`zh` → `zh-CN`），导出类型与受支持集合
- [x] 1.5 类型约束三语 key 完整性，补单元测试（缺失 key、插值、回退、归一化）

## 2. 语言解析与持久化

- [x] 2.1 实现解析顺序:用户偏好 → 租户默认 → 设备语言 → `defaultLocale`
- [x] 2.2 用 Capacitor Preferences 持久化用户所选语言（WebView fallback localStorage）
- [x] 2.3 在 `apps/mobile-web` 根布局接入 `I18nProvider`

## 3. 文案抽离与替换

- [x] 3.1 抽离 common + auth 文案到三语目录并替换组件（如 `mobile-auth-shell.tsx` 的 "Client OTP"/"Livreur" 等）
- [x] 3.2 抽离 customer 模块文案并补齐三语
- [x] 3.3 抽离 delivery 模块文案并补齐三语
- [x] 3.4 抽离 owner 模块文案并补齐三语

## 4. 语言切换 UI

- [x] 4.1 新增语言切换组件（fr/en/zh-CN），切换即时生效
- [x] 4.2 放置切换入口（如设置/资料区）

## 5. 一致性与校验

- [x] 5.1 对齐通知模板 locale 代码到同一集合（与阶段2协调）
- [x] 5.2 三语 key 完整性校验（CI/测试），无残留硬编码可见文案
- [x] 5.3 `pnpm --filter @cleanhub/i18n typecheck`、`pnpm --filter @cleanhub/mobile-web typecheck` 与 `lint` 通过

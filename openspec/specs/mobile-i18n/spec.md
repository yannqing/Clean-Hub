# mobile-i18n Specification

## Purpose
TBD - created by archiving change add-mobile-trilingual-i18n. Update Purpose after archive.
## Requirements
### Requirement: 三语界面文案

移动端界面文案 SHALL 通过 i18n 运行时按当前语言渲染，支持法语、英语、中文(fr/en/zh-CN)。界面 MUST NOT 残留硬编码的不可翻译用户可见文案。

#### Scenario: 按当前语言渲染界面

- **WHEN** 当前语言为三语之一
- **THEN** 界面以该语言显示文案

#### Scenario: 缺失 key 回退

- **WHEN** 某语言缺少某个文案 key
- **THEN** 系统回退到默认语言文案并记录缺失告警，不显示空白或原始 key

### Requirement: 语言解析与持久化

系统 SHALL 按 用户偏好 → 租户默认 → 设备语言 → 默认语言 的顺序解析当前语言，并持久化用户所选语言。

#### Scenario: 首次进入按解析顺序确定语言

- **WHEN** 用户尚未选择语言
- **THEN** 系统按解析顺序确定并应用一个受支持语言

#### Scenario: 持久化用户所选语言

- **WHEN** 用户选择某种语言后重启应用
- **THEN** 系统恢复用户上次所选语言

### Requirement: 语言切换

用户 SHALL 能在 fr/en/zh-CN 间切换语言，切换 MUST 即时生效于当前界面。

#### Scenario: 即时切换

- **WHEN** 用户在语言切换入口选择另一种受支持语言
- **THEN** 界面立即以新语言重新渲染

### Requirement: locale 代码一致性

系统 SHALL 在 i18n 与其它按 locale 选取内容（如通知模板)间使用一致的 locale 代码集合。非规范的 locale 输入 MUST 被归一化到受支持集合。

#### Scenario: 归一化非规范 locale

- **WHEN** 传入 `zh` 等非规范 locale
- **THEN** 系统将其归一化为受支持的 `zh-CN`


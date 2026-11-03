## ADDED Requirements

### Requirement: 按租户货币格式化金额

移动端客户端、配送端、Owner 端 SHALL 使用当前租户的 `defaultCurrency` 格式化所有金额展示（订单金额、今日营收、任务相关金额等），MUST NOT 在前端硬编码固定货币码。

#### Scenario: 金额随租户货币展示

- **WHEN** 已登录用户查看订单金额、今日营收摘要或配送任务相关金额
- **THEN** 展示的货币符号/代码与该租户配置的 `defaultCurrency` 一致，而不是某个页面写死的固定货币

#### Scenario: 切换租户后货币随之更新

- **WHEN** 用户退出后重新进入另一个 `defaultCurrency` 不同的租户
- **THEN** 后续所有金额展示改用新租户的货币，不残留前一租户的货币格式

### Requirement: 移动端接口下发租户货币码

移动端登录与今日经营摘要等接口 SHALL 在响应中包含当前租户的 `defaultCurrency`，供前端统一格式化使用。

#### Scenario: 登录响应包含货币码

- **WHEN** 客户、配送员或门店主完成登录
- **THEN** 登录响应中包含其所属租户的 `defaultCurrency`

#### Scenario: 今日摘要接口包含货币码

- **WHEN** 门店主拉取今日经营摘要
- **THEN** 响应中包含当前租户的 `defaultCurrency`，且与登录响应中的值一致

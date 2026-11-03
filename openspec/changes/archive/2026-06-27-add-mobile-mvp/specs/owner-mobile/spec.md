## ADDED Requirements

### Requirement: Owner 只读今日经营摘要

已登录 Owner SHALL 能在手机上查看本租户今日经营摘要，至少包含：今日订单数、今日营收、待取订单数、进行中订单数，以及预约与配送摘要。

#### Scenario: 查看今日关键指标

- **WHEN** Owner 登录后打开看店首页
- **THEN** 系统返回本租户当日的订单数、营收、待取数、进行中数与预约/配送摘要

### Requirement: Owner 看店仅限本租户范围

Owner 看店数据 MUST 仅限其所属租户范围，不得返回其他租户的经营数据。

#### Scenario: 跨租户数据隔离

- **WHEN** Owner 请求看店摘要
- **THEN** 返回的所有指标只统计 Owner 所属租户的数据

### Requirement: Owner 看店为只读

Owner 手机看店 SHALL 仅提供只读查询，MUST NOT 提供下单、改价、退款等写操作。

#### Scenario: 不提供写操作入口

- **WHEN** 检查 Owner 看店相关接口与界面
- **THEN** 仅存在只读查询能力，不存在创建/修改/删除经营数据的操作

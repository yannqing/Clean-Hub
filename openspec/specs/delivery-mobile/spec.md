# delivery-mobile Specification

## Purpose
TBD - created by archiving change add-mobile-mvp. Update Purpose after archive.
## Requirements
### Requirement: 配送员今日任务列表

已登录配送员 SHALL 能查看分配给自己的今日配送任务列表。配送员 MUST 只能看到分配给本人的任务，不能看到其他配送员或未分配的任务。

#### Scenario: 只看到分配给自己的任务

- **WHEN** 配送员打开今日任务列表
- **THEN** 系统只返回当前租户下指派给该配送员的任务

#### Scenario: 不能看到他人任务

- **WHEN** 配送员尝试访问未分配给自己的任务
- **THEN** 系统返回 403/404 且不泄露该任务的客户详情

### Requirement: 配送任务详情

已登录配送员 SHALL 能查看分配给自己的任务详情，包括客户、地址、电话以及关联订单/工单摘要。

#### Scenario: 查看任务详情

- **WHEN** 配送员打开自己的一条任务
- **THEN** 系统返回客户姓名、地址、联系电话与关联订单/工单摘要

### Requirement: GPS 定位上报

配送员在任务状态更新时 SHALL 能上报当前 GPS 经纬度，定位 MUST 与对应的任务状态变更一并记录。

#### Scenario: 状态更新携带定位

- **WHEN** 配送员在授予定位权限后更新任务状态
- **THEN** 该状态变更记录包含上报的经纬度与时间

### Requirement: 拍照凭证上传

配送员 SHALL 能为取件/送达上传拍照凭证，凭证 MUST 关联到对应任务且可被后续追溯。

#### Scenario: 上传取件/送达照片

- **WHEN** 配送员拍照并上传凭证
- **THEN** 系统保存该凭证并将其关联到对应任务（含类型：取件/送达）

### Requirement: 客户签收完成

配送员 SHALL 能让客户在设备上完成签收以结束任务。

#### Scenario: 客户签收后任务完成

- **WHEN** 配送员采集到客户签收并提交
- **THEN** 任务状态流转为已签收/完成，并记录签收凭证与时间

### Requirement: 配送任务状态机流转

配送任务状态 SHALL 按定义的状态机流转：待出发 → 已出发 → 已到达 → 已取件 → 配送中 → 已签收，并允许标记异常。系统 MUST 拒绝非法的状态跳转。

#### Scenario: 合法状态推进

- **WHEN** 配送员按顺序推进任务状态（如 已到达 → 已取件）
- **THEN** 系统接受并记录该次状态变更

#### Scenario: 非法状态跳转被拒

- **WHEN** 配送员尝试做不符合状态机的跳转（如 待出发 → 已签收）
- **THEN** 系统拒绝该变更并返回当前合法的可选状态

#### Scenario: 标记异常

- **WHEN** 配送员在任务过程中标记异常并填写原因
- **THEN** 系统将任务置为异常状态并记录原因与时间

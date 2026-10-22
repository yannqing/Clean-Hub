# mobile-bluetooth-printing Specification

## Purpose
TBD - created by archiving change add-mobile-delivery-enhancements. Update Purpose after archive.
## Requirements
### Requirement: 蓝牙打印机发现与连接

配送员 SHALL 能在移动端发现并连接便携蓝牙打印机。系统 MUST 在缺少蓝牙权限或连接失败时给出明确提示与重试入口，不导致流程崩溃。

#### Scenario: 发现并连接打印机

- **WHEN** 配送员在授予蓝牙权限后搜索打印机
- **THEN** 系统列出可用设备并能连接选定的打印机

#### Scenario: 权限缺失引导

- **WHEN** 蓝牙权限未授予
- **THEN** 系统提示开启权限并提供引导，不崩溃

#### Scenario: 连接失败可重试

- **WHEN** 连接打印机失败
- **THEN** 系统提示失败原因并提供重试

### Requirement: 打印取件/送达凭据

配送员 SHALL 能通过已连接的蓝牙打印机打印取件/送达小票与标签。打印内容 MUST 反映对应任务的关键信息(客户、地址、订单/工单、时间)。

#### Scenario: 打印小票

- **WHEN** 配送员对一条任务发起打印且打印机已连接
- **THEN** 系统按模板输出包含任务关键信息的小票

#### Scenario: 打印机未连接时阻止

- **WHEN** 配送员在未连接打印机时发起打印
- **THEN** 系统提示先连接打印机，不产生空打印


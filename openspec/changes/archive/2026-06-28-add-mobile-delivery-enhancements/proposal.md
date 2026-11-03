## Why

移动端第一版可运行后，仍有三块"增强与交付"未完成:① 便携蓝牙打印(README 列为 mobile 方向，`packages/hardware` 仅有占位)未实现;② 客户资料自助(目前 customer 路由只有 `GET /profile`，无编辑资料/管理地址/改密码);③ 发布交付(Android/iOS 打包签名、环境切换、版本更新、真机验收与分发文档)缺失，且关键流程缺自动化测试。本变更把这三块补齐，让移动端从"可运行"走向"可交付"。

## What Changes

- 新增蓝牙便携打印:基于 Capacitor BLE 通过 `packages/hardware` 抽象对接便携打印机，打印取件/送达小票与标签;权限与连接失败有兜底。
- 新增客户资料自助:客户可编辑基本资料、管理收货/取件地址（增删改、设默认)、修改密码。
- 新增发布交付:Android/iOS 打包与签名、环境切换(dev/staging/prod)、版本号与更新策略、真机权限验收与安装分发文档;关键移动流程纳入自动化测试与真机验收门槛。
- 原生权限完善:打印/相机/定位等权限文案与失败引导(配合发布验收)。

## Capabilities

### New Capabilities
- `mobile-bluetooth-printing`: 便携蓝牙打印——设备发现/连接、打印小票与标签、失败兜底。
- `customer-self-service`: 客户自助维护资料、地址管理与修改密码。
- `mobile-release`: 移动端打包签名、环境切换、版本管理与发布验收（含关键流程自动化测试要求）。

### Modified Capabilities
<!-- 既有配送/客户 spec 行为不变;本变更为新增能力与交付要求。 -->

## Impact

- 原生:`apps/mobile` 新增 BLE/打印相关 Capacitor 插件与权限声明（Android `AndroidManifest.xml`、iOS `Info.plist`）。
- 共享:`packages/hardware` 扩展便携打印机抽象(连接、ESC/POS 指令、小票/标签模板)。
- 后端/数据:`customers` 已有 email;地址管理需要地址表或客户地址字段（视现状新增 `customer_addresses`)；新增资料更新、地址 CRUD、改密接口。
- API Client:`packages/api-client/src/mobile` 新增资料/地址/改密方法与 DTO。
- 前端:`apps/mobile-web` 新增资料编辑、地址管理、改密界面与打印入口。
- 工程:补移动端组件/E2E 测试与真机回归清单;新增打包签名脚本与环境配置、发布文档。

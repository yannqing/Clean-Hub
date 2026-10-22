## 1. 客户自助:数据库与后端

- [x] 1.1 新增 `customer_addresses` 表（tenant、customer、label、地址、经纬度可选、isDefault、软删、审计字段）+ 索引
- [x] 1.2 `pnpm db:generate`、`pnpm db:migrate`、`pnpm --filter @cleanhub/db typecheck` 通过
- [x] 1.3 客户资料更新接口:校验归属与输入，更新基本资料
- [x] 1.4 地址 CRUD 接口:新增/编辑/删除/设默认（至多一个默认，软删）
- [x] 1.5 改密接口:校验旧密码/已认证态 + 新密码强度，更新口令并按策略失效登录态

## 2. 客户自助:API Client 与前端

- [x] 2.1 `packages/api-client/src/mobile` 新增资料/地址/改密方法与 DTO
- [x] 2.2 `apps/mobile-web` 资料编辑、地址管理、改密界面
- [x] 2.3 `pnpm --filter @cleanhub/mobile-web typecheck` 与 `lint` 通过

## 3. 蓝牙打印:硬件抽象与原生

- [x] 3.1 `packages/hardware` 扩展便携打印机抽象（发现/连接/打印/断连处理）
- [x] 3.2 拼装 ESC/POS 取件/送达小票与标签模板（字段随三语 i18n）
- [x] 3.3 `apps/mobile` 集成 Capacitor BLE 插件并实现打印抽象
- [x] 3.4 Android `AndroidManifest.xml` / iOS `Info.plist` 增加蓝牙权限与文案

## 4. 蓝牙打印:前端集成

- [x] 4.1 配送任务页新增打印机连接与打印入口
- [x] 4.2 权限缺失/连接失败/未连接打印的兜底提示与重试
- [x] 4.3 打印内容校验（含任务关键信息）

## 5. 发布:打包签名与环境

- [x] 5.1 环境切换:dev/staging/prod 的 API 基址与配置（构建期变量）
- [x] 5.2 Android 签名打包脚本（密钥安全注入，不入库）
- [x] 5.3 iOS 打包与分发配置（TestFlight/证书，按决策）
- [x] 5.4 版本号与最低支持版本 + "需更新"提示策略

## 6. 发布:测试与验收

- [x] 6.1 移动端组件/E2E 测试:登录、客户订单查看/支付入口、配送状态/凭证/签收、打印
- [x] 6.2 真机权限与核心流程验收清单（相机/定位/蓝牙）
- [x] 6.3 安装与分发文档（APK/TestFlight）、环境与版本说明
- [x] 6.4 运行 `pnpm typecheck`、相关 `lint` 与移动测试套件，全部通过

## ADDED Requirements

### Requirement: 可签名打包与环境切换

移动端 SHALL 支持为 Android/iOS 生成可签名的发布包，并能在 dev/staging/prod 环境间切换 API 基址。签名密钥 MUST NOT 进入代码仓库。

#### Scenario: 按环境打包

- **WHEN** 以指定环境执行打包
- **THEN** 产物指向该环境的 API 基址与配置

#### Scenario: 签名密钥不入库

- **WHEN** 审查发布配置与仓库
- **THEN** 不存在明文签名密钥，密钥经安全注入提供

### Requirement: 版本与更新策略

移动端 SHALL 记录版本号与最低支持版本，并在低于最低支持版本时提示用户更新。

#### Scenario: 低版本提示更新

- **WHEN** 应用版本低于最低支持版本
- **THEN** 系统提示用户更新并引导到安装入口

### Requirement: 发布前测试与真机验收门槛

关键移动流程 SHALL 具备自动化测试覆盖，且发布前 MUST 完成真机权限与核心流程验收。未通过 MUST NOT 发布。

#### Scenario: 关键流程自动化测试

- **WHEN** 执行移动端测试套件
- **THEN** 登录、客户订单查看/支付入口、配送状态/凭证/签收等关键流程的测试通过

#### Scenario: 真机验收清单

- **WHEN** 准备发布一个版本
- **THEN** 按真机验收清单完成相机/定位/蓝牙等权限与核心流程验收并记录结果

# customer-self-service Specification

## Purpose
TBD - created by archiving change add-mobile-delivery-enhancements. Update Purpose after archive.
## Requirements
### Requirement: 客户编辑资料

已认证客户 SHALL 能编辑本人基本资料（如姓名、联系邮箱/电话)。更新 MUST 只作用于本租户本人记录并校验输入。

#### Scenario: 更新基本资料

- **WHEN** 客户提交合法的资料修改
- **THEN** 系统保存更新并返回最新资料

#### Scenario: 非法输入被拒

- **WHEN** 客户提交不合法的资料（如邮箱格式错误）
- **THEN** 系统拒绝并返回校验错误，不修改记录

### Requirement: 客户地址管理

已认证客户 SHALL 能管理本人的收货/取件地址，包括新增、编辑、删除与设为默认。地址 MUST 归属本租户本人，且至多一个默认地址。

#### Scenario: 新增并设为默认地址

- **WHEN** 客户新增一个地址并标记为默认
- **THEN** 系统保存该地址为默认，并将原默认地址取消默认

#### Scenario: 删除地址

- **WHEN** 客户删除一个本人地址
- **THEN** 系统软删该地址，后续不再展示

#### Scenario: 越权访问被拒

- **WHEN** 客户尝试操作不属于本人的地址
- **THEN** 系统返回鉴权错误且不修改数据

### Requirement: 客户修改密码

已认证客户 SHALL 能修改本人登录密码。修改 MUST 校验身份（旧密码或已认证态)，并对新密码做强度校验。

#### Scenario: 成功修改密码

- **WHEN** 客户提供正确的旧密码与合规的新密码
- **THEN** 系统更新口令并使现有登录态按策略失效

#### Scenario: 旧密码错误被拒

- **WHEN** 客户提供的旧密码不正确
- **THEN** 系统拒绝修改并返回错误


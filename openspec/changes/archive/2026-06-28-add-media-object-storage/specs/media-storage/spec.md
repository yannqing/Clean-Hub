## ADDED Requirements

### Requirement: 预签名上传凭证

系统 SHALL 提供一个鉴权接口，让已认证客户端为一次媒体上传获取短时效的预签名直传凭证。返回的凭证 MUST 包含服务端生成的对象 key、上传 URL、所需请求头与过期时间。客户端 MUST NOT 自行指定对象 key 的租户段。

#### Scenario: 获取上传凭证

- **WHEN** 已认证客户端按声明的用途与内容类型请求一次上传
- **THEN** 系统返回 `{ objectKey, uploadUrl, headers, expiresAt }`，其中 `objectKey` 由服务端用鉴权上下文中的租户拼接

#### Scenario: 上传凭证过期后失效

- **WHEN** 客户端在 `expiresAt` 之后使用该上传 URL
- **THEN** 对象存储拒绝该上传，客户端需重新申请凭证

### Requirement: 租户隔离的对象命名与归属校验

每个对象 key MUST 以发起方租户标识为前缀。系统在受理任何引用某 key 的提交或读取前 MUST 校验该 key 归属当前租户，拒绝跨租户访问。

#### Scenario: 跨租户引用被拒

- **WHEN** 某租户提交或请求读取一个前缀属于其他租户的对象 key
- **THEN** 系统拒绝该请求并返回鉴权错误，不泄露对象是否存在

#### Scenario: key 前缀由服务端强制

- **WHEN** 客户端请求上传凭证
- **THEN** 系统忽略客户端传入的任何租户段，使用鉴权上下文中的租户拼接 key 前缀

### Requirement: 上传内容约束

系统 SHALL 约束可上传媒体的内容类型与大小上限。超出允许范围的上传 MUST 被拒绝。

#### Scenario: 拒绝不允许的内容类型

- **WHEN** 客户端以不在白名单内的内容类型请求上传
- **THEN** 系统拒绝发放上传凭证并返回校验错误

#### Scenario: 拒绝超限大小

- **WHEN** 上传对象的大小超过配置上限
- **THEN** 系统拒绝该对象的提交并返回校验错误

### Requirement: 受控读取

系统 SHALL 以短时效预签名 GET URL 或经鉴权的代理下载方式返回媒体内容，且仅向本租户、具备相应权限的角色提供访问。读取链接 MUST 有限期。

#### Scenario: 通过短时效链接读取

- **WHEN** 有权限的用户请求读取一个本租户对象
- **THEN** 系统返回一个有限期的访问链接以获取该对象

#### Scenario: 无权限读取被拒

- **WHEN** 无权限主体请求读取某对象
- **THEN** 系统拒绝并不返回可用的访问链接

### Requirement: 对象登记与孤儿清理

系统 SHALL 为每个上传对象登记元数据（租户、key、内容类型、大小、状态、用途、创建者、过期时间），上传凭证发放时状态为 `pending`，被业务提交并校验归属后置为 `committed`。系统 MUST 定期清理过期仍为 `pending` 的孤儿对象及其存储数据。

#### Scenario: 提交后标记已确认

- **WHEN** 业务接口成功引用并校验一个已上传对象 key
- **THEN** 该对象登记状态由 `pending` 变为 `committed`

#### Scenario: 清理过期孤儿对象

- **WHEN** 一个对象在过期时间后仍为 `pending` 且未被任何业务引用
- **THEN** 系统删除其存储对象与登记记录

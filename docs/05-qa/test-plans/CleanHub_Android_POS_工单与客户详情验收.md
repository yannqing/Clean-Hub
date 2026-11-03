# Android POS 工单与客户详情验收

## 本次行为

- 工单详情显示客户联系方式、类型、状态、优先级、接待员工、来源、创建/更新/取件/完成/取消时间和备注。
- 基本资料可编辑优先级、来源、取件时间、备注；无项目时可切换工单类型。状态流转仍使用版本校验，取消需原因。
- 项目使用独立表单：先选择衣物/车辆等类型，再搜索兼容服务；支持计件或称重/袋数、类别、颜色、品牌、材质、瑕疵、特殊要求和备注。管理员可输入实际单价及必填改价原因；历史项目未改价时保留其原价格。
- 项目展示标签号、标准/实际单价、行金额、处理状态和结款状态；已结款、待结款同步或已进购物车的项目不能编辑、删除或再次加入收银。
- 关联订单可跳转到订单详情。
- 客户详情提供概览、工单、订单、服务项目和备注。历史列表每页 20 条，资料和备注可编辑；接口不可用时保留缓存并提示。概览展示真实工单/订单数量，不以本机有限列表冒充全量统计，也不合并不同币种的历史金额。
- 客户详情的按钮是「新增工单」。创建弹窗在本机保存期间显示转圈加载；保存失败保留输入与错误，保存成功才打开工单详情。

## 本地先行与同步边界

工单与新增项目先将稳定 ULID、原创建员工、终端/租户/门店、不可变请求和本机展示资料写入独立 SQLite outbox。持久化成功后才返回成功，网络与目录下载不在创建按钮的等待路径内。既有数据库无需破坏性迁移，覆盖安装即可创建新的 outbox 数据库。

后台只按已认证的原员工、租户、门店与终端重放。父工单先于项目；同一个创建标识在数据库事务内加锁并去重。服务端已经成功但响应丢失时，重试返回既有记录，不重复编号、计价或记审计。新旧员工切换不会把工单归到接班员工名下。

- 未确认工单/项目显示待同步、失败原因、预估金额和重新同步入口，不能加入收银。
- 网络、登录和服务端暂时故障保留数据并退避重试，单条最多自动尝试 25 次，可人工重新同步。
- 只有明确收到 400/404/422 拒绝的创建资料，才允许原员工经确认后移除；删除被拒工单同时移除其未上传子项目。响应未知、409 冲突、已确认记录不能用这个入口删除。
- 待上传资料存在时禁止重新绑定门店，避免把旧门店工作隐藏在新终端上下文中。
- 目录刷新不会清除 outbox。切换门店/租户时清理的是无分区的参考缓存，outbox 保持原范围隔离。
- 员工 PIN 登录只刷新登录所需配置，不等待历史工单上传。工单上传失败不阻止现金队列和目录刷新。
- 后台完成同步后更新界面，不覆盖员工正在编辑的购物车。

## 上线顺序

先部署 API，再发布 Android APK。API 新增只读能力接口 `GET /pos/service-tickets/intake-capabilities`，并为创建工单/项目支持可选 `id` 和 `operatorUserId`；旧 Web 客户端继续兼容。

Android 在任何上传前检查能力接口。服务端版本旧或不支持稳定标识时保留本机资料，并明确提示管理员升级服务端，不向旧接口发送可能重复创建的请求。此次服务端不增加数据表或数据库迁移。

## 自动验证

后端集成测试必须使用本机或隔离的 PostgreSQL 测试库，测试事务结束会回滚所有夹具：

```bash
pnpm --filter @cleanhub/api test:integration:pos-intake
pnpm --filter @cleanhub/api smoke:pos-service-tickets
pnpm --filter @cleanhub/api smoke:error-messages
pnpm --filter @cleanhub/api typecheck
pnpm --filter @cleanhub/api lint
pnpm --filter @cleanhub/api-client typecheck
pnpm check:native-pos-parity
```

Android 单元和发布版 Kotlin 检查（Java 21，HTTPS API 地址）：

```bash
cd apps/pos-mobile/android
./gradlew :app:testDebugUnitTest :app:compileReleaseKotlin
```

Android 仪器测试使用独立数据库名前缀与假网络网关，不访问生产接口。运行：

```bash
./gradlew :app:connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=com.cleanhub.pos.nativepos.NativeIntakeDispatchInstrumentedTest,com.cleanhub.pos.nativepos.NativeIntakeExperienceInstrumentedTest,com.cleanhub.pos.nativepos.NativeCheckoutDispatchInstrumentedTest,com.cleanhub.pos.nativepos.NativePosSaleExperienceInstrumentedTest
```

覆盖重启/目录刷新保留、相同标识重放、响应丢失、确认内容不匹配、父子依赖、员工/租户隔离、过期缓存恢复、旧服务端保护、明确拒绝才可移除、已确认后不复活删除项目、门店币种变更不改写历史项目币种、创建加载反馈、详情与历史导航、称重表单、客户备注和既有收银流程。

## 发布后人工验收

1. 用已绑定终端的员工登录，打开客户详情，核对各历史页及联系资料、备注，点击「新增工单」。
2. 弱网下创建工单，确认按钮仅等待本机保存，能马上进入详情；添加称重项目，核对重量、袋数、单价和预估金额。
3. 完全断网重启 APK，确认待上传工单和项目仍存在；联网后确认正式工单号、标签号与最终价格出现，并且后台只有一条记录。
4. 同步期间切换员工，确认不将原员工工单记到接班员工名下；原员工再登录可继续同步。
5. 在服务端停用测试客户后模拟离线开单，同步后检查明确错误。原员工可移除已被明确拒绝的本机资料，重新选择有效客户；未知响应不得移除。
6. 工单同步成功后加入收银、完成付款，从关联订单返回核对项目、金额、支付状态；已结款项目不得重复加入。
7. 用中文、英文、法文及窄屏检查弹窗输入、滚动、加载、错误和禁用状态。实体验收中另外核对门店打印硬件；本次未引入 Android 标签打印驱动。

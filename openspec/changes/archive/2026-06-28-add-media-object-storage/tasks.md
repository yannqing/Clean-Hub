## 1. 基础设施与本地环境

- [x] 1.1 在 docker-compose 加入自托管 MinIO（S3 兼容），暴露端口并设默认 bucket，纳入本地启动流程
- [x] 1.2 在 `.env.example` 增加对象存储配置（endpoint、region、bucket、access key、secret、上传/下载 URL TTL、单文件大小上限、允许的 content-type 白名单）
- [x] 1.3 在文档（CLAUDE.md / docs 数据库或技术目录）补充本地与生产自托管 MinIO 的启动、bucket 初始化与环境变量说明

## 2. packages/storage 对象存储抽象

- [x] 2.1 新建 `packages/storage` 工作区（package.json、tsconfig 继承 `@cleanhub/config`、导出入口）
- [x] 2.2 封装 S3 兼容客户端与配置加载（从环境变量读取，集中校验）
- [x] 2.3 实现 key builder：强制 `tenant/<tenantId>/<purpose>/...` 前缀，提供归属校验 helper
- [x] 2.4 实现 `presignUpload`（PUT）与 `presignDownload`（GET），均带 TTL
- [x] 2.5 导出 content-type 白名单与大小上限常量及校验函数
- [x] 2.6 为 key builder、归属校验、内容约束补单元测试

## 3. 数据库:media_objects 登记表

- [x] 3.1 在 `packages/db/src/schema` 新增 `media_objects` 表（ULID 主键、tenant_id、object_key、content_type、size_bytes、status pending/committed、purpose、created_by、created_at、expires_at、软删字段）+ 必要索引（tenant、status+expires、object_key 唯一）
- [x] 3.2 导出 schema 并 `pnpm db:generate` 生成迁移，`pnpm db:migrate`
- [x] 3.3 `pnpm --filter @cleanhub/db typecheck` 通过

## 4. apps/api media 模块

- [x] 4.1 新建 `apps/api/src/modules/media`（routes/controller/service/repository/types）
- [x] 4.2 `POST /mobile/media/uploads`：校验 content-type/大小→生成租户前缀 key→建 `pending` 登记→返回 `{ objectKey, uploadUrl, headers, expiresAt }`
- [x] 4.3 提供 `assertOwnedAndCommit(tenantId, objectKey)` helper：校验 key 归属本租户并将登记置 `committed`，供业务模块复用
- [x] 4.4 提供读取链接 helper：按 key 现签短时效预签名 GET URL（带租户与权限校验）
- [x] 4.5 实现孤儿清理 use-case：删除过期仍为 `pending` 的对象与登记记录（纯逻辑，供 cron 调用，不在请求路径）
- [x] 4.6 在 `apps/api` 挂载 media 路由，使用 `@cleanhub/logger` 记录关键操作

## 5. 配送 proof/signature 改造

- [x] 5.1 修改 `delivery.controller.ts`：proof/signature 入参去掉 `base64`/`signatureBase64`，仅接受对象 `mediaRef`(=objectKey)；移除/收敛 `resolveMediaRef` 的 base64 分支
- [x] 5.2 `delivery.service.ts` 的 `uploadProof`/`signTask` 在写入前调用 `assertOwnedAndCommit` 校验并确认对象，保持幂等键行为不变
- [x] 5.3 `getOwnedTaskDetail` 返回 proof 时改为附带短时效读取链接（替代内联 data URL）
- [x] 5.4 过渡期对 `data:` 开头的 legacy `media_ref` 保留只读兼容分支（迁移完成后移除）
- [x] 5.5 更新/新增配送 smoke：覆盖「请求上传→提交 key→读取链接」与「拒绝 base64」

## 6. API Client

- [x] 6.1 在 `packages/api-client/src/mobile` 新增 `media.requestUpload` 方法与 DTO 类型
- [x] 6.2 调整 mobile delivery 的 proof/signature 方法签名为对象 key，更新对应类型
- [x] 6.3 `pnpm --filter @cleanhub/api-client typecheck` 通过

## 7. 移动端 apps/mobile-web

- [x] 7.1 新增客户端图片压缩工具（canvas 限制最长边/质量，目标 < 1–2MB）
- [x] 7.2 改造 `device.ts` 拍照流程：拍照→压缩→产出二进制
- [x] 7.3 改造 `delivery.actions.ts`：请求上传→PUT 直传→以 objectKey 提交 proof/signature
- [x] 7.4 改造 `offline-store.ts`：离线缓存压缩后二进制，恢复网络后按「先 PUT、再提交 key」顺序重放，保持幂等
- [x] 7.5 凭证/签收展示改用读取链接渲染
- [x] 7.6 `pnpm --filter @cleanhub/mobile-web typecheck` 与 `lint` 通过

## 8. 孤儿清理 cron

- [x] 8.1 新增独立 cron 进程/入口（复用现有调度设施或轻量 cron 服务），按计划周期触发 4.5 的清理 use-case
- [x] 8.2 cron 内做租户遍历与限流，调用清理 use-case 删除过期 `pending` 对象与登记记录
- [x] 8.3 用 `@cleanhub/logger` 记录每次清理的扫描数、删除数与异常；配置周期、批量大小与可关闭开关
- [x] 8.4 为清理 use-case 补单元/集成测试（过期 pending 被清、committed 与未过期不受影响）

## 9. 迁移与收尾

- [x] 9.1 编写一次性回填脚本：将 `delivery_proofs` 中 `data:` 内联图上传对象存储、登记 `media_objects`、把 `media_ref` 改为对象 key（支持分批/限流）
- [x] 9.2 运行回填并校验所有 proof 可经读取链接正常访问
- [x] 9.3 移除服务端 legacy 内联兼容分支，正式拒绝 base64 入参（BREAKING 生效）
- [x] 9.4 更新 README/docs 与移动端权限文案中涉及凭证上传的说明
- [x] 9.5 运行 `pnpm typecheck`、相关 `lint` 与 mobile/delivery smoke，全部通过

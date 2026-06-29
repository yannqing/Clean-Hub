## Why

移动端配送的拍照凭证与客户签收图片目前以 base64 `data:` URL 形式（单条上限约 20MB）直接写入 `delivery_proofs.media_ref` 这个 `text` 列（见 `apps/api/src/modules/mobile/delivery/delivery.controller.ts` 的 `resolveMediaRef`）。这会让数据库随媒体数据无界膨胀、查询与备份变慢、且没有压缩、访问鉴权和清理策略。它同时是后续客户上传、通知附件、便携打印图源等能力的共用底座，越晚替换返工成本越高。

## What Changes

- 新增通用「媒体对象存储」能力：租户隔离的对象存储抽象，提供预签名上传、受控读取（预签名或代理下载）、对象元数据登记与生命周期/清理策略。
- 配送凭证与签收改为对象存储引用：客户端先获取上传凭证并直传对象存储，再把返回的对象 key 作为 `media_ref` 提交；服务端不再接收 base64 内联图片。
- 上传前做客户端图片压缩，并在服务端约束 `content-type`、大小上限与对象命名规范（含 `tenant_id` 前缀隔离）。
- 读取凭证时通过短时效预签名 URL 或鉴权代理下载，确保仅本租户、且具备权限的角色可访问。
- 离线场景:配送离线队列缓存原始图片二进制，恢复网络后按「先直传对象存储、再提交 key」的顺序重放，保持幂等。
- **BREAKING**:`POST /mobile/delivery/tasks/:id/proof` 与 `/signature` 不再接受 `base64` / `signatureBase64` 字段;仅接受对象存储 `mediaRef`。旧内联数据需迁移或标记为 legacy。

## Capabilities

### New Capabilities
- `media-storage`: 租户隔离的对象存储底座，覆盖预签名上传、受控读取、对象登记与生命周期清理，供配送及后续模块复用。

### Modified Capabilities
- `delivery-mobile`: 「拍照凭证上传」与「客户签收完成」的凭证存储方式由内联 base64 改为对象存储引用，并约束上传/读取的鉴权与大小限制。

## Impact

- 后端:新增 `media-storage` 模块（或 `packages/storage` + `apps/api` 适配），改造 `apps/api/src/modules/mobile/delivery` 的 `uploadProof` / `signTask` 输入契约与 `resolveMediaRef`。
- 数据库:`delivery_proofs.media_ref` 语义由内联 data URL 改为对象 key;视需要新增对象登记表（key、tenant、content-type、size、状态、过期）。
- API Client:`packages/api-client/src/mobile` 配送方法需新增「请求上传凭证」步骤并调整 proof/signature 入参。
- 移动端:`apps/mobile-web` 配送 actions、`offline-store` 离线重放与 `device.ts` 拍照流程改为直传对象存储。
- 配置/依赖:新增对象存储（S3 兼容)环境变量与 SDK 依赖;补充本地开发的对象存储（如 MinIO）说明。

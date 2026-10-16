## Context

配送凭证/签收图片当前以 base64 `data:` URL 内联存进 `delivery_proofs.media_ref`（`text` 列，`resolveMediaRef` 上限约 20MB）。这导致数据库随媒体膨胀、备份与查询变慢、且缺压缩、缺访问鉴权、缺清理。本变更引入一个通用的、租户隔离的对象存储底座 `media-storage`，并把配送凭证迁移到对象引用之上。它是后续客户上传、通知附件、便携打印图源的共用地基。

约束:
- 多租户隔离是硬约束（`tenant_id` 前缀 + 读写鉴权）。
- 高风险动作需幂等（凭证/签收已有 `idempotency_key`，对象上传需可重试不产生脏数据）。
- 离线优先:配送端无网时要能缓存图片并在恢复后重放上传。
- 共享逻辑进 `packages`，业务 API 进 `apps/api`（遵循 CLAUDE.md 分层）。

## Goals / Non-Goals

**Goals:**
- 提供 S3 兼容的对象存储抽象:预签名上传、受控读取、对象登记、孤儿清理。
- 配送 proof/signature 改为存对象 key，服务端不再接收内联 base64。
- 租户隔离的对象命名 + 读取鉴权（短时效预签名或代理）。
- 离线队列以「先直传、再提交 key」的方式重放，保持幂等。
- 一次性迁移现有内联 data URL 凭证。

**Non-Goals:**
- 不做图片 CDN、缩略图服务、转码流水线（后续）。
- 不在本变更接客户自助上传、通知附件、蓝牙打印（仅打好可复用底座）。
- 不引入文件版本管理或多副本归档策略。

## Decisions

### 决策 1:统一 MinIO 自托管（本地与生产）
本地与生产统一使用自托管 MinIO，通过其 S3 兼容 API 接入;本地开发将 MinIO 纳入 `docker-compose`（与现有 `pnpm db:up` 一致的本地栈），生产以独立 MinIO 服务部署。`packages/storage` 仍以 S3 兼容 SDK 编写，未来若需切换托管 S3 兼容服务无需改业务代码。
- 理由:与多租户/自部署定位一致，避免绑定特定云厂商;开发与生产形态统一，降低环境差异。
- 备选:AWS S3 / R2 / OSS（暂不选:引入云厂商绑定与成本，可后续按需替换，接口不变）;直接存数据库 BLOB（否决:无界膨胀，正是要解决的问题）;仅本地磁盘（否决:不适合多实例/容器化）。

### 决策 2:预签名直传（presigned PUT），而非 API 代理上传
客户端先调 `POST /mobile/media/uploads` 拿到 `{ objectKey, uploadUrl, headers, expiresAt }`，PUT 二进制直传对象存储，再把 `objectKey` 作为 `mediaRef` 提交给 proof/signature 接口。
- 理由:大图不经过 API 进程,省内存与带宽;天然支持离线重放。
- 备选:multipart 经 API 转存（否决:API 内存压力大、与离线重放割裂）。

### 决策 3:对象 key 命名与租户隔离
key 规范:`tenant/<tenantId>/delivery/<taskId>/<proofId>.<ext>`。`tenantId` 必为前缀，预签名时由服务端用鉴权上下文拼接,客户端不可自带 tenant 段。
- 读取:统一走短时效预签名 GET。`proof` DTO 返回服务端每次现签的短时效（默认 5 分钟）预签名 GET URL，仅本租户、有权限角色可拿到;不采用 API 鉴权代理流式下载。
- 理由:bucket 内逻辑隔离 + 服务端控制 key,避免越权读写他租户对象;预签名 GET 不占 API 进程带宽，移动端读取直连 MinIO。

### 决策 4:新增 `media_objects` 登记表
新增表登记每个对象:`id`(ULID)、`tenant_id`、`object_key`、`content_type`、`size_bytes`、`status`(`pending`→`committed`)、`purpose`(如 `delivery_proof`)、`created_by`、`created_at`、`expires_at`、软删字段。
- 流程:请求上传时建 `pending` 记录;proof/signature 提交并校验 key 归属后置 `committed`;过期未 committed 的 `pending`（孤儿)及其对象由独立 cron 清理（见决策 7）。
- 理由:支撑访问鉴权(校验 key 属本租户)、大小/类型约束落库、生命周期清理。
- `delivery_proofs.media_ref` 继续保存对象 key（语义从 data URL 变为 key），通过 key 关联 `media_objects`。

### 决策 5:代码落点
- `packages/storage`:S3 客户端封装、presign（PUT/GET）、key builder、content-type/大小校验常量。不含业务规则。
- `apps/api/src/modules/media`:`POST /mobile/media/uploads`（请求上传 + 建 pending 登记）、`commit`/校验 helper、读取链接 helper，以及供 cron 调用的清理 use-case（清理逻辑本身复用，不在请求路径执行）。
- `apps/api/src/modules/mobile/delivery`:`uploadProof`/`signTask` 入参去掉 base64，改收 `mediaRef=objectKey`，提交时校验归属并 `committed`。
- `packages/api-client/src/mobile`:新增 `requestUpload`，调整 proof/signature 入参。
- `apps/mobile-web`:拍照→客户端压缩→请求上传→PUT→提交 key;离线队列缓存压缩后二进制并按序重放。

### 决策 6:客户端压缩
浏览器/WebView 内用 canvas 压缩（限制最长边与 JPEG 质量），目标单图 < 1–2MB 再上传。
- 理由:省流量与存储，移动网络友好;服务端仍以 `content-length`/`content-type` 兜底约束。

### 决策 7:孤儿清理用独立 cron
过期未 committed 的 `pending` 对象由独立 cron 进程定期触发清理 use-case，不在 API 请求路径、也不依赖 API 进程常驻定时器。清理逻辑作为可复用 use-case 实现，cron 仅负责调度与租户遍历。
- 理由:与请求处理解耦，避免多实例下定时器重复执行;独立进程便于单独伸缩、限流与监控。
- 备选:API 进程内 `setInterval`/定时任务（否决:多实例重复触发、与请求争资源、随 API 重启不稳定）。

## Risks / Trade-offs

- [预签名 URL 泄露被滥用] → 短 TTL（上传/下载均≤5–15 分钟）+ key 绑定 tenant + 服务端校验归属;读取走每次现签。
- [客户端直传成功但未提交 key（孤儿对象)] → `media_objects` pending + 过期清理任务回收;proof 提交是幂等的，不会因重试产生重复对象记录。
- [离线重放顺序错乱导致提交了未上传完成的 key] → 重放严格「PUT 成功 → 再提交 proof」;失败留在队列重试,幂等键保证不重复。
- [迁移期新旧格式并存] → `media_ref` 读取侧做兼容:`data:` 开头按 legacy 内联返回,否则按对象 key 现签;迁移脚本完成后移除 legacy 分支。
- [新增对象存储依赖增加部署复杂度] → 本地与生产统一自托管 MinIO + 文档化环境变量;接口为 S3 兼容,未来切换托管服务不改业务代码。
- [BREAKING:旧客户端仍发 base64] → 服务端在过渡期可拒绝 base64 并返回明确错误码,移动端强制走新流程;发版协调。

## Migration Plan

1. 部署自托管 MinIO（本地 docker-compose / 生产独立服务)与环境变量,上线 `media-storage` 与 `media_objects` 表(迁移脚本)。
2. 上线 `POST /mobile/media/uploads`,改造配送 proof/signature 接口同时保留对 `data:` legacy 的只读兼容。
3. 发布移动端新版本:拍照→压缩→直传→提交 key,离线重放同步改造。
4. 跑一次性回填脚本:将 `delivery_proofs` 中 `data:` 内联图上传至对象存储并把 `media_ref` 改为 key,登记 `media_objects`。
5. 回填校验通过后,移除服务端 legacy 内联兼容分支,正式拒绝 base64 入参。
- 回滚:第 2–3 步可回滚到接受 base64 的旧版本（legacy 分支仍在);第 5 步前不破坏旧数据。

## Resolved Decisions

- 对象存储选型:统一自托管 MinIO（本地 + 生产），S3 兼容接口。
- 读取方式:短时效预签名 GET（不走 API 代理下载）。
- 孤儿清理:独立 cron 进程调度，复用清理 use-case。

## Open Questions

- 现有内联凭证数据量级（决定回填脚本是否需要分批/限流)。
- 独立 cron 的承载形态（复用现有调度设施 / 新增轻量 cron 服务）需结合部署环境确认。

# CleanHub 生产部署说明

## 部署形态

CleanHub 生产部署采用 release artifact 方式：

```text
本地或 CI 构建 release/cleanhub
  -> 打包上传到服务器
  -> 服务器解压
  -> 使用 release 包内的 Dockerfile 和 docker-compose.yml 启动
```

服务器不需要完整源码仓库，也不需要执行 monorepo 构建。

## Release 包内容

运行 `pnpm release:build` 后会生成：

```text
release/cleanhub/
  Dockerfile
  docker-compose.yml
  manifest.json
  api/
    index.js
    migrate.js
  web-admin/
    server.js
    apps/web-admin/.next/
    node_modules/
  db/
    drizzle/
  env/
    production.env.example
  postgres/
    ensure-app-role.sh
    backup-loop.sh
    cloud-backup-loop.sh
    cloud-object-storage-loop.sh
    restore-drill.sh
  caddy/
    Caddyfile
  nginx/
    cleanhub.conf.example
```

其中：

- `api/index.js` 是通过 esbuild 生成的 API standalone bundle。
- `api/migrate.js` 是 release 包内的数据库迁移 runner。
- `web-admin/` 是 Next.js `output: "standalone"` 产物。
- `pos-web/` 是 POS Next.js `output: "standalone"` 产物。
- `db/drizzle/` 是 Drizzle SQL migration 文件。
- `postgres/` 包含应用数据库角色初始化、15 分钟备份、异机上传和隔离恢复演练脚本。
- `caddy/Caddyfile` 是 POS HTTPS 网关配置，证书由 Let’s Encrypt 自动签发和续期。
- PostgreSQL 与 MinIO 数据分别保存在命名 Docker volumes 中，均不直接暴露到公网。

## 本地或 CI 构建

```bash
pnpm release:build
```

这个命令会执行：

- `pnpm --filter @cleanhub/api-client typecheck`
- `pnpm --filter @cleanhub/api build`
- `pnpm --filter @cleanhub/web-admin build`
- API bundle
- migration runner bundle
- Next standalone 产物复制
- release 包 manifest 生成

## 上传服务器

示例：

```bash
tar -czf cleanhub-release.tar.gz -C release cleanhub
scp cleanhub-release.tar.gz root@<server-ip>:/opt/
```

服务器解压：

```bash
mkdir -p /opt/cleanhub
tar -xzf /opt/cleanhub-release.tar.gz -C /opt/cleanhub --strip-components=1
cd /opt/cleanhub
```

## 生产环境变量

首次部署：

```bash
cp env/production.env.example .env.production
```

编辑 `.env.production`，至少修改：

- `POSTGRES_PASSWORD`
- `POSTGRES_APP_PASSWORD`（必须与管理员密码不同）
- `DATABASE_URL`
- `DATABASE_ADMIN_URL`
- `AUTH_TOKEN_SECRET`
- `CORS_ORIGINS`
- `CLEANHUB_API_BASE_URL`
- `POS_PUBLIC_HOST`
- `WEB_ADMIN_PUBLIC_HOST`
- `BACKUP_S3_ENDPOINT`（必须是另一云厂商或物理主机）
- `BACKUP_S3_ACCESS_KEY`
- `BACKUP_S3_SECRET_KEY`

同域名部署建议：

```env
CLEANHUB_API_BASE_URL=http://api:4000
CORS_ORIGINS=https://cleanhub.example.com
AUTH_COOKIE_SECURE=true
WEB_ADMIN_PUBLIC_HOST=cleanhub.example.com
POS_PUBLIC_HOST=pos.cleanhub.example.com
```

`pnpm release:build` 会把浏览器 API 地址写入前端构建产物，默认值是 `/api`，让
HTTP 与 WebSocket 都通过同源反向代理访问 API。只有跨域部署时才需要在生成
release 的机器上执行
`NEXT_PUBLIC_API_BASE_URL=https://api.example.com pnpm release:build`。
服务器的 `.env.production` 无法覆盖已经构建的浏览器变量。

不要提交真实 `.env.production`。

`DATABASE_URL` 只供 API 使用，必须连接 `NOSUPERUSER NOBYPASSRLS` 的
`POSTGRES_APP_USER`。`DATABASE_ADMIN_URL` 仅供迁移和 seed 工具使用，不能注入 API
容器。release 中的 `db-role-init` 会幂等创建/校正应用角色、授予业务表 DML 权限，
并设置后续迁移所需的默认权限。

## 启动

构建 release 包内镜像：

```bash
docker compose --env-file .env.production build
```

启动数据库：

```bash
docker compose --env-file .env.production up -d postgres
```

执行迁移：

```bash
docker compose --env-file .env.production --profile tools run --rm migrate
```

迁移会为 `public` schema 的全部业务表启用并强制 PostgreSQL RLS：租户表按
`tenant_id` 隔离，`tenants` 根表按自身 `id` 隔离，全局配置表只开放明确需要的
读取路径。API 在生产启动时还会再次检查：应用角色若是超级用户、拥有
`BYPASSRLS`，或任意业务表缺少强制 RLS/基础策略，启动会直接失败，避免以不安全
配置对外提供服务。

启动应用和 HTTPS 网关：

```bash
docker compose --env-file .env.production up -d \
  api web-admin pos-web gateway \
  postgres-backup postgres-backup-cloud object-storage-backup-cloud
```

本机检查：

```bash
curl http://127.0.0.1:4010/health/live
curl http://127.0.0.1:4010/health/ready
curl -I http://127.0.0.1:3011/login
curl -I https://pos.cleanhub.example.com/login
```

`/health/live` 只确认 API 进程仍在运行；`/health/ready` 同时检查数据库与
单机实时通信 Hub，失败时返回 HTTP 503。`/health` 是兼容旧监控的就绪检查别名。
就绪响应还包含当前 WebSocket 连接数、拒绝连接数、租约续期失败次数和过期租约
回收失败次数，生产监控应对 `not_ready`、`leaseRefreshFailures` 或
`leaseSweepFailures` 的持续增长告警。

当前 release 明确采用单 API 实例：POS 连接和租户管理端订阅保存在该进程内存中，
状态租约和状态转换事件保存在 PostgreSQL。主机重启或异常断电后，API 会在启动时
补记已经过期的设备租约。以后扩展为多个 API 实例前，必须引入跨实例消息总线和
分布式 Presence；不能直接增加 API 副本数。

`gateway` 使用 Caddy，只向公网开放 80/443，并强制使用 Let’s Encrypt ACME。
DNS 必须先指向服务器，防火墙必须允许 TCP 80/443 和 UDP 443。证书及 Caddy
状态保存在 `cleanhub-caddy-data`、`cleanhub-caddy-config` volumes 中，更新 release
文件时不得删除这些 volumes。

## 断电与备份

`postgres-backup` 启动后立即执行一次备份，之后按固定 900 秒周期创建 PostgreSQL
custom-format dump。只有通过 `pg_restore --list` 和 SHA-256 校验的归档才会发布；
断电留下的 `.partial` 文件会在重启时清理。`postgres-backup-cloud` 只上传校验通过且
同时具备 dump/checksum 的归档，`object-storage-backup-cloud` 负责异机备份媒体对象。

检查三项服务：

```bash
docker compose --env-file .env.production ps \
  postgres-backup postgres-backup-cloud object-storage-backup-cloud
docker compose --env-file .env.production logs --tail=100 \
  postgres-backup postgres-backup-cloud object-storage-backup-cloud
```

对最新归档执行隔离恢复演练（不覆盖生产数据库）：

```bash
docker compose --env-file .env.production --profile tools run --rm postgres-restore-drill
```

云端桶必须是私有桶，开启版本控制和供应商侧加密。VPS、门店主 POS 和网络设备还必须
接入至少 4 小时 UPS；软件备份无法代替硬件供电保护。完整验收场景见
`docs/06-delivery/acceptance/CleanHub_POS一期断电与灾难恢复验收.md`。

## Nginx

参考 release 包内：

```text
nginx/cleanhub.conf.example
```

推荐单域名反代：

```text
/api/* -> 127.0.0.1:4010
/*     -> 127.0.0.1:3010
```

WebSocket 使用同一个 `/api/realtime/*` 前缀。自定义 Nginx 配置时必须保留示例中的
`Upgrade`、`Connection`、`proxy_read_timeout` 和 `proxy_send_timeout`，否则普通 API
可用但设备会持续显示离线。

启用前检查：

```bash
nginx -t
```

通过后重载：

```bash
systemctl reload nginx
```

## 更新发布

新版本发布时重新生成 release 包并上传覆盖 `/opt/cleanhub`，保留服务器上的 `.env.production`。

```bash
cd /opt/cleanhub
docker compose --env-file .env.production build
docker compose --env-file .env.production --profile tools run --rm migrate
docker compose --env-file .env.production up -d \
  api pos-web gateway \
  postgres-backup postgres-backup-cloud object-storage-backup-cloud
```

## 回滚

保留上一个 release 压缩包。需要回滚时重新解压旧 release，保留 `.env.production`，然后：

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d \
  api pos-web gateway \
  postgres-backup postgres-backup-cloud object-storage-backup-cloud
```

数据库迁移一旦执行，不应假设可以自动回滚。涉及破坏性迁移时，需要先做数据库备份。

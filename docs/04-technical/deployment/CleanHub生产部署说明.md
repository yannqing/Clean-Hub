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
  nginx/
    cleanhub.conf.example
```

其中：

- `api/index.js` 是通过 esbuild 生成的 API standalone bundle。
- `api/migrate.js` 是 release 包内的数据库迁移 runner。
- `web-admin/` 是 Next.js `output: "standalone"` 产物。
- `db/drizzle/` 是 Drizzle SQL migration 文件。

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
- `DATABASE_URL`
- `AUTH_TOKEN_SECRET`
- `CORS_ORIGINS`
- `NEXT_PUBLIC_API_BASE_URL`
- `CLEANHUB_API_BASE_URL`

同域名部署建议：

```env
NEXT_PUBLIC_API_BASE_URL=/api
CLEANHUB_API_BASE_URL=http://api:4000
CORS_ORIGINS=https://cleanhub.example.com
AUTH_COOKIE_SECURE=true
```

不要提交真实 `.env.production`。

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

启动应用：

```bash
docker compose --env-file .env.production up -d api web-admin
```

本机检查：

```bash
curl http://127.0.0.1:4010/health
curl -I http://127.0.0.1:3010/login
```

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
docker compose --env-file .env.production up -d api web-admin
```

## 回滚

保留上一个 release 压缩包。需要回滚时重新解压旧 release，保留 `.env.production`，然后：

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d api web-admin
```

数据库迁移一旦执行，不应假设可以自动回滚。涉及破坏性迁移时，需要先做数据库备份。

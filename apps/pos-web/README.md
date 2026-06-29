# CleanHub POS Web

CleanHub POS 前端，基于 Next.js App Router，支持 Web 浏览器访问和 Capacitor 移动端封装。

## 快速开始

```bash
# 安装依赖（在项目根目录执行）
pnpm install

# 启动 API 服务
pnpm --filter @cleanhub/api dev

# 启动 POS Web（端口 3001）
pnpm --filter @cleanhub/pos-web dev
```

访问 http://localhost:3001

## 移动端封装（Capacitor）

pos-web 可以通过 `apps/pos-mobile` 封装为 Android APK / iOS IPA。

详细步骤请参考 [pos-mobile/README.md](../pos-mobile/README.md)。

### 静态导出配置

当设置环境变量 `CAPACITOR_BUILD=true` 时，`next.config.ts` 会启用静态导出模式：

```bash
CAPACITOR_BUILD=true pnpm build
```

输出目录：`out/`

### 已知问题：登录认证

**问题**：当前使用 HttpOnly Cookie 存储 token，在 Capacitor WebView 中 Cookie 行为不稳定，可能导致：
- 登录后 token 丢失
- 页面刷新后需要重新登录
- Token 刷新失败

**原因**：Capacitor WebView 的 Cookie 管理与浏览器不同，HttpOnly Cookie 可能无法正确持久化。

**待优化方案**：改为 Token 存储在 Capacitor Preferences 中：

1. 登录成功后，将 accessToken/refreshToken 存入 `@capacitor/preferences`
2. API 请求时从 Preferences 读取 token，放在 `Authorization` header 中
3. Token 刷新逻辑改为从 Preferences 读写
4. 登出时清除 Preferences 中的 token

**影响范围**：
- `src/lib/api-client.ts` — 请求拦截器需要读取 token
- `src/lib/session.ts` — session 管理需要适配
- `src/features/auth/` — 登录/登出逻辑需要适配

**临时解决方案**（开发阶段）：使用 `server.url` 模式连接 dev server，此时 Cookie 行为与浏览器一致。

## 技术栈

- Next.js 16（App Router）
- React 19
- Tailwind CSS v4
- @cleanhub/ui（shadcn/ui 模式）
- @cleanhub/api-client（API 请求）

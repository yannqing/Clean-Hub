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

### 服务端加载与认证

本应用依赖 Next.js Proxy、Server Components 和服务端 Cookie，不能使用
`CAPACITOR_BUILD=true` 静态导出。Capacitor 壳会加载一个已运行的 POS Web
地址；生产环境必须使用 HTTPS。

部署时应让 POS 页面与浏览器侧 API 使用同一个公开 origin，例如由
`https://pos.example.com/api/*` 反向代理到 API。认证继续使用服务端设置的
HttpOnly Cookie，并由 WebView Cookie jar 持久化。不要把 access token 或
refresh token 写入 JavaScript 可读的 Capacitor Preferences。

## 技术栈

- Next.js 16（App Router）
- React 19
- Tailwind CSS v4
- @cleanhub/ui（shadcn/ui 模式）
- @cleanhub/api-client（API 请求）

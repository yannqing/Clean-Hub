# CleanHub POS Mobile

面向 iPad、iPhone 和 Android 设备的 POS 客户端。**两个平台的运行模型已经不同**：

- **Android 是原生 Jetpack Compose 应用，不是 WebView。** 收银界面由 APK 自身
  提供，全部代码在 `android/app/src/main/kotlin/com/cleanhub/pos/nativepos/`，
  有独立的 API 客户端、SQLite 缓存、离线重放队列和硬件桥接。
  `MainActivity` 是普通 `ComponentActivity`，直接 `setContent { NativePosApp(...) }`，
  不会启动 Capacitor 的 `BridgeActivity`。API 地址编译进
  `BuildConfig.CLEANHUB_POS_API_BASE_URL`；打包时 `CLEANHUB_POS_NATIVE_ANDROID=true`
  会让 `capacitor.config.ts` 省略 `server` 字段。
  改动收银、订单、工单等业务规则前，请先阅读仓库根目录 `CLAUDE.md` 的
  「Native Android POS」一节——服务端的部分业务规则在 Kotlin 里有**第二份实现**。
- **iOS 仍然是 Capacitor 壳**，业务界面由 `apps/pos-web` 提供。

本文件「运行模型」及之后的章节描述的是 **iOS 壳**（以及 Android 在启用原生
打包之前的旧模式）。

## 运行模型（iOS）

`pos-web` 使用 Next.js Proxy、Server Components、`cookies()` 和 `headers()`，
不能静态导出。因此本壳的生产模式不是复制 `out/`，而是加载已部署的 HTTPS
POS 站点：

```text
iPad WebView -> https://pos.example.com
                    ├── Next.js POS 页面
                    └── /api/* 反向代理到 CleanHub API
```

POS 页面和浏览器侧 API 地址必须是同一个公开 origin。这样 API 设置的
host-only HttpOnly Cookie 才会同时发送给 Next.js 和 API。不要采用
`pos.example.com` 页面直连 `api.example.com` 的跨域 Cookie 方案。

`www/index.html` 仅是远程服务不可达时的故障提示页，不是生产 POS 页面。
同步脚本只把经过校验的公开 POS Origin 写入
`www/pos-runtime-config.js`，不会写入账号、Token、Cookie、查询参数或其他环境
变量。网络恢复后，故障页会重新导航到该 Origin，而不是反复刷新本地页面。

## 本地 iPad 开发

需要 Node.js 22、pnpm 10 和完整 Xcode（仅安装 Command Line Tools 不能构建
iOS 工程）。真机还需要 Apple 开发者签名与 provisioning profile。

在仓库根目录切换到局域网开发配置：

```bash
pnpm pos:config:lan
```

脚本会自动识别开发电脑的局域网 IPv4，并同步更新根目录 `.env`、
`apps/pos-web/.env` 和 `apps/pos-mobile/.env`。存在多个网卡或自动识别结果不对时，
可以明确指定 IP：

```bash
pnpm pos:config:lan -- --host 192.168.2.106
```

不要为真机填写 `localhost`，因为设备上的 `localhost` 指向设备自身。切换后
必须重启 API 与 POS Web，并重新同步/安装原生应用。还应确认系统防火墙允许
设备访问 3001 与 4000 端口。回到纯浏览器调试时运行
`pnpm pos:config:local`。

分别启动 API 与可从局域网访问的 POS Web：

```bash
pnpm --filter @cleanhub/api dev
pnpm --filter @cleanhub/pos-web dev --hostname 0.0.0.0
```

然后同步、运行或打开 Xcode：

```bash
pnpm --filter @cleanhub/pos-mobile cap:sync:ios
pnpm --filter @cleanhub/pos-mobile cap:run:ios
pnpm --filter @cleanhub/pos-mobile cap:ios
```

Android 对应命令为：

```bash
pnpm --filter @cleanhub/pos-mobile cap:sync:android
pnpm --filter @cleanhub/pos-mobile cap:run:android
pnpm --filter @cleanhub/pos-mobile cap:android
```

也可以在仓库根目录一条命令生成可侧载的 Debug APK：

```bash
CLEANHUB_POS_VERSION=0.1.0 \
CLEANHUB_POS_BUILD_NUMBER=1 \
pnpm package:pos-android:debug
```

脚本会先根据 `apps/pos-mobile/.env` 同步 Capacitor，再将 APK 和包含
SHA-256 的构建清单复制到 `release/pos-mobile/android/`。Debug APK 使用
Android 开发签名，只能用于开发和受控测试，不能用于正式升级链路。

iOS 已声明本地网络用途并仅放开本地网络 ATS。HTTP 只允许开发环境，且必须
显式设置 `CLEANHUB_POS_ALLOW_CLEARTEXT=true`。

## 生产构建

生产壳使用独立的 `.env.production`，不要复用开发 `.env`：

```bash
cp apps/pos-mobile/.env.production.example apps/pos-mobile/.env.production
```

将 `CLEANHUB_POS_SERVER_URL` 改成实际 HTTPS POS Origin。它必须与部署环境的
`POS_PUBLIC_ORIGIN` 一致，并且只能包含 scheme、host 和可选端口；脚本会拒绝
账号密码、路径、query、fragment、localhost 和示例域名。

POS Web 的生产环境同时应使用类似配置：

```dotenv
CLEANHUB_API_BASE_URL=http://cleanhub-api:4000
NEXT_PUBLIC_API_BASE_URL=https://pos.example.com/api
AUTH_COOKIE_SECURE=true
```

其中 `/api/*` 必须由 `pos.example.com` 的反向代理去掉 `/api` 前缀后转发
到 API，并保留多个 `Set-Cookie` 响应头。

生产发布只能使用下面的专用命令。它们会强制检查：

- runtime 必须明确为 `production`；
- 服务地址必须存在并使用非示例域名的 HTTPS Origin；
- cleartext、mixed content、WebView 调试和运行日志必须关闭；
- 同步后的原生配置与故障恢复页必须使用同一个 Origin。

```bash
pnpm --filter @cleanhub/pos-mobile build:production
pnpm --filter @cleanhub/pos-mobile release:validate
```

也可只同步一个平台：

```bash
pnpm --filter @cleanhub/pos-mobile release:sync:ios
pnpm --filter @cleanhub/pos-mobile release:sync:android
```

校验通过后，再在 Xcode/Android Studio 中完成签名归档：

```bash
pnpm --filter @cleanhub/pos-mobile cap:ios
pnpm --filter @cleanhub/pos-mobile cap:android
```

Android 也提供完整的一键签名打包流程。签名信息只从当前 shell/CI secret
读取，不要写进 `.env.production`：

```bash
export CLEANHUB_POS_VERSION=0.1.0
export CLEANHUB_POS_BUILD_NUMBER=1
export CLEANHUB_ANDROID_KEYSTORE_PATH=/secure/path/cleanhub-pos-release.keystore
export CLEANHUB_ANDROID_KEYSTORE_PASSWORD='...'
export CLEANHUB_ANDROID_KEY_ALIAS=cleanhub-pos-release
export CLEANHUB_ANDROID_KEY_PASSWORD='...'

pnpm package:pos-android
```

该命令会读取 `apps/pos-mobile/.env.production`、执行 TypeScript 构建、
Capacitor Android 同步和生产安全校验，然后生成签名 APK 与 AAB：

```text
release/pos-mobile/android/CleanHub-POS-<version>-<build>.apk
release/pos-mobile/android/CleanHub-POS-<version>-<build>.aab
release/pos-mobile/android/CleanHub-POS-<version>-<build>-release.json
```

`CLEANHUB_POS_BUILD_NUMBER` 必须为正整数，并且每次对已安装应用发布升级时
都必须递增。keystore、alias 和密码必须长期安全保存；丢失签名密钥后无法
以相同应用 ID `com.cleanhub.pos` 覆盖升级。

不要在发布前执行开发用的 `cap:sync*`；它会按 `.env` 生成开发配置，并使
`release:validate` 明确失败。正式归档前再次运行 `release:validate`。

Capacitor 将 `server.url` 定位为 live-reload 能力；当前远程壳是为了兼容
现有 Next.js 服务端架构。若面向公开 App Store 分发，应在发布前完成审核
合规评估；如不能接受远程壳，需要另行建设可随安装包发布的离线客户端，
不能用一次 `CAPACITOR_BUILD` 静态导出来替代。

## 设备身份与 Cookie

- 原生安装 ID 存在 Capacitor Preferences；浏览器回退使用 localStorage。
- 原生平台 ID 只会先做带应用命名空间的 SHA-256 哈希，不直接发送硬件 ID。
- Preferences 只保存非机密的 installation device ID。
- Android 应用备份与设备间自动恢复已关闭，避免把终端安装状态复制到另一台设备。
- access token、refresh token 和 terminal cookie 始终由服务端设置为 HttpOnly，
  不会写入 Preferences，也不会由前端 JavaScript读取。
- `CapacitorCookies` 负责同步原生 Cookie jar 与 WebView，仍会过滤 HttpOnly
  Cookie，认证请求继续使用普通浏览器 Cookie 行为。

## 真机验收清单

发布前至少在实际 iPad 上验证：

1. 首次安装、强制退出、重启设备和覆盖升级后 installation ID 保持不变。
2. 登录及 token 刷新后，关闭并重新打开应用仍能恢复会话。
3. 未初始化、凭据丢失、已停用和已登记终端分别进入正确页面。
4. 开发 LAN HTTP 可连接；生产 HTTP 会被配置拒绝，HTTPS 可正常启动。
5. 横竖屏、刘海/状态栏、软键盘和 iPad 分屏下没有内容被遮挡。
6. 清除站点 Cookie 后，Preferences 中的设备 ID 应保持稳定，但终端凭据会丢失，
   因而进入“凭据恢复”流程；卸载重装后的平台设备 ID 是否延续由操作系统决定，
   必须验证最终落入恢复或重新登记流程，不能静默绑定到其他终端。

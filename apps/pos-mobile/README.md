# CleanHub POS Mobile

CleanHub POS 的 Capacitor 移动端壳，用于将 pos-web 封装为 Android APK / iOS IPA。

## 项目结构

```
apps/pos-mobile/
├── capacitor.config.ts   ← Capacitor 配置
├── package.json          ← 依赖和脚本
├── tsconfig.json         ← TypeScript 配置
├── src/
│   └── index.ts          ← 原生插件入口（预留）
├── www/
│   └── index.html        ← 生产构建入口（由 pos-web out/ 同步）
└── android/              ← Capacitor 生成（npx cap add android）
```

## 开发环境搭建

### 前置条件

- Node.js >= 20
- pnpm >= 10
- Android Studio（Android 开发）
- Xcode（iOS 开发，仅 macOS）

### 首次初始化

```bash
# 1. 安装依赖
pnpm install

# 2. 添加 Android 平台（只需执行一次）
cd apps/pos-mobile
npx cap add android

# 3. 添加 iOS 平台（可选，仅 macOS）
npx cap add ios
```

## 开发流程（实时热更新）

开发时，Capacitor WebView 直接连接 pos-web 的 dev server，无需每次构建。

```bash
# 终端 1：启动 API 服务
pnpm --filter @cleanhub/api dev

# 终端 2：启动 POS Web（端口 3001）
pnpm --filter @cleanhub/pos-web dev

# 终端 3：同步并运行到 Android 设备
cd apps/pos-mobile
npx cap sync android
npx cap run android
```

### 真机调试注意事项

如果使用真机（非模拟器），需要将 `capacitor.config.ts` 中的 `localhost` 替换为电脑的局域网 IP：

```typescript
server: {
  url: "http://192.168.1.100:3001",  // 替换为你的电脑 IP
  cleartext: true,
},
```

确保手机和电脑在同一局域网，且 API 服务（端口 4000）也允许局域网访问。

## 生产构建

### 构建 APK

```bash
# 1. 静态导出 pos-web
CAPACITOR_BUILD=true pnpm --filter @cleanhub/pos-web build

# 2. 复制到 pos-mobile 的 www/ 目录
rm -rf apps/pos-mobile/www/*
cp -r apps/pos-web/out/* apps/pos-mobile/www/

# 3. 同步到 Capacitor
cd apps/pos-mobile
npx cap sync android

# 4. 构建 Debug APK
cd android
./gradlew assembleDebug
# 输出：android/app/build/outputs/apk/debug/app-debug.apk

# 5. 构建 Release APK（需要签名配置）
./gradlew assembleRelease
```

### 构建 iOS（仅 macOS）

```bash
# 同步到 iOS
npx cap sync ios

# 在 Xcode 中打开
npx cap open ios
```

## Capacitor 配置说明

`capacitor.config.ts` 中的关键配置：

| 配置项 | 开发模式 | 生产模式 |
|--------|----------|----------|
| `server.url` | `http://localhost:3001` | 删除此行 |
| `webDir` | `www`（不使用） | `www`（加载静态文件） |
| `server.cleartext` | `true` | 不需要 |

**切换到生产模式**：注释掉或删除 `server.url` 行，Capacitor 将从 `www/` 目录加载。

## 环境变量

pos-web 在 Capacitor 中运行时使用的环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | API 服务地址 | `http://localhost:4000` |
| `NEXT_PUBLIC_POS_TENANT_CODE` | 终端绑定的租户编码 | `CLEAN-001` |

## 后续扩展

| 功能 | Capacitor 插件 | 状态 |
|------|---------------|------|
| 蓝牙打印 | `@niceblue/capacitor-bluetooth-printer` | 待接入 |
| 二维码扫描 | `@capacitor-community/barcode-scanner` | 待接入 |
| 震动反馈 | `@capacitor/haptics` | 待接入 |
| 推送通知 | `@capacitor/push-notifications` | 待接入 |
| 相机拍照 | `@capacitor/camera` | 待接入 |

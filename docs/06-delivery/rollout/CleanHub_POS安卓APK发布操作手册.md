# CleanHub POS 安卓 APK 发布操作手册

面向：负责发版的人。目标是产出一个用户能从浏览器下载并安装的 APK。

## 一次性准备

### 1. 生成签名密钥库

**只做一次。之后所有版本必须用同一个密钥。** 换密钥后 Android 会拒绝安装更新，
用户只能卸载重装，终端本地数据和离线队列里未同步的销售会全部丢失。

```bash
keytool -genkeypair -v \
  -keystore cleanhub-pos-release.jks \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -alias cleanhub-pos
```

把这个文件离线备份两份。**它不进 git**（`.gitignore` 已覆盖 `release/`，但
keystore 不要放进仓库任何位置）。丢失等于这个应用再也无法发布更新。

### 2. 配置 GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 值 |
|---|---|
| `POS_API_BASE_URL` | API 域名，必须 `https://`，不带路径，例：`https://api.example.com` |
| `ANDROID_KEYSTORE_BASE64` | keystore 的 base64：`base64 -i cleanhub-pos-release.jks \| pbcopy` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | 别名（上面用的 `cleanhub-pos`） |
| `ANDROID_KEY_PASSWORD` | key 密码 |

Linux 下生成 base64 用 `base64 -w0 cleanhub-pos-release.jks`。

### 3. 域名与证书

- 必须是公共 CA 签发的证书（Let's Encrypt 可以）。应用没有配置自定义 CA，
  **自签证书连不上**。
- 必须 HTTPS。应用禁用了明文流量，发布校验也会拒绝非 HTTPS 的 origin。

### 4. 服务端生产配置

API 以 `NODE_ENV=production` 启动时，以下变量缺失会直接启动失败或功能异常：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | 生产数据库 |
| `AUTH_TOKEN_SECRET` | ≥32 字符 |
| `PAYMENT_MOCK_SECRET` | **缺失则进程启动失败** |
| `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` | 加密租户支付凭据 |
| `AUTH_COOKIE_SECURE=true` | HTTPS 下必须 |
| `CORS_ORIGINS` | 只填网页端域名 |

**原生 POS 不需要配 CORS。** 它不发 `Origin` 头，服务端对这类请求放行；
`CORS_ORIGINS` 只用于 web-admin 和 pos-web。

### 5. 数据准备

数据库里要有一个租户和一个**店主或经理**账号。新终端首次启动必须走
「管理员登录 → 选门店 → 绑定终端」，没有这个账号走不完第一步。

## 发版

两种触发方式，任选其一。

### 方式 A：打标签（推荐）

```bash
git tag pos-v1.0.0
git push origin pos-v1.0.0
```

版本号取自标签（`pos-v1.0.0` → `1.0.0`），versionCode 取 GitHub 的运行序号，
天然递增，不会重复。

### 方式 B：手动触发

Actions → Release POS APK → Run workflow，填版本号和 build number。

**build number（versionCode）必须比上一版大**，否则 Android 拒绝安装更新。

## 产物

流水线结束后：

- **GitHub Release** 页面带 `.apk` 和 `.aab`，这就是你的下载链接
- **构建摘要**里有每个文件的 SHA-256，可以公布给用户校验
- Actions artifact 保留 90 天

`.aab` 只用于上架 Google Play，不能直接安装。给用户的链接指向 `.apk`。

## 流水线做了什么检查

失败即中止，不会产出有问题的包：

1. 原生 POS 与服务端业务规则的一致性校验
2. Android 单元测试
3. 发布配置校验（HTTPS、非回环地址、备份已禁用等）
4. 产物校验：签名可验证、非 debuggable、明文流量已禁用、API 域名确实编进了包

## 下载页要写的话

用户从浏览器装 APK，Android 首次会拦截并要求允许「安装未知来源应用」。
下载页必须说明这一点，否则用户会以为文件坏了。

设备要求：Android 7.0 以上。安装包约 17 MB。

## 已知限制

**T8 打印机未经真机验证。** 代码绑定 `com.incar.printerservice`，但用的是 NYX
的 AIDL 接口做类型转换，两者描述符不同时 Binder 事务会失败。旧的 Capacitor
插件是同样写法，所以这是从 pos-web 继承的行为，不是原生移植引入的。

T1101 用匹配的 NYX 服务，没有这个问题。

**上线前请在 T8 真机上打一张测试页确认。** 即使失败也只是明确报错，不会崩溃。

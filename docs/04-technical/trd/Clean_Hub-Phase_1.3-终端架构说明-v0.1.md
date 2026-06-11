# CleanHub 终端架构说明 v0.1

| 版本 | 日期 | 状态 | 说明 |
| ---- | ---- | ---- | ---- |
| v0.1 | 2026-06-11 | Draft | Phase 1.3 产出；四端边界、参考硬件映射、Phase 4 前置决策 |

---

## 1. 文档目的

本文档说明 CleanHub 各终端（SaaS 管理后台、租户后台、POS、Mobile）的技术边界、运行环境、鉴权约定，以及 Phase 4（POS 订单闭环 + 硬件 PoC）所需的前置决策。不包含业务功能设计，业务功能见各期 TRD。

---

## 2. 四端边界

### 2.1 全局架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        apps/api  (Hono · :4000)                     │
│  /auth/**   /saas/**   /tenant/**   /pos/**（第四次）                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS + HttpOnly Cookie / Bearer PIN token
          ┌────────────────┼────────────────────────────┐
          │                │                            │
┌─────────▼──────┐  ┌──────▼────────────┐  ┌──────────▼──────────┐
│  apps/web-admin│  │  apps/pos-web     │  │  apps/mobile        │
│  Next.js :3000 │  │  Next.js :3001    │  │  Capacitor Shell    │
│                │  │  (或 APK on T1101)│  │  Android / iOS      │
│  /saas/**      │  │  收银 · 下单 ·    │  │  客户 · 配送 ·       │
│  /tenant/**    │  │  打印 · 扫码      │  │  预约 · 追踪         │
└────────────────┘  └──────┬────────────┘  └─────────────────────┘
                           │
                  ┌────────▼────────┐
                  │  apps/desktop   │
                  │  Electron Shell │
                  │  Windows/macOS  │
                  │  PC 柜台 + 外设  │
                  └─────────────────┘
```

### 2.2 各端职责与约束

| 终端 | App | 运行环境 | 主要用户 | 路由前缀 |
| ---- | --- | -------- | -------- | -------- |
| SaaS 管理后台 | `apps/web-admin` `/saas/**` | 浏览器 | super_admin / support | `/saas` |
| 租户后台 | `apps/web-admin` `/tenant/**` | 浏览器 | Owner / Manager | `/tenant` |
| POS Web | `apps/pos-web` | POS-T1101 APK · `desktop` Electron · 浏览器（开发） | Cashier / Owner / Manager | `/pos/**`（第四次） |
| Desktop Shell | `apps/desktop` | Electron · Windows / macOS | 同 POS Web | 同 POS Web |
| Mobile | `apps/mobile` | Capacitor · Android / iOS | 客户 / 配送员 | 独立路由（第四次后） |

**重要边界**：

- `apps/mobile` 是客户/配送方向 App，**不是** POS-T1101 上的收银 App，也不打包 `web-admin`。
- `apps/desktop` 是 PC 柜台形态的 Electron 包装层，内嵌 `pos-web`，不直接实现收银 UI。
- **Cashier 禁止进入 `/tenant`**；仅使用 POS（第四次开发登录与下单）。

---

## 3. POS 鉴权约定（T-03）

### 3.1 web-admin（Owner / Manager）

- 使用 access token + refresh token，存储在 **HttpOnly Cookie**。
- 前端 JavaScript **不读取** token 值。
- API 请求通过 Cookie 自动携带（`credentials: "include"`）。
- `apps/web-admin/src/proxy.ts` 负责路由守卫：未登录跳转 `/login?next=<path>`；SaaS 角色只进 `/saas`；Tenant 角色只进 `/tenant`。

### 3.2 POS（Cashier · 第四次实现）

- 登录方式：Pressing Code（店号）+ 6 位 PIN，**不使用邮箱/密码**。
- 登录成功后下发 **PIN Session Token**（短效），存储在 `pos-web` 的内存 state 或 secure storage，**不读取 HttpOnly Cookie**。
- POS API 请求通过 `Authorization: Bearer <pin_token>` 携带登录态。
- 离线时请求进入本地 `packages/offline` 队列，恢复网络后同步。

### 3.3 Mobile（第四次后）

- 客户侧：手机号 + OTP 或 OAuth；存储在 Capacitor SecureStorage。
- **不复用** `web-admin` 的 HttpOnly Cookie 鉴权。
- **不依赖** `web-admin/proxy.ts`（SSR middleware，Mobile 无 Next.js 服务端）。

---

## 4. 端口与构建约定（T-04）

| App | 开发端口 | 生产构建产物 | 备注 |
| --- | -------- | ------------ | ---- |
| `apps/api` | 4000 | Node.js 进程 | `pnpm --filter @cleanhub/api dev` |
| `apps/web-admin` | 3000 | Next.js standalone | `pnpm --filter @cleanhub/web-admin dev` |
| `apps/pos-web` | **3001** | 待定（见 §4.1） | `pnpm --filter @cleanhub/pos-web dev` |
| `apps/desktop` | — | Electron `dist/main.js` | 开发态：`tsc && electron .`，加载 `http://localhost:3001` |
| `apps/mobile` | — | Capacitor Android/iOS APK | `pnpm --filter @cleanhub/mobile dev` |

### 4.1 pos-web 构建形态决策（待 Phase 4 确认）

POS-T1101 上的 `pos-web` 部署形态有两种选项，**本波次暂不实施，Phase 4 立项前确认**：

| 选项 | 描述 | 优点 | 缺点 |
| ---- | ---- | ---- | ---- |
| **A：standalone server** | `next build` → `next start` 在 Android 设备或本地服务运行 | 支持 SSR、动态路由、API routes | 需要 Node 运行时或反向代理；APK 内嵌复杂 |
| **B：static export** | `output: 'export'` → 纯静态文件，内嵌 APK 或 Nginx | APK 体积小，可完全离线 | 不支持 API routes、SSR；需 client-side auth |

**当前决策**：Phase 1.3 保持 `next dev :3001`（开发态），`desktop` 通过 `loadURL` 加载；Phase 4 根据 POS-T1101 WebView 能力确认选项。

---

## 5. 参考硬件映射（T-05 · §22）

### 5.1 POS 一体机（收银主设备）

| 型号 | 屏幕 | 内置能力 | CleanHub 对应 |
| ---- | ---- | -------- | ------------- |
| **POS-T1101**（主参考） | 11" 横屏 **1280×800** | 80/58mm 热敏小票机、2D 扫码头、2.4" 客显副屏、RJ12 钱箱口 | `pos-web` APK 主设计基准；Phase 1.3 壳层 UI 对标 |
| POS-T8（备选） | 8" 小屏横屏 | 一体机；便携/副收银 | 架构文档备选，UI 需缩放适配 |
| POS-1566（备选） | 15.6" 大屏 | 固定柜台 | 架构文档备选 |

### 5.2 外设清单（PC 柜台 / `desktop` 场景）

| 型号 | 类型 | 协议 / 接口 | Phase 4 对接方式 |
| ---- | ---- | ----------- | ---------------- |
| OCPP-80S / M086 / 762B | 热敏小票机 | ESC/POS；USB / 网口 | `packages/hardware` → `desktop` IPC bridge |
| OCBP-M810 | 标签打印机 | CPCL；USB / 蓝牙 | `packages/hardware` → `desktop` IPC bridge |
| OCBS-W287 | 无线扫码枪 | 2.4G + 蓝牙；HID 模拟键盘 | HID 键盘事件监听（无需驱动）；T1101 可先用内置扫码头 |
| TM-AA-5D | 钱箱 | RJ12 脉冲；串接小票机 | 小票机打印完成后触发脉冲 |

### 5.3 软件边界速查

| 场景 | App | 硬件访问方式 |
| ---- | --- | ------------ |
| POS-T1101 Android 一体机 | `pos-web` APK（WebView） | WebView JSBridge 或原生 SDK（T-06 决策） |
| PC 柜台（Windows/macOS） | `apps/desktop` Electron | `packages/hardware` Node.js 驱动 → Electron main process IPC → renderer |
| 客户手机 | `apps/mobile` Capacitor | Capacitor 插件（蓝牙打印、GPS、相机） |
| 开发 / 测试 | 浏览器 | Mock 硬件驱动（`packages/hardware` 提供 stub） |

---

## 6. Phase 4 前置决策（T-06）

### 6.1 POS-T1101 打印 / 扫码 / 客显接入方案选择

POS-T1101 运行 Android，内置打印机（ESC/POS）、2D 扫码头、2.4" 客显副屏。Phase 4 需在 `pos-web`（WebView 内运行）中驱动这些设备，有两个方向：

**方向 A：WebView JSBridge（推荐优先评估）**

```
pos-web (JavaScript)
  → window.OcomBridge.print(receiptData)   // 厂商注入 JSBridge
  → Android Java/Kotlin Native Layer
  → 内置打印机 / 扫码 / 客显
```

- 优点：`pos-web` 无需改架构；厂商若提供 WebView JSBridge SDK 即可直接接入。
- 前提：OCOM POS-T1101 厂商提供 WebView 注入 SDK（需第四次立项前与厂商确认）。

**方向 B：原生 Capacitor 桥接**

```
pos-web (React)
  → @capacitor/pos-hardware 自研插件
  → Capacitor Bridge
  → Android Java/Kotlin Native Layer
  → 内置设备
```

- 优点：不依赖厂商 WebView SDK；跨机型复用 Capacitor 插件。
- 缺点：需开发自研 Capacitor 插件；APK 构建复杂度增加。

**当前决策**：Phase 1.3 **两个方向均不实施**；`pos-web` 硬件入口（打印/扫码/客显）保持 `disabled` 占位。Phase 4 立项前需完成：
1. 向 OCOM 确认 POS-T1101 是否提供 WebView JSBridge SDK。
2. 若无 JSBridge，确认是否优先方向 B。

### 6.2 `device_id` 与门店绑定策略（Phase 4 设计要点）

- `device_id` 由 `@cleanhub/id` 的 `createId()` 生成，首次启动时写入 `AsyncStorage` / Electron `app.getPath("userData")`，后续读取复用。
- Phase 4 需设计终端注册表（`terminal_devices` 表），将 `device_id` 与 `branch_id`、`tenant_id` 绑定，用于离线同步路由和权限隔离。

### 6.3 离线同步前置条件（Phase 4）

- `packages/offline` 已提供队列原语；Phase 4 需在此之上实现：
  - 订单写操作入本地队列，恢复网络后 replay。
  - 冲突解决策略（last-write-wins 或服务端仲裁，待第四次设计）。
- `packages/db` 的 ULID 主键策略已满足离线 ID 生成要求（无需联网）。

---

## 7. 各端依赖关系与部署拓扑

```
Internet / LAN
      │
      ▼
 apps/api (:4000)
  ├─ PostgreSQL (db:5432)
  └─ HTTPS API
       ├── web-admin (:3000)  ← 浏览器（Owner / Manager / SaaS 管理员）
       ├── pos-web (:3001)    ← 浏览器（开发）/ POS-T1101 APK / desktop Electron
       └── mobile (APK/IPA)   ← 客户 / 配送员手机
```

**网络约束**：
- POS 端设计为弱网可用；关键操作（创建订单、收款）写入离线队列后本地确认，联网后同步。
- `web-admin` 无离线需求，强依赖网络。
- `mobile` 客户端允许离线浏览历史订单，核心操作需在线。

---

## 8. 遗留项与第四次开发前置清单

| 编号 | 项目 | 责任人 | 时间节点 |
| ---- | ---- | ------ | -------- |
| R-01 | 确认 OCOM POS-T1101 WebView JSBridge SDK 可用性 | 李龙杰 / 杨序 | Phase 4 立项前 |
| R-02 | `pos-web` 构建形态决策（standalone vs static export） | 李龙杰 | Phase 4 立项前 |
| R-03 | `terminal_devices` 表设计与 `device_id` 注册流程 | 杨序 | Phase 4 TRD |
| R-04 | Cashier PIN 登录 + POS 路由守卫 | 杨序 | Phase 4 Day 1 |
| R-05 | `packages/hardware` 正式驱动接入（打印/扫码/钱箱） | 杨序 | Phase 4 硬件 PoC |
| R-06 | `packages/offline` 订单队列 PoC | 杨序 | Phase 4 Day 2–3 |
| R-07 | `apps/mobile` 客户/配送业务页面 | 另文档规划 | Phase 5+ |

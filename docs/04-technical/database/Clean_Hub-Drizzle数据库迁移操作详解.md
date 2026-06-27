# Clean Hub Drizzle 数据库迁移操作详解

> **适用对象：** 主要面向过去熟悉 **Spring Boot + MyBatis Plus + MySQL**，但不熟悉 **Drizzle ORM + PostgreSQL + Migration** 工作流的开发者。

> **核心结论：** 在团队协作项目里，数据库表结构变更不应该只靠手动执行 SQL，也不应该只靠“代码里改实体类”。**Migration 是数据库结构变更的版本记录**，它让每个人、每个环境都能按同一套步骤把数据库升级到同一状态。

## 1. 为什么需要数据库迁移

过去使用 Spring Boot + MyBatis Plus + MySQL 时，很多团队常见做法是：

- 开发者本地手动改表。
- 把 SQL 发到群里或写在临时文档里。
- 测试环境由某个人手动执行 SQL。
- 生产环境上线前再整理一份 SQL。

这种方式在小项目早期可以跑起来，但多人协作后会出现明显问题：

- **不知道某个环境执行过哪些 SQL。**
- **同一个字段在不同开发者本地类型不一致。**
- **测试环境和生产环境结构不一致。**
- **上线时漏执行 SQL，代码已发布但数据库缺字段。**
- **多人同时改表时，SQL 顺序、冲突和回滚很难管理。**

Migration 的作用就是把数据库结构变化变成一组可追踪、可评审、可重复执行的文件。

简单理解：

```text
以前：开发者口头说“我加了一个字段，你也加一下”
现在：开发者提交一个 migration 文件，所有环境按顺序执行
```

## 2. 什么是 Migration

Migration 可以理解为数据库结构的版本升级脚本。

比如你把 `users` 表增加一个 `last_login_at` 字段，Drizzle 会生成类似这样的迁移 SQL：

```sql
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;
```

这个 SQL 会被保存到 migration 文件里，并且进入代码仓库。后续其他人拉代码后，只需要执行迁移命令，就能把自己的本地数据库升级到同样结构。

> **注意：** Migration 管的是数据库结构变化，例如建表、加字段、改索引、加枚举、加外键。它不是普通业务数据的增删改查。

## 3. Drizzle 在本项目中的位置

Clean Hub 的数据库相关代码集中在：

```text
packages/db/
  drizzle.config.ts
  src/
    schema/
      tenants.ts
      users.ts
      rbac.ts
      auth.ts
      audit.ts
      index.ts
```

核心规则：

- 表结构定义写在 `packages/db/src/schema/**`。
- Drizzle 配置在 `packages/db/drizzle.config.ts`。
- migration 文件生成到 `packages/db/drizzle/`。
- 根目录提供统一命令，开发者优先使用根目录命令。
- 所有业务实体主键和跨表引用 ID 使用 ULID，数据库类型为 `varchar(26)`。
- 新增 ID 字段优先使用 `packages/db/src/schema/id.ts` 中的 `ulidPrimaryKey()` 和 `ulidColumn()`。
- 业务表禁止使用数据库自增 ID，禁止新增 PostgreSQL `uuid` 主键。
- 应用层需要生成 ID 时，统一从 `@cleanhub/id` 导入 `createId()`。

当前 Drizzle 配置读取的是根目录 `.env` 中的：

```env
DATABASE_URL="postgres://postgres:postgres@localhost:5432/cleanhub"
```

## 4. 常用命令总览

建议团队成员优先在项目根目录执行以下命令。

| 命令 | 用途 | 是否会改数据库 |
| ---- | ---- | ---- |
| `pnpm db:up` | 创建并启动本地 PostgreSQL 与 MinIO 容器 | 会创建/启动容器 |
| `pnpm db:down` | 停止本地 PostgreSQL 容器 | 不删除数据卷 |
| `pnpm db:ps` | 查看数据库容器状态 | 否 |
| `pnpm db:logs` | 查看 PostgreSQL 与 MinIO 容器日志 | 否 |
| `pnpm db:generate` | 根据 schema 生成 migration 文件 | 不直接改数据库 |
| `pnpm db:migrate` | 执行 migration 到当前数据库 | 会改数据库结构 |
| `pnpm db:push` | 直接把 schema 推到数据库 | 会改数据库结构 |
| `pnpm db:studio` | 打开 Drizzle Studio | 通常不改结构 |

## 5. 第一次本地启动数据库

### 5.1 安装依赖

```bash
pnpm install
```

### 5.2 创建本地环境变量

```bash
cp .env.example .env
```

确认 `.env` 中至少有：

```env
POSTGRES_DB="cleanhub"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_PORT="5432"
DATABASE_URL="postgres://postgres:postgres@localhost:5432/cleanhub"
OBJECT_STORAGE_ENDPOINT="http://localhost:9000"
OBJECT_STORAGE_BUCKET="cleanhub-media"
OBJECT_STORAGE_ACCESS_KEY="cleanhub"
OBJECT_STORAGE_SECRET_KEY="cleanhub-minio-password"
```

### 5.3 启动 PostgreSQL 与 MinIO

```bash
pnpm db:up
```

`pnpm db:up` 会启动：

- `postgres`：本地 PostgreSQL。
- `minio`：本地 S3 兼容对象存储。
- `minio-init`：一次性创建 `OBJECT_STORAGE_BUCKET` 指定的私有 bucket。

本地 MinIO 默认地址：

```text
S3 endpoint：http://localhost:9000
Console：     http://localhost:9001
```

生产环境同样使用自托管 MinIO 或兼容 S3 的对象存储，但必须更换为独立强密钥、私有 bucket，并限制网络访问范围。

### 5.3.1 媒体对象清理与回填

配送拍照凭证与客户签名使用对象存储，不再把 base64 图片写入数据库。API 会在申请上传凭证时创建 `media_objects` pending 记录，业务提交对象 key 后标记为 `committed`。

过期仍为 `pending` 的孤儿对象由独立 cron 清理：

```bash
pnpm --filter @cleanhub/api cron:media-cleanup
```

可选环境变量：

```env
MEDIA_CLEANUP_DISABLED="false"
MEDIA_CLEANUP_INTERVAL_SECONDS="900"
MEDIA_CLEANUP_BATCH_SIZE="100"
```

历史 `delivery_proofs.media_ref` 中的 `data:` 内联图片可通过一次性脚本回填到对象存储：

```bash
pnpm --filter @cleanhub/api backfill:delivery-proof-media
```

可选环境变量：

```env
MEDIA_BACKFILL_DRY_RUN="true"
MEDIA_BACKFILL_BATCH_SIZE="50"
MEDIA_BACKFILL_LIMIT="500"
```

查看状态：

```bash
pnpm db:ps
```

查看日志：

```bash
pnpm db:logs
```

### 5.4 执行已有迁移

```bash
pnpm db:migrate
```

如果项目里已经有 migration 文件，这一步会把本地数据库升级到当前项目需要的结构。

### 5.5 灌入开发种子数据

```bash
pnpm db:seed
```

这一步会写入本地开发用的初始数据（演示租户、角色、SaaS / 租户管理员账号等），方便直接登录联调。种子内容来自 `packages/db/src/seeds/`，可重复执行（基于 `ON CONFLICT DO UPDATE` 幂等）。

开发账号（全部）：

- 密码：`123456`
- PIN：`1234`
- SaaS：`saas.admin1@cleanhub.local`、`saas.admin2@cleanhub.local`、`saas.support1@cleanhub.local`
- 租户管理员：`tenant.admin1@cleanhub.local`（CLEAN-001）、`tenant.admin2@cleanhub.local`（CLEAN-002）、`tenant.admin3@cleanhub.local`（CLEAN-003）

### 5.6 重置本地数据库（清空重建）

当迁移基线被重建、或本地数据结构错乱时，需要把本地数据库彻底清空后重新初始化：

```bash
docker compose down -v   # 注意 -v：删除数据卷，真正清空数据库
pnpm db:up               # 重新启动空的 PostgreSQL
pnpm db:migrate          # 应用迁移，重建表结构
pnpm db:seed             # 重新灌入开发种子数据
```

> **关键提醒：`pnpm db:down`（即 `docker compose down`）不会删除数据卷**，旧表和旧的迁移记录会保留下来。此时直接 `pnpm db:migrate` 会因为"类型/表已存在"而报错。**只有 `docker compose down -v` 才会删除数据卷、真正清空数据库。**

## 6. 日常开发如何改表

标准流程是：

```mermaid
flowchart TD
  A["修改 packages/db/src/schema"] --> B["pnpm db:generate"]
  B --> C["检查生成的 migration SQL"]
  C --> D["pnpm db:migrate"]
  D --> E["本地验证功能"]
  E --> F["提交 schema + migration 文件"]
```

### 6.1 修改 schema

例如要给 `users` 表增加一个最近登录时间字段，应先修改 `packages/db/src/schema/users.ts`。

示例：

```ts
lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
```

> **说明：** 这里的 TypeScript schema 是数据库结构的源头。不要先手动去数据库里加字段，再回来补代码。团队协作时应该从 schema 变更开始。

### 6.2 生成 migration

```bash
pnpm db:generate
```

这个命令会根据当前 schema 和上一次快照，生成新的 migration 文件。

生成后要检查：

- 是否创建了预期的表。
- 是否新增了预期字段。
- 是否误删了字段或表。
- 是否生成了危险操作，例如 `DROP TABLE`、`DROP COLUMN`。
- enum、索引、唯一约束、外键是否符合预期。

### 6.3 执行 migration

```bash
pnpm db:migrate
```

执行后，本地数据库结构会被更新。

### 6.4 打开 Drizzle Studio 检查

```bash
pnpm db:studio
```

Drizzle Studio 可以用来查看表、字段和数据，类似轻量级数据库管理界面。

## 7. `generate`、`migrate`、`push` 的区别

这是最容易混淆的地方。

### 7.1 `pnpm db:generate`

作用：生成 migration 文件。

特点：

- 不直接修改数据库。
- 会在代码仓库里产生 migration 文件。
- 适合团队协作和正式开发。

使用场景：

- 新建表。
- 新增字段。
- 新增索引。
- 修改 enum。
- 修改约束。

### 7.2 `pnpm db:migrate`

作用：把已经生成的 migration 执行到数据库。

特点：

- 会修改当前 `DATABASE_URL` 指向的数据库。
- 会按 migration 顺序执行。
- 是团队协作和测试/生产环境推荐流程。

使用场景：

- 拉取别人提交的 migration 后，更新本地数据库。
- 部署测试环境时执行数据库升级。
- 生产发布时执行已经评审过的 migration。

### 7.3 `pnpm db:push`

作用：不生成 migration，直接把当前 schema 推到数据库。

特点：

- 快，但不适合多人协作的正式流程。
- 不会留下可评审的 migration 文件。
- 容易让某个环境结构变化无法追踪。

建议：

- 可以在项目早期、本地原型阶段临时使用。
- 一旦团队开始多人开发和评审数据库变更，默认使用 `generate + migrate`。
- 不建议对测试环境、预发环境、生产环境使用 `db:push`。

> **团队规则建议：** 除非负责人明确允许，否则提交功能代码时必须提交对应 migration 文件，不要只提交 schema 变更。

## 8. 从 MyBatis Plus 习惯切换到 Drizzle Migration

### 8.1 不要把 Drizzle schema 当成 MyBatis Entity

MyBatis Plus 中常见的是：

```text
数据库表已经存在 -> Java Entity 映射数据库表
```

Drizzle schema 更接近：

```text
TypeScript schema 描述数据库结构 -> 生成 migration -> 数据库按 migration 升级
```

也就是说，Drizzle schema 不只是查询映射，它还是生成数据库变更的依据。

### 8.2 不要本地手动改表后忘记生成 migration

错误流程：

```text
手动 ALTER TABLE -> 代码能跑 -> 忘记提交 SQL -> 别人环境报错
```

正确流程：

```text
改 Drizzle schema -> generate migration -> migrate 本地库 -> 提交代码
```

### 8.3 SQL 仍然重要

使用 Drizzle 不代表不需要懂 SQL。

尤其是 migration 文件，必须能看懂：

- `CREATE TABLE`
- `ALTER TABLE`
- `DROP TABLE`
- `CREATE INDEX`
- `CREATE UNIQUE INDEX`
- `ALTER TYPE`
- `ADD CONSTRAINT`

> **要求：** 所有开发者在提交 migration 前，必须至少读一遍生成的 SQL，确认没有误删表、误删字段、误改类型。

## 9. 团队协作流程

### 9.1 开发者 A 新增字段

开发者 A：

```bash
pnpm db:up
pnpm db:migrate
```

修改 schema 后：

```bash
pnpm db:generate
pnpm db:migrate
pnpm --filter @cleanhub/db typecheck
```

然后提交：

```text
packages/db/src/schema/xxx.ts
packages/db/drizzle/xxxx_xxx.sql
packages/db/drizzle/meta/xxxx_snapshot.json
packages/db/drizzle/meta/_journal.json
```

### 9.2 开发者 B 拉取代码

开发者 B 拉到开发者 A 的 migration 后：

```bash
pnpm install
pnpm db:up
pnpm db:migrate
```

这样 B 的本地数据库就会执行 A 提交的表结构变化。

### 9.3 多人同时改数据库

如果多人同时改 schema，可能出现 migration 冲突。处理原则：

- 不要随便删除别人生成的 migration。
- 先拉取最新主分支。
- 重新检查自己的 schema 变更是否仍然成立。
- 必要时重新生成自己的 migration。
- 对涉及同一张表、同一字段、同一 enum 的冲突，必须人工评审。

## 10. Migration 文件是否可以修改

分情况。

### 10.1 还没有提交、还没有被别人使用

可以修改或重新生成。

常见场景：

- 发现字段名写错。
- 发现索引漏了。
- 发现生成了不符合预期的 SQL。

### 10.2 已经提交，别人已经拉取或执行

不要直接改旧 migration。

应该新增一个新的 migration 修正问题。

原因是：旧 migration 一旦被别人执行过，你再改它，别人数据库里的执行记录和你本地文件就不一致了。

> **规则：** 已经进入共享分支并被团队使用的 migration，默认视为不可变文件。

## 11. 如何处理危险变更

危险变更包括：

- 删除表：`DROP TABLE`
- 删除字段：`DROP COLUMN`
- 修改字段类型
- 给已有大表增加非空字段
- 给已有数据增加唯一约束
- 修改 enum 值
- 大规模数据迁移

### 11.1 删除字段

不建议直接删除。更稳妥的流程：

```text
第一版：代码不再写入/读取该字段
第二版：确认线上无依赖后，再生成 drop column migration
```

### 11.2 新增非空字段

如果表里已有数据，不能随便加 `NOT NULL` 且没有默认值。

推荐流程：

```text
第一步：新增 nullable 字段
第二步：写数据回填脚本
第三步：确认数据完整
第四步：再改成 not null
```

### 11.3 修改字段类型

修改字段类型前必须确认：

- 旧数据能否转换。
- 是否需要 `USING` 转换表达式。
- 是否影响索引。
- 是否影响 API 和前端类型。

## 12. 回滚怎么理解

很多开发者会问：migration 执行错了能不能自动回滚？

现实中，数据库回滚不能简单理解为“代码回退一下”。尤其是涉及删字段、删表、数据变更时，回滚可能丢数据。

建议团队采用：

- **本地环境：** 可以删除本地数据库重建，成本低。
- **测试环境：** 优先用新增 migration 修复，不随便手动改历史。
- **生产环境：** 需要发布前评审 migration，并准备人工回滚方案。

生产发布前，涉及危险变更必须写清楚：

- 本次 migration 做了什么。
- 是否兼容旧代码。
- 是否需要停机。
- 是否有数据回填。
- 如果失败，如何恢复。

## 13. 推荐开发节奏

### 13.1 本地原型阶段

可以相对灵活：

```bash
pnpm db:push
```

但一旦要提交给团队，仍建议生成 migration。

### 13.2 正常团队开发阶段

默认流程：

```bash
pnpm db:generate
pnpm db:migrate
pnpm --filter @cleanhub/db typecheck
```

### 13.3 提交 PR 前检查

提交包含数据库变更的 PR 前，检查：

- schema 文件是否提交。
- migration SQL 是否提交。
- migration meta 文件是否提交。
- 是否误删表/字段。
- 是否有数据兼容风险。
- 是否更新相关类型、API、测试或文档。

## 14. 常见问题

### Q1：我只改了 TypeScript schema，不执行 migration 可以吗？

不可以。schema 只是代码描述，数据库不会自动改变。你需要执行：

```bash
pnpm db:generate
pnpm db:migrate
```

### Q2：为什么我本地代码没问题，别人运行报数据库缺字段？

通常是你本地手动改了数据库，但没有提交 migration，或者别人拉代码后没有执行：

```bash
pnpm db:migrate
```

### Q3：能不能像 MyBatis Plus 一样自动建表？

本地原型阶段可以用 `db:push` 接近这种体验。但团队正式开发不建议依赖自动同步，应使用 migration 文件进行版本化。

### Q4：migration 文件太多怎么办？

正常项目 migration 文件会越来越多，这是可接受的。它们是数据库历史。不要因为文件多就随便删除历史 migration。

后期如果确实需要整理，需要由负责人统一做 baseline 或 squashing 策略，不应由个人随意清理。

### Q5：修改 enum 为什么要谨慎？

PostgreSQL enum 和普通字符串不同，修改 enum 可能影响历史数据、查询和约束。对订单状态、用户状态、支付状态等字段，改 enum 前必须确认业务状态流转。

### Q6：迁移和 seed 数据是一回事吗？

不是。

- Migration：数据库结构变化，例如建表、加字段、建索引。
- Seed：初始化业务数据，例如默认角色、默认权限、测试租户。

本项目已提供 `pnpm db:seed`（种子文件在 `packages/db/src/seeds/`），用于灌入开发初始数据。请保持结构归 migration、数据归 seed，不要把大量测试数据混进结构迁移里。

## 15. Clean Hub 当前推荐规则

Clean Hub 团队建议先按以下规则执行：

- 数据库结构统一写在 `packages/db/src/schema/**`。
- 普通开发者优先使用根目录命令，不直接进入 `packages/db` 执行复杂命令。
- 本地数据库使用 `pnpm db:up` 启动。
- 正式协作默认使用 `pnpm db:generate` + `pnpm db:migrate`。
- `pnpm db:push` 只用于本地早期原型，不作为正式协作流程。
- migration 文件进入共享分支后，不随意修改历史。
- 删除字段、修改类型、加非空约束、改 enum 都需要额外评审。
- 涉及生产环境的 migration，必须在发布计划里单独列出。

## 16. 最小操作清单

如果你只想记住最少命令，记这组：

```bash
# 第一次本地准备
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm db:seed

# 修改表结构后
pnpm db:generate
pnpm db:migrate
pnpm --filter @cleanhub/db typecheck

# 重置本地数据库（清空重建）
docker compose down -v
pnpm db:up
pnpm db:migrate
pnpm db:seed

# 查看数据库
pnpm db:studio
```

> **最后提醒：** Migration 的核心价值不是“自动生成 SQL”，而是让数据库结构变化和代码一样进入版本管理、代码评审、环境发布流程。

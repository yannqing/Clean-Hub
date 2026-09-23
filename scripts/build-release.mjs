import { build } from "esbuild";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(rootDir, "release");
const artifactDir = join(releaseRoot, "cleanhub");
const webAdminDir = join(rootDir, "apps", "web-admin");
const webAdminStandaloneDir = join(webAdminDir, ".next", "standalone");
const posWebDir = join(rootDir, "apps", "pos-web");
const posWebStandaloneDir = join(posWebDir, ".next", "standalone");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...(options.env ?? {}) },
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}.`));
    });
  });
}

async function copyIfExists(from, to) {
  if (!existsSync(from)) {
    return;
  }

  await cp(from, to, { recursive: true });
}

async function unlinkIfExists(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  await unlink(filePath);
}

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function writeReleaseDockerfile() {
  await writeFile(
    join(artifactDir, "Dockerfile"),
    `FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS api
COPY api ./api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \\
  CMD node -e "fetch('http://127.0.0.1:4000/health/ready').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "api/index.js"]

FROM base AS cron
COPY api ./api
CMD ["node", "api/cron.js"]

FROM base AS migrate
COPY api ./api
COPY db ./db
ENV DRIZZLE_MIGRATIONS_FOLDER=/app/db/drizzle
CMD ["node", "api/migrate.js"]

FROM base AS seed
COPY api ./api
COPY db ./db
ENV CLEANHUB_SEEDS_FOLDER=/app/db/seeds
CMD ["node", "api/seed.js"]

FROM base AS web-admin
COPY web-admin/apps/web-admin/package.json ./web-admin/apps/web-admin/
COPY web-admin/apps/web-admin/server.js ./web-admin/apps/web-admin/
COPY web-admin/apps/web-admin/.next ./web-admin/apps/web-admin/.next
COPY web-admin/apps/web-admin/public ./web-admin/apps/web-admin/public
WORKDIR /app/web-admin/apps/web-admin
# Materialize a clean Linux runtime node_modules tree in-container.
# This avoids carrying potentially broken host symlinks from Windows packaging.
RUN mkdir -p /tmp/next-runtime \
  && cd /tmp/next-runtime \
  && npm init -y \
  && npm install next@16.2.6 react@19.2.4 react-dom@19.2.4 @swc/helpers@0.5.15 @next/env@16.2.6 --omit=dev --no-audit --no-fund --registry=https://registry.npmmirror.com \
  && rm -rf /app/web-admin/apps/web-admin/node_modules \
  && mkdir -p /app/web-admin/apps/web-admin/node_modules \
  && cp -R /tmp/next-runtime/node_modules/. /app/web-admin/apps/web-admin/node_modules \
  && rm -rf /tmp/next-runtime
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \\
  CMD node -e "fetch('http://127.0.0.1:3000/login').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

FROM base AS pos-web
COPY pos-web/apps/pos-web/package.json ./pos-web/apps/pos-web/
COPY pos-web/apps/pos-web/server.js ./pos-web/apps/pos-web/
COPY pos-web/apps/pos-web/.next ./pos-web/apps/pos-web/.next
COPY pos-web/apps/pos-web/public ./pos-web/apps/pos-web/public
WORKDIR /app/pos-web/apps/pos-web
RUN mkdir -p /tmp/next-runtime \
  && cd /tmp/next-runtime \
  && npm init -y \
  && npm install next@16.2.6 react@19.2.4 react-dom@19.2.4 @swc/helpers@0.5.15 @next/env@16.2.6 --omit=dev --no-audit --no-fund --registry=https://registry.npmmirror.com \
  && rm -rf /app/pos-web/apps/pos-web/node_modules \
  && mkdir -p /app/pos-web/apps/pos-web/node_modules \
  && cp -R /tmp/next-runtime/node_modules/. /app/pos-web/apps/pos-web/node_modules \
  && rm -rf /tmp/next-runtime
ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \\
  CMD node -e "fetch('http://127.0.0.1:3001/login').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
`,
  );
}

async function writeReleaseCompose() {
  const composeDollar = "$";

  await writeFile(
    join(artifactDir, "docker-compose.yml"),
    `services:
  postgres:
    image: postgres:16-alpine
    container_name: cleanhub-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-cleanhub}
      POSTGRES_USER: \${POSTGRES_USER:-cleanhub_admin}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    volumes:
      - cleanhub-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${composeDollar}${composeDollar}{POSTGRES_USER:-cleanhub_admin} -d ${composeDollar}${composeDollar}{POSTGRES_DB:-cleanhub}",
        ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - cleanhub

  db-role-init:
    image: postgres:16-alpine
    container_name: cleanhub-db-role-init
    restart: "no"
    env_file:
      - ./.env.production
    environment:
      POSTGRES_HOST: postgres
    entrypoint:
      - /bin/sh
      - /opt/cleanhub/postgres/ensure-app-role.sh
    volumes:
      - ./postgres/ensure-app-role.sh:/opt/cleanhub/postgres/ensure-app-role.sh:ro
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - cleanhub

  postgres-backup:
    image: postgres:16-alpine
    container_name: cleanhub-postgres-backup
    restart: unless-stopped
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: \${POSTGRES_DB:-cleanhub}
      POSTGRES_USER: \${POSTGRES_USER:-cleanhub_admin}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      BACKUP_DIRECTORY: /backups
      BACKUP_INTERVAL_SECONDS: \${BACKUP_INTERVAL_SECONDS:-900}
      BACKUP_LOCAL_RETENTION_DAYS: \${BACKUP_LOCAL_RETENTION_DAYS:-7}
    entrypoint:
      - /bin/sh
      - /opt/cleanhub/postgres/backup-loop.sh
    volumes:
      - ./postgres/backup-loop.sh:/opt/cleanhub/postgres/backup-loop.sh:ro
      - cleanhub-postgres-backups:/backups
    healthcheck:
      test:
        - CMD-SHELL
        - 'test -n "$${composeDollar}(find /backups/.last-success -mmin -30 -print -quit 2>/dev/null)"'
      interval: 60s
      timeout: 5s
      retries: 3
      start_period: 10m
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - cleanhub

  postgres-backup-cloud:
    image: minio/mc:RELEASE.2025-08-13T08-35-41Z
    container_name: cleanhub-postgres-backup-cloud
    restart: unless-stopped
    environment:
      BACKUP_DIRECTORY: /backups
      BACKUP_S3_ENDPOINT: \${BACKUP_S3_ENDPOINT:?External BACKUP_S3_ENDPOINT is required}
      BACKUP_S3_ACCESS_KEY: \${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}
      BACKUP_S3_SECRET_KEY: \${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}
      BACKUP_S3_BUCKET: \${BACKUP_S3_BUCKET:-cleanhub-backups}
      BACKUP_S3_PREFIX: \${BACKUP_S3_PREFIX:-postgres}
      BACKUP_S3_ALLOW_INSECURE: \${BACKUP_S3_ALLOW_INSECURE:-false}
      BACKUP_CLOUD_SYNC_INTERVAL_SECONDS: \${BACKUP_CLOUD_SYNC_INTERVAL_SECONDS:-60}
    entrypoint:
      - /bin/sh
      - /opt/cleanhub/postgres/cloud-backup-loop.sh
    volumes:
      - ./postgres/cloud-backup-loop.sh:/opt/cleanhub/postgres/cloud-backup-loop.sh:ro
      - cleanhub-postgres-backups:/backups:ro
    healthcheck:
      test:
        - CMD-SHELL
        - 'test -n "$${composeDollar}(find /tmp/.last-cloud-success -mmin -5 -print -quit 2>/dev/null)"'
      interval: 60s
      timeout: 5s
      retries: 3
      start_period: 10m
    depends_on:
      postgres-backup:
        condition: service_started
    networks:
      - cleanhub

  postgres-restore-drill:
    image: postgres:16-alpine
    profiles:
      - tools
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: \${POSTGRES_USER:-cleanhub_admin}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      BACKUP_DIRECTORY: /backups
    entrypoint:
      - /bin/sh
      - /opt/cleanhub/postgres/restore-drill.sh
    volumes:
      - ./postgres/restore-drill.sh:/opt/cleanhub/postgres/restore-drill.sh:ro
      - cleanhub-postgres-backups:/backups:ro
    depends_on:
      postgres:
        condition: service_healthy
      postgres-backup:
        condition: service_started
    networks:
      - cleanhub

  minio:
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z
    container_name: cleanhub-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: \${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}
      MINIO_ROOT_PASSWORD: \${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}
    volumes:
      - cleanhub-minio-data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - cleanhub

  minio-init:
    image: minio/mc:RELEASE.2025-08-13T08-35-41Z
    container_name: cleanhub-minio-init
    restart: "no"
    depends_on:
      minio:
        condition: service_healthy
    environment:
      MINIO_ROOT_USER: \${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}
      MINIO_ROOT_PASSWORD: \${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}
      OBJECT_STORAGE_BUCKET: \${OBJECT_STORAGE_BUCKET:-cleanhub-media}
    entrypoint:
      - /bin/sh
      - -c
      - |
        mc alias set cleanhub http://minio:9000 "${composeDollar}${composeDollar}MINIO_ROOT_USER" "${composeDollar}${composeDollar}MINIO_ROOT_PASSWORD"
        mc mb --ignore-existing "cleanhub/${composeDollar}${composeDollar}OBJECT_STORAGE_BUCKET"
        mc anonymous set none "cleanhub/${composeDollar}${composeDollar}OBJECT_STORAGE_BUCKET"
    networks:
      - cleanhub

  object-storage-backup-cloud:
    image: minio/mc:RELEASE.2025-08-13T08-35-41Z
    container_name: cleanhub-object-storage-backup-cloud
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: \${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}
      MINIO_ROOT_PASSWORD: \${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}
      OBJECT_STORAGE_BUCKET: \${OBJECT_STORAGE_BUCKET:-cleanhub-media}
      BACKUP_S3_ENDPOINT: \${BACKUP_S3_ENDPOINT:?External BACKUP_S3_ENDPOINT is required}
      BACKUP_S3_ACCESS_KEY: \${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}
      BACKUP_S3_SECRET_KEY: \${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}
      BACKUP_S3_BUCKET: \${BACKUP_S3_BUCKET:-cleanhub-backups}
      BACKUP_MEDIA_S3_PREFIX: \${BACKUP_MEDIA_S3_PREFIX:-object-storage}
      BACKUP_S3_ALLOW_INSECURE: \${BACKUP_S3_ALLOW_INSECURE:-false}
      BACKUP_MEDIA_SYNC_INTERVAL_SECONDS: \${BACKUP_MEDIA_SYNC_INTERVAL_SECONDS:-300}
    entrypoint:
      - /bin/sh
      - /opt/cleanhub/postgres/cloud-object-storage-loop.sh
    volumes:
      - ./postgres/cloud-object-storage-loop.sh:/opt/cleanhub/postgres/cloud-object-storage-loop.sh:ro
    healthcheck:
      test:
        - CMD-SHELL
        - 'test -n "$${composeDollar}(find /tmp/.last-media-cloud-success -mmin -15 -print -quit 2>/dev/null)"'
      interval: 60s
      timeout: 5s
      retries: 3
      start_period: 10m
    depends_on:
      minio-init:
        condition: service_completed_successfully
    networks:
      - cleanhub

  api:
    image: cleanhub-api:latest
    container_name: cleanhub-api
    restart: unless-stopped
    build:
      context: .
      dockerfile: Dockerfile
      target: api
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: \${DATABASE_URL:?DATABASE_URL for the restricted app role is required}
      DATABASE_POOL_MAX: \${DATABASE_POOL_MAX:-10}
      DATABASE_POOL_IDLE_TIMEOUT_MS: \${DATABASE_POOL_IDLE_TIMEOUT_MS:-30000}
      DATABASE_POOL_CONNECTION_TIMEOUT_MS: \${DATABASE_POOL_CONNECTION_TIMEOUT_MS:-10000}
      DATABASE_POOL_QUERY_TIMEOUT_MS: \${DATABASE_POOL_QUERY_TIMEOUT_MS:-30000}
      DATABASE_POOL_KEEP_ALIVE_INITIAL_DELAY_MS: \${DATABASE_POOL_KEEP_ALIVE_INITIAL_DELAY_MS:-10000}
      DATABASE_APPLICATION_NAME: \${DATABASE_APPLICATION_NAME:-cleanhub}
      DATABASE_REQUIRE_RLS: "true"
      AUTH_TOKEN_SECRET: \${AUTH_TOKEN_SECRET:?AUTH_TOKEN_SECRET is required}
      AUTH_ACCESS_TOKEN_TTL_SECONDS: \${AUTH_ACCESS_TOKEN_TTL_SECONDS:-900}
      AUTH_REFRESH_TOKEN_TTL_SECONDS: \${AUTH_REFRESH_TOKEN_TTL_SECONDS:-2592000}
      AUTH_COOKIE_SECURE: "true"
      WEB_ADMIN_PUBLIC_ORIGIN: \${WEB_ADMIN_PUBLIC_ORIGIN:?WEB_ADMIN_PUBLIC_ORIGIN is required}
      POS_PUBLIC_ORIGIN: \${POS_PUBLIC_ORIGIN:?POS_PUBLIC_ORIGIN is required}
      CORS_ORIGINS: \${CORS_ORIGINS:?CORS_ORIGINS is required}
      CORS_ENFORCE_SAME_ORIGIN: "true"
      LOG_LEVEL: \${LOG_LEVEL:-info}
      SERVICE_NAME: \${SERVICE_NAME:-cleanhub}
      OBJECT_STORAGE_ENDPOINT: \${OBJECT_STORAGE_ENDPOINT:?OBJECT_STORAGE_ENDPOINT is required}
      OBJECT_STORAGE_REGION: \${OBJECT_STORAGE_REGION:-us-east-1}
      OBJECT_STORAGE_BUCKET: \${OBJECT_STORAGE_BUCKET:?OBJECT_STORAGE_BUCKET is required}
      OBJECT_STORAGE_ACCESS_KEY: \${OBJECT_STORAGE_ACCESS_KEY:?OBJECT_STORAGE_ACCESS_KEY is required}
      OBJECT_STORAGE_SECRET_KEY: \${OBJECT_STORAGE_SECRET_KEY:?OBJECT_STORAGE_SECRET_KEY is required}
      OBJECT_STORAGE_FORCE_PATH_STYLE: \${OBJECT_STORAGE_FORCE_PATH_STYLE:-true}
      EMAIL_DELIVERY_DISABLED: \${EMAIL_DELIVERY_DISABLED:-true}
      PUSH_DELIVERY_DISABLED: \${PUSH_DELIVERY_DISABLED:-true}
    ports:
      - "127.0.0.1:\${API_HOST_PORT:-4010}:4000"
    depends_on:
      postgres:
        condition: service_healthy
      db-role-init:
        condition: service_completed_successfully
      minio-init:
        condition: service_completed_successfully
    networks:
      - cleanhub

  # Background jobs. Kept out of the api container so a slow batch cannot
  # compete with request handling, and so restarting one does not drop POS
  # WebSocket connections. Notification delivery lives here: without this
  # service, events are enqueued and never sent.
  cron:
    image: cleanhub-cron:latest
    container_name: cleanhub-cron
    restart: unless-stopped
    build:
      context: .
      dockerfile: Dockerfile
      target: cron
    environment:
      NODE_ENV: production
      DATABASE_URL: \${DATABASE_URL:?DATABASE_URL for the restricted app role is required}
      DATABASE_POOL_MAX: \${CRON_DATABASE_POOL_MAX:-4}
      DATABASE_POOL_IDLE_TIMEOUT_MS: \${DATABASE_POOL_IDLE_TIMEOUT_MS:-30000}
      DATABASE_POOL_CONNECTION_TIMEOUT_MS: \${DATABASE_POOL_CONNECTION_TIMEOUT_MS:-10000}
      DATABASE_POOL_QUERY_TIMEOUT_MS: \${DATABASE_POOL_QUERY_TIMEOUT_MS:-30000}
      DATABASE_POOL_KEEP_ALIVE_INITIAL_DELAY_MS: \${DATABASE_POOL_KEEP_ALIVE_INITIAL_DELAY_MS:-10000}
      DATABASE_APPLICATION_NAME: \${DATABASE_APPLICATION_NAME:-cleanhub}-cron
      DATABASE_REQUIRE_RLS: "true"
      LOG_LEVEL: \${LOG_LEVEL:-info}
      SERVICE_NAME: \${SERVICE_NAME:-cleanhub}-cron
      OBJECT_STORAGE_ENDPOINT: \${OBJECT_STORAGE_ENDPOINT:?OBJECT_STORAGE_ENDPOINT is required}
      OBJECT_STORAGE_REGION: \${OBJECT_STORAGE_REGION:-us-east-1}
      OBJECT_STORAGE_BUCKET: \${OBJECT_STORAGE_BUCKET:?OBJECT_STORAGE_BUCKET is required}
      OBJECT_STORAGE_ACCESS_KEY: \${OBJECT_STORAGE_ACCESS_KEY:?OBJECT_STORAGE_ACCESS_KEY is required}
      OBJECT_STORAGE_SECRET_KEY: \${OBJECT_STORAGE_SECRET_KEY:?OBJECT_STORAGE_SECRET_KEY is required}
      OBJECT_STORAGE_FORCE_PATH_STYLE: \${OBJECT_STORAGE_FORCE_PATH_STYLE:-true}
      EMAIL_DELIVERY_DISABLED: \${EMAIL_DELIVERY_DISABLED:-true}
      EMAIL_DELIVERY_INTERVAL_SECONDS: \${EMAIL_DELIVERY_INTERVAL_SECONDS:-60}
      EMAIL_OVERDUE_TICKET_DISABLED: \${EMAIL_OVERDUE_TICKET_DISABLED:-false}
      EMAIL_SMTP_HOST: \${EMAIL_SMTP_HOST:-}
      EMAIL_SMTP_PORT: \${EMAIL_SMTP_PORT:-587}
      EMAIL_SMTP_SECURE: \${EMAIL_SMTP_SECURE:-false}
      EMAIL_SMTP_USER: \${EMAIL_SMTP_USER:-}
      EMAIL_SMTP_PASS: \${EMAIL_SMTP_PASS:-}
      EMAIL_FROM: \${EMAIL_FROM:-}
      PUSH_DELIVERY_DISABLED: \${PUSH_DELIVERY_DISABLED:-true}
      FCM_PROJECT_ID: \${FCM_PROJECT_ID:-}
      FCM_CLIENT_EMAIL: \${FCM_CLIENT_EMAIL:-}
      FCM_PRIVATE_KEY: \${FCM_PRIVATE_KEY:-}
      MEDIA_CLEANUP_DISABLED: \${MEDIA_CLEANUP_DISABLED:-false}
      MEDIA_CLEANUP_INTERVAL_SECONDS: \${MEDIA_CLEANUP_INTERVAL_SECONDS:-900}
      TENANT_PURGE_DISABLED: \${TENANT_PURGE_DISABLED:-false}
      TENANT_PURGE_INTERVAL_SECONDS: \${TENANT_PURGE_INTERVAL_SECONDS:-3600}
    depends_on:
      postgres:
        condition: service_healthy
      db-role-init:
        condition: service_completed_successfully
      minio-init:
        condition: service_completed_successfully
    networks:
      - cleanhub

  web-admin:
    image: cleanhub-web-admin:latest
    container_name: cleanhub-web-admin
    restart: unless-stopped
    build:
      context: .
      dockerfile: Dockerfile
      target: web-admin
    environment:
      NODE_ENV: production
      PORT: 3000
      # Next.js standalone defaults HOSTNAME to the container hostname IP, which
      # leaves 127.0.0.1 unbound and makes the container's own healthcheck
      # (fetch http://127.0.0.1:3000/login) fail. Bind all interfaces instead.
      HOSTNAME: 0.0.0.0
      CLEANHUB_API_BASE_URL: \${CLEANHUB_API_BASE_URL:-http://api:4000}
    ports:
      - "127.0.0.1:\${WEB_ADMIN_HOST_PORT:-3010}:3000"
    depends_on:
      api:
        condition: service_started
    networks:
      - cleanhub

  pos-web:
    image: cleanhub-pos-web:latest
    container_name: cleanhub-pos-web
    restart: unless-stopped
    build:
      context: .
      dockerfile: Dockerfile
      target: pos-web
    environment:
      NODE_ENV: production
      PORT: 3001
      HOSTNAME: 0.0.0.0
      CLEANHUB_API_BASE_URL: \${CLEANHUB_API_BASE_URL:-http://api:4000}
    ports:
      - "127.0.0.1:\${POS_WEB_HOST_PORT:-3011}:3001"
    depends_on:
      api:
        condition: service_started
    networks:
      - cleanhub

  gateway:
    image: caddy:2.10-alpine
    container_name: cleanhub-gateway
    restart: unless-stopped
    environment:
      WEB_ADMIN_PUBLIC_HOST: \${WEB_ADMIN_PUBLIC_HOST:?WEB_ADMIN_PUBLIC_HOST is required}
      POS_PUBLIC_HOST: \${POS_PUBLIC_HOST:?POS_PUBLIC_HOST is required}
      API_PUBLIC_HOST: \${API_PUBLIC_HOST:?API_PUBLIC_HOST is required}
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - cleanhub-caddy-data:/data
      - cleanhub-caddy-config:/config
    depends_on:
      api:
        condition: service_healthy
      pos-web:
        condition: service_healthy
      web-admin:
        condition: service_healthy
    networks:
      - cleanhub

  migrate:
    image: cleanhub-migrate:latest
    profiles:
      - tools
    build:
      context: .
      dockerfile: Dockerfile
      target: migrate
    env_file:
      - ./.env.production
    environment:
      NODE_ENV: production
      DATABASE_URL: \${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL is required for migrations}
      DRIZZLE_MIGRATIONS_FOLDER: /app/db/drizzle
    depends_on:
      postgres:
        condition: service_healthy
      db-role-init:
        condition: service_completed_successfully
    networks:
      - cleanhub

  seed:
    image: cleanhub-seed:latest
    profiles:
      - tools
    build:
      context: .
      dockerfile: Dockerfile
      target: seed
    env_file:
      - ./.env.production
    environment:
      NODE_ENV: production
      DATABASE_URL: \${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL is required for seeds}
      CLEANHUB_SEEDS_FOLDER: /app/db/seeds
    depends_on:
      postgres:
        condition: service_healthy
      db-role-init:
        condition: service_completed_successfully
    networks:
      - cleanhub

networks:
  cleanhub:
    name: cleanhub-net

volumes:
  cleanhub-postgres-data:
    name: cleanhub-postgres-data
  cleanhub-postgres-backups:
    name: cleanhub-postgres-backups
  cleanhub-minio-data:
    name: cleanhub-minio-data
  cleanhub-caddy-data:
    name: cleanhub-caddy-data
  cleanhub-caddy-config:
    name: cleanhub-caddy-config
`,
  );
}

async function bundleApi() {
  const commonOptions = {
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    sourcemap: true,
    packages: "bundle",
    logLevel: "info",
    // Bundled CommonJS deps (e.g. dotenv) call require()/__dirname at runtime.
    // In an ESM output those are not defined, so esbuild's shim throws
    // "Dynamic require of \"fs\" is not supported". Recreate the CJS globals
    // from module.createRequire so bundled CJS code can require Node builtins.
    banner: {
      js: [
        "import { createRequire as __createRequire } from 'node:module';",
        "import { fileURLToPath as __fileURLToPath } from 'node:url';",
        "import { dirname as __pathDirname } from 'node:path';",
        "const require = __createRequire(import.meta.url);",
        "const __filename = __fileURLToPath(import.meta.url);",
        "const __dirname = __pathDirname(__filename);",
      ].join("\n"),
    },
  };

  await build({
    ...commonOptions,
    entryPoints: [join(rootDir, "apps", "api", "src", "index.ts")],
    outfile: join(artifactDir, "api", "index.js"),
  });

  await build({
    ...commonOptions,
    entryPoints: [join(rootDir, "scripts", "release-cron.ts")],
    outfile: join(artifactDir, "api", "cron.js"),
  });

  await build({
    ...commonOptions,
    entryPoints: [join(rootDir, "scripts", "release-migrate.ts")],
    outfile: join(artifactDir, "api", "migrate.js"),
  });

  await build({
    ...commonOptions,
    entryPoints: [join(rootDir, "scripts", "release-seed.ts")],
    outfile: join(artifactDir, "api", "seed.js"),
  });
}

// Recursively remove symlinks whose target does not exist. Such dangling links
// (dev-only transitive deps Next traced but did not emit) make a subsequent
// copy that preserves symlinks self-inconsistent and can break at runtime.
async function pruneDanglingSymlinks(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        await stat(entryPath); // follows the link; throws if target is missing
      } catch {
        await unlink(entryPath);
      }
      continue;
    }
    if (entry.isDirectory()) {
      await pruneDanglingSymlinks(entryPath);
    }
  }
}

async function copyWebAdminStandalone() {
  await stat(webAdminStandaloneDir);
  const webAdminArtifactDir = join(artifactDir, "web-admin");

  // Linux build -> Linux runtime: preserve pnpm symlink layout as-is.
  // Windows build -> Linux runtime: symlinks/junctions can become invalid after
  // archive transfer and extraction, which causes runtime "Cannot find module".
  // On Windows, dereference links and copy real files instead.
  if (process.platform === "win32") {
    await cp(webAdminStandaloneDir, webAdminArtifactDir, {
      recursive: true,
      dereference: true,
    });
  } else {
    await pruneDanglingSymlinks(webAdminStandaloneDir);
    await cp(webAdminStandaloneDir, webAdminArtifactDir, {
      recursive: true,
      verbatimSymlinks: true,
    });
  }
  await cp(
    join(webAdminDir, ".next", "static"),
    join(artifactDir, "web-admin", "apps", "web-admin", ".next", "static"),
    { recursive: true },
  );
  await mkdir(join(artifactDir, "web-admin", "apps", "web-admin", "public"), {
    recursive: true,
  });
  await copyIfExists(
    join(webAdminDir, "public"),
    join(artifactDir, "web-admin", "apps", "web-admin", "public"),
  );
  await unlinkIfExists(
    join(artifactDir, "web-admin", "apps", "web-admin", ".env"),
  );

  // Windows release builds may miss this transitive runtime dependency after
  // flattening pnpm links for Linux deployment. Ensure it exists in artifact.
  const swcHelpersCandidates = [
    join(webAdminDir, "node_modules", "@swc", "helpers"),
    join(
      webAdminDir,
      "node_modules",
      "next",
      "node_modules",
      "@swc",
      "helpers",
    ),
    join(rootDir, "node_modules", "@swc", "helpers"),
    join(rootDir, "node_modules", "next", "node_modules", "@swc", "helpers"),
  ];
  const swcHelpersTarget = join(
    webAdminArtifactDir,
    "apps",
    "web-admin",
    "node_modules",
    "@swc",
    "helpers",
  );
  const webAdminRequire = createRequire(join(webAdminDir, "package.json"));
  const rootRequire = createRequire(join(rootDir, "package.json"));

  let copiedSwcHelpers = existsSync(swcHelpersTarget);
  const swcHelpersStandaloneCandidates = [
    join(webAdminStandaloneDir, "node_modules", "@swc", "helpers"),
    join(
      webAdminStandaloneDir,
      "apps",
      "web-admin",
      "node_modules",
      "@swc",
      "helpers",
    ),
  ];

  for (const candidate of swcHelpersStandaloneCandidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    await cp(candidate, swcHelpersTarget, { recursive: true, force: true });
    copiedSwcHelpers = true;
    break;
  }

  for (const candidate of swcHelpersCandidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    await cp(candidate, swcHelpersTarget, { recursive: true, force: true });
    copiedSwcHelpers = true;
    break;
  }

  if (!copiedSwcHelpers) {
    const resolvedSwcHelpersCandidates = [];

    try {
      resolvedSwcHelpersCandidates.push(
        dirname(webAdminRequire.resolve("@swc/helpers/package.json")),
      );
    } catch {
      // ignore
    }

    try {
      resolvedSwcHelpersCandidates.push(
        dirname(rootRequire.resolve("@swc/helpers/package.json")),
      );
    } catch {
      // ignore
    }

    for (const candidate of resolvedSwcHelpersCandidates) {
      if (!existsSync(candidate)) {
        continue;
      }
      await cp(candidate, swcHelpersTarget, { recursive: true, force: true });
      copiedSwcHelpers = true;
      break;
    }
  }

  if (!copiedSwcHelpers) {
    console.warn(
      [
        "Warning: '@swc/helpers' was not found while preparing web-admin artifact.",
        "Packaging will continue. If runtime fails, ensure dependency installation before build.",
        "Checked paths:",
        ...swcHelpersStandaloneCandidates.map((path) => `  - ${path}`),
        ...swcHelpersCandidates.map((path) => `  - ${path}`),
        "Also attempted resolution via require.resolve from web-admin/root package contexts.",
      ].join("\n"),
    );
  }
}

async function copyPosWebStandalone() {
  await stat(posWebStandaloneDir);
  const posWebArtifactDir = join(artifactDir, "pos-web");

  if (process.platform === "win32") {
    await cp(posWebStandaloneDir, posWebArtifactDir, {
      recursive: true,
      dereference: true,
    });
  } else {
    await pruneDanglingSymlinks(posWebStandaloneDir);
    await cp(posWebStandaloneDir, posWebArtifactDir, {
      recursive: true,
      verbatimSymlinks: true,
    });
  }

  await cp(
    join(posWebDir, ".next", "static"),
    join(artifactDir, "pos-web", "apps", "pos-web", ".next", "static"),
    { recursive: true },
  );
  await mkdir(join(artifactDir, "pos-web", "apps", "pos-web", "public"), {
    recursive: true,
  });
  await copyIfExists(
    join(posWebDir, "public"),
    join(artifactDir, "pos-web", "apps", "pos-web", "public"),
  );
  await unlinkIfExists(join(artifactDir, "pos-web", "apps", "pos-web", ".env"));

  const swcHelpersCandidates = [
    join(posWebDir, "node_modules", "@swc", "helpers"),
    join(posWebDir, "node_modules", "next", "node_modules", "@swc", "helpers"),
    join(rootDir, "node_modules", "@swc", "helpers"),
    join(rootDir, "node_modules", "next", "node_modules", "@swc", "helpers"),
  ];
  const swcHelpersTarget = join(
    posWebArtifactDir,
    "apps",
    "pos-web",
    "node_modules",
    "@swc",
    "helpers",
  );
  const posWebRequire = createRequire(join(posWebDir, "package.json"));
  const rootRequire = createRequire(join(rootDir, "package.json"));

  let copiedSwcHelpers = existsSync(swcHelpersTarget);
  const swcHelpersStandaloneCandidates = [
    join(posWebStandaloneDir, "node_modules", "@swc", "helpers"),
    join(
      posWebStandaloneDir,
      "apps",
      "pos-web",
      "node_modules",
      "@swc",
      "helpers",
    ),
  ];

  for (const candidate of swcHelpersStandaloneCandidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    await cp(candidate, swcHelpersTarget, { recursive: true, force: true });
    copiedSwcHelpers = true;
    break;
  }

  for (const candidate of swcHelpersCandidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    await cp(candidate, swcHelpersTarget, { recursive: true, force: true });
    copiedSwcHelpers = true;
    break;
  }

  if (!copiedSwcHelpers) {
    const resolvedSwcHelpersCandidates = [];

    try {
      resolvedSwcHelpersCandidates.push(
        dirname(posWebRequire.resolve("@swc/helpers/package.json")),
      );
    } catch {
      // ignore
    }

    try {
      resolvedSwcHelpersCandidates.push(
        dirname(rootRequire.resolve("@swc/helpers/package.json")),
      );
    } catch {
      // ignore
    }

    for (const candidate of resolvedSwcHelpersCandidates) {
      if (!existsSync(candidate)) {
        continue;
      }
      await cp(candidate, swcHelpersTarget, { recursive: true, force: true });
      copiedSwcHelpers = true;
      break;
    }
  }

  if (!copiedSwcHelpers) {
    console.warn(
      [
        "Warning: '@swc/helpers' was not found while preparing pos-web artifact.",
        "Packaging will continue. If runtime fails, ensure dependency installation before build.",
        "Checked paths:",
        ...swcHelpersStandaloneCandidates.map((path) => `  - ${path}`),
        ...swcHelpersCandidates.map((path) => `  - ${path}`),
        "Also attempted resolution via require.resolve from pos-web/root package contexts.",
      ].join("\n"),
    );
  }
}

async function writeManifest() {
  const files = [
    "Dockerfile",
    "docker-compose.yml",
    "api/index.js",
    "api/migrate.js",
    "api/seed.js",
    "web-admin/apps/web-admin/server.js",
    "pos-web/apps/pos-web/server.js",
    "env/production.env.example",
    "postgres/ensure-app-role.sh",
    "postgres/backup-loop.sh",
    "postgres/cloud-backup-loop.sh",
    "postgres/cloud-object-storage-loop.sh",
    "postgres/restore-drill.sh",
    "caddy/Caddyfile",
    "nginx/cleanhub.conf.example",
  ];
  const checksums = {};

  for (const file of files) {
    const filePath = join(artifactDir, file);
    if (existsSync(filePath)) {
      checksums[file] = await sha256(filePath);
    }
  }

  await writeFile(
    join(artifactDir, "manifest.json"),
    `${JSON.stringify(
      {
        name: "cleanhub",
        generatedAt: new Date().toISOString(),
        artifactPath: relative(rootDir, artifactDir).replaceAll("\\", "/"),
        checksums,
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  await rm(releaseRoot, { recursive: true, force: true });
  await mkdir(join(artifactDir, "api"), { recursive: true });
  await mkdir(join(artifactDir, "db"), { recursive: true });
  await mkdir(join(artifactDir, "db", "seeds"), { recursive: true });
  await mkdir(join(artifactDir, "env"), { recursive: true });
  await mkdir(join(artifactDir, "postgres"), { recursive: true });
  await mkdir(join(artifactDir, "caddy"), { recursive: true });
  await mkdir(join(artifactDir, "nginx"), { recursive: true });

  await run("pnpm", ["--filter", "@cleanhub/api-client", "typecheck"]);
  await run("pnpm", ["--filter", "@cleanhub/api", "build"]);
  // NEXT_PUBLIC_* values are inlined at build time, so the browser API base URL
  // must be set here, not via runtime env on the server. Defaults to the
  // same-domain "/api" reverse-proxy path; override by exporting the var.
  await run("pnpm", ["--filter", "@cleanhub/web-admin", "build"], {
    env: {
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
    },
  });
  await run("pnpm", ["--filter", "@cleanhub/pos-web", "build"], {
    env: {
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
    },
  });

  await bundleApi();
  await copyWebAdminStandalone();
  await copyPosWebStandalone();
  await cp(
    join(rootDir, "packages", "db", "drizzle"),
    join(artifactDir, "db", "drizzle"),
    { recursive: true },
  );
  await cp(
    join(rootDir, "packages", "db", "src", "seeds"),
    join(artifactDir, "db", "seeds"),
    { recursive: true },
  );
  await cp(
    join(rootDir, "deploy", "env", "production.env.example"),
    join(artifactDir, "env", "production.env.example"),
  );
  await cp(
    join(rootDir, "deploy", "postgres", "ensure-app-role.sh"),
    join(artifactDir, "postgres", "ensure-app-role.sh"),
  );
  for (const fileName of [
    "backup-loop.sh",
    "cloud-backup-loop.sh",
    "cloud-object-storage-loop.sh",
    "restore-drill.sh",
  ]) {
    await cp(
      join(rootDir, "deploy", "postgres", fileName),
      join(artifactDir, "postgres", fileName),
    );
  }
  await cp(
    join(rootDir, "deploy", "caddy", "Caddyfile"),
    join(artifactDir, "caddy", "Caddyfile"),
  );
  await cp(
    join(rootDir, "deploy", "nginx", "cleanhub.conf.example"),
    join(artifactDir, "nginx", "cleanhub.conf.example"),
  );
  await writeReleaseDockerfile();
  await writeReleaseCompose();
  await writeManifest();

  console.log(
    `Release artifact generated at ${relative(rootDir, artifactDir)}.`,
  );
}

await main();

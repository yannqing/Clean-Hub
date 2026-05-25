import { build } from "esbuild";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(rootDir, "release");
const artifactDir = join(releaseRoot, "cleanhub");
const webAdminDir = join(rootDir, "apps", "web-admin");
const webAdminStandaloneDir = join(webAdminDir, ".next", "standalone");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
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
  CMD node -e "fetch('http://127.0.0.1:4000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "api/index.js"]

FROM base AS migrate
COPY api ./api
COPY db ./db
ENV DRIZZLE_MIGRATIONS_FOLDER=/app/db/drizzle
CMD ["node", "api/migrate.js"]

FROM base AS web-admin
COPY web-admin ./web-admin
WORKDIR /app/web-admin/apps/web-admin
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \\
  CMD node -e "fetch('http://127.0.0.1:3000/login').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
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
      POSTGRES_USER: \${POSTGRES_USER:-cleanhub}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    volumes:
      - cleanhub-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${composeDollar}${composeDollar}{POSTGRES_USER:-cleanhub} -d ${composeDollar}${composeDollar}{POSTGRES_DB:-cleanhub}",
        ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
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
    env_file:
      - ./.env.production
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: \${DATABASE_URL:-postgres://cleanhub:\${POSTGRES_PASSWORD}@postgres:5432/cleanhub}
    ports:
      - "127.0.0.1:\${API_HOST_PORT:-4010}:4000"
    depends_on:
      postgres:
        condition: service_healthy
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
    env_file:
      - ./.env.production
    environment:
      NODE_ENV: production
      PORT: 3000
      CLEANHUB_API_BASE_URL: \${CLEANHUB_API_BASE_URL:-http://api:4000}
      NEXT_PUBLIC_API_BASE_URL: \${NEXT_PUBLIC_API_BASE_URL:-/api}
    ports:
      - "127.0.0.1:\${WEB_ADMIN_HOST_PORT:-3010}:3000"
    depends_on:
      api:
        condition: service_started
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
      DATABASE_URL: \${DATABASE_URL:-postgres://cleanhub:\${POSTGRES_PASSWORD}@postgres:5432/cleanhub}
      DRIZZLE_MIGRATIONS_FOLDER: /app/db/drizzle
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - cleanhub

networks:
  cleanhub:
    name: cleanhub-net

volumes:
  cleanhub-postgres-data:
    name: cleanhub-postgres-data
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
  };

  await build({
    ...commonOptions,
    entryPoints: [join(rootDir, "apps", "api", "src", "index.ts")],
    outfile: join(artifactDir, "api", "index.js"),
  });

  await build({
    ...commonOptions,
    entryPoints: [join(rootDir, "scripts", "release-migrate.ts")],
    outfile: join(artifactDir, "api", "migrate.js"),
  });
}

async function copyWebAdminStandalone() {
  await stat(webAdminStandaloneDir);
  await cp(webAdminStandaloneDir, join(artifactDir, "web-admin"), {
    recursive: true,
    dereference: true,
  });
  await cp(
    join(webAdminDir, ".next", "static"),
    join(artifactDir, "web-admin", "apps", "web-admin", ".next", "static"),
    { recursive: true },
  );
  await copyIfExists(
    join(webAdminDir, "public"),
    join(artifactDir, "web-admin", "apps", "web-admin", "public"),
  );
}

async function writeManifest() {
  const files = [
    "Dockerfile",
    "docker-compose.yml",
    "api/index.js",
    "api/migrate.js",
    "web-admin/apps/web-admin/server.js",
    "env/production.env.example",
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
  await mkdir(join(artifactDir, "env"), { recursive: true });
  await mkdir(join(artifactDir, "nginx"), { recursive: true });

  await run("pnpm", ["--filter", "@cleanhub/api-client", "typecheck"]);
  await run("pnpm", ["--filter", "@cleanhub/api", "build"]);
  await run("pnpm", ["--filter", "@cleanhub/web-admin", "build"]);

  await bundleApi();
  await copyWebAdminStandalone();
  await cp(
    join(rootDir, "packages", "db", "drizzle"),
    join(artifactDir, "db", "drizzle"),
    { recursive: true },
  );
  await cp(
    join(rootDir, "deploy", "env", "production.env.example"),
    join(artifactDir, "env", "production.env.example"),
  );
  await cp(
    join(rootDir, "deploy", "nginx", "cleanhub.conf.example"),
    join(artifactDir, "nginx", "cleanhub.conf.example"),
  );
  await writeReleaseDockerfile();
  await writeReleaseCompose();
  await writeManifest();

  console.log(`Release artifact generated at ${relative(rootDir, artifactDir)}.`);
}

await main();

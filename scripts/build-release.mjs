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
  && npm install next react react-dom @swc/helpers@0.5.15 @next/env --omit=dev --no-audit --no-fund --registry=https://registry.npmmirror.com \
  && rm -rf /app/web-admin/apps/web-admin/node_modules \
  && mkdir -p /app/web-admin/apps/web-admin/node_modules \
  && cp -R /tmp/next-runtime/node_modules/. /app/web-admin/apps/web-admin/node_modules \
  && rm -rf /tmp/next-runtime
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
      # Next.js standalone defaults HOSTNAME to the container hostname IP, which
      # leaves 127.0.0.1 unbound and makes the container's own healthcheck
      # (fetch http://127.0.0.1:3000/login) fail. Bind all interfaces instead.
      HOSTNAME: 0.0.0.0
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
    entryPoints: [join(rootDir, "scripts", "release-migrate.ts")],
    outfile: join(artifactDir, "api", "migrate.js"),
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

  // Windows release builds may miss this transitive runtime dependency after
  // flattening pnpm links for Linux deployment. Ensure it exists in artifact.
  const swcHelpersCandidates = [
    join(webAdminDir, "node_modules", "@swc", "helpers"),
    join(webAdminDir, "node_modules", "next", "node_modules", "@swc", "helpers"),
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
  // NEXT_PUBLIC_* values are inlined at build time, so the browser API base URL
  // must be set here, not via runtime env on the server. Defaults to the
  // same-domain "/api" reverse-proxy path; override by exporting the var.
  await run("pnpm", ["--filter", "@cleanhub/web-admin", "build"], {
    env: {
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
    },
  });

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

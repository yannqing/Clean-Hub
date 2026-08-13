import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadPosEnvironment } from "./environment.mjs";
import { validateNativeRelease } from "./native-release-validation.mjs";
import { run } from "./process.mjs";
import { paths, writeRuntimeAsset } from "./runtime-assets.mjs";

const mode = process.argv[2] ?? "release";
if (mode !== "debug" && mode !== "release") {
  throw new Error('Android package mode must be either "debug" or "release".');
}

const isRelease = mode === "release";
const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const androidDir = join(paths.appRoot, "android");
const outputDir = join(rootDir, "release", "pos-mobile", "android");

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Android release signing.`);
  }

  return value;
}

function resolveVersion(environment) {
  const version =
    environment.CLEANHUB_POS_VERSION?.trim() ??
    environment.CLEANHUB_ANDROID_VERSION_NAME?.trim() ??
    "0.1.0";

  if (!version || version.length > 100 || /[\r\n/\\]/.test(version)) {
    throw new Error(
      "CLEANHUB_POS_VERSION must be a non-empty version name without path separators.",
    );
  }

  return version;
}

function resolveBuildNumber(environment) {
  const rawBuildNumber =
    environment.CLEANHUB_POS_BUILD_NUMBER?.trim() ??
    environment.CLEANHUB_ANDROID_VERSION_CODE?.trim() ??
    "1";
  const buildNumber = Number(rawBuildNumber);

  if (
    !Number.isSafeInteger(buildNumber) ||
    buildNumber < 1 ||
    buildNumber > 2_100_000_000
  ) {
    throw new Error(
      "CLEANHUB_POS_BUILD_NUMBER must be an integer from 1 to 2100000000.",
    );
  }

  return String(buildNumber);
}

async function assertReadableFile(filePath, environmentName) {
  try {
    await access(filePath, constants.R_OK);
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw new Error("not a file");
    }
  } catch {
    throw new Error(
      `${environmentName} does not point to a readable file: ${filePath}`,
    );
  }
}

async function copyArtifact(sourcePath, fileName, kind) {
  await access(sourcePath, constants.R_OK);
  const targetPath = join(outputDir, fileName);
  await copyFile(sourcePath, targetPath);
  const contents = await readFile(targetPath);
  const fileStats = await stat(targetPath);

  return {
    kind,
    file: relative(rootDir, targetPath).replaceAll("\\", "/"),
    bytes: fileStats.size,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

const { environment, runtimeConfig } = loadPosEnvironment({
  production: isRelease,
});
const version = resolveVersion(environment);
const buildNumber = resolveBuildNumber(environment);

if (!runtimeConfig.serverUrl) {
  throw new Error(
    `CLEANHUB_POS_SERVER_URL is required to package a usable ${mode} POS APK.`,
  );
}

const gradleEnvironment = {
  ...environment,
  CLEANHUB_POS_VERSION: version,
  CLEANHUB_POS_BUILD_NUMBER: buildNumber,
  CLEANHUB_ANDROID_VERSION_NAME: version,
  CLEANHUB_ANDROID_VERSION_CODE: buildNumber,
};

if (isRelease) {
  const keystorePath = resolve(
    requireEnvironment("CLEANHUB_ANDROID_KEYSTORE_PATH"),
  );
  await assertReadableFile(keystorePath, "CLEANHUB_ANDROID_KEYSTORE_PATH");

  Object.assign(gradleEnvironment, {
    CLEANHUB_ANDROID_KEYSTORE_PATH: keystorePath,
    CLEANHUB_ANDROID_KEYSTORE_PASSWORD: requireEnvironment(
      "CLEANHUB_ANDROID_KEYSTORE_PASSWORD",
    ),
    CLEANHUB_ANDROID_KEY_ALIAS: requireEnvironment(
      "CLEANHUB_ANDROID_KEY_ALIAS",
    ),
    CLEANHUB_ANDROID_KEY_PASSWORD: requireEnvironment(
      "CLEANHUB_ANDROID_KEY_PASSWORD",
    ),
  });
}

console.log(
  `Packaging CleanHub POS Android ${mode} ${version} (${buildNumber}) for ${runtimeConfig.serverUrl}.`,
);

await run("tsc", ["-p", "tsconfig.json"], {
  cwd: paths.appRoot,
  env: gradleEnvironment,
});
await writeRuntimeAsset(runtimeConfig);
await run("cap", ["sync", "android"], {
  cwd: paths.appRoot,
  env: gradleEnvironment,
});

if (isRelease) {
  await validateNativeRelease("android", runtimeConfig.serverUrl);
}

const gradleCommand =
  process.platform === "win32" ? "gradlew.bat" : "./gradlew";
await run(
  gradleCommand,
  [
    "clean",
    isRelease ? "assembleRelease" : "assembleDebug",
    ...(isRelease ? ["bundleRelease"] : []),
  ],
  {
    cwd: androidDir,
    env: gradleEnvironment,
  },
);

await mkdir(outputDir, { recursive: true });
const artifactPrefix = `CleanHub-POS-${version}-${buildNumber}`;
const artifacts = [];

if (isRelease) {
  artifacts.push(
    await copyArtifact(
      join(
        androidDir,
        "app",
        "build",
        "outputs",
        "apk",
        "release",
        "app-release.apk",
      ),
      `${artifactPrefix}.apk`,
      "apk",
    ),
  );
  artifacts.push(
    await copyArtifact(
      join(
        androidDir,
        "app",
        "build",
        "outputs",
        "bundle",
        "release",
        "app-release.aab",
      ),
      `${artifactPrefix}.aab`,
      "aab",
    ),
  );
} else {
  artifacts.push(
    await copyArtifact(
      join(
        androidDir,
        "app",
        "build",
        "outputs",
        "apk",
        "debug",
        "app-debug.apk",
      ),
      `${artifactPrefix}-debug.apk`,
      "debug-apk",
    ),
  );
}

const manifestPath = join(outputDir, `${artifactPrefix}-${mode}.json`);
await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      appId: "com.cleanhub.pos",
      mode,
      version,
      buildNumber: Number(buildNumber),
      serverOrigin: runtimeConfig.serverUrl,
      generatedAt: new Date().toISOString(),
      artifacts,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`CleanHub POS Android ${mode} package completed:`);
for (const artifact of artifacts) {
  console.log(`- ${artifact.file} (${artifact.sha256})`);
}
console.log(`- ${relative(rootDir, manifestPath).replaceAll("\\", "/")}`);

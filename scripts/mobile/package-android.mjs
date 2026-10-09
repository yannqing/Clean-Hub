import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveMobileReleaseEnv } from "./mobile-release-env.mjs";
import { validateMobileRelease } from "./mobile-release-validation.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const androidDir = join(rootDir, "apps", "mobile", "android");
const releaseEnv = resolveMobileReleaseEnv();

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Android release signing.`);
  }

  return value;
}

function run(command, args, options = {}) {
  return new Promise((complete, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...(options.env ?? {}) },
    });

    child.on("exit", (code) => {
      if (code === 0) {
        complete();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}.`));
    });
  });
}

const signingEnv = {
  CLEANHUB_ANDROID_KEYSTORE_PATH: resolve(requireEnv("CLEANHUB_ANDROID_KEYSTORE_PATH")),
  CLEANHUB_ANDROID_KEYSTORE_PASSWORD: requireEnv("CLEANHUB_ANDROID_KEYSTORE_PASSWORD"),
  CLEANHUB_ANDROID_KEY_ALIAS: requireEnv("CLEANHUB_ANDROID_KEY_ALIAS"),
  CLEANHUB_ANDROID_KEY_PASSWORD: requireEnv("CLEANHUB_ANDROID_KEY_PASSWORD"),
  CLEANHUB_ANDROID_VERSION_CODE: releaseEnv.buildNumber,
  CLEANHUB_ANDROID_VERSION_NAME: releaseEnv.version,
};

// A signed APK is the artefact that reaches real phones, so the unsafe
// combinations are refused here rather than reported. Without this, omitting
// CLEANHUB_MOBILE_ENV produced a signed release build pointing at
// http://localhost:4000 over cleartext.
await validateMobileRelease(releaseEnv);

console.log(`Building signed Android release for ${releaseEnv.appEnvironment}.`);

await run("node", ["scripts/mobile/sync-mobile.mjs", "android"]);
await run(
  process.platform === "win32" ? "gradlew.bat" : "./gradlew",
  ["clean", "bundleRelease", "assembleRelease"],
  {
    cwd: androidDir,
    env: signingEnv,
  },
);

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveMobileReleaseEnv, toNextPublicEnv } from "./mobile-release-env.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

const targetPlatform = process.argv[2];
const releaseEnv = resolveMobileReleaseEnv();
const buildEnv = toNextPublicEnv(releaseEnv);
const syncArgs = ["--filter", "@cleanhub/mobile", "exec", "cap", "sync"];

if (targetPlatform) {
  syncArgs.push(targetPlatform);
}

console.log(
  `Preparing CleanHub Mobile ${releaseEnv.version} (${releaseEnv.buildNumber}) for ${releaseEnv.appEnvironment}.`,
);
console.log(`Mobile API base URL: ${releaseEnv.apiBaseUrl}`);

await run("pnpm", ["--filter", "@cleanhub/mobile-web", "build"], { env: buildEnv });
await run("pnpm", syncArgs);

import { loadPosEnvironment } from "./environment.mjs";
import { run } from "./process.mjs";
import { paths, writeRuntimeAsset } from "./runtime-assets.mjs";

const [command, platform] = process.argv.slice(2);
const supportedCommands = new Set(["sync", "run"]);
const supportedPlatforms = new Set(["android", "ios"]);

if (!supportedCommands.has(command)) {
  throw new Error("Expected a Capacitor command: sync or run.");
}
if (platform !== undefined && !supportedPlatforms.has(platform)) {
  throw new Error("Capacitor platform must be android or ios.");
}
if (command === "run" && !platform) {
  throw new Error("Capacitor run requires an android or ios platform.");
}

const { environment, runtimeConfig } = loadPosEnvironment();
await writeRuntimeAsset(runtimeConfig);
await run("cap", [command, ...(platform ? [platform] : [])], {
  cwd: paths.appRoot,
  env: environment,
});

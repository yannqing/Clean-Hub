import { loadPosEnvironment } from "./environment.mjs";
import {
  validateNativeAndroidRelease,
  validateNativeRelease,
} from "./native-release-validation.mjs";
import { run } from "./process.mjs";
import { paths, writeRuntimeAsset } from "./runtime-assets.mjs";

const [action, platformArgument] = process.argv.slice(2);
const supportedActions = new Set(["build", "sync", "validate"]);
const supportedPlatforms = new Set(["android", "ios"]);

if (!supportedActions.has(action)) {
  throw new Error("Expected a release action: build, sync or validate.");
}
if (
  platformArgument !== undefined &&
  !supportedPlatforms.has(platformArgument)
) {
  throw new Error("Release platform must be android or ios.");
}

const platforms = platformArgument ? [platformArgument] : ["android", "ios"];
const { environment, runtimeConfig } = loadPosEnvironment({
  production: true,
  // iOS remains the Capacitor POS shell; an Android-only run does not require
  // an unused WebView origin.
  allowMissingServer: platformArgument === "android",
});

if (action !== "validate") {
  if (action === "build") {
    await run("tsc", ["-p", "tsconfig.json"], {
      cwd: paths.appRoot,
      env: environment,
    });
  }

  const syncEnvironment = {
    ...environment,
    ...(platformArgument === "android"
      ? { CLEANHUB_POS_NATIVE_ANDROID: "true" }
      : {}),
  };
  await writeRuntimeAsset(runtimeConfig);
  await run("cap", ["sync", ...(platformArgument ? [platformArgument] : [])], {
    cwd: paths.appRoot,
    env: syncEnvironment,
  });
}

for (const platform of platforms) {
  if (platform === "android") {
    await validateNativeAndroidRelease(
      environment.CLEANHUB_POS_API_BASE_URL?.trim() ?? runtimeConfig.serverUrl,
    );
  } else {
    await validateNativeRelease(platform, runtimeConfig.serverUrl);
  }
}

console.log(
  `POS Mobile production ${action} check passed for ${platforms.join(" and ")}.`,
);

import { loadPosEnvironment } from "./environment.mjs";
import { validateNativeRelease } from "./native-release-validation.mjs";
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
});

if (action !== "validate") {
  if (action === "build") {
    await run("tsc", ["-p", "tsconfig.json"], {
      cwd: paths.appRoot,
      env: environment,
    });
  }

  await writeRuntimeAsset(runtimeConfig);
  await run("cap", ["sync", ...(platformArgument ? [platformArgument] : [])], {
    cwd: paths.appRoot,
    env: environment,
  });
}

for (const platform of platforms) {
  await validateNativeRelease(platform, runtimeConfig.serverUrl);
}

console.log(
  `POS Mobile production ${action} check passed for ${platforms.join(" and ")}.`,
);

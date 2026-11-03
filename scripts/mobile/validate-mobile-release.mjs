import { resolveMobileReleaseEnv } from "./mobile-release-env.mjs";
import { validateMobileRelease } from "./mobile-release-validation.mjs";

/**
 * Run the release gates without building anything, so the environment can be
 * checked before a long signed build starts.
 */
const releaseEnv = resolveMobileReleaseEnv();

await validateMobileRelease(releaseEnv);

console.log(
  `CleanHub Mobile ${releaseEnv.version} (${releaseEnv.buildNumber}) is ready for ${releaseEnv.appEnvironment}.`,
);
console.log(`Mobile API base URL: ${releaseEnv.apiBaseUrl}`);

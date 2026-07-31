import { validateNativeRelease } from "./native-release-validation.mjs";

const [platform] = process.argv.slice(2);
const serverUrl = await validateNativeRelease(platform);
console.log(
  `POS Mobile ${platform} native release config is safe (${serverUrl}).`,
);

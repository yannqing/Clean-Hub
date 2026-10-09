import {
  validateNativeAndroidRelease,
  validateNativeRelease,
} from "./native-release-validation.mjs";

const [platform] = process.argv.slice(2);
if (platform === "android") {
  const apiUrl =
    process.env.CLEANHUB_POS_API_BASE_URL?.trim() ??
    process.env.CLEANHUB_POS_SERVER_URL?.trim();
  const validatedApiUrl = await validateNativeAndroidRelease(apiUrl);
  console.log(`Native Android POS release config is safe (${validatedApiUrl}).`);
} else {
  const serverUrl = await validateNativeRelease(platform);
  console.log(`POS Mobile ${platform} native release config is safe (${serverUrl}).`);
}

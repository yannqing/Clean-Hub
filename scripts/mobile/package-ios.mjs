import { mkdtemp, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveMobileReleaseEnv } from "./mobile-release-env.mjs";
import { assertProductionReleaseEnv } from "./mobile-release-validation.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const iosDir = join(rootDir, "apps", "mobile", "ios", "App");
const archivePath = join(rootDir, "release", "mobile", "ios", "CleanHub.xcarchive");
const exportPath = join(rootDir, "release", "mobile", "ios", "export");
const releaseEnv = resolveMobileReleaseEnv();

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for iOS packaging.`);
  }

  return value;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
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

if (process.platform === "win32") {
  throw new Error("iOS packaging must run on macOS with Xcode installed.");
}

const teamId = requireEnv("CLEANHUB_IOS_TEAM_ID");
const bundleId = process.env.CLEANHUB_IOS_BUNDLE_ID ?? "com.cleanhub.app";
const provisioningProfile = requireEnv("CLEANHUB_IOS_PROVISIONING_PROFILE");
const signingCertificate = process.env.CLEANHUB_IOS_SIGNING_CERTIFICATE ?? "Apple Distribution";
const exportMethod = process.env.CLEANHUB_IOS_EXPORT_METHOD ?? "app-store-connect";

const exportOptions = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${exportMethod}</string>
  <key>teamID</key>
  <string>${teamId}</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>signingCertificate</key>
  <string>${signingCertificate}</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${bundleId}</key>
    <string>${provisioningProfile}</string>
  </dict>
</dict>
</plist>
`;

const tempDir = await mkdtemp(join(tmpdir(), "cleanhub-ios-export-"));
const exportOptionsPath = join(tempDir, "ExportOptions.plist");
await writeFile(exportOptionsPath, exportOptions);

// The Android-only manifest checks do not apply here, but the environment
// gate does: an archive built without CLEANHUB_MOBILE_ENV would ship pointing
// at localhost.
assertProductionReleaseEnv(releaseEnv);

console.log(`Building iOS archive for ${releaseEnv.appEnvironment}.`);

await run("node", ["scripts/mobile/sync-mobile.mjs", "ios"]);
await run("xcodebuild", [
  "-workspace",
  "App.xcworkspace",
  "-scheme",
  "App",
  "-configuration",
  "Release",
  "-archivePath",
  archivePath,
  "archive",
  `DEVELOPMENT_TEAM=${teamId}`,
  `PRODUCT_BUNDLE_IDENTIFIER=${bundleId}`,
  `MARKETING_VERSION=${releaseEnv.version}`,
  `CURRENT_PROJECT_VERSION=${releaseEnv.buildNumber}`,
], { cwd: iosDir });
await run("xcodebuild", [
  "-exportArchive",
  "-archivePath",
  archivePath,
  "-exportPath",
  exportPath,
  "-exportOptionsPlist",
  exportOptionsPath,
], { cwd: iosDir });

import assert from "node:assert/strict";

import {
  assertAndroidManifestIsSafe,
  assertDataExtractionRulesAreComplete,
  assertProductionReleaseEnv,
  validateMobileRelease,
} from "./mobile-release-validation.mjs";

const prodEnv = {
  appEnvironment: "prod",
  apiBaseUrl: "https://api.cleanhub.example",
  updateUrl: "https://cleanhub.example/mobile",
  version: "1.0.0",
  buildNumber: "1",
};

function assertThrows(run, label) {
  try {
    run();
  } catch {
    return;
  }

  throw new Error(`expected to be rejected: ${label}`);
}

// A well-formed production environment passes.
assertProductionReleaseEnv(prodEnv);

// The default environment is "dev". Packaging without CLEANHUB_MOBILE_ENV used
// to produce a signed release APK pointing at http://localhost:4000.
assertThrows(
  () => assertProductionReleaseEnv({ ...prodEnv, appEnvironment: "dev" }),
  "a dev environment must not be packaged as a release",
);
assertThrows(
  () => assertProductionReleaseEnv({ ...prodEnv, appEnvironment: "staging" }),
  "a staging environment must not be packaged as a release",
);
assertThrows(
  () =>
    assertProductionReleaseEnv({
      ...prodEnv,
      apiBaseUrl: "http://api.cleanhub.example",
    }),
  "a cleartext API base URL must be refused",
);

// The shipped defaults are `.local` placeholders that reach nothing.
assertThrows(
  () =>
    assertProductionReleaseEnv({
      ...prodEnv,
      apiBaseUrl: "https://api.cleanhub.local",
    }),
  "a .local API base URL must be refused",
);
assertThrows(
  () =>
    assertProductionReleaseEnv({
      ...prodEnv,
      updateUrl: "https://cleanhub.local/mobile",
    }),
  "a .local update URL must be refused",
);
assertThrows(
  () => assertProductionReleaseEnv({ ...prodEnv, apiBaseUrl: "not a url" }),
  "an unparseable URL must be refused",
);

// The session lives in SharedPreferences, so backups must be off.
const safeManifest = `
<application
  android:allowBackup="false"
  android:dataExtractionRules="@xml/data_extraction_rules"
  android:fullBackupContent="false">
</application>`;

assertAndroidManifestIsSafe(safeManifest);

assertThrows(
  () =>
    assertAndroidManifestIsSafe(`
<application
  android:allowBackup="true"
  android:dataExtractionRules="@xml/data_extraction_rules"
  android:fullBackupContent="false">
</application>`),
  "allowBackup=true must be refused: it syncs auth tokens to Google Drive",
);
assertThrows(
  () =>
    assertAndroidManifestIsSafe(`
<application
  android:allowBackup="false"
  android:fullBackupContent="false">
</application>`),
  "a missing dataExtractionRules reference must be refused",
);
assertThrows(
  () =>
    assertAndroidManifestIsSafe(`
<application
  android:allowBackup="false"
  android:dataExtractionRules="@xml/data_extraction_rules"
  android:fullBackupContent="false"
  android:usesCleartextTraffic="true">
</application>`),
  "cleartext traffic must be refused",
);

const domains = [
  "root",
  "file",
  "database",
  "sharedpref",
  "external",
  "device_root",
  "device_file",
  "device_database",
  "device_sharedpref",
];

const excludes = domains
  .map((domain) => `<exclude domain="${domain}" path="." />`)
  .join("\n");

assertDataExtractionRulesAreComplete(`
<data-extraction-rules>
  <cloud-backup>${excludes}</cloud-backup>
  <device-transfer>${excludes}</device-transfer>
</data-extraction-rules>`);

// Missing "sharedpref" is the one that matters most: that is where the
// Capacitor Preferences session sits.
const withoutSharedPref = domains
  .filter((domain) => domain !== "sharedpref")
  .map((domain) => `<exclude domain="${domain}" path="." />`)
  .join("\n");

assertThrows(
  () =>
    assertDataExtractionRulesAreComplete(`
<data-extraction-rules>
  <cloud-backup>${withoutSharedPref}</cloud-backup>
  <device-transfer>${excludes}</device-transfer>
</data-extraction-rules>`),
  "an unexcluded sharedpref domain must be refused",
);
assertThrows(
  () =>
    assertDataExtractionRulesAreComplete(`
<data-extraction-rules>
  <cloud-backup>${excludes}</cloud-backup>
</data-extraction-rules>`),
  "a missing device-transfer section must be refused",
);

// Finally, the files actually checked into the repository must pass.
await validateMobileRelease(prodEnv);

console.log("CleanHub Mobile release validation smoke ok");

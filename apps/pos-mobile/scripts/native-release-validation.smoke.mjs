import assert from "node:assert/strict";

import {
  assertAndroidTerminalBackupProtection,
  assertIosPrivacyManifest,
} from "./native-release-validation.mjs";

const manifest = `
<application
  android:allowBackup="false"
  android:dataExtractionRules="@xml/data_extraction_rules"
  android:fullBackupContent="false">
</application>`;

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
const exclusions = domains
  .map((domain) => `<exclude path="." domain="${domain}" />`)
  .join("\n");
const rules = `
<data-extraction-rules>
  <cloud-backup>${exclusions}</cloud-backup>
  <device-transfer>${exclusions}</device-transfer>
</data-extraction-rules>`;

assert.doesNotThrow(() =>
  assertAndroidTerminalBackupProtection({
    manifest,
    manifestPath: "AndroidManifest.xml",
    rules,
    rulesPath: "data_extraction_rules.xml",
  }),
);

assert.throws(
  () =>
    assertAndroidTerminalBackupProtection({
      manifest: manifest.replace(
        'android:dataExtractionRules="@xml/data_extraction_rules"',
        "",
      ),
      manifestPath: "AndroidManifest.xml",
      rules,
      rulesPath: "data_extraction_rules.xml",
    }),
  /device transfer must remain disabled/,
);

assert.throws(
  () =>
    assertAndroidTerminalBackupProtection({
      manifest,
      manifestPath: "AndroidManifest.xml",
      rules: rules.replace('<exclude path="." domain="sharedpref" />', ""),
      rulesPath: "data_extraction_rules.xml",
    }),
  /missing: sharedpref/,
);

const iosPrivacyManifest = `
<plist>
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array><dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array><string>CA92.1</string></array>
  </dict></array>
  <key>NSPrivacyTracking</key>
  <false/>
</dict>
</plist>`;
const iosProject = `
path = PrivacyInfo.xcprivacy;
/* Begin PBXResourcesBuildPhase section */
PrivacyInfo.xcprivacy in Resources
/* End PBXResourcesBuildPhase section */`;

assert.doesNotThrow(() =>
  assertIosPrivacyManifest({
    manifest: iosPrivacyManifest,
    manifestPath: "PrivacyInfo.xcprivacy",
    project: iosProject,
    projectPath: "project.pbxproj",
  }),
);

assert.throws(
  () =>
    assertIosPrivacyManifest({
      manifest: iosPrivacyManifest.replace("<string>CA92.1</string>", ""),
      manifestPath: "PrivacyInfo.xcprivacy",
      project: iosProject,
      projectPath: "project.pbxproj",
    }),
  /reason CA92\.1/,
);

assert.throws(
  () =>
    assertIosPrivacyManifest({
      manifest: iosPrivacyManifest,
      manifestPath: "PrivacyInfo.xcprivacy",
      project: iosProject.replace("PrivacyInfo.xcprivacy in Resources", ""),
      projectPath: "project.pbxproj",
    }),
  /App target Resources phase/,
);

console.log("POS Mobile native release validation smoke ok");

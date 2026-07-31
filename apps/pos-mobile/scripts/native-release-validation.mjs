import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { paths } from "./runtime-assets.mjs";

const require = createRequire(import.meta.url);
const { resolvePosRuntimeConfig } = require("./runtime-config.cjs");

function parseGeneratedRuntime(contents, filePath) {
  const match = contents.match(
    /window\.__CLEANHUB_POS_RUNTIME__ = Object\.freeze\((\{.*\})\);/,
  );
  if (!match?.[1]) {
    throw new Error(`Missing generated POS runtime config in ${filePath}.`);
  }

  return JSON.parse(match[1]);
}

function assertProductionNativeConfig(config, filePath, expectedUrl) {
  const failures = [];

  if (config.server?.url !== expectedUrl) {
    failures.push("server.url does not match the production recovery origin");
  }
  if (config.server?.cleartext !== false) {
    failures.push("server.cleartext must be false");
  }
  if (config.server?.errorPath !== "index.html") {
    failures.push('server.errorPath must be "index.html"');
  }
  if (config.loggingBehavior !== "none") {
    failures.push('loggingBehavior must be "none"');
  }
  if (config.ios?.webContentsDebuggingEnabled !== false) {
    failures.push("iOS WebView debugging must be disabled");
  }
  if (config.android?.webContentsDebuggingEnabled !== false) {
    failures.push("Android WebView debugging must be disabled");
  }
  if (config.android?.allowMixedContent !== false) {
    failures.push("Android mixed content must be disabled");
  }

  if (failures.length > 0) {
    throw new Error(
      `Unsafe production Capacitor config at ${filePath}:\n- ${failures.join("\n- ")}`,
    );
  }
}

const ANDROID_BACKUP_DOMAINS = [
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

function getXmlSection(contents, tagName) {
  const match = contents.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`),
  );
  return match?.[1] ?? null;
}

function sectionExcludesDomain(section, domain) {
  return [...section.matchAll(/<exclude\b([^>]*)\/?>/g)].some((match) => {
    const attributes = match[1] ?? "";
    return (
      new RegExp(`\\bdomain\\s*=\\s*["']${domain}["']`).test(attributes) &&
      /\bpath\s*=\s*["']\.["']/.test(attributes)
    );
  });
}

export function assertAndroidTerminalBackupProtection({
  manifest,
  manifestPath,
  rules,
  rulesPath,
}) {
  if (
    !manifest.includes('android:allowBackup="false"') ||
    !manifest.includes('android:fullBackupContent="false"') ||
    !manifest.includes(
      'android:dataExtractionRules="@xml/data_extraction_rules"',
    )
  ) {
    throw new Error(
      `Android POS backups and device transfer must remain disabled at ${manifestPath} to prevent terminal state from being restored onto another device.`,
    );
  }

  for (const sectionName of ["cloud-backup", "device-transfer"]) {
    const section = getXmlSection(rules, sectionName);
    if (!section) {
      throw new Error(
        `Android POS ${sectionName} exclusions are missing at ${rulesPath}.`,
      );
    }

    const missingDomains = ANDROID_BACKUP_DOMAINS.filter(
      (domain) => !sectionExcludesDomain(section, domain),
    );
    if (missingDomains.length > 0) {
      throw new Error(
        `Android POS ${sectionName} must exclude all terminal storage domains at ${rulesPath}; missing: ${missingDomains.join(", ")}.`,
      );
    }
  }
}

export function assertIosPrivacyManifest({
  manifest,
  manifestPath,
  project,
  projectPath,
}) {
  const requiredManifestValues = [
    "<key>NSPrivacyAccessedAPITypes</key>",
    "<string>NSPrivacyAccessedAPICategoryUserDefaults</string>",
    "<key>NSPrivacyAccessedAPITypeReasons</key>",
    "<string>CA92.1</string>",
    "<key>NSPrivacyTracking</key>",
    "<false/>",
  ];
  const missingManifestValues = requiredManifestValues.filter(
    (value) => !manifest.includes(value),
  );
  if (missingManifestValues.length > 0) {
    throw new Error(
      `The iOS POS privacy manifest at ${manifestPath} must declare Capacitor Preferences UserDefaults access with reason CA92.1.`,
    );
  }

  const resourcesSection = project.match(
    /\/\* Begin PBXResourcesBuildPhase section \*\/([\s\S]*?)\/\* End PBXResourcesBuildPhase section \*\//,
  )?.[1];
  if (
    !project.includes("path = PrivacyInfo.xcprivacy;") ||
    !resourcesSection?.includes("PrivacyInfo.xcprivacy in Resources")
  ) {
    throw new Error(
      `The iOS POS privacy manifest must be included in the App target Resources phase at ${projectPath}.`,
    );
  }
}

export async function validateNativeRelease(platform, expectedServerUrl) {
  if (platform !== "android" && platform !== "ios") {
    throw new Error("Native release platform must be android or ios.");
  }

  const nativeRoot =
    platform === "android"
      ? join(paths.appRoot, "android", "app", "src", "main", "assets")
      : join(paths.appRoot, "ios", "App", "App");
  const configPath = join(nativeRoot, "capacitor.config.json");
  const runtimePath = join(nativeRoot, "public", "pos-runtime-config.js");
  const indexPath = join(nativeRoot, "public", "index.html");

  const [configContents, runtimeContents, indexContents] = await Promise.all([
    readFile(configPath, "utf8"),
    readFile(runtimePath, "utf8"),
    readFile(indexPath, "utf8"),
  ]);
  const config = JSON.parse(configContents);
  const generatedRuntime = parseGeneratedRuntime(runtimeContents, runtimePath);
  const validatedRuntime = resolvePosRuntimeConfig(
    {
      CLEANHUB_POS_RUNTIME: generatedRuntime.runtime,
      CLEANHUB_POS_SERVER_URL: generatedRuntime.serverUrl,
      CLEANHUB_POS_ALLOW_CLEARTEXT: "false",
    },
    { requireProduction: true },
  );

  if (expectedServerUrl && validatedRuntime.serverUrl !== expectedServerUrl) {
    throw new Error(
      `Native POS origin ${validatedRuntime.serverUrl} does not match expected origin ${expectedServerUrl}.`,
    );
  }

  assertProductionNativeConfig(config, configPath, validatedRuntime.serverUrl);
  if (
    !indexContents.includes('src="pos-runtime-config.js"') ||
    !indexContents.includes('src="recovery.js"')
  ) {
    throw new Error(`The POS recovery page is incomplete at ${indexPath}.`);
  }

  if (platform === "android") {
    const manifestPath = join(
      paths.appRoot,
      "android",
      "app",
      "src",
      "main",
      "AndroidManifest.xml",
    );
    const rulesPath = join(
      paths.appRoot,
      "android",
      "app",
      "src",
      "main",
      "res",
      "xml",
      "data_extraction_rules.xml",
    );
    const [manifest, rules] = await Promise.all([
      readFile(manifestPath, "utf8"),
      readFile(rulesPath, "utf8"),
    ]);
    assertAndroidTerminalBackupProtection({
      manifest,
      manifestPath,
      rules,
      rulesPath,
    });
  } else {
    const manifestPath = join(
      paths.appRoot,
      "ios",
      "App",
      "App",
      "PrivacyInfo.xcprivacy",
    );
    const projectPath = join(
      paths.appRoot,
      "ios",
      "App",
      "App.xcodeproj",
      "project.pbxproj",
    );
    const [manifest, project] = await Promise.all([
      readFile(manifestPath, "utf8"),
      readFile(projectPath, "utf8"),
    ]);
    assertIosPrivacyManifest({
      manifest,
      manifestPath,
      project,
      projectPath,
    });
  }

  return validatedRuntime.serverUrl;
}

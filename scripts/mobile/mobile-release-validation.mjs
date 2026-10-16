import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = join(
  rootDir,
  "apps/mobile/android/app/src/main/AndroidManifest.xml",
);
const dataExtractionRulesPath = join(
  rootDir,
  "apps/mobile/android/app/src/main/res/xml/data_extraction_rules.xml",
);

/**
 * Every backup domain Android can carry off the device. The session lives in
 * Capacitor Preferences, which is SharedPreferences, so an omission here is
 * an access and refresh token leaving for Google Drive.
 */
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

export function assertProductionReleaseEnv(releaseEnv) {
  const failures = [];

  if (releaseEnv.appEnvironment !== "prod") {
    failures.push(
      `CLEANHUB_MOBILE_ENV must be "prod" for a release build, got "${releaseEnv.appEnvironment}"`,
    );
  }

  const apiBaseUrl = releaseEnv.apiBaseUrl ?? "";

  if (!apiBaseUrl.startsWith("https://")) {
    failures.push(
      `CLEANHUB_MOBILE_API_BASE_URL must be https for a release build, got "${apiBaseUrl}"`,
    );
  }

  // `.local` is mDNS and the placeholder the defaults ship with; a store build
  // pointing there reaches nothing.
  for (const [name, value] of [
    ["CLEANHUB_MOBILE_API_BASE_URL", apiBaseUrl],
    ["CLEANHUB_MOBILE_UPDATE_URL", releaseEnv.updateUrl ?? ""],
  ]) {
    let host = "";

    try {
      host = new URL(value).hostname;
    } catch {
      failures.push(`${name} is not a valid URL: "${value}"`);
      continue;
    }

    if (host.endsWith(".local") || host === "localhost" || host === "127.0.0.1") {
      failures.push(`${name} still points at a local placeholder: "${value}"`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Unsafe production release environment:\n- ${failures.join("\n- ")}`,
    );
  }
}

export function assertAndroidManifestIsSafe(contents) {
  const failures = [];
  const application = contents.match(/<application[\s\S]*?>/)?.[0] ?? "";

  if (!/android:allowBackup="false"/.test(application)) {
    failures.push('android:allowBackup must be "false"');
  }
  if (!/android:dataExtractionRules="@xml\/data_extraction_rules"/.test(application)) {
    failures.push("android:dataExtractionRules must reference the exclusion rules");
  }
  if (!/android:fullBackupContent="false"/.test(application)) {
    failures.push('android:fullBackupContent must be "false"');
  }
  if (/android:usesCleartextTraffic="true"/.test(application)) {
    failures.push("android:usesCleartextTraffic must not be enabled");
  }
  if (/android:debuggable="true"/.test(contents)) {
    failures.push("android:debuggable must not be enabled");
  }

  if (failures.length > 0) {
    throw new Error(
      `Unsafe Android manifest:\n- ${failures.join("\n- ")}`,
    );
  }
}

export function assertDataExtractionRulesAreComplete(contents) {
  const failures = [];

  for (const section of ["cloud-backup", "device-transfer"]) {
    const body = getXmlSection(contents, section);

    if (!body) {
      failures.push(`<${section}> section is missing`);
      continue;
    }

    for (const domain of ANDROID_BACKUP_DOMAINS) {
      if (!new RegExp(`<exclude[^>]*domain="${domain}"`).test(body)) {
        failures.push(`<${section}> does not exclude the "${domain}" domain`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Incomplete data extraction rules:\n- ${failures.join("\n- ")}`,
    );
  }
}

/** Run every release check that can be made from files on disk. */
export async function validateMobileRelease(releaseEnv) {
  assertProductionReleaseEnv(releaseEnv);
  assertAndroidManifestIsSafe(await readFile(manifestPath, "utf8"));
  assertDataExtractionRulesAreComplete(
    await readFile(dataExtractionRulesPath, "utf8"),
  );
}

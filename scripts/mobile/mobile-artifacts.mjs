import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}
function readZip(file, entry) {
  return run("unzip", ["-p", file, entry]);
}

function verifyBundle(config, scripts, releaseEnv) {
  assert.equal(
    config.appId,
    "com.cleanhub.app",
    "Unexpected customer app identifier",
  );
  assert.ok(
    !config.server?.url,
    "A packaged customer app must load its bundled UI",
  );
  assert.notEqual(config.server?.cleartext, true, "Cleartext must be disabled");
  assert.ok(
    scripts.includes(releaseEnv.apiBaseUrl),
    "API base URL missing from packaged JavaScript",
  );
}

async function manifest(directory, files, releaseEnv) {
  const artifacts = await Promise.all(
    files.map(async (path) => ({
      file: path.split(/[\\/]/).at(-1),
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    })),
  );
  await writeFile(
    join(directory, "release-manifest.json"),
    JSON.stringify(
      {
        version: releaseEnv.version,
        buildNumber: releaseEnv.buildNumber,
        apiBaseUrl: releaseEnv.apiBaseUrl,
        artifacts,
      },
      null,
      2,
    ) + "\n",
  );
  return artifacts;
}

export async function verifyAndroidArtifacts(androidDir, releaseEnv) {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  assert.ok(sdk, "ANDROID_HOME is required for signed artifact validation");
  const versions = (await readdir(join(sdk, "build-tools"))).filter((v) =>
    /^\d+(\.\d+)+$/.test(v),
  );
  const version = versions
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1);
  assert.ok(version, "Android SDK build tools are missing");
  const tools = join(sdk, "build-tools", version);
  const apk = join(androidDir, "app/build/outputs/apk/release/app-release.apk");
  const aab = join(
    androidDir,
    "app/build/outputs/bundle/release/app-release.aab",
  );
  const signer = run(
    process.platform === "win32" ? "java" : join(tools, "apksigner"),
    [
      ...(process.platform === "win32"
        ? ["-jar", join(tools, "lib/apksigner.jar")]
        : []),
      "verify",
      "--verbose",
      "--print-certs",
      apk,
    ],
  );
  assert.ok(
    !signer.includes("CN=Android Debug"),
    "APK must not use the Android debug certificate",
  );
  const aapt = join(
    tools,
    process.platform === "win32" ? "aapt2.exe" : "aapt2",
  );
  const badging = run(aapt, ["dump", "badging", apk]);
  assert.ok(
    badging.includes("name='com.cleanhub.app'"),
    "Unexpected APK package",
  );
  assert.ok(
    badging.includes(`versionCode='${releaseEnv.buildNumber}'`),
    "APK version code mismatch",
  );
  assert.ok(
    badging.includes(`versionName='${releaseEnv.version}'`),
    "APK version name mismatch",
  );
  const xml = run(aapt, [
    "dump",
    "xmltree",
    apk,
    "--file",
    "AndroidManifest.xml",
  ]);
  assert.ok(
    !/android:debuggable[^\n]*=(?:\(type[^)]*\))?(?:0xffffffff|true)/.test(xml),
    "APK is debuggable",
  );
  assert.ok(
    /android:usesCleartextTraffic[^\n]*=(?:\(type[^)]*\))?(?:0x0|false)/.test(
      xml,
    ),
    "APK must explicitly disable cleartext",
  );
  const jar = run("jarsigner", ["-J-Duser.language=en", "-verify", aab]);
  assert.ok(
    /jar verified\./.test(jar) && !/jar is unsigned/i.test(jar),
    "AAB signature is invalid or missing",
  );
  for (const [file, prefix] of [
    [apk, "assets/"],
    [aab, "base/assets/"],
  ]) {
    verifyBundle(
      JSON.parse(readZip(file, prefix + "capacitor.config.json")),
      readZip(file, prefix + "public/_next/static/chunks/*.js"),
      releaseEnv,
    );
  }
  return manifest(
    join(androidDir, "app/build/outputs"),
    [apk, aab],
    releaseEnv,
  );
}

export async function verifyIosArchive(archivePath, releaseEnv, bundleId) {
  const app = join(archivePath, "Products/Applications/App.app");
  run("codesign", ["--verify", "--deep", "--strict", app]);
  const plist = JSON.parse(
    run("plutil", ["-convert", "json", "-o", "-", join(app, "Info.plist")]),
  );
  assert.equal(plist.CFBundleIdentifier, bundleId);
  assert.equal(plist.CFBundleShortVersionString, releaseEnv.version);
  assert.equal(String(plist.CFBundleVersion), releaseEnv.buildNumber);
  for (const key of [
    "NSCameraUsageDescription",
    "NSPhotoLibraryUsageDescription",
    "NSPhotoLibraryAddUsageDescription",
  ])
    assert.ok(plist[key], `iOS artifact is missing ${key}`);
  const raw = execFileSync(
    "codesign",
    ["--display", "--entitlements", ":-", app],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const entitlements = JSON.parse(
    execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], {
      input: raw,
      encoding: "utf8",
    }),
  );
  assert.notEqual(
    entitlements["get-task-allow"],
    true,
    "Release iOS app must not allow debugger attachment",
  );
  assert.equal(
    entitlements["aps-environment"],
    "production",
    "Release iOS app needs production APNs entitlement",
  );
}

export async function verifyIosExport(exportPath, releaseEnv) {
  const files = (await readdir(exportPath))
    .filter((file) => file.endsWith(".ipa"))
    .map((file) => join(exportPath, file));
  assert.equal(files.length, 1, "Expected exactly one exported IPA");
  verifyBundle(
    JSON.parse(readZip(files[0], "Payload/*.app/capacitor.config.json")),
    readZip(files[0], "Payload/*.app/public/_next/static/chunks/*.js"),
    releaseEnv,
  );
  return manifest(exportPath, files, releaseEnv);
}

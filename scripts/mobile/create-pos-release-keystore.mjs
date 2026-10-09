#!/usr/bin/env node
/**
 * Creates the Android signing keystore for the POS release build, and prints
 * the repository secrets that go with it.
 *
 * This key signs every CleanHub POS release forever. Android refuses an update
 * signed by a different key, and the only way out is uninstalling -- which
 * destroys the terminal's local data and any sale still sitting in its offline
 * queue. So this script refuses to overwrite an existing keystore, and it
 * writes outside the repository by default.
 *
 * Passwords are generated here rather than accepted as arguments: a password
 * typed on a command line lands in shell history, and one chosen by hand tends
 * to be weaker than the key it protects.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";

const DEFAULT_DIR = resolve(homedir(), ".cleanhub-release");
const DEFAULT_KEYSTORE = resolve(DEFAULT_DIR, "cleanhub-pos-release.jks");
const ALIAS = "cleanhub-pos";
/** 10000 days ≈ 27 years. Play requires a key valid past 2033. */
const VALIDITY_DAYS = 10000;

function parseArgs(argv) {
  const args = { keystore: DEFAULT_KEYSTORE, org: null, country: null };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inlineValue] = argv[i].split("=", 2);
    const value = inlineValue ?? argv[i + 1];
    if (inlineValue === undefined && value !== undefined) i += 1;
    if (flag === "--keystore") args.keystore = resolve(value);
    else if (flag === "--org") args.org = value;
    else if (flag === "--country") args.country = value;
    else if (flag === "--help" || flag === "-h") args.help = true;
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(2);
    }
  }
  return args;
}

function usage() {
  console.log(`Create the CleanHub POS Android signing keystore.

  node scripts/mobile/create-pos-release-keystore.mjs [options]

Options
  --keystore <path>  Where to write it (default: ${DEFAULT_KEYSTORE})
  --org <name>       Organisation for the certificate, e.g. "CleanHub SARL"
  --country <code>   Two-letter country code, e.g. SN

The keystore is written outside the repository on purpose. Never commit it.`);
}

/**
 * Base64 without padding-safe characters removed: this goes into a GitHub
 * secret verbatim and is decoded with `base64 -d`.
 */
function toBase64(filePath) {
  return readFileSync(filePath).toString("base64");
}

function generatePassword() {
  // 32 bytes of entropy, rendered without characters that need shell quoting
  // so a password can be pasted into a secret field or a .env without escaping.
  return randomBytes(24).toString("base64url");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const keystorePath = args.keystore;

  if (existsSync(keystorePath)) {
    console.error(`
A keystore already exists at:
  ${keystorePath}

Refusing to overwrite it. If you replace the key that signed a published
release, every terminal running that release can no longer be updated -- they
would have to uninstall, losing local data and any queued offline sale.

If you are certain this keystore was never used to publish, move it aside
first and run this again.`);
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const organisation =
    args.org ?? (await rl.question("Organisation name (e.g. CleanHub SARL): ")).trim();
  const country =
    args.country ?? (await rl.question("Two-letter country code (e.g. SN): ")).trim();
  rl.close();

  if (!organisation) {
    console.error("An organisation name is required for the certificate.");
    process.exit(2);
  }
  if (!/^[A-Za-z]{2}$/.test(country)) {
    console.error("The country code must be exactly two letters, e.g. SN or FR.");
    process.exit(2);
  }

  // PKCS12 -- the modern keystore format, and keytool's default -- has no
  // separate per-key password. keytool accepts -keypass and then quietly
  // stores the key under the store password anyway, so handing Gradle two
  // different values produces "Given final block not properly padded" at
  // packaging time. One password, used for both.
  const password = generatePassword();

  mkdirSync(dirname(keystorePath), { recursive: true, mode: 0o700 });

  // Passwords go through :env rather than the command line so they never
  // appear in the process list.
  execFileSync(
    "keytool",
    [
      "-genkeypair",
      "-v",
      "-keystore", keystorePath,
      "-alias", ALIAS,
      "-keyalg", "RSA",
      "-keysize", "4096",
      "-validity", String(VALIDITY_DAYS),
      "-storetype", "PKCS12",
      "-storepass:env", "CLEANHUB_STORE_PASSWORD",
      "-keypass:env", "CLEANHUB_KEY_PASSWORD",
      "-dname", `CN=CleanHub POS, O=${organisation.replace(/[,=]/g, " ")}, C=${country.toUpperCase()}`,
    ],
    {
      stdio: ["ignore", "ignore", "inherit"],
      env: {
        ...process.env,
        CLEANHUB_STORE_PASSWORD: password,
        CLEANHUB_KEY_PASSWORD: password,
      },
    },
  );

  // Readable only by this user: it is the one artifact that cannot be
  // regenerated.
  execFileSync("chmod", ["600", keystorePath]);

  const fingerprint = execFileSync(
    "keytool",
    [
      "-list", "-v",
      "-keystore", keystorePath,
      "-alias", ALIAS,
      "-storepass:env", "CLEANHUB_STORE_PASSWORD",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, CLEANHUB_STORE_PASSWORD: password },
    },
  )
    .split("\n")
    .find((line) => line.includes("SHA256:"))
    ?.trim() ?? "(unavailable)";

  const secretsPath = `${keystorePath}.secrets.txt`;
  const base64 = toBase64(keystorePath);
  writeFileSync(
    secretsPath,
    `CleanHub POS Android signing — created ${new Date().toISOString()}

Keystore:    ${keystorePath}
Alias:       ${ALIAS}
${fingerprint}

GitHub repository secrets (Settings -> Secrets and variables -> Actions)
------------------------------------------------------------------------
ANDROID_KEY_ALIAS
${ALIAS}

ANDROID_KEYSTORE_PASSWORD
${password}

ANDROID_KEY_PASSWORD
${password}

ANDROID_KEYSTORE_BASE64
${base64}

------------------------------------------------------------------------
Back up the keystore file and this document somewhere offline. Losing either
means this app can never be updated again.
Delete this file from disk once the secrets are stored.
`,
    { mode: 0o600 },
  );

  const size = statSync(keystorePath).size;
  console.log(`
Keystore created.

  ${keystorePath}  (${size} bytes, mode 600)
  ${fingerprint}

Secrets written to:

  ${secretsPath}

Next
  1. Add the four ANDROID_* secrets from that file to the repository, plus
     POS_API_BASE_URL set to your https API origin.
  2. Back up the keystore and the secrets file offline — two copies.
  3. Delete the secrets file from this machine:
       rm ${secretsPath}

Never commit the keystore. It is written outside the repository on purpose.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

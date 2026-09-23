#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootEnvPath = resolve(projectRoot, ".env");
const posWebEnvPath = resolve(projectRoot, "apps/pos-web/.env");
const posMobileEnvPath = resolve(projectRoot, "apps/pos-mobile/.env");

const LOCAL_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];
const VIRTUAL_INTERFACE_PATTERN =
  /^(?:awdl|bridge|docker|gif|llw|lo|p2p|stf|tailscale|tun|utun|veth|vmnet)/i;

function stripEnvQuotes(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function readEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, "m"));
  return match ? stripEnvQuotes(match[1] ?? "") : undefined;
}

function formatEnvValue(value) {
  return JSON.stringify(value);
}

export function updateEnvContent(content, updates) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const pending = new Map(Object.entries(updates));
  const written = new Set();
  const result = [];

  for (const line of lines) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    const key = match?.[1];
    if (!key || !pending.has(key)) {
      result.push(line);
      continue;
    }

    if (written.has(key)) {
      continue;
    }

    written.add(key);
    const value = pending.get(key);
    if (value !== null && value !== undefined) {
      result.push(`${key}=${formatEnvValue(value)}`);
    }
  }

  const additions = [];
  for (const [key, value] of pending) {
    if (!written.has(key) && value !== null && value !== undefined) {
      additions.push(`${key}=${formatEnvValue(value)}`);
    }
  }

  while (result.length > 0 && result.at(-1) === "") {
    result.pop();
  }
  if (additions.length > 0 && result.length > 0) {
    result.push("");
  }
  result.push(...additions, "");
  return result.join(newline);
}

function isPrivateIpv4(address) {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function interfacePriority(name) {
  if (/^en0$/i.test(name)) return 0;
  if (/^en\d+$/i.test(name)) return 1;
  if (/^(?:wi-?fi|wlan\d*|ethernet)$/i.test(name)) return 2;
  if (/^eth\d+$/i.test(name)) return 3;
  return 10;
}

export function resolveLanHost(
  explicitHost,
  availableInterfaces = networkInterfaces(),
) {
  if (explicitHost) {
    if (!isPrivateIpv4(explicitHost)) {
      throw new Error(
        `--host must be a private IPv4 address, received: ${explicitHost}`,
      );
    }
    return explicitHost;
  }

  const candidates = [];
  for (const [name, entries] of Object.entries(availableInterfaces)) {
    if (!entries || VIRTUAL_INTERFACE_PATTERN.test(name)) continue;
    for (const entry of entries) {
      if (
        entry.family === "IPv4" &&
        !entry.internal &&
        isPrivateIpv4(entry.address)
      ) {
        candidates.push({
          address: entry.address,
          priority: interfacePriority(name),
        });
      }
    }
  }

  candidates.sort(
    (left, right) =>
      left.priority - right.priority ||
      left.address.localeCompare(right.address),
  );
  const host = candidates[0]?.address;
  if (!host) {
    throw new Error(
      "No private LAN IPv4 address was detected. Pass one with --host <address>.",
    );
  }
  return host;
}

function parseOriginList(value) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function originUsesHost(origin, host) {
  if (!host) return false;
  try {
    const url = new URL(origin);
    return url.hostname === host && url.port === "3001";
  } catch {
    return false;
  }
}

export function buildCorsOrigins(existingValue, previousLanHost, nextLanHost) {
  const origins = [
    ...LOCAL_CORS_ORIGINS,
    ...parseOriginList(existingValue).filter(
      (origin) => !originUsesHost(origin, previousLanHost),
    ),
  ];
  if (nextLanHost) {
    origins.push(`http://${nextLanHost}:3001`);
  }
  return [...new Set(origins)].join(",");
}

function readEnvironmentFile(filePath, fallback = "") {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : fallback;
}

function writeEnvironmentFile(filePath, content, updates) {
  writeFileSync(filePath, updateEnvContent(content, updates), "utf8");
}

function parseArguments(args) {
  const mode = args[0];
  let host;

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--host") {
      host = args[index + 1];
      index += 1;
    } else if (argument?.startsWith("--host=")) {
      host = argument.slice("--host=".length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return { mode, host };
}

function printStatus() {
  const rootEnv = readEnvironmentFile(rootEnvPath);
  const posWebEnv = readEnvironmentFile(posWebEnvPath);
  const posMobileEnv = readEnvironmentFile(posMobileEnvPath);
  const profile =
    readEnvValue(posWebEnv, "POS_DEV_PROFILE") ??
    readEnvValue(rootEnv, "POS_DEV_PROFILE") ??
    "not configured";

  console.log(`POS development profile: ${profile}`);
  console.log(
    `Browser API: ${readEnvValue(posWebEnv, "NEXT_PUBLIC_API_BASE_URL") ?? "not configured"}`,
  );
  console.log(
    `Native POS URL: ${readEnvValue(posMobileEnv, "CLEANHUB_POS_SERVER_URL") ?? "disabled for local profile"}`,
  );
}

function configure(mode, hostOverride) {
  if (mode !== "local" && mode !== "lan") {
    throw new Error("Expected profile: local or lan.");
  }

  const rootEnv = readEnvironmentFile(rootEnvPath);
  if (!rootEnv) {
    throw new Error("Root .env is missing. Copy .env.example to .env first.");
  }

  const posWebEnv = readEnvironmentFile(
    posWebEnvPath,
    "# Managed by pnpm pos:config:local / pos:config:lan.\n",
  );
  const posMobileEnv = readEnvironmentFile(
    posMobileEnvPath,
    "# Managed by pnpm pos:config:local / pos:config:lan.\n" +
      'CLEANHUB_POS_RUNTIME="development"\n' +
      'CLEANHUB_POS_ALLOW_CLEARTEXT="true"\n' +
      'CLEANHUB_POS_VERSION="0.1.0"\n' +
      'CLEANHUB_POS_BUILD_NUMBER="1"\n',
  );
  const previousApiUrl = readEnvValue(posWebEnv, "NEXT_PUBLIC_API_BASE_URL");
  let previousLanHost;
  try {
    const parsedHost = previousApiUrl ? new URL(previousApiUrl).hostname : "";
    previousLanHost = isPrivateIpv4(parsedHost) ? parsedHost : undefined;
  } catch {
    previousLanHost = undefined;
  }

  const lanHost =
    mode === "lan"
      ? resolveLanHost(hostOverride ?? process.env.POS_DEV_LAN_HOST)
      : undefined;
  const browserApiBaseUrl = lanHost
    ? `http://${lanHost}:4000`
    : "http://localhost:4000";
  const nativePosUrl = lanHost ? `http://${lanHost}:3001` : null;
  // Native Android does not use the POS Web origin. Its API client is
  // compiled into BuildConfig, so it must point to the API service directly.
  const nativeApiBaseUrl = lanHost ? `http://${lanHost}:4000` : null;
  const corsOrigins = buildCorsOrigins(
    readEnvValue(rootEnv, "CORS_ORIGINS"),
    previousLanHost,
    lanHost,
  );

  writeEnvironmentFile(rootEnvPath, rootEnv, {
    POS_DEV_PROFILE: mode,
    POS_DEV_LAN_HOST: lanHost ?? null,
    CORS_ORIGINS: corsOrigins,
  });
  writeEnvironmentFile(posWebEnvPath, posWebEnv, {
    POS_DEV_PROFILE: mode,
    POS_DEV_LAN_HOST: lanHost ?? null,
    NEXT_PUBLIC_API_BASE_URL: browserApiBaseUrl,
    POS_ALLOWED_DEV_ORIGINS: lanHost ?? null,
  });
  writeEnvironmentFile(posMobileEnvPath, posMobileEnv, {
    CLEANHUB_POS_RUNTIME: "development",
    CLEANHUB_POS_API_BASE_URL: nativeApiBaseUrl,
    CLEANHUB_POS_SERVER_URL: nativePosUrl,
    CLEANHUB_POS_ALLOW_CLEARTEXT: "true",
  });

  console.log(`Configured POS development profile: ${mode}`);
  console.log(`POS Web: ${nativePosUrl ?? "http://localhost:3001"}`);
  console.log(`Browser API: ${browserApiBaseUrl}`);
  if (lanHost) {
    console.log(`Detected LAN host: ${lanHost}`);
    console.log(
      "Run the Capacitor sync/build command again before installing the Android app.",
    );
  }
  console.log(
    "Restart both the API and POS Web dev servers to apply this profile.",
  );
}

const isMainModule = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  try {
    const { mode, host } = parseArguments(process.argv.slice(2));
    if (mode === "status") {
      printStatus();
    } else {
      configure(mode, host);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

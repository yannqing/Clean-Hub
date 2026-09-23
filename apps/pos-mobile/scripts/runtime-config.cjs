"use strict";

const LOOPBACK_HOSTS = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1"]);
const RESERVED_PRODUCTION_HOSTS = [
  "example.com",
  "example.net",
  "example.org",
];

function parseBoolean(value, name) {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  throw new Error(`${name} must be either "true" or "false".`);
}

function isReservedProductionHost(hostname) {
  const normalized = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(normalized) || normalized.endsWith(".localhost")) {
    return true;
  }

  return RESERVED_PRODUCTION_HOSTS.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  );
}

function normalizeServerUrl(value, { isProduction, allowCleartext, allowMissingServer }) {
  if (!value) {
    if (isProduction && !allowMissingServer) {
      throw new Error(
        "CLEANHUB_POS_SERVER_URL is required for a production POS shell.",
      );
    }

    return undefined;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CLEANHUB_POS_SERVER_URL must be a valid absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("CLEANHUB_POS_SERVER_URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("CLEANHUB_POS_SERVER_URL must not contain credentials.");
  }
  if (url.search || url.hash) {
    throw new Error(
      "CLEANHUB_POS_SERVER_URL must not contain query parameters or a fragment.",
    );
  }
  if (url.pathname !== "/") {
    throw new Error(
      "CLEANHUB_POS_SERVER_URL must be an origin URL without a path.",
    );
  }

  if (isProduction) {
    if (url.protocol !== "https:") {
      throw new Error("The production POS server URL must use HTTPS.");
    }
    if (isReservedProductionHost(url.hostname)) {
      throw new Error(
        "The production POS server URL must not use localhost or an example domain.",
      );
    }
  } else if (url.protocol === "http:" && !allowCleartext) {
    throw new Error(
      "Set CLEANHUB_POS_ALLOW_CLEARTEXT=true for LAN HTTP development.",
    );
  }

  return url.toString();
}

function resolvePosRuntimeConfig(environment, options = {}) {
  const rawRuntime = environment.CLEANHUB_POS_RUNTIME?.trim();
  const runtimeMode = (rawRuntime || "development").toLowerCase();

  if (runtimeMode !== "development" && runtimeMode !== "production") {
    throw new Error(
      'CLEANHUB_POS_RUNTIME must be either "development" or "production".',
    );
  }
  if (options.requireProduction && runtimeMode !== "production") {
    throw new Error(
      "Production POS preparation requires CLEANHUB_POS_RUNTIME=production.",
    );
  }

  const isProduction = runtimeMode === "production";
  const cleartextSetting = parseBoolean(
    environment.CLEANHUB_POS_ALLOW_CLEARTEXT,
    "CLEANHUB_POS_ALLOW_CLEARTEXT",
  );

  if (isProduction && cleartextSetting !== false) {
    throw new Error(
      "Production POS preparation requires CLEANHUB_POS_ALLOW_CLEARTEXT=false.",
    );
  }

  const allowCleartext = cleartextSetting === true;
  const serverUrl = normalizeServerUrl(
    environment.CLEANHUB_POS_SERVER_URL?.trim(),
    {
      isProduction,
      allowCleartext,
      allowMissingServer: options.allowMissingServer === true,
    },
  );

  return {
    runtimeMode,
    isProduction,
    allowCleartext,
    serverUrl,
  };
}

module.exports = {
  resolvePosRuntimeConfig,
};

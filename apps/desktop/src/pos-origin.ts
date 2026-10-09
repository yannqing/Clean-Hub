const defaultDevelopmentPosUrl = "http://localhost:3001";

const loopbackHosts = new Set([
  "0.0.0.0",
  "127.0.0.1",
  "::",
  "::1",
  "localhost",
  "localhost.localdomain",
]);

const reservedExampleHosts = ["example.com", "example.net", "example.org"];

export type PosOriginConfig = {
  url: string;
  origin: string;
};

function isReservedProductionHost(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[(.*)\]$/, "$1");

  if (
    loopbackHosts.has(normalized) ||
    normalized.startsWith("127.") ||
    normalized.startsWith("::ffff:7f") ||
    normalized.endsWith(".localhost")
  ) {
    return true;
  }

  if (
    normalized === "example" ||
    normalized.endsWith(".example") ||
    normalized === "invalid" ||
    normalized.endsWith(".invalid") ||
    normalized === "test" ||
    normalized.endsWith(".test")
  ) {
    return true;
  }

  return reservedExampleHosts.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  );
}

function parsePosOrigin(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CLEANHUB_POS_URL must be a valid absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("CLEANHUB_POS_URL must use HTTP or HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("CLEANHUB_POS_URL must not contain credentials.");
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "CLEANHUB_POS_URL must be an origin URL without a path, query, or fragment.",
    );
  }

  return url;
}

export function resolvePosOrigin(
  configuredValue: string | undefined,
  options: { isProduction: boolean },
): PosOriginConfig {
  const configuredUrl = configuredValue?.trim();

  if (!configuredUrl && options.isProduction) {
    throw new Error(
      "CLEANHUB_POS_URL is required for a production desktop POS shell.",
    );
  }

  const url = parsePosOrigin(configuredUrl || defaultDevelopmentPosUrl);

  if (options.isProduction) {
    if (url.protocol !== "https:") {
      throw new Error("Production CLEANHUB_POS_URL must use HTTPS.");
    }

    if (isReservedProductionHost(url.hostname)) {
      throw new Error(
        "Production CLEANHUB_POS_URL must not use localhost or an example domain.",
      );
    }
  }

  return {
    url: url.origin,
    origin: url.origin,
  };
}

export function isUrlFromPosOrigin(
  candidateValue: string,
  configuredOrigin: string,
): boolean {
  try {
    return new URL(candidateValue).origin === configuredOrigin;
  } catch {
    return false;
  }
}

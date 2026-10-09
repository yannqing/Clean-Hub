type ResolveCorsOriginInput = {
  origin: string | undefined;
  allowedOrigins: readonly string[];
  mobileNativeOrigins?: readonly string[];
  authClient?: string;
  enforceSameOrigin: boolean;
  requestUrl: string;
  forwardedProto?: string;
  forwardedHost?: string;
};

type ValidateUnsafeRequestOriginInput = ResolveCorsOriginInput & {
  method: string;
  secFetchSite?: string;
};

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isMobileNativeRequest(
  input: ResolveCorsOriginInput,
  normalizedOrigin: string,
): boolean {
  return (
    input.authClient?.trim().toLowerCase() === "mobile" &&
    input.mobileNativeOrigins?.includes(normalizedOrigin) === true
  );
}

function firstForwardedValue(value: string | undefined): string | undefined {
  return value?.split(",", 1)[0]?.trim();
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function resolvePublicRequestOrigin(input: {
  requestUrl: string;
  forwardedProto?: string;
  forwardedHost?: string;
}): string | null {
  const forwardedProto = firstForwardedValue(input.forwardedProto);
  const forwardedHost = firstForwardedValue(input.forwardedHost);

  if (
    forwardedProto &&
    forwardedHost &&
    (forwardedProto === "http" || forwardedProto === "https")
  ) {
    const forwardedOrigin = normalizeOrigin(
      `${forwardedProto}://${forwardedHost}`,
    );
    if (forwardedOrigin) return forwardedOrigin;
  }

  try {
    return new URL(input.requestUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Production browser traffic reaches the API through each frontend origin's
 * same-origin `/api` reverse proxy. Matching Origin to the forwarded public
 * request origin prevents sibling frontend domains from using one another's
 * host-only cookies through credentialed CORS.
 */
export function resolveCredentialedCorsOrigin(
  input: ResolveCorsOriginInput,
): string | null {
  if (!input.origin) return null;

  const normalizedOrigin = normalizeOrigin(input.origin);
  if (!normalizedOrigin || !input.allowedOrigins.includes(normalizedOrigin)) {
    return null;
  }

  if (!input.enforceSameOrigin) {
    return normalizedOrigin;
  }

  // Capacitor serves the signed mobile bundle from https://localhost while it
  // talks to the public API with bearer tokens. It cannot use the web apps'
  // same-origin reverse proxy, so allow this explicit mobile-client origin.
  if (isMobileNativeRequest(input, normalizedOrigin)) {
    return normalizedOrigin;
  }

  const requestOrigin = resolvePublicRequestOrigin(input);
  return requestOrigin === normalizedOrigin ? normalizedOrigin : null;
}

/**
 * CORS only controls whether browser JavaScript can read a response; it does
 * not prevent a cross-origin form or simple request from mutating state. In
 * production, reject unsafe browser requests before they reach a route when
 * their Origin (or Fetch Metadata fallback) is not same-origin with the public
 * reverse-proxy host.
 *
 * Requests without either browser header remain valid for trusted non-browser
 * clients and internal server-to-server calls.
 */
export function isUnsafeRequestOriginAllowed(
  input: ValidateUnsafeRequestOriginInput,
): boolean {
  if (
    !input.enforceSameOrigin ||
    !UNSAFE_METHODS.has(input.method.toUpperCase())
  ) {
    return true;
  }

  if (!input.origin && !input.secFetchSite) {
    return true;
  }

  if (input.origin) {
    const normalizedOrigin = normalizeOrigin(input.origin);
    if (normalizedOrigin && isMobileNativeRequest(input, normalizedOrigin)) {
      return true;
    }

    const requestOrigin = resolvePublicRequestOrigin(input);
    if (!requestOrigin || !input.allowedOrigins.includes(requestOrigin)) {
      return false;
    }

    return (
      normalizedOrigin !== null &&
      input.allowedOrigins.includes(normalizedOrigin) &&
      normalizedOrigin === requestOrigin
    );
  }

  const requestOrigin = resolvePublicRequestOrigin(input);
  if (!requestOrigin || !input.allowedOrigins.includes(requestOrigin)) {
    return false;
  }

  return input.secFetchSite?.trim().toLowerCase() === "same-origin";
}

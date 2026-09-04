const POS_FALLBACK_PATH = "/";
const POS_LOCAL_ORIGIN = "http://pos.local";
const POS_LOCK_RETURN_STORAGE_KEY = "cleanhub.pos.lock-return.v1";

export type PosLockReturnState = {
  path: string;
  userId: string;
};

function isBlockedReturnPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname.startsWith("/setup/")
  );
}

/**
 * Accept only same-origin POS paths and normalize malformed or non-operating
 * destinations back to the workspace. This value is safe to pass through the
 * public login URL and use with Next.js router navigation after PIN unlock.
 */
export function resolvePosReturnPath(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return POS_FALLBACK_PATH;
  }

  try {
    const parsed = new URL(path, POS_LOCAL_ORIGIN);

    if (
      parsed.origin !== POS_LOCAL_ORIGIN ||
      isBlockedReturnPath(parsed.pathname)
    ) {
      return POS_FALLBACK_PATH;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return POS_FALLBACK_PATH;
  }
}

export function buildPosLoginPath(
  returnPath: string | null,
  options: { locked?: boolean } = {},
): string {
  const search = new URLSearchParams({
    next: resolvePosReturnPath(returnPath),
  });

  if (options.locked) {
    search.set("locked", "1");
  }

  return `/login?${search.toString()}`;
}

export function resolveLockedPosReturnPath(
  requestedPath: string | null,
  authenticatedUserId: string,
  state: PosLockReturnState | null,
): string {
  const safeRequestedPath = resolvePosReturnPath(requestedPath);

  if (
    !state ||
    !authenticatedUserId ||
    state.userId !== authenticatedUserId ||
    resolvePosReturnPath(state.path) !== safeRequestedPath
  ) {
    return POS_FALLBACK_PATH;
  }

  return safeRequestedPath;
}

export function savePosLockReturnState(
  userId: string | null,
  returnPath: string | null,
): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  const state: PosLockReturnState = {
    path: resolvePosReturnPath(returnPath),
    userId,
  };

  try {
    window.sessionStorage.setItem(
      POS_LOCK_RETURN_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // A disabled storage implementation must fail closed: without an identity
    // binding, the next employee is sent to the workspace after PIN login.
  }
}

function consumePosLockReturnState(): PosLockReturnState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(POS_LOCK_RETURN_STORAGE_KEY);
    window.sessionStorage.removeItem(POS_LOCK_RETURN_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PosLockReturnState>;

    if (typeof parsed.path !== "string" || typeof parsed.userId !== "string") {
      return null;
    }

    return { path: parsed.path, userId: parsed.userId };
  } catch {
    return null;
  }
}

export function resolvePosPostLoginPath(
  search: string,
  authenticatedUserId: string,
): string {
  const params = new URLSearchParams(search);
  const requestedPath = params.get("next");

  if (params.get("locked") !== "1") {
    return resolvePosReturnPath(requestedPath);
  }

  return resolveLockedPosReturnPath(
    requestedPath,
    authenticatedUserId,
    consumePosLockReturnState(),
  );
}

/**
 * Per-terminal tenant binding.
 *
 * A POS terminal is single-store hardware. The tenant code (pressing_code) is
 * fixed at the terminal, not entered per login — so it is sourced from the
 * POS_TENANT_CODE env var (set in .env for web, injected by the Electron main
 * process or Capacitor native layer for packaged builds).
 *
 * Cookie name and API base URL stay shared across web-admin and pos-web; only
 * this value is POS-specific.
 */

const FALLBACK_TENANT_CODE = "";

function readTenantCode(): string {
  const value =
    process.env.POS_TENANT_CODE ??
    process.env.NEXT_PUBLIC_POS_TENANT_CODE ??
    FALLBACK_TENANT_CODE;
  return value.trim();
}

/**
 * Resolved tenant code for this terminal. Empty string when not configured —
 * callers should surface a clear error rather than sending an empty login.
 */
export const posTenantCode = readTenantCode();

export function isTenantConfigured(): boolean {
  return posTenantCode.length > 0;
}

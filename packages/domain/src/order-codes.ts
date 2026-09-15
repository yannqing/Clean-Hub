export const POS_ORDER_CODE_PREFIX = "OD-";
export const POS_ORDER_CODE_SUFFIX_LENGTH = 8;
export const POS_ORDER_QR_PREFIX = "CH1:ORDER:";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

const POS_ORDER_CODE_PATTERN = new RegExp(
  `^${POS_ORDER_CODE_PREFIX}[0-9A-HJKMNP-TV-Z]{${POS_ORDER_CODE_SUFFIX_LENGTH}}$`,
  "i",
);

export function formatPosOrderCode(orderId: string): string {
  return `${POS_ORDER_CODE_PREFIX}${orderId
    .slice(-POS_ORDER_CODE_SUFFIX_LENGTH)
    .toUpperCase()}`;
}

export function parsePosOrderCodeSuffix(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (!POS_ORDER_CODE_PATTERN.test(normalized)) {
    return null;
  }

  return normalized.slice(POS_ORDER_CODE_PREFIX.length);
}

export function isPosOrderLookupQuery(value: string): boolean {
  const normalized = value.trim();
  return (
    parsePosOrderCodeSuffix(normalized) !== null ||
    /^[0-9A-HJKMNP-TV-Z]{20,26}$/i.test(normalized)
  );
}

/**
 * Stable, app-owned payload printed as a QR code on a finalized receipt.
 * It is deliberately not a URL: the POS decides the only permitted route,
 * and the order API still enforces tenant and branch access on page load.
 */
export function formatPosOrderQrPayload(orderId: string): string {
  const normalized = orderId.trim().toUpperCase();
  if (!ULID_PATTERN.test(normalized)) {
    throw new Error("A valid ULID order id is required for the receipt QR code.");
  }
  return `${POS_ORDER_QR_PREFIX}${normalized}`;
}

export function parsePosOrderQrPayload(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized.startsWith(POS_ORDER_QR_PREFIX)) {
    return null;
  }

  const orderId = normalized.slice(POS_ORDER_QR_PREFIX.length);
  return ULID_PATTERN.test(orderId) ? orderId : null;
}

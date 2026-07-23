export const POS_ORDER_CODE_PREFIX = "OD-";
export const POS_ORDER_CODE_SUFFIX_LENGTH = 8;

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

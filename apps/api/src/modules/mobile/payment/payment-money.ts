export function amountToCents(value: string): bigint {
  const normalized = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);

  if (!match) {
    throw new Error("Invalid money amount.");
  }

  const sign = match[1] === "-" ? BigInt(-1) : BigInt(1);
  const units = BigInt(match[2] ?? "0") * BigInt(100);
  const cents = BigInt((match[3] ?? "").padEnd(2, "0"));

  return sign * (units + cents);
}

export function centsToAmount(value: bigint): string {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const units = absolute / BigInt(100);
  const cents = absolute % BigInt(100);

  return `${negative ? "-" : ""}${units.toString()}.${cents
    .toString()
    .padStart(2, "0")}`;
}

export function addAmounts(left: string, right: string): string {
  return centsToAmount(amountToCents(left) + amountToCents(right));
}

export function subtractAmounts(left: string, right: string): string {
  return centsToAmount(amountToCents(left) - amountToCents(right));
}

export function isPositiveAmount(value: string): boolean {
  return amountToCents(value) > BigInt(0);
}

export function compareAmounts(left: string, right: string): -1 | 0 | 1 {
  const leftCents = amountToCents(left);
  const rightCents = amountToCents(right);

  if (leftCents < rightCents) {
    return -1;
  }

  if (leftCents > rightCents) {
    return 1;
  }

  return 0;
}

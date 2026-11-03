function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isNormalizedEmailUniqueViolation(
  error: unknown,
  seen = new Set<unknown>(),
): boolean {
  if (!isRecord(error) || seen.has(error)) {
    return false;
  }

  seen.add(error);

  const constraint = error.constraint;
  const detail = error.detail;

  if (
    error.code === "23505" &&
    ((typeof constraint === "string" &&
      constraint === "users_normalized_email_unique") ||
      (typeof detail === "string" &&
        detail.toLowerCase().includes("normalized_email")))
  ) {
    return true;
  }

  return isNormalizedEmailUniqueViolation(error.cause, seen);
}

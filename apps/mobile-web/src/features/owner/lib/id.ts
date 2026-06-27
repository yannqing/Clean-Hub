export function createOwnerLocalId(timestamp = Date.now()): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);

  return `owner_${timestamp.toString(36)}_${randomPart}`;
}

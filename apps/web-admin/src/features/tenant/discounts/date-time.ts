function zonedDateTimeParts(date: Date, timeZone: string) {
  const fallbackTimeZone = timeZone || "UTC";

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: fallbackTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    return Object.fromEntries(parts.map((part) => [part.type, part.value]));
  } catch {
    return zonedDateTimeParts(date, "UTC");
  }
}

export function formatDiscountDateTimeLocal(
  value: string | Date,
  timeZone: string,
): string {
  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) return "";

  const parts = zonedDateTimeParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function discountDateTimeLocalToIso(
  value: string,
  timeZone: string,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value.trim(),
  );

  if (!match) return null;

  const targetUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  let candidate = targetUtc;

  for (let index = 0; index < 3; index += 1) {
    const parts = zonedDateTimeParts(new Date(candidate), timeZone);
    const representedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const difference = targetUtc - representedUtc;
    candidate += difference;

    if (difference === 0) break;
  }

  const date = new Date(candidate);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export const DEFAULT_TIME_ZONE = "UTC";

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
};

export function isSupportedTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 64) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(value: unknown): string {
  return isSupportedTimeZone(value) ? value.trim() : DEFAULT_TIME_ZONE;
}

export function getDateOnlyInTimeZone(
  date: Date,
  timeZone: string,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(value: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, Number(part.value)]),
  );
  const representedAsUtc = Date.UTC(
    values.year!,
    values.month! - 1,
    values.day!,
    values.hour!,
    values.minute!,
    values.second!,
  );

  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function zonedDateTimeToUtc(
  parts: ZonedDateTimeParts,
  timeZone: string,
): Date {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
    parts.millisecond ?? 0,
  );
  let instant = localAsUtc;

  // Re-evaluate once because the first guess may sit on the other side of a
  // daylight-saving transition from the requested local wall-clock time.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    instant =
      localAsUtc -
      getTimeZoneOffsetMilliseconds(new Date(instant), resolvedTimeZone);
  }

  return new Date(instant);
}

export function calendarDateStartToUtc(
  value: string,
  timeZone: string,
): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }

  return zonedDateTimeToUtc(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    },
    timeZone,
  );
}

export function calendarDateEndToUtc(
  value: string,
  timeZone: string,
): Date {
  const nextDayStart = calendarDateStartToUtc(
    addCalendarDays(value, 1),
    timeZone,
  );

  return new Date(nextDayStart.getTime() - 1);
}

export function getUtcDayRangeInTimeZone(
  value: string,
  timeZone: string,
): { from: Date; to: Date } {
  return {
    from: calendarDateStartToUtc(value, timeZone),
    to: calendarDateStartToUtc(addCalendarDays(value, 1), timeZone),
  };
}

export function dateTimeLocalToUtc(
  value: string,
  timeZone: string,
): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
      value,
    );
  if (!match) {
    return null;
  }

  const instant = zonedDateTimeToUtc(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: Number(match[6] ?? 0),
    },
    timeZone,
  );

  return toDateTimeLocalValue(instant, timeZone) === value.slice(0, 16)
    ? instant
    : null;
}

export function toDateTimeLocalValue(
  value: string | Date,
  timeZone: string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

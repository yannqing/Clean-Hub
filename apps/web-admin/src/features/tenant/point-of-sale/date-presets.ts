export type PointOfSaleDatePresetId =
  | "today"
  | "last7Days"
  | "last30Days"
  | "last90Days"
  | "thisMonth"
  | "lastMonth";

export type PointOfSaleDateRange = {
  from: string;
  to: string;
};

export const pointOfSaleDatePresets: PointOfSaleDatePresetId[] = [
  "today",
  "last7Days",
  "last30Days",
  "last90Days",
  "thisMonth",
  "lastMonth",
];

export const DEFAULT_POINT_OF_SALE_DATE_PRESET: PointOfSaleDatePresetId =
  "last30Days";

function toUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateOnlyInTimeZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    if (values.year && values.month && values.day) {
      return `${values.year}-${values.month}-${values.day}`;
    }
  } catch {
    // Invalid tenant timezones use the API's UTC fallback.
  }

  return toUtcDateOnly(date);
}

function calendarDate(date: Date, timeZone: string): Date {
  return new Date(`${dateOnlyInTimeZone(date, timeZone)}T00:00:00.000Z`);
}

function rollingRange(
  days: number,
  now: Date,
  timeZone: string,
): PointOfSaleDateRange {
  const end = calendarDate(now, timeZone);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return {
    from: toUtcDateOnly(start),
    to: toUtcDateOnly(end),
  };
}

export function resolvePointOfSaleDatePreset(
  preset: PointOfSaleDatePresetId,
  now: Date = new Date(),
  timeZone = "UTC",
): PointOfSaleDateRange {
  const current = calendarDate(now, timeZone);

  switch (preset) {
    case "today": {
      const today = toUtcDateOnly(current);
      return { from: today, to: today };
    }
    case "last7Days":
      return rollingRange(7, now, timeZone);
    case "last30Days":
      return rollingRange(30, now, timeZone);
    case "last90Days":
      return rollingRange(90, now, timeZone);
    case "thisMonth": {
      const start = new Date(current);
      start.setUTCDate(1);
      return { from: toUtcDateOnly(start), to: toUtcDateOnly(current) };
    }
    case "lastMonth": {
      const thisMonthStart = new Date(current);
      thisMonthStart.setUTCDate(1);
      const start = new Date(thisMonthStart);
      start.setUTCMonth(start.getUTCMonth() - 1);
      const end = new Date(thisMonthStart);
      end.setUTCDate(end.getUTCDate() - 1);
      return { from: toUtcDateOnly(start), to: toUtcDateOnly(end) };
    }
  }
}

export function resolveSelectedPointOfSaleDatePreset(
  range: Partial<PointOfSaleDateRange>,
  now: Date = new Date(),
  timeZone = "UTC",
): PointOfSaleDatePresetId {
  for (const preset of pointOfSaleDatePresets) {
    const candidate = resolvePointOfSaleDatePreset(preset, now, timeZone);

    if (candidate.from === range.from && candidate.to === range.to) {
      return preset;
    }
  }

  return DEFAULT_POINT_OF_SALE_DATE_PRESET;
}

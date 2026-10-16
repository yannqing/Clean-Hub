import type { FinanceSummaryQuery } from "./types";

export type FinanceDatePresetId =
  | "today"
  | "last7Days"
  | "last30Days"
  | "last90Days"
  | "thisMonth"
  | "lastMonth";

export const financeDatePresets: FinanceDatePresetId[] = [
  "today",
  "last7Days",
  "last30Days",
  "last90Days",
  "thisMonth",
  "lastMonth",
];

export const DEFAULT_FINANCE_DATE_PRESET: FinanceDatePresetId = "last30Days";

function toUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toDateOnlyInTimeZone(date: Date, timeZone: string): string {
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
    // Invalid tenant timezones fall back to UTC, matching the API fallback.
  }

  return toUtcDateOnly(date);
}

function resolveCalendarDate(date: Date, timeZone: string): Date {
  return new Date(`${toDateOnlyInTimeZone(date, timeZone)}T00:00:00.000Z`);
}

function rollingRange(
  days: number,
  now: Date,
  timeZone: string,
): Pick<FinanceSummaryQuery, "from" | "to"> {
  const end = resolveCalendarDate(now, timeZone);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return {
    from: toUtcDateOnly(start),
    to: toUtcDateOnly(end),
  };
}

export function resolveFinanceDatePreset(
  id: FinanceDatePresetId,
  now: Date = new Date(),
  timeZone = "UTC",
): Pick<FinanceSummaryQuery, "from" | "to"> {
  const calendarNow = resolveCalendarDate(now, timeZone);

  switch (id) {
    case "today": {
      const today = toUtcDateOnly(calendarNow);
      return { from: today, to: today };
    }
    case "last7Days":
      return rollingRange(7, now, timeZone);
    case "last30Days":
      return rollingRange(30, now, timeZone);
    case "last90Days":
      return rollingRange(90, now, timeZone);
    case "thisMonth": {
      const start = new Date(calendarNow);
      start.setUTCDate(1);
      return {
        from: toUtcDateOnly(start),
        to: toUtcDateOnly(calendarNow),
      };
    }
    case "lastMonth": {
      const thisMonthStart = new Date(calendarNow);
      thisMonthStart.setUTCDate(1);
      const lastMonthStart = new Date(thisMonthStart);
      lastMonthStart.setUTCMonth(lastMonthStart.getUTCMonth() - 1);
      const lastMonthEnd = new Date(thisMonthStart);
      lastMonthEnd.setUTCDate(lastMonthEnd.getUTCDate() - 1);
      return {
        from: toUtcDateOnly(lastMonthStart),
        to: toUtcDateOnly(lastMonthEnd),
      };
    }
  }
}

export function resolveSelectedFinanceDatePreset(
  query: Pick<FinanceSummaryQuery, "from" | "to">,
  now: Date = new Date(),
  timeZone = "UTC",
): FinanceDatePresetId | "custom" {
  for (const preset of financeDatePresets) {
    const range = resolveFinanceDatePreset(preset, now, timeZone);

    if (range.from === query.from && range.to === query.to) {
      return preset;
    }
  }

  return "custom";
}

import type { ReportSummaryQuery } from "./types";

export type ReportDatePresetId =
  | "today"
  | "last7Days"
  | "last30Days"
  | "last90Days"
  | "thisMonth"
  | "lastMonth";

/**
 * A report date-range preset.
 *
 * `label` is intentionally empty here — labels live in the i18n catalog so the
 * preset dropdown renders in the active locale. The view maps `id` to its
 * localized label.
 */
export type ReportDatePreset = {
  id: ReportDatePresetId;
  label: string;
};

export const reportDatePresets: ReportDatePreset[] = [
  { id: "today", label: "" },
  { id: "last7Days", label: "" },
  { id: "last30Days", label: "" },
  { id: "last90Days", label: "" },
  { id: "thisMonth", label: "" },
  { id: "lastMonth", label: "" },
];

export const DEFAULT_REPORT_DATE_PRESET: ReportDatePresetId = "last30Days";

/** Format a Date as a `YYYY-MM-DD` string using the report API's UTC boundary. */
function toDateOnly(date: Date): string {
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
    // Invalid tenant timezones fall back to the API's UTC boundary.
  }

  return toDateOnly(date);
}

function resolveCalendarDate(date: Date, timeZone: string): Date {
  return new Date(`${toDateOnlyInTimeZone(date, timeZone)}T00:00:00.000Z`);
}

function startOfMonth(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(1);
  return next;
}

function rollingRange(
  days: number,
  now: Date,
  timeZone: string,
): Pick<ReportSummaryQuery, "from" | "to"> {
  const end = resolveCalendarDate(now, timeZone);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return {
    from: toDateOnly(start),
    to: toDateOnly(end),
  };
}

/**
 * Resolve a preset to a `{ from, to }` date-only pair (inclusive) anchored to
 * the supplied `now` (defaults to the current time). Returns `undefined` for an
 * unknown preset id so callers can no-op safely.
 */
export function resolveReportDatePreset(
  id: ReportDatePresetId,
  now: Date = new Date(),
  timeZone = "UTC",
): Pick<ReportSummaryQuery, "from" | "to"> | undefined {
  const calendarNow = resolveCalendarDate(now, timeZone);

  switch (id) {
    case "today": {
      const today = toDateOnly(calendarNow);
      return { from: today, to: today };
    }
    case "last7Days": {
      return rollingRange(7, now, timeZone);
    }
    case "last30Days": {
      return rollingRange(30, now, timeZone);
    }
    case "last90Days": {
      return rollingRange(90, now, timeZone);
    }
    case "thisMonth": {
      return {
        from: toDateOnly(startOfMonth(calendarNow)),
        to: toDateOnly(calendarNow),
      };
    }
    case "lastMonth": {
      const thisMonthStart = startOfMonth(calendarNow);
      const lastMonthStart = new Date(thisMonthStart);
      lastMonthStart.setUTCMonth(lastMonthStart.getUTCMonth() - 1);
      const lastMonthEnd = new Date(thisMonthStart);
      lastMonthEnd.setUTCDate(lastMonthEnd.getUTCDate() - 1);
      return { from: toDateOnly(lastMonthStart), to: toDateOnly(lastMonthEnd) };
    }
    default: {
      return undefined;
    }
  }
}

export function resolveSelectedReportDatePreset(
  query: Pick<ReportSummaryQuery, "from" | "to">,
  now: Date = new Date(),
  timeZone = "UTC",
): ReportDatePresetId | "custom" {
  for (const preset of reportDatePresets) {
    const range = resolveReportDatePreset(preset.id, now, timeZone);

    if (range?.from === query.from && range?.to === query.to) {
      return preset.id;
    }
  }

  return "custom";
}

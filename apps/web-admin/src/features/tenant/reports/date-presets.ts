import type { ReportSummaryQuery } from "./types";

export type ReportDatePresetId =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
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
  { id: "yesterday", label: "" },
  { id: "thisWeek", label: "" },
  { id: "lastWeek", label: "" },
  { id: "thisMonth", label: "" },
  { id: "lastMonth", label: "" },
];

/** Format a Date as a `YYYY-MM-DD` string in its local timezone. */
function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date): Date {
  // Week starts on Monday.
  const next = startOfDay(date);
  const day = next.getDay(); // 0 = Sun ... 6 = Sat
  const diff = (day + 6) % 7; // Mon=0 ... Sun=6
  next.setDate(next.getDate() - diff);
  return next;
}

function startOfMonth(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(1);
  return next;
}

/**
 * Resolve a preset to a `{ from, to }` date-only pair (inclusive) anchored to
 * the supplied `now` (defaults to the current time). Returns `undefined` for an
 * unknown preset id so callers can no-op safely.
 */
export function resolveReportDatePreset(
  id: ReportDatePresetId,
  now: Date = new Date(),
): Pick<ReportSummaryQuery, "from" | "to"> | undefined {
  switch (id) {
    case "today": {
      const today = toDateOnly(now);
      return { from: today, to: today };
    }
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const value = toDateOnly(yesterday);
      return { from: value, to: value };
    }
    case "thisWeek": {
      return { from: toDateOnly(startOfWeek(now)), to: toDateOnly(now) };
    }
    case "lastWeek": {
      const thisWeekStart = startOfWeek(now);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      return { from: toDateOnly(lastWeekStart), to: toDateOnly(lastWeekEnd) };
    }
    case "thisMonth": {
      return { from: toDateOnly(startOfMonth(now)), to: toDateOnly(now) };
    }
    case "lastMonth": {
      const thisMonthStart = startOfMonth(now);
      const lastMonthStart = new Date(thisMonthStart);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      const lastMonthEnd = new Date(thisMonthStart);
      lastMonthEnd.setDate(lastMonthEnd.getDate() - 1);
      return { from: toDateOnly(lastMonthStart), to: toDateOnly(lastMonthEnd) };
    }
    default: {
      return undefined;
    }
  }
}

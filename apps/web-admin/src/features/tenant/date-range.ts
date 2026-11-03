import {
  addCalendarDays,
  calendarDateStartToUtc,
  getDateOnlyInTimeZone,
  getUtcDayRangeInTimeZone,
} from "@cleanhub/domain/timezone";

export type TenantStandardDateFilter =
  | "all"
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_365_days";

export function buildTenantCreatedAtDateRange(
  filter: TenantStandardDateFilter,
  timeZone: string,
): { createdAfter?: string; createdBefore?: string } {
  if (filter === "all") {
    return {};
  }

  const today = getDateOnlyInTimeZone(new Date(), timeZone);

  if (filter === "today") {
    const range = getUtcDayRangeInTimeZone(today, timeZone);
    return {
      createdAfter: range.from.toISOString(),
      createdBefore: range.to.toISOString(),
    };
  }

  const days = {
    last_7_days: 7,
    last_30_days: 30,
    last_365_days: 365,
  }[filter];

  return {
    createdAfter: calendarDateStartToUtc(
      addCalendarDays(today, -(days - 1)),
      timeZone,
    ).toISOString(),
  };
}

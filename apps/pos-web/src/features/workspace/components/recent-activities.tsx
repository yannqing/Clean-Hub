"use client";

import { useEffect, useState } from "react";

import type {
  PosRecentActivity,
  PosRecentActivityType,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import Link from "next/link";

import { Icon, type PosIconName } from "@/components/app-shell/icons";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";

const ACTIVITY_META: Record<
  PosRecentActivityType,
  { badge: string; icon: PosIconName; iconStyle: string; label: string; time: string }
> = {
  order: {
    badge:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/35 dark:text-orange-300",
    iconStyle:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/35 dark:text-orange-300",
    label: "订单",
    icon: "receipt",
    time: "bg-orange-50 text-orange-700 dark:bg-orange-950/35 dark:text-orange-300",
  },
  ticket: {
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-300",
    iconStyle:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-300",
    label: "工单",
    icon: "clipboard-list",
    time: "bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300",
  },
  customer: {
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300",
    iconStyle:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300",
    label: "客户",
    icon: "users",
    time:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300",
  },
  payment: {
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-300",
    iconStyle:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-300",
    label: "支付",
    icon: "wallet-cards",
    time: "bg-sky-50 text-sky-700 dark:bg-sky-950/35 dark:text-sky-300",
  },
};

function formatActivityCount(count: number, locale: string): string {
  const value = new Intl.NumberFormat(locale).format(count);

  if (locale === "en") {
    return `${value} latest`;
  }

  if (locale === "fr") {
    return `${value} récentes`;
  }

  return `最近 ${value} 条`;
}

function formatRelativeTime(
  timestamp: string,
  locale: string,
  now: number | null,
  timeZone: string,
): string {
  if (now === null) {
    return "—";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffMin < 1) {
    return formatter.format(0, "minute");
  }

  if (diffMin < 60) {
    return formatter.format(-diffMin, "minute");
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return formatter.format(-diffHour, "hour");
  }

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return formatter.format(-diffDay, "day");
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}

function getMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

function getActivityHref(activity: PosRecentActivity): string | null {
  if (activity.type === "order") {
    const orderId = getMetadataString(activity.metadata, "orderId");
    return orderId ? `/orders/${orderId}` : "/orders";
  }

  if (activity.type === "ticket") {
    const ticketId = getMetadataString(activity.metadata, "ticketId");
    return ticketId ? `/tickets/${ticketId}` : "/tickets";
  }

  if (activity.type === "customer") {
    const customerId = getMetadataString(activity.metadata, "customerId");
    return customerId ? `/customers/${customerId}` : "/customers";
  }

  return null;
}

function SectionHeader({
  activityCount,
  locale,
}: {
  activityCount: number;
  locale: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" name="chart" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">最近活动</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            按时间倒序展示最近业务变化
          </p>
        </div>
      </div>
      {activityCount > 0 ? (
        <span className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs font-semibold text-muted-foreground">
          {formatActivityCount(activityCount, locale)}
        </span>
      ) : null}
    </div>
  );
}

function EmptyActivities() {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-300">
        <Icon className="h-6 w-6" name="clock" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">暂无最近活动</p>
      <p className="mt-1 text-xs text-muted-foreground">
        最近的操作记录会显示在这里
      </p>
    </div>
  );
}

function ActivityContent({
  activity,
  formattedTime,
}: {
  activity: PosRecentActivity;
  formattedTime: string;
}) {
  const meta = ACTIVITY_META[activity.type] ?? {
    badge: "border-border bg-muted text-muted-foreground",
    label: activity.type,
    icon: "clipboard-list" as PosIconName,
    iconStyle: "border-border bg-muted text-muted-foreground",
    time: "bg-muted text-muted-foreground",
  };

  return (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.iconStyle}`}>
        <Icon className="h-5 w-5" name={meta.icon} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {activity.title}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
          >
            {meta.label}
          </span>
        </span>
        {activity.description ? (
          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
            {activity.description}
          </span>
        ) : null}
      </span>

      <span
        className={`inline-flex max-w-28 shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums ${meta.time}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" name="clock" />
        <span className="truncate">{formattedTime}</span>
      </span>
    </>
  );
}

function ActivityItem({
  activity,
  formattedTime,
}: {
  activity: PosRecentActivity;
  formattedTime: string;
}) {
  const href = getActivityHref(activity);
  const className =
    "group flex min-h-20 items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4";

  if (!href) {
    return (
      <article className={className}>
        <ActivityContent activity={activity} formattedTime={formattedTime} />
        <span className="hidden h-8 w-8 shrink-0 sm:block" />
      </article>
    );
  }

  return (
    <Link className={className} href={href}>
      <ActivityContent activity={activity} formattedTime={formattedTime} />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground">
        <Icon
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          name="chevron-right"
        />
      </span>
    </Link>
  );
}

export function RecentActivities({
  activities,
}: {
  activities: PosRecentActivity[];
}) {
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setNow(Date.now());
    }, 0);

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="space-y-4">
      <SectionHeader activityCount={activities.length} locale={locale} />

      {activities.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <EmptyActivities />
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {activities.map((activity) => (
            <ActivityItem
              activity={activity}
              formattedTime={formatRelativeTime(
                activity.timestamp,
                locale,
                now,
                timeZone,
              )}
              key={activity.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

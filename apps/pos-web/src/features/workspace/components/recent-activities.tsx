"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import type {
  PosRecentActivity,
  PosRecentActivityType,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import Link from "next/link";

import { Icon, type PosIconName } from "@/components/app-shell/icons";

const ACTIVITY_META: Record<
  PosRecentActivityType,
  { label: string; color: string; icon: PosIconName }
> = {
  order: {
    label: "订单",
    color: "var(--chart-1)",
    icon: "receipt",
  },
  ticket: {
    label: "工单",
    color: "var(--chart-4)",
    icon: "clipboard-list",
  },
  customer: {
    label: "客户",
    color: "var(--chart-2)",
    icon: "users",
  },
  payment: {
    label: "支付",
    color: "var(--chart-5)",
    icon: "wallet-cards",
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
  }).format(date);
}

function iconAccentStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklch, ${color} 12%, white)`,
    borderColor: `color-mix(in oklch, ${color} 22%, white)`,
    color,
  };
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
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-white">
          <Icon className="h-4 w-4" name="chart" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">最近活动</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            按时间倒序展示最近业务变化
          </p>
        </div>
      </div>
      {activityCount > 0 ? (
        <span className="inline-flex h-8 items-center rounded-md bg-slate-100 px-3 text-xs font-semibold text-slate-600">
          {formatActivityCount(activityCount, locale)}
        </span>
      ) : null}
    </div>
  );
}

function EmptyActivities() {
  return (
    <div className="border-y border-dashed border-slate-300 bg-white p-8 text-center">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border"
        style={iconAccentStyle("var(--chart-3)")}
      >
        <Icon className="h-6 w-6" name="clock" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">暂无最近活动</p>
      <p className="mt-1 text-xs text-slate-500">最近的操作记录会显示在这里</p>
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
    label: activity.type,
    color: "var(--chart-3)",
    icon: "clipboard-list" as PosIconName,
  };

  return (
    <div className="flex min-w-0 gap-3">
      <span
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
        style={iconAccentStyle(meta.color)}
      >
        <Icon className="h-5 w-5" name={meta.icon} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            {meta.label}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
            <Icon className="h-3.5 w-3.5" name="clock" />
            {formattedTime}
          </span>
        </div>
        <h3 className="mt-1 truncate text-sm font-semibold text-slate-950">
          {activity.title}
        </h3>
        {activity.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
            {activity.description}
          </p>
        ) : null}
      </div>
    </div>
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
    "group block border-b border-slate-100 p-4 transition last:border-b-0 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300";

  if (!href) {
    return (
      <article className={className}>
        <ActivityContent activity={activity} formattedTime={formattedTime} />
      </article>
    );
  }

  return (
    <Link className={className} href={href}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <ActivityContent activity={activity} formattedTime={formattedTime} />
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition group-hover:bg-white group-hover:text-slate-700">
          <Icon className="h-4 w-4" name="chevron-right" />
        </span>
      </div>
    </Link>
  );
}

export function RecentActivities({
  activities,
}: {
  activities: PosRecentActivity[];
}) {
  const { locale } = useTranslation();
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
        <EmptyActivities />
      ) : (
        <div className="overflow-hidden border-y border-slate-200 bg-white">
          {activities.map((activity) => (
            <ActivityItem
              activity={activity}
              formattedTime={formatRelativeTime(
                activity.timestamp,
                locale,
                now,
              )}
              key={activity.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

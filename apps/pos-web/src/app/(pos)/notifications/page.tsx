import { Suspense } from "react";
import type {
  PosNoticePriority,
  PosNoticeReadStatus,
  PosNoticeRelatedType,
  PosNoticeType,
  PosNotificationListQuery,
} from "@cleanhub/api-client";

import { NotificationsCenter } from "@/features/notifications/components";
import {
  DEFAULT_NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_FILTER_KEYS,
} from "@/features/notifications/constants";
import {
  getNotificationsListQuery,
  getNotificationsOverviewQuery,
} from "@/features/notifications/queries";

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTICE_TYPES: ReadonlySet<string> = new Set(["business", "system"]);
const READ_STATUSES: ReadonlySet<string> = new Set([
  "unread",
  "read",
  "archived",
]);
const PRIORITIES: ReadonlySet<string> = new Set([
  "low",
  "normal",
  "high",
  "critical",
]);
const RELATED_TYPES: ReadonlySet<string> = new Set(["order", "ticket"]);

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function buildNotificationQuery(
  params: Record<string, string | string[] | undefined>,
): PosNotificationListQuery {
  const q = getParam(params, NOTIFICATION_FILTER_KEYS.q)?.trim() || undefined;
  const noticeType = getParam(params, NOTIFICATION_FILTER_KEYS.noticeType);
  const readStatus = getParam(params, NOTIFICATION_FILTER_KEYS.readStatus);
  const priority = getParam(params, NOTIFICATION_FILTER_KEYS.priority);
  const relatedType = getParam(params, NOTIFICATION_FILTER_KEYS.relatedType);

  return {
    q,
    noticeType: NOTICE_TYPES.has(noticeType ?? "")
      ? (noticeType as PosNoticeType)
      : undefined,
    readStatus: READ_STATUSES.has(readStatus ?? "")
      ? (readStatus as PosNoticeReadStatus)
      : undefined,
    priority: PRIORITIES.has(priority ?? "")
      ? (priority as PosNoticePriority)
      : undefined,
    relatedType: RELATED_TYPES.has(relatedType ?? "")
      ? (relatedType as PosNoticeRelatedType)
      : undefined,
    limit: DEFAULT_NOTIFICATION_PAGE_SIZE,
    offset: 0,
  };
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const params = await searchParams;
  const query = buildNotificationQuery(params);

  const [list, overview] = await Promise.all([
    getNotificationsListQuery(query),
    getNotificationsOverviewQuery(),
  ]);

  return (
    <Suspense fallback={null}>
      <NotificationsCenter
        notifications={list.data}
        overview={overview}
        total={list.total}
      />
    </Suspense>
  );
}

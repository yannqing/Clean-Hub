"use client";

import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Pagination } from "@/components/pagination";
import { useTenantI18n } from "@/i18n";

import {
  notificationLogChannelOptions,
  notificationLogStatusOptions,
} from "../constants";
import { getNotificationLogsQuery } from "../queries";
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationLogItem,
} from "../types";

const LOG_PAGE_SIZE = 20;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function statusVariant(
  status: NotificationDeliveryStatus,
): "default" | "destructive" | "secondary" {
  if (status === "sent") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

export function NotificationLogList() {
  const { m, formatDateTime } = useTenantI18n();
  const [items, setItems] = useState<NotificationLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<NotificationDeliveryStatus | "all">(
    "all",
  );
  const [channel, setChannel] = useState<NotificationChannel | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => ({
      limit: LOG_PAGE_SIZE,
      offset,
      status: status === "all" ? undefined : status,
      channel: channel === "all" ? undefined : channel,
    }),
    [channel, offset, status],
  );

  // Status/channel labels live in the i18n catalog keyed by the enum value —
  // build lookups here so the SelectItems resolve to localized copy.
  const statusLabels = useMemo(
    () => ({
      pending: m.notifications.log.statusLabels.pending,
      sent: m.notifications.log.statusLabels.sent,
      failed: m.notifications.log.statusLabels.failed,
    }),
    [m.notifications.log.statusLabels],
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getNotificationLogsQuery(query);
      setItems(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, m.notifications.log.requestFailed),
      );
    } finally {
      setLoading(false);
    }
  }, [query, m.notifications.log.requestFailed]);

  useEffect(() => {
    let isCurrent = true;

    getNotificationLogsQuery(query)
      .then((result) => {
        if (!isCurrent) return;
        setItems(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isCurrent) return;
        setError(
          getErrorMessage(loadError, m.notifications.log.requestFailed),
        );
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [query, m.notifications.log.requestFailed]);

  return (
    <section className="grid gap-3 border-t pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-base font-semibold">
          {m.notifications.log.title}
        </h2>
        <div className="flex flex-wrap gap-3">
          <div className="grid gap-2">
            <Label htmlFor="notification-log-channel">
              {m.notifications.log.channelFilter}
            </Label>
            <Select
              onValueChange={(value) => {
                setChannel(value as NotificationChannel | "all");
                setOffset(0);
              }}
              value={channel}
            >
              <SelectTrigger id="notification-log-channel" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {m.notifications.log.allChannels}
                </SelectItem>
                {notificationLogChannelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notification-log-status">
              {m.notifications.log.statusFilter}
            </Label>
            <Select
              onValueChange={(value) => {
                setStatus(value as NotificationDeliveryStatus | "all");
                setOffset(0);
              }}
              value={status}
            >
              <SelectTrigger id="notification-log-status" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {m.notifications.log.allStatuses}
                </SelectItem>
                {notificationLogStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {statusLabels[option.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button onClick={loadLogs} size="sm" type="button" variant="outline">
            {m.common.retry}
          </Button>
        </div>
      ) : null}

      {!error && loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <div className="h-12 animate-pulse rounded-md bg-muted" key={item} />
          ))}
        </div>
      ) : null}

      {!error && !loading && items.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          {m.notifications.log.empty}
        </div>
      ) : null}

      {!error && !loading && items.length > 0 ? (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.notifications.log.columns.sentAt}</TableHead>
                <TableHead>{m.notifications.log.columns.event}</TableHead>
                <TableHead>{m.notifications.log.columns.channel}</TableHead>
                <TableHead>{m.notifications.log.columns.recipient}</TableHead>
                <TableHead>{m.notifications.log.columns.status}</TableHead>
                <TableHead>{m.notifications.log.columns.externalId}</TableHead>
                <TableHead>
                  {m.notifications.log.columns.failedReason}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.sentAt ? formatDateTime(item.sentAt) : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{item.event}</TableCell>
                  <TableCell>{item.channel}</TableCell>
                  <TableCell>{item.recipient}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(item.status)}>
                      {statusLabels[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.externalId ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.failedReason ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {!error && !loading && items.length > 0 ? (
        <Pagination
          currentPageCount={items.length}
          nextLabel={m.common.next}
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={LOG_PAGE_SIZE}
          previousLabel={m.common.previous}
          total={total}
        />
      ) : null}
    </section>
  );
}

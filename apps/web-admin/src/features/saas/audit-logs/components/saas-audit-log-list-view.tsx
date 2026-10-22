"use client";

import {
  Badge,
  Button,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import { RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import { SaasTableSurface, saasCompactTableClassName } from "@/features/saas/shared";
import { useSaasI18n, useWebAdminLocale } from "@/i18n";
import {
  getAuditEventDescription,
  getAuditEventTypesByCategory,
} from "@/features/audit/event-description";

import { auditEventCategoryOptions } from "../constants";
import { getSaasAuditLogListQuery } from "../queries";
import type { AuditLogListQuery, AuditLogSummary } from "../types";

const PAGE_SIZE = 10;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type SuccessFilter = "all" | "true" | "false";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function SaasAuditLogListView() {
  const router = useRouter();
  const { locale, m, formatDateTime } = useSaasI18n();
  // Shared with the tenant console: both render the same audit feed.
  const { messages } = useWebAdminLocale();
  const auditCopy = messages.common.auditEvents;
  const auditCategoryCopy = messages.common.auditCategories;
  const [logs, setLogs] = useState<AuditLogSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [eventCategory, setEventCategory] = useState("");
  const [eventType, setEventType] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [success, setSuccess] = useState<SuccessFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const normalizedActorUserId = actorUserId.trim();
  const actorUserIdFilter = ULID_PATTERN.test(normalizedActorUserId)
    ? normalizedActorUserId
    : undefined;

  const listQuery = useMemo<AuditLogListQuery>(
    () => ({
      limit: PAGE_SIZE,
      offset,
      eventCategory: eventCategory.trim() || undefined,
      eventType: eventType.trim() || undefined,
      actorUserId: actorUserIdFilter,
      success: success === "all" ? undefined : success,
      dateFrom: dateFrom
        ? new Date(`${dateFrom}T00:00:00`).toISOString()
        : undefined,
      dateTo: dateTo
        ? new Date(`${dateTo}T23:59:59.999`).toISOString()
        : undefined,
    }),
    [
      actorUserIdFilter,
      dateFrom,
      dateTo,
      eventCategory,
      eventType,
      offset,
      success,
    ],
  );

  // Cascading eventType options: picking a category narrows the list to that
  // category's events; "all" exposes every known event type.
  const eventTypeOptions = useMemo(
    () =>
      getAuditEventTypesByCategory(eventCategory.trim() || undefined, auditCopy),
    [eventCategory, auditCopy],
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getSaasAuditLogListQuery(listQuery);
      setLogs(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(getErrorMessage(loadError) || m.auditLogs.loadError);
    } finally {
      setLoading(false);
    }
  }, [listQuery, m.auditLogs.loadError]);

  useEffect(() => {
    let isCurrent = true;

    getSaasAuditLogListQuery(listQuery)
      .then((result) => {
        if (!isCurrent) {
          return;
        }

        setLogs(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError) || m.auditLogs.loadError);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [listQuery, m.auditLogs.loadError]);

  return (
    <section className="space-y-7 pb-8" data-testid="saas-audit-log-list-view">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{m.auditLogs.title}</h2>
        <Button
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={loading}
          onClick={loadLogs}
          size="sm"
          type="button"
          variant="outline"
        >
          <Icon aria-hidden icon={RefreshCw} size={14} />
          <span>{m.common.refresh}</span>
        </Button>
      </div>

      <SaasTableSurface>
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <label className="sr-only" htmlFor="audit-category-filter">
            {m.auditLogs.category}
          </label>
          <Select
            onValueChange={(value) => {
              setOffset(0);
              setLoading(true);
              setEventCategory(value === "all" ? "" : value);
              // Reset the cascading eventType filter whenever the category
              // changes, otherwise a stale event type could be hidden in the
              // new option set.
              setEventType("");
            }}
            value={eventCategory || "all"}
          >
            <SelectTrigger
              className="h-8 w-36 text-xs"
              id="audit-category-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allCategories}</SelectItem>
              {auditEventCategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {auditCategoryCopy[
                    option.value as keyof typeof auditCategoryCopy
                  ] ?? option.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="sr-only" htmlFor="audit-event-type-filter">
            {m.auditLogs.eventType}
          </label>
          <Select
            onValueChange={(value) => {
              setOffset(0);
              setLoading(true);
              setEventType(value === "all" ? "" : value);
            }}
            value={eventType || "all"}
          >
            <SelectTrigger
              className="h-8 w-44 text-xs"
              id="audit-event-type-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.auditLogs.allEventTypes}</SelectItem>
              {eventTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="sr-only" htmlFor="audit-success-filter">
            {m.auditLogs.result}
          </label>
          <Select
            onValueChange={(value) => {
              setOffset(0);
              setLoading(true);
              setSuccess(value as SuccessFilter);
            }}
            value={success}
          >
            <SelectTrigger
              className="h-8 w-32 text-xs"
              id="audit-success-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allResults}</SelectItem>
              <SelectItem value="true">
                {m.common.resultLabels.success}
              </SelectItem>
              <SelectItem value="false">
                {m.common.resultLabels.failed}
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="relative min-w-44 flex-1 sm:max-w-60">
            <label className="sr-only" htmlFor="audit-actor-filter">
              {m.auditLogs.actorUserId}
            </label>
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={14}
            />
            <Input
              className="h-8 pl-8 text-xs"
              id="audit-actor-filter"
              onChange={(event) => {
                const value = event.target.value;
                setOffset(0);
                setActorUserId(value);
                if (!value.trim() || ULID_PATTERN.test(value.trim())) {
                  setLoading(true);
                }
              }}
              placeholder={m.common.optionalUlid}
              value={actorUserId}
            />
          </div>

          <label className="sr-only" htmlFor="audit-date-from">
            {m.common.from}
          </label>
          <Input
            className="h-8 w-36 text-xs"
            id="audit-date-from"
            onChange={(event) => {
              setOffset(0);
              setLoading(true);
              setDateFrom(event.target.value);
            }}
            type="date"
            value={dateFrom}
          />

          <label className="sr-only" htmlFor="audit-date-to">
            {m.common.to}
          </label>
          <Input
            className="h-8 w-36 text-xs"
            id="audit-date-to"
            onChange={(event) => {
              setOffset(0);
              setLoading(true);
              setDateTo(event.target.value);
            }}
            type="date"
            value={dateTo}
          />
        </div>

        {loading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                className="h-10 animate-pulse rounded-md bg-muted"
                key={item}
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-4">
            <div className="border-y border-dashed px-4 py-14 text-center">
              <h2 className="text-sm font-semibold">
                {m.auditLogs.emptyTitle}
              </h2>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable className={saasCompactTableClassName}>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.auditLogs.columns.created}</TableHead>
                  <TableHead>{m.auditLogs.category}</TableHead>
                  <TableHead>{m.auditLogs.columns.event}</TableHead>
                  <TableHead>{m.auditLogs.columns.entity}</TableHead>
                  <TableHead>{m.auditLogs.columns.actor}</TableHead>
                  <TableHead>{m.auditLogs.result}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    className="cursor-pointer hover:bg-muted/40"
                    key={log.id}
                    onClick={() => {
                      router.push(webAdminRoutes.saas.auditLog(log.id));
                    }}
                    onMouseEnter={() =>
                      router.prefetch(webAdminRoutes.saas.auditLog(log.id))
                    }
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(log.createdAt) || m.common.invalidDate}
                    </TableCell>
                    <TableCell>
                      {auditCategoryCopy[
                        log.eventCategory as keyof typeof auditCategoryCopy
                      ] ?? log.eventCategory}
                    </TableCell>
                    <TableCell>
                      <Link
                        className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        href={webAdminRoutes.saas.auditLog(log.id)}
                        onClick={(event) => event.stopPropagation()}
                        onFocus={() =>
                          router.prefetch(webAdminRoutes.saas.auditLog(log.id))
                        }
                      >
                        {getAuditEventDescription(log.eventType, auditCopy)}
                      </Link>
                    </TableCell>
                    <TableCell>{log.entityType ?? m.common.notSet}</TableCell>
                    <TableCell>
                      {log.actorDisplayName ??
                        log.actorUserId ??
                        m.common.system}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className="px-1.5 py-px text-[11px]"
                        variant={log.success ? "default" : "destructive"}
                      >
                        {log.success
                          ? m.common.resultLabels.success
                          : m.common.resultLabels.failed}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </div>
        )}

        {!loading && !error ? (
          <Pagination
            currentPageCount={logs.length}
            formatCountLabel={({ from, to, total: itemTotal }) =>
              locale === "zh-CN"
                ? `${from}–${to} / 共 ${itemTotal} 条`
                : `${from}–${to} of ${itemTotal}`
            }
            nextLabel={m.common.nextPage}
            offset={offset}
            onOffsetChange={setOffset}
            pageSize={PAGE_SIZE}
            previousLabel={m.common.previousPage}
            total={total}
          />
        ) : null}
      </SaasTableSurface>
    </section>
  );
}

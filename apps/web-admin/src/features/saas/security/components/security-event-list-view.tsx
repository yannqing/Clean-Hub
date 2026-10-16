"use client";

import { isUlid } from "@cleanhub/id";
import {
  Badge,
  Button,
  Icon,
  Input,
  Label,
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
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import {
  SaasTableSurface,
  saasCompactTableClassName,
} from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import { securityEventSeverityOptions } from "../constants";
import { getSecurityEventListQuery } from "../queries";
import type { SecurityEventListItem, SecurityEventSeverity } from "../types";

type SeverityFilter = "all" | SecurityEventSeverity;

const PAGE_SIZE = 10;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function toLocalDayBoundary(
  value: string,
  boundary: "start" | "end",
): string | undefined {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  const date =
    boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  return date.toISOString();
}

function getSeverityVariant(
  severity: SecurityEventSeverity,
): "default" | "destructive" | "outline" | "secondary" {
  if (severity === "critical" || severity === "high") {
    return "destructive";
  }

  if (severity === "medium") {
    return "secondary";
  }

  return "outline";
}

export function SecurityEventListView() {
  const { m, formatDateTime } = useSaasI18n();
  const router = useRouter();
  const [events, setEvents] = useState<SecurityEventListItem[]>([]);
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [eventType, setEventType] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [tenantIdFilter, setTenantIdFilter] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      limit: PAGE_SIZE + 1,
      offset,
      severity: severity === "all" ? undefined : severity,
      eventType: eventType.trim() || undefined,
      tenantId: tenantIdFilter,
      dateFrom: dateFrom ? toLocalDayBoundary(dateFrom, "start") : undefined,
      dateTo: dateTo ? toLocalDayBoundary(dateTo, "end") : undefined,
    }),
    [dateFrom, dateTo, eventType, offset, severity, tenantIdFilter],
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSecurityEventListQuery(listQuery);
      setEvents(data.slice(0, PAGE_SIZE));
      setHasNextPage(data.length > PAGE_SIZE);
    } catch (loadError) {
      setError(getErrorMessage(loadError) || m.security.events.loadError);
    } finally {
      setLoading(false);
    }
  }, [listQuery, m.security.events.loadError]);

  useEffect(() => {
    let isCurrent = true;

    getSecurityEventListQuery(listQuery)
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setEvents(data.slice(0, PAGE_SIZE));
        setHasNextPage(data.length > PAGE_SIZE);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError) || m.security.events.loadError);
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
  }, [listQuery, m.security.events.loadError]);

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{m.security.events.title}</h2>
        <Button
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={loading}
          onClick={loadEvents}
          size="sm"
          type="button"
          variant="outline"
        >
          <Icon
            aria-hidden
            className={loading ? "animate-spin" : undefined}
            icon={RefreshCw}
            size={14}
          />
          {m.security.events.refreshEvents}
        </Button>
      </div>

      <SaasTableSurface>
        <div className="grid gap-2 border-b px-3 py-2.5 md:grid-cols-2 xl:grid-cols-5">
          <div className="grid gap-2">
            <Label className="sr-only" htmlFor="security-event-severity-filter">
              {m.security.events.severity}
            </Label>
            <Select
              onValueChange={(value) => {
                setLoading(true);
                setOffset(0);
                setSeverity(value as SeverityFilter);
              }}
              value={severity}
            >
              <SelectTrigger
                className="h-8 w-full text-xs"
                id="security-event-severity-filter"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{m.common.allLevels}</SelectItem>
                {securityEventSeverityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {m.common.severityLabels[option.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="sr-only" htmlFor="security-event-type-filter">
              {m.security.events.eventType}
            </Label>
            <Input
              className="h-8 text-xs"
              id="security-event-type-filter"
              onChange={(event) => {
                setLoading(true);
                setOffset(0);
                setEventType(event.target.value);
              }}
              placeholder={m.security.events.eventTypePlaceholder}
              value={eventType}
            />
          </div>

          <div className="grid gap-2">
            <Label className="sr-only" htmlFor="security-event-tenant-filter">
              {m.security.events.tenantId}
            </Label>
            <Input
              aria-invalid={
                Boolean(tenantId.trim()) && !isUlid(tenantId.trim())
              }
              className="h-8 text-xs"
              id="security-event-tenant-filter"
              onChange={(event) => {
                const nextTenantId = event.target.value;
                const normalizedTenantId = nextTenantId.trim();

                setTenantId(nextTenantId);

                if (!normalizedTenantId) {
                  setTenantIdFilter(undefined);
                  setLoading(true);
                  setOffset(0);
                } else if (isUlid(normalizedTenantId)) {
                  setTenantIdFilter(normalizedTenantId);
                  setLoading(true);
                  setOffset(0);
                }
              }}
              placeholder={m.common.optionalTenantUlid}
              value={tenantId}
            />
          </div>

          <div className="grid gap-2">
            <Label className="sr-only" htmlFor="security-event-date-from">
              {m.common.from}
            </Label>
            <Input
              className="h-8 text-xs"
              id="security-event-date-from"
              onChange={(event) => {
                setLoading(true);
                setOffset(0);
                setDateFrom(event.target.value);
              }}
              type="date"
              value={dateFrom}
            />
          </div>

          <div className="grid gap-2">
            <Label className="sr-only" htmlFor="security-event-date-to">
              {m.common.to}
            </Label>
            <Input
              className="h-8 text-xs"
              id="security-event-date-to"
              onChange={(event) => {
                setLoading(true);
                setOffset(0);
                setDateTo(event.target.value);
              }}
              type="date"
              value={dateTo}
            />
          </div>
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
        ) : events.length === 0 ? (
          <div className="p-4">
            <div className="border-y border-dashed px-4 py-14 text-center">
              <h3 className="text-sm font-semibold">
                {m.security.events.emptyTitle}
              </h3>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable className={saasCompactTableClassName}>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.security.events.columns.created}</TableHead>
                  <TableHead>{m.security.events.severity}</TableHead>
                  <TableHead>{m.security.events.eventType}</TableHead>
                  <TableHead>{m.security.events.columns.description}</TableHead>
                  <TableHead>{m.security.events.columns.tenant}</TableHead>
                  <TableHead>{m.security.events.columns.actor}</TableHead>
                  <TableHead>{m.security.events.columns.ip}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const detailHref = webAdminRoutes.saas.auditSecurityEvent(
                    event.id,
                  );

                  return (
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      key={event.id}
                      onClick={() => router.push(detailHref)}
                      onMouseEnter={() => router.prefetch(detailHref)}
                    >
                      <TableCell>
                        {formatDateTime(event.createdAt) ||
                          m.common.invalidDate}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityVariant(event.severity)}>
                          {m.common.severityLabels[event.severity]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          href={detailHref}
                          onClick={(linkEvent) => linkEvent.stopPropagation()}
                        >
                          {event.eventType}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[420px] truncate">
                          {event.description ?? m.security.events.noDescription}
                        </span>
                      </TableCell>
                      <TableCell>
                        {event.tenantId ?? m.common.platform}
                      </TableCell>
                      <TableCell>
                        {event.actorUserId ?? m.common.system}
                      </TableCell>
                      <TableCell>
                        {event.ipAddress ?? m.common.unknown}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </DataTable>
          </div>
        )}

        {!loading && !error ? (
          <Pagination
            currentPageCount={events.length}
            hasNext={hasNextPage}
            nextLabel={m.common.nextPage}
            offset={offset}
            onOffsetChange={(nextOffset) => {
              setLoading(true);
              setOffset(nextOffset);
            }}
            pageSize={PAGE_SIZE}
            previousLabel={m.common.previousPage}
          />
        ) : null}
      </SaasTableSurface>
    </section>
  );
}

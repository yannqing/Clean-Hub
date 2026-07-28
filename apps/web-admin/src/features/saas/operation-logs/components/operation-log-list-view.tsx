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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";
import { RefreshCw, ScrollText, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import {
  SaasPageHeader,
  SaasTableSurface,
  saasCompactTableClassName,
} from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import { operationLogLevelOptions } from "../constants";
import { getOperationLogListQuery } from "../queries";
import type { OperationLogLevel, OperationLogListItem } from "../types";

type LevelFilter = "all" | OperationLogLevel;

const PAGE_SIZE = 10;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function toIsoStart(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000`).toISOString() : undefined;
}

function toIsoEnd(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function getLevelVariant(
  level: OperationLogLevel,
): "default" | "destructive" | "outline" | "secondary" {
  if (level === "error") {
    return "destructive";
  }

  if (level === "warn") {
    return "secondary";
  }

  if (level === "debug") {
    return "outline";
  }

  return "default";
}

export function OperationLogListView() {
  const router = useRouter();
  const { locale, m, formatDateTime } = useSaasI18n();
  const [logs, setLogs] = useState<OperationLogListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [level, setLevel] = useState<LevelFilter>("all");
  const [service, setService] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset,
      level: level === "all" ? undefined : level,
      service: service.trim() || undefined,
      tenantId: ULID_PATTERN.test(tenantId.trim())
        ? tenantId.trim()
        : undefined,
      dateFrom: toIsoStart(dateFrom),
      dateTo: toIsoEnd(dateTo),
    }),
    [dateFrom, dateTo, level, offset, service, tenantId],
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getOperationLogListQuery(listQuery);
      setLogs(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(getErrorMessage(loadError) || m.systemLogs.loadError);
    } finally {
      setLoading(false);
    }
  }, [listQuery, m.systemLogs.loadError]);

  useEffect(() => {
    let isCurrent = true;

    getOperationLogListQuery(listQuery)
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
          setError(getErrorMessage(loadError) || m.systemLogs.loadError);
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
  }, [listQuery, m.systemLogs.loadError]);

  return (
    <section
      className="space-y-7 pb-8"
      data-testid="saas-operation-log-list-view"
    >
      <SaasPageHeader
        actions={
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
        }
        icon={ScrollText}
        title={m.systemLogs.title}
      />

      <SaasTableSurface>
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <label className="sr-only" htmlFor="operation-log-level-filter">
            {m.systemLogs.level}
          </label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setOffset(0);
              setLevel(value as LevelFilter);
            }}
            value={level}
          >
            <SelectTrigger
              className="h-8 w-32 text-xs"
              id="operation-log-level-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allLevels}</SelectItem>
              {operationLogLevelOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {m.common.levelLabels[option.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative min-w-40 flex-1 sm:max-w-56">
            <label className="sr-only" htmlFor="operation-log-service-filter">
              {m.systemLogs.service}
            </label>
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={14}
            />
            <Input
              className="h-8 pl-8 text-xs"
              id="operation-log-service-filter"
              onChange={(event) => {
                setLoading(true);
                setOffset(0);
                setService(event.target.value);
              }}
              placeholder={m.systemLogs.servicePlaceholder}
              value={service}
            />
          </div>

          <label className="sr-only" htmlFor="operation-log-tenant-filter">
            {m.systemLogs.tenantId}
          </label>
          <Input
            className="h-8 w-52 text-xs"
            id="operation-log-tenant-filter"
            onChange={(event) => {
              setLoading(true);
              setOffset(0);
              setTenantId(event.target.value);
            }}
            placeholder={m.common.optionalTenantUlid}
            value={tenantId}
          />

          <label className="sr-only" htmlFor="operation-log-date-from">
            {m.common.from}
          </label>
          <Input
            className="h-8 w-36 text-xs"
            id="operation-log-date-from"
            onChange={(event) => {
              setLoading(true);
              setOffset(0);
              setDateFrom(event.target.value);
            }}
            type="date"
            value={dateFrom}
          />

          <label className="sr-only" htmlFor="operation-log-date-to">
            {m.common.to}
          </label>
          <Input
            className="h-8 w-36 text-xs"
            id="operation-log-date-to"
            onChange={(event) => {
              setLoading(true);
              setOffset(0);
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
                {m.systemLogs.emptyTitle}
              </h2>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className={saasCompactTableClassName}>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.systemLogs.columns.created}</TableHead>
                  <TableHead>{m.systemLogs.level}</TableHead>
                  <TableHead>{m.systemLogs.service}</TableHead>
                  <TableHead>{m.auditLogs.columns.event}</TableHead>
                  <TableHead>{m.systemLogs.columns.message}</TableHead>
                  <TableHead>{m.systemLogs.columns.tenant}</TableHead>
                  <TableHead>{m.systemLogs.columns.actor}</TableHead>
                  <TableHead>{m.systemLogs.columns.request}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const detailHref = webAdminRoutes.saas.system.operationLog(
                    log.id,
                  );

                  return (
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      key={log.id}
                      onClick={() => router.push(detailHref)}
                      onMouseEnter={() => router.prefetch(detailHref)}
                    >
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(log.createdAt) || m.common.invalidDate}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="px-1.5 py-px text-[11px]"
                          variant={getLevelVariant(log.level)}
                        >
                          {m.common.levelLabels[log.level]}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.service}</TableCell>
                      <TableCell>
                        <Link
                          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        href={detailHref}
                        onClick={(event) => event.stopPropagation()}
                        onFocus={() => router.prefetch(detailHref)}
                      >
                          {log.eventType}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[360px] truncate">
                          {log.message}
                        </span>
                      </TableCell>
                      <TableCell>{log.tenantId ?? m.common.platform}</TableCell>
                      <TableCell>
                        {log.actorUserId ?? m.common.system}
                      </TableCell>
                      <TableCell>
                        {log.requestId ?? m.systemLogs.columns.none}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
            onOffsetChange={(nextOffset) => {
              setLoading(true);
              setOffset(nextOffset);
            }}
            pageSize={PAGE_SIZE}
            previousLabel={m.common.previousPage}
            total={total}
          />
        ) : null}
      </SaasTableSurface>
    </section>
  );
}

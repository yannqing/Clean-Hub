"use client";

import {
  Badge,
  Button,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
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
  cn,
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import {
  calendarDateEndToUtc,
  calendarDateStartToUtc,
} from "@cleanhub/domain/timezone";
import {
  ListFilter,
  RefreshCw,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import { getAuditEventDescription, getAuditEventTypesByCategory } from "@/features/audit/event-description";
import { useTenantI18n } from "@/i18n";

import {
  getTenantAuditLogListQuery,
} from "../queries";
import type {
  TenantAuditLogListFilters,
  TenantAuditLogSummary,
} from "../types";

type CategoryFilter =
  | "all"
  | "tenant_branch"
  | "tenant_user"
  | "tenant_service"
  | "tenant_price"
  | "tenant_hardware"
  | "tenant_notification"
  | "tenant_settings"
  | "tenant_backup";
type SuccessFilter = "all" | "true" | "false";

const categoryEntries = [
  { key: "branches", value: "tenant_branch" },
  { key: "users", value: "tenant_user" },
  { key: "services", value: "tenant_service" },
  { key: "prices", value: "tenant_price" },
  { key: "hardware", value: "tenant_hardware" },
  { key: "notifications", value: "tenant_notification" },
  { key: "settings", value: "tenant_settings" },
  { key: "backups", value: "tenant_backup" },
] as const;

const TENANT_AUDIT_LOG_PAGE_SIZE = 10;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function toIsoStart(value: string, timeZone: string): string | undefined {
  return value ? calendarDateStartToUtc(value, timeZone).toISOString() : undefined;
}

function toIsoEnd(value: string, timeZone: string): string | undefined {
  return value ? calendarDateEndToUtc(value, timeZone).toISOString() : undefined;
}

function getStatusVariant(success: boolean): "default" | "destructive" {
  return success ? "default" : "destructive";
}

export function TenantAuditLogView() {
  const { m, formatDateTime, timeZone } = useTenantI18n();
  const router = useRouter();
  const [logs, setLogs] = useState<TenantAuditLogSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [eventType, setEventType] = useState("");
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [success, setSuccess] = useState<SuccessFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo<TenantAuditLogListFilters>(
    () => ({
      eventCategory: category === "all" ? undefined : category,
      eventType: eventType.trim() || undefined,
      branchId: branchId.trim() || undefined,
      success: success === "all" ? undefined : success === "true",
      dateFrom: toIsoStart(dateFrom, timeZone),
      dateTo: toIsoEnd(dateTo, timeZone),
      limit: TENANT_AUDIT_LOG_PAGE_SIZE,
      offset,
    }),
    [branchId, category, dateFrom, dateTo, eventType, offset, success, timeZone],
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getTenantAuditLogListQuery(filters);
      setLogs(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(getErrorMessage(loadError, m.auditLogs.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [filters, m.auditLogs.requestFailed]);

  useEffect(() => {
    let isCurrent = true;

    getTenantAuditLogListQuery(filters)
      .then((result) => {
        if (!isCurrent) return;
        setLogs(result.items);
        setTotal(result.total);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError, m.auditLogs.requestFailed));
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [filters, m.auditLogs.requestFailed]);

  const getCategoryLabel = useCallback(
    (value: string): string => {
      const entry = categoryEntries.find((option) => option.value === value);
      return entry
        ? m.auditLogs.categoryLabels[entry.key]
        : value;
    },
    [m.auditLogs.categoryLabels],
  );

  const eventTypeOptions = useMemo(
    () => getAuditEventTypesByCategory(category === "all" ? undefined : category),
    [category],
  );

  function resetToFirstPage() {
    setOffset(0);
    setLoading(true);
    setError(null);
  }

  function updateCategory(value: CategoryFilter) {
    setCategory(value);
    setEventType("");
    resetToFirstPage();
  }

  return (
    <section
      className="space-y-7 pb-8"
      data-testid="tenant-audit-log-view"
    >
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden icon={ScrollText} size={19} />
          <span>{m.auditLogs.title}</span>
        </h1>
        <Button
          aria-label={m.common.refresh}
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={loading}
          onClick={() => void loadLogs()}
          size="sm"
          title={m.common.refresh}
          type="button"
          variant="outline"
        >
          <Icon aria-hidden icon={RefreshCw} size={14} />
          <span>{m.common.refresh}</span>
        </Button>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="min-w-0 border-y bg-background">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <Select
            onValueChange={(value) => updateCategory(value as CategoryFilter)}
            value={category}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.auditLogs.allCategories}</SelectItem>
              {categoryEntries.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {m.auditLogs.categoryLabels[entry.key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            onValueChange={(value) => {
              resetToFirstPage();
              setEventType(value === "all" ? "" : value);
            }}
            value={eventType || "all"}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
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

          <Popover onOpenChange={setFiltersOpen} open={filtersOpen}>
            <PopoverTrigger asChild>
              <Button
                aria-label={m.auditLogs.formLabels.result}
                className={cn(
                  "h-8 gap-1.5 px-2.5 text-xs",
                  (branchId || dateFrom || dateTo || success !== "all") &&
                    "bg-accent",
                )}
                size="sm"
                title={m.auditLogs.formLabels.result}
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={SlidersHorizontal} size={14} />
                <span>{m.auditLogs.formLabels.result}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-3">
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium" htmlFor="audit-branch-id">
                    {m.auditLogs.formLabels.branchId}
                  </label>
                  <Input
                    className="h-8 text-xs"
                    id="audit-branch-id"
                    onChange={(event) => {
                      setBranchId(event.target.value);
                      resetToFirstPage();
                    }}
                    value={branchId}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium" htmlFor="audit-success">
                    {m.auditLogs.formLabels.result}
                  </label>
                  <Select
                    onValueChange={(value) => {
                      setSuccess(value as SuccessFilter);
                      resetToFirstPage();
                    }}
                    value={success}
                  >
                    <SelectTrigger className="h-8 text-xs" id="audit-success">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{m.auditLogs.allResults}</SelectItem>
                      <SelectItem value="true">{m.auditLogs.successLabel}</SelectItem>
                      <SelectItem value="false">{m.auditLogs.failedLabel}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium" htmlFor="audit-date-from">
                      {m.auditLogs.formLabels.from}
                    </label>
                    <Input
                      className="h-8 text-xs"
                      id="audit-date-from"
                      onChange={(event) => {
                        setDateFrom(event.target.value);
                        resetToFirstPage();
                      }}
                      type="date"
                      value={dateFrom}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium" htmlFor="audit-date-to">
                      {m.auditLogs.formLabels.to}
                    </label>
                    <Input
                      className="h-8 text-xs"
                      id="audit-date-to"
                      onChange={(event) => {
                        setDateTo(event.target.value);
                        resetToFirstPage();
                      }}
                      type="date"
                      value={dateTo}
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <span className="ml-auto text-xs text-muted-foreground">
            {total.toLocaleString()}
          </span>
          <Icon aria-hidden className="text-muted-foreground" icon={ListFilter} size={15} />
        </div>

        {loading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div className="h-10 animate-pulse rounded-md bg-muted" key={item} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-3">
            <div className="rounded-md border border-dashed px-4 py-10 text-center">
              <h2 className="text-sm font-semibold">{m.auditLogs.empty}</h2>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable className="text-xs [&_td]:px-1.5 [&_td]:py-1.5 [&_th]:h-8 [&_th]:px-1.5">
              <TableHeader>
                <TableRow>
                  <TableHead>{m.auditLogs.columns.time}</TableHead>
                  <TableHead>{m.auditLogs.columns.category}</TableHead>
                  <TableHead>{m.auditLogs.columns.event}</TableHead>
                  <TableHead>{m.auditLogs.columns.entity}</TableHead>
                  <TableHead>{m.auditLogs.columns.actor}</TableHead>
                  <TableHead>{m.auditLogs.columns.result}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    className="cursor-pointer hover:bg-muted/40"
                    key={log.id}
                    onClick={() =>
                      router.push(webAdminRoutes.tenant.system.auditLog(log.id))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(webAdminRoutes.tenant.system.auditLog(log.id));
                      }
                    }}
                    onMouseEnter={() =>
                      router.prefetch(webAdminRoutes.tenant.system.auditLog(log.id))
                    }
                    role="link"
                    tabIndex={0}
                  >
                    <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>{getCategoryLabel(log.eventCategory)}</TableCell>
                    <TableCell>{getAuditEventDescription(log.eventType)}</TableCell>
                    <TableCell>
                      <div>{log.entityType ?? m.auditLogs.placeholders.unknownEntity}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {log.entityId ?? m.auditLogs.placeholders.noEntity}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {log.actorDisplayName ??
                          log.actorUserId ??
                          m.auditLogs.placeholders.systemActor}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {log.ipAddress ?? m.auditLogs.placeholders.noIp}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(log.success)}>
                        {log.success
                          ? m.auditLogs.successLabel
                        : m.auditLogs.failedLabel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </div>
        )}

        <Pagination
          currentPageCount={logs.length}
          nextLabel={m.common.next}
          offset={offset}
          onOffsetChange={(nextOffset) => {
            setLoading(true);
            setError(null);
            setOffset(nextOffset);
          }}
          pageSize={TENANT_AUDIT_LOG_PAGE_SIZE}
          previousLabel={m.common.previous}
          total={total}
        />
      </section>

    </section>
  );
}

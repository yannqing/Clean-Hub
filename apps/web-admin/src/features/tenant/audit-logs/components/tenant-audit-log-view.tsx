"use client";

import {
  Badge,
  Button,
  Input,
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
  getAuditEventDescription,
  getAuditEventTypesByCategory,
} from "@/features/audit/event-description";

import {
  getTenantAuditLogDetailQuery,
  getTenantAuditLogListQuery,
} from "../queries";
import type {
  TenantAuditLogDetail,
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
] as const satisfies {
  key:
    | "branches"
    | "users"
    | "services"
    | "prices"
    | "hardware"
    | "notifications"
    | "settings"
    | "backups";
  value: Exclude<CategoryFilter, "all">;
}[];

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function toIsoStart(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

function toIsoEnd(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

function formatJson(value: Record<string, unknown> | null, fallback: string): string {
  return value ? JSON.stringify(value, null, 2) : fallback;
}

const TENANT_AUDIT_LOG_PAGE_SIZE = 50;

function getStatusVariant(success: boolean): "default" | "destructive" {
  return success ? "default" : "destructive";
}

export function TenantAuditLogView() {
  const { m, formatDateTime } = useTenantI18n();
  const [logs, setLogs] = useState<TenantAuditLogSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [eventType, setEventType] = useState("");
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [success, setSuccess] = useState<SuccessFilter>("all");
  const [selectedLog, setSelectedLog] = useState<TenantAuditLogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Resetting to page 1 whenever a filter changes; otherwise the offset would
  // point past the filtered result set.
  const resetFiltersAndOffset = useCallback(() => {
    setOffset(0);
    setLoading(true);
  }, []);

  const filters = useMemo<TenantAuditLogListFilters>(
    () => ({
      eventCategory: category === "all" ? undefined : category,
      eventType: eventType.trim() || undefined,
      branchId: branchId.trim() || undefined,
      success: success === "all" ? undefined : success === "true",
      dateFrom: toIsoStart(dateFrom),
      dateTo: toIsoEnd(dateTo),
      limit: TENANT_AUDIT_LOG_PAGE_SIZE,
      offset,
    }),
    [branchId, category, dateFrom, dateTo, eventType, offset, success],
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
        if (!isCurrent) {
          return;
        }

        setLogs(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError, m.auditLogs.requestFailed));
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
  }, [filters, m.auditLogs.requestFailed]);

  async function handleSelectLog(logId: string) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      setSelectedLog(await getTenantAuditLogDetailQuery(logId));
    } catch (selectError) {
      setDetailError(getErrorMessage(selectError, m.auditLogs.requestFailed));
    } finally {
      setDetailLoading(false);
    }
  }

  const getCategoryLabel = useCallback(
    (value: string): string => {
      const entry = categoryEntries.find((option) => option.value === value);
      return entry ? m.auditLogs.categoryLabels[entry.key] : value;
    },
    [m.auditLogs.categoryLabels],
  );

  // Cascading eventType options: when a category is picked, only its event
  // types are offered. With "all" selected, every known event type is listed so
  // operators can still pick a specific one without narrowing by category.
  const eventTypeOptions = useMemo(
    () =>
      getAuditEventTypesByCategory(
        category === "all" ? undefined : category,
      ),
    [category],
  );

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value as CategoryFilter);
    setEventType("");
    resetFiltersAndOffset();
  }, [resetFiltersAndOffset]);

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.auditLogs.eyebrow}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.auditLogs.title}
          </h1>
        </div>

        <Button onClick={loadLogs} type="button" variant="outline">
          {m.common.refresh}
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[180px_1fr_1fr_160px_160px_160px]">
        <div className="grid gap-2">
          <Label htmlFor="audit-category">{m.auditLogs.formLabels.category}</Label>
          <Select
            onValueChange={(value) => {
              handleCategoryChange(value);
            }}
            value={category}
          >
            <SelectTrigger id="audit-category">
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
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-event-type">
            {m.auditLogs.formLabels.eventType}
          </Label>
          <Select
            onValueChange={(value) => {
              resetFiltersAndOffset();
              setEventType(value === "all" ? "" : value);
            }}
            value={eventType || "all"}
          >
            <SelectTrigger id="audit-event-type">
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
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-branch-id">
            {m.auditLogs.formLabels.branchId}
          </Label>
          <Input
            id="audit-branch-id"
            onChange={(event) => {
              resetFiltersAndOffset();
              setBranchId(event.target.value);
            }}
            value={branchId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-success">{m.auditLogs.formLabels.result}</Label>
          <Select
            onValueChange={(value) => {
              resetFiltersAndOffset();
              setSuccess(value as SuccessFilter);
            }}
            value={success}
          >
            <SelectTrigger id="audit-success">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.auditLogs.allResults}</SelectItem>
              <SelectItem value="true">{m.auditLogs.successLabel}</SelectItem>
              <SelectItem value="false">{m.auditLogs.failedLabel}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-date-from">{m.auditLogs.formLabels.from}</Label>
          <Input
            id="audit-date-from"
            onChange={(event) => {
              resetFiltersAndOffset();
              setDateFrom(event.target.value);
            }}
            type="date"
            value={dateFrom}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-date-to">{m.auditLogs.formLabels.to}</Label>
          <Input
            id="audit-date-to"
            onChange={(event) => {
              resetFiltersAndOffset();
              setDateTo(event.target.value);
            }}
            type="date"
            value={dateTo}
          />
        </div>
      </div>

      <Pagination
        currentPageCount={logs.length}
        nextLabel={m.common.next}
        offset={offset}
        onOffsetChange={setOffset}
        pageSize={TENANT_AUDIT_LOG_PAGE_SIZE}
        previousLabel={m.common.previous}
        total={total}
      />

      {loading ? (
        <div className="grid gap-3 p-5">
          {[0, 1, 2].map((item) => (
            <div className="h-14 animate-pulse rounded-md bg-muted" key={item} />
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">{m.auditLogs.empty}</h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.auditLogs.columns.time}</TableHead>
              <TableHead>{m.auditLogs.columns.category}</TableHead>
              <TableHead>{m.auditLogs.columns.event}</TableHead>
              <TableHead>{m.auditLogs.columns.entity}</TableHead>
              <TableHead>{m.auditLogs.columns.actor}</TableHead>
              <TableHead>{m.auditLogs.columns.result}</TableHead>
              <TableHead className="text-right">
                {m.auditLogs.columns.actions}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                <TableCell>{getCategoryLabel(log.eventCategory)}</TableCell>
                <TableCell>{getAuditEventDescription(log.eventType)}</TableCell>
                <TableCell>
                  <div>
                    {log.entityType ?? m.auditLogs.placeholders.unknownEntity}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {log.entityId ?? m.auditLogs.placeholders.noEntity}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    {log.actorDisplayName ??
                      log.actorUserId ??
                      m.auditLogs.placeholders.systemActor}
                  </div>
                  <div className="text-xs text-muted-foreground">
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
                <TableCell className="text-right">
                  <Button
                    disabled={detailLoading}
                    onClick={() => void handleSelectLog(log.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {m.common.details}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="border-t p-5">
        <h2 className="text-base font-semibold">{m.auditLogs.selectedDetail}</h2>
        {detailError ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {detailError}
          </div>
        ) : selectedLog ? (
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.auditLogs.detailLabels.event}
              </p>
              <p className="mt-2 font-medium">
                {getAuditEventDescription(selectedLog.eventType)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedLog.eventCategory}
              </p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.auditLogs.detailLabels.branch}
              </p>
              <p className="mt-2 font-medium">
                {selectedLog.branchId ?? m.auditLogs.detailLabels.tenantScope}
              </p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.auditLogs.detailLabels.userAgent}
              </p>
              <p className="mt-2 truncate text-sm">
                {selectedLog.userAgent ?? m.auditLogs.detailLabels.notCaptured}
              </p>
            </div>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-4 text-xs lg:col-span-1">
              {formatJson(selectedLog.before, m.auditLogs.detailLabels.noJson)}
            </pre>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-4 text-xs lg:col-span-1">
              {formatJson(selectedLog.after, m.auditLogs.detailLabels.noJson)}
            </pre>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-4 text-xs lg:col-span-1">
              {formatJson(selectedLog.metadata, m.auditLogs.detailLabels.noJson)}
            </pre>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {m.auditLogs.selectLogHint}
          </p>
        )}
      </div>
    </section>
  );
}

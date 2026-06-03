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
import { getAuditEventDescription } from "@/features/audit/event-description";

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

const categoryOptions: { label: string; value: Exclude<CategoryFilter, "all"> }[] = [
  { label: "Branches", value: "tenant_branch" },
  { label: "Users", value: "tenant_user" },
  { label: "Services", value: "tenant_service" },
  { label: "Prices", value: "tenant_price" },
  { label: "Hardware", value: "tenant_hardware" },
  { label: "Notifications", value: "tenant_notification" },
  { label: "Settings", value: "tenant_settings" },
  { label: "Backups", value: "tenant_backup" },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load audit logs.";
}

function toIsoStart(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

function toIsoEnd(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatJson(value: Record<string, unknown> | null): string {
  return value ? JSON.stringify(value, null, 2) : "None";
}

function getCategoryLabel(value: string): string {
  return categoryOptions.find((option) => option.value === value)?.label ?? value;
}

function getStatusVariant(success: boolean): "default" | "destructive" {
  return success ? "default" : "destructive";
}

export function TenantAuditLogView() {
  const [logs, setLogs] = useState<TenantAuditLogSummary[]>([]);
  const [total, setTotal] = useState(0);
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

  const filters = useMemo<TenantAuditLogListFilters>(
    () => ({
      eventCategory: category === "all" ? undefined : category,
      eventType: eventType.trim() || undefined,
      branchId: branchId.trim() || undefined,
      success: success === "all" ? undefined : success === "true",
      dateFrom: toIsoStart(dateFrom),
      dateTo: toIsoEnd(dateTo),
      limit: 50,
      offset: 0,
    }),
    [branchId, category, dateFrom, dateTo, eventType, success],
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getTenantAuditLogListQuery(filters);
      setLogs(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
          setError(getErrorMessage(loadError));
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
  }, [filters]);

  async function handleSelectLog(logId: string) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      setSelectedLog(await getTenantAuditLogDetailQuery(logId));
    } catch (selectError) {
      setDetailError(getErrorMessage(selectError));
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant audit</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Operation Logs
          </h1>
        </div>

        <Button onClick={loadLogs} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[180px_1fr_1fr_160px_160px_160px]">
        <div className="grid gap-2">
          <Label htmlFor="audit-category">Category</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setCategory(value as CategoryFilter);
            }}
            value={category}
          >
            <SelectTrigger id="audit-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-event-type">Event type</Label>
          <Input
            id="audit-event-type"
            onChange={(event) => {
              setLoading(true);
              setEventType(event.target.value);
            }}
            placeholder="service.updated"
            value={eventType}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-branch-id">Branch ID</Label>
          <Input
            id="audit-branch-id"
            onChange={(event) => {
              setLoading(true);
              setBranchId(event.target.value);
            }}
            placeholder="Optional"
            value={branchId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-success">Result</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setSuccess(value as SuccessFilter);
            }}
            value={success}
          >
            <SelectTrigger id="audit-success">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All results</SelectItem>
              <SelectItem value="true">Success</SelectItem>
              <SelectItem value="false">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-date-from">From</Label>
          <Input
            id="audit-date-from"
            onChange={(event) => {
              setLoading(true);
              setDateFrom(event.target.value);
            }}
            type="date"
            value={dateFrom}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-date-to">To</Label>
          <Input
            id="audit-date-to"
            onChange={(event) => {
              setLoading(true);
              setDateTo(event.target.value);
            }}
            type="date"
            value={dateTo}
          />
        </div>
      </div>

      <div className="border-b px-5 py-3 text-sm text-muted-foreground">
        Showing {logs.length} of {total} tenant audit records
      </div>

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
            <h2 className="text-base font-semibold">No audit logs found</h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                <TableCell>{getCategoryLabel(log.eventCategory)}</TableCell>
                <TableCell>{getAuditEventDescription(log.eventType)}</TableCell>
                <TableCell>
                  <div>{log.entityType ?? "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">
                    {log.entityId ?? "No entity"}
                  </div>
                </TableCell>
                <TableCell>
                  <div>{log.actorDisplayName ?? log.actorUserId ?? "System"}</div>
                  <div className="text-xs text-muted-foreground">
                    {log.ipAddress ?? "No IP"}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(log.success)}>
                    {log.success ? "Success" : "Failed"}
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
                    Detail
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="border-t p-5">
        <h2 className="text-base font-semibold">Selected log detail</h2>
        {detailError ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {detailError}
          </div>
        ) : selectedLog ? (
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Event
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
                Branch
              </p>
              <p className="mt-2 font-medium">
                {selectedLog.branchId ?? "Tenant scope"}
              </p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                User agent
              </p>
              <p className="mt-2 truncate text-sm">
                {selectedLog.userAgent ?? "Not captured"}
              </p>
            </div>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-4 text-xs lg:col-span-1">
              {formatJson(selectedLog.before)}
            </pre>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-4 text-xs lg:col-span-1">
              {formatJson(selectedLog.after)}
            </pre>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-4 text-xs lg:col-span-1">
              {formatJson(selectedLog.metadata)}
            </pre>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Select a log row to inspect before, after, and metadata payloads.
          </p>
        )}
      </div>
    </section>
  );
}

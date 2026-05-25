"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

import { auditSuccessOptions } from "../constants";
import {
  getSaasAuditLogDetailQuery,
  getSaasAuditLogListQuery,
} from "../queries";
import type { AuditLogDetail, AuditLogSummary } from "../types";

type SuccessFilter = "all" | "true" | "false";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load audit logs.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getSuccessVariant(
  success: boolean,
): "default" | "destructive" | "outline" {
  return success ? "default" : "destructive";
}

function JsonBlock({ value }: { value: Record<string, unknown> | null }) {
  if (!value) {
    return <span className="text-muted-foreground">None</span>;
  }

  return (
    <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function SaasAuditLogListView() {
  const [logs, setLogs] = useState<AuditLogSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actorUserId, setActorUserId] = useState("");
  const [eventCategory, setEventCategory] = useState("");
  const [eventType, setEventType] = useState("");
  const [successFilter, setSuccessFilter] = useState<SuccessFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const limit = 10;

  const listQuery = useMemo(
    () => ({
      limit,
      offset,
      actorUserId: actorUserId.trim() || undefined,
      eventCategory: eventCategory.trim() || undefined,
      eventType: eventType.trim() || undefined,
      success: successFilter === "all" ? undefined : successFilter,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    }),
    [actorUserId, eventCategory, eventType, successFilter, dateFrom, dateTo, offset],
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getSaasAuditLogListQuery(listQuery);
      setLogs(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  useEffect(() => {
    let isCurrent = true;

    getSaasAuditLogListQuery(listQuery)
      .then((result) => {
        if (!isCurrent) return;
        setLogs(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [listQuery]);

  async function handleRowClick(log: AuditLogSummary) {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedLog(null);

    try {
      const detail = await getSaasAuditLogDetailQuery(log.id);
      setSelectedLog(detail);
    } catch {
      setSelectedLog(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleFilterChange() {
    setOffset(0);
  }

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">SaaS audit logs</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Audit Logs
          </h1>
        </div>
        <Button onClick={loadLogs} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 md:grid-cols-2 xl:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="audit-actor-filter">Actor User ID</Label>
          <Input
            id="audit-actor-filter"
            onChange={(e) => {
              setLoading(true);
              setActorUserId(e.target.value);
              handleFilterChange();
            }}
            placeholder="ULID of actor"
            value={actorUserId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-category-filter">Category</Label>
          <Input
            id="audit-category-filter"
            onChange={(e) => {
              setLoading(true);
              setEventCategory(e.target.value);
              handleFilterChange();
            }}
            placeholder="e.g. saas_platform"
            value={eventCategory}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-event-filter">Event Type</Label>
          <Input
            id="audit-event-filter"
            onChange={(e) => {
              setLoading(true);
              setEventType(e.target.value);
              handleFilterChange();
            }}
            placeholder="e.g. platform_settings.updated"
            value={eventType}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-success-filter">Result</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setSuccessFilter(value as SuccessFilter);
              handleFilterChange();
            }}
            value={successFilter}
          >
            <SelectTrigger className="w-full" id="audit-success-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {auditSuccessOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-date-from">From</Label>
          <Input
            id="audit-date-from"
            onChange={(e) => {
              setLoading(true);
              setDateFrom(e.target.value);
              handleFilterChange();
            }}
            type="date"
            value={dateFrom}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-date-to">To</Label>
          <Input
            id="audit-date-to"
            onChange={(e) => {
              setLoading(true);
              setDateTo(e.target.value);
              handleFilterChange();
            }}
            type="date"
            value={dateTo}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 p-5">
          {[0, 1, 2].map((item) => (
            <div
              className="h-14 animate-pulse rounded-md bg-muted"
              key={item}
            />
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
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow
                  className="cursor-pointer"
                  key={log.id}
                  onClick={() => handleRowClick(log)}
                >
                  <TableCell>{formatDate(log.createdAt)}</TableCell>
                  <TableCell>{log.eventCategory}</TableCell>
                  <TableCell>{log.eventType}</TableCell>
                  <TableCell>
                    {log.entityType ? (
                      <span>
                        {log.entityType}
                        {log.entityId ? (
                          <span className="block text-xs text-muted-foreground">
                            {log.entityId}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.actorUserId ? (
                      <span className="font-mono text-xs">
                        {log.actorUserId}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.tenantId ? (
                      <span className="font-mono text-xs">{log.tenantId}</span>
                    ) : (
                      <span className="text-muted-foreground">Platform</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSuccessVariant(log.success)}>
                      {log.success ? "Success" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t p-5">
            <p className="text-sm text-muted-foreground">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                size="sm"
                type="button"
                variant="outline"
              >
                Previous
              </Button>
              <Button
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                size="sm"
                type="button"
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog onOpenChange={setDetailOpen} open={detailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Detail</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              {[0, 1, 2].map((i) => (
                <div
                  className="h-6 animate-pulse rounded bg-muted"
                  key={i}
                />
              ))}
            </div>
          ) : selectedLog ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["ID", selectedLog.id],
                  ["Created", formatDate(selectedLog.createdAt)],
                  ["Category", selectedLog.eventCategory],
                  ["Event", selectedLog.eventType],
                  ["Entity Type", selectedLog.entityType ?? "—"],
                  ["Entity ID", selectedLog.entityId ?? "—"],
                  ["Actor", selectedLog.actorUserId ?? "System"],
                  ["Tenant", selectedLog.tenantId ?? "Platform"],
                  ["IP Address", selectedLog.ipAddress ?? "—"],
                  ["Result", selectedLog.success ? "Success" : "Failed"],
                  ["Reason", selectedLog.reason ?? "—"],
                  [
                    "User Agent",
                    selectedLog.userAgent
                      ? selectedLog.userAgent.slice(0, 60) + "…"
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-medium text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-0.5 font-mono text-xs break-all">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Before
                </p>
                <JsonBlock value={selectedLog.before} />
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  After
                </p>
                <JsonBlock value={selectedLog.after} />
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Failed to load detail.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

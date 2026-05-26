"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
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

import { auditEventCategoryOptions } from "../constants";
import {
  getSaasAuditLogDetailQuery,
  getSaasAuditLogListQuery,
} from "../queries";
import type { AuditLogDetail, AuditLogListQuery, AuditLogSummary } from "../types";

const limit = 10;

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

export function SaasAuditLogListView() {
  const [logs, setLogs] = useState<AuditLogSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [eventCategory, setEventCategory] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [success, setSuccess] = useState<SuccessFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogSummary | null>(null);
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const listQuery = useMemo<AuditLogListQuery>(
    () => ({
      limit,
      offset,
      eventCategory: eventCategory.trim() || undefined,
      actorUserId: actorUserId.trim() || undefined,
      success: success === "all" ? undefined : success,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    }),
    [actorUserId, dateFrom, dateTo, eventCategory, offset, success],
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
  }, [listQuery]);

  const openDetail = useCallback((log: AuditLogSummary) => {
    setSelectedLog(log);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);

    getSaasAuditLogDetailQuery(log.id)
      .then((data) => {
        setDetail(data);
      })
      .catch((err: unknown) => {
        setDetailError(getErrorMessage(err));
      })
      .finally(() => {
        setDetailLoading(false);
      });
  }, []);

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">SaaS audit</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Audit Logs
          </h1>
        </div>

        <Button onClick={loadLogs} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="grid gap-2">
          <Label htmlFor="audit-category-filter">Category</Label>
          <Select
            onValueChange={(value) => {
              setOffset(0);
              setLoading(true);
              setEventCategory(value === "all" ? "" : value);
            }}
            value={eventCategory || "all"}
          >
            <SelectTrigger className="w-full" id="audit-category-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {auditEventCategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-success-filter">Result</Label>
          <Select
            onValueChange={(value) => {
              setOffset(0);
              setLoading(true);
              setSuccess(value as SuccessFilter);
            }}
            value={success}
          >
            <SelectTrigger className="w-full" id="audit-success-filter">
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
          <Label htmlFor="audit-actor-filter">Actor user ID</Label>
          <Input
            id="audit-actor-filter"
            onChange={(event) => {
              setOffset(0);
              setLoading(true);
              setActorUserId(event.target.value);
            }}
            placeholder="Optional ULID"
            value={actorUserId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-date-from">From</Label>
          <Input
            id="audit-date-from"
            onChange={(event) => {
              setOffset(0);
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
              setOffset(0);
              setLoading(true);
              setDateTo(event.target.value);
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
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow
                  className="cursor-pointer"
                  key={log.id}
                  onClick={() => {
                    openDetail(log);
                  }}
                >
                  <TableCell>{formatDate(log.createdAt)}</TableCell>
                  <TableCell>{log.eventCategory}</TableCell>
                  <TableCell>{log.eventType}</TableCell>
                  <TableCell>{log.entityType ?? "—"}</TableCell>
                  <TableCell>{log.actorUserId ?? "System"}</TableCell>
                  <TableCell>
                    <Badge variant={log.success ? "default" : "destructive"}>
                      {log.success ? "Success" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t px-5 py-3">
            <span className="text-sm text-muted-foreground">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={!hasPrev}
                onClick={() => {
                  setOffset(Math.max(0, offset - limit));
                }}
                type="button"
                variant="outline"
              >
                Previous Page
              </Button>
              <Button
                disabled={!hasNext}
                onClick={() => {
                  setOffset(offset + limit);
                }}
                type="button"
                variant="outline"
              >
                Next Page
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLog(null);
            setDetail(null);
            setDetailError(null);
          }
        }}
        open={Boolean(selectedLog)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit Log Detail</DialogTitle>
            <DialogDescription className="sr-only">
              Full details of the selected audit log entry.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="grid gap-3">
              <div className="h-8 animate-pulse rounded-md bg-muted" />
              <div className="h-32 animate-pulse rounded-md bg-muted" />
            </div>
          ) : detailError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {detailError}
            </div>
          ) : detail ? (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-[140px_1fr] gap-y-2">
                <span className="text-muted-foreground">ID</span>
                <span className="break-all font-mono text-xs">{detail.id}</span>
                <span className="text-muted-foreground">Category</span>
                <span>{detail.eventCategory}</span>
                <span className="text-muted-foreground">Event</span>
                <span>{detail.eventType}</span>
                <span className="text-muted-foreground">Entity type</span>
                <span>{detail.entityType ?? "—"}</span>
                <span className="text-muted-foreground">Entity ID</span>
                <span className="break-all font-mono text-xs">
                  {detail.entityId ?? "—"}
                </span>
                <span className="text-muted-foreground">Actor</span>
                <span className="break-all font-mono text-xs">
                  {detail.actorUserId ?? "System"}
                </span>
                <span className="text-muted-foreground">Tenant</span>
                <span className="break-all font-mono text-xs">
                  {detail.tenantId ?? "Platform"}
                </span>
                <span className="text-muted-foreground">Result</span>
                <Badge
                  className="w-fit"
                  variant={detail.success ? "default" : "destructive"}
                >
                  {detail.success ? "Success" : "Failed"}
                </Badge>
                {detail.reason ? (
                  <>
                    <span className="text-muted-foreground">Reason</span>
                    <span>{detail.reason}</span>
                  </>
                ) : null}
                <span className="text-muted-foreground">IP address</span>
                <span>{detail.ipAddress ?? "—"}</span>
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(detail.createdAt)}</span>
              </div>

              {detail.before ?? detail.after ? (
                <div className="grid gap-2">
                  {detail.before ? (
                    <div className="grid gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Before
                      </span>
                      <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                        {JSON.stringify(detail.before, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                  {detail.after ? (
                    <div className="grid gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        After
                      </span>
                      <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                        {JSON.stringify(detail.after, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

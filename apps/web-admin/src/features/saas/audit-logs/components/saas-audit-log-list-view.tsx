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

import { Pagination } from "@/components/pagination";
import { useSaasI18n } from "@/i18n";
import {
  getAuditEventDescription,
  getAuditEventTypesByCategory,
} from "@/features/audit/event-description";

import { auditEventCategoryOptions } from "../constants";
import {
  getSaasAuditLogDetailQuery,
  getSaasAuditLogListQuery,
} from "../queries";
import type { AuditLogDetail, AuditLogListQuery, AuditLogSummary } from "../types";

const limit = 50;

type SuccessFilter = "all" | "true" | "false";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function SaasAuditLogListView() {
  const { m, formatDateTime } = useSaasI18n();
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
  const [selectedLog, setSelectedLog] = useState<AuditLogSummary | null>(null);
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const listQuery = useMemo<AuditLogListQuery>(
    () => ({
      limit,
      offset,
      eventCategory: eventCategory.trim() || undefined,
      eventType: eventType.trim() || undefined,
      actorUserId: actorUserId.trim() || undefined,
      success: success === "all" ? undefined : success,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    }),
    [actorUserId, dateFrom, dateTo, eventCategory, eventType, offset, success],
  );

  // Cascading eventType options: picking a category narrows the list to that
  // category's events; "all" exposes every known event type.
  const eventTypeOptions = useMemo(
    () => getAuditEventTypesByCategory(eventCategory.trim() || undefined),
    [eventCategory],
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
        setDetailError(getErrorMessage(err) || m.auditLogs.loadError);
      })
      .finally(() => {
        setDetailLoading(false);
      });
  }, []);

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.auditLogs.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.auditLogs.title}
          </h1>
        </div>

        <Button onClick={loadLogs} type="button" variant="outline">
          {m.common.refresh}
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 md:grid-cols-2 xl:grid-cols-6">
        <div className="grid gap-2">
          <Label htmlFor="audit-category-filter">{m.auditLogs.category}</Label>
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
            <SelectTrigger className="w-full" id="audit-category-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allCategories}</SelectItem>
              {auditEventCategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.value === "auth"
                    ? m.common.auditCategoryLabels.auth
                    : option.value === "saas_platform"
                      ? m.common.auditCategoryLabels.saasPlatform
                      : option.value === "saas_tenant"
                        ? m.common.auditCategoryLabels.saasTenant
                        : m.common.auditCategoryLabels.saasUser}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-event-type-filter">{m.auditLogs.eventType}</Label>
          <Select
            onValueChange={(value) => {
              setOffset(0);
              setLoading(true);
              setEventType(value === "all" ? "" : value);
            }}
            value={eventType || "all"}
          >
            <SelectTrigger className="w-full" id="audit-event-type-filter">
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
          <Label htmlFor="audit-success-filter">{m.auditLogs.result}</Label>
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
              <SelectItem value="all">{m.common.allResults}</SelectItem>
              <SelectItem value="true">{m.common.resultLabels.success}</SelectItem>
              <SelectItem value="false">{m.common.resultLabels.failed}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-actor-filter">{m.auditLogs.actorUserId}</Label>
          <Input
            id="audit-actor-filter"
            onChange={(event) => {
              setOffset(0);
              setLoading(true);
              setActorUserId(event.target.value);
            }}
            placeholder={m.common.optionalUlid}
            value={actorUserId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="audit-date-from">{m.common.from}</Label>
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
          <Label htmlFor="audit-date-to">{m.common.to}</Label>
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
            <h2 className="text-base font-semibold">{m.auditLogs.emptyTitle}</h2>
          </div>
        </div>
      ) : (
        <>
          <Table>
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
                  className="cursor-pointer"
                  key={log.id}
                  onClick={() => {
                    openDetail(log);
                  }}
                >
                  <TableCell>
                    {formatDateTime(log.createdAt) || m.common.invalidDate}
                  </TableCell>
                  <TableCell>
                    {log.eventCategory === "auth"
                      ? m.common.auditCategoryLabels.auth
                      : log.eventCategory === "saas_platform"
                        ? m.common.auditCategoryLabels.saasPlatform
                        : log.eventCategory === "saas_tenant"
                          ? m.common.auditCategoryLabels.saasTenant
                          : log.eventCategory === "saas_user"
                            ? m.common.auditCategoryLabels.saasUser
                            : log.eventCategory}
                  </TableCell>
                  <TableCell>{getAuditEventDescription(log.eventType)}</TableCell>
                  <TableCell>{log.entityType ?? m.common.notSet}</TableCell>
                  <TableCell>
                    {log.actorDisplayName ?? log.actorUserId ?? m.common.system}
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.success ? "default" : "destructive"}>
                      {log.success
                        ? m.common.resultLabels.success
                        : m.common.resultLabels.failed}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            currentPageCount={logs.length}
            nextLabel={m.common.nextPage}
            offset={offset}
            onOffsetChange={setOffset}
            pageSize={limit}
            previousLabel={m.common.previousPage}
            total={total}
          />
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
            <DialogTitle>{m.auditLogs.detail.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {m.auditLogs.detail.description}
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
                <span className="text-muted-foreground">{m.auditLogs.detail.id}</span>
                <span className="break-all font-mono text-xs">{detail.id}</span>
                <span className="text-muted-foreground">{m.auditLogs.category}</span>
                <span>
                  {detail.eventCategory === "auth"
                    ? m.common.auditCategoryLabels.auth
                    : detail.eventCategory === "saas_platform"
                      ? m.common.auditCategoryLabels.saasPlatform
                      : detail.eventCategory === "saas_tenant"
                        ? m.common.auditCategoryLabels.saasTenant
                        : detail.eventCategory === "saas_user"
                          ? m.common.auditCategoryLabels.saasUser
                          : detail.eventCategory}
                </span>
                <span className="text-muted-foreground">{m.auditLogs.columns.event}</span>
                <span>{getAuditEventDescription(detail.eventType)}</span>
                <span className="text-muted-foreground">{m.auditLogs.detail.entityType}</span>
                <span>{detail.entityType ?? m.common.notSet}</span>
                <span className="text-muted-foreground">{m.auditLogs.detail.entityId}</span>
                <span className="break-all font-mono text-xs">
                  {detail.entityId ?? m.common.notSet}
                </span>
                <span className="text-muted-foreground">{m.auditLogs.columns.actor}</span>
                <span>{detail.actorDisplayName ?? detail.actorUserId ?? m.common.system}</span>
                <span className="text-muted-foreground">{m.auditLogs.detail.tenant}</span>
                <span className="break-all font-mono text-xs">
                  {detail.tenantId ?? m.common.platform}
                </span>
                <span className="text-muted-foreground">{m.auditLogs.result}</span>
                <Badge
                  className="w-fit"
                  variant={detail.success ? "default" : "destructive"}
                >
                  {detail.success
                    ? m.common.resultLabels.success
                    : m.common.resultLabels.failed}
                </Badge>
                {detail.reason ? (
                  <>
                    <span className="text-muted-foreground">{m.auditLogs.detail.reason}</span>
                    <span>{detail.reason}</span>
                  </>
                ) : null}
                <span className="text-muted-foreground">{m.auditLogs.detail.ipAddress}</span>
                <span>{detail.ipAddress ?? m.common.notSet}</span>
                <span className="text-muted-foreground">{m.auditLogs.columns.created}</span>
                <span>{formatDateTime(detail.createdAt) || m.common.invalidDate}</span>
              </div>

              {detail.before ?? detail.after ? (
                <div className="grid gap-2">
                  {detail.before ? (
                    <div className="grid gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {m.auditLogs.detail.before}
                      </span>
                      <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                        {JSON.stringify(detail.before, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                  {detail.after ? (
                    <div className="grid gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {m.auditLogs.detail.after}
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

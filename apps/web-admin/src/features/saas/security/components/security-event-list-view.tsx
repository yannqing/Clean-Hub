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

import {
  securityEventSeverityLabels,
  securityEventSeverityOptions,
} from "../constants";
import { getSecurityEventListQuery } from "../queries";
import type {
  SecurityEventListItem,
  SecurityEventSeverity,
} from "../types";
import { useSaasI18n } from "@/i18n";

type SeverityFilter = "all" | SecurityEventSeverity;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
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
  const [events, setEvents] = useState<SecurityEventListItem[]>([]);
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [eventType, setEventType] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      limit: 50,
      offset: 0,
      severity: severity === "all" ? undefined : severity,
      eventType: eventType.trim() || undefined,
      tenantId: tenantId.trim() || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    }),
    [dateFrom, dateTo, eventType, severity, tenantId],
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSecurityEventListQuery(listQuery);
      setEvents(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError) || m.security.events.loadError);
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  useEffect(() => {
    let isCurrent = true;

    getSecurityEventListQuery(listQuery)
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setEvents(data);
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
    <section className="grid gap-4 rounded-md border p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold">{m.security.events.title}</h2>
        </div>

        <Button onClick={loadEvents} type="button" variant="outline">
          {m.security.events.refreshEvents}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="grid gap-2">
          <Label htmlFor="security-event-severity-filter">
            {m.security.events.severity}
          </Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setSeverity(value as SeverityFilter);
            }}
            value={severity}
          >
            <SelectTrigger
              className="w-full"
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
          <Label htmlFor="security-event-type-filter">
            {m.security.events.eventType}
          </Label>
          <Input
            id="security-event-type-filter"
            onChange={(event) => {
              setLoading(true);
              setEventType(event.target.value);
            }}
            placeholder={m.security.events.eventTypePlaceholder}
            value={eventType}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="security-event-tenant-filter">
            {m.security.events.tenantId}
          </Label>
          <Input
            id="security-event-tenant-filter"
            onChange={(event) => {
              setLoading(true);
              setTenantId(event.target.value);
            }}
            placeholder={m.common.optionalTenantUlid}
            value={tenantId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="security-event-date-from">{m.common.from}</Label>
          <Input
            id="security-event-date-from"
            onChange={(event) => {
              setLoading(true);
              setDateFrom(event.target.value);
            }}
            type="date"
            value={dateFrom}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="security-event-date-to">{m.common.to}</Label>
          <Input
            id="security-event-date-to"
            onChange={(event) => {
              setLoading(true);
              setDateTo(event.target.value);
            }}
            type="date"
            value={dateTo}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-14 animate-pulse rounded-md bg-muted"
              key={item}
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <h3 className="text-base font-semibold">{m.security.events.emptyTitle}</h3>
        </div>
      ) : (
        <Table>
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
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  {formatDateTime(event.createdAt) || m.common.invalidDate}
                </TableCell>
                <TableCell>
                  <Badge variant={getSeverityVariant(event.severity)}>
                    {m.common.severityLabels[event.severity]}
                  </Badge>
                </TableCell>
                <TableCell>{event.eventType}</TableCell>
                <TableCell>
                  <span className="block max-w-[420px] truncate">
                    {event.description ?? m.security.events.noDescription}
                  </span>
                </TableCell>
                <TableCell>{event.tenantId ?? m.common.platform}</TableCell>
                <TableCell>{event.actorUserId ?? m.common.system}</TableCell>
                <TableCell>{event.ipAddress ?? m.common.unknown}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

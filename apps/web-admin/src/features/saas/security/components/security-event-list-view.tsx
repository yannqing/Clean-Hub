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

type SeverityFilter = "all" | SecurityEventSeverity;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load security events.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
      setError(getErrorMessage(loadError));
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

  return (
    <section className="grid gap-4 rounded-md border p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Security Events</h2>
        </div>

        <Button onClick={loadEvents} type="button" variant="outline">
          Refresh events
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="grid gap-2">
          <Label htmlFor="security-event-severity-filter">Severity</Label>
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
              <SelectItem value="all">All severities</SelectItem>
              {securityEventSeverityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="security-event-type-filter">Event type</Label>
          <Input
            id="security-event-type-filter"
            onChange={(event) => {
              setLoading(true);
              setEventType(event.target.value);
            }}
            placeholder="login_failed"
            value={eventType}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="security-event-tenant-filter">Tenant ID</Label>
          <Input
            id="security-event-tenant-filter"
            onChange={(event) => {
              setLoading(true);
              setTenantId(event.target.value);
            }}
            placeholder="Optional tenant ULID"
            value={tenantId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="security-event-date-from">From</Label>
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
          <Label htmlFor="security-event-date-to">To</Label>
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
          <h3 className="text-base font-semibold">No security events found</h3>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{formatDate(event.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={getSeverityVariant(event.severity)}>
                    {securityEventSeverityLabels[event.severity]}
                  </Badge>
                </TableCell>
                <TableCell>{event.eventType}</TableCell>
                <TableCell>
                  <span className="block max-w-[420px] truncate">
                    {event.description ?? "No description"}
                  </span>
                </TableCell>
                <TableCell>{event.tenantId ?? "Platform"}</TableCell>
                <TableCell>{event.actorUserId ?? "System"}</TableCell>
                <TableCell>{event.ipAddress ?? "Unknown"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

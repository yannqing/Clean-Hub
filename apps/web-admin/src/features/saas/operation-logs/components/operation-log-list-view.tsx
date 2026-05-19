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
  operationLogLevelLabels,
  operationLogLevelOptions,
} from "../constants";
import { getOperationLogListQuery } from "../queries";
import type { OperationLogLevel, OperationLogListItem } from "../types";

type LevelFilter = "all" | OperationLogLevel;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load operation logs.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  const [logs, setLogs] = useState<OperationLogListItem[]>([]);
  const [level, setLevel] = useState<LevelFilter>("all");
  const [service, setService] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      limit: 50,
      offset: 0,
      level: level === "all" ? undefined : level,
      service: service.trim() || undefined,
      tenantId: tenantId.trim() || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    }),
    [dateFrom, dateTo, level, service, tenantId],
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getOperationLogListQuery(listQuery);
      setLogs(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  useEffect(() => {
    let isCurrent = true;

    getOperationLogListQuery(listQuery)
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setLogs(data);
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
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">SaaS operation logs</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Operation Logs
          </h1>
        </div>

        <Button onClick={loadLogs} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="grid gap-2">
          <Label htmlFor="operation-log-level-filter">Level</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setLevel(value as LevelFilter);
            }}
            value={level}
          >
            <SelectTrigger
              className="w-full"
              id="operation-log-level-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {operationLogLevelOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="operation-log-service-filter">Service</Label>
          <Input
            id="operation-log-service-filter"
            onChange={(event) => {
              setLoading(true);
              setService(event.target.value);
            }}
            placeholder="cleanhub-api"
            value={service}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="operation-log-tenant-filter">Tenant ID</Label>
          <Input
            id="operation-log-tenant-filter"
            onChange={(event) => {
              setLoading(true);
              setTenantId(event.target.value);
            }}
            placeholder="Optional tenant ULID"
            value={tenantId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="operation-log-date-from">From</Label>
          <Input
            id="operation-log-date-from"
            onChange={(event) => {
              setLoading(true);
              setDateFrom(event.target.value);
            }}
            type="date"
            value={dateFrom}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="operation-log-date-to">To</Label>
          <Input
            id="operation-log-date-to"
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
            <h2 className="text-base font-semibold">
              No operation logs found
            </h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{formatDate(log.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={getLevelVariant(log.level)}>
                    {operationLogLevelLabels[log.level]}
                  </Badge>
                </TableCell>
                <TableCell>{log.service}</TableCell>
                <TableCell>{log.eventType}</TableCell>
                <TableCell>
                  <span className="block max-w-[420px] truncate">
                    {log.message}
                  </span>
                </TableCell>
                <TableCell>{log.tenantId ?? "Platform"}</TableCell>
                <TableCell>{log.actorUserId ?? "System"}</TableCell>
                <TableCell>{log.requestId ?? "None"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

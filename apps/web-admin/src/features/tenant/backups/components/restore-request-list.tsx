"use client";

import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";
import { useCallback, useEffect, useState } from "react";

import { useTenantI18n } from "@/i18n";

import { getTenantRestoreRequestListQuery } from "../queries";
import type { RestoreRequest, RestoreRequestStatus } from "../types";

type RestoreRequestListProps = {
  /**
   * Bumped by the parent whenever a new restore request is submitted so this
   * list refetches. The parent passes a counter it increments on create.
   */
  refreshKey: number;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getStatusVariant(
  status: RestoreRequestStatus,
): "default" | "destructive" | "outline" | "secondary" {
  if (status === "completed") return "default";
  if (status === "rejected") return "destructive";
  if (status === "approved") return "secondary";
  return "outline";
}

/**
 * Tenant-side list of restore requests submitted by the tenant's users.
 *
 * Target endpoint: `GET /tenant/restore-requests`. The api-client method
 * returns an empty result set until the backend route exists, so this panel
 * renders the localized empty state in the meantime.
 */
export function RestoreRequestList({ refreshKey }: RestoreRequestListProps) {
  const { m, formatDateTime } = useTenantI18n();
  const [items, setItems] = useState<RestoreRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getTenantRestoreRequestListQuery({ limit: 50 });
      setItems(result.items);
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, m.backups.restoreList.requestFailed),
      );
    } finally {
      setLoading(false);
    }
  }, [m.backups.restoreList.requestFailed]);

  useEffect(() => {
    let isCurrent = true;

    getTenantRestoreRequestListQuery({ limit: 50 })
      .then((result) => {
        if (!isCurrent) return;
        setItems(result.items);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isCurrent) return;
        setError(
          getErrorMessage(loadError, m.backups.restoreList.requestFailed),
        );
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshKey, m.backups.restoreList.requestFailed]);

  return (
    <section className="grid gap-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {m.backups.restoreList.title}
        </h2>
        <Button
          disabled={loading}
          onClick={loadRequests}
          size="sm"
          type="button"
          variant="outline"
        >
          {m.common.refresh}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!error && loading ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((item) => (
            <div className="h-10 animate-pulse rounded-md bg-muted" key={item} />
          ))}
        </div>
      ) : null}

      {!error && !loading && items.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          {m.backups.restoreList.empty}
        </div>
      ) : null}

      {!error && !loading && items.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.backups.restoreList.columns.created}</TableHead>
              <TableHead>{m.backups.restoreList.columns.status}</TableHead>
              <TableHead>{m.backups.restoreList.columns.reason}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(request.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(request.status)}>
                    {m.backups.restoreStatusLabels[request.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {request.reason}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </section>
  );
}

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
  backupJobScopeLabels,
  backupJobScopeOptions,
  backupJobStatusLabels,
  backupJobStatusOptions,
  restoreRequestStatusLabels,
} from "../constants";
import { getBackupJobListQuery, getRestoreRequestListQuery } from "../queries";
import type {
  BackupJobListItem,
  BackupJobScope,
  BackupJobStatus,
  RestoreRequest,
} from "../types";
import { CreateBackupJobForm } from "./create-backup-job-form";
import { CreateRestoreRequestForm } from "./create-restore-request-form";

type ScopeFilter = "all" | BackupJobScope;
type StatusFilter = "all" | BackupJobStatus;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load backups.";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusVariant(
  status: BackupJobStatus,
): "default" | "destructive" | "outline" | "secondary" {
  if (status === "succeeded") {
    return "default";
  }

  if (status === "failed") {
    return "destructive";
  }

  if (status === "running") {
    return "secondary";
  }

  return "outline";
}

function toListItem(backupJob: BackupJobListItem): BackupJobListItem {
  return {
    id: backupJob.id,
    tenantId: backupJob.tenantId,
    scope: backupJob.scope,
    status: backupJob.status,
    requestedBy: backupJob.requestedBy,
    startedAt: backupJob.startedAt,
    finishedAt: backupJob.finishedAt,
    failureReason: backupJob.failureReason,
    createdAt: backupJob.createdAt,
    updatedAt: backupJob.updatedAt,
  };
}

export function BackupJobListView() {
  const [backupJobs, setBackupJobs] = useState<BackupJobListItem[]>([]);
  const [restoreRequests, setRestoreRequests] = useState<RestoreRequest[]>([]);
  const [selectedBackupJob, setSelectedBackupJob] =
    useState<BackupJobListItem | null>(null);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [restoreRequestsLoading, setRestoreRequestsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoreRequestsError, setRestoreRequestsError] = useState<string | null>(
    null,
  );

  const listQuery = useMemo(
    () => ({
      limit: 50,
      offset: 0,
      scope: scope === "all" ? undefined : scope,
      status: status === "all" ? undefined : status,
      tenantId: tenantId.trim() || undefined,
    }),
    [scope, status, tenantId],
  );

  const loadBackupJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getBackupJobListQuery(listQuery);
      setBackupJobs(data);
      setSelectedBackupJob((current) =>
        current
          ? data.find((backupJob) => backupJob.id === current.id) ?? current
          : null,
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  function handleBackupJobCreated(backupJob: BackupJobListItem) {
    setBackupJobs((current) => [toListItem(backupJob), ...current]);
    setSelectedBackupJob(backupJob);
  }

  function handleRestoreRequestCreated(restoreRequest: RestoreRequest) {
    setRestoreRequests((current) => [restoreRequest, ...current]);
  }

  useEffect(() => {
    let isCurrent = true;

    getBackupJobListQuery(listQuery)
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setBackupJobs(data);
        setSelectedBackupJob((current) =>
          current
            ? data.find((backupJob) => backupJob.id === current.id) ?? current
            : null,
        );
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

  useEffect(() => {
    let isCurrent = true;

    setRestoreRequestsLoading(true);
    setRestoreRequestsError(null);

    getRestoreRequestListQuery({ limit: 50, offset: 0 })
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setRestoreRequests(data);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setRestoreRequestsError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load restore requests.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setRestoreRequestsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">SaaS backups</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Data Backups
          </h1>
        </div>

        <Button onClick={loadBackupJobs} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          <CreateBackupJobForm onCreated={handleBackupJobCreated} />

          <div className="grid gap-3 rounded-md border p-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="backup-scope-filter">Scope</Label>
              <Select
                onValueChange={(value) => {
                  setLoading(true);
                  setScope(value as ScopeFilter);
                }}
                value={scope}
              >
                <SelectTrigger className="w-full" id="backup-scope-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scopes</SelectItem>
                  {backupJobScopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="backup-status-filter">Status</Label>
              <Select
                onValueChange={(value) => {
                  setLoading(true);
                  setStatus(value as StatusFilter);
                }}
                value={status}
              >
                <SelectTrigger className="w-full" id="backup-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {backupJobStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="backup-tenant-filter">Tenant ID</Label>
              <Input
                id="backup-tenant-filter"
                onChange={(event) => {
                  setLoading(true);
                  setTenantId(event.target.value);
                }}
                placeholder="Optional tenant ULID"
                value={tenantId}
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
          ) : backupJobs.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <h2 className="text-base font-semibold">
                No backup tasks found
              </h2>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupJobs.map((backupJob) => (
                  <TableRow key={backupJob.id}>
                    <TableCell>{formatDate(backupJob.createdAt)}</TableCell>
                    <TableCell>{backupJobScopeLabels[backupJob.scope]}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(backupJob.status)}>
                        {backupJobStatusLabels[backupJob.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{backupJob.tenantId ?? "Platform"}</TableCell>
                    <TableCell>{backupJob.requestedBy ?? "System"}</TableCell>
                    <TableCell>{formatDate(backupJob.finishedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => setSelectedBackupJob(backupJob)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <aside className="grid content-start gap-5">
          <div>
            <h2 className="text-base font-semibold">Restore Request</h2>
          </div>

          {selectedBackupJob ? (
            <>
              <div className="grid gap-3 rounded-md border p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Backup task
                  </p>
                  <p className="mt-1 break-all font-medium">
                    {selectedBackupJob.id}
                  </p>
                </div>
                <div className="grid gap-2 text-sm">
                  <p>Scope: {backupJobScopeLabels[selectedBackupJob.scope]}</p>
                  <p>Status: {backupJobStatusLabels[selectedBackupJob.status]}</p>
                  <p>Tenant: {selectedBackupJob.tenantId ?? "Platform"}</p>
                  <p>Started: {formatDate(selectedBackupJob.startedAt)}</p>
                  <p>Finished: {formatDate(selectedBackupJob.finishedAt)}</p>
                  {selectedBackupJob.failureReason ? (
                    <p>Failure: {selectedBackupJob.failureReason}</p>
                  ) : null}
                </div>
              </div>

              <CreateRestoreRequestForm
                backupJobId={selectedBackupJob.id}
                onCreated={handleRestoreRequestCreated}
              />
            </>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Select a backup task before submitting a restore request for
              manual review.
            </div>
          )}

          <div className="grid gap-3">
            <div>
              <h2 className="text-base font-semibold">Restore Requests</h2>
            </div>

            {restoreRequestsLoading ? (
              <div className="grid gap-2">
                {[0, 1, 2].map((item) => (
                  <div
                    className="h-12 animate-pulse rounded-md bg-muted"
                    key={item}
                  />
                ))}
              </div>
            ) : restoreRequestsError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {restoreRequestsError}
              </div>
            ) : restoreRequests.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No restore requests found.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tenant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {restoreRequests.map((restoreRequest) => (
                      <TableRow key={restoreRequest.id}>
                        <TableCell>
                          {formatDate(restoreRequest.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {restoreRequestStatusLabels[restoreRequest.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {restoreRequest.tenantId ?? "Platform"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

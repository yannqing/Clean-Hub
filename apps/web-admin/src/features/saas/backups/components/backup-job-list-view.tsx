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
  backupJobScopeOptions,
  backupJobStatusOptions,
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
import { RestoreRequestReviewActions } from "./restore-request-review-actions";
import { BackupStorageMetadata } from "./backup-storage-metadata";
import { useSaasI18n } from "@/i18n";

type ScopeFilter = "all" | BackupJobScope;
type StatusFilter = "all" | BackupJobStatus;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function formatDate(
  value: string | null,
  m: ReturnType<typeof useSaasI18n>["m"],
  formatDateTime: ReturnType<typeof useSaasI18n>["formatDateTime"],
): string {
  if (!value) {
    return m.common.notSet;
  }

  return formatDateTime(value) || m.common.invalidDate;
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
  const { m, formatDateTime } = useSaasI18n();
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
      setError(getErrorMessage(loadError) || m.backups.loadError);
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

  function handleRestoreRequestReviewed(updated: RestoreRequest) {
    setRestoreRequests((current) =>
      current.map((request) =>
        request.id === updated.id ? updated : request,
      ),
    );
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
          setError(getErrorMessage(loadError) || m.backups.loadError);
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
              : m.backups.restoreLoadError,
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
          <Badge variant="secondary">{m.backups.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.backups.title}
          </h1>
        </div>

        <Button onClick={loadBackupJobs} type="button" variant="outline">
          {m.common.refresh}
        </Button>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          <CreateBackupJobForm onCreated={handleBackupJobCreated} />

          <div className="grid gap-3 rounded-md border p-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="backup-scope-filter">{m.backups.scope}</Label>
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
                  <SelectItem value="all">{m.common.allScopes}</SelectItem>
                  {backupJobScopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {m.common.backupScopeLabels[option.value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="backup-status-filter">{m.common.status}</Label>
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
                  <SelectItem value="all">{m.common.allStatuses}</SelectItem>
                  {backupJobStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {m.common.backupStatusLabels[option.value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="backup-tenant-filter">{m.systemLogs.tenantId}</Label>
              <Input
                id="backup-tenant-filter"
                onChange={(event) => {
                  setLoading(true);
                  setTenantId(event.target.value);
                }}
                placeholder={m.common.optionalTenantUlid}
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
                {m.backups.emptyBackups}
              </h2>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.backups.columns.created}</TableHead>
                  <TableHead>{m.backups.scope}</TableHead>
                  <TableHead>{m.common.status}</TableHead>
                  <TableHead>{m.systemLogs.columns.tenant}</TableHead>
                  <TableHead>{m.backups.columns.requestedBy}</TableHead>
                  <TableHead>{m.backups.columns.finished}</TableHead>
                  <TableHead className="text-right">{m.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupJobs.map((backupJob) => (
                  <TableRow key={backupJob.id}>
                    <TableCell>
                      {formatDate(backupJob.createdAt, m, formatDateTime)}
                    </TableCell>
                    <TableCell>{m.common.backupScopeLabels[backupJob.scope]}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(backupJob.status)}>
                        {m.common.backupStatusLabels[backupJob.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{backupJob.tenantId ?? m.common.platform}</TableCell>
                    <TableCell>{backupJob.requestedBy ?? m.common.system}</TableCell>
                    <TableCell>
                      {formatDate(backupJob.finishedAt, m, formatDateTime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => setSelectedBackupJob(backupJob)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {m.backups.columns.review}
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
            <h2 className="text-base font-semibold">{m.backups.restoreSection}</h2>
          </div>

          {selectedBackupJob ? (
            <>
              <div className="grid gap-3 rounded-md border p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {m.backups.detail.backupTask}
                  </p>
                  <p className="mt-1 break-all font-medium">
                    {selectedBackupJob.id}
                  </p>
                </div>
                <div className="grid gap-2 text-sm">
                  <p>
                    {m.backups.detail.scope}{" "}
                    {m.common.backupScopeLabels[selectedBackupJob.scope]}
                  </p>
                  <p>
                    {m.backups.detail.status}{" "}
                    {m.common.backupStatusLabels[selectedBackupJob.status]}
                  </p>
                  <p>
                    {m.backups.detail.tenant} {selectedBackupJob.tenantId ?? m.common.platform}
                  </p>
                  <p>
                    {m.backups.detail.started}{" "}
                    {formatDate(selectedBackupJob.startedAt, m, formatDateTime)}
                  </p>
                  <p>
                    {m.backups.detail.finished}{" "}
                    {formatDate(selectedBackupJob.finishedAt, m, formatDateTime)}
                  </p>
                  {selectedBackupJob.failureReason ? (
                    <p>
                      {m.backups.detail.failure} {selectedBackupJob.failureReason}
                    </p>
                  ) : null}
                </div>

                <BackupStorageMetadata />
              </div>

              <CreateRestoreRequestForm
                backupJobId={selectedBackupJob.id}
                onCreated={handleRestoreRequestCreated}
              />
            </>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {m.backups.selectBackupHint}
            </div>
          )}

          <div className="grid gap-3">
            <div>
              <h2 className="text-base font-semibold">{m.backups.restoreSection}</h2>
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
                {m.backups.emptyRestores}
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{m.backups.columns.created}</TableHead>
                      <TableHead>{m.common.status}</TableHead>
                      <TableHead>{m.systemLogs.columns.tenant}</TableHead>
                      <TableHead>{m.backups.restoreColumns.reviewer}</TableHead>
                      <TableHead>{m.backups.restoreColumns.reviewedAt}</TableHead>
                      <TableHead>{m.backups.restoreColumns.reviewNote}</TableHead>
                      <TableHead>{m.backups.restoreColumns.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {restoreRequests.map((restoreRequest) => (
                      <TableRow key={restoreRequest.id}>
                        <TableCell>
                          {formatDate(restoreRequest.createdAt, m, formatDateTime)}
                        </TableCell>
                        <TableCell>
                          <RestoreRequestReviewActions
                            restoreRequest={restoreRequest}
                            onReviewed={handleRestoreRequestReviewed}
                          />
                        </TableCell>
                        <TableCell>
                          {restoreRequest.tenantId ?? m.common.platform}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {restoreRequest.reviewedBy ?? m.common.notSet}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(
                            restoreRequest.reviewedAt,
                            m,
                            formatDateTime,
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {restoreRequest.reviewNote ?? m.common.notSet}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {restoreRequest.reason}
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

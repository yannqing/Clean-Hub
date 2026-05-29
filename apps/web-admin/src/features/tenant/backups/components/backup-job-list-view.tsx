"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { useMemo, useState } from "react";

import {
  backupJobStatusLabels,
  backupJobStatusOptions,
} from "../constants";
import type { BackupJobListItem, BackupJobStatus } from "../types";
import { CreateBackupJobForm } from "./create-backup-job-form";
import { CreateRestoreRequestForm } from "./create-restore-request-form";

type BackupJobListViewProps = {
  initialBackupJobs: BackupJobListItem[];
};

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusVariant(status: BackupJobStatus) {
  if (status === "succeeded") {
    return "default";
  }

  if (status === "failed") {
    return "destructive";
  }

  return "secondary";
}

export function BackupJobListView({
  initialBackupJobs,
}: BackupJobListViewProps) {
  const [backupJobs, setBackupJobs] = useState(initialBackupJobs);
  const [statusFilter, setStatusFilter] = useState<BackupJobStatus | "all">(
    "all",
  );
  const [selectedBackupJobId, setSelectedBackupJobId] = useState<string | null>(
    initialBackupJobs[0]?.id ?? null,
  );

  const filteredBackupJobs = useMemo(
    () =>
      statusFilter === "all"
        ? backupJobs
        : backupJobs.filter((backupJob) => backupJob.status === statusFilter),
    [backupJobs, statusFilter],
  );
  const selectedBackupJob =
    backupJobs.find((backupJob) => backupJob.id === selectedBackupJobId) ??
    null;

  function handleBackupJobCreated(backupJob: BackupJobListItem) {
    setBackupJobs((current) => [backupJob, ...current]);
    setSelectedBackupJobId(backupJob.id);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <Badge variant="secondary">Tenant backups</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Data Backups
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Track tenant-scoped backup task records and submit restore review
            requests without executing database dump or restore commands.
          </p>
        </div>

        <div className="grid min-w-48 gap-2">
          <Label htmlFor="tenant-backup-status-filter">Status</Label>
          <Select
            onValueChange={(value) =>
              setStatusFilter(value as BackupJobStatus | "all")
            }
            value={statusFilter}
          >
            <SelectTrigger id="tenant-backup-status-filter">
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
      </div>

      <CreateBackupJobForm onCreated={handleBackupJobCreated} />

      <Card>
        <CardHeader>
          <CardTitle>Backup Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredBackupJobs.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <h2 className="text-base font-semibold">No backup tasks found</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a manual backup task record to start the review trail.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Task ID</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested by</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Finished</TableHead>
                    <TableHead>Failure</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBackupJobs.map((backupJob) => (
                    <TableRow key={backupJob.id}>
                      <TableCell>{formatDate(backupJob.createdAt)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {backupJob.id}
                      </TableCell>
                      <TableCell>Tenant</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(backupJob.status)}>
                          {backupJobStatusLabels[backupJob.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{backupJob.requestedBy ?? "System"}</TableCell>
                      <TableCell>{formatDate(backupJob.startedAt)}</TableCell>
                      <TableCell>{formatDate(backupJob.finishedAt)}</TableCell>
                      <TableCell>{backupJob.failureReason ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => setSelectedBackupJobId(backupJob.id)}
                          size="sm"
                          type="button"
                          variant={
                            selectedBackupJobId === backupJob.id
                              ? "default"
                              : "outline"
                          }
                        >
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedBackupJob ? (
        <CreateRestoreRequestForm backupJobId={selectedBackupJob.id} />
      ) : (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          Select a backup task before submitting a restore request.
        </div>
      )}
    </div>
  );
}

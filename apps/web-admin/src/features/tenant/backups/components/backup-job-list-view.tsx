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

import { useTenantI18n } from "@/i18n";

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

export function BackupJobListView({
  initialBackupJobs,
}: BackupJobListViewProps) {
  const { m, formatDateTime } = useTenantI18n();
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

  function getStatusVariant(status: BackupJobStatus) {
    if (status === "succeeded") {
      return "default";
    }

    if (status === "failed") {
      return "destructive";
    }

    return "secondary";
  }

  function formatCellDate(value: string | null): string {
    if (!value) {
      return m.backups.placeholders.none;
    }
    return formatDateTime(value);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <Badge variant="secondary">{m.backups.eyebrow}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.backups.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {m.backups.description}
          </p>
        </div>

        <div className="grid min-w-48 gap-2">
          <Label htmlFor="tenant-backup-status-filter">
            {m.backups.statusFilter}
          </Label>
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
              <SelectItem value="all">{m.common.allStatuses}</SelectItem>
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
          <CardTitle>{m.backups.backupTasks}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredBackupJobs.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <h2 className="text-base font-semibold">{m.backups.emptyTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.backups.emptyBody}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.backups.columns.created}</TableHead>
                    <TableHead>{m.backups.columns.taskId}</TableHead>
                    <TableHead>{m.backups.columns.scope}</TableHead>
                    <TableHead>{m.backups.columns.status}</TableHead>
                    <TableHead>{m.backups.columns.requestedBy}</TableHead>
                    <TableHead>{m.backups.columns.started}</TableHead>
                    <TableHead>{m.backups.columns.finished}</TableHead>
                    <TableHead>{m.backups.columns.failure}</TableHead>
                    <TableHead className="text-right">
                      {m.backups.columns.action}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBackupJobs.map((backupJob) => (
                    <TableRow key={backupJob.id}>
                      <TableCell>{formatCellDate(backupJob.createdAt)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {backupJob.id}
                      </TableCell>
                      <TableCell>{m.backups.scopeLabel}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(backupJob.status)}>
                          {backupJobStatusLabels[backupJob.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {backupJob.requestedBy ?? m.backups.placeholders.system}
                      </TableCell>
                      <TableCell>{formatCellDate(backupJob.startedAt)}</TableCell>
                      <TableCell>
                        {formatCellDate(backupJob.finishedAt)}
                      </TableCell>
                      <TableCell>
                        {backupJob.failureReason ?? m.backups.placeholders.none}
                      </TableCell>
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
                          {m.backups.selectAction}
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
          {m.backups.selectHint}
        </div>
      )}
    </div>
  );
}

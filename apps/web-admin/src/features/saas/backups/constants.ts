import type {
  BackupJobScope,
  BackupJobStatus,
  RestoreRequestStatus,
} from "./types";

export const backupJobScopeOptions = [
  { label: "Platform", value: "platform" },
  { label: "Tenant", value: "tenant" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: BackupJobScope;
}>;

export const backupJobStatusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Running", value: "running" },
  { label: "Succeeded", value: "succeeded" },
  { label: "Failed", value: "failed" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: BackupJobStatus;
}>;

export const backupJobScopeLabels: Record<BackupJobScope, string> = {
  platform: "Platform",
  tenant: "Tenant",
};

export const backupJobStatusLabels: Record<BackupJobStatus, string> = {
  pending: "Pending",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

export const restoreRequestStatusLabels: Record<RestoreRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
};

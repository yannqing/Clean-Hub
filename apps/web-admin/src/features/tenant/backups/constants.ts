import type { BackupJobStatus } from "./types";

export const backupJobStatusOptions: { label: string; value: BackupJobStatus }[] = [
  { label: "Pending", value: "pending" },
  { label: "Running", value: "running" },
  { label: "Succeeded", value: "succeeded" },
  { label: "Failed", value: "failed" },
];

export const backupJobStatusLabels: Record<BackupJobStatus, string> = {
  pending: "Pending",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

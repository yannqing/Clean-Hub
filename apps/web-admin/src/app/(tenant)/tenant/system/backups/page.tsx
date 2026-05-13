import { PagePlaceholder } from "@/components/app-shell";

export default function TenantSystemBackupsPage() {
  return (
    <PagePlaceholder
      description="Tenant backup status, data export checkpoints, restore requests, and retention visibility."
      items={["Backup status", "Data exports", "Restore requests", "Retention"]}
      title="Data Backups"
    />
  );
}

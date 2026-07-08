"use client";

import { useSaasI18n } from "@/i18n";

/**
 * Fields a real backup worker would write into `backup_jobs.result_metadata`.
 *
 * The current `BackupJobListItem` DTO does not surface these (no worker
 * populates them yet); this shape is what the UI renders when the metadata is
 * present. Today the panel always shows the "not captured" placeholder.
 */
export type BackupStorageMetadataValue = {
  dumpUrl?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  storageType?: string | null;
};

type BackupStorageMetadataProps = {
  /** Storage metadata for the selected backup job; `undefined` when not captured. */
  metadata?: BackupStorageMetadataValue | null;
};

/**
 * Read-only panel that surfaces the dump artifact metadata for a backup job.
 *
 * Reads from the free-form `result_metadata` jsonb the worker will eventually
 * populate. Until then it renders an honest "not captured yet" line so the UI
 * never implies a dump exists when one doesn't.
 */
export function BackupStorageMetadata({
  metadata,
}: BackupStorageMetadataProps) {
  const { m } = useSaasI18n();

  const rows: Array<{ label: string; value: string }> = [];
  if (metadata?.dumpUrl) {
    rows.push({ label: m.backups.storageMetadata.dumpUrl, value: metadata.dumpUrl });
  }
  if (typeof metadata?.sizeBytes === "number") {
    rows.push({
      label: m.backups.storageMetadata.sizeBytes,
      value: metadata.sizeBytes.toLocaleString(),
    });
  }
  if (metadata?.checksum) {
    rows.push({
      label: m.backups.storageMetadata.checksum,
      value: metadata.checksum,
    });
  }
  if (metadata?.storageType) {
    rows.push({
      label: m.backups.storageMetadata.storageType,
      value: metadata.storageType,
    });
  }

  return (
    <div className="grid gap-1 rounded-md border bg-muted/30 p-3 text-xs">
      <p className="font-medium uppercase tracking-wide text-muted-foreground">
        {m.backups.storageMetadata.title}
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          {m.backups.storageMetadata.notCaptured}
        </p>
      ) : (
        <dl className="grid gap-1">
          {rows.map((row) => (
            <div className="grid grid-cols-[auto_1fr] gap-2" key={row.label}>
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="break-all font-mono">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

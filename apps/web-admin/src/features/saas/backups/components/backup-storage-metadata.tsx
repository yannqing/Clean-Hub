"use client";

import { useSaasI18n } from "@/i18n";

/** Verified artifact metadata written by the PostgreSQL backup worker. */
export type BackupStorageMetadataValue = {
  dumpUrl?: string | null;
  dumpKey?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  storageType?: string | null;
  physicalScope?: string | null;
};

type BackupStorageMetadataProps = {
  /** Storage metadata for the selected backup job; `undefined` when not captured. */
  metadata?: BackupStorageMetadataValue | null;
};

/**
 * Read-only panel that surfaces the dump artifact metadata for a backup job.
 *
 * Reads from `result_metadata` and never implies a dump exists before the
 * backup worker records a successful verification.
 */
export function BackupStorageMetadata({
  metadata,
}: BackupStorageMetadataProps) {
  const { m } = useSaasI18n();

  const rows: Array<{ label: string; value: string }> = [];
  if (metadata?.dumpUrl) {
    rows.push({ label: m.backups.storageMetadata.dumpUrl, value: metadata.dumpUrl });
  }
  if (metadata?.dumpKey) {
    rows.push({ label: m.backups.storageMetadata.dumpKey, value: metadata.dumpKey });
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
  if (metadata?.physicalScope === "platform") {
    rows.push({ label: m.backups.detail.scope, value: m.common.platform });
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

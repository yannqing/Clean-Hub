"use client";

import {
  Button,
  Label,
  Textarea,
  toast,
} from "@cleanhub/ui";
import { useState, type FormEvent } from "react";

import { useTenantI18n } from "@/i18n";

import { createTenantBackupJobAction } from "../actions";
import type { BackupJobListItem } from "../types";

type CreateBackupJobFormProps = {
  onCreated: (backupJob: BackupJobListItem) => void;
};

export function CreateBackupJobForm({ onCreated }: CreateBackupJobFormProps) {
  const { m } = useTenantI18n();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const result = await createTenantBackupJobAction({
      reason,
    });

    if (result.ok) {
      toast.success(m.backups.manualBackup.createdToast);
      setReason("");
      onCreated(result.data);
    } else {
      toast.error(result.error);
    }

    setSubmitting(false);
  }

  return (
    <form className="grid gap-4 rounded-md border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-base font-semibold">
          {m.backups.manualBackup.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {m.backups.manualBackup.description}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tenant-backup-reason">
          {m.backups.manualBackup.reason}
        </Label>
        <Textarea
          id="tenant-backup-reason"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder={m.backups.manualBackup.reasonPlaceholder}
          value={reason}
        />
      </div>

      <div className="flex justify-end">
        <Button disabled={submitting} type="submit">
          {submitting
            ? m.backups.manualBackup.creating
            : m.backups.manualBackup.action}
        </Button>
      </div>
    </form>
  );
}

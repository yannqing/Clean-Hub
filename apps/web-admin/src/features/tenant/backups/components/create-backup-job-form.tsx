"use client";

import {
  Button,
  Label,
  Textarea,
  toast,
} from "@cleanhub/ui";
import { useState, type FormEvent } from "react";

import { createTenantBackupJobAction } from "../actions";
import type { BackupJobListItem } from "../types";

type CreateBackupJobFormProps = {
  onCreated: (backupJob: BackupJobListItem) => void;
};

export function CreateBackupJobForm({ onCreated }: CreateBackupJobFormProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const result = await createTenantBackupJobAction({
      reason,
    });

    if (result.ok) {
      toast.success("Backup task record created.");
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
        <h2 className="text-base font-semibold">Manual Backup</h2>
        <p className="text-sm text-muted-foreground">
          Creates a tenant-scoped task record only. Database dump execution is
          handled outside this tenant console.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tenant-backup-reason">Reason</Label>
        <Textarea
          id="tenant-backup-reason"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Optional note for this backup task"
          value={reason}
        />
      </div>

      <div className="flex justify-end">
        <Button disabled={submitting} type="submit">
          {submitting ? "Creating..." : "Create backup task"}
        </Button>
      </div>
    </form>
  );
}

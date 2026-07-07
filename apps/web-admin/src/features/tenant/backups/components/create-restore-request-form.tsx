"use client";

import { Button, Label, Textarea, toast } from "@cleanhub/ui";
import { useState, type FormEvent } from "react";

import { useTenantI18n } from "@/i18n";

import { createTenantRestoreRequestAction } from "../actions";

type CreateRestoreRequestFormProps = {
  backupJobId: string;
};

export function CreateRestoreRequestForm({
  backupJobId,
}: CreateRestoreRequestFormProps) {
  const { m } = useTenantI18n();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const result = await createTenantRestoreRequestAction(backupJobId, {
      reason,
    });

    if (result.ok) {
      toast.success(m.backups.restoreRequest.submittedToast);
      setReason("");
    } else {
      toast.error(result.error);
    }

    setSubmitting(false);
  }

  return (
    <form className="grid gap-3 rounded-md border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-base font-semibold">
          {m.backups.restoreRequest.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {m.backups.restoreRequest.description}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`tenant-restore-reason-${backupJobId}`}>
          {m.backups.restoreRequest.reason}
        </Label>
        <Textarea
          id={`tenant-restore-reason-${backupJobId}`}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder={m.backups.restoreRequest.reasonPlaceholder}
          value={reason}
        />
      </div>

      <div className="flex justify-end">
        <Button disabled={submitting} type="submit">
          {submitting
            ? m.backups.restoreRequest.submitting
            : m.backups.restoreRequest.action}
        </Button>
      </div>
    </form>
  );
}

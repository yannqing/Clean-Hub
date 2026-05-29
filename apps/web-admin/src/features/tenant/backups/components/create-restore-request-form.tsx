"use client";

import { Button, Label, Textarea, toast } from "@cleanhub/ui";
import { useState, type FormEvent } from "react";

import { createTenantRestoreRequestAction } from "../actions";

type CreateRestoreRequestFormProps = {
  backupJobId: string;
};

export function CreateRestoreRequestForm({
  backupJobId,
}: CreateRestoreRequestFormProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const result = await createTenantRestoreRequestAction(backupJobId, {
      reason,
    });

    if (result.ok) {
      toast.success("Restore request submitted.");
      setReason("");
    } else {
      toast.error(result.error);
    }

    setSubmitting(false);
  }

  return (
    <form className="grid gap-3 rounded-md border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-base font-semibold">Restore Request</h2>
        <p className="text-sm text-muted-foreground">
          Submits a review request only. Tenant users cannot directly restore
          production data.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`tenant-restore-reason-${backupJobId}`}>
          Restore reason
        </Label>
        <Textarea
          id={`tenant-restore-reason-${backupJobId}`}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain why this backup should be restored"
          value={reason}
        />
      </div>

      <div className="flex justify-end">
        <Button disabled={submitting} type="submit">
          {submitting ? "Submitting..." : "Submit restore request"}
        </Button>
      </div>
    </form>
  );
}

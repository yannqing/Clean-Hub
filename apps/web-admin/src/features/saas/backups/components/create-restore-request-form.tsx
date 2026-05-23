"use client";

import { Button, Label, Textarea, toast } from "@cleanhub/ui";
import { useState, type FormEvent } from "react";

import { createRestoreRequestAction } from "../actions";
import type { RestoreRequest } from "../types";

type CreateRestoreRequestFormProps = {
  backupJobId: string;
  onCreated: (restoreRequest: RestoreRequest) => void;
};

export function CreateRestoreRequestForm({
  backupJobId,
  onCreated,
}: CreateRestoreRequestFormProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const result = await createRestoreRequestAction(backupJobId, {
      reason,
    });

    if (result.ok) {
      toast.success("Restore request submitted.");
      setReason("");
      onCreated(result.data);
    } else {
      toast.error(result.error);
    }

    setSubmitting(false);
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor={`restore-reason-${backupJobId}`}>Restore reason</Label>
        <Textarea
          id={`restore-reason-${backupJobId}`}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain why this restore needs manual review"
          value={reason}
        />
      </div>

      <Button disabled={submitting} type="submit" variant="outline">
        {submitting ? "Submitting..." : "Submit restore request"}
      </Button>
    </form>
  );
}

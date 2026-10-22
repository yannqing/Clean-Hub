"use client";

import { Button, Label, Textarea, toast } from "@cleanhub/ui";
import { useState, type FormEvent } from "react";

import { useSaasI18n } from "@/i18n";
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
  const { m } = useSaasI18n();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const result = await createRestoreRequestAction(backupJobId, {
      reason,
    });

    if (result.ok) {
      toast.success(m.backups.restoreSubmitted);
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
        <Label htmlFor={`restore-reason-${backupJobId}`}>
          {m.backups.restoreReason}
        </Label>
        <Textarea
          className="min-h-20"
          id={`restore-reason-${backupJobId}`}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder={m.backups.restoreReasonPlaceholder}
          value={reason}
        />
      </div>

      <Button
        className="h-8 text-xs"
        disabled={submitting}
        size="sm"
        type="submit"
        variant="outline"
      >
        {submitting ? m.common.submitting : m.backups.submitRestore}
      </Button>
    </form>
  );
}

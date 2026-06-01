"use client";

import { Button, Input, Label, toast } from "@cleanhub/ui";
import { useState } from "react";

import { useSaasI18n } from "@/i18n";
import { updateFeedbackTicketAssigneeAction } from "../actions";
import type { FeedbackTicketDetail } from "../types";

type FeedbackTicketAssigneeControlProps = {
  assigneeUserId: string | null;
  ticketId: string;
  onUpdated: (ticket: FeedbackTicketDetail) => void;
};

export function FeedbackTicketAssigneeControl({
  assigneeUserId,
  ticketId,
  onUpdated,
}: FeedbackTicketAssigneeControlProps) {
  const { m } = useSaasI18n();
  const [value, setValue] = useState(assigneeUserId ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const result = await updateFeedbackTicketAssigneeAction(ticketId, {
      assigneeUserId: value.trim() || null,
    });

    if (result.ok) {
      toast.success(m.feedback.assignee.updated);
      setValue(result.data.assigneeUserId ?? "");
      onUpdated(result.data);
    } else {
      toast.error(result.error);
    }

    setSubmitting(false);
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor={`feedback-assignee-${ticketId}`}>
          {m.feedback.assignee.label}
        </Label>
        <Input
          id={`feedback-assignee-${ticketId}`}
          onChange={(event) => setValue(event.target.value)}
          placeholder={m.feedback.assignee.placeholder}
          value={value}
        />
      </div>

      <Button
        disabled={submitting || value.trim() === (assigneeUserId ?? "")}
        type="submit"
        variant="outline"
      >
        {submitting ? m.common.saving : m.feedback.assignee.submit}
      </Button>
    </form>
  );
}

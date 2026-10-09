"use client";

import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@cleanhub/ui";
import { useState } from "react";

import { useSaasI18n } from "@/i18n";
import { updateFeedbackTicketStatusAction } from "../actions";
import { feedbackTicketStatusOptions } from "../constants";
import type {
  FeedbackTicketDetail,
  FeedbackTicketStatus,
  UpdateFeedbackTicketStatusInput,
} from "../types";

type FeedbackTicketStatusControlProps = {
  ticketId: string;
  status: FeedbackTicketStatus;
  onUpdated: (ticket: FeedbackTicketDetail) => void;
};

export function FeedbackTicketStatusControl({
  ticketId,
  status,
  onUpdated,
}: FeedbackTicketStatusControlProps) {
  const { m } = useSaasI18n();
  const [value, setValue] = useState<FeedbackTicketStatus>(status);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const input: UpdateFeedbackTicketStatusInput = {
      status: value,
      reason,
    };
    const result = await updateFeedbackTicketStatusAction(ticketId, input);

    if (result.ok) {
      toast.success(m.feedbackTickets.status.updated);
      setReason("");
      onUpdated(result.data);
    } else {
      toast.error(result.error);
    }

    setSubmitting(false);
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor={`feedback-status-${ticketId}`}>{m.feedbackTickets.status.label}</Label>
        <Select
          onValueChange={(nextValue) =>
            setValue(nextValue as FeedbackTicketStatus)
          }
          value={value}
        >
          <SelectTrigger
            className="w-full"
            id={`feedback-status-${ticketId}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {feedbackTicketStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.value === "open"
                  ? m.common.statusLabels.open
                  : option.value === "in_progress"
                    ? m.common.statusLabels.inProgress
                    : option.value === "resolved"
                      ? m.common.statusLabels.resolved
                      : m.common.statusLabels.closed}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`feedback-status-reason-${ticketId}`}>
          {m.feedbackTickets.status.reason}
        </Label>
        <Textarea
          id={`feedback-status-reason-${ticketId}`}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder={m.feedbackTickets.status.reasonPlaceholder}
          value={reason}
        />
      </div>

      <Button disabled={submitting || value === status} type="submit">
        {submitting ? m.common.saving : m.feedbackTickets.status.submit}
      </Button>
    </form>
  );
}

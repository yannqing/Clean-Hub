import type { FeedbackTicketStatus } from "./types";

export const feedbackTicketStatusOptions = [
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: FeedbackTicketStatus;
}>;

export const feedbackTicketStatusLabels: Record<FeedbackTicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const feedbackTicketPriorityOptions = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
] as const;

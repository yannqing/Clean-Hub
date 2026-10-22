export type FeedbackTicketsErrorCode =
  | "FEEDBACK_TICKET_ASSIGNEE_INVALID"
  | "FEEDBACK_TICKET_NOT_FOUND";

export class FeedbackTicketsError extends Error {
  constructor(
    public readonly code: FeedbackTicketsErrorCode,
    message: string,
    public readonly status: 404 | 422,
  ) {
    super(message);
    this.name = "FeedbackTicketsError";
  }
}

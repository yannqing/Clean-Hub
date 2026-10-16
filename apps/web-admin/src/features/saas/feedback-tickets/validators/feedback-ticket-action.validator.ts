import type {
  FeedbackTicketStatus,
  UpdateFeedbackTicketAssigneeInput,
  UpdateFeedbackTicketStatusInput,
} from "../types";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const feedbackTicketStatuses = new Set<FeedbackTicketStatus>([
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

type ValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: string;
    };

export function validateFeedbackTicketStatusUpdate(
  input: UpdateFeedbackTicketStatusInput,
): ValidationResult<UpdateFeedbackTicketStatusInput> {
  if (!feedbackTicketStatuses.has(input.status)) {
    return {
      ok: false,
      error: "Select a valid feedback status.",
    };
  }

  const reason = input.reason?.trim();

  if (reason && reason.length > 500) {
    return {
      ok: false,
      error: "Status update reason must be 500 characters or fewer.",
    };
  }

  return {
    ok: true,
    data: {
      status: input.status,
      reason: reason || undefined,
    },
  };
}

export function validateFeedbackTicketAssigneeUpdate(
  input: UpdateFeedbackTicketAssigneeInput,
): ValidationResult<UpdateFeedbackTicketAssigneeInput> {
  if (!input.assigneeUserId) {
    return {
      ok: true,
      data: {
        assigneeUserId: null,
      },
    };
  }

  const assigneeUserId = input.assigneeUserId.trim().toUpperCase();

  if (!ULID_PATTERN.test(assigneeUserId)) {
    return {
      ok: false,
      error: "Assignee user ID must be a valid ULID.",
    };
  }

  return {
    ok: true,
    data: {
      assigneeUserId,
    },
  };
}

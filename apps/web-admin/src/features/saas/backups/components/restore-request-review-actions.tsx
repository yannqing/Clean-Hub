"use client";

import { Badge, Button, Input, Label, toast } from "@cleanhub/ui";
import { useState } from "react";

import { useSaasI18n } from "@/i18n";

import { reviewRestoreRequestAction } from "../actions";
import type {
  ReviewAction,
  RestoreRequest,
  RestoreRequestStatus,
} from "../types";

type RestoreRequestReviewActionsProps = {
  restoreRequest: RestoreRequest;
  canReview: boolean;
  /** Called with the post-review request so the parent list can reconcile. */
  onReviewed: (updated: RestoreRequest) => void;
};

function getStatusVariant(
  status: RestoreRequestStatus,
): "default" | "destructive" | "outline" | "secondary" {
  if (status === "completed") return "default";
  if (status === "rejected") return "destructive";
  if (status === "approved") return "secondary";
  return "outline";
}

/**
 * The review transitions available for a restore request's current status.
 *
 * Only valid forward/lateral transitions are surfaced — terminal states
 * (rejected, completed, cancelled) expose no actions.
 */
function availableActions(status: RestoreRequestStatus): ReviewAction[] {
  switch (status) {
    case "pending":
      return ["approve", "reject", "cancel"];
    case "approved":
      return ["complete", "cancel"];
    case "rejected":
    case "completed":
    case "cancelled":
      return [];
    default:
      return [];
  }
}

/**
 * Per-row restore-request review controls.
 *
 * Renders the current status badge, a review-note input (used by approve/
 * reject), and one button per valid transition. Submitting calls
 * {@link reviewRestoreRequestAction} and forwards the updated request to the
 * parent via `onReviewed`.
 */
export function RestoreRequestReviewActions({
  restoreRequest,
  onReviewed,
  canReview,
}: RestoreRequestReviewActionsProps) {
  const { m } = useSaasI18n();
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);

  const actions = availableActions(restoreRequest.status);

  async function handleAction(action: ReviewAction) {
    setPendingAction(action);

    const input = { reviewNote: note };
    const result = await reviewRestoreRequestAction(
      restoreRequest.id,
      action,
      input,
    );

    setPendingAction(null);

    if (!result.ok) {
      toast.error(result.error || m.backups.reviewToasts.failed);
      return;
    }

    const toastKey: ReviewAction = action;
    const toastMessage =
      toastKey === "approve"
        ? m.backups.reviewToasts.approved
        : toastKey === "reject"
          ? m.backups.reviewToasts.rejected
          : toastKey === "complete"
            ? m.backups.reviewToasts.completed
            : m.backups.reviewToasts.cancelled;
    toast.success(toastMessage);
    setNote("");
    onReviewed(result.data);
  }

  if (!canReview || actions.length === 0) {
    return (
      <Badge variant={getStatusVariant(restoreRequest.status)}>
        {m.common.restoreStatusLabels[restoreRequest.status]}
      </Badge>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Badge
        variant={getStatusVariant(restoreRequest.status)}
        className="w-fit"
      >
        {m.common.restoreStatusLabels[restoreRequest.status]}
      </Badge>

      <div className="grid gap-1">
        <Label
          className="text-xs text-muted-foreground"
          htmlFor={`restore-note-${restoreRequest.id}`}
        >
          {m.backups.review.reviewNote}
        </Label>
        <Input
          className="h-8 text-xs"
          id={`restore-note-${restoreRequest.id}`}
          onChange={(event) => setNote(event.target.value)}
          placeholder={m.backups.review.reviewNotePlaceholder}
          value={note}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const label =
            action === "approve"
              ? m.backups.review.approve
              : action === "reject"
                ? m.backups.review.reject
                : action === "complete"
                  ? m.backups.review.complete
                  : m.backups.review.cancel;
          const variant =
            action === "reject" || action === "cancel" ? "outline" : "default";
          return (
            <Button
              className="h-7 px-2 text-[11px]"
              disabled={
                pendingAction !== null ||
                (action === "complete" && !note.trim())
              }
              key={action}
              onClick={() => handleAction(action)}
              size="sm"
              type="button"
              variant={action === "reject" ? "destructive" : variant}
            >
              {pendingAction === action ? "..." : label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

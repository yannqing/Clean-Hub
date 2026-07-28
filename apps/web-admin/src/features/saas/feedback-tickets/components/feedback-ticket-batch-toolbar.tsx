"use client";

import {
  Button,
  Input,
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

import {
  updateFeedbackTicketAssigneeAction,
  updateFeedbackTicketStatusAction,
} from "../actions";
import { feedbackTicketStatusOptions } from "../constants";
import type { FeedbackTicketStatus } from "../types";

type BatchOutcome = "all" | "partial" | "failed";

type FeedbackTicketBatchToolbarProps = {
  /** IDs of the currently selected tickets. */
  selectedIds: string[];
  /** Called with the IDs that succeeded for a given operation, so the list can refresh them. */
  onOutcome: (succeededIds: string[]) => void;
};

/**
 * Batch action toolbar for the feedback ticket list.
 *
 * Supports three operations over the current selection, each fanned out over
 * the existing single-ticket actions (there is no dedicated batch endpoint yet):
 * - Set status   → `updateFeedbackTicketStatusAction`
 * - Reassign     → `updateFeedbackTicketAssigneeAction`
 * - Close        → `updateFeedbackTicketStatusAction({ status: "closed" })`
 *
 * Per-ticket failures are tolerated: a success toast fires when every selected
 * ticket updated, a partial toast when at least one did, and an error toast
 * when none did. Successful IDs are reported back via `onOutcome` so the parent
 * can re-fetch and clear selection.
 */
export function FeedbackTicketBatchToolbar({
  selectedIds,
  onOutcome,
}: FeedbackTicketBatchToolbarProps) {
  const { m } = useSaasI18n();
  const copy = m.feedbackTickets.batch;

  const [statusValue, setStatusValue] = useState<FeedbackTicketStatus>("open");
  const [statusReason, setStatusReason] = useState("");
  const [assigneeValue, setAssigneeValue] = useState("");
  const [closeReason, setCloseReason] = useState("");

  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [submittingAssignee, setSubmittingAssignee] = useState(false);
  const [submittingClose, setSubmittingClose] = useState(false);

  const noneSelected = selectedIds.length === 0;

  function classifyOutcome(succeededIds: string[]): BatchOutcome {
    if (succeededIds.length === 0) {
      return "failed";
    }

    return succeededIds.length === selectedIds.length ? "all" : "partial";
  }

  function notify(
    outcome: BatchOutcome,
    all: string,
    partial: string,
    failed: string,
  ) {
    if (outcome === "all") {
      toast.success(all);
    } else if (outcome === "partial") {
      toast.warning(partial);
    } else {
      toast.error(failed);
    }
  }

  async function runForEach<T>(
    ids: string[],
    run: (id: string) => Promise<T>,
  ): Promise<string[]> {
    const succeeded: string[] = [];

    await Promise.all(
      ids.map(async (id) => {
        try {
          await run(id);
          succeeded.push(id);
        } catch {
          // Per-ticket failures are summarized at the end; suppress here.
        }
      }),
    );

    return succeeded;
  }

  async function handleApplyStatus() {
    if (noneSelected) {
      return;
    }

    setSubmittingStatus(true);

    const succeeded = await runForEach(selectedIds, (id) =>
      updateFeedbackTicketStatusAction(id, {
        status: statusValue,
        reason: statusReason.trim() || undefined,
      }),
    );

    notify(
      classifyOutcome(succeeded),
      copy.statusApplied,
      copy.statusPartial,
      copy.statusFailed,
    );

    setStatusReason("");
    setSubmittingStatus(false);

    if (succeeded.length > 0) {
      onOutcome(succeeded);
    }
  }

  async function handleApplyAssignee() {
    if (noneSelected) {
      return;
    }

    setSubmittingAssignee(true);

    const succeeded = await runForEach(selectedIds, (id) =>
      updateFeedbackTicketAssigneeAction(id, {
        assigneeUserId: assigneeValue.trim() || null,
      }),
    );

    notify(
      classifyOutcome(succeeded),
      copy.assigneeApplied,
      copy.assigneePartial,
      copy.assigneeFailed,
    );

    setSubmittingAssignee(false);

    if (succeeded.length > 0) {
      onOutcome(succeeded);
    }
  }

  async function handleClose() {
    if (noneSelected) {
      return;
    }

    setSubmittingClose(true);

    const succeeded = await runForEach(selectedIds, (id) =>
      updateFeedbackTicketStatusAction(id, {
        status: "closed",
        reason: closeReason.trim() || undefined,
      }),
    );

    notify(
      classifyOutcome(succeeded),
      copy.closed,
      copy.closedPartial,
      copy.closedFailed,
    );

    setCloseReason("");
    setSubmittingClose(false);

    if (succeeded.length > 0) {
      onOutcome(succeeded);
    }
  }

  if (noneSelected) {
    return null;
  }

  return (
    <div
      className="grid gap-5 border-b bg-muted/40 p-5"
      aria-label={copy.ariaLabel}
      role="group"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">
          {selectedIds.length} {copy.selected}
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Set status */}
        <fieldset className="grid content-start gap-2" disabled={noneSelected}>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {copy.applyStatus}
          </legend>
          <Label className="sr-only" htmlFor="feedback-batch-status">
            {copy.statusLabel}
          </Label>
          <Select
            onValueChange={(value) =>
              setStatusValue(value as FeedbackTicketStatus)
            }
            value={statusValue}
          >
            <SelectTrigger className="w-full" id="feedback-batch-status">
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
          <Label className="sr-only" htmlFor="feedback-batch-status-reason">
            {copy.reason}
          </Label>
          <Textarea
            id="feedback-batch-status-reason"
            maxLength={500}
            onChange={(event) => setStatusReason(event.target.value)}
            placeholder={copy.reasonPlaceholder}
            value={statusReason}
          />
          <Button
            disabled={submittingStatus || noneSelected}
            onClick={handleApplyStatus}
            size="sm"
            type="button"
          >
            {submittingStatus ? m.common.saving : copy.submitStatus}
          </Button>
        </fieldset>

        {/* Reassign */}
        <fieldset className="grid content-start gap-2" disabled={noneSelected}>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {copy.reassign}
          </legend>
          <Label className="sr-only" htmlFor="feedback-batch-assignee">
            {copy.assigneeLabel}
          </Label>
          <Input
            id="feedback-batch-assignee"
            onChange={(event) => setAssigneeValue(event.target.value)}
            placeholder={m.feedbackTickets.assigneePlaceholder}
            value={assigneeValue}
          />
          <Button
            disabled={submittingAssignee || noneSelected}
            onClick={handleApplyAssignee}
            size="sm"
            type="button"
            variant="outline"
          >
            {submittingAssignee ? m.common.saving : copy.submitAssignee}
          </Button>
        </fieldset>

        {/* Close */}
        <fieldset className="grid content-start gap-2" disabled={noneSelected}>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {copy.close}
          </legend>
          <Label className="sr-only" htmlFor="feedback-batch-close-reason">
            {copy.closeReason}
          </Label>
          <Textarea
            id="feedback-batch-close-reason"
            maxLength={500}
            onChange={(event) => setCloseReason(event.target.value)}
            placeholder={copy.closeReasonPlaceholder}
            value={closeReason}
          />
          <Button
            disabled={submittingClose || noneSelected}
            onClick={handleClose}
            size="sm"
            type="button"
            variant="destructive"
          >
            {submittingClose ? m.common.saving : copy.close}
          </Button>
        </fieldset>
      </div>
    </div>
  );
}

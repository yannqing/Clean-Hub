"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { usePosOfflineWrites } from "@/features/offline/lib";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@cleanhub/ui";

import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  TICKET_STATUS_TRANSITIONS,
} from "../constants";
import { isPickupTransition } from "../actions";
import { TicketBadge } from "./ticket-badges";
import type { ServiceTicketStatus } from "@cleanhub/api-client";

type TicketStatusDialogProps = {
  ticketId: string;
  current: ServiceTicketStatus;
  version: number;
  open: boolean;
  onClose: () => void;
};

/**
 * Status-transition picker. Only the legally reachable next states (per the
 * backend state machine) are enabled; the backend still rejects illegal
 * transitions, but disabling them here gives the cashier a cleaner experience.
 *
 * The pickup transition (ready_to_pick → picked_up) runs a settlement check
 * server-side; we surface a hint up-front and translate the
 * `PICKUP_REQUIRES_SETTLEMENT` error into a clear toast.
 */
export function TicketStatusDialog({
  ticketId,
  current,
  version,
  open,
  onClose,
}: TicketStatusDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelReason, setCancelReason] = useState("");
  const { changeTicketStatus } = usePosOfflineWrites();

  const reachable = TICKET_STATUS_TRANSITIONS[current];

  function choose(next: ServiceTicketStatus) {
    const reason = cancelReason.trim();
    if (next === "cancelled" && !reason) {
      toast.error("取消工单时必须填写原因");
      return;
    }
    startTransition(async () => {
      try {
        const result = await changeTicketStatus(ticketId, {
          to: next,
          reason: next === "cancelled" ? reason : undefined,
          version,
        });
        toast.success(
          result.queued
            ? `网络不可用，「${TICKET_STATUS_LABELS[next]}」状态已加入同步队列。`
            : `工单状态已更新为「${TICKET_STATUS_LABELS[next]}」`,
        );
        setCancelReason("");
        onClose();
        if (!result.queued) router.refresh();
      } catch (error) {
        toast.error(getPosApiErrorMessage(error, "工单状态更新失败，请重试。"));
      }
    });
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => !nextOpen && !isPending && onClose()}
      open={open}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>更新工单状态</DialogTitle>
          <DialogDescription>状态更新会记录操作人员与时间。</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {reachable.length === 0 ? (
            <p className="col-span-2 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              当前状态「{TICKET_STATUS_LABELS[current]}」为终态，无法继续流转。
            </p>
          ) : (
            reachable.map((next) => {
              const isPickup = isPickupTransition(next);
              return (
                <Button
                  className="h-12 justify-between"
                  disabled={isPending}
                  key={next}
                  onClick={() => choose(next)}
                  type="button"
                  variant="outline"
                >
                  <span className="flex items-center gap-2">
                    {TICKET_STATUS_LABELS[next]}
                    {isPickup ? (
                      <span className="text-[11px] font-normal text-amber-700">
                        （需校验已结算）
                      </span>
                    ) : null}
                  </span>
                  <TicketBadge tone={TICKET_STATUS_TONES[next]}>
                    {TICKET_STATUS_LABELS[next]}
                  </TicketBadge>
                </Button>
              );
            })
          )}
        </div>
        {reachable.includes("cancelled") ? (
          <div className="grid gap-2">
            <Label htmlFor="ticket-cancel-reason">
              取消原因（选择取消时必填）
            </Label>
            <Textarea
              className="min-h-20"
              disabled={isPending}
              id="ticket-cancel-reason"
              maxLength={500}
              onChange={(event) => setCancelReason(event.target.value)}
              value={cancelReason}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small controller so callers can render a trigger without managing state. */
export function useTicketStatusDialog() {
  const [open, setOpen] = useState(false);
  return {
    open,
    openDialog: () => setOpen(true),
    closeDialog: () => setOpen(false),
  };
}

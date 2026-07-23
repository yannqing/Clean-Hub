"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { usePosOfflineWrites } from "@/features/offline/lib";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

  if (!open) {
    return null;
  }

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">更新工单状态</h2>
            <p className="mt-1 text-sm text-slate-500">
              状态更新会记录操作人员与时间。
            </p>
          </div>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5">
          {reachable.length === 0 ? (
            <p className="col-span-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              当前状态「{TICKET_STATUS_LABELS[current]}」为终态，无法继续流转。
            </p>
          ) : (
            reachable.map((next) => {
              const isPickup = isPickupTransition(next);
              return (
                <button
                  className={`flex h-12 items-center justify-between rounded-lg border px-4 text-sm font-semibold transition ${
                    isPending
                      ? "cursor-wait border-slate-200 text-slate-400"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  disabled={isPending}
                  key={next}
                  onClick={() => choose(next)}
                  type="button"
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
                </button>
              );
            })
          )}
        </div>
        {reachable.includes("cancelled") ? (
          <label className="mx-5 mb-5 grid gap-2 text-sm font-semibold text-slate-700">
            取消原因（选择取消时必填）
            <textarea
              className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-400"
              disabled={isPending}
              maxLength={500}
              onChange={(event) => setCancelReason(event.target.value)}
              value={cancelReason}
            />
          </label>
        ) : null}
        <div className="flex justify-end border-t border-slate-200 p-4">
          <button
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small controller so callers can render a trigger without managing state. */
export function useTicketStatusDialog() {
  const [open, setOpen] = useState(false);
  return { open, openDialog: () => setOpen(true), closeDialog: () => setOpen(false) };
}

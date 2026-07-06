"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { useState, useTransition } from "react";

import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  TICKET_STATUS_TRANSITIONS,
} from "../constants";
import {
  changeTicketStatusAction,
  isPickupTransition,
} from "../actions";
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
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return null;
  }

  const reachable = TICKET_STATUS_TRANSITIONS[current];

  function choose(next: ServiceTicketStatus) {
    startTransition(async () => {
      const result = await changeTicketStatusAction(ticketId, { to: next, version });
      if (result.ok) {
        toast.success(`工单状态已更新为「${TICKET_STATUS_LABELS[next]}」`);
        onClose();
      } else if (result.code === "PICKUP_REQUIRES_SETTLEMENT") {
        toast.error("取件前请先结清关联订单。");
      } else if (result.code === "VERSION_CONFLICT") {
        toast.error("该工单已被他人修改，正在刷新…");
        onClose();
      } else {
        toast.error(result.message);
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
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">更新工单状态</h2>
            <p className="mt-1 text-sm text-slate-500">
              状态更新会记录操作人员与时间。
            </p>
          </div>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
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
        <div className="flex justify-end border-t border-slate-200 p-4">
          <button
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
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

"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { posRoutes } from "@/config";

import { deleteTicketAction } from "../actions";

type TicketDeleteDialogProps = {
  ticketId: string;
  ticketNo: string | null;
  open: boolean;
  onClose: () => void;
};

/**
 * Confirmation dialog before soft-deleting a ticket. On success it redirects
 * back to the list (the detail row no longer exists).
 */
export function TicketDeleteDialog({
  ticketId,
  ticketNo,
  open,
  onClose,
}: TicketDeleteDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return null;
  }

  function confirm() {
    startTransition(async () => {
      const result = await deleteTicketAction(ticketId);
      if (result.ok) {
        toast.success(`工单 ${ticketNo ?? ""} 已删除`);
        router.replace(posRoutes.tickets);
      } else if (result.code === "VERSION_CONFLICT") {
        toast.error("该工单已被他人修改，正在刷新…");
        router.refresh();
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
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-950">删除工单</h2>
          <p className="mt-1 text-sm text-slate-500">
            确定要删除工单
            <span className="mx-1 font-mono font-semibold text-slate-700">
              {ticketNo ?? ticketId.slice(-8).toUpperCase()}
            </span>
            吗？此操作为软删除，将级联删除该工单下的所有项目。
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            disabled={isPending}
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            disabled={isPending}
            onClick={confirm}
            type="button"
          >
            {isPending ? "删除中…" : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

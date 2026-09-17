"use client";

import { posToast as toast } from "@/lib/pos-toast";
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

import { posRoutes } from "@/config";
import { posMessage } from "@/lib/pos-message";

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
  const [reason, setReason] = useState("");

  function confirm() {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      toast.error("请输入删除原因");
      return;
    }
    startTransition(async () => {
      const result = await deleteTicketAction(ticketId, normalizedReason);
      if (result.ok) {
        toast.success(
          posMessage("pos.inline.ticketDeleted", {
            ticketNo: ticketNo ?? "",
          }),
        );
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
    <Dialog
      onOpenChange={(nextOpen) => !nextOpen && !isPending && onClose()}
      open={open}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>删除工单</DialogTitle>
          <DialogDescription>
            确定要删除工单
            <span className="mx-1 font-mono font-semibold text-foreground">
              {ticketNo ?? ticketId.slice(-8).toUpperCase()}
            </span>
            吗？此操作为软删除，将级联删除该工单下的所有项目。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="ticket-delete-reason">删除原因（必填）</Label>
          <Textarea
            className="min-h-24"
            disabled={isPending}
            id="ticket-delete-reason"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || !reason.trim()}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            取消
          </Button>
          <Button
            disabled={isPending}
            onClick={confirm}
            type="button"
            variant="destructive"
          >
            {isPending ? "删除中…" : "确认删除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

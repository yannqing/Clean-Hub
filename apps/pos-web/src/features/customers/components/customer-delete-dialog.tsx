"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { deleteAccount, deleteProfile } from "../queries";

type CustomerDeleteDialogProps = {
  open: boolean;
  kind: "account" | "profile";
  id: string;
  name: string;
  /** Linked profile count (accounts cascade; shows a stronger warning). */
  linkedCount?: number;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

/**
 * Delete confirmation. Account deletion soft-deletes the account AND cascades
 * to its profiles; the warning reflects that. Profile deletion only affects
 * the single profile.
 */
export function CustomerDeleteDialog({
  open,
  kind,
  id,
  name,
  linkedCount = 0,
  onOpenChange,
  onDeleted,
}: CustomerDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");

  const isAccount = kind === "account";
  const warning =
    isAccount && linkedCount > 0
      ? `该账户关联 ${linkedCount} 个客户档案。删除账户会同时删除这些档案，此操作不可恢复。`
      : "删除后该数据将不再出现在查询结果中，此操作不可恢复。";

  async function handleConfirm() {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      toast.warning("请填写删除原因。");
      return;
    }
    setDeleting(true);
    try {
      if (isAccount) {
        await deleteAccount(id, normalizedReason);
      } else {
        await deleteProfile(id, normalizedReason);
      }
      toast.success("数据已删除");
      onDeleted();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "删除失败，请重试。",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setReason("");
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>删除{isAccount ? "客户账户" : "客户档案"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground">确认删除“{name}”吗？</p>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
          {warning}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-foreground">
            删除原因
          </span>
          <textarea
            className="min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </label>
        <DialogFooter>
          <button
            className="h-11 rounded-md border px-4 text-sm font-semibold text-foreground hover:bg-accent"
            disabled={deleting || !reason.trim()}
            type="button"
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <button
            className="h-11 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
            disabled={deleting}
            type="button"
            onClick={handleConfirm}
          >
            {deleting ? "删除中…" : "确认删除"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

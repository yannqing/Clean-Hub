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

  const isAccount = kind === "account";
  const warning =
    isAccount && linkedCount > 0
      ? `该账户关联 ${linkedCount} 个客户档案。删除账户会同时删除这些档案，此操作不可恢复。`
      : "删除后该数据将不再出现在查询结果中，此操作不可恢复。";

  async function handleConfirm() {
    setDeleting(true);
    try {
      if (isAccount) {
        await deleteAccount(id);
      } else {
        await deleteProfile(id);
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            删除{isAccount ? "客户账户" : "客户档案"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-700">
          确认删除“{name}”吗？
        </p>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          {warning}
        </div>
        <DialogFooter>
          <button
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold"
            disabled={deleting}
            type="button"
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <button
            className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
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

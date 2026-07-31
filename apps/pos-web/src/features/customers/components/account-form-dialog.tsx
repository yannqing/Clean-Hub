"use client";

import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posToast as toast } from "@/lib/pos-toast";
import { usePosOfflineWrites } from "@/features/offline/lib";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { updateAccount } from "../queries";
import type { AccountFormValues, PosCustomerAccountDetail } from "../types";

type AccountFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  accountId?: string;
  initial?: AccountFormValues;
  onOpenChange: (open: boolean) => void;
  onSaved: (account: PosCustomerAccountDetail) => void;
};

const EMPTY_FORM: AccountFormValues = {
  accountName: "",
  phone: "",
  email: "",
};

/**
 * Create / edit account dialog. Phone and email are mutually optional but at
 * least one is required (validated both here and on the backend).
 *
 * The parent remounts this component via `key` when the dialog target changes,
 * so the form state initializes directly from `initial` without an effect.
 */
export function AccountFormDialog({
  open,
  mode,
  accountId,
  initial,
  onOpenChange,
  onSaved,
}: AccountFormDialogProps) {
  const [form, setForm] = useState<AccountFormValues>(initial ?? EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const { createCustomerAccount } = usePosOfflineWrites();

  async function handleSubmit() {
    if (!form.accountName.trim()) {
      toast.error("请填写账户名称");
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      toast.error("请至少填写手机号或邮箱");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        accountName: form.accountName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      };
      const createResult =
        mode === "edit" && accountId ? null : await createCustomerAccount(body);
      const result =
        mode === "edit" && accountId
          ? await updateAccount(accountId, body)
          : createResult?.queued
            ? createQueuedAccountDetail(createResult.entityId, body)
            : createResult!.data;
      toast.success(
        createResult?.queued
          ? "网络不可用，客户账户已加入同步队列。"
          : mode === "edit"
            ? "修改已保存"
            : "新增账户已保存",
      );
      onSaved(result);
      onOpenChange(false);
    } catch (error) {
      toast.error(getPosApiErrorMessage(error, "保存失败，请重试。"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "编辑客户账户" : "新增客户账户"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            id="form-account-name"
            label="账户名称"
            onChange={(value) =>
              setForm((current) => ({ ...current, accountName: value }))
            }
            placeholder="例如：Diop Family"
            value={form.accountName}
          />
          <FormField
            id="form-account-phone"
            label="账户手机号"
            onChange={(value) =>
              setForm((current) => ({ ...current, phone: value }))
            }
            placeholder="+221 ..."
            value={form.phone}
          />
          <FormField
            id="form-account-email"
            label="账户邮箱"
            onChange={(value) =>
              setForm((current) => ({ ...current, email: value }))
            }
            placeholder="name@example.com"
            type="email"
            value={form.email}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          账户保存共享联系方式，可关联多个客户档案。
        </p>
        <DialogFooter>
          <button
            className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            disabled={submitting}
            type="button"
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <button
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            disabled={submitting}
            type="button"
            onClick={handleSubmit}
          >
            {submitting ? "保存中…" : "保存"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createQueuedAccountDetail(
  id: string,
  input: { accountName: string; phone?: string; email?: string },
): PosCustomerAccountDetail {
  const now = new Date().toISOString();
  return {
    id,
    accountName: input.accountName,
    phone: input.phone ?? null,
    email: input.email ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

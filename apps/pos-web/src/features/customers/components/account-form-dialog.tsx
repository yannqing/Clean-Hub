"use client";

import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posToast as toast } from "@/lib/pos-toast";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { createAccount, updateAccount } from "../queries";
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
      const result =
        mode === "edit" && accountId
          ? await updateAccount(accountId, body)
          : await createAccount(body);
      toast.success(mode === "edit" ? "修改已保存" : "新增账户已保存");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "编辑客户账户" : "新增客户账户"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="form-account-name"
            label="账户名称"
            onChange={(value) => setForm((current) => ({ ...current, accountName: value }))}
            placeholder="例如：Diop Family"
            value={form.accountName}
          />
          <FormField
            id="form-account-phone"
            label="账户手机号"
            onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
            placeholder="+221 ..."
            value={form.phone}
          />
          <FormField
            id="form-account-email"
            label="账户邮箱"
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            placeholder="name@example.com"
            type="email"
            value={form.email}
          />
        </div>
        <p className="text-sm text-slate-500">
          账户保存共享联系方式，可关联多个客户档案。
        </p>
        <DialogFooter>
          <button
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold"
            disabled={submitting}
            type="button"
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <button
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
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
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

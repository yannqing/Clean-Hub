"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from "@cleanhub/ui";

import { INTAKE_EMPTY_ACCOUNT_FORM } from "../constants";
import { createIntakeAccount } from "../queries";
import type { IntakeCreateAccountInput } from "../types";

type IntakeCreateCustomerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

/**
 * 新建客户账户 dialog for the intake page. Creates a customer account (the
 * shared contact holder). Mirrors the customer-management AccountFormDialog
 * layout (Dialog primitives, h-11 inputs, text-xs labels). Phone and email are
 * mutually optional but at least one is required.
 *
 * The parent remounts this component via `key` when the dialog target changes,
 * so form state initializes from the empty form without an effect.
 */
export function IntakeCreateCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: IntakeCreateCustomerDialogProps) {
  const [form, setForm] = useState<IntakeCreateAccountInput>(
    INTAKE_EMPTY_ACCOUNT_FORM,
  );
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof IntakeCreateAccountInput>(
    key: K,
    value: IntakeCreateAccountInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.accountName.trim()) {
      toast.error("请填写账户名称");
      return;
    }
    if (!form.accountPhone.trim() && !form.accountEmail.trim()) {
      toast.error("请至少填写账户手机号或邮箱");
      return;
    }

    setSubmitting(true);
    try {
      await createIntakeAccount(form);
      toast.success("新增客户账户已保存");
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存失败，请重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建客户账户</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="form-intake-account-name"
            label="账户名称"
            onChange={(value) => update("accountName", value)}
            placeholder="例如：Diop Family"
            value={form.accountName}
          />
          <FormField
            id="form-intake-account-phone"
            label="账户手机号"
            onChange={(value) => update("accountPhone", value)}
            placeholder="+221 ..."
            value={form.accountPhone}
          />
          <FormField
            id="form-intake-account-email"
            label="账户邮箱"
            onChange={(value) => update("accountEmail", value)}
            placeholder="name@example.com"
            type="email"
            value={form.accountEmail}
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

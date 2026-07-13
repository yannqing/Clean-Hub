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

import {
  CUSTOMER_PROFILE_RELATIONSHIPS,
  EMPTY_PROFILE_FORM,
} from "../constants";
import { createProfile, updateProfile } from "../queries";
import type {
  PosCustomerAccountSummary,
  PosCustomerProfileDetail,
  ProfileFormValues,
} from "../types";

type ProfileFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  customerId?: string;
  /** Accounts available for selection when creating a profile. */
  accounts: PosCustomerAccountSummary[];
  /** When drilling into an account, that account is preselected and hidden. */
  lockedAccountId?: string;
  initial?: ProfileFormValues;
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: PosCustomerProfileDetail) => void;
};

/**
 * Create / edit profile dialog. Creating a profile requires selecting an
 * owning account (or it is locked to the drilled-into account).
 *
 * The parent remounts this component via `key` when the dialog target changes,
 * so the form state initializes directly from `initial` without an effect.
 */
export function ProfileFormDialog({
  open,
  mode,
  customerId,
  accounts,
  lockedAccountId,
  initial,
  onOpenChange,
  onSaved,
}: ProfileFormDialogProps) {
  const [form, setForm] = useState<ProfileFormValues>(
    initial ?? {
      ...EMPTY_PROFILE_FORM,
      customerAccountId: lockedAccountId ?? accounts[0]?.id ?? "",
    },
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (mode === "create" && !form.customerAccountId) {
      toast.error("请选择所属账户");
      return;
    }
    if (!form.fullName.trim()) {
      toast.error("请填写档案姓名");
      return;
    }

    setSubmitting(true);
    try {
      const trimOrNull = (value: string) => value.trim() || undefined;
      if (mode === "edit" && customerId) {
        const result = await updateProfile(customerId, {
          fullName: form.fullName.trim(),
          phone: trimOrNull(form.phone),
          email: trimOrNull(form.email),
          relationship: trimOrNull(form.relationship),
          address: trimOrNull(form.address),
          notes: trimOrNull(form.notes),
        });
        toast.success("修改已保存");
        onSaved(result);
      } else {
        await createProfile({
          customerAccountId: form.customerAccountId,
          fullName: form.fullName.trim(),
          phone: trimOrNull(form.phone),
          email: trimOrNull(form.email),
          relationship: trimOrNull(form.relationship),
          address: trimOrNull(form.address),
          notes: trimOrNull(form.notes),
        });
        toast.success("新增档案已保存");
        onSaved({} as PosCustomerProfileDetail);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(getPosApiErrorMessage(error, "保存失败，请重试。"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "编辑客户档案" : "新增客户档案"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            disabled={mode === "edit" || Boolean(lockedAccountId)}
            id="form-profile-account"
            label="所属客户账户"
            onChange={(value) =>
              setForm((current) => ({ ...current, customerAccountId: value }))
            }
            options={accounts.map((account) => ({
              value: account.id,
              label: account.accountName,
            }))}
            value={form.customerAccountId}
          />
          <FormField
            id="form-profile-name"
            label="档案姓名"
            onChange={(value) =>
              setForm((current) => ({ ...current, fullName: value }))
            }
            placeholder="客户姓名"
            value={form.fullName}
          />
          <FormField
            id="form-profile-phone"
            label="档案手机号"
            onChange={(value) =>
              setForm((current) => ({ ...current, phone: value }))
            }
            placeholder="+221 ..."
            value={form.phone}
          />
          <FormField
            id="form-profile-email"
            label="档案邮箱"
            onChange={(value) =>
              setForm((current) => ({ ...current, email: value }))
            }
            placeholder="name@example.com"
            type="email"
            value={form.email}
          />
          <FormField
            id="form-profile-relationship"
            label="账户关系"
            onChange={(value) =>
              setForm((current) => ({ ...current, relationship: value }))
            }
            options={CUSTOMER_PROFILE_RELATIONSHIPS.map((value) => ({
              value,
              label: value,
            }))}
            value={form.relationship}
          />
        </div>
        <p className="text-sm text-slate-500">
          档案代表实际接受服务的个人或成员。
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

type FormFieldProps =
  | {
      id: string;
      label: string;
      value: string;
      onChange: (value: string) => void;
      placeholder?: string;
      type?: string;
      options?: never;
      disabled?: never;
    }
  | {
      id: string;
      label: string;
      value: string;
      onChange: (value: string) => void;
      options: { value: string; label: string }[];
      placeholder?: never;
      type?: never;
      disabled?: boolean;
    };

function FormField(props: FormFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {props.label}
      </span>
      {props.options ? (
        <select
          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400"
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.value)}
          value={props.value}
        >
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
          id={props.id}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          type={props.type ?? "text"}
          value={props.value}
        />
      )}
    </label>
  );
}

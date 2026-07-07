"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import {
  INTAKE_EMPTY_PROFILE_FORM,
  INTAKE_RELATIONSHIP_OPTIONS,
} from "../constants";
import { createIntakeProfile, searchIntakeAccounts } from "../queries";
import type { IntakeCreateProfileInput } from "../types";

type IntakeCreateProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

/**
 * 新建客户档案 dialog for the intake page. A profile always belongs to an
 * account, so the form starts with an account selector (search + list), then
 * captures the profile fields (full name / phone / email / relationship).
 * Mirrors the account-dialog styling (Dialog primitives, h-11 inputs, text-xs
 * labels).
 */
export function IntakeCreateProfileDialog({
  open,
  onOpenChange,
  onCreated,
}: IntakeCreateProfileDialogProps) {
  const [form, setForm] = useState<IntakeCreateProfileInput>(
    INTAKE_EMPTY_PROFILE_FORM,
  );
  const [accountKeyword, setAccountKeyword] = useState("");
  const [accounts, setAccounts] = useState<
    { id: string; accountName: string; phone: string | null; email: string | null }[]
  >([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load account options for the selector whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch; loading flag must flip synchronously before the async call.
    setAccountsLoading(true);
    let cancelled = false;
    searchIntakeAccounts(accountKeyword)
      .then((result) => {
        if (!cancelled) setAccounts(result);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, accountKeyword]);

  function update<K extends keyof IntakeCreateProfileInput>(
    key: K,
    value: IntakeCreateProfileInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function refreshAccounts(keyword: string) {
    setAccountKeyword(keyword);
  }

  async function handleSubmit() {
    if (!form.accountId) {
      toast.error("请选择所属客户账户");
      return;
    }
    if (!form.fullName.trim()) {
      toast.error("请填写档案姓名");
      return;
    }

    setSubmitting(true);
    try {
      await createIntakeProfile(form);
      toast.success("新增客户档案已保存");
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

  const selectedAccount = accounts.find((item) => item.id === form.accountId);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建客户档案</DialogTitle>
        </DialogHeader>

        {/* Account selector */}
        <section>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
            所属账户
          </span>
          <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-white px-3">
            <span className="mr-2 text-slate-400">🔍</span>
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              onChange={(event) => refreshAccounts(event.target.value)}
              placeholder="搜索账户名称、手机号或邮箱"
              value={accountKeyword}
            />
          </div>

          <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200">
            {accountsLoading ? (
              <div className="px-3 py-4 text-center text-xs text-slate-500">
                加载中…
              </div>
            ) : accounts.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-500">
                没有匹配的账户，请先创建客户账户。
              </div>
            ) : (
              accounts.map((account) => {
                const active = account.id === form.accountId;
                return (
                  <button
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-slate-50"
                    }`}
                    key={account.id}
                    type="button"
                    onClick={() => update("accountId", account.id)}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {account.accountName}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {[account.phone, account.email]
                          .filter(Boolean)
                          .join(" · ") || "未填写联系方式"}
                      </div>
                    </div>
                    {active && (
                      <span className="ml-2 shrink-0 text-xs font-semibold">
                        ✓ 已选择
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {selectedAccount && (
            <p className="mt-1.5 text-xs text-slate-500">
              将在「{selectedAccount.accountName}」下新增档案。
            </p>
          )}
        </section>

        {/* Profile fields */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="form-intake-profile-name"
            label="档案姓名"
            onChange={(value) => update("fullName", value)}
            placeholder="客户姓名"
            value={form.fullName}
          />
          <FormField
            id="form-intake-profile-phone"
            label="档案手机号"
            onChange={(value) => update("profilePhone", value)}
            placeholder="+221 ..."
            value={form.profilePhone}
          />
          <FormField
            id="form-intake-profile-email"
            label="档案邮箱"
            onChange={(value) => update("profileEmail", value)}
            placeholder="name@example.com"
            type="email"
            value={form.profileEmail}
          />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              账户关系
            </span>
            <select
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
              onChange={(event) => update("relationship", event.target.value)}
              value={form.relationship}
            >
              {INTAKE_RELATIONSHIP_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

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

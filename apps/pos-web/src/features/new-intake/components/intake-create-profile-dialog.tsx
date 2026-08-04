"use client";

import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posToast as toast } from "@/lib/pos-toast";
import { useEffect, useState } from "react";
import { useTranslation } from "@cleanhub/i18n/react";

import { translatePosText } from "@/components/i18n/pos-runtime-text";
import { Icon } from "@/components/app-shell";
import { usePosOfflineWrites } from "@/features/offline/lib";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { INTAKE_RELATIONSHIP_OPTIONS } from "../constants";
import { searchIntakeAccounts } from "../queries";
import type { IntakeAccountOption, IntakeCreatedProfile } from "../queries";
import type { IntakeCreateProfileInput } from "../types";

type IntakeCreateProfileDialogProps = {
  initialAccount: IntakeAccountOption | null;
  initialAccountKeyword: string;
  initialForm: IntakeCreateProfileInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (profile: IntakeCreatedProfile) => void;
};

/**
 * 新建客户档案 dialog for the intake page. A profile always belongs to an
 * account, so the form starts with an account selector (search + list), then
 * captures the profile fields (full name / phone / email / relationship).
 * Mirrors the account-dialog styling (Dialog primitives, h-11 inputs, text-xs
 * labels).
 */
export function IntakeCreateProfileDialog({
  initialAccount,
  initialAccountKeyword,
  initialForm,
  open,
  onOpenChange,
  onCreated,
}: IntakeCreateProfileDialogProps) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);
  const [form, setForm] = useState<IntakeCreateProfileInput>(initialForm);
  const [accountKeyword, setAccountKeyword] = useState(initialAccountKeyword);
  const [accounts, setAccounts] = useState<IntakeAccountOption[]>(
    initialAccount ? [initialAccount] : [],
  );
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    createCustomerProfile,
    listQueuedCustomerAccounts,
    pendingCount,
  } = usePosOfflineWrites();

  // Load account options for the selector whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch; loading flag must flip synchronously before the async call.
    setAccountsLoading(true);
    let cancelled = false;
    Promise.allSettled([
      searchIntakeAccounts(accountKeyword),
      listQueuedCustomerAccounts(),
    ])
      .then(([remoteResult, queuedResult]) => {
        if (cancelled) return;
        const remoteAccounts =
          remoteResult.status === "fulfilled" ? remoteResult.value : [];
        const normalizedKeyword = accountKeyword.trim().toLowerCase();
        const queuedAccounts =
          queuedResult.status === "fulfilled"
            ? queuedResult.value
                .filter((account) => {
                  if (!normalizedKeyword) return true;
                  return [
                    account.accountName,
                    account.phone,
                    account.email,
                  ].some((value) =>
                    String(value ?? "")
                      .toLowerCase()
                      .includes(normalizedKeyword),
                  );
                })
                .map(
                  (account): IntakeAccountOption => ({
                    id: account.id,
                    accountName: account.accountName,
                    phone: account.phone,
                    email: account.email,
                    syncState: account.syncState,
                    syncError: account.lastError,
                  }),
                )
            : [];

        setAccounts(
          mergeAccountOptions(
            queuedAccounts,
            initialAccount ? [initialAccount] : [],
            remoteAccounts,
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    accountKeyword,
    initialAccount,
    listQueuedCustomerAccounts,
    pendingCount,
  ]);

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
      const account = selectedAccount;
      if (!account) {
        toast.error("请选择所属客户账户");
        return;
      }
      if (account.syncState === "failed") {
        toast.error("该账户同步失败，请先处理同步问题后再新增档案。");
        return;
      }
      const result = await createCustomerProfile(
        form.accountId,
        {
          fullName: form.fullName.trim(),
          phone: form.profilePhone.trim() || undefined,
          email: form.profileEmail.trim() || undefined,
          relationship: form.relationship.trim() || undefined,
        },
        {
          accountName: account.accountName,
          phone: account.phone,
          email: account.email,
        },
      );
      const profile: IntakeCreatedProfile = result.queued
        ? {
            profileId: result.entityId,
            customerAccountId: form.accountId,
            accountName: account.accountName,
            fullName: form.fullName.trim(),
            phone: form.profilePhone.trim() || null,
            email: form.profileEmail.trim() || null,
            queued: true,
          }
        : {
            profileId: result.data.id,
            customerAccountId: result.data.customerAccountId,
            accountName: account.accountName,
            fullName: result.data.fullName,
            phone: result.data.phone,
            email: result.data.email,
            queued: false,
          };
      toast.success(
        result.queued
          ? "客户档案已加入同步队列。"
          : "新增客户档案已保存",
      );
      onOpenChange(false);
      onCreated(profile);
    } catch (error) {
      toast.error(getPosApiErrorMessage(error, "保存失败，请重试。"));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedAccount =
    accounts.find((item) => item.id === form.accountId) ??
    (initialAccount?.id === form.accountId ? initialAccount : undefined);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>{text("新建客户档案")}</DialogTitle>
        </DialogHeader>

        {/* Account selector */}
        <section>
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            {text("所属账户")}
          </span>
          <div className="flex h-11 items-center rounded-lg border border-border bg-background px-3 focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-ring/20">
            <Icon
              className="mr-2 h-4 w-4 text-muted-foreground"
              name="search"
            />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              onChange={(event) => refreshAccounts(event.target.value)}
              placeholder={text("搜索账户名称、手机号或邮箱")}
              value={accountKeyword}
            />
          </div>

          <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border">
            {accountsLoading ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {text("加载中…")}
              </div>
            ) : accounts.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {text("没有匹配的账户，请先创建客户账户。")}
              </div>
            ) : (
              accounts.map((account) => {
                const active = account.id === form.accountId;
                const syncFailed = account.syncState === "failed";
                return (
                  <button
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition ${
                      active ? "bg-muted text-foreground" : "hover:bg-muted/50"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={syncFailed}
                    key={account.id}
                    type="button"
                    onClick={() => update("accountId", account.id)}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        <RawText value={account.accountName} />
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        <RawText
                          value={
                            [account.phone, account.email]
                              .filter(Boolean)
                              .join(" · ") || text("未填写联系方式")
                          }
                        />
                      </div>
                    </div>
                    <span className="ml-2 shrink-0 text-xs font-semibold">
                      {syncFailed
                        ? text("同步待处理")
                        : account.syncState === "pending"
                          ? text("待同步")
                          : active
                            ? `✓ ${text("已选择")}`
                            : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {selectedAccount && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              <RawText
                value={formatProfileAccountNote(
                  selectedAccount.accountName,
                  locale,
                )}
              />
            </p>
          )}
        </section>

        {/* Profile fields */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="form-intake-profile-name"
            label={text("档案姓名")}
            onChange={(value) => update("fullName", value)}
            placeholder={text("客户姓名")}
            value={form.fullName}
          />
          <FormField
            id="form-intake-profile-phone"
            label={text("档案手机号")}
            onChange={(value) => update("profilePhone", value)}
            placeholder="+221 ..."
            value={form.profilePhone}
          />
          <FormField
            id="form-intake-profile-email"
            label={text("档案邮箱")}
            onChange={(value) => update("profileEmail", value)}
            placeholder="name@example.com"
            type="email"
            value={form.profileEmail}
          />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              {text("账户关系")}
            </span>
            <select
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/20"
              onChange={(event) => update("relationship", event.target.value)}
              value={form.relationship}
            >
              {INTAKE_RELATIONSHIP_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {text(value)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DialogFooter>
          <button
            className="h-10 rounded-lg border border-border px-4 text-sm font-semibold"
            disabled={submitting}
            type="button"
            onClick={() => onOpenChange(false)}
          >
            {text("取消")}
          </button>
          <button
            className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
            disabled={submitting || selectedAccount?.syncState === "failed"}
            type="button"
            onClick={handleSubmit}
          >
            {text(submitting ? "保存中…" : "保存")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mergeAccountOptions(
  ...groups: IntakeAccountOption[][]
): IntakeAccountOption[] {
  const merged = new Map<string, IntakeAccountOption>();
  for (const account of groups.flat()) {
    if (!merged.has(account.id)) {
      merged.set(account.id, account);
    }
  }
  return [...merged.values()];
}

function formatProfileAccountNote(accountName: string, locale: string): string {
  if (locale === "en") {
    return `A new profile will be created under “${accountName}”.`;
  }
  if (locale === "fr") {
    return `Un nouveau profil sera créé sous « ${accountName} ».`;
  }
  return `将在「${accountName}」下新增档案。`;
}

function RawText({ value }: { value: string }) {
  return value;
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
        className="h-11 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/20"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

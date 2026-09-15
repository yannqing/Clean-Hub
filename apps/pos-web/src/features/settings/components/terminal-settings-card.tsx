"use client";

import { useState } from "react";

import {
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cleanhub/ui";

import { getCurrencyPayableStep } from "@cleanhub/domain/currency";

import { Icon, type PosIconName } from "@/components/app-shell";

import {
  LOCK_TIMEOUT_OPTIONS,
  CASH_HANDLING_MODE_LABELS,
  PAYMENT_METHOD_OPTIONS,
  PRINT_COPIES_OPTIONS,
  ROUNDING_RULE_OPTIONS,
} from "../constants";
import type { TerminalSettingsFormValues } from "../types";

type TerminalSettingsCardProps = {
  /** Settlement currency, so the card can tell when rounding is meaningless. */
  currency: string;
  initial: TerminalSettingsFormValues;
  loading: boolean;
  mode: TerminalSettingsMode;
  saving: boolean;
  onSave: (values: TerminalSettingsFormValues) => void;
};

/**
 * The coarsest rounding this control can ask for, in storage minor units.
 * A currency whose own smallest payable unit is at least this large rounds
 * every total the same way regardless of the rule.
 */
const COARSEST_ROUNDING_STEP_MINOR = BigInt(100);

/**
 * Each section route edits one slice of the terminal settings. There is no
 * "all" mode: the settings index is a list of entry points, so a card showing
 * every field would duplicate what those routes already own.
 */
export type TerminalSettingsMode =
  | "terminal"
  | "checkout"
  | "printing"
  | "security";

const MODE_COPY: Record<
  TerminalSettingsMode,
  { description: string; icon: PosIconName; title: string }
> = {
  terminal: {
    description: "设置当前收银终端在设备列表中显示的名称。",
    icon: "monitor",
    title: "终端信息",
  },
  checkout: {
    description: "配置当前终端默认使用的支付方式和金额处理规则。",
    icon: "wallet-cards",
    title: "收银偏好",
  },
  printing: {
    description: "配置收据的自动打印策略和默认打印联数。",
    icon: "printer",
    title: "打印设置",
  },
  security: {
    description: "设置终端在无操作后自动锁屏的等待时间。",
    icon: "lock",
    title: "安全设置",
  },
};

function MobileSettingSwitch({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-[76px] items-center gap-4 lg:hidden">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {checked ? "已开启" : "已关闭"}
        </p>
      </div>
      <button
        aria-checked={checked}
        aria-label={label}
        className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? "bg-primary" : "bg-muted-foreground/35"
        }`}
        onClick={() => onCheckedChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={`absolute left-0 top-1 size-6 rounded-full bg-background shadow-sm transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export function TerminalSettingsCard({
  currency,
  initial,
  loading,
  mode,
  saving,
  onSave,
}: TerminalSettingsCardProps) {
  const [form, setForm] = useState<TerminalSettingsFormValues>(initial);
  const copy = MODE_COPY[mode];
  // XOF and other zero-decimal currencies already round to a whole unit, which
  // is coarser than anything this rule can add. Offering the choice would
  // suggest the cashier can change a total that will not move.
  const roundingHasNoEffect =
    getCurrencyPayableStep(currency) >= COARSEST_ROUNDING_STEP_MINOR;

  function updateField<K extends keyof TerminalSettingsFormValues>(
    key: K,
    value: TerminalSettingsFormValues[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  if (loading) {
    return (
      <section
        aria-busy="true"
        className="bg-background lg:overflow-hidden lg:rounded-xl lg:border lg:border-black/10 lg:shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      >
        <header className="pb-7 lg:border-b lg:px-4 lg:py-3">
          <div className="flex items-center gap-2">
            <Icon
              className="hidden h-4 w-4 text-muted-foreground lg:block"
              name={copy.icon}
            />
            <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-sm lg:font-semibold lg:tracking-normal">
              {copy.title}
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground lg:mt-1 lg:text-xs">
            正在加载终端设置…
          </p>
        </header>
        <div className="grid gap-4 lg:p-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              className="h-12 animate-pulse bg-muted lg:h-9 lg:rounded-md"
              key={item}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background lg:overflow-hidden lg:rounded-xl lg:border lg:border-black/10 lg:shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <header className="pb-7 lg:border-b lg:px-4 lg:py-3">
        <div className="flex items-center gap-2">
          <Icon
            className="hidden h-4 w-4 text-muted-foreground lg:block"
            name={copy.icon}
          />
          <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-sm lg:font-semibold lg:tracking-normal">
            {copy.title}
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground lg:mt-1 lg:text-xs lg:leading-5">
          {copy.description}
        </p>
      </header>
      <form onSubmit={handleSubmit}>
        <div className="space-y-7 lg:space-y-5 lg:p-4">
          {/* 设备标签 */}
          {mode === "terminal" ? (
            <div className="space-y-1.5 py-2 lg:py-0">
              <Label
                className="text-base font-medium lg:text-sm"
                htmlFor="terminal-label"
              >
                设备标签
              </Label>
              <Input
                className="h-12 rounded-none border-x-0 border-t-0 bg-transparent px-0 text-base shadow-none lg:h-9 lg:rounded-md lg:border lg:px-3 lg:text-sm"
                id="terminal-label"
                maxLength={64}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="如：前台收银机1"
                value={form.label}
              />
              <p className="text-sm leading-6 text-muted-foreground lg:text-xs lg:leading-normal">
                给终端起一个可读的名称，方便管理多台设备。
              </p>
            </div>
          ) : null}

          {/* 支付与现金策略（门店级，只读） */}
          {mode === "checkout" ? (
            <div className="space-y-2 py-2 lg:py-0">
              <Label className="text-base font-medium lg:text-sm">
                支付与现金策略
              </Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p>
                  已启用：
                  {PAYMENT_METHOD_OPTIONS.filter((option) =>
                    initial.paymentMethodsEnabled.includes(option.value),
                  )
                    .map((option) => option.label)
                    .join("、")}
                </p>
                <p className="mt-1">
                  现金处理：
                  {CASH_HANDLING_MODE_LABELS[initial.cashHandlingMode]}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                支付方式与现金处理由门店统一设置，请在后台「设置 →
                支付」和「设置 → 现金」中调整。
              </p>
            </div>
          ) : null}

          {/* 抹零规则 */}
          {mode === "checkout" ? (
            <div className="space-y-1.5 py-2 lg:py-0">
              <Label className="text-base font-medium lg:text-sm">
                抹零规则
              </Label>
              <Select
                disabled={roundingHasNoEffect}
                onValueChange={(value) =>
                  updateField(
                    "roundingRule",
                    value as TerminalSettingsFormValues["roundingRule"],
                  )
                }
                value={form.roundingRule}
              >
                <SelectTrigger className="h-12 w-full rounded-none border-x-0 border-t-0 bg-transparent px-0 text-base shadow-none lg:h-9 lg:rounded-md lg:border lg:px-3 lg:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUNDING_RULE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roundingHasNoEffect ? (
                <p className="text-sm leading-6 text-muted-foreground lg:text-xs lg:leading-normal">
                  {currency} 没有比 1 更小的面额，金额本就会取整到整数，此设置不会改变任何总额。
                </p>
              ) : null}
            </div>
          ) : null}

          {/* 自动打印收据 */}
          {mode === "printing" ? (
            <>
              <MobileSettingSwitch
                checked={form.autoPrintReceipt}
                label="自动打印收据"
                onCheckedChange={(checked) =>
                  updateField("autoPrintReceipt", checked)
                }
              />
              <div className="hidden items-center gap-3 lg:flex">
                <Checkbox
                  checked={form.autoPrintReceipt}
                  id="auto-print"
                  onCheckedChange={(checked) =>
                    updateField("autoPrintReceipt", checked === true)
                  }
                />
                <Label className="cursor-pointer" htmlFor="auto-print">
                  取衣完成后自动打印收据
                </Label>
              </div>
            </>
          ) : null}

          {/* 打印联数 */}
          {mode === "printing" ? (
            <div className="space-y-1.5 py-2 lg:py-0">
              <Label className="text-base font-medium lg:text-sm">
                打印联数
              </Label>
              <Select
                onValueChange={(value) =>
                  updateField("printCopies", Number(value))
                }
                value={String(form.printCopies)}
              >
                <SelectTrigger className="h-12 w-full rounded-none border-x-0 border-t-0 bg-transparent px-0 text-base shadow-none lg:h-9 lg:rounded-md lg:border lg:px-3 lg:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRINT_COPIES_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* 锁屏超时 */}
          {mode === "security" ? (
            <div className="space-y-1.5 py-2 lg:py-0">
              <Label className="text-base font-medium lg:text-sm">
                自动锁屏
              </Label>
              <Select
                onValueChange={(value) =>
                  updateField("lockTimeoutSeconds", Number(value))
                }
                value={String(form.lockTimeoutSeconds)}
              >
                <SelectTrigger className="h-12 w-full rounded-none border-x-0 border-t-0 bg-transparent px-0 text-base shadow-none lg:h-9 lg:rounded-md lg:border lg:px-3 lg:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCK_TIMEOUT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm leading-6 text-muted-foreground lg:text-xs lg:leading-normal">
                无操作后自动锁定终端，需输入 PIN 解锁。
              </p>
            </div>
          ) : null}
        </div>
        <footer className="mt-8 flex justify-end lg:mt-0 lg:border-t lg:px-4 lg:py-3">
          <button
            className="h-12 w-full rounded-xl bg-foreground px-5 text-base font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50 lg:h-9 lg:w-auto lg:rounded-md lg:px-4 lg:text-sm"
            disabled={saving}
            type="submit"
          >
            {saving ? "保存中…" : "保存设置"}
          </button>
        </footer>
      </form>
    </section>
  );
}

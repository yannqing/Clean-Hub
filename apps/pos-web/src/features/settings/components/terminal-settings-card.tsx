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

import { Icon } from "@/components/app-shell";

import {
  LOCK_TIMEOUT_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PRINT_COPIES_OPTIONS,
  ROUNDING_RULE_OPTIONS,
} from "../constants";
import type { TerminalSettingsFormValues } from "../types";

type TerminalSettingsCardProps = {
  initial: TerminalSettingsFormValues;
  loading: boolean;
  saving: boolean;
  onSave: (values: TerminalSettingsFormValues) => void;
};

export function TerminalSettingsCard({
  initial,
  loading,
  saving,
  onSave,
}: TerminalSettingsCardProps) {
  const [form, setForm] = useState<TerminalSettingsFormValues>(initial);

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
        className="overflow-hidden border-y border-slate-200 bg-white"
      >
        <header className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-slate-500" name="settings" />
            <h2 className="text-sm font-semibold text-slate-950">终端设置</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">正在加载终端设置…</p>
        </header>
        <div className="grid gap-3 p-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              className="h-11 animate-pulse rounded-md bg-slate-100"
              key={item}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden border-y border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" name="settings" />
          <h2 className="text-sm font-semibold text-slate-950">终端设置</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          配置当前终端的收银偏好、打印和锁屏策略。
        </p>
      </header>
      <form onSubmit={handleSubmit}>
        <div className="space-y-5 p-4">
          {/* 设备标签 */}
          <div className="space-y-1.5">
            <Label htmlFor="terminal-label">设备标签</Label>
            <Input
              className="h-11"
              id="terminal-label"
              maxLength={64}
              onChange={(e) => updateField("label", e.target.value)}
              placeholder="如：前台收银机1"
              value={form.label}
            />
            <p className="text-xs text-slate-400">
              给终端起一个可读的名称，方便管理多台设备。
            </p>
          </div>

          {/* 默认支付方式 */}
          <div className="space-y-1.5">
            <Label>默认支付方式</Label>
            <Select
              onValueChange={(value) =>
                updateField(
                  "defaultPaymentMethod",
                  value as TerminalSettingsFormValues["defaultPaymentMethod"],
                )
              }
              value={form.defaultPaymentMethod}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 抹零规则 */}
          <div className="space-y-1.5">
            <Label>抹零规则</Label>
            <Select
              onValueChange={(value) =>
                updateField(
                  "roundingRule",
                  value as TerminalSettingsFormValues["roundingRule"],
                )
              }
              value={form.roundingRule}
            >
              <SelectTrigger className="h-11 w-full">
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
          </div>

          {/* 自动打印收据 */}
          <div className="flex items-center gap-3">
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

          {/* 打印联数 */}
          <div className="space-y-1.5">
            <Label>打印联数</Label>
            <Select
              onValueChange={(value) =>
                updateField("printCopies", Number(value))
              }
              value={String(form.printCopies)}
            >
              <SelectTrigger className="h-11 w-full">
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

          {/* 锁屏超时 */}
          <div className="space-y-1.5">
            <Label>自动锁屏</Label>
            <Select
              onValueChange={(value) =>
                updateField("lockTimeoutSeconds", Number(value))
              }
              value={String(form.lockTimeoutSeconds)}
            >
              <SelectTrigger className="h-11 w-full">
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
            <p className="text-xs text-slate-400">
              无操作后自动锁定终端，需输入 PIN 解锁。
            </p>
          </div>
        </div>
        <footer className="flex justify-end border-t border-slate-200 px-4 py-3">
          <button
            className="h-11 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
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

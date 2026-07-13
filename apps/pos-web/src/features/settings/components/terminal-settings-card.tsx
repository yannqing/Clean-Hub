"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cleanhub/ui";

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
      <Card>
        <CardHeader>
          <CardTitle>终端设置</CardTitle>
          <CardDescription>加载中…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center">
            <div className="text-sm text-slate-400">正在加载终端设置…</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>终端设置</CardTitle>
        <CardDescription>
          配置当前终端的收银偏好、打印和锁屏策略。
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
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
                  <SelectItem
                    key={option.value}
                    value={String(option.value)}
                  >
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
                  <SelectItem
                    key={option.value}
                    value={String(option.value)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400">
              无操作后自动锁定终端，需输入 PIN 解锁。
            </p>
          </div>
        </CardContent>
        <CardFooter className="mt-4">
          <button
            className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={saving}
            type="submit"
          >
            {saving ? "保存中…" : "保存设置"}
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}

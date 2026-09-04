"use client";

import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import {
  Banknote,
  CloudOff,
  LockKeyhole,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { useTenantI18n } from "@/i18n";

import { updatePointOfSaleSettingsAction } from "../actions";
import type {
  PointOfSalePaymentMethod,
  PointOfSaleRoundingRule,
  PointOfSaleSettings,
} from "../types";
import type { PointOfSaleSettingsFormValues } from "../validators";

type PointOfSaleSettingsViewProps = {
  embedded?: boolean;
  error?: string;
  initialSettings?: PointOfSaleSettings;
};

type BooleanSettingProps = {
  checked: boolean;
  disabled: boolean;
  hint: string;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
};

function toFormValues(
  settings: PointOfSaleSettings,
): PointOfSaleSettingsFormValues {
  return {
    cashTrackingEnabled: settings.cashTrackingEnabled,
    requireOpeningFloat: settings.requireOpeningFloat,
    requireClosingCount: settings.requireClosingCount,
    requireReturnReason: settings.requireReturnReason,
    recentCartRetentionHours: settings.recentCartRetentionHours,
    offlineModeEnabled: settings.offlineModeEnabled,
    syncIntervalSeconds: settings.syncIntervalSeconds,
    deviceOfflineAfterSeconds: settings.deviceOfflineAfterSeconds,
    defaultPaymentMethod: settings.defaultPaymentMethod,
    defaultPaymentMethodsEnabled: settings.defaultPaymentMethodsEnabled,
    defaultRoundingRule: settings.defaultRoundingRule,
    taxEnabled: settings.taxEnabled,
    defaultTaxRate: settings.defaultTaxRate,
    pricesIncludeTax: settings.pricesIncludeTax,
    taxRegistrationNumber: settings.taxRegistrationNumber,
    defaultAutoPrintReceipt: settings.defaultAutoPrintReceipt,
    defaultPrintCopies: settings.defaultPrintCopies,
    defaultLockTimeoutSeconds: settings.defaultLockTimeoutSeconds,
    version: settings.version,
  };
}

function BooleanSetting({
  checked,
  disabled,
  hint,
  id,
  label,
  onCheckedChange,
}: BooleanSettingProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/15 p-3.5">
      <Checkbox
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label className="min-w-0 cursor-pointer" htmlFor={id}>
        <span className="block text-xs font-medium">{label}</span>
        <span className="mt-1 block text-[11px] font-normal leading-4 text-muted-foreground">
          {hint}
        </span>
      </Label>
    </div>
  );
}

export function PointOfSaleSettingsView({
  embedded = false,
  error,
  initialSettings,
}: PointOfSaleSettingsViewProps) {
  const { m } = useTenantI18n();
  const [settings, setSettings] = useState(initialSettings);
  const [form, setForm] = useState<PointOfSaleSettingsFormValues | null>(
    initialSettings ? toFormValues(initialSettings) : null,
  );
  const [saving, setSaving] = useState(false);
  const canManage = settings?.canManage === true;
  const changed = useMemo(
    () =>
      Boolean(
        settings &&
        form &&
        JSON.stringify(form) !== JSON.stringify(toFormValues(settings)),
      ),
    [form, settings],
  );
  const disabled = saving || !canManage;

  function update<K extends keyof PointOfSaleSettingsFormValues>(
    key: K,
    value: PointOfSaleSettingsFormValues[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !settings || !canManage) return;

    if (!changed) {
      toast.success(m.pointOfSale.settings.noChanges);
      return;
    }

    if (form.deviceOfflineAfterSeconds < form.syncIntervalSeconds * 2) {
      toast.error(m.pointOfSale.settings.validation.offlineThresholdMinimum);
      return;
    }

    setSaving(true);

    try {
      const result = await updatePointOfSaleSettingsAction(form);

      if (!result.ok) {
        toast.error(m.pointOfSale.settings.saveError);
        return;
      }

      setSettings(result.data);
      setForm(toFormValues(result.data));
      toast.success(m.pointOfSale.settings.saved);
    } catch {
      toast.error(m.pointOfSale.settings.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (error || !settings || !form) {
    return (
      <div
        className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-4 text-sm"
        role="alert"
      >
        {m.pointOfSale.settings.loadError}
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-[900px] space-y-5" onSubmit={submit}>
      {!embedded ? (
        <div>
          <h2 className="text-base font-semibold">
            {m.pointOfSale.settings.title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {m.pointOfSale.settings.description}
          </p>
        </div>
      ) : null}

      {!canManage ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3.5">
          <Icon
            className="mt-0.5 shrink-0 text-muted-foreground"
            icon={ShieldAlert}
            size={17}
          />
          <div>
            <p className="text-xs font-semibold">
              {m.pointOfSale.settings.ownerOnlyTitle}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              {m.pointOfSale.settings.ownerOnlyDescription}
            </p>
          </div>
        </div>
      ) : null}

      <Card className="rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon icon={Banknote} size={15} />
            </span>
            <div>
              <h3 className="text-sm font-semibold">
                {m.pointOfSale.settings.sections.cashTracking}
              </h3>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {m.pointOfSale.settings.sections.cashTrackingDescription}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <BooleanSetting
              checked={form.cashTrackingEnabled}
              disabled={disabled}
              hint={m.pointOfSale.settings.hints.cashTrackingEnabled}
              id="pos-cash-tracking"
              label={m.pointOfSale.settings.fields.cashTrackingEnabled}
              onCheckedChange={(value) => update("cashTrackingEnabled", value)}
            />
            <BooleanSetting
              checked={form.requireOpeningFloat}
              disabled={disabled || !form.cashTrackingEnabled}
              hint={m.pointOfSale.settings.hints.openingFloatRequired}
              id="pos-opening-float"
              label={m.pointOfSale.settings.fields.openingFloatRequired}
              onCheckedChange={(value) => update("requireOpeningFloat", value)}
            />
            <BooleanSetting
              checked={form.requireClosingCount}
              disabled={disabled || !form.cashTrackingEnabled}
              hint={m.pointOfSale.settings.hints.closingCountRequired}
              id="pos-closing-count"
              label={m.pointOfSale.settings.fields.closingCountRequired}
              onCheckedChange={(value) => update("requireClosingCount", value)}
            />
            <BooleanSetting
              checked={form.requireReturnReason}
              disabled={disabled}
              hint={m.pointOfSale.settings.hints.returnReasonRequired}
              id="pos-return-reason"
              label={m.pointOfSale.settings.fields.returnReasonRequired}
              onCheckedChange={(value) => update("requireReturnReason", value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon icon={SlidersHorizontal} size={15} />
            </span>
            <div>
              <h3 className="text-sm font-semibold">
                {m.pointOfSale.settings.sections.operations}
              </h3>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {m.pointOfSale.settings.sections.operationsDescription}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label>新终端默认启用的支付方式</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["cash", "card", "app"] as const).map((method) => {
                  const checked =
                    form.defaultPaymentMethodsEnabled.includes(method);
                  const unavailable =
                    method === "app" &&
                    settings.mobileMoneyProvidersEnabled.length === 0;
                  return (
                    <label
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                        unavailable
                          ? "cursor-not-allowed bg-muted/40 text-muted-foreground"
                          : "cursor-pointer"
                      }`}
                      key={method}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled || unavailable}
                        onCheckedChange={(value) => {
                          const next =
                            value === true
                              ? [...form.defaultPaymentMethodsEnabled, method]
                              : form.defaultPaymentMethodsEnabled.filter(
                                  (candidate) => candidate !== method,
                                );
                          if (next.length === 0) return;
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  defaultPaymentMethodsEnabled: next,
                                  defaultPaymentMethod: next.includes(
                                    current.defaultPaymentMethod,
                                  )
                                    ? current.defaultPaymentMethod
                                    : next[0]!,
                                }
                              : current,
                          );
                        }}
                      />
                      {m.pointOfSale.settings.paymentMethods[method]}
                    </label>
                  );
                })}
              </div>
              {settings.mobileMoneyProvidersEnabled.length === 0 ? (
                <p className="text-[11px] leading-4 text-amber-700">
                  请先在“支付”设置中绑定、验证并启用 Wave 或 Orange
                  Money，之后才能把移动支付设为新终端默认方式。
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-cart-retention">
                {m.pointOfSale.settings.fields.recentCartRetentionHours}
              </Label>
              <div className="relative">
                <Input
                  className="pr-16"
                  disabled={disabled}
                  id="pos-cart-retention"
                  max={720}
                  min={1}
                  onChange={(event) =>
                    update(
                      "recentCartRetentionHours",
                      Number(event.target.value),
                    )
                  }
                  type="number"
                  value={form.recentCartRetentionHours}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {m.pointOfSale.settings.hours}
                </span>
              </div>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {m.pointOfSale.settings.hints.recentCartRetentionHours}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon icon={CloudOff} size={15} />
            </span>
            <div>
              <h3 className="text-sm font-semibold">
                {m.pointOfSale.settings.sections.offline}
              </h3>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {m.pointOfSale.settings.sections.offlineDescription}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <BooleanSetting
              checked={form.offlineModeEnabled}
              disabled={disabled}
              hint={m.pointOfSale.settings.hints.offlineModeEnabled}
              id="pos-offline-mode"
              label={m.pointOfSale.settings.fields.offlineModeEnabled}
              onCheckedChange={(value) => update("offlineModeEnabled", value)}
            />
            <div className="grid gap-2">
              <Label htmlFor="pos-sync-interval">
                {m.pointOfSale.settings.fields.syncIntervalSeconds}
              </Label>
              <div className="relative">
                <Input
                  className="pr-16"
                  disabled={disabled}
                  id="pos-sync-interval"
                  max={3600}
                  min={5}
                  onChange={(event) =>
                    update("syncIntervalSeconds", Number(event.target.value))
                  }
                  type="number"
                  value={form.syncIntervalSeconds}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {m.pointOfSale.settings.seconds}
                </span>
              </div>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {m.pointOfSale.settings.hints.syncIntervalSeconds}
              </p>
            </div>
            <div className="grid gap-2 sm:col-start-2">
              <Label htmlFor="pos-offline-threshold">
                {m.pointOfSale.settings.fields.deviceOfflineAfterSeconds}
              </Label>
              <div className="relative">
                <Input
                  className="pr-16"
                  disabled={disabled}
                  id="pos-offline-threshold"
                  max={86400}
                  min={Math.max(10, form.syncIntervalSeconds * 2)}
                  onChange={(event) =>
                    update(
                      "deviceOfflineAfterSeconds",
                      Number(event.target.value),
                    )
                  }
                  type="number"
                  value={form.deviceOfflineAfterSeconds}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {m.pointOfSale.settings.seconds}
                </span>
              </div>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {m.pointOfSale.settings.hints.deviceOfflineAfterSeconds}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon icon={Settings2} size={15} />
            </span>
            <div>
              <h3 className="text-sm font-semibold">
                {m.pointOfSale.settings.sections.deviceDefaults}
              </h3>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {m.pointOfSale.settings.sections.deviceDefaultsDescription}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pos-default-payment">
                {m.pointOfSale.settings.fields.defaultPaymentMethod}
              </Label>
              <Select
                disabled={disabled}
                onValueChange={(value) =>
                  update(
                    "defaultPaymentMethod",
                    value as PointOfSalePaymentMethod,
                  )
                }
                value={form.defaultPaymentMethod}
              >
                <SelectTrigger id="pos-default-payment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["cash", "card", "app"] as const)
                    .filter((method) =>
                      form.defaultPaymentMethodsEnabled.includes(method),
                    )
                    .map((method) => (
                      <SelectItem key={method} value={method}>
                        {m.pointOfSale.settings.paymentMethods[method]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pos-default-rounding">
                {m.pointOfSale.settings.fields.roundingRule}
              </Label>
              <Select
                disabled={disabled}
                onValueChange={(value) =>
                  update(
                    "defaultRoundingRule",
                    value as PointOfSaleRoundingRule,
                  )
                }
                value={form.defaultRoundingRule}
              >
                <SelectTrigger id="pos-default-rounding">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {m.pointOfSale.settings.roundingRules.none}
                  </SelectItem>
                  <SelectItem value="round_yuan">
                    {m.pointOfSale.settings.roundingRules.roundYuan}
                  </SelectItem>
                  <SelectItem value="round_jiao">
                    {m.pointOfSale.settings.roundingRules.roundJiao}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <BooleanSetting
              checked={form.defaultAutoPrintReceipt}
              disabled={disabled}
              hint={m.pointOfSale.settings.hints.autoPrintReceipt}
              id="pos-auto-print"
              label={m.pointOfSale.settings.fields.autoPrintReceipt}
              onCheckedChange={(value) =>
                update("defaultAutoPrintReceipt", value)
              }
            />

            <div className="grid gap-2">
              <Label htmlFor="pos-print-copies">
                {m.pointOfSale.settings.fields.printCopies}
              </Label>
              <div className="relative">
                <Input
                  className="pr-14"
                  disabled={disabled}
                  id="pos-print-copies"
                  max={10}
                  min={1}
                  onChange={(event) =>
                    update("defaultPrintCopies", Number(event.target.value))
                  }
                  type="number"
                  value={form.defaultPrintCopies}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {m.pointOfSale.settings.copies}
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pos-lock-timeout">
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon={LockKeyhole} size={13} />
                  {m.pointOfSale.settings.fields.lockTimeoutSeconds}
                </span>
              </Label>
              <div className="relative">
                <Input
                  className="pr-16"
                  disabled={disabled}
                  id="pos-lock-timeout"
                  max={86400}
                  min={30}
                  onChange={(event) =>
                    update(
                      "defaultLockTimeoutSeconds",
                      Number(event.target.value),
                    )
                  }
                  type="number"
                  value={form.defaultLockTimeoutSeconds}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {m.pointOfSale.settings.seconds}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon icon={Banknote} size={15} />
            </span>
            <div>
              <h3 className="text-sm font-semibold">VAT / 税务设置</h3>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                下单时固化税率、含税方式和税号；历史订单不会随设置变化。
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <BooleanSetting
              checked={form.taxEnabled}
              disabled={disabled}
              hint="启用后，POS 价格预览和结账都会计算并保存 VAT。"
              id="pos-tax-enabled"
              label="启用 VAT"
              onCheckedChange={(value) => update("taxEnabled", value)}
            />
            <BooleanSetting
              checked={form.pricesIncludeTax}
              disabled={disabled || !form.taxEnabled}
              hint="开启表示商品标价已含税；关闭表示税额在小计之外增加。"
              id="pos-prices-include-tax"
              label="标价含税"
              onCheckedChange={(value) => update("pricesIncludeTax", value)}
            />
            <div className="grid gap-2">
              <Label htmlFor="pos-tax-rate">默认 VAT 税率（%）</Label>
              <Input
                disabled={disabled || !form.taxEnabled}
                id="pos-tax-rate"
                max={100}
                min={0}
                onChange={(event) =>
                  update(
                    "defaultTaxRate",
                    String(Number(event.target.value || 0) / 100),
                  )
                }
                step="0.01"
                type="number"
                value={Number(form.defaultTaxRate) * 100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-tax-registration">税务登记号</Label>
              <Input
                disabled={disabled || !form.taxEnabled}
                id="pos-tax-registration"
                maxLength={120}
                onChange={(event) =>
                  update("taxRegistrationNumber", event.target.value || null)
                }
                value={form.taxRegistrationNumber ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex items-center justify-end rounded-xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <Button disabled={disabled || !changed} size="sm" type="submit">
          {saving ? m.pointOfSale.settings.saving : m.pointOfSale.settings.save}
        </Button>
      </div>
    </form>
  );
}

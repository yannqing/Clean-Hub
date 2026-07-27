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
  BadgePercent,
  Check,
  ChevronRight,
  Gift,
  LoaderCircle,
  Plus,
  Store,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { isVersionConflict } from "@/features/tenant/shared/version-conflict";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import { createDiscountAction, updateDiscountAction } from "../actions";
import { formatDiscountDateTimeLocal } from "../date-time";
import type {
  DiscountFormErrorCode,
  DiscountFormErrors,
  DiscountFormField,
  DiscountFormValues,
  DiscountSelectableTarget,
  DiscountType,
  TargetRole,
  TargetType,
  TenantDiscountDetail,
  TenantDiscountOptions,
  TenantDiscountTargetInput,
} from "../types";
import { validateDiscountForm } from "../validators";
import {
  SearchableMultiSelectDialog,
  type MultiSelectDialogItem,
} from "./searchable-multi-select-dialog";

type DiscountFormViewProps = {
  discountType: DiscountType;
  initialDiscount?: TenantDiscountDetail;
  mode?: "create" | "edit";
  options: TenantDiscountOptions;
};

function RequiredMark() {
  return (
    <span aria-hidden className="text-destructive">
      *
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

function defaultValueType(type: DiscountType): DiscountFormValues["valueType"] {
  if (type === "free_shipping" || type === "buy_x_get_y") return "free";
  return "percentage";
}

function createInitialForm(
  type: DiscountType,
  options: TenantDiscountOptions,
  initial?: TenantDiscountDetail,
): DiscountFormValues {
  const now = new Date();
  now.setSeconds(0, 0);

  return {
    title: initial?.title ?? "",
    method: initial?.method ?? "code",
    code: initial?.code ?? "",
    type,
    enabled: initial?.enabled ?? true,
    valueType: initial?.valueType ?? defaultValueType(type),
    valueAmount: initial?.valueAmount ?? "",
    currency:
      initial?.currency ??
      options.currencies[0] ??
      options.branches[0]?.currency ??
      "",
    targetScope: "specific",
    targets: initial?.targets ?? [],
    eligibility: initial?.eligibility ?? "all_customers",
    customerIds: initial?.customerIds ?? [],
    minimumRequirement: initial?.minimumRequirement ?? "none",
    minimumPurchaseAmount: initial?.minimumPurchaseAmount ?? "",
    minimumQuantity: initial?.minimumQuantity ?? "",
    usageLimit:
      initial?.usageLimit === null || initial?.usageLimit === undefined
        ? ""
        : String(initial.usageLimit),
    oncePerCustomer: initial?.oncePerCustomer ?? false,
    combinesWithItemDiscounts: initial?.combinesWithItemDiscounts ?? false,
    combinesWithOrderDiscounts: initial?.combinesWithOrderDiscounts ?? false,
    combinesWithShippingDiscounts:
      initial?.combinesWithShippingDiscounts ?? false,
    startsAt: formatDiscountDateTimeLocal(
      initial?.startsAt ?? now,
      options.timezone,
    ),
    hasEndDate: Boolean(initial?.endsAt),
    endsAt: initial?.endsAt
      ? formatDiscountDateTimeLocal(initial.endsAt, options.timezone)
      : "",
    allBranches: initial?.allBranches ?? options.canManageAllBranches,
    branchIds:
      initial?.branchIds ??
      (options.canManageAllBranches
        ? []
        : options.branches.map((branch) => branch.id)),
    posEnabled: initial?.posEnabled ?? true,
    customerMobileEnabled: initial?.customerMobileEnabled ?? false,
    deliveryEnabled: initial?.deliveryEnabled ?? false,
    buyRequirementType: initial?.buyRequirementType ?? "minimum_quantity",
    buyRequirementValue: initial?.buyRequirementValue ?? "1",
    getQuantity: initial?.getQuantity ?? "1",
    maxUsesPerOrder:
      initial?.maxUsesPerOrder === null ||
      initial?.maxUsesPerOrder === undefined
        ? ""
        : String(initial.maxUsesPerOrder),
    countryScope: initial?.countryScope ?? "all",
    countryCodesInput: initial?.countryCodes.join(", ") ?? "",
    maximumShippingPrice: initial?.maximumShippingPrice ?? "",
    tagsInput: initial?.tags.join(", ") ?? "",
  };
}

function targetValue(target: TenantDiscountTargetInput): string {
  return `${target.targetType}:${target.targetId}`;
}

function parseTargetValue(
  value: string,
): Pick<TenantDiscountTargetInput, "targetType" | "targetId"> | null {
  const separator = value.indexOf(":");
  if (separator <= 0) return null;
  return {
    targetType: value.slice(0, separator) as TargetType,
    targetId: value.slice(separator + 1),
  };
}

export function DiscountFormView({
  discountType,
  initialDiscount,
  mode = "create",
  options,
}: DiscountFormViewProps) {
  const router = useRouter();
  const { locale, m } = useTenantI18n();
  const isEdit = mode === "edit";
  const canManage =
    options.canManage && (!initialDiscount || initialDiscount.canManage);
  const [form, setForm] = useState<DiscountFormValues>(() =>
    createInitialForm(discountType, options, initialDiscount),
  );
  const [errors, setErrors] = useState<DiscountFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [targetRole, setTargetRole] = useState<TargetRole | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);

  useEffect(() => {
    if (!isDirty) return;

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const selectableTargets = useMemo<DiscountSelectableTarget[]>(
    () => [
      ...options.products.map((item) => ({
        id: item.id,
        name: item.name,
        targetType: "product" as const,
      })),
      ...options.productCategories.map((item) => ({
        id: item.id,
        name: item.name,
        targetType: "product_category" as const,
      })),
      ...options.services.map((item) => ({
        id: item.id,
        name: item.name,
        detail: item.categoryName,
        targetType: "service" as const,
      })),
      ...options.serviceCategories.map((item) => ({
        id: item.id,
        name: item.name,
        detail: m.common.businessLineLabels[item.businessLine],
        targetType: "service_category" as const,
      })),
    ],
    [
      m.common.businessLineLabels,
      options.productCategories,
      options.products,
      options.serviceCategories,
      options.services,
    ],
  );
  const targetByValue = useMemo(
    () =>
      new Map(
        selectableTargets.map((target) => [
          `${target.targetType}:${target.id}`,
          target,
        ]),
      ),
    [selectableTargets],
  );
  const targetItems = useMemo<MultiSelectDialogItem[]>(
    () =>
      selectableTargets.map((target) => ({
        value: `${target.targetType}:${target.id}`,
        label: target.name,
        detail: target.detail,
        group: m.discounts.targetTypes[target.targetType],
      })),
    [m.discounts.targetTypes, selectableTargets],
  );
  const branchItems = useMemo<MultiSelectDialogItem[]>(
    () =>
      options.branches.map((branch) => ({
        value: branch.id,
        label: branch.name,
        detail: branch.currency,
      })),
    [options.branches],
  );
  const customerItems = useMemo<MultiSelectDialogItem[]>(
    () =>
      options.customers.map((customer) => ({
        value: customer.id,
        label: customer.fullName,
        detail:
          [customer.phone, customer.email].filter(Boolean).join(" · ") ||
          undefined,
      })),
    [options.customers],
  );

  function errorMessage(field: DiscountFormField): string | undefined {
    const code = errors[field] as DiscountFormErrorCode | undefined;
    return code
      ? m.discounts.form.validation[
          code as keyof typeof m.discounts.form.validation
        ]
      : undefined;
  }

  function update<K extends keyof DiscountFormValues>(
    field: K,
    value: DiscountFormValues[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setIsDirty(true);
  }

  function updateRoleTargets(role: TargetRole, values: string[]) {
    const replacements = values.flatMap((value) => {
      const parsed = parseTargetValue(value);
      return parsed ? [{ role, ...parsed }] : [];
    });

    update("targets", [
      ...form.targets.filter((target) => target.role !== role),
      ...replacements,
    ]);
  }

  function removeTarget(target: TenantDiscountTargetInput) {
    update(
      "targets",
      form.targets.filter(
        (candidate) =>
          !(
            candidate.role === target.role &&
            candidate.targetType === target.targetType &&
            candidate.targetId === target.targetId
          ),
      ),
    );
  }

  function generateCode() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    update(
      "code",
      `CH-${[...bytes]
        .map((value) => value.toString(36).padStart(2, "0"))
        .join("")
        .toUpperCase()}`,
    );
  }

  function handleCancel() {
    if (isDirty && !window.confirm(m.discounts.form.unsavedChanges)) return;
    setIsDirty(false);
    router.push(webAdminRoutes.tenant.discounts);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;

    const validation = validateDiscountForm(form, options.timezone);
    if (!validation.ok) {
      setErrors(validation.errors);
      toast.error(m.discounts.form.validation.checkForm);
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const result =
        isEdit && initialDiscount
          ? await updateDiscountAction(
              initialDiscount.id,
              initialDiscount.version,
              form,
              options.timezone,
            )
          : await createDiscountAction(form, options.timezone);

      if (!result.ok) {
        setErrors(result.errors);
        toast.error(
          isVersionConflict(result)
            ? m.discounts.form.versionConflict
            : result.code?.includes("CODE") &&
                (result.code.includes("DUPLICATE") ||
                  result.code.includes("CONFLICT"))
              ? m.discounts.form.codeConflict
              : Object.keys(result.errors).length > 0
                ? m.discounts.form.validation.checkForm
                : m.discounts.form.saveFailed,
        );
        return;
      }

      setIsDirty(false);
      toast.success(isEdit ? m.discounts.updated : m.discounts.created);
      router.push(webAdminRoutes.tenant.discounts);
      router.refresh();
    } catch {
      toast.error(m.discounts.form.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const needsCurrency =
    form.valueType === "fixed_amount" ||
    form.minimumRequirement === "minimum_amount" ||
    (form.type === "buy_x_get_y" &&
      form.buyRequirementType === "minimum_amount") ||
    (form.type === "free_shipping" &&
      form.maximumShippingPrice.trim().length > 0);
  const selectedBranchCount = form.allBranches
    ? options.branches.length
    : form.branchIds.length;
  const channelCount = [
    form.posEnabled,
    form.customerMobileEnabled,
    form.deliveryEnabled,
  ].filter(Boolean).length;
  const valueSummary =
    form.type === "free_shipping" || form.valueType === "free"
      ? m.discounts.valueTypes.free
      : Number(form.valueAmount) > 0
        ? form.valueType === "percentage"
          ? `${form.valueAmount}%`
          : form.currency
            ? formatMoney(Number(form.valueAmount), form.currency, locale)
            : form.valueAmount
        : m.discounts.form.summary.noValue;
  const pageTitle = isEdit
    ? m.discounts.form.editTitle
    : m.discounts.form.createTitle;

  return (
    <section
      className="mx-auto w-full max-w-[1040px] space-y-3 pb-20"
      data-testid="tenant-discount-form"
    >
      <h1 className="sr-only">{pageTitle}</h1>
      <nav aria-label={m.discounts.form.breadcrumbLabel}>
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              aria-label={m.discounts.title}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={webAdminRoutes.tenant.discounts}
              title={m.discounts.title}
            >
              <Icon aria-hidden icon={BadgePercent} size={16} />
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground">
            <Icon icon={ChevronRight} size={14} />
          </li>
          <li>
            <span aria-current="page" className="font-medium">
              {pageTitle}
            </span>
          </li>
        </ol>
      </nav>

      {!canManage ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {m.discounts.permissionDescription}
        </div>
      ) : null}

      <form
        aria-busy={saving}
        className="space-y-5"
        noValidate
        onSubmit={submit}
      >
        <fieldset className="contents" disabled={saving || !canManage}>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-5 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="discount-title">
                      {m.discounts.form.fields.title} <RequiredMark />
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.title)}
                      autoFocus
                      id="discount-title"
                      maxLength={200}
                      onChange={(event) => update("title", event.target.value)}
                      placeholder={m.discounts.form.placeholders.title}
                      value={form.title}
                    />
                    <FieldError message={errorMessage("title")} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="discount-method">
                        {m.discounts.form.fields.method} <RequiredMark />
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          update(
                            "method",
                            value as DiscountFormValues["method"],
                          )
                        }
                        value={form.method}
                      >
                        <SelectTrigger id="discount-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="code">
                            {m.discounts.methods.code}
                          </SelectItem>
                          <SelectItem value="automatic">
                            {m.discounts.methods.automatic}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>{m.discounts.list.columns.type}</Label>
                      <Input disabled value={m.discounts.types[form.type]} />
                    </div>
                  </div>

                  {form.method === "code" ? (
                    <div className="grid gap-2">
                      <Label htmlFor="discount-code">
                        {m.discounts.form.fields.code} <RequiredMark />
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          aria-invalid={Boolean(errors.code)}
                          className="uppercase"
                          id="discount-code"
                          maxLength={100}
                          onChange={(event) =>
                            update("code", event.target.value.toUpperCase())
                          }
                          placeholder={m.discounts.form.placeholders.code}
                          value={form.code}
                        />
                        <Button
                          className="shrink-0"
                          onClick={generateCode}
                          type="button"
                          variant="outline"
                        >
                          {m.discounts.form.options.generateCode}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {m.discounts.form.hints.code}
                      </p>
                      <FieldError message={errorMessage("code")} />
                    </div>
                  ) : (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {m.discounts.form.hints.method}
                    </p>
                  )}

                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
                    htmlFor="discount-enabled"
                  >
                    <Checkbox
                      checked={form.enabled}
                      id="discount-enabled"
                      onCheckedChange={(checked) =>
                        update("enabled", checked === true)
                      }
                    />
                    <span className="text-sm font-medium">
                      {m.discounts.form.fields.enabled}
                    </span>
                  </label>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-5 py-5">
                  <h2 className="text-sm font-semibold">
                    {m.discounts.form.sections.value}
                  </h2>

                  {form.type !== "free_shipping" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="discount-value-type">
                          {m.discounts.form.fields.valueType}
                        </Label>
                        <Select
                          onValueChange={(value) =>
                            update(
                              "valueType",
                              value as DiscountFormValues["valueType"],
                            )
                          }
                          value={form.valueType}
                        >
                          <SelectTrigger id="discount-value-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">
                              {m.discounts.valueTypes.percentage}
                            </SelectItem>
                            <SelectItem value="fixed_amount">
                              {m.discounts.valueTypes.fixed_amount}
                            </SelectItem>
                            {form.type === "buy_x_get_y" ? (
                              <SelectItem value="free">
                                {m.discounts.valueTypes.free}
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </div>

                      {form.valueType !== "free" ? (
                        <div className="grid gap-2">
                          <Label htmlFor="discount-value">
                            {m.discounts.form.fields.valueAmount}{" "}
                            <RequiredMark />
                          </Label>
                          <Input
                            aria-invalid={Boolean(errors.valueAmount)}
                            id="discount-value"
                            min="0"
                            onChange={(event) =>
                              update("valueAmount", event.target.value)
                            }
                            placeholder={m.discounts.form.placeholders.amount}
                            step="0.01"
                            type="number"
                            value={form.valueAmount}
                          />
                          <FieldError message={errorMessage("valueAmount")} />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                      <Icon icon={Gift} size={16} />
                      {m.discounts.valueTypes.free}
                    </div>
                  )}

                  {needsCurrency ? (
                    <div className="grid max-w-xs gap-2">
                      <Label htmlFor="discount-currency">
                        {m.discounts.form.fields.currency} <RequiredMark />
                      </Label>
                      <Select
                        onValueChange={(value) => update("currency", value)}
                        value={form.currency}
                      >
                        <SelectTrigger
                          aria-invalid={Boolean(errors.currency)}
                          id="discount-currency"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.currencies.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {m.discounts.form.hints.fixedCurrency}
                      </p>
                      <FieldError message={errorMessage("currency")} />
                    </div>
                  ) : null}

                  {form.type === "buy_x_get_y" ? (
                    <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="discount-buy-requirement">
                          {m.discounts.form.fields.buyRequirementType}
                        </Label>
                        <Select
                          onValueChange={(value) =>
                            update(
                              "buyRequirementType",
                              value as DiscountFormValues["buyRequirementType"],
                            )
                          }
                          value={form.buyRequirementType}
                        >
                          <SelectTrigger id="discount-buy-requirement">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minimum_quantity">
                              {
                                m.discounts.purchaseRequirements
                                  .minimum_quantity
                              }
                            </SelectItem>
                            <SelectItem value="minimum_amount">
                              {m.discounts.purchaseRequirements.minimum_amount}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="discount-buy-value">
                          {m.discounts.form.fields.buyRequirementValue}
                        </Label>
                        <Input
                          aria-invalid={Boolean(errors.buyRequirementValue)}
                          id="discount-buy-value"
                          min="0"
                          onChange={(event) =>
                            update("buyRequirementValue", event.target.value)
                          }
                          step={
                            form.buyRequirementType === "minimum_quantity"
                              ? "0.001"
                              : "0.01"
                          }
                          type="number"
                          value={form.buyRequirementValue}
                        />
                        <FieldError
                          message={errorMessage("buyRequirementValue")}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="discount-get-quantity">
                          {m.discounts.form.fields.getQuantity}
                        </Label>
                        <Input
                          aria-invalid={Boolean(errors.getQuantity)}
                          id="discount-get-quantity"
                          min="0.001"
                          onChange={(event) =>
                            update("getQuantity", event.target.value)
                          }
                          step="0.001"
                          type="number"
                          value={form.getQuantity}
                        />
                        <FieldError message={errorMessage("getQuantity")} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="discount-max-per-order">
                          {m.discounts.form.fields.maxUsesPerOrder}
                        </Label>
                        <Input
                          aria-invalid={Boolean(errors.maxUsesPerOrder)}
                          id="discount-max-per-order"
                          min="1"
                          onChange={(event) =>
                            update("maxUsesPerOrder", event.target.value)
                          }
                          placeholder={m.discounts.form.options.unlimitedUsage}
                          step="1"
                          type="number"
                          value={form.maxUsesPerOrder}
                        />
                        <FieldError message={errorMessage("maxUsesPerOrder")} />
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {form.type === "amount_off_items" ||
              form.type === "buy_x_get_y" ? (
                <Card className="gap-0 rounded-lg py-0 shadow-none">
                  <CardContent className="grid gap-4 py-5">
                    <h2 className="text-sm font-semibold">
                      {m.discounts.form.sections.targets}
                    </h2>

                    <div className="grid gap-4">
                      {(form.type === "buy_x_get_y"
                        ? (["customer_buys", "customer_gets"] as const)
                        : (["applies_to"] as const)
                      ).map((role) => {
                        const selected = form.targets.filter(
                          (target) => target.role === role,
                        );

                        return (
                          <div className="grid gap-2" key={role}>
                            <div className="flex items-center justify-between gap-3">
                              <Label>{m.discounts.targetRoles[role]}</Label>
                              <Button
                                onClick={() => setTargetRole(role)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <Icon aria-hidden icon={Plus} size={13} />
                                {m.discounts.form.buttons.addTargets}
                              </Button>
                            </div>
                            {selected.length > 0 ? (
                              <div className="divide-y rounded-md border">
                                {selected.map((target) => {
                                  const targetOption = targetByValue.get(
                                    targetValue(target),
                                  );
                                  return (
                                    <div
                                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                                      key={`${role}:${targetValue(target)}`}
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium">
                                          {targetOption?.name ??
                                            target.targetId}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {
                                            m.discounts.targetTypes[
                                              target.targetType
                                            ]
                                          }
                                        </span>
                                      </span>
                                      <Button
                                        aria-label={m.common.delete}
                                        onClick={() => removeTarget(target)}
                                        size="icon-sm"
                                        type="button"
                                        variant="ghost"
                                      >
                                        <Icon
                                          aria-hidden
                                          icon={Trash2}
                                          size={13}
                                        />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                                {m.discounts.form.summary.noValue}
                              </p>
                            )}
                          </div>
                        );
                      })}
                      <FieldError message={errorMessage("targets")} />
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {form.type !== "buy_x_get_y" ? (
                <Card className="gap-0 rounded-lg py-0 shadow-none">
                  <CardContent className="grid gap-4 py-5">
                    <h2 className="text-sm font-semibold">
                      {m.discounts.form.sections.minimum}
                    </h2>
                    <Select
                      onValueChange={(value) =>
                        update(
                          "minimumRequirement",
                          value as DiscountFormValues["minimumRequirement"],
                        )
                      }
                      value={form.minimumRequirement}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            "none",
                            "minimum_amount",
                            "minimum_quantity",
                          ] as const
                        ).map((requirement) => (
                          <SelectItem key={requirement} value={requirement}>
                            {m.discounts.minimumRequirements[requirement]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {form.minimumRequirement === "minimum_amount" ? (
                      <div className="grid max-w-sm gap-2">
                        <Label htmlFor="discount-minimum-amount">
                          {m.discounts.form.fields.minimumPurchaseAmount}
                        </Label>
                        <Input
                          aria-invalid={Boolean(errors.minimumRequirement)}
                          id="discount-minimum-amount"
                          min="0"
                          onChange={(event) =>
                            update("minimumPurchaseAmount", event.target.value)
                          }
                          step="0.01"
                          type="number"
                          value={form.minimumPurchaseAmount}
                        />
                      </div>
                    ) : form.minimumRequirement === "minimum_quantity" ? (
                      <div className="grid max-w-sm gap-2">
                        <Label htmlFor="discount-minimum-quantity">
                          {m.discounts.form.fields.minimumQuantity}
                        </Label>
                        <Input
                          aria-invalid={Boolean(errors.minimumRequirement)}
                          id="discount-minimum-quantity"
                          min="0.001"
                          onChange={(event) =>
                            update("minimumQuantity", event.target.value)
                          }
                          step="0.001"
                          type="number"
                          value={form.minimumQuantity}
                        />
                      </div>
                    ) : null}
                    <FieldError message={errorMessage("minimumRequirement")} />
                  </CardContent>
                </Card>
              ) : null}

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-5 py-5">
                  <div className="grid gap-4">
                    <h2 className="text-sm font-semibold">
                      {m.discounts.form.sections.eligibility}
                    </h2>
                    <Select
                      onValueChange={(value) =>
                        update(
                          "eligibility",
                          value as DiscountFormValues["eligibility"],
                        )
                      }
                      value={form.eligibility}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_customers">
                          {m.discounts.eligibility.all_customers}
                        </SelectItem>
                        <SelectItem value="specific_customers">
                          {m.discounts.eligibility.specific_customers}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {form.eligibility === "specific_customers" ? (
                      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-3">
                        <span className="text-sm">
                          {interpolate(m.discounts.form.summary.selectedCount, {
                            count: String(form.customerIds.length),
                          })}
                        </span>
                        <Button
                          onClick={() => setCustomerPickerOpen(true)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {m.discounts.form.buttons.chooseCustomers}
                        </Button>
                      </div>
                    ) : null}
                    <FieldError message={errorMessage("customerIds")} />
                  </div>

                  <div className="grid gap-4 border-t pt-5">
                    <h2 className="text-sm font-semibold">
                      {m.discounts.form.sections.limits}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="discount-usage-limit">
                          {m.discounts.form.fields.usageLimit}
                        </Label>
                        <Input
                          aria-invalid={Boolean(errors.usageLimit)}
                          id="discount-usage-limit"
                          min="1"
                          onChange={(event) =>
                            update("usageLimit", event.target.value)
                          }
                          placeholder={m.discounts.form.placeholders.usageLimit}
                          step="1"
                          type="number"
                          value={form.usageLimit}
                        />
                        <FieldError message={errorMessage("usageLimit")} />
                      </div>
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                        htmlFor="discount-once-per-customer"
                      >
                        <Checkbox
                          checked={form.oncePerCustomer}
                          id="discount-once-per-customer"
                          onCheckedChange={(checked) =>
                            update("oncePerCustomer", checked === true)
                          }
                        />
                        <span className="text-sm">
                          {m.discounts.form.fields.oncePerCustomer}
                        </span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <h2 className="text-sm font-semibold">
                    {m.discounts.form.sections.combinations}
                  </h2>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {m.discounts.form.hints.combinations}
                  </p>
                  {(
                    [
                      "combinesWithItemDiscounts",
                      "combinesWithOrderDiscounts",
                      "combinesWithShippingDiscounts",
                    ] as const
                  ).map((field) => (
                    <label
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
                      htmlFor={`discount-${field}`}
                      key={field}
                    >
                      <Checkbox
                        checked={form[field]}
                        id={`discount-${field}`}
                        onCheckedChange={(checked) =>
                          update(field, checked === true)
                        }
                      />
                      <span className="text-sm">
                        {m.discounts.form.fields[field]}
                      </span>
                    </label>
                  ))}
                  <p className="text-xs leading-5 text-muted-foreground">
                    {m.discounts.form.hints.channels}
                  </p>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <h2 className="text-sm font-semibold">
                    {m.discounts.form.sections.dates}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="discount-starts-at">
                        {m.discounts.form.fields.startsAt}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.startsAt)}
                        id="discount-starts-at"
                        onChange={(event) =>
                          update("startsAt", event.target.value)
                        }
                        type="datetime-local"
                        value={form.startsAt}
                      />
                    </div>
                    {form.hasEndDate ? (
                      <div className="grid gap-2">
                        <Label htmlFor="discount-ends-at">
                          {m.discounts.form.fields.endsAt}
                        </Label>
                        <Input
                          aria-invalid={Boolean(errors.endsAt)}
                          id="discount-ends-at"
                          onChange={(event) =>
                            update("endsAt", event.target.value)
                          }
                          type="datetime-local"
                          value={form.endsAt}
                        />
                      </div>
                    ) : null}
                  </div>
                  <label
                    className="flex cursor-pointer items-center gap-3"
                    htmlFor="discount-has-end"
                  >
                    <Checkbox
                      checked={form.hasEndDate}
                      id="discount-has-end"
                      onCheckedChange={(checked) =>
                        update("hasEndDate", checked === true)
                      }
                    />
                    <span className="text-sm">
                      {m.discounts.form.fields.hasEndDate}
                    </span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {interpolate(m.discounts.form.hints.timezone, {
                      timezone: options.timezone,
                    })}
                  </p>
                  <FieldError
                    message={errorMessage("startsAt") ?? errorMessage("endsAt")}
                  />
                </CardContent>
              </Card>

              {form.type === "free_shipping" ? (
                <Card className="gap-0 rounded-lg py-0 shadow-none">
                  <CardContent className="grid gap-4 py-5">
                    <h2 className="text-sm font-semibold">
                      {m.discounts.form.sections.shipping}
                    </h2>
                    <Select
                      onValueChange={(value) =>
                        update(
                          "countryScope",
                          value as DiscountFormValues["countryScope"],
                        )
                      }
                      value={form.countryScope}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {m.discounts.countryScopes.all}
                        </SelectItem>
                        <SelectItem value="selected">
                          {m.discounts.countryScopes.selected}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {form.countryScope === "selected" ? (
                      <div className="grid gap-2">
                        <Label htmlFor="discount-country-codes">
                          {m.discounts.form.fields.countryCodes}
                        </Label>
                        <Input
                          aria-invalid={Boolean(errors.countryCodesInput)}
                          id="discount-country-codes"
                          onChange={(event) =>
                            update("countryCodesInput", event.target.value)
                          }
                          placeholder={m.discounts.form.placeholders.countries}
                          value={form.countryCodesInput}
                        />
                        <p className="text-xs text-muted-foreground">
                          {m.discounts.form.hints.countries}
                        </p>
                        <FieldError
                          message={errorMessage("countryCodesInput")}
                        />
                      </div>
                    ) : null}

                    <div className="grid max-w-sm gap-2">
                      <Label htmlFor="discount-maximum-shipping">
                        {m.discounts.form.fields.maximumShippingPrice}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.maximumShippingPrice)}
                        id="discount-maximum-shipping"
                        min="0"
                        onChange={(event) =>
                          update("maximumShippingPrice", event.target.value)
                        }
                        placeholder={m.discounts.form.placeholders.amount}
                        step="0.01"
                        type="number"
                        value={form.maximumShippingPrice}
                      />
                      <FieldError
                        message={errorMessage("maximumShippingPrice")}
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <aside className="grid self-start gap-5 lg:sticky lg:top-20">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <h2 className="text-sm font-semibold">
                    {m.discounts.form.sections.branches}
                  </h2>
                  <Select
                    disabled={!options.canManageAllBranches}
                    onValueChange={(value) =>
                      update("allBranches", value === "all")
                    }
                    value={form.allBranches ? "all" : "selected"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.canManageAllBranches ? (
                        <SelectItem value="all">
                          {m.discounts.form.fields.allBranches}
                        </SelectItem>
                      ) : null}
                      <SelectItem value="selected">
                        {m.discounts.form.fields.selectedBranches}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {!form.allBranches ? (
                    <Button
                      className="justify-between"
                      onClick={() => setBranchPickerOpen(true)}
                      type="button"
                      variant="outline"
                    >
                      <span>
                        {interpolate(m.discounts.form.summary.selectedCount, {
                          count: String(form.branchIds.length),
                        })}
                      </span>
                      <Icon aria-hidden icon={Store} size={14} />
                    </Button>
                  ) : null}
                  <p className="text-xs leading-5 text-muted-foreground">
                    {m.discounts.form.hints.branches}
                  </p>
                  <FieldError message={errorMessage("branchIds")} />
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-3 py-5">
                  <h2 className="text-sm font-semibold">
                    {m.discounts.form.sections.channels}
                  </h2>
                  {(
                    [
                      "posEnabled",
                      "customerMobileEnabled",
                      "deliveryEnabled",
                    ] as const
                  ).map((field) => (
                    <label
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
                      htmlFor={`discount-${field}`}
                      key={field}
                    >
                      <Checkbox
                        checked={form[field]}
                        id={`discount-${field}`}
                        onCheckedChange={(checked) =>
                          update(field, checked === true)
                        }
                      />
                      <span className="text-sm">
                        {m.discounts.form.fields[field]}
                      </span>
                    </label>
                  ))}
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-3 py-5">
                  <h2 className="text-sm font-semibold">
                    {m.discounts.form.sections.tags}
                  </h2>
                  <Input
                    aria-invalid={Boolean(errors.tagsInput)}
                    onChange={(event) =>
                      update("tagsInput", event.target.value)
                    }
                    placeholder={m.discounts.form.placeholders.tags}
                    value={form.tagsInput}
                  />
                  <p className="text-xs text-muted-foreground">
                    {m.discounts.form.hints.tags}
                  </p>
                  <FieldError message={errorMessage("tagsInput")} />
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-3 py-5">
                  <h2 className="text-sm font-semibold">
                    {m.discounts.form.sections.summary}
                  </h2>
                  {[
                    [
                      m.discounts.form.summary.type,
                      m.discounts.types[form.type],
                    ],
                    [
                      m.discounts.form.summary.method,
                      m.discounts.methods[form.method],
                    ],
                    [m.discounts.form.summary.value, valueSummary],
                    [
                      m.discounts.form.summary.customers,
                      form.eligibility === "all_customers"
                        ? m.discounts.eligibility.all_customers
                        : interpolate(m.discounts.form.summary.selectedCount, {
                            count: String(form.customerIds.length),
                          }),
                    ],
                    [
                      m.discounts.form.summary.branches,
                      form.allBranches
                        ? m.discounts.form.fields.allBranches
                        : interpolate(m.discounts.form.summary.selectedCount, {
                            count: String(selectedBranchCount),
                          }),
                    ],
                    [
                      m.discounts.form.summary.channels,
                      interpolate(m.discounts.form.summary.selectedCount, {
                        count: String(channelCount),
                      }),
                    ],
                  ].map(([label, value]) => (
                    <div
                      className="flex items-start justify-between gap-3 text-xs"
                      key={label}
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-right font-medium">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </aside>
          </div>

          <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end px-1">
            <div className="pointer-events-auto grid w-full grid-cols-2 items-center gap-1.5 rounded-xl border border-border/80 bg-background/90 p-1.5 shadow-[0_14px_40px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex sm:w-auto">
              <Button
                className="rounded-lg"
                onClick={handleCancel}
                size="sm"
                type="button"
                variant="ghost"
              >
                {m.discounts.form.buttons.cancel}
              </Button>
              <Button
                aria-busy={saving}
                className="min-w-32 gap-2 rounded-lg"
                disabled={saving || !canManage}
                size="sm"
                type="submit"
              >
                <Icon
                  aria-hidden
                  className={saving ? "animate-spin" : undefined}
                  icon={saving ? LoaderCircle : Check}
                  size={14}
                />
                {saving
                  ? m.discounts.form.buttons.saving
                  : m.discounts.form.buttons.save}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>

      {targetRole ? (
        <SearchableMultiSelectDialog
          description={m.discounts.form.picker.targetsDescription}
          items={targetItems}
          onConfirm={(values) => updateRoleTargets(targetRole, values)}
          onOpenChange={(open) => {
            if (!open) setTargetRole(null);
          }}
          open
          selectedValues={form.targets
            .filter((target) => target.role === targetRole)
            .map(targetValue)}
          title={`${m.discounts.form.picker.targetsTitle} · ${
            m.discounts.targetRoles[targetRole]
          }`}
        />
      ) : null}

      {customerPickerOpen ? (
        <SearchableMultiSelectDialog
          description={m.discounts.form.picker.customersDescription}
          items={customerItems}
          onConfirm={(values) => update("customerIds", values)}
          onOpenChange={setCustomerPickerOpen}
          open
          selectedValues={form.customerIds}
          title={m.discounts.form.picker.customersTitle}
        />
      ) : null}

      {branchPickerOpen ? (
        <SearchableMultiSelectDialog
          description={m.discounts.form.picker.branchesDescription}
          items={branchItems}
          onConfirm={(values) => update("branchIds", values)}
          onOpenChange={setBranchPickerOpen}
          open
          selectedValues={form.branchIds}
          title={m.discounts.form.picker.branchesTitle}
        />
      ) : null}
    </section>
  );
}

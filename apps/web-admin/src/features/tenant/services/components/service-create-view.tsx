"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@cleanhub/ui";
import {
  Check,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  RotateCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

import { createServiceAction } from "../actions";
import type {
  ServiceBusinessLine,
  ServiceCategorySummary,
  ServiceFormErrors,
  ServiceFormValues,
  ServiceLabelRule,
  ServicePricingUnit,
  ServiceStatus,
} from "../types";

const DEFAULT_FORM_VALUES: ServiceFormValues = {
  businessLine: "laundry",
  name: "",
  code: "",
  shortName: "",
  categoryId: "",
  description: "",
  internalNotes: "",
  turnaroundMinutes: "",
  displayOrder: "0",
  pricingUnit: "per_item",
  labelRule: "per_order_item",
  standardPrice: "",
  compareAtPrice: "",
  costPrice: "",
  currency: "",
  status: "active",
  version: 0,
};

type ServiceCreateViewProps = {
  categories: ServiceCategorySummary[];
  categoriesLoadFailed: boolean;
  defaultCurrency: string | null;
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

export function ServiceCreateView({
  categories,
  categoriesLoadFailed,
  defaultCurrency,
}: ServiceCreateViewProps) {
  const router = useRouter();
  const { m } = useTenantI18n();
  const [formValues, setFormValues] =
    useState<ServiceFormValues>(DEFAULT_FORM_VALUES);
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const businessLineOptions: Array<{
    label: string;
    value: ServiceBusinessLine;
  }> = [
    {
      label: m.common.businessLineLabels.laundry,
      value: "laundry",
    },
    {
      label: m.common.businessLineLabels.car_wash,
      value: "car_wash",
    },
    {
      label: m.common.businessLineLabels.retail,
      value: "retail",
    },
    {
      label: m.common.businessLineLabels.delivery,
      value: "delivery",
    },
  ];

  const availableCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.businessLine === formValues.businessLine &&
          category.status === "active",
      ),
    [categories, formValues.businessLine],
  );
  const requiredDataUnavailable =
    categoriesLoadFailed || defaultCurrency === null;
  const submitDisabled =
    saving || requiredDataUnavailable || availableCategories.length === 0;

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function getFieldError(field: keyof ServiceFormValues): string | undefined {
    const error = errors[field];

    if (!error) {
      return undefined;
    }

    return (
      m.services.validation[error as keyof typeof m.services.validation] ??
      error
    );
  }

  function updateField<TKey extends keyof ServiceFormValues>(
    field: TKey,
    value: ServiceFormValues[TKey],
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
    setIsDirty(true);
  }

  function updateBusinessLine(value: ServiceBusinessLine) {
    setFormValues((current) => {
      const categoryStillMatches = categories.some(
        (category) =>
          category.id === current.categoryId &&
          category.businessLine === value &&
          category.status === "active",
      );

      return {
        ...current,
        businessLine: value,
        categoryId: categoryStillMatches ? current.categoryId : "",
      };
    });
    setErrors((current) => {
      const next = { ...current };
      delete next.businessLine;
      delete next.categoryId;
      return next;
    });
    setFormError(null);
    setIsDirty(true);
  }

  function confirmNavigation(event?: MouseEvent<HTMLAnchorElement>): boolean {
    if (isDirty && !window.confirm(m.services.create.unsavedChanges)) {
      event?.preventDefault();
      return false;
    }

    setIsDirty(false);
    return true;
  }

  function handleCancel() {
    if (!confirmNavigation()) {
      return;
    }

    router.push(webAdminRoutes.tenant.services);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitDisabled) {
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    try {
      const result = await createServiceAction(formValues);

      if (!result.ok) {
        if (result.code === "SERVICE_NAME_DUPLICATE") {
          setErrors({ name: m.services.create.nameConflict });
          setFormError(m.services.create.nameConflict);
          toast.error(m.services.create.nameConflict);
          return;
        }

        setErrors(result.errors);

        if (Object.keys(result.errors).length > 0) {
          setFormError(m.services.create.checkForm);
          toast.error(m.services.create.checkForm);
        } else {
          setFormError(m.services.create.createFailed);
          toast.error(m.services.create.createFailed);
        }
        return;
      }

      setIsDirty(false);
      toast.success(m.services.create.created);
      router.push(webAdminRoutes.tenant.services);
      router.refresh();
    } catch {
      setFormError(m.services.create.createFailed);
      toast.error(m.services.create.createFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-[1100px] space-y-3 pb-20"
      data-testid="tenant-service-create-view"
    >
      <h1 className="sr-only">{m.services.create.title}</h1>
      <nav aria-label={m.services.create.breadcrumbLabel}>
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              aria-label={m.services.title}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={webAdminRoutes.tenant.services}
              onClick={confirmNavigation}
              title={m.services.title}
            >
              <Icon aria-hidden icon={ClipboardList} size={16} />
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground">
            <Icon icon={ChevronRight} size={14} />
          </li>
          <li>
            <span aria-current="page" className="font-medium">
              {m.services.create.title}
            </span>
          </li>
        </ol>
      </nav>

      {requiredDataUnavailable ? (
        <div
          className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <ul className="grid gap-1">
            {categoriesLoadFailed ? (
              <li>{m.services.create.categoriesLoadFailed}</li>
            ) : null}
            {defaultCurrency === null ? (
              <li>{m.services.create.currencyLoadFailed}</li>
            ) : null}
          </ul>
          <Button
            className="shrink-0 gap-2"
            onClick={() => router.refresh()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Icon aria-hidden icon={RotateCw} size={14} />
            {m.common.retry}
          </Button>
        </div>
      ) : null}

      <form
        aria-busy={saving}
        className="space-y-5"
        noValidate
        onSubmit={handleCreate}
      >
        <fieldset className="contents" disabled={saving}>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-5">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardHeader className="border-b py-4">
                  <CardTitle className="text-base">
                    {m.services.sections.basicInformation}
                  </CardTitle>
                  <CardDescription>
                    {m.services.sections.basicInformationDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="service-name">
                      {m.services.formLabels.name} <RequiredMark />
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.name)}
                      autoFocus
                      id="service-name"
                      maxLength={200}
                      onChange={(event) =>
                        updateField("name", event.target.value)
                      }
                      placeholder={m.services.create.namePlaceholder}
                      required
                      value={formValues.name}
                    />
                    <FieldError message={getFieldError("name")} />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="service-short-name">
                        {m.services.formLabels.shortName}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.shortName)}
                        id="service-short-name"
                        maxLength={80}
                        onChange={(event) =>
                          updateField("shortName", event.target.value)
                        }
                        placeholder={m.services.create.shortNamePlaceholder}
                        value={formValues.shortName}
                      />
                      <FieldError message={getFieldError("shortName")} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="service-code">
                        {m.services.formLabels.code}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.code)}
                        id="service-code"
                        maxLength={64}
                        onChange={(event) =>
                          updateField("code", event.target.value.toUpperCase())
                        }
                        placeholder={m.services.create.codePlaceholder}
                        value={formValues.code}
                      />
                      <FieldError message={getFieldError("code")} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="service-description">
                      {m.services.formLabels.description}
                    </Label>
                    <Textarea
                      aria-invalid={Boolean(errors.description)}
                      id="service-description"
                      maxLength={2000}
                      onChange={(event) =>
                        updateField("description", event.target.value)
                      }
                      placeholder={m.services.create.descriptionPlaceholder}
                      rows={5}
                      value={formValues.description}
                    />
                    <FieldError message={getFieldError("description")} />
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardHeader className="border-b py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {m.services.sections.pricing}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {m.services.sections.pricingDescription}
                      </CardDescription>
                    </div>
                    <Button
                      asChild
                      className="w-fit shrink-0 gap-1.5"
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        href={
                          webAdminRoutes.tenant.system.settingsSections.pricing
                        }
                        onClick={confirmNavigation}
                      >
                        {m.services.create.changeDefaultCurrency}
                        <Icon aria-hidden icon={ChevronRight} size={14} />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5 py-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="service-standard-price">
                        {m.services.formLabels.standardPrice} <RequiredMark />
                      </Label>
                      <div className="relative">
                        <Input
                          aria-invalid={Boolean(errors.standardPrice)}
                          className="pr-16"
                          id="service-standard-price"
                          inputMode="decimal"
                          onChange={(event) =>
                            updateField("standardPrice", event.target.value)
                          }
                          placeholder="0.00"
                          required
                          value={formValues.standardPrice}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                          {defaultCurrency ?? "—"}
                        </span>
                      </div>
                      <FieldError message={getFieldError("standardPrice")} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="service-pricing-unit">
                        {m.services.formLabels.pricing} <RequiredMark />
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          updateField(
                            "pricingUnit",
                            value as ServicePricingUnit,
                          )
                        }
                        value={formValues.pricingUnit}
                      >
                        <SelectTrigger
                          aria-invalid={Boolean(errors.pricingUnit)}
                          className="w-full"
                          id="service-pricing-unit"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_item">
                            {m.common.pricingUnitLabels.per_item}
                          </SelectItem>
                          <SelectItem value="per_kg">
                            {m.common.pricingUnitLabels.per_kg}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError message={getFieldError("pricingUnit")} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="service-compare-at-price">
                        {m.services.formLabels.compareAtPrice}
                      </Label>
                      <div className="relative">
                        <Input
                          aria-invalid={Boolean(errors.compareAtPrice)}
                          className="pr-16"
                          id="service-compare-at-price"
                          inputMode="decimal"
                          onChange={(event) =>
                            updateField("compareAtPrice", event.target.value)
                          }
                          placeholder="0.00"
                          value={formValues.compareAtPrice}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                          {defaultCurrency ?? "—"}
                        </span>
                      </div>
                      <FieldError message={getFieldError("compareAtPrice")} />
                      <p className="text-xs text-muted-foreground">
                        {m.services.create.compareAtPriceHint}
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="service-cost-price">
                        {m.services.formLabels.costPrice}
                      </Label>
                      <div className="relative">
                        <Input
                          aria-invalid={Boolean(errors.costPrice)}
                          className="pr-16"
                          id="service-cost-price"
                          inputMode="decimal"
                          onChange={(event) =>
                            updateField("costPrice", event.target.value)
                          }
                          placeholder="0.00"
                          value={formValues.costPrice}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                          {defaultCurrency ?? "—"}
                        </span>
                      </div>
                      <FieldError message={getFieldError("costPrice")} />
                      <p className="text-xs text-muted-foreground">
                        {m.services.create.costPriceHint}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs leading-5 text-muted-foreground">
                    {m.services.create.pricingHint}
                  </p>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardHeader className="border-b py-4">
                  <CardTitle className="text-base">
                    {m.services.sections.operations}
                  </CardTitle>
                  <CardDescription>
                    {m.services.sections.operationsDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 py-5">
                  <div className="grid gap-2 sm:max-w-xs">
                    <Label htmlFor="service-turnaround-minutes">
                      {m.services.formLabels.turnaroundMinutes}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.turnaroundMinutes)}
                      id="service-turnaround-minutes"
                      inputMode="numeric"
                      max={525_600}
                      min={1}
                      onChange={(event) =>
                        updateField("turnaroundMinutes", event.target.value)
                      }
                      placeholder="1440"
                      step={1}
                      type="number"
                      value={formValues.turnaroundMinutes}
                    />
                    <FieldError
                      message={getFieldError("turnaroundMinutes")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {m.services.create.turnaroundHint}
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="service-internal-notes">
                      {m.services.formLabels.internalNotes}
                    </Label>
                    <Textarea
                      aria-invalid={Boolean(errors.internalNotes)}
                      id="service-internal-notes"
                      maxLength={5000}
                      onChange={(event) =>
                        updateField("internalNotes", event.target.value)
                      }
                      placeholder={m.services.create.internalNotesPlaceholder}
                      rows={4}
                      value={formValues.internalNotes}
                    />
                    <FieldError message={getFieldError("internalNotes")} />
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardHeader className="border-b py-4">
                  <CardTitle className="text-base">
                    {m.services.sections.catalogSettings}
                  </CardTitle>
                  <CardDescription>
                    {m.services.sections.catalogSettingsDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 py-5 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="service-label-rule">
                      {m.services.formLabels.labelRule} <RequiredMark />
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        updateField("labelRule", value as ServiceLabelRule)
                      }
                      value={formValues.labelRule}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.labelRule)}
                        className="w-full"
                        id="service-label-rule"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            "none",
                            "per_item",
                            "per_order_item",
                            "per_bag",
                          ] as const
                        ).map((value) => (
                          <SelectItem key={value} value={value}>
                            {m.services.labelRuleLabels[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={getFieldError("labelRule")} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="service-display-order">
                      {m.services.formLabels.displayOrder}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.displayOrder)}
                      id="service-display-order"
                      inputMode="numeric"
                      max={1_000_000}
                      min={0}
                      onChange={(event) =>
                        updateField("displayOrder", event.target.value)
                      }
                      step={1}
                      type="number"
                      value={formValues.displayOrder}
                    />
                    <FieldError message={getFieldError("displayOrder")} />
                    <p className="text-xs leading-5 text-muted-foreground">
                      {m.services.create.displayOrderHint}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <aside className="grid self-start gap-5 lg:sticky lg:top-20">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardHeader className="border-b py-4">
                  <CardTitle className="text-base">
                    {m.services.sections.status}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 py-5">
                  <Label htmlFor="service-status">
                    {m.services.formLabels.status}
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      updateField("status", value as ServiceStatus)
                    }
                    value={formValues.status}
                  >
                    <SelectTrigger
                      aria-invalid={Boolean(errors.status)}
                      className="w-full"
                      id="service-status"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        {m.common.statusLabels.active}
                      </SelectItem>
                      <SelectItem value="inactive">
                        {m.common.statusLabels.inactive}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError message={getFieldError("status")} />
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardHeader className="border-b py-4">
                  <CardTitle className="text-base">
                    {m.services.sections.organization}
                  </CardTitle>
                  <CardDescription>
                    {m.services.sections.organizationDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="service-business-line">
                      {m.services.formLabels.businessLine} <RequiredMark />
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        updateBusinessLine(value as ServiceBusinessLine)
                      }
                      value={formValues.businessLine}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.businessLine)}
                        className="w-full"
                        id="service-business-line"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {businessLineOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={getFieldError("businessLine")} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="service-category">
                      {m.services.formLabels.category} <RequiredMark />
                    </Label>
                    <Select
                      disabled={
                        categoriesLoadFailed || availableCategories.length === 0
                      }
                      onValueChange={(value) =>
                        updateField("categoryId", value)
                      }
                      value={formValues.categoryId}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.categoryId)}
                        className="w-full"
                        id="service-category"
                      >
                        <SelectValue
                          placeholder={m.services.create.categoryPlaceholder}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={getFieldError("categoryId")} />
                    {!categoriesLoadFailed &&
                    availableCategories.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {m.services.create.noCategoriesForBusinessLine}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>

          {formError ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end px-1">
            <div className="pointer-events-auto grid w-full grid-cols-2 items-center gap-1.5 rounded-xl border border-border/80 bg-background/90 p-1.5 shadow-[0_14px_40px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex sm:w-auto">
              <Button
                className="rounded-lg"
                onClick={handleCancel}
                size="sm"
                type="button"
                variant="ghost"
              >
                {m.common.cancel}
              </Button>
              <Button
                aria-busy={saving}
                className="min-w-28 gap-2 rounded-lg"
                disabled={submitDisabled}
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
                  ? m.services.formButtons.saving
                  : m.services.formButtons.createService}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

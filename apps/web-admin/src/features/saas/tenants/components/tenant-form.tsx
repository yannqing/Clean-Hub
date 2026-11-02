"use client";

import {
  INITIAL_OWNER_PASSWORD,
  INITIAL_OWNER_PIN,
} from "@cleanhub/domain/initial-owner-credentials";
import { getLocalizedCountryName, isoCountryCodes } from "@cleanhub/i18n";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  PlatformServiceItemGroup,
  PlatformTaxTemplate,
} from "@cleanhub/api-client";
import Link from "next/link";
import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { useSaasI18n } from "@/i18n";

import {
  tenantCreateLanguageOptions,
  tenantDefaultValues,
  tenantLanguageOptions,
} from "../constants";
import type {
  TenantDetail,
  TenantFeatureFlagsFormValues,
  TenantFormValues,
} from "../types";
import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import {
  ItemCatalogPicker,
  allActiveCatalogItems,
} from "@/features/saas/item-catalog/components/item-catalog-picker";
import { getPlatformItemCatalogQuery } from "@/features/saas/item-catalog/queries";
import { itemCatalogCopy } from "@/features/saas/item-catalog/copy";
import { TenantFeatureFlagFields } from "./tenant-feature-flag-fields";

type TenantFormResult =
  | {
      ok: true;
      data: TenantDetail;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantFormValues, string>>;
      message?: string;
    };

type TenantFormProps = {
  additionalContent?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
  featureFlagsContent?: ReactNode;
  initialValues?: Partial<TenantFormValues>;
  mode: "create" | "edit";
  onSubmit: (values: TenantFormValues) => Promise<TenantFormResult>;
  onSuccess?: (tenant: TenantDetail) => void;
};

function getInitialValues(
  values: Partial<TenantFormValues> | undefined,
): TenantFormValues {
  return {
    ...tenantDefaultValues,
    ...values,
    featureFlags: {
      ...tenantDefaultValues.featureFlags,
      ...values?.featureFlags,
    },
  };
}

function normalizeCountry(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function isUsableTaxTemplate(
  template: PlatformTaxTemplate | undefined,
): template is PlatformTaxTemplate {
  return Boolean(template?.taxEnabled && template.ready);
}

export function TenantForm({
  additionalContent,
  aside,
  disabled = false,
  featureFlagsContent,
  initialValues,
  mode,
  onSubmit,
  onSuccess,
}: TenantFormProps) {
  const { feedback, locale, m } = useSaasI18n();
  const [values, setValues] = useState<TenantFormValues>(() =>
    getInitialValues(initialValues),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof TenantFormValues, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [taxTemplates, setTaxTemplates] = useState<PlatformTaxTemplate[]>([]);
  const [templateError, setTemplateError] = useState(false);
  const showDefaults = mode === "create";
  const catalogCopy = itemCatalogCopy(locale);
  const [catalogGroups, setCatalogGroups] = useState<
    PlatformServiceItemGroup[]
  >([]);
  const [catalogLoading, setCatalogLoading] = useState(showDefaults);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogReload, setCatalogReload] = useState(0);
  useEffect(() => {
    if (!showDefaults) return;
    let active = true;
    getPlatformItemCatalogQuery()
      .then(({ data }) => {
        if (active) {
          setCatalogGroups(data);
          setCatalogError(false);
          setValues((current) => ({
            ...current,
            itemCatalogSelection:
              current.itemCatalogSelection ?? allActiveCatalogItems(data),
          }));
        }
      })
      .catch(() => {
        if (active) setCatalogError(true);
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showDefaults, catalogReload]);
  useEffect(() => {
    let active = true;
    webAdminApi.saas.platformSettings
      .listTaxTemplates()
      .then(({ data }) => {
        if (active) setTaxTemplates(data);
      })
      .catch(() => {
        if (active) setTemplateError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const selectedTemplate = taxTemplates.find(
    (entry) =>
      normalizeCountry(entry.countryCode) ===
        normalizeCountry(values.country) ||
      normalizeCountry(entry.name) === normalizeCountry(values.country),
  );
  const selectedCountry = selectedTemplate?.countryCode ?? values.country;
  const countryOptions = useMemo(
    () =>
      isoCountryCodes
        .map((code) => ({ code, label: getLocalizedCountryName(code, locale) }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    [locale],
  );
  const countryCopy = m.tenants.form.countrySetup;
  const languageOptions = showDefaults
    ? tenantCreateLanguageOptions
    : tenantLanguageOptions;
  const getLanguageLabel = (value: string) => {
    if (value === "platform-default") {
      return m.common.languageLabels.platformDefault;
    }
    if (value === "en") {
      return m.common.languageLabels.en;
    }
    if (value === "fr") {
      return m.common.languageLabels.fr;
    }
    return m.common.languageLabels.zhCN;
  };

  function updateValue(
    key: Exclude<
      keyof TenantFormValues,
      "featureFlags" | "itemCatalogSelection"
    >,
    value: string,
  ): void {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
    setFormError(null);
  }

  function updateFeatureFlag(
    key: keyof TenantFeatureFlagsFormValues,
    enabled: boolean,
  ): void {
    setValues((current) => ({
      ...current,
      featureFlags: { ...current.featureFlags, [key]: enabled },
    }));
    setErrors((current) => ({ ...current, featureFlags: undefined }));
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      return;
    }
    if (
      showDefaults &&
      (catalogLoading || catalogError || !values.itemCatalogSelection)
    ) {
      setFormError(catalogCopy.failed);
      toast.error(feedback(catalogCopy.failed));
      return;
    }

    if (
      !values.country.trim() ||
      (showDefaults && !isUsableTaxTemplate(selectedTemplate))
    ) {
      const message = !values.country.trim()
        ? countryCopy.required
        : templateError
          ? countryCopy.unavailable
          : countryCopy.missing;
      setErrors((current) => ({ ...current, country: message }));
      setFormError(message);
      toast.error(feedback(message));
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const result = await onSubmit(values);

      if (!result.ok) {
        setErrors(result.errors);
        const message =
          result.message ??
          Object.values(result.errors)[0] ??
          m.tenants.detail.loadError;
        setFormError(message);
        toast.error(feedback(message));
        return;
      }

      setErrors({});
      toast.success(
        mode === "create"
          ? m.tenants.form.createdToast
          : m.tenants.form.updatedToast,
      );
      onSuccess?.(result.data);
    } catch (error) {
      const message = getTenantLoadErrorMessage(
        error,
        m.tenants.detail.loadError,
      );
      setFormError(message);
      toast.error(feedback(message));
    } finally {
      setSubmitting(false);
    }
  }

  const submitAction = (
    <div className="flex justify-end pt-1">
      <Button
        disabled={
          disabled ||
          submitting ||
          (showDefaults && (catalogLoading || catalogError))
        }
        type="submit"
      >
        {submitting
          ? mode === "create"
            ? m.common.creating
            : m.common.saving
          : mode === "create"
            ? m.tenants.form.createTenant
            : m.common.saveChanges}
      </Button>
    </div>
  );

  return (
    <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
      {formError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {feedback(formError)}
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid min-w-0 gap-5">
          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="grid gap-4 py-5">
              <h2 className="text-sm font-semibold text-foreground">
                {m.tenants.form.profileSection}
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="tenant-name">
                    {m.tenants.form.fields.name}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.name)}
                    disabled={disabled || submitting}
                    id="tenant-name"
                    onChange={(event) =>
                      updateValue("name", event.target.value)
                    }
                    value={values.name}
                  />
                  {errors.name ? (
                    <p className="text-xs text-destructive">{feedback(errors.name)}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={showDefaults ? undefined : "pressing-code"}>
                    {m.tenants.form.fields.pressingCode}
                  </Label>
                  {showDefaults ? (
                    <p className="flex min-h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                      {m.tenants.form.autoGeneratedCode}
                    </p>
                  ) : (
                    <>
                      <Input
                        aria-invalid={Boolean(errors.pressingCode)}
                        disabled={disabled || submitting}
                        id="pressing-code"
                        aria-describedby="pressing-code-hint"
                        onChange={(event) =>
                          updateValue("pressingCode", event.target.value)
                        }
                        value={values.pressingCode}
                      />
                      <p
                        className="text-xs text-muted-foreground"
                        id="pressing-code-hint"
                      >
                        {m.tenants.identity.tenantCodeHint}
                      </p>
                      {errors.pressingCode ? (
                        <p className="text-xs text-destructive">
                          {feedback(errors.pressingCode)}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tenant-country">
                    {m.tenants.form.fields.country}{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </Label>
                  <Select
                    disabled={disabled || submitting}
                    onValueChange={(countryCode) => {
                      const template = taxTemplates.find(
                        (entry) => entry.countryCode === countryCode,
                      );
                      setValues((current) => ({
                        ...current,
                        country: countryCode,
                        defaultCurrency: isUsableTaxTemplate(template)
                          ? template.currencyCode!
                          : "",
                      }));
                      setErrors((current) => ({
                        ...current,
                        country: undefined,
                        defaultCurrency: undefined,
                      }));
                      setFormError(null);
                    }}
                    value={selectedCountry}
                  >
                    <SelectTrigger
                      aria-required="true"
                      aria-describedby="tenant-country-hint"
                      aria-invalid={Boolean(errors.country)}
                      id="tenant-country"
                    >
                      <SelectValue
                        placeholder={m.tenants.form.fields.country}
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {values.country &&
                      !countryOptions.some(
                        (country) => country.code === values.country,
                      ) ? (
                        <SelectItem value={values.country}>
                          {values.country}
                        </SelectItem>
                      ) : null}
                      {countryOptions.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.label} ({country.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p
                    id="tenant-country-hint"
                    className="text-xs text-muted-foreground"
                  >
                    {countryCopy.required}
                  </p>
                  {showDefaults && isUsableTaxTemplate(selectedTemplate) ? (
                    <p className="text-xs text-emerald-700">
                      {countryCopy.selected}: {selectedTemplate!.name} ·{" "}
                      {selectedTemplate!.currencyCode}
                    </p>
                  ) : null}
                  {showDefaults ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {countryCopy.pending}
                    </p>
                  ) : null}
                  {templateError ? (
                    <p className="text-xs text-destructive">
                      {countryCopy.unavailable}
                    </p>
                  ) : null}
                  {!templateError && taxTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {countryCopy.empty}
                    </p>
                  ) : null}
                  {values.country &&
                  !templateError &&
                  !isUsableTaxTemplate(selectedTemplate) ? (
                    <p className="text-xs text-destructive">
                      {countryCopy.missing}{" "}
                      <Link
                        className="underline underline-offset-2"
                        href={
                          webAdminRoutes.saas.config.platformSettingsSections
                            .taxTemplates
                        }
                      >
                        {countryCopy.configure}
                      </Link>
                    </p>
                  ) : null}
                  {mode === "edit" ? (
                    <p className="text-xs text-muted-foreground">
                      {countryCopy.change}
                    </p>
                  ) : null}
                  {errors.country ? (
                    <p className="text-xs text-destructive">{feedback(errors.country)}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tenant-city">
                    {m.tenants.form.fields.city}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.city)}
                    disabled={disabled || submitting}
                    id="tenant-city"
                    onChange={(event) =>
                      updateValue("city", event.target.value)
                    }
                    value={values.city}
                  />
                  {errors.city ? (
                    <p className="text-xs text-destructive">{feedback(errors.city)}</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {showDefaults ? (
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-4 py-5">
                <h2 className="text-sm font-semibold text-foreground">
                  {m.tenants.form.ownerSection}
                </h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="initial-owner-name">
                      {m.tenants.form.fields.ownerName}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.initialOwnerDisplayName)}
                      disabled={disabled || submitting}
                      id="initial-owner-name"
                      onChange={(event) =>
                        updateValue(
                          "initialOwnerDisplayName",
                          event.target.value,
                        )
                      }
                      value={values.initialOwnerDisplayName}
                    />
                    {errors.initialOwnerDisplayName ? (
                      <p className="text-xs text-destructive">
                        {feedback(errors.initialOwnerDisplayName)}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="initial-owner-email">
                      {m.tenants.form.fields.ownerEmail}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.initialOwnerEmail)}
                      disabled={disabled || submitting}
                      id="initial-owner-email"
                      onChange={(event) =>
                        updateValue("initialOwnerEmail", event.target.value)
                      }
                      type="email"
                      value={values.initialOwnerEmail}
                    />
                    {errors.initialOwnerEmail ? (
                      <p className="text-xs text-destructive">
                        {feedback(errors.initialOwnerEmail)}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="initial-owner-phone">
                      {m.tenants.form.fields.ownerPhone}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.initialOwnerPhone)}
                      disabled={disabled || submitting}
                      id="initial-owner-phone"
                      onChange={(event) =>
                        updateValue("initialOwnerPhone", event.target.value)
                      }
                      value={values.initialOwnerPhone}
                    />
                    {errors.initialOwnerPhone ? (
                      <p className="text-xs text-destructive">
                        {feedback(errors.initialOwnerPhone)}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-md border bg-muted/30 p-3 text-sm md:col-span-2">
                    <p>
                      {m.tenants.form.fields.ownerPassword}:{" "}
                      <strong>{INITIAL_OWNER_PASSWORD}</strong>
                    </p>
                    <p>
                      {m.tenants.form.fields.ownerPin}:{" "}
                      <strong>{INITIAL_OWNER_PIN}</strong>
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {m.tenants.form.initialCredentialHint}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {showDefaults ? (
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-4 py-5">
                <h2 className="text-sm font-semibold text-foreground">
                  {m.tenants.settings.featureFlagsSection}
                </h2>
                <TenantFeatureFlagFields
                  disabled={disabled || submitting}
                  onChange={updateFeatureFlag}
                  values={values.featureFlags}
                />
                {errors.featureFlags ? (
                  <p className="text-xs text-destructive">
                    {feedback(errors.featureFlags)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            featureFlagsContent
          )}

          {showDefaults ? (
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="space-y-4 py-5">
                <h2 className="text-sm font-semibold">
                  {catalogCopy.selection}
                </h2>
                <p className="text-xs leading-5 text-muted-foreground">
                  {catalogCopy.selectionHint}
                </p>
                {catalogLoading ? (
                  <p role="status" className="text-sm">
                    {catalogCopy.loading}
                  </p>
                ) : catalogError ? (
                  <div role="alert" className="space-y-2">
                    <p className="text-sm text-destructive">
                      {catalogCopy.failed}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCatalogLoading(true);
                        setCatalogReload((key) => key + 1);
                      }}
                    >
                      {catalogCopy.retry}
                    </Button>
                  </div>
                ) : (
                  <ItemCatalogPicker
                    locale={locale}
                    groups={catalogGroups}
                    selection={
                      values.itemCatalogSelection ?? {
                        itemTypes: [],
                        itemIds: [],
                      }
                    }
                    disabled={disabled || submitting}
                    onChange={(selection) =>
                      setValues((current) => ({
                        ...current,
                        itemCatalogSelection: selection,
                      }))
                    }
                  />
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="grid gap-4 py-5">
              <h2 className="text-sm font-semibold text-foreground">
                {m.tenants.form.contactSection}
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="contact-name">
                    {m.tenants.form.fields.contactName}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.contactName)}
                    disabled={disabled || submitting}
                    id="contact-name"
                    onChange={(event) =>
                      updateValue("contactName", event.target.value)
                    }
                    value={values.contactName}
                  />
                  {errors.contactName ? (
                    <p className="text-xs text-destructive">
                      {feedback(errors.contactName)}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="contact-phone">
                    {m.tenants.form.fields.contactPhone}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.contactPhone)}
                    disabled={disabled || submitting}
                    id="contact-phone"
                    onChange={(event) =>
                      updateValue("contactPhone", event.target.value)
                    }
                    value={values.contactPhone}
                  />
                  {errors.contactPhone ? (
                    <p className="text-xs text-destructive">
                      {feedback(errors.contactPhone)}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="contact-email">
                    {m.tenants.form.fields.contactEmail}
                  </Label>
                  <Input
                    aria-invalid={Boolean(errors.contactEmail)}
                    disabled={disabled || submitting}
                    id="contact-email"
                    onChange={(event) =>
                      updateValue("contactEmail", event.target.value)
                    }
                    type="email"
                    value={values.contactEmail}
                  />
                  {errors.contactEmail ? (
                    <p className="text-xs text-destructive">
                      {feedback(errors.contactEmail)}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
          {!showDefaults ? submitAction : null}
          {additionalContent}
        </div>

        <aside className="grid min-w-0 gap-5">
          {showDefaults ? (
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-4 py-5">
                <h2 className="text-sm font-semibold text-foreground">
                  {m.tenants.form.defaultsSection}
                </h2>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="default-language">
                      {m.tenants.form.fields.defaultLanguage}
                    </Label>
                    <Select
                      disabled={disabled || submitting}
                      onValueChange={(value) =>
                        updateValue(
                          "defaultLanguage",
                          value as TenantFormValues["defaultLanguage"],
                        )
                      }
                      value={values.defaultLanguage}
                    >
                      <SelectTrigger className="w-full" id="default-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languageOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {getLanguageLabel(option.value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.defaultLanguage ? (
                      <p className="text-xs text-destructive">
                        {feedback(errors.defaultLanguage)}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label>{m.tenants.form.fields.defaultCurrency}</Label>
                    <p
                      className="flex min-h-9 items-center rounded-md border bg-muted/30 px-3 text-sm"
                      id="default-currency"
                    >
                      {values.defaultCurrency || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {countryCopy.currency}
                    </p>
                    {errors.defaultCurrency ? (
                      <p className="text-xs text-destructive">
                        {feedback(errors.defaultCurrency)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {aside}
        </aside>
      </div>

      {showDefaults ? submitAction : null}
    </form>
  );
}

"use client";

import {
  Button,
  Card,
  CardContent,
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
import { Check, ChevronRight, LoaderCircle, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

import { createBranchAction } from "../actions";
import { branchLanguageValues, emptyBranchFormValues } from "../constants";
import type { BranchFormValues, BranchLanguage, BranchStatus } from "../types";

export type BranchCreateViewProps = {
  basePath?: string;
  defaultsWarning?: string;
  embedded?: boolean;
  initialDefaultCurrency?: string;
  initialDefaultLanguage?: BranchLanguage;
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

export function BranchCreateView({
  basePath = webAdminRoutes.tenant.branches,
  defaultsWarning,
  initialDefaultCurrency,
  initialDefaultLanguage,
}: BranchCreateViewProps = {}) {
  const router = useRouter();
  const { m } = useTenantI18n();
  const [formValues, setFormValues] = useState<BranchFormValues>(() => ({
    ...emptyBranchFormValues,
    defaultCurrency:
      initialDefaultCurrency ?? emptyBranchFormValues.defaultCurrency,
    defaultLanguage:
      initialDefaultLanguage ?? emptyBranchFormValues.defaultLanguage,
  }));
  const [errors, setErrors] = useState<
    Partial<Record<keyof BranchFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function updateForm<K extends keyof BranchFormValues>(
    key: K,
    value: BranchFormValues[K],
  ): void {
    setFormValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const result = await createBranchAction(formValues);

      if (!result.ok) {
        setErrors(result.errors);
        setFormError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(m.branches.create.created);
      router.push(`${basePath}/${result.data.id}`);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : m.common.requestFailed;
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const pageTitle = m.branches.create.title;

  return (
    <section
      className="mx-auto w-full max-w-[960px] space-y-3 pb-20"
      data-testid="tenant-branch-create-view"
    >
      <h1 className="sr-only">{pageTitle}</h1>
      <nav aria-label={m.branches.title}>
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              aria-label={m.branches.title}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={basePath}
              title={m.branches.title}
            >
              <Icon aria-hidden icon={Store} size={16} />
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground">
            <Icon aria-hidden icon={ChevronRight} size={14} />
          </li>
          <li>
            <span aria-current="page" className="font-medium">
              {pageTitle}
            </span>
          </li>
        </ol>
      </nav>

      <form className="space-y-5" noValidate onSubmit={handleCreate}>
        {defaultsWarning ? (
          <p
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm"
            role="alert"
          >
            {defaultsWarning}
          </p>
        ) : null}

        <fieldset className="contents" disabled={saving}>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="branch-name">
                      {m.branches.create.fields.name}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.name)}
                      id="branch-name"
                      onChange={(event) =>
                        updateForm("name", event.target.value)
                      }
                      required
                      value={formValues.name}
                    />
                    <FieldError message={errors.name} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="branch-phone">
                        {m.branches.create.fields.phone}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.phone)}
                        id="branch-phone"
                        onChange={(event) =>
                          updateForm("phone", event.target.value)
                        }
                        value={formValues.phone}
                      />
                      <FieldError message={errors.phone} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="branch-logo-url">
                        {m.branches.create.fields.logoUrl}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.logoUrl)}
                        id="branch-logo-url"
                        onChange={(event) =>
                          updateForm("logoUrl", event.target.value)
                        }
                        value={formValues.logoUrl}
                      />
                      <FieldError message={errors.logoUrl} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="branch-receipt-name">
                        {m.branches.create.fields.receiptName}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.receiptName)}
                        id="branch-receipt-name"
                        onChange={(event) =>
                          updateForm("receiptName", event.target.value)
                        }
                        value={formValues.receiptName}
                      />
                      <FieldError message={errors.receiptName} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="branch-receipt-phone">
                        {m.branches.create.fields.receiptPhone}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.receiptPhone)}
                        id="branch-receipt-phone"
                        onChange={(event) =>
                          updateForm("receiptPhone", event.target.value)
                        }
                        value={formValues.receiptPhone}
                      />
                      <FieldError message={errors.receiptPhone} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="branch-address">
                      {m.branches.create.fields.address}
                    </Label>
                    <Textarea
                      aria-invalid={Boolean(errors.address)}
                      id="branch-address"
                      onChange={(event) =>
                        updateForm("address", event.target.value)
                      }
                      value={formValues.address}
                    />
                    <FieldError message={errors.address} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="branch-receipt-address">
                      {m.branches.create.fields.receiptAddress}
                    </Label>
                    <Textarea
                      aria-invalid={Boolean(errors.receiptAddress)}
                      id="branch-receipt-address"
                      onChange={(event) =>
                        updateForm("receiptAddress", event.target.value)
                      }
                      value={formValues.receiptAddress}
                    />
                    <FieldError message={errors.receiptAddress} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="branch-business-hours">
                      {m.branches.create.fields.businessHoursJson}
                    </Label>
                    <Textarea
                      aria-invalid={Boolean(errors.businessHoursJson)}
                      id="branch-business-hours"
                      onChange={(event) =>
                        updateForm("businessHoursJson", event.target.value)
                      }
                      placeholder={m.branches.create.businessHoursPlaceholder}
                      value={formValues.businessHoursJson}
                    />
                    <FieldError message={errors.businessHoursJson} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <aside className="grid self-start gap-5 lg:sticky lg:top-20">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="branch-currency">
                      {m.branches.create.fields.currency}
                    </Label>
                    <Input
                      aria-readonly="true"
                      id="branch-currency"
                      maxLength={3}
                      readOnly
                      value={formValues.defaultCurrency}
                    />
                    <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                      <span>
                        {m.settings.pricingHub.defaultCurrencyDescription}
                      </span>
                      <Link
                        className="shrink-0 font-medium text-foreground underline-offset-4 hover:underline"
                        href={
                          webAdminRoutes.tenant.system.settingsSections.pricing
                        }
                      >
                        {m.settings.pricingHub.defaultCurrencyTitle}
                      </Link>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="branch-language">
                      {m.branches.create.fields.defaultLanguage}
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        updateForm("defaultLanguage", value as BranchLanguage)
                      }
                      value={formValues.defaultLanguage}
                    >
                      <SelectTrigger id="branch-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {branchLanguageValues.map((value) => (
                          <SelectItem key={value} value={value}>
                            {m.common.languageLabels[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={errors.defaultLanguage} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="branch-form-status">
                      {m.branches.create.fields.status}
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        updateForm("status", value as BranchStatus)
                      }
                      value={formValues.status}
                    >
                      <SelectTrigger id="branch-form-status">
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
                    <FieldError message={errors.status} />
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
                asChild
                className="rounded-lg"
                size="sm"
                type="button"
                variant="ghost"
              >
                <Link href={basePath}>{m.common.cancel}</Link>
              </Button>
              <Button
                aria-busy={saving}
                className="min-w-28 gap-2 rounded-lg"
                disabled={saving}
                size="sm"
                type="submit"
              >
                <Icon
                  aria-hidden
                  className={saving ? "animate-spin" : undefined}
                  icon={saving ? LoaderCircle : Check}
                  size={14}
                />
                {saving ? m.common.saving : m.branches.create.createButton}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

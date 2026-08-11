"use client";

import {
  Badge,
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
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, LoaderCircle, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";
import { tenantQueryKeys } from "@/lib/query-keys";

import { updateBranchAction, updateBranchStatusAction } from "../actions";
import { toBranchBusinessHoursFormValues } from "../business-hours";
import { branchLanguageValues } from "../constants";
import { useBranchDetailQuery } from "../queries";
import type {
  BranchFormValues,
  BranchLanguage,
  BranchStatus,
  BranchSummary,
} from "../types";
import { uploadBranchLogo } from "../upload-branch-logo";
import { validateBranchUpdateForm } from "../validators";
import { BranchBusinessHoursEditor } from "./branch-business-hours-editor";
import { BranchLogoField } from "./branch-logo-field";
import { BranchPosTerminalBindingCard } from "./branch-pos-terminal-binding-card";

function isVersionConflict(result: {
  code?: string;
  status?: number;
}): boolean {
  return result.status === 409 || result.code === "BRANCH_VERSION_CONFLICT";
}

function toFormValues(branch: BranchSummary): BranchFormValues {
  return {
    name: branch.name,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    defaultLanguage: branch.defaultLanguage,
    defaultCurrency: branch.defaultCurrency,
    receiptName: branch.receiptName ?? "",
    receiptPhone: branch.receiptPhone ?? "",
    receiptAddress: branch.receiptAddress ?? "",
    logoObjectKey: branch.logoObjectKey ?? "",
    removeLogo: false,
    businessHours: toBranchBusinessHoursFormValues(branch.businessHours),
    status: branch.status,
    version: branch.version,
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

export type BranchDetailViewProps = {
  basePath?: string;
  embedded?: boolean;
  initialBranch: BranchSummary;
};

export function BranchDetailView({
  basePath = webAdminRoutes.tenant.branches,
  initialBranch,
}: BranchDetailViewProps) {
  const { m, formatDateTime } = useTenantI18n();
  const queryClient = useQueryClient();
  const { data: branch = initialBranch } = useBranchDetailQuery(
    initialBranch.id,
    { initialData: initialBranch },
  );
  const [formValues, setFormValues] = useState<BranchFormValues>(
    toFormValues(branch),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof BranchFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    branch.logoUrl,
  );
  const logoObjectUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (logoObjectUrlRef.current) {
        URL.revokeObjectURL(logoObjectUrlRef.current);
      }
    },
    [],
  );

  function applyUpdatedBranch(nextBranch: BranchSummary) {
    queryClient.setQueryData(
      tenantQueryKeys.branches.detail(nextBranch.id),
      nextBranch,
    );
    setFormValues(toFormValues(nextBranch));
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }
    setLogoFile(null);
    setLogoPreviewUrl(nextBranch.logoUrl);
    setErrors({});
  }

  function updateForm<K extends keyof BranchFormValues>(
    key: K,
    value: BranchFormValues[K],
  ): void {
    setFormValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const nextFormValues = {
        ...formValues,
        version: branch.version,
      };
      const validation = validateBranchUpdateForm(nextFormValues);

      if (!validation.ok) {
        setErrors(validation.errors);
        setMessage(m.branches.create.checkForm);
        return;
      }

      let submission = nextFormValues;

      if (logoFile) {
        const uploadResult = await uploadBranchLogo(logoFile);

        if (!uploadResult.ok) {
          const uploadMessage =
            uploadResult.reason === "type"
              ? m.branches.create.logoTypeInvalid
              : uploadResult.reason === "size"
                ? m.branches.create.logoTooLarge
                : m.branches.create.logoUploadFailed;
          setMessage(uploadMessage);
          toast.error(uploadMessage);
          return;
        }

        submission = {
          ...nextFormValues,
          logoObjectKey: uploadResult.objectKey,
          removeLogo: false,
        };
        setFormValues(submission);
        setLogoFile(null);
      }

      const result = await updateBranchAction(branch.id, submission);

      if (!result.ok) {
        const nextMessage = isVersionConflict(result)
          ? m.branches.detail.versionConflict
          : result.message;
        setErrors(result.errors);
        setMessage(nextMessage);
        toast.error(nextMessage);
        return;
      }

      applyUpdatedBranch(result.data);
      toast.success(m.branches.detail.updated);
    } catch (saveError) {
      const nextMessage =
        saveError instanceof Error ? saveError.message : m.common.requestFailed;
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  function handleLogoSelect(file: File) {
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    logoObjectUrlRef.current = previewUrl;
    setLogoFile(file);
    setLogoPreviewUrl(previewUrl);
    updateForm("removeLogo", false);
    setErrors((current) => ({ ...current, logoObjectKey: undefined }));
  }

  function handleLogoRemove() {
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }

    setLogoFile(null);
    setLogoPreviewUrl(null);
    updateForm("logoObjectKey", "");
    updateForm("removeLogo", true);
  }

  async function handleStatusChange(status: BranchStatus) {
    setSaving(true);
    setMessage(null);

    try {
      const result = await updateBranchStatusAction(
        branch.id,
        status,
        branch.version,
      );

      if (!result.ok) {
        const nextMessage = isVersionConflict(result)
          ? m.branches.detail.versionConflict
          : result.message;
        setErrors(result.errors);
        setMessage(nextMessage);
        toast.error(nextMessage);
        return;
      }

      applyUpdatedBranch(result.data);
      toast.success(m.branches.list.statusUpdated);
    } catch (statusError) {
      const nextMessage =
        statusError instanceof Error
          ? statusError.message
          : m.common.requestFailed;
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-[960px] space-y-3 pb-20"
      data-testid="tenant-branch-detail-view"
    >
      <h1 className="sr-only">{branch.name}</h1>
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
            <span aria-current="page" className="max-w-64 truncate font-medium">
              {branch.name}
            </span>
          </li>
        </ol>
      </nav>

      <form
        aria-busy={saving}
        className="space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <fieldset className="contents" disabled={saving}>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="branch-detail-name">
                      {m.branches.create.fields.name}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.name)}
                      id="branch-detail-name"
                      onChange={(event) =>
                        updateForm("name", event.target.value)
                      }
                      value={formValues.name}
                    />
                    <FieldError message={errors.name} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="branch-detail-phone">
                      {m.branches.create.fields.phone}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.phone)}
                      id="branch-detail-phone"
                      onChange={(event) =>
                        updateForm("phone", event.target.value)
                      }
                      value={formValues.phone}
                    />
                    <FieldError message={errors.phone} />
                  </div>

                  <BranchLogoField
                    disabled={saving}
                    error={errors.logoObjectKey}
                    onRemove={handleLogoRemove}
                    onSelect={handleLogoSelect}
                    previewUrl={logoPreviewUrl}
                  />
                </CardContent>
              </Card>

              <BranchPosTerminalBindingCard branch={branch} />

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="branch-detail-receipt-name">
                        {m.branches.create.fields.receiptName}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.receiptName)}
                        id="branch-detail-receipt-name"
                        onChange={(event) =>
                          updateForm("receiptName", event.target.value)
                        }
                        value={formValues.receiptName}
                      />
                      <FieldError message={errors.receiptName} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="branch-detail-receipt-phone">
                        {m.branches.create.fields.receiptPhone}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.receiptPhone)}
                        id="branch-detail-receipt-phone"
                        onChange={(event) =>
                          updateForm("receiptPhone", event.target.value)
                        }
                        value={formValues.receiptPhone}
                      />
                      <FieldError message={errors.receiptPhone} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="branch-detail-address">
                      {m.branches.create.fields.address}
                    </Label>
                    <Textarea
                      aria-invalid={Boolean(errors.address)}
                      id="branch-detail-address"
                      onChange={(event) =>
                        updateForm("address", event.target.value)
                      }
                      value={formValues.address}
                    />
                    <FieldError message={errors.address} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="branch-detail-receipt-address">
                      {m.branches.create.fields.receiptAddress}
                    </Label>
                    <Textarea
                      aria-invalid={Boolean(errors.receiptAddress)}
                      id="branch-detail-receipt-address"
                      onChange={(event) =>
                        updateForm("receiptAddress", event.target.value)
                      }
                      value={formValues.receiptAddress}
                    />
                    <FieldError message={errors.receiptAddress} />
                  </div>

                  <BranchBusinessHoursEditor
                    disabled={saving}
                    error={errors.businessHours}
                    onChange={(value) => updateForm("businessHours", value)}
                    value={formValues.businessHours}
                  />
                </CardContent>
              </Card>
            </div>

            <aside className="grid self-start gap-5 lg:sticky lg:top-20">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="branch-detail-currency">
                      {m.branches.create.fields.currency}
                    </Label>
                    <Input
                      aria-readonly="true"
                      id="branch-detail-currency"
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
                    <Label htmlFor="branch-detail-language">
                      {m.branches.create.fields.defaultLanguage}
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        updateForm("defaultLanguage", value as BranchLanguage)
                      }
                      value={formValues.defaultLanguage}
                    >
                      <SelectTrigger id="branch-detail-language">
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
                    <Label>{m.branches.create.fields.status}</Label>
                    <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3">
                      <Badge
                        variant={
                          branch.status === "active" ? "default" : "outline"
                        }
                      >
                        {m.common.statusLabels[branch.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.branches.detail.statusHint}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        className="h-7 flex-1 text-xs"
                        disabled={saving || branch.status === "active"}
                        onClick={() => void handleStatusChange("active")}
                        type="button"
                        variant="outline"
                      >
                        {m.common.enable}
                      </Button>
                      <Button
                        className="h-7 flex-1 text-xs"
                        disabled={saving || branch.status === "inactive"}
                        onClick={() => void handleStatusChange("inactive")}
                        type="button"
                        variant="outline"
                      >
                        {m.common.disable}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-3 py-5 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {m.branches.detail.branchIdLabel}
                    </p>
                    <p className="mt-1 break-all font-medium">{branch.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {m.branches.detail.updatedLabel}
                    </p>
                    <p className="mt-1 font-medium">
                      {formatDateTime(branch.updatedAt) || m.common.notUpdated}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>

          {message ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              role="alert"
            >
              {message}
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
                {saving ? m.common.saving : m.branches.detail.saveBranch}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

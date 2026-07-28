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
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";
import { tenantQueryKeys } from "@/lib/query-keys";

import { updateBranchAction, updateBranchStatusAction } from "../actions";
import { branchLanguageValues } from "../constants";
import { useBranchDetailQuery } from "../queries";
import type {
  BranchFormValues,
  BranchLanguage,
  BranchStatus,
  BranchSummary,
} from "../types";

function isVersionConflict(result: { code?: string; status?: number }): boolean {
  return result.status === 409 || result.code === "BRANCH_VERSION_CONFLICT";
}

function businessHoursToText(
  businessHours: BranchSummary["businessHours"],
): string {
  return businessHours ? JSON.stringify(businessHours, null, 2) : "";
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
    logoUrl: branch.logoUrl ?? "",
    businessHoursJson: businessHoursToText(branch.businessHours),
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

  function applyUpdatedBranch(nextBranch: BranchSummary) {
    queryClient.setQueryData(
      tenantQueryKeys.branches.detail(nextBranch.id),
      nextBranch,
    );
    setFormValues(toFormValues(nextBranch));
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
      const result = await updateBranchAction(branch.id, {
        ...formValues,
        version: branch.version,
      });

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
                      onChange={(event) => updateForm("name", event.target.value)}
                      value={formValues.name}
                    />
                    <FieldError message={errors.name} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="branch-detail-phone">
                        {m.branches.create.fields.phone}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.phone)}
                        id="branch-detail-phone"
                        onChange={(event) => updateForm("phone", event.target.value)}
                        value={formValues.phone}
                      />
                      <FieldError message={errors.phone} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="branch-detail-logo-url">
                        {m.branches.create.fields.logoUrl}
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.logoUrl)}
                        id="branch-detail-logo-url"
                        onChange={(event) => updateForm("logoUrl", event.target.value)}
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
                      onChange={(event) => updateForm("address", event.target.value)}
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

                  <div className="grid gap-2">
                    <Label htmlFor="branch-detail-hours">
                      {m.branches.create.fields.businessHoursJson}
                    </Label>
                    <Textarea
                      aria-invalid={Boolean(errors.businessHoursJson)}
                      id="branch-detail-hours"
                      onChange={(event) =>
                        updateForm("businessHoursJson", event.target.value)
                      }
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
                    <Label htmlFor="branch-detail-currency">
                      {m.branches.create.fields.currency}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.defaultCurrency)}
                      id="branch-detail-currency"
                      maxLength={3}
                      onChange={(event) =>
                        updateForm(
                          "defaultCurrency",
                          event.target.value.toUpperCase(),
                        )
                      }
                      value={formValues.defaultCurrency}
                    />
                    <FieldError message={errors.defaultCurrency} />
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
                    <div className="flex h-10 items-center justify-between rounded-md border bg-muted/30 px-3">
                      <Badge
                        variant={branch.status === "active" ? "default" : "outline"}
                      >
                        {m.common.statusLabels[branch.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        v{branch.version}
                      </span>
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

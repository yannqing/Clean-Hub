"use client";

import { Badge, Button, Card, CardContent, toast } from "@cleanhub/ui";
import { useId, useState } from "react";

import { useSaasI18n } from "@/i18n";

import { updateTenantFeatureFlagsAction } from "../actions";
import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { tenantFeatureFlagOptions } from "../constants";
import { toFeatureFlagsFormValues } from "../feature-flags";
import type {
  TenantFeatureFlags,
  TenantFeatureFlagsFormValues,
} from "../types";
import { TenantFeatureFlagFields } from "./tenant-feature-flag-fields";

type TenantFeatureFlagsEditorProps = {
  disabled: boolean;
  initialValues: TenantFeatureFlagsFormValues;
  onUpdated: (featureFlags: TenantFeatureFlags) => void;
  tenantId: string;
};

export function TenantFeatureFlagsEditor({
  disabled,
  initialValues,
  onUpdated,
  tenantId,
}: TenantFeatureFlagsEditorProps) {
  const { m } = useSaasI18n();
  const headingId = useId();
  const [values, setValues] = useState(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabledCount = Object.values(initialValues).filter(Boolean).length;

  function updateValue(
    key: keyof TenantFeatureFlagsFormValues,
    value: boolean,
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSave() {
    if (disabled || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await updateTenantFeatureFlagsAction(tenantId, values);

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      setValues(toFeatureFlagsFormValues(result.data));
      onUpdated(result.data);
      toast.success(m.tenants.settings.flagsSaved);
    } catch (saveError) {
      const message = getTenantLoadErrorMessage(
        saveError,
        m.tenants.settings.flagsSaveFailed,
      );
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="grid gap-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold" id={headingId}>
            {m.tenants.settings.featureFlagsSection}
          </h2>
          <Badge variant="secondary">
            {m.tenants.settings.enabledFeatures} {enabledCount}/
            {tenantFeatureFlagOptions.length}
          </Badge>
        </div>

        <fieldset aria-labelledby={headingId} disabled={disabled || submitting}>
          <TenantFeatureFlagFields
            disabled={disabled || submitting}
            onChange={updateValue}
            values={values}
          />
        </fieldset>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            disabled={disabled || submitting}
            onClick={() => {
              void handleSave();
            }}
            type="button"
          >
            {submitting ? m.common.saving : m.tenants.settings.saveFeatureFlags}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

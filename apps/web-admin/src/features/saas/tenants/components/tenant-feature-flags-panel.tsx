"use client";

import { Button, Card, CardContent } from "@cleanhub/ui";
import { useEffect, useState } from "react";

import { useSaasI18n } from "@/i18n";

import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { toFeatureFlagsFormValues } from "../feature-flags";
import { getTenantFeatureFlagsQuery } from "../queries";
import type { TenantFeatureFlags } from "../types";
import { TenantFeatureFlagsEditor } from "./tenant-feature-flags-editor";

type FeatureFlagsLoadState = {
  tenantId: string;
} & (
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; featureFlags: TenantFeatureFlags }
);

export function TenantFeatureFlagsPanel({
  disabled,
  onTenantUpdated,
  tenantId,
}: {
  disabled: boolean;
  onTenantUpdated?: () => void;
  tenantId: string;
}) {
  const { m } = useSaasI18n();
  const [loadState, setLoadState] = useState<FeatureFlagsLoadState>({
    tenantId,
    status: "loading",
  });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;

    getTenantFeatureFlagsQuery(tenantId)
      .then((featureFlags) => {
        if (active) setLoadState({ tenantId, status: "ready", featureFlags });
      })
      .catch((error: unknown) => {
        if (active) setLoadState({ tenantId, status: "error", error });
      });

    return () => {
      active = false;
    };
  }, [tenantId, reloadCount]);

  if (loadState.tenantId === tenantId && loadState.status === "ready") {
    const { featureFlags } = loadState;

    return (
      <TenantFeatureFlagsEditor
        disabled={disabled}
        initialValues={toFeatureFlagsFormValues(featureFlags)}
        key={`${featureFlags.tenantId}-${featureFlags.version}`}
        onUpdated={(nextFlags) => {
          setLoadState({ tenantId, status: "ready", featureFlags: nextFlags });
          onTenantUpdated?.();
        }}
        tenantId={tenantId}
      />
    );
  }

  const hasError =
    loadState.tenantId === tenantId && loadState.status === "error";

  return (
    <Card aria-busy={!hasError} className="gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="grid gap-4 py-5">
        <h2 className="text-sm font-semibold">
          {m.tenants.settings.featureFlagsSection}
        </h2>
        {hasError ? (
          <>
            <p className="text-sm text-destructive" role="alert">
              {m.tenants.settings.flagsLoadFailed}{" "}
              {getTenantLoadErrorMessage(loadState.error, "")}
            </p>
            <div>
              <Button
                onClick={() => {
                  setLoadState({ tenantId, status: "loading" });
                  setReloadCount((current) => current + 1);
                }}
                type="button"
                variant="outline"
              >
                {m.tenants.settings.refresh}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            {m.tenants.settings.flagsLoading}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

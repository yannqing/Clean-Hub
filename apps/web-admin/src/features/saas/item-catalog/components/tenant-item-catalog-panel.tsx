"use client";

import {
  ApiHttpError,
  type TenantItemCatalogResponse,
  type TenantItemCatalogSelection,
} from "@cleanhub/api-client";
import { Button, Card, CardContent, toast } from "@cleanhub/ui";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSaasI18n } from "@/i18n";
import { saveTenantItemCatalogAction } from "../actions";
import { itemCatalogCopy } from "../copy";
import { getTenantItemCatalogQuery } from "../queries";
import {
  ItemCatalogPicker,
  normalizeCatalogSelection,
} from "./item-catalog-picker";

export function TenantItemCatalogPanel({
  tenantId,
  canEdit,
}: {
  tenantId: string;
  canEdit: boolean;
}) {
  const { locale } = useSaasI18n();
  const c = itemCatalogCopy(locale);
  const [catalog, setCatalog] = useState<TenantItemCatalogResponse | null>(
    null,
  );
  const [selection, setSelection] = useState<TenantItemCatalogSelection>({
    itemTypes: [],
    itemIds: [],
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<"load" | "save" | "conflict" | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    getTenantItemCatalogQuery(tenantId)
      .then((data) => {
        if (active) {
          setCatalog(data);
          setSelection(normalizeCatalogSelection(data.groups, data.selection));
          setError(null);
          setDirty(false);
        }
      })
      .catch(() => {
        if (active) setError("load");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenantId, refresh]);
  async function save() {
    if (!catalog || !canEdit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await saveTenantItemCatalogAction(
        tenantId,
        selection,
        catalog.version,
      );
      setCatalog(data);
      setSelection(normalizeCatalogSelection(data.groups, data.selection));
      setDirty(false);
      toast.success(c.saved);
    } catch (failure) {
      setError(
        failure instanceof ApiHttpError && failure.status === 409
          ? "conflict"
          : "save",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="space-y-4 py-5">
        <h2 className="text-sm font-semibold">{c.selection}</h2>
        <p className="text-xs leading-5 text-muted-foreground">
          {c.selectionHint}
        </p>
        {loading ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {c.loading}
          </p>
        ) : catalog ? (
          <>
            {catalog.selection === null ? (
              <p className="rounded-md border bg-muted/30 p-3 text-xs leading-5">
                {c.legacy}
              </p>
            ) : null}
            {catalog.groups.some(
              (group) =>
                !group.enabled || group.items.some((item) => !item.enabled),
            ) ? (
              <p className="text-xs text-muted-foreground">{c.unavailable}</p>
            ) : null}
            <ItemCatalogPicker
              groups={catalog.groups}
              selection={selection}
              locale={locale}
              disabled={busy || !canEdit}
              onChange={(value) => {
                setSelection(value);
                setDirty(true);
              }}
            />
          </>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error === "load"
              ? c.failed
              : error === "conflict"
                ? c.conflict
                : c.saveFailed}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || loading}
            onClick={() => {
              if (!dirty || window.confirm(c.leave)) {
                setLoading(true);
                setRefresh((key) => key + 1);
              }
            }}
          >
            {c.refresh}
          </Button>
          <Button
            type="button"
            disabled={busy || loading || !canEdit || !catalog || !dirty}
            onClick={() => void save()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? c.saving : c.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

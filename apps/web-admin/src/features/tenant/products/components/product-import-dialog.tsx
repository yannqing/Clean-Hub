"use client";

import type { ImportTenantProductsResponse } from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import { useEffect, useMemo, useRef, useState } from "react";
import { interpolate, useTenantI18n } from "@/i18n";
import {
  getProductImportOptionsAction,
  importProductsAction,
} from "../actions/import-products.action";
import {
  downloadProductImportTemplate,
  parseProductImportCsv,
  PRODUCT_IMPORT_MAX_BYTES,
  type ProductImportError,
} from "../product-import";

type Options = Awaited<ReturnType<typeof getProductImportOptionsAction>>;
type ImportFailure = Extract<
  Awaited<ReturnType<typeof importProductsAction>>,
  { ok: false }
>;

export function ProductImportDialog({
  open,
  onOpenChange,
  onImported,
  onFeatureDisabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  onFeatureDisabled: () => void;
}) {
  const { m } = useTenantI18n();
  const copy = m.products.importing;
  const [options, setOptions] = useState<Options | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState<
    "tooLarge" | "fileFailed" | "empty" | null
  >(null);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [result, setResult] = useState<ImportTenantProductsResponse | null>(
    null,
  );
  const importId = useRef(createId());
  const fileVersion = useRef(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    getProductImportOptionsAction()
      .then((data) => {
        if (!active) return;
        if (data.featureDisabled) {
          onFeatureDisabled();
          return;
        }
        setOptions(data);
        setLoadFailed(data.unavailable);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [open, onFeatureDisabled]);

  const parsed = useMemo(
    () =>
      csv && options?.currency
        ? parseProductImportCsv(csv, branchIds, options.currency)
        : null,
    [csv, branchIds, options],
  );

  function describeError(error: ProductImportError): string {
    const reason =
      error.code in copy
        ? copy[error.code as keyof typeof copy]
        : m.products.create.validation[
            error.code as keyof typeof m.products.create.validation
          ];
    return [
      error.row ? interpolate(copy.row, { row: String(error.row) }) : "",
      error.field,
      reason,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  async function readFile(file: File | undefined) {
    const version = ++fileVersion.current;
    importId.current = createId();
    setCsv("");
    setFailure(null);
    setFileError(null);
    if (!file) return;
    if (file.size === 0) {
      setFileError("empty");
      return;
    }
    if (
      !file.name.toLowerCase().endsWith(".csv") ||
      file.size > PRODUCT_IMPORT_MAX_BYTES
    ) {
      setFileError("tooLarge");
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      if (version === fileVersion.current) setCsv(text);
    } catch {
      if (version === fileVersion.current) setFileError("fileFailed");
    } finally {
      if (version === fileVersion.current) setReading(false);
    }
  }

  async function submit() {
    if (!parsed?.ok || submitting || reading || !branchIds.length) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const response = await importProductsAction({
        importId: importId.current,
        products: parsed.products,
      });
      if (response.ok) {
        setResult(response.data);
        onImported();
      } else if (response.code === "FEATURE_DISABLED") onFeatureDisabled();
      else setFailure(response);
    } catch {
      setFailure({
        ok: false,
        message: copy.uncertain,
        errors: {},
        row: undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const failureReason =
    failure &&
    (failure.code === "PRODUCT_IMPORT_CONFLICT"
      ? copy.conflict
      : Object.values(failure.errors)[0]
        ? m.products.create.validation[Object.values(failure.errors)[0]!]
        : failure.message);
  const uncertain = failure && (!failure.status || failure.status >= 500);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting && !reading) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3" role="status">
            <p className="text-sm font-medium text-emerald-700">
              {interpolate(copy.success, { count: String(result.imported) })}
            </p>
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
              {result.data.map((product) => (
                <li key={product.id} className="font-mono">
                  {product.skuCode}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={downloadProductImportTemplate}
              >
                {copy.template}
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                {copy.instructions}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                {copy.scopeHint}
              </p>
            </div>
            {!options && !loadFailed ? (
              <p className="text-sm" role="status">
                {copy.loading}
              </p>
            ) : null}
            {loadFailed ? (
              <p className="text-sm text-destructive" role="alert">
                {copy.unavailable}
              </p>
            ) : null}
            {options && !loadFailed ? (
              <>
                <p className="text-sm font-medium">
                  {interpolate(copy.currency, {
                    currency: options.currency ?? "—",
                  })}
                </p>
                <fieldset
                  disabled={submitting || reading}
                  className="grid gap-2"
                >
                  <legend className="mb-2 text-sm font-medium">
                    {copy.scope}
                  </legend>
                  <div className="grid max-h-36 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                    {options.branches.map((branch) => (
                      <label
                        className="flex min-w-0 items-center gap-2 text-sm"
                        key={branch.id}
                      >
                        <Checkbox
                          checked={branchIds.includes(branch.id)}
                          onCheckedChange={(checked) => {
                            importId.current = createId();
                            setFailure(null);
                            setBranchIds((current) =>
                              checked === true
                                ? [...current, branch.id]
                                : current.filter((id) => id !== branch.id),
                            );
                          }}
                        />
                        <span className="break-words">{branch.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                  {!options.branches.length
                    ? copy.noBranches
                    : !branchIds.length ? copy.chooseBranches : null}
                  </p>
                </fieldset>
                <div className="grid gap-2">
                  <Label htmlFor="product-import-csv">{copy.file}</Label>
                  <Input
                    id="product-import-csv"
                    type="file"
                    accept=".csv,text/csv"
                    disabled={submitting || reading || !options.branches.length}
                    onChange={(event) => {
                      void readFile(event.target.files?.[0]);
                    }}
                  />
                </div>
              </>
            ) : null}
            {fileError ? (
              <p className="text-sm text-destructive" role="alert">
                {copy[fileError]}
              </p>
            ) : null}
            {parsed && !parsed.ok ? (
              <ul className="space-y-1 text-xs text-destructive" role="alert">
                {parsed.errors.slice(0, 8).map((error, index) => (
                  <li key={index}>{describeError(error)}</li>
                ))}
              </ul>
            ) : null}
            {parsed?.ok ? (
              <div className="space-y-2">
                <p className="text-sm" role="status">
                  {interpolate(copy.preview, {
                    count: String(parsed.products.length),
                  })}
                </p>
                <div className="max-h-56 overflow-auto rounded-md border">
                  <DataTable className="w-full text-left text-xs">
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="p-2">
                          {m.products.create.fields.name}
                        </TableHead>
                        <TableHead className="p-2">
                          {m.products.create.fields.skuCode}
                        </TableHead>
                        <TableHead className="p-2">
                          {m.products.create.fields.salePrice}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.products
                        .slice(0, 10)
                        .map(({ rowNumber, product }) => (
                          <TableRow key={rowNumber} className="border-t">
                            <TableCell className="max-w-52 break-words p-2">
                              {product.name}
                            </TableCell>
                            <TableCell className="break-all p-2">
                              {product.skuCode || copy.autoSku}
                            </TableCell>
                            <TableCell className="p-2">
                              {product.salePrice}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </DataTable>
                </div>
              </div>
            ) : null}
            {failure ? (
              <div className="space-y-1 text-sm text-destructive" role="alert">
                <p>{uncertain ? copy.uncertain : copy.failed}</p>
                {!uncertain ? (
                  <p>
                    {failure.row
                      ? `${interpolate(copy.row, { row: String(failure.row) })} · `
                      : ""}
                    {failureReason}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting || reading}
            onClick={() => onOpenChange(false)}
          >
            {copy.close}
          </Button>
          {!result ? (
            <Button
              type="button"
              disabled={
                submitting ||
                reading ||
                loadFailed ||
                !options ||
                !parsed?.ok ||
                !branchIds.length
              }
              onClick={() => void submit()}
            >
              {submitting ? copy.submitting : copy.submit}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

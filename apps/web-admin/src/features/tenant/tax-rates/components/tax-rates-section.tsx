"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from "@cleanhub/ui";
import { Archive, ArchiveRestore, Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { interpolate, useTenantI18n } from "@/i18n";

import {
  createTaxRateAction,
  deleteTaxRateAction,
  updateTaxRateAction,
} from "../actions";
import { formatTaxRatePercent, fractionToPercent, percentToFraction } from "../percent";
import type { TaxRate, TaxRateActionErrorCode } from "../types";

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; rate: TaxRate };

function sortRates(rates: TaxRate[]): TaxRate[] {
  return [...rates].sort(
    (left, right) =>
      Number(left.archived) - Number(right.archived) ||
      left.displayOrder - right.displayOrder ||
      left.name.localeCompare(right.name),
  );
}

export function TaxRatesSection({
  canManage,
  initialRates,
  loadFailed,
}: {
  canManage: boolean;
  initialRates: TaxRate[];
  loadFailed: boolean;
}) {
  const { m } = useTenantI18n();
  const text = m.taxRates;
  const [rates, setRates] = useState(() => sortRates(initialRates));
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [name, setName] = useState("");
  const [ratePercent, setRatePercent] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [busyId, setBusyId] = useState<string | null>(null);

  function errorMessage(code: TaxRateActionErrorCode): string {
    return text.errors[code];
  }

  function replaceRate(next: TaxRate) {
    setRates((current) =>
      sortRates([...current.filter((rate) => rate.id !== next.id), next]),
    );
  }

  function openEditor(state: EditorState) {
    setEditor(state);
    setFieldError(undefined);
    setName(state.mode === "edit" ? state.rate.name : "");
    setRatePercent(state.mode === "edit" ? fractionToPercent(state.rate.rate) : "");
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    if (!name.trim()) {
      setFieldError(text.nameRequired);
      return;
    }
    if (!percentToFraction(ratePercent)) {
      setFieldError(text.rateInvalid);
      return;
    }

    setBusyId(editor.mode === "edit" ? editor.rate.id : "new");
    const result =
      editor.mode === "create"
        ? await createTaxRateAction({ name, ratePercent })
        : await updateTaxRateAction(editor.rate.id, {
            name,
            ratePercent,
            expectedVersion: editor.rate.version,
          });
    setBusyId(null);

    if (!result.ok) {
      setFieldError(errorMessage(result.code));
      return;
    }
    replaceRate(result.data);
    setEditor(null);
    toast.success(editor.mode === "create" ? text.created : text.updated);
  }

  async function toggleArchived(rate: TaxRate) {
    setBusyId(rate.id);
    const result = await updateTaxRateAction(rate.id, {
      archived: !rate.archived,
      expectedVersion: rate.version,
    });
    setBusyId(null);
    if (!result.ok) {
      toast.error(errorMessage(result.code));
      return;
    }
    replaceRate(result.data);
    toast.success(rate.archived ? text.restoredToast : text.archivedToast);
  }

  async function remove(rate: TaxRate) {
    if (!window.confirm(interpolate(text.deleteConfirm, { name: rate.name }))) {
      return;
    }
    setBusyId(rate.id);
    const result = await deleteTaxRateAction(rate.id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(errorMessage(result.code));
      return;
    }
    setRates((current) => current.filter((entry) => entry.id !== rate.id));
    toast.success(text.deleted);
  }

  return (
    <section className="px-4 py-5 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Percent aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-slate-950">{text.title}</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              {text.description}
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-amber-700">
              {text.templateOverride}
            </p>
          </div>
        </div>
        {canManage ? (
          <Button
            className="shrink-0 gap-2"
            disabled={loadFailed}
            onClick={() => openEditor({ mode: "create" })}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden className="size-4" />
            {text.add}
          </Button>
        ) : (
          <Badge className="w-fit shrink-0" variant="outline">
            {text.readOnly}
          </Badge>
        )}
      </div>

      {loadFailed ? (
        <p className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {text.loadFailed}
        </p>
      ) : rates.length === 0 ? (
        <p className="mt-4 max-w-3xl rounded-md border border-dashed px-3 py-4 text-xs text-slate-500">
          {text.empty}
        </p>
      ) : (
        <ul className="mt-4 max-w-3xl divide-y rounded-md border">
          {rates.map((rate) => {
            const inUse = rate.serviceCount + rate.productCount > 0;
            const busy = busyId === rate.id;
            return (
              <li
                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                key={rate.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-950">
                      {rate.name}
                    </span>
                    <Badge variant="secondary">{formatTaxRatePercent(rate.rate)}</Badge>
                    {rate.archived ? (
                      <Badge variant="outline">{text.archivedBadge}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {inUse
                      ? interpolate(text.usage, {
                          services: String(rate.serviceCount),
                          products: String(rate.productCount),
                        })
                      : text.unused}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button
                      disabled={busy}
                      onClick={() => openEditor({ mode: "edit", rate })}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Pencil aria-hidden className="size-4" />
                      <span className="sr-only sm:not-sr-only sm:ml-1">{text.edit}</span>
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => toggleArchived(rate)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {rate.archived ? (
                        <ArchiveRestore aria-hidden className="size-4" />
                      ) : (
                        <Archive aria-hidden className="size-4" />
                      )}
                      <span className="sr-only sm:not-sr-only sm:ml-1">
                        {rate.archived ? text.restore : text.archive}
                      </span>
                    </Button>
                    {/* A rate still on items cannot be deleted; archive it instead. */}
                    <Button
                      disabled={busy || inUse}
                      onClick={() => remove(rate)}
                      size="sm"
                      title={inUse ? text.errors.inUse : undefined}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden className="size-4" />
                      <span className="sr-only sm:not-sr-only sm:ml-1">{text.delete}</span>
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        open={editor !== null}
      >
        <DialogContent>
          <form className="grid gap-4" onSubmit={submitEditor}>
            <DialogHeader>
              <DialogTitle>
                {editor?.mode === "edit" ? text.editTitle : text.createTitle}
              </DialogTitle>
              <DialogDescription>{text.rateHint}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="tax-rate-name">{text.name}</Label>
              <Input
                autoFocus
                id="tax-rate-name"
                maxLength={80}
                onChange={(event) => {
                  setName(event.target.value);
                  setFieldError(undefined);
                }}
                placeholder={text.namePlaceholder}
                value={name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tax-rate-percent">{text.rate}</Label>
              <Input
                id="tax-rate-percent"
                inputMode="decimal"
                onChange={(event) => {
                  setRatePercent(event.target.value);
                  setFieldError(undefined);
                }}
                placeholder="18"
                value={ratePercent}
              />
            </div>
            {fieldError ? (
              <p className="text-xs text-destructive" role="alert">
                {fieldError}
              </p>
            ) : null}
            <DialogFooter>
              <Button onClick={() => setEditor(null)} type="button" variant="outline">
                {text.cancel}
              </Button>
              <Button disabled={busyId !== null} type="submit">
                {busyId !== null ? text.saving : text.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

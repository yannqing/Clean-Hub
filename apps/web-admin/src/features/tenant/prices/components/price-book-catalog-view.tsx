"use client";

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createPriceBookAction,
  deletePriceBookAction,
  updatePriceBookAction,
} from "../actions";
import { getPriceBookListQuery } from "../queries";
import type {
  PriceBookFormValues,
  PriceBookStatus,
  PriceBookSummary,
  PriceBusinessLine,
} from "../types";

type BusinessLineFilter = "all" | PriceBusinessLine;
type StatusFilter = "all" | PriceBookStatus;

const businessLineOptions: { label: string; value: PriceBusinessLine }[] = [
  { label: "Laundry", value: "laundry" },
  { label: "Dry cleaning", value: "dry_cleaning" },
  { label: "Pressing", value: "pressing" },
  { label: "Car wash", value: "car_wash" },
  { label: "Retail products", value: "retail_products" },
];

const statusLabels = {
  active: "Active",
  disabled: "Disabled",
  draft: "Draft",
};

const defaultFormValues: PriceBookFormValues = {
  businessLine: "laundry",
  name: "",
  currency: "XOF",
  status: "draft",
  branchId: "",
  effectiveFrom: "",
  effectiveTo: "",
  sortOrder: 0,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Price book request failed.";
}

function formatBusinessLine(value: PriceBusinessLine): string {
  return businessLineOptions.find((option) => option.value === value)?.label ?? value;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getStatusVariant(
  status: PriceBookStatus,
): "default" | "outline" | "secondary" {
  if (status === "active") {
    return "default";
  }

  if (status === "draft") {
    return "secondary";
  }

  return "outline";
}

function toFormValues(priceBook: PriceBookSummary): PriceBookFormValues {
  return {
    businessLine: priceBook.businessLine,
    name: priceBook.name,
    currency: priceBook.currency,
    status: priceBook.status,
    branchId: priceBook.branchId ?? "",
    effectiveFrom: priceBook.effectiveFrom?.slice(0, 10) ?? "",
    effectiveTo: priceBook.effectiveTo?.slice(0, 10) ?? "",
    sortOrder: priceBook.sortOrder,
  };
}

export function PriceBookCatalogView() {
  const [priceBooks, setPriceBooks] = useState<PriceBookSummary[]>([]);
  const [businessLine, setBusinessLine] = useState<BusinessLineFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [formValues, setFormValues] = useState<PriceBookFormValues>(defaultFormValues);
  const [editingPriceBookId, setEditingPriceBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      businessLine: businessLine === "all" ? undefined : businessLine,
      status: status === "all" ? undefined : status,
      q: query.trim() || undefined,
    }),
    [businessLine, query, status],
  );

  const loadPriceBooks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setPriceBooks(await getPriceBookListQuery(filters));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let isCurrent = true;

    getPriceBookListQuery(filters)
      .then((items) => {
        if (isCurrent) {
          setPriceBooks(items);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [filters]);

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);

    try {
      const result = editingPriceBookId
        ? await updatePriceBookAction(editingPriceBookId, formValues)
        : await createPriceBookAction(formValues);

      if (!result.ok) {
        setFormError(Object.values(result.errors)[0] ?? "Check the price book form.");
        return;
      }

      setFormValues(defaultFormValues);
      setEditingPriceBookId(null);
      await loadPriceBooks();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(priceBookId: string) {
    setSaving(true);
    setFormError(null);

    try {
      await deletePriceBookAction(priceBookId);
      await loadPriceBooks();
    } catch (deleteError) {
      setFormError(getErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant pricing</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">Prices</h1>
        </div>

        <Button onClick={loadPriceBooks} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_180px_180px]">
        <div className="grid gap-2">
          <Label htmlFor="price-search">Search</Label>
          <Input
            id="price-search"
            onChange={(event) => {
              setLoading(true);
              setQuery(event.target.value);
            }}
            placeholder="Price book name"
            value={query}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price-business-line">Business line</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setBusinessLine(value as BusinessLineFilter);
            }}
            value={businessLine}
          >
            <SelectTrigger id="price-business-line">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lines</SelectItem>
              {businessLineOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price-status">Status</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setStatus(value as StatusFilter);
            }}
            value={status}
          >
            <SelectTrigger id="price-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 border-b p-5 lg:grid-cols-[1fr_160px_160px]">
        <div className="grid gap-2">
          <Label htmlFor="price-name">Name</Label>
          <Input
            id="price-name"
            onChange={(event) =>
              setFormValues((current) => ({ ...current, name: event.target.value }))
            }
            value={formValues.name}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price-currency">Currency</Label>
          <Input
            id="price-currency"
            maxLength={3}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                currency: event.target.value.toUpperCase(),
              }))
            }
            value={formValues.currency}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price-sort-order">Sort</Label>
          <Input
            id="price-sort-order"
            min={0}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                sortOrder: Number(event.target.value),
              }))
            }
            type="number"
            value={formValues.sortOrder}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price-form-business-line">Business line</Label>
          <Select
            onValueChange={(value) =>
              setFormValues((current) => ({
                ...current,
                businessLine: value as PriceBusinessLine,
              }))
            }
            value={formValues.businessLine}
          >
            <SelectTrigger id="price-form-business-line">
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
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price-form-status">Status</Label>
          <Select
            onValueChange={(value) =>
              setFormValues((current) => ({
                ...current,
                status: value as PriceBookStatus,
              }))
            }
            value={formValues.status}
          >
            <SelectTrigger id="price-form-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price-branch-id">Branch ID</Label>
          <Input
            id="price-branch-id"
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                branchId: event.target.value,
              }))
            }
            placeholder="Optional"
            value={formValues.branchId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price-effective-from">Effective from</Label>
          <Input
            id="price-effective-from"
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                effectiveFrom: event.target.value,
              }))
            }
            type="date"
            value={formValues.effectiveFrom}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price-effective-to">Effective to</Label>
          <Input
            id="price-effective-to"
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                effectiveTo: event.target.value,
              }))
            }
            type="date"
            value={formValues.effectiveTo}
          />
        </div>

        <div className="flex flex-col gap-3 lg:col-span-3 lg:flex-row lg:items-center">
          <Button disabled={saving} onClick={handleSubmit} type="button">
            {editingPriceBookId ? "Update price book" : "Create price book"}
          </Button>
          {editingPriceBookId ? (
            <Button
              disabled={saving}
              onClick={() => {
                setEditingPriceBookId(null);
                setFormValues(defaultFormValues);
              }}
              type="button"
              variant="outline"
            >
              Cancel edit
            </Button>
          ) : null}
          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 p-5">
          {[0, 1, 2].map((item) => (
            <div className="h-14 animate-pulse rounded-md bg-muted" key={item} />
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : priceBooks.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">No price books yet</h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Price book</TableHead>
              <TableHead>Business line</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceBooks.map((priceBook) => (
              <TableRow key={priceBook.id}>
                <TableCell>
                  <div className="font-medium">{priceBook.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {priceBook.branchId ?? "All branches"}
                  </div>
                </TableCell>
                <TableCell>{formatBusinessLine(priceBook.businessLine)}</TableCell>
                <TableCell>{priceBook.currency}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(priceBook.status)}>
                    {statusLabels[priceBook.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatDate(priceBook.effectiveFrom)} -{" "}
                  {formatDate(priceBook.effectiveTo)}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    onClick={() => {
                      setEditingPriceBookId(priceBook.id);
                      setFormValues(toFormValues(priceBook));
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => void handleDelete(priceBook.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

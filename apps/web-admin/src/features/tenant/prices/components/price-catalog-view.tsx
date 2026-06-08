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
  updatePriceAction,
  updatePriceStatusAction,
} from "../actions";
import { getPriceListQuery } from "../queries";
import type {
  PriceBusinessLine,
  PriceFormValues,
  PriceStatus,
  PriceSummary,
} from "../types";

type BusinessLineFilter = "all" | PriceBusinessLine;
type StatusFilter = "all" | PriceStatus;

const businessLineOptions: { label: string; value: PriceBusinessLine }[] = [
  { label: "Laundry", value: "laundry" },
  { label: "Car wash", value: "car_wash" },
  { label: "Retail", value: "retail" },
  { label: "Delivery", value: "delivery" },
];

const statusLabels = {
  active: "Active",
  inactive: "Inactive",
};

const defaultFormValues: PriceFormValues = {
  amount: "",
  currency: "XOF",
  status: "active",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Price request failed.";
}

function formatBusinessLine(value: PriceBusinessLine): string {
  return businessLineOptions.find((option) => option.value === value)?.label ?? value;
}

function toFormValues(price: PriceSummary): PriceFormValues {
  return {
    amount: price.amount,
    currency: price.currency,
    status: price.status,
  };
}

export function PriceCatalogView() {
  const [prices, setPrices] = useState<PriceSummary[]>([]);
  const [businessLine, setBusinessLine] = useState<BusinessLineFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [formValues, setFormValues] = useState<PriceFormValues>(defaultFormValues);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
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

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setPrices(await getPriceListQuery(filters));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let isCurrent = true;

    getPriceListQuery(filters)
      .then((items) => {
        if (isCurrent) {
          setPrices(items);
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
    if (!editingPriceId) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const result = await updatePriceAction(editingPriceId, formValues);

      if (!result.ok) {
        setFormError(Object.values(result.errors)[0] ?? "Check the price form.");
        return;
      }

      setFormValues(defaultFormValues);
      setEditingPriceId(null);
      await loadPrices();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(priceId: string, currentStatus: PriceStatus) {
    setSaving(true);
    setFormError(null);

    try {
      await updatePriceStatusAction(
        priceId,
        currentStatus === "active" ? "inactive" : "active",
      );
      await loadPrices();
    } catch (statusError) {
      setFormError(getErrorMessage(statusError));
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

        <Button onClick={loadPrices} type="button" variant="outline">
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
            placeholder="Service name"
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {editingPriceId ? (
        <div className="grid gap-4 border-b p-5 lg:grid-cols-[160px_160px_180px_auto] lg:items-end">
          <div className="grid gap-2">
            <Label htmlFor="price-amount">Amount</Label>
            <Input
              id="price-amount"
              min="0.01"
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              step="0.01"
              type="number"
              value={formValues.amount}
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
            <Label htmlFor="price-form-status">Status</Label>
            <Select
              onValueChange={(value) =>
                setFormValues((current) => ({
                  ...current,
                  status: value as PriceStatus,
                }))
              }
              value={formValues.status}
            >
              <SelectTrigger id="price-form-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Button disabled={saving} onClick={handleSubmit} type="button">
              Update price
            </Button>
            <Button
              disabled={saving}
              onClick={() => {
                setEditingPriceId(null);
                setFormValues(defaultFormValues);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
          </div>
        </div>
      ) : formError ? (
        <div className="border-b p-5 text-sm text-destructive">{formError}</div>
      ) : null}

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
      ) : prices.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">No prices yet</h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Business line</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((price) => (
              <TableRow key={price.id}>
                <TableCell>
                  <div className="font-medium">{price.serviceName}</div>
                  <div className="text-xs text-muted-foreground">
                    {price.serviceId}
                  </div>
                </TableCell>
                <TableCell>{formatBusinessLine(price.businessLine)}</TableCell>
                <TableCell>
                  {price.amount} {price.currency}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={price.status === "active" ? "default" : "outline"}
                  >
                    {statusLabels[price.status]}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    disabled={saving}
                    onClick={() => void handleStatusChange(price.id, price.status)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {price.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingPriceId(price.id);
                      setFormValues(toFormValues(price));
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Edit
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

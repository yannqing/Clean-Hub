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
  createServiceAction,
  deleteServiceAction,
  updateServiceStatusAction,
  updateServiceAction,
} from "../actions";
import { getServiceListQuery } from "../queries";
import type {
  ServiceBusinessLine,
  ServiceFormValues,
  ServiceStatus,
  ServiceSummary,
} from "../types";

type BusinessLineFilter = "all" | ServiceBusinessLine;
type StatusFilter = "all" | ServiceStatus;

const businessLineOptions: { label: string; value: ServiceBusinessLine }[] = [
  { label: "Laundry", value: "laundry" },
  { label: "Car wash", value: "car_wash" },
  { label: "Retail", value: "retail" },
  { label: "Delivery", value: "delivery" },
];

const pricingUnitLabels = {
  per_item: "Per item",
  per_kg: "Per kg",
};

const statusLabels = {
  active: "Active",
  inactive: "Inactive",
};

const defaultFormValues: ServiceFormValues = {
  businessLine: "laundry",
  name: "",
  categoryId: "",
  pricingUnit: "per_item",
  status: "active",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Service request failed.";
}

function toFormValues(service: ServiceSummary): ServiceFormValues {
  return {
    businessLine: service.businessLine,
    name: service.name,
    categoryId: service.categoryId ?? "",
    pricingUnit: service.pricingUnit,
    status: service.status,
  };
}

function formatBusinessLine(value: ServiceBusinessLine): string {
  return businessLineOptions.find((option) => option.value === value)?.label ?? value;
}

export function ServiceCatalogView() {
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [businessLine, setBusinessLine] = useState<BusinessLineFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [formValues, setFormValues] = useState<ServiceFormValues>(defaultFormValues);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
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

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setServices(await getServiceListQuery(filters));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let isCurrent = true;

    getServiceListQuery(filters)
      .then((items) => {
        if (isCurrent) {
          setServices(items);
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
      const result = editingServiceId
        ? await updateServiceAction(editingServiceId, formValues)
        : await createServiceAction(formValues);

      if (!result.ok) {
        setFormError(Object.values(result.errors)[0] ?? "Check the service form.");
        return;
      }

      setFormValues(defaultFormValues);
      setEditingServiceId(null);
      await loadServices();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(serviceId: string) {
    setSaving(true);
    setFormError(null);

    try {
      await deleteServiceAction(serviceId);
      await loadServices();
    } catch (deleteError) {
      setFormError(getErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(service: ServiceSummary) {
    setSaving(true);
    setFormError(null);

    try {
      await updateServiceStatusAction(
        service.id,
        service.status === "active" ? "inactive" : "active",
      );
      await loadServices();
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
          <Badge variant="secondary">Tenant catalog</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">Services</h1>
        </div>

        <Button onClick={loadServices} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_180px_180px]">
        <div className="grid gap-2">
          <Label htmlFor="service-search">Search</Label>
          <Input
            id="service-search"
            onChange={(event) => {
              setLoading(true);
              setQuery(event.target.value);
            }}
            placeholder="Service name"
            value={query}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="service-business-line">Business line</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setBusinessLine(value as BusinessLineFilter);
            }}
            value={businessLine}
          >
            <SelectTrigger id="service-business-line">
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
          <Label htmlFor="service-status">Status</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setStatus(value as StatusFilter);
            }}
            value={status}
          >
            <SelectTrigger id="service-status">
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

      <div className="grid gap-4 border-b p-5 lg:grid-cols-[1fr_180px_180px_180px]">
        <div className="grid gap-2">
          <Label htmlFor="service-name">Name</Label>
          <Input
            id="service-name"
            onChange={(event) =>
              setFormValues((current) => ({ ...current, name: event.target.value }))
            }
            value={formValues.name}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="service-form-business-line">Business line</Label>
          <Select
            onValueChange={(value) =>
              setFormValues((current) => ({
                ...current,
                businessLine: value as ServiceBusinessLine,
              }))
            }
            value={formValues.businessLine}
          >
            <SelectTrigger id="service-form-business-line">
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
          <Label htmlFor="service-pricing-unit">Pricing</Label>
          <Select
            onValueChange={(value) =>
              setFormValues((current) => ({
                ...current,
                pricingUnit: value as ServiceFormValues["pricingUnit"],
              }))
            }
            value={formValues.pricingUnit}
          >
            <SelectTrigger id="service-pricing-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_item">Per item</SelectItem>
              <SelectItem value="per_kg">Per kg</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="service-form-status">Status</Label>
          <Select
            onValueChange={(value) =>
              setFormValues((current) => ({
                ...current,
                status: value as ServiceStatus,
              }))
            }
            value={formValues.status}
          >
            <SelectTrigger id="service-form-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-4 lg:flex-row lg:items-center">
          <Button disabled={saving} onClick={handleSubmit} type="button">
            {editingServiceId ? "Update service" : "Create service"}
          </Button>
          {editingServiceId ? (
            <Button
              disabled={saving}
              onClick={() => {
                setEditingServiceId(null);
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
      ) : services.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">No services yet</h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Business line</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <div className="font-medium">{service.name}</div>
                </TableCell>
                <TableCell>{formatBusinessLine(service.businessLine)}</TableCell>
                <TableCell>{pricingUnitLabels[service.pricingUnit]}</TableCell>
                <TableCell>
                  <Badge
                    variant={service.status === "active" ? "default" : "outline"}
                  >
                    {statusLabels[service.status]}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    onClick={() => {
                      setEditingServiceId(service.id);
                      setFormValues(toFormValues(service));
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => void handleStatusChange(service)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {service.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => void handleDelete(service.id)}
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

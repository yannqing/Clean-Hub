"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  toast,
} from "@cleanhub/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { interpolate, useTenantI18n } from "@/i18n";
import { isVersionConflict } from "@/features/tenant/shared/version-conflict";

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

const businessLineValues: ServiceBusinessLine[] = [
  "laundry",
  "car_wash",
  "retail",
  "delivery",
];

const defaultFormValues: ServiceFormValues = {
  businessLine: "laundry",
  name: "",
  categoryId: "",
  pricingUnit: "per_item",
  status: "active",
  version: 0,
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function toFormValues(service: ServiceSummary): ServiceFormValues {
  return {
    businessLine: service.businessLine,
    name: service.name,
    categoryId: service.categoryId ?? "",
    pricingUnit: service.pricingUnit,
    status: service.status,
    version: service.version,
  };
}

export function ServiceCatalogView() {
  const { m } = useTenantI18n();

  const businessLineOptions = useMemo(
    () =>
      businessLineValues.map((value) => ({
        value,
        label: m.common.businessLineLabels[value],
      })),
    [m],
  );

  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [businessLine, setBusinessLine] = useState<BusinessLineFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [formValues, setFormValues] = useState<ServiceFormValues>(defaultFormValues);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ServiceSummary | null>(null);
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
      setError(getErrorMessage(loadError, m.services.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [filters, m.services.requestFailed]);

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
          setError(getErrorMessage(loadError, m.services.requestFailed));
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
  }, [filters, m.services.requestFailed]);

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);

    try {
      const result = editingServiceId
        ? await updateServiceAction(editingServiceId, formValues)
        : await createServiceAction(formValues);

      if (!result.ok) {
        const conflict = isVersionConflict(result);
        const nextMessage = conflict
          ? m.services.versionConflict
          : Object.values(result.errors)[0] ??
            result.message ??
            m.services.formFallbackError;
        setFormError(nextMessage);
        if (conflict) {
          toast.error(nextMessage);
        }
        return;
      }

      setFormValues(defaultFormValues);
      setEditingServiceId(null);
      await loadServices();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, m.services.requestFailed));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(service: ServiceSummary) {
    setDeleting(true);

    const result = await deleteServiceAction(service.id);

    if (!result.ok) {
      const nextMessage = isVersionConflict(result)
        ? m.services.versionConflict
        : (result.message ?? m.services.requestFailed);
      toast.error(nextMessage);
      setDeleting(false);
      return;
    }

    toast.success(interpolate(m.services.deletedToast, { name: service.name }));
    setPendingDelete(null);
    await loadServices();
    setDeleting(false);
  }

  async function handleStatusChange(service: ServiceSummary) {
    setSaving(true);
    setFormError(null);

    const result = await updateServiceStatusAction(
      service.id,
      service.status === "active" ? "inactive" : "active",
      service.version,
    );

    if (!result.ok) {
      setFormError(
        isVersionConflict(result)
          ? m.services.versionConflict
          : (result.message ?? m.services.requestFailed),
      );
    } else {
      await loadServices();
    }

    setSaving(false);
  }

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.services.eyebrow}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.services.title}
          </h1>
        </div>

        <Button onClick={loadServices} type="button" variant="outline">
          {m.common.refresh}
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_180px_180px]">
        <div className="grid gap-2">
          <Label htmlFor="service-search">{m.services.formLabels.search}</Label>
          <Input
            id="service-search"
            onChange={(event) => {
              setLoading(true);
              setQuery(event.target.value);
            }}
            placeholder={m.services.searchPlaceholder}
            value={query}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="service-business-line">
            {m.services.formLabels.businessLine}
          </Label>
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
              <SelectItem value="all">{m.common.allLines}</SelectItem>
              {businessLineOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="service-status">{m.services.formLabels.status}</Label>
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
              <SelectItem value="all">{m.common.allStatuses}</SelectItem>
              <SelectItem value="active">{m.common.statusLabels.active}</SelectItem>
              <SelectItem value="inactive">
                {m.common.statusLabels.inactive}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 border-b p-5 lg:grid-cols-[1fr_180px_180px_180px]">
        <div className="grid gap-2">
          <Label htmlFor="service-name">{m.services.formLabels.name}</Label>
          <Input
            id="service-name"
            onChange={(event) =>
              setFormValues((current) => ({ ...current, name: event.target.value }))
            }
            value={formValues.name}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="service-form-business-line">
            {m.services.formLabels.businessLine}
          </Label>
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
          <Label htmlFor="service-pricing-unit">
            {m.services.formLabels.pricing}
          </Label>
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
              <SelectItem value="per_item">{m.common.pricingUnitLabels.per_item}</SelectItem>
              <SelectItem value="per_kg">{m.common.pricingUnitLabels.per_kg}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="service-form-status">{m.services.formLabels.status}</Label>
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
              <SelectItem value="active">{m.common.statusLabels.active}</SelectItem>
              <SelectItem value="inactive">
                {m.common.statusLabels.inactive}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-4 lg:flex-row lg:items-center">
          <Button disabled={saving} onClick={handleSubmit} type="button">
            {editingServiceId
              ? m.services.formButtons.updateService
              : m.services.formButtons.createService}
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
              {m.services.formButtons.cancelEdit}
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
            <h2 className="text-base font-semibold">{m.services.empty}</h2>
          </div>
        </div>
      ) : (
        <div className="p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.services.columns.service}</TableHead>
                <TableHead>{m.services.columns.businessLine}</TableHead>
                <TableHead>{m.services.columns.pricing}</TableHead>
                <TableHead>{m.services.columns.status}</TableHead>
                <TableHead className="text-right">
                  {m.services.columns.actions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div className="font-medium">{service.name}</div>
                  </TableCell>
                  <TableCell>
                    {m.common.businessLineLabels[service.businessLine]}
                  </TableCell>
                  <TableCell>
                    {m.common.pricingUnitLabels[service.pricingUnit]}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        service.status === "active" ? "default" : "outline"
                      }
                    >
                      {m.common.statusLabels[service.status]}
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
                      {m.services.actions.edit}
                    </Button>
                    <Button
                      disabled={saving}
                      onClick={() => void handleStatusChange(service)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {service.status === "active"
                        ? m.services.actions.deactivate
                        : m.services.actions.activate}
                    </Button>
                    <Button
                      onClick={() => setPendingDelete(service)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {m.services.actions.delete}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        open={pendingDelete !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.services.delete.title}</DialogTitle>
            <DialogDescription>
              {m.services.delete.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button
              disabled={deleting}
              onClick={() => pendingDelete && void handleDelete(pendingDelete)}
              variant="destructive"
            >
              {deleting ? m.services.delete.deleting : m.services.delete.action}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

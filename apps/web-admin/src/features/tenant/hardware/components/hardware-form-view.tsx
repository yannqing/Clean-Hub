"use client";

import {
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
  toast,
} from "@cleanhub/ui";
import { Check, ChevronRight, LoaderCircle, SquareTerminal, Wrench } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

import {
  bindDeviceAction,
  updateDeviceAction,
} from "../actions";
import {
  hardwareConnectionTypeOptions,
  hardwareDeviceStatusOptions,
  hardwareDeviceTypeOptions,
} from "../constants";
import { validateCreateDeviceForm, validateUpdateDeviceForm } from "../validators";
import type {
  CreateHardwareConfigRequest,
  HardwareConfigSummary,
  HardwareConnectionType,
  HardwareDeviceStatus,
  HardwareDeviceType,
  UpdateHardwareConfigRequest,
} from "../types";
import type { PointOfSaleDevice } from "../../point-of-sale/types";

type DeviceFormErrors = Partial<
  Record<"terminalId" | "name" | "deviceType" | "connectionType" | "status", string>
>;

type HardwareFormViewProps = {
  terminals?: PointOfSaleDevice[];
  terminalLoadFailed?: boolean;
  initialDevice?: HardwareConfigSummary;
  mode?: "create" | "edit";
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

function TerminalSelect({
  terminals,
  disabled,
  emptyLabel,
  onChange,
  selected,
}: {
  terminals: PointOfSaleDevice[];
  disabled?: boolean;
  emptyLabel: string;
  onChange: (value: string) => void;
  selected: string;
}) {
  if (terminals.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <Select
      disabled={disabled}
      onValueChange={(value) => onChange(value === "__none__" ? "" : value)}
      value={selected || "__none__"}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={emptyLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{emptyLabel}</SelectItem>
        {terminals.map((terminal) => (
          <SelectItem key={terminal.id} value={terminal.id}>
            {terminal.label || terminal.deviceId} · {terminal.branchName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function HardwareFormView({
  terminals = [],
  terminalLoadFailed = false,
  initialDevice,
  mode = "create",
}: HardwareFormViewProps) {
  const router = useRouter();
  const { m } = useTenantI18n();
  const isEditMode = mode === "edit";
  const [name, setName] = useState(initialDevice?.name ?? "");
  const [terminalId, setTerminalId] = useState(initialDevice?.terminalId ?? "");
  const [deviceType, setDeviceType] = useState<HardwareDeviceType>(
    initialDevice?.deviceType ?? "printer",
  );
  const [connectionType, setConnectionType] =
    useState<HardwareConnectionType>(
      initialDevice?.connectionType ?? "usb",
    );
  const [status, setStatus] = useState<HardwareDeviceStatus>(
    initialDevice?.status ?? "active",
  );
  const [errors, setErrors] = useState<DeviceFormErrors>({});
  const [saving, setSaving] = useState(false);

  const pageTitle = isEditMode
    ? m.hardware.edit.title
    : m.hardware.create.title;

  function clearError(field: keyof DeviceFormErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const validation = isEditMode
      ? validateUpdateDeviceForm({
          terminalId,
          connectionType,
          name,
          status,
          version: initialDevice?.version ?? 0,
        })
      : validateCreateDeviceForm({
          terminalId,
          connectionType,
          deviceType,
          name,
        });

    if (!validation.ok) {
      setErrors(validation.errors);
      toast.error(m.common.requestFailed);
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const result = isEditMode && initialDevice
        ? await updateDeviceAction(
            initialDevice.id,
            validation.data as UpdateHardwareConfigRequest,
          )
        : await bindDeviceAction(validation.data as CreateHardwareConfigRequest);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(isEditMode ? m.hardware.edit.updated : m.hardware.create.created);
      router.push(webAdminRoutes.tenant.hardware);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.hardware.requestFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-[960px] space-y-3 pb-20"
      data-mode={mode}
      data-testid="tenant-hardware-form-view"
    >
      <h1 className="sr-only">{pageTitle}</h1>
      <nav aria-label={m.hardware.title}>
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              aria-label={m.hardware.title}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={webAdminRoutes.tenant.hardware}
              title={m.hardware.title}
            >
              <Icon aria-hidden icon={Wrench} size={16} />
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground">
            <Icon aria-hidden icon={ChevronRight} size={14} />
          </li>
          <li>
            <span aria-current="page" className="font-medium">
              {pageTitle}
            </span>
          </li>
        </ol>
      </nav>

      <form
        aria-busy={saving}
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit}
      >
        {terminalLoadFailed ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            role="alert"
          >
            {m.common.requestFailed}
          </p>
        ) : null}

        <fieldset className="contents" disabled={saving || terminalLoadFailed}>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="hardware-name">
                      {m.hardware.create.labels.deviceName} *
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.name)}
                      aria-required="true"
                      id="hardware-name"
                      maxLength={200}
                      onChange={(event) => {
                        setName(event.target.value);
                        clearError("name");
                      }}
                      placeholder={m.hardware.create.labels.deviceName}
                      required
                      value={name}
                    />
                    <FieldError message={errors.name} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="hardware-type">
                      {m.hardware.create.labels.deviceType} *
                    </Label>
                    <Select
                      disabled={isEditMode}
                      onValueChange={(value) => {
                        setDeviceType(value as HardwareDeviceType);
                        clearError("deviceType");
                      }}
                      value={deviceType}
                    >
                      <SelectTrigger id="hardware-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hardwareDeviceTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={errors.deviceType} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="hardware-connection">
                      {m.hardware.create.labels.connectionType} *
                    </Label>
                    <Select
                      onValueChange={(value) => {
                        setConnectionType(value as HardwareConnectionType);
                        clearError("connectionType");
                      }}
                      value={connectionType}
                    >
                      <SelectTrigger id="hardware-connection">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hardwareConnectionTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={errors.connectionType} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <aside className="grid self-start gap-5 lg:sticky lg:top-20">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="hardware-terminal">
                      {m.hardware.create.labels.terminalId} *
                    </Label>
                    <TerminalSelect
                      terminals={terminals}
                      disabled={saving}
                      emptyLabel={m.hardware.noTerminals}
                      onChange={(value) => {
                        setTerminalId(value);
                        clearError("terminalId");
                      }}
                      selected={terminalId}
                    />
                    <FieldError message={errors.terminalId} />
                  </div>

                  {isEditMode ? (
                    <div className="grid gap-2">
                      <Label htmlFor="hardware-status">
                        {m.hardware.edit.labels.status}
                      </Label>
                      <Select
                        onValueChange={(value) => {
                          setStatus(value as HardwareDeviceStatus);
                          clearError("status");
                        }}
                        value={status}
                      >
                        <SelectTrigger id="hardware-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {hardwareDeviceStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {m.common.statusLabels[option.value] ?? option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={errors.status} />
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon aria-hidden icon={SquareTerminal} size={14} />
                    <span>{m.hardware.create.description}</span>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>

          <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end px-1">
            <div className="pointer-events-auto grid w-full grid-cols-2 items-center gap-1.5 rounded-xl border border-border/80 bg-background/90 p-1.5 shadow-[0_14px_40px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex sm:w-auto">
              <Button
                asChild
                className="rounded-lg"
                size="sm"
                type="button"
                variant="ghost"
              >
                <Link href={webAdminRoutes.tenant.hardware}>
                  {m.common.cancel}
                </Link>
              </Button>
              <Button
                aria-busy={saving}
                className="min-w-28 gap-2 rounded-lg"
                disabled={saving || terminalLoadFailed}
                size="sm"
                type="submit"
              >
                <Icon
                  aria-hidden
                  className={saving ? "animate-spin" : undefined}
                  icon={saving ? LoaderCircle : Check}
                  size={14}
                />
                {saving
                  ? m.common.saving
                  : isEditMode
                    ? m.hardware.edit.saveChanges
                    : m.hardware.create.action}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

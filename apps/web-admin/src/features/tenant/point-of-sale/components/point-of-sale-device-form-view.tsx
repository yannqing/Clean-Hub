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
  Textarea,
  toast,
} from "@cleanhub/ui";
import { ChevronRight, LoaderCircle, SquareTerminal } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

import { updatePointOfSaleDeviceAction } from "../actions";
import type {
  PointOfSaleBranchOption,
  PointOfSaleCashHandlingMode,
  PointOfSaleDevice,
  PointOfSaleDeviceStatus,
} from "../types";

type PointOfSaleDeviceFormViewProps = {
  device: PointOfSaleDevice;
  availableBranches: PointOfSaleBranchOption[];
};

export function PointOfSaleDeviceFormView({
  device,
  availableBranches,
}: PointOfSaleDeviceFormViewProps) {
  const router = useRouter();
  const { m } = useTenantI18n();
  const copy = m.pointOfSale.devices;
  const [label, setLabel] = useState(device.label ?? device.deviceId);
  const [branchId, setBranchId] = useState(device.branchId);
  const [status, setStatus] = useState<PointOfSaleDeviceStatus>(device.status);
  const [cashHandlingMode, setCashHandlingMode] =
    useState<PointOfSaleCashHandlingMode>(device.cashHandlingMode);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedLabel = label.trim();
    const normalizedReason = reason.trim();
    if (!normalizedLabel || normalizedReason.length < 3) {
      setError(copy.edit.required);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await updatePointOfSaleDeviceAction(device.id, {
        label: normalizedLabel,
        branchId,
        cashHandlingMode,
        status,
        reason: normalizedReason,
        version: device.version,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(copy.edit.saved);
      router.push(webAdminRoutes.tenant.pointOfSale.devices);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const environment = [
    copy.deviceTypes[device.deviceType],
    device.platform,
    device.platformVersion,
    device.appVersion ? `POS ${device.appVersion}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className="mx-auto w-full max-w-[900px] space-y-4 pb-16"
      data-testid="tenant-pos-device-form"
    >
      <nav aria-label={copy.title}>
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              aria-label={copy.title}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={webAdminRoutes.tenant.pointOfSale.devices}
              title={copy.title}
            >
              <Icon aria-hidden icon={SquareTerminal} size={16} />
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground">
            <Icon aria-hidden icon={ChevronRight} size={14} />
          </li>
          <li>
            <span aria-current="page" className="font-medium">
              {device.label || device.deviceId}
            </span>
          </li>
        </ol>
      </nav>

      <div>
        <h2 className="text-lg font-semibold">{copy.edit.title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {copy.edit.description}
        </p>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form aria-busy={saving} className="space-y-5" onSubmit={handleSubmit}>
        <fieldset className="contents" disabled={saving}>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-4 py-5">
                <div>
                  <h3 className="text-sm font-semibold">
                    {copy.edit.settingsTitle}
                  </h3>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pos-device-label">{copy.edit.label}</Label>
                  <Input
                    id="pos-device-label"
                    maxLength={64}
                    onChange={(event) => setLabel(event.target.value)}
                    required
                    value={label}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pos-device-branch">{copy.edit.branch}</Label>
                  <Select onValueChange={setBranchId} value={branchId}>
                    <SelectTrigger id="pos-device-branch" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pos-device-status">{copy.edit.status}</Label>
                  <Select
                    onValueChange={(value) =>
                      setStatus(value as PointOfSaleDeviceStatus)
                    }
                    value={status}
                  >
                    <SelectTrigger id="pos-device-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        {copy.enabledStatuses.active}
                      </SelectItem>
                      <SelectItem value="inactive">
                        {copy.enabledStatuses.inactive}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pos-device-cash-handling">
                    {m.pointOfSale.settings.fields.cashHandlingMode}
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setCashHandlingMode(
                        value as PointOfSaleCashHandlingMode,
                      )
                    }
                    value={cashHandlingMode}
                  >
                    <SelectTrigger
                      className="w-full"
                      id="pos-device-cash-handling"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        [
                          "none",
                          "untracked",
                          "shared_drawer",
                          "cash_in_hand",
                        ] as const
                      ).map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {m.pointOfSale.settings.cashHandlingModes[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {m.pointOfSale.settings.hints.cashHandlingMode}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pos-device-reason">{copy.edit.reason}</Label>
                  <Textarea
                    id="pos-device-reason"
                    maxLength={500}
                    onChange={(event) => setReason(event.target.value)}
                    required
                    rows={3}
                    value={reason}
                  />
                  <p className="text-xs text-muted-foreground">
                    {copy.edit.reasonHelp}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 rounded-lg py-0 shadow-none">
              <CardContent className="grid gap-4 py-5 text-xs">
                <h3 className="text-sm font-semibold">
                  {copy.edit.identityTitle}
                </h3>
                <div>
                  <p className="text-muted-foreground">{copy.edit.deviceId}</p>
                  <p className="mt-1 break-all font-mono">{device.deviceId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {copy.edit.deviceInfo}
                  </p>
                  <p className="mt-1 leading-5">{environment || "—"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button asChild type="button" variant="outline">
              <Link href={webAdminRoutes.tenant.pointOfSale.devices}>
                {copy.edit.cancel}
              </Link>
            </Button>
            <Button type="submit">
              {saving ? (
                <Icon
                  aria-hidden
                  className="animate-spin"
                  icon={LoaderCircle}
                  size={14}
                />
              ) : null}
              {saving ? copy.edit.saving : copy.edit.save}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

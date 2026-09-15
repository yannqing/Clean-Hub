"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PosBuiltInHardwareKey,
  PosHardwareDeviceSummary,
} from "@cleanhub/api-client";
import type { PosPrinterDevice } from "@cleanhub/hardware";
import { createId } from "@cleanhub/id";
import { useTranslation } from "@cleanhub/i18n/react";

import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  Separator,
} from "@cleanhub/ui";

import { Icon, type PosIconName } from "@/components/app-shell";
import { createCashDrawerOpenRequest } from "@/features/hardware/lib/cash-drawer";
import {
  discoverBuiltInHardware,
  type DiscoveredBuiltInHardware,
} from "@/features/hardware/lib/built-in-hardware";
import { getPosHardwareBridge } from "@/features/hardware/lib/desktop-bridge";
import { getConfiguredPrinter } from "@/features/hardware/lib/printer-binding";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { posToast as toast } from "@/lib/pos-toast";

const DEVICE_ICONS: Record<string, PosIconName> = {
  printer: "printer",
  scanner: "scan-line",
  cash_drawer: "wallet-cards",
};

type HardwareSettingsCardProps = {
  canManageSensitiveHardware: boolean;
  devices: PosHardwareDeviceSummary[];
  loading: boolean;
  onDevicesUpdated?(devices: PosHardwareDeviceSummary[]): void;
};

export function HardwareSettingsCard({
  canManageSensitiveHardware,
  devices,
  loading,
  onDevicesUpdated,
}: HardwareSettingsCardProps) {
  const { locale, t } = useTranslation();
  const [drawerDialogOpen, setDrawerDialogOpen] = useState(false);
  const [drawerReason, setDrawerReason] = useState("");
  const [openingDrawer, setOpeningDrawer] = useState(false);
  const [localPrinters, setLocalPrinters] = useState<PosPrinterDevice[]>([]);
  const [builtInHardware, setBuiltInHardware] = useState<
    DiscoveredBuiltInHardware[]
  >([]);
  const [printerRuntimeState, setPrinterRuntimeState] = useState<
    "loading" | "ready" | "unavailable" | "error"
  >("loading");
  const [printerOperationalStatus, setPrinterOperationalStatus] = useState<
    string | null
  >(null);
  const [bindingDevice, setBindingDevice] =
    useState<PosHardwareDeviceSummary | null>(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [bindingPrinter, setBindingPrinter] = useState(false);
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [settingDefaultPrinterId, setSettingDefaultPrinterId] = useState<
    string | null
  >(null);
  const [connectingBuiltIn, setConnectingBuiltIn] =
    useState<PosBuiltInHardwareKey | null>(null);
  const configuredDrawer = devices.find(
    (device) =>
      device.deviceType === "cash_drawer" && device.status === "active",
  );
  const selectedLocalPrinter = localPrinters.find(
    (printer) => printer.id === selectedPrinterId,
  );

  function deviceTypeLabel(deviceType: string) {
    if (deviceType === "printer") return t("pos.hardware.deviceType.printer");
    if (deviceType === "scanner") return t("pos.hardware.deviceType.scanner");
    if (deviceType === "cash_drawer") {
      return t("pos.hardware.deviceType.cashDrawer");
    }
    return deviceType;
  }

  function connectionTypeLabel(connectionType: string) {
    if (connectionType === "usb") return t("pos.hardware.connectionType.usb");
    if (connectionType === "bluetooth") {
      return t("pos.hardware.connectionType.bluetooth");
    }
    if (connectionType === "network") {
      return t("pos.hardware.connectionType.network");
    }
    if (connectionType === "other") {
      return t("pos.hardware.connectionType.other");
    }
    return connectionType;
  }

  function builtInDeviceName(input: {
    deviceType: string;
    deviceModel?: unknown;
    fallback: string;
  }) {
    const deviceModel =
      typeof input.deviceModel === "string" && input.deviceModel.trim()
        ? input.deviceModel.trim()
        : null;
    if (!deviceModel) return input.fallback;
    return input.deviceType === "printer"
      ? t("pos.hardware.deviceName.builtInPrinter", { model: deviceModel })
      : t("pos.hardware.deviceName.builtInScanner", { model: deviceModel });
  }

  function printerDisplayName(printer: Pick<PosPrinterDevice, "id" | "name">) {
    const builtIn = builtInHardware.find(
      (device) =>
        device.deviceType === "printer" && device.localDeviceId === printer.id,
    );
    return builtIn
      ? builtInDeviceName({
          deviceType: "printer",
          deviceModel: builtIn.deviceModel,
          fallback: printer.name,
        })
      : printer.name;
  }

  function storedPrinterDisplayName(printerId: string, printerName: string) {
    return printerDisplayName({ id: printerId, name: printerName });
  }

  const selectedLocalPrinterName = selectedLocalPrinter
    ? printerDisplayName(selectedLocalPrinter)
    : null;
  const formattedNow = () =>
    new Date().toLocaleString(locale === "en" ? "en-US" : locale);

  const discoverPrinters = useCallback(async () => {
    setPrinterRuntimeState("loading");
    const hardware = getPosHardwareBridge();
    if (!hardware) {
      setLocalPrinters([]);
      setPrinterOperationalStatus(null);
      setPrinterRuntimeState("unavailable");
      return;
    }
    try {
      const discovery = await discoverBuiltInHardware(hardware);
      const printers = discovery.localPrinters;
      setBuiltInHardware(discovery.devices);
      setPrinterOperationalStatus(discovery.printerStatus);
      setLocalPrinters(printers);
      setSelectedPrinterId((current) =>
        printers.some((printer) => printer.id === current)
          ? current
          : ((printers.find((printer) => printer.isDefault) ?? printers[0])
              ?.id ?? ""),
      );
      setPrinterRuntimeState(printers.length > 0 ? "ready" : "unavailable");
    } catch {
      setBuiltInHardware([]);
      setLocalPrinters([]);
      setPrinterOperationalStatus(null);
      setPrinterRuntimeState("error");
    }
  }, []);

  const scanForNearbyPrinters = useCallback(async () => {
    const hardware = getPosHardwareBridge();
    if (!hardware) {
      setPrinterRuntimeState("unavailable");
      return;
    }

    setScanningPrinters(true);
    try {
      const printers = hardware.discoverPrinters
        ? await hardware.discoverPrinters()
        : await hardware.listPrinters();
      setLocalPrinters(printers);
      setSelectedPrinterId((current) =>
        printers.some((printer) => printer.id === current)
          ? current
          : ((printers.find((printer) => printer.isDefault) ?? printers[0])
              ?.id ?? ""),
      );
      setPrinterRuntimeState(printers.length > 0 ? "ready" : "unavailable");
    } catch (error) {
      toast.error(
        getPosApiErrorMessage(error, t("pos.hardware.toast.scanNearbyFailed")),
      );
    } finally {
      setScanningPrinters(false);
    }
  }, [t]);

  const persistedBuiltInHardware = useMemo(() => {
    const currentHardwareKeys = new Set(
      builtInHardware.map((device) => device.hardwareKey),
    );
    return devices.filter(
      (device) =>
        device.provisioningMode === "built_in" &&
        Boolean(device.hardwareKey) &&
        currentHardwareKeys.has(device.hardwareKey as PosBuiltInHardwareKey),
    );
  }, [builtInHardware, devices]);
  const builtInRows = useMemo(() => {
    const keys = new Set<string>([
      ...builtInHardware.map((device) => device.hardwareKey),
      ...persistedBuiltInHardware
        .map((device) => device.hardwareKey)
        .filter((key): key is string => Boolean(key)),
    ]);

    return [...keys].map((hardwareKey) => ({
      hardwareKey: hardwareKey as PosBuiltInHardwareKey,
      discovered:
        builtInHardware.find((device) => device.hardwareKey === hardwareKey) ??
        null,
      persisted:
        persistedBuiltInHardware.find(
          (device) => device.hardwareKey === hardwareKey,
        ) ?? null,
    }));
  }, [builtInHardware, persistedBuiltInHardware]);
  const configuredDevices = useMemo(
    () => devices.filter((device) => device.provisioningMode !== "built_in"),
    [devices],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hardware discovery resolves asynchronously from the POS host bridge.
    void discoverPrinters();
  }, [discoverPrinters]);

  function openPrinterBinding(device: PosHardwareDeviceSummary) {
    const configured = getConfiguredPrinter(device);
    const initialPrinter =
      localPrinters.find((printer) => printer.id === configured?.printerId) ??
      localPrinters.find((printer) => printer.isDefault) ??
      localPrinters[0];
    setBindingDevice(device);
    setSelectedPrinterId(initialPrinter?.id ?? "");
    void scanForNearbyPrinters();
  }

  async function setDefaultPrinter(device: PosHardwareDeviceSummary) {
    const configured = getConfiguredPrinter(device);
    if (!configured) {
      toast.error(t("pos.hardware.toast.defaultRequiresConnection"));
      return;
    }
    if (!localPrinters.some((printer) => printer.id === configured.printerId)) {
      toast.error(t("pos.hardware.toast.defaultPrinterMissing"));
      return;
    }

    setSettingDefaultPrinterId(device.id);
    try {
      await posApi.pos.hardware.bindPrinter(device.id, {
        printerId: configured.printerId,
        printerName: configured.printerName,
        isDefault: true,
        version: device.version,
      });
      onDevicesUpdated?.((await posApi.pos.hardware.list()).data);
      toast.success(
        t("pos.hardware.toast.defaultSet", {
          name:
            device.hardwareKey && device.provisioningMode === "built_in"
              ? builtInDeviceName({
                  deviceType: device.deviceType,
                  deviceModel: device.config.deviceModel,
                  fallback: device.name,
                })
              : device.name,
          kind:
            device.config.printerPurpose === "label"
              ? t("pos.hardware.printerKind.label")
              : t("pos.hardware.printerKind.receipt"),
        }),
      );
    } catch (error) {
      toast.error(
        getPosApiErrorMessage(error, t("pos.hardware.toast.defaultFailed")),
      );
    } finally {
      setSettingDefaultPrinterId(null);
    }
  }

  async function testAndConnectBuiltIn(input: {
    hardwareKey: PosBuiltInHardwareKey;
    discovered: DiscoveredBuiltInHardware | null;
  }) {
    if (!input.discovered) {
      toast.error(t("pos.hardware.toast.builtInMissing"));
      return;
    }
    if (!input.discovered.available) {
      await discoverPrinters();
      toast.error(t("pos.hardware.toast.builtInUnavailable"));
      return;
    }

    setConnectingBuiltIn(input.hardwareKey);
    try {
      const hardware = getPosHardwareBridge();
      if (!hardware) {
        throw new Error(t("pos.hardware.toast.bridgeMissing"));
      }

      if (input.discovered.deviceType === "printer") {
        const printer = input.discovered.printer;
        if (!printer) {
          throw new Error(t("pos.hardware.toast.builtInPrinterMissing"));
        }
        const displayName = printerDisplayName(printer);
        const jobId = createId();
        const result = await hardware.print({
          id: jobId,
          printerId: printer.id,
          title: t("pos.hardware.printTest.builtInTitle"),
          content: [
            "CleanHub",
            t("pos.hardware.printTest.builtInConnection"),
            t("pos.hardware.printTest.deviceLine", { name: displayName }),
            t("pos.hardware.printTest.timeLine", { time: formattedNow() }),
            "",
          ].join("\n"),
          copies: 1,
        });
        if (result.jobId !== jobId || result.status !== "printed") {
          throw new Error(
            result.error ?? t("pos.hardware.toast.testPageFailed"),
          );
        }
      } else {
        if (!hardware.triggerScanner) {
          throw new Error(t("pos.hardware.toast.scannerTestUnsupported"));
        }
        await hardware.triggerScanner();
      }

      await posApi.pos.hardware.connectBuiltIn({
        hardwareKey: input.hardwareKey,
        name: input.discovered.name,
        deviceType: input.discovered.deviceType,
        localDeviceId: input.discovered.localDeviceId,
        ...(input.discovered.deviceModel
          ? { deviceModel: input.discovered.deviceModel }
          : {}),
      });
      onDevicesUpdated?.((await posApi.pos.hardware.list()).data);
      toast.success(
        input.discovered.deviceType === "printer"
          ? t("pos.hardware.toast.builtInPrinterConnected")
          : t("pos.hardware.toast.scannerConnected"),
      );
    } catch (error) {
      toast.error(
        getPosApiErrorMessage(
          error,
          t("pos.hardware.toast.builtInConnectFailed"),
        ),
      );
    } finally {
      setConnectingBuiltIn(null);
    }
  }

  async function testAndBindPrinter() {
    if (!bindingDevice || !selectedPrinterId) return;
    let printer = localPrinters.find(
      (candidate) => candidate.id === selectedPrinterId,
    );
    if (!printer) {
      toast.error(t("pos.hardware.toast.selectedPrinterUnavailable"));
      return;
    }

    setBindingPrinter(true);
    try {
      const hardware = getPosHardwareBridge();
      if (!hardware) {
        throw new Error(t("pos.hardware.toast.bridgeMissing"));
      }
      if (
        printer.connectionType === "bluetooth" &&
        printer.isPaired === false
      ) {
        if (!hardware.pairPrinter) {
          throw new Error(t("pos.hardware.toast.pairUnsupported"));
        }
        toast.info(t("pos.hardware.toast.pairing"));
        const pairedPrinter = await hardware.pairPrinter(printer.id);
        printer = pairedPrinter;
        setLocalPrinters((current) =>
          current.map((candidate) =>
            candidate.id === pairedPrinter.id ? pairedPrinter : candidate,
          ),
        );
      }
      const jobId = createId();
      const isLabelPrinter = bindingDevice.config.printerPurpose === "label";
      const purpose = isLabelPrinter ? "label" : "receipt";
      const hasDefaultForPurpose = devices.some(
        (device) =>
          device.id !== bindingDevice.id &&
          device.deviceType === "printer" &&
          device.status === "active" &&
          (device.config.printerPurpose === "label" ? "label" : "receipt") ===
            purpose &&
          device.config.printerIsDefault === true,
      );
      const displayName = printerDisplayName(printer);
      const result = await hardware.print({
        id: jobId,
        printerId: printer.id,
        title: isLabelPrinter
          ? t("pos.hardware.printTest.labelTitle")
          : t("pos.hardware.printTest.receiptTitle"),
        content: [
          "CleanHub",
          isLabelPrinter
            ? t("pos.hardware.printTest.labelContent")
            : t("pos.hardware.printTest.receiptContent"),
          t("pos.hardware.printTest.purposeLine", {
            purpose: isLabelPrinter
              ? t("pos.hardware.purpose.label")
              : t("pos.hardware.purpose.receipt"),
          }),
          t("pos.hardware.printTest.deviceLine", { name: displayName }),
          t("pos.hardware.printTest.timeLine", { time: formattedNow() }),
          t("pos.hardware.printTest.thanks"),
          "",
        ].join("\n"),
        qrCodeContent: `CH1:PRINTER-TEST:${jobId}`,
        copies: 1,
      });
      if (result.jobId !== jobId || result.status !== "printed") {
        throw new Error(result.error ?? t("pos.hardware.toast.testPageFailed"));
      }

      await posApi.pos.hardware.bindPrinter(bindingDevice.id, {
        printerId: printer.id,
        printerName: printer.name,
        isDefault:
          bindingDevice.config.printerIsDefault === true ||
          !hasDefaultForPurpose,
        version: bindingDevice.version,
      });
      onDevicesUpdated?.((await posApi.pos.hardware.list()).data);
      setBindingDevice(null);
      toast.success(t("pos.hardware.toast.printerConnected"));
    } catch (error) {
      toast.error(
        getPosApiErrorMessage(
          error,
          t("pos.hardware.toast.printerConnectFailed"),
        ),
      );
    } finally {
      setBindingPrinter(false);
    }
  }

  function printerStatus(device: PosHardwareDeviceSummary): {
    label: string;
    tone: string;
  } {
    const configured = getConfiguredPrinter(device);
    if (!configured) {
      return {
        label: t("pos.hardware.status.notConnected"),
        tone: "text-amber-700 lg:bg-amber-50",
      };
    }
    if (printerRuntimeState === "loading") {
      return {
        label: t("pos.hardware.status.detecting"),
        tone: "text-blue-700 lg:bg-blue-50",
      };
    }
    if (printerRuntimeState === "unavailable") {
      return {
        label: t("pos.hardware.status.bridgeUnavailable"),
        tone: "text-amber-700 lg:bg-amber-50",
      };
    }
    if (localPrinters.some((printer) => printer.id === configured.printerId)) {
      const operationalIssue: Record<string, { label: string; tone: string }> =
        {
          PRINTER_NO_PAPER: {
            label: t("pos.hardware.status.noPaper"),
            tone: "text-red-700 lg:bg-red-50",
          },
          PRINTER_COVER_OPEN: {
            label: t("pos.hardware.status.coverOpen"),
            tone: "text-red-700 lg:bg-red-50",
          },
          PRINTER_OVERHEATED: {
            label: t("pos.hardware.status.overheated"),
            tone: "text-red-700 lg:bg-red-50",
          },
          PRINTER_BUSY: {
            label: t("pos.hardware.status.printing"),
            tone: "text-blue-700 lg:bg-blue-50",
          },
          PRINTER_LOW_BATTERY: {
            label: t("pos.hardware.status.lowBattery"),
            tone: "text-amber-700 lg:bg-amber-50",
          },
        };
      const issue = printerOperationalStatus
        ? operationalIssue[printerOperationalStatus]
        : undefined;
      if (issue) return issue;
      return {
        label: t("pos.hardware.status.connected"),
        tone: "text-emerald-700 lg:bg-emerald-50",
      };
    }
    return {
      label: t("pos.hardware.status.notDetected"),
      tone: "text-red-700 lg:bg-red-50",
    };
  }

  async function openDrawer() {
    const reason = drawerReason.trim();
    if (!reason) {
      toast.error(t("pos.hardware.toast.drawerReasonRequired"));
      return;
    }

    setOpeningDrawer(true);
    try {
      const authorization = await posApi.pos.hardware.authorizeManualDrawerOpen(
        { reason },
      );
      const hardware = getPosHardwareBridge();
      if (!hardware) {
        throw new Error(t("pos.hardware.toast.bridgeMissingInClient"));
      }

      const capabilities = await hardware.getCapabilities();
      if (!capabilities.cashDrawer) {
        throw new Error(t("pos.hardware.toast.drawerAdapterUnavailable"));
      }

      if (!configuredDrawer) {
        throw new Error(t("pos.hardware.toast.drawerNotConfigured"));
      }

      await hardware.openCashDrawer(
        createCashDrawerOpenRequest({
          drawer: configuredDrawer,
          reason: authorization.reason,
          trigger: {
            type: "manual",
            authorizationId: authorization.authorizationId,
          },
        }),
      );
      toast.success(t("pos.hardware.toast.drawerOpened"));
      setDrawerDialogOpen(false);
      setDrawerReason("");
    } catch (error) {
      toast.error(
        getPosApiErrorMessage(error, t("pos.hardware.toast.drawerOpenFailed")),
      );
    } finally {
      setOpeningDrawer(false);
    }
  }

  return (
    <section className="bg-background lg:overflow-hidden lg:rounded-xl lg:border lg:border-black/10 lg:shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <header className="pb-7 lg:border-b lg:px-4 lg:py-3">
        <div className="flex items-center gap-2">
          <Icon
            className="hidden h-4 w-4 text-muted-foreground lg:block"
            name="printer"
          />
          <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-sm lg:font-semibold lg:tracking-normal">
            {t("pos.hardware.title")}
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground lg:mt-1 lg:text-xs lg:leading-5">
          {t("pos.hardware.description")}
        </p>
      </header>
      <div className="lg:p-4">
        {loading ? (
          <div className="flex min-h-24 items-center lg:justify-center">
            <div className="text-sm text-muted-foreground">
              {t("pos.hardware.loadingDevices")}
            </div>
          </div>
        ) : builtInRows.length === 0 && configuredDevices.length === 0 ? (
          <div className="flex min-h-24 items-center lg:justify-center lg:rounded-md lg:border lg:border-dashed">
            <p className="text-sm text-muted-foreground">
              {t("pos.hardware.emptyDevices")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {builtInRows.map(({ hardwareKey, discovered, persisted }) => {
              const connecting = connectingBuiltIn === hardwareKey;
              const status = connecting
                ? {
                    label: t("pos.hardware.status.connecting"),
                    tone: "text-blue-700 lg:bg-blue-50",
                  }
                : !discovered
                  ? {
                      label: t("pos.hardware.status.notDetectedHere"),
                      tone: "text-red-700 lg:bg-red-50",
                    }
                  : !discovered.available
                    ? {
                        label: t(
                          "pos.hardware.status.builtInServiceUnavailable",
                        ),
                        tone: "text-red-700 lg:bg-red-50",
                      }
                    : persisted
                      ? persisted.deviceType === "printer"
                        ? printerStatus(persisted)
                        : {
                            label: t("pos.hardware.status.connected"),
                            tone: "text-emerald-700 lg:bg-emerald-50",
                          }
                      : {
                          label: t("pos.hardware.status.connectable"),
                          tone: "text-amber-700 lg:bg-amber-50",
                        };
              const deviceType =
                discovered?.deviceType ?? persisted?.deviceType ?? "scanner";

              return (
                <div
                  className="flex min-h-[76px] items-center justify-between gap-3 py-3 lg:min-h-0 lg:border-b lg:last:border-b-0"
                  key={hardwareKey}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon
                      className="hidden h-5 w-5 shrink-0 text-muted-foreground lg:block"
                      name={DEVICE_ICONS[deviceType] ?? "settings"}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-medium text-foreground lg:text-sm">
                          {builtInDeviceName({
                            deviceType,
                            deviceModel:
                              discovered?.deviceModel ??
                              persisted?.config.deviceModel,
                            fallback:
                              discovered?.name ??
                              persisted?.name ??
                              hardwareKey,
                          })}
                        </p>
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                          {t("pos.hardware.label.builtInDevice")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground lg:mt-0 lg:text-xs">
                        {deviceTypeLabel(deviceType)}
                        {deviceType === "printer"
                          ? ` · ${t("pos.hardware.purpose.receipt")}`
                          : ""}
                        {persisted?.config.printerIsDefault === true
                          ? ` · ${t("pos.hardware.label.default")}`
                          : ""}
                        {persisted
                          ? ` · ${t("pos.hardware.label.synced")}`
                          : ` · ${t("pos.hardware.label.notRegistered")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canManageSensitiveHardware &&
                    persisted?.deviceType === "printer" ? (
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-semibold text-foreground">
                        <input
                          checked={persisted.config.printerIsDefault === true}
                          disabled={
                            connectingBuiltIn !== null ||
                            settingDefaultPrinterId !== null ||
                            !discovered?.available
                          }
                          name="default-printer-receipt"
                          onChange={() => void setDefaultPrinter(persisted)}
                          type="radio"
                        />
                        {t("pos.hardware.label.default")}
                      </label>
                    ) : null}
                    <span
                      className={`text-sm font-medium lg:rounded-full lg:px-2 lg:py-0.5 lg:text-xs ${status.tone}`}
                    >
                      {status.label}
                    </span>
                    {canManageSensitiveHardware && discovered ? (
                      <button
                        className="h-9 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={connectingBuiltIn !== null}
                        onClick={() =>
                          void testAndConnectBuiltIn({
                            hardwareKey,
                            discovered,
                          })
                        }
                        type="button"
                      >
                        {connecting
                          ? t("pos.hardware.action.testing")
                          : !discovered.available
                            ? t("pos.hardware.action.rescan")
                            : persisted
                              ? t("pos.hardware.action.testReconnect")
                              : t("pos.hardware.action.testConnect")}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {configuredDevices.map((device) => {
              const status =
                device.deviceType === "printer"
                  ? printerStatus(device)
                  : {
                      label:
                        device.status === "active"
                          ? t("pos.hardware.status.configured")
                          : t("pos.hardware.status.inactive"),
                      tone:
                        device.status === "active"
                          ? "text-emerald-700 lg:bg-emerald-50"
                          : "text-muted-foreground lg:bg-muted",
                    };
              const configuredPrinter = getConfiguredPrinter(device);
              return (
                <div
                  className="flex min-h-[76px] items-center justify-between gap-3 py-3 lg:min-h-0 lg:border-b lg:last:border-b-0"
                  key={device.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon
                      className="hidden h-5 w-5 shrink-0 text-muted-foreground lg:block"
                      name={DEVICE_ICONS[device.deviceType] ?? "settings"}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-foreground lg:text-sm">
                        {device.name}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground lg:mt-0 lg:text-xs">
                        {deviceTypeLabel(device.deviceType)}
                        {" · "}
                        {connectionTypeLabel(device.connectionType)}
                        {device.deviceType === "printer"
                          ? ` · ${
                              device.config.printerPurpose === "label"
                                ? t("pos.hardware.purpose.label")
                                : t("pos.hardware.purpose.receipt")
                            }`
                          : ""}
                        {device.deviceType === "printer" &&
                        device.config.printerIsDefault === true
                          ? ` · ${t("pos.hardware.label.default")}`
                          : ""}
                      </p>
                      {device.deviceType === "printer" && configuredPrinter ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {storedPrinterDisplayName(
                            configuredPrinter.printerId,
                            configuredPrinter.printerName,
                          )}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canManageSensitiveHardware &&
                    device.deviceType === "printer" ? (
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-semibold text-foreground">
                        <input
                          checked={device.config.printerIsDefault === true}
                          disabled={
                            !configuredPrinter ||
                            settingDefaultPrinterId !== null ||
                            !localPrinters.some(
                              (printer) =>
                                printer.id === configuredPrinter.printerId,
                            )
                          }
                          name={`default-printer-${device.config.printerPurpose === "label" ? "label" : "receipt"}`}
                          onChange={() => void setDefaultPrinter(device)}
                          type="radio"
                        />
                        {settingDefaultPrinterId === device.id
                          ? t("pos.hardware.action.settingDefault")
                          : t("pos.hardware.label.default")}
                      </label>
                    ) : null}
                    <span
                      className={`text-sm font-medium lg:rounded-full lg:px-2 lg:py-0.5 lg:text-xs ${status.tone}`}
                    >
                      {status.label}
                    </span>
                    {device.deviceType === "printer" &&
                    canManageSensitiveHardware ? (
                      <button
                        className="h-9 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={printerRuntimeState === "loading"}
                        onClick={() => openPrinterBinding(device)}
                        type="button"
                      >
                        {configuredPrinter
                          ? t("pos.hardware.action.testReconnect")
                          : t("pos.hardware.action.connect")}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canManageSensitiveHardware ? (
        <footer className="flex items-center justify-between gap-4 py-4 lg:border-t lg:px-4 lg:py-3">
          <div className="min-w-0">
            <p className="text-base font-medium text-foreground lg:text-sm">
              {t("pos.hardware.drawer.control")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground lg:text-xs">
              {configuredDrawer
                ? configuredDrawer.name
                : t("pos.hardware.drawer.notConfigured")}
            </p>
          </div>
          <button
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 lg:rounded-md lg:border lg:bg-transparent lg:text-foreground lg:hover:bg-accent"
            disabled={!configuredDrawer || loading}
            onClick={() => setDrawerDialogOpen(true)}
            type="button"
          >
            <Icon className="h-4 w-4" name="wallet-cards" />
            {t("pos.hardware.action.openDrawer")}
          </button>
        </footer>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open && !openingDrawer) {
            setDrawerReason("");
          }
          setDrawerDialogOpen(open);
        }}
        open={drawerDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pos.hardware.drawer.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("pos.hardware.drawer.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t("pos.hardware.drawer.reason")}
            <textarea
              className="min-h-24 rounded-md border bg-background px-3 py-2 font-normal text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              disabled={openingDrawer}
              maxLength={500}
              onChange={(event) => setDrawerReason(event.target.value)}
              placeholder={t("pos.hardware.drawer.reasonPlaceholder")}
              value={drawerReason}
            />
          </label>
          <DialogFooter>
            <button
              className="h-9 rounded-md border px-4 text-sm font-semibold text-foreground hover:bg-accent"
              disabled={openingDrawer}
              onClick={() => setDrawerDialogOpen(false)}
              type="button"
            >
              {t("pos.hardware.action.back")}
            </button>
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={openingDrawer || !drawerReason.trim()}
              onClick={() => void openDrawer()}
              type="button"
            >
              <Icon className="h-4 w-4" name="wallet-cards" />
              {openingDrawer
                ? t("pos.hardware.action.authorizing")
                : t("pos.hardware.action.authorizeOpen")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !bindingPrinter) setBindingDevice(null);
        }}
        open={Boolean(bindingDevice)}
      >
        <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-6 py-5 pr-14 text-left">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" name="printer" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <DialogTitle className="text-xl leading-7">
                  {t("pos.hardware.printerDialog.title", {
                    kind:
                      bindingDevice?.config.printerPurpose === "label"
                        ? t("pos.hardware.printerKind.label")
                        : t("pos.hardware.printerKind.receipt"),
                  })}
                </DialogTitle>
                <DialogDescription className="leading-5">
                  {t("pos.hardware.printerDialog.description")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {t("pos.hardware.printerDialog.availablePrinters")}
                  </p>
                  <Badge variant="secondary">
                    {t("pos.hardware.printerDialog.deviceCount", {
                      count: localPrinters.length,
                    })}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {scanningPrinters
                    ? t("pos.hardware.printerDialog.scanningHint")
                    : t("pos.hardware.printerDialog.selectHint")}
                </p>
              </div>
              <Button
                className="h-10 shrink-0"
                disabled={bindingPrinter || scanningPrinters}
                onClick={() => void scanForNearbyPrinters()}
                size="sm"
                type="button"
                variant="outline"
              >
                <Icon
                  className={cn("size-4", scanningPrinters && "animate-spin")}
                  name="rotate-ccw"
                />
                {scanningPrinters
                  ? t("pos.hardware.action.scanning")
                  : t("pos.hardware.action.rescan")}
              </Button>
            </div>

            {printerRuntimeState === "error" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  {t("pos.hardware.printerDialog.scanFailedTitle")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("pos.hardware.printerDialog.scanFailedHint")}
                </p>
              </div>
            ) : localPrinters.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="size-5" name="printer" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">
                  {scanningPrinters
                    ? t("pos.hardware.printerDialog.findingPrinters")
                    : t("pos.hardware.printerDialog.noPrinters")}
                </p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                  {t("pos.hardware.printerDialog.noPrintersHint")}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[min(340px,42vh)] rounded-xl border bg-muted/10">
                <RadioGroup
                  className="gap-2 p-2"
                  disabled={bindingPrinter || scanningPrinters}
                  onValueChange={setSelectedPrinterId}
                  value={selectedPrinterId}
                >
                  {localPrinters.map((printer, index) => {
                    const selected = printer.id === selectedPrinterId;
                    const paired = printer.isPaired !== false;
                    const optionId = `printer-option-${index}`;
                    const displayName = printerDisplayName(printer);

                    return (
                      <label
                        className={cn(
                          "flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border bg-background p-3.5 transition-colors",
                          "hover:border-primary/40 hover:bg-accent/40",
                          selected &&
                            "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20",
                          (bindingPrinter || scanningPrinters) &&
                            "cursor-not-allowed opacity-60",
                        )}
                        htmlFor={optionId}
                        key={printer.id}
                      >
                        <div
                          className={cn(
                            "flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
                            selected && "bg-primary/10 text-primary",
                          )}
                        >
                          <Icon className="size-5" name="printer" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {displayName}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline">
                              {printer.connectionType === "bluetooth"
                                ? t("pos.hardware.connectionType.bluetooth")
                                : printer.connectionType === "built_in"
                                  ? t("pos.hardware.connectionType.builtIn")
                                  : t(
                                      "pos.hardware.connectionType.systemDevice",
                                    )}
                            </Badge>
                            {printer.connectionType === "bluetooth" ? (
                              <Badge variant={paired ? "secondary" : "outline"}>
                                {paired
                                  ? t("pos.hardware.printerDialog.paired")
                                  : t(
                                      "pos.hardware.printerDialog.pairOnConnect",
                                    )}
                              </Badge>
                            ) : null}
                            {printer.isDefault ? (
                              <Badge variant="secondary">
                                {t("pos.hardware.printerDialog.systemDefault")}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <RadioGroupItem
                          aria-label={t(
                            "pos.hardware.printerDialog.selectPrinter",
                            { name: displayName },
                          )}
                          className="size-5"
                          id={optionId}
                          value={printer.id}
                        />
                      </label>
                    );
                  })}
                </RadioGroup>
              </ScrollArea>
            )}

            {selectedLocalPrinter ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                <Icon
                  className="size-4 shrink-0 text-emerald-600"
                  name="check"
                />
                <span className="truncate">
                  {t("pos.hardware.printerDialog.selected")}
                  <strong className="font-medium text-foreground">
                    {selectedLocalPrinterName}
                  </strong>
                </span>
              </div>
            ) : null}
          </div>

          <Separator />
          <DialogFooter className="bg-muted/30 px-6 py-4 sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t("pos.hardware.printerDialog.pairingHint")}
            </p>
            <Button
              className="h-11 min-w-36"
              disabled={
                bindingPrinter ||
                scanningPrinters ||
                !selectedPrinterId ||
                printerRuntimeState !== "ready"
              }
              onClick={() => void testAndBindPrinter()}
              type="button"
            >
              {bindingPrinter
                ? t("pos.hardware.action.pairTesting")
                : t("pos.hardware.action.testConnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

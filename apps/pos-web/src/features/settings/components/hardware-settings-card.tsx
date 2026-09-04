"use client";

import { useCallback, useEffect, useState } from "react";

import type { PosHardwareDeviceSummary } from "@cleanhub/api-client";
import type { PosPrinterDevice } from "@cleanhub/hardware";
import { createId } from "@cleanhub/id";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { Icon, type PosIconName } from "@/components/app-shell";
import { createCashDrawerOpenRequest } from "@/features/hardware/lib/cash-drawer";
import { getDesktopBridge } from "@/features/hardware/lib/desktop-bridge";
import { getConfiguredPrinter } from "@/features/hardware/lib/printer-binding";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { posToast as toast } from "@/lib/pos-toast";

const DEVICE_TYPE_LABELS: Record<string, string> = {
  printer: "打印机",
  scanner: "扫码枪",
  cash_drawer: "钱箱",
};

const CONNECTION_TYPE_LABELS: Record<string, string> = {
  usb: "USB",
  bluetooth: "蓝牙",
  network: "网络",
  other: "其他",
};

const DEVICE_ICONS: Record<string, PosIconName> = {
  printer: "printer",
  scanner: "scan-line",
  cash_drawer: "wallet-cards",
};

type HardwareSettingsCardProps = {
  canManageSensitiveHardware: boolean;
  devices: PosHardwareDeviceSummary[];
  loading: boolean;
  onDeviceUpdated?(device: PosHardwareDeviceSummary): void;
};

export function HardwareSettingsCard({
  canManageSensitiveHardware,
  devices,
  loading,
  onDeviceUpdated,
}: HardwareSettingsCardProps) {
  const [drawerDialogOpen, setDrawerDialogOpen] = useState(false);
  const [drawerReason, setDrawerReason] = useState("");
  const [openingDrawer, setOpeningDrawer] = useState(false);
  const [localPrinters, setLocalPrinters] = useState<PosPrinterDevice[]>([]);
  const [printerRuntimeState, setPrinterRuntimeState] = useState<
    "loading" | "ready" | "unavailable" | "error"
  >("loading");
  const [bindingDevice, setBindingDevice] =
    useState<PosHardwareDeviceSummary | null>(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [bindingPrinter, setBindingPrinter] = useState(false);
  const configuredDrawer = devices.find(
    (device) =>
      device.deviceType === "cash_drawer" && device.status === "active",
  );

  const discoverPrinters = useCallback(async () => {
    setPrinterRuntimeState("loading");
    const bridge = getDesktopBridge();
    if (!bridge) {
      setLocalPrinters([]);
      setPrinterRuntimeState("unavailable");
      return;
    }
    try {
      const capabilities = await bridge.hardware.getCapabilities();
      if (!capabilities.printer) {
        setLocalPrinters([]);
        setPrinterRuntimeState("unavailable");
        return;
      }
      const printers = await bridge.hardware.listPrinters();
      setLocalPrinters(printers);
      setSelectedPrinterId((current) =>
        printers.some((printer) => printer.id === current)
          ? current
          : (printers.find((printer) => printer.isDefault) ?? printers[0])?.id ??
            "",
      );
      setPrinterRuntimeState("ready");
    } catch {
      setLocalPrinters([]);
      setPrinterRuntimeState("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hardware discovery resolves asynchronously from the Desktop bridge.
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
  }

  async function testAndBindPrinter() {
    if (!bindingDevice || !selectedPrinterId) return;
    const printer = localPrinters.find(
      (candidate) => candidate.id === selectedPrinterId,
    );
    if (!printer) {
      toast.error("所选打印机已不可用，请重新检测。");
      return;
    }

    setBindingPrinter(true);
    try {
      const bridge = getDesktopBridge();
      if (!bridge) {
        throw new Error("未检测到 CleanHub Desktop 硬件桥。");
      }
      const jobId = createId();
      const result = await bridge.hardware.print({
        id: jobId,
        printerId: printer.id,
        title: "CleanHub 打印机测试",
        content: [
          "CleanHub",
          "打印机连接测试",
          `设备：${printer.name}`,
          `时间：${new Date().toLocaleString()}`,
          "",
        ].join("\n"),
        copies: 1,
      });
      if (result.jobId !== jobId || result.status !== "printed") {
        throw new Error(result.error ?? "测试页未能成功打印。");
      }

      const updated = await posApi.pos.hardware.bindPrinter(bindingDevice.id, {
        printerId: printer.id,
        printerName: printer.name,
        isDefault: printer.isDefault,
        version: bindingDevice.version,
      });
      onDeviceUpdated?.(updated);
      setBindingDevice(null);
      toast.success("测试打印成功，打印机已连接到当前终端。");
    } catch (error) {
      toast.error(
        getPosApiErrorMessage(error, "打印机测试或连接失败，请检查后重试。"),
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
      return { label: "未连接", tone: "text-amber-700 lg:bg-amber-50" };
    }
    if (printerRuntimeState === "loading") {
      return { label: "检测中…", tone: "text-blue-700 lg:bg-blue-50" };
    }
    if (printerRuntimeState === "unavailable") {
      return {
        label: "Desktop 未连接",
        tone: "text-amber-700 lg:bg-amber-50",
      };
    }
    if (
      localPrinters.some((printer) => printer.id === configured.printerId)
    ) {
      return { label: "已连接", tone: "text-emerald-700 lg:bg-emerald-50" };
    }
    return { label: "未检测到", tone: "text-red-700 lg:bg-red-50" };
  }

  async function openDrawer() {
    const reason = drawerReason.trim();
    if (!reason) {
      toast.error("请填写开钱箱原因。");
      return;
    }

    setOpeningDrawer(true);
    try {
      const authorization = await posApi.pos.hardware.authorizeManualDrawerOpen(
        { reason },
      );
      const bridge = getDesktopBridge();
      if (!bridge) {
        throw new Error(
          "未检测到 CleanHub Desktop 硬件桥，请在 Desktop 客户端中重试。",
        );
      }

      const capabilities = await bridge.hardware.getCapabilities();
      if (!capabilities.cashDrawer) {
        throw new Error(
          "当前终端的钱箱适配器不可用，请检查 Desktop 钱箱配置。",
        );
      }

      if (!configuredDrawer) {
        throw new Error("当前收银终端未配置可用钱箱。");
      }

      await bridge.hardware.openCashDrawer(
        createCashDrawerOpenRequest({
          drawer: configuredDrawer,
          reason: authorization.reason,
          trigger: {
            type: "manual",
            authorizationId: authorization.authorizationId,
          },
        }),
      );
      toast.success("钱箱已打开。");
      setDrawerDialogOpen(false);
      setDrawerReason("");
    } catch (error) {
      toast.error(
        getPosApiErrorMessage(error, "开钱箱失败，请检查硬件连接后重试。"),
      );
    } finally {
      setOpeningDrawer(false);
    }
  }

  return (
    <section className="bg-background lg:overflow-hidden lg:border-y">
      <header className="pb-7 lg:border-b lg:px-4 lg:py-3">
        <div className="flex items-center gap-2">
          <Icon
            className="hidden h-4 w-4 text-muted-foreground lg:block"
            name="printer"
          />
          <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-sm lg:font-semibold lg:tracking-normal">
            硬件设备
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground lg:mt-1 lg:text-xs lg:leading-5">
          当前收银终端已配置的硬件设备。如需添加或修改，请联系管理员在后台操作。
        </p>
      </header>
      <div className="lg:p-4">
        {loading ? (
          <div className="flex min-h-24 items-center lg:justify-center">
            <div className="text-sm text-muted-foreground">
              正在加载设备列表…
            </div>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex min-h-24 items-center lg:justify-center lg:rounded-md lg:border lg:border-dashed">
            <p className="text-sm text-muted-foreground">
              暂无已配置的硬件设备
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => {
              const status =
                device.deviceType === "printer"
                  ? printerStatus(device)
                  : {
                      label:
                        device.status === "active" ? "已配置" : "已停用",
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
                      {DEVICE_TYPE_LABELS[device.deviceType] ??
                        device.deviceType}
                      {" · "}
                      {CONNECTION_TYPE_LABELS[device.connectionType] ??
                        device.connectionType}
                    </p>
                    {device.deviceType === "printer" && configuredPrinter ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {configuredPrinter.printerName}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
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
                      {configuredPrinter ? "测试 / 重连" : "连接"}
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
              钱箱控制
            </p>
            <p className="mt-1 text-sm text-muted-foreground lg:text-xs">
              {configuredDrawer
                ? configuredDrawer.name
                : "当前收银终端未配置可用钱箱"}
            </p>
          </div>
          <button
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 lg:rounded-md lg:border lg:bg-transparent lg:text-foreground lg:hover:bg-accent"
            disabled={!configuredDrawer || loading}
            onClick={() => setDrawerDialogOpen(true)}
            type="button"
          >
            <Icon className="h-4 w-4" name="wallet-cards" />
            开钱箱
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
            <DialogTitle>手动开钱箱</DialogTitle>
            <DialogDescription>
              仅 Owner 或 Manager 可执行，授权原因和当前终端会写入审计记录。
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            操作原因
            <textarea
              className="min-h-24 rounded-md border bg-background px-3 py-2 font-normal text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              disabled={openingDrawer}
              maxLength={500}
              onChange={(event) => setDrawerReason(event.target.value)}
              placeholder="填写手动开钱箱原因"
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
              返回
            </button>
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={openingDrawer || !drawerReason.trim()}
              onClick={() => void openDrawer()}
              type="button"
            >
              <Icon className="h-4 w-4" name="wallet-cards" />
              {openingDrawer ? "授权中…" : "授权并打开"}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>连接小票打印机</DialogTitle>
            <DialogDescription>
              请选择当前设备操作系统中已安装的打印机。系统会先打印测试页，成功后才保存绑定。
            </DialogDescription>
          </DialogHeader>
          {printerRuntimeState === "unavailable" ? (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              未检测到 CleanHub Desktop 打印能力。请在 Desktop 客户端中打开 POS，并先在操作系统中安装打印机。
            </p>
          ) : printerRuntimeState === "error" ? (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              检测打印机失败，请检查系统打印服务后重试。
            </p>
          ) : localPrinters.length === 0 ? (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              当前设备没有检测到可用打印机。
            </p>
          ) : (
            <label className="grid gap-2 text-sm font-medium text-foreground">
              本机打印机
              <select
                className="h-11 rounded-md border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={bindingPrinter}
                onChange={(event) => setSelectedPrinterId(event.target.value)}
                value={selectedPrinterId}
              >
                {localPrinters.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name}{printer.isDefault ? "（系统默认）" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <DialogFooter>
            <button
              className="h-9 rounded-md border px-4 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
              disabled={bindingPrinter}
              onClick={() => void discoverPrinters()}
              type="button"
            >
              重新检测
            </button>
            <button
              className="h-9 rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                bindingPrinter ||
                !selectedPrinterId ||
                printerRuntimeState !== "ready"
              }
              onClick={() => void testAndBindPrinter()}
              type="button"
            >
              {bindingPrinter ? "正在测试…" : "测试并连接"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

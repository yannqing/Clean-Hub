"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { PosHardwareDeviceSummary } from "@cleanhub/api-client";
import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";
import { posToast as toast } from "@/lib/pos-toast";

import { posApi } from "@/lib/api-client";
import { getOrCreatePosDeviceId } from "@/features/auth/utils/device-id";

import { TERMINAL_SETTINGS_DEFAULTS } from "../constants";
import { fetchTerminalSettings, updateTerminalSettings } from "../queries";
import type {
  PosTerminalSettings,
  SettingsPageState,
  TerminalSettingsFormValues,
} from "../types";
import { GeneralSettingsCard } from "./general-settings-card";
import { HardwareSettingsCard } from "./hardware-settings-card";
import { SettingsIndex } from "./settings-index";
import {
  TerminalSettingsCard,
  type TerminalSettingsMode,
} from "./terminal-settings-card";

export type SettingsSection =
  | TerminalSettingsMode
  | "store"
  | "hardware";

const SETTINGS_SECTION_TITLES: Record<SettingsSection, string> = {
  terminal: "终端信息",
  checkout: "收银偏好",
  printing: "打印设置",
  security: "安全设置",
  store: "门店信息",
  hardware: "硬件设备",
};

type BranchInfo = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  receiptName: string | null;
  receiptPhone: string | null;
  receiptAddress: string | null;
};

/** Fetch the current POS user's branch (contains receipt info). */
async function fetchMyBranch(): Promise<BranchInfo | null> {
  try {
    const branch = await posApi.pos.branches.getMine();
    if (!branch) return null;
    return {
      id: branch.id,
      name: branch.name ?? "",
      address: branch.address ?? null,
      phone: branch.phone ?? null,
      receiptName: branch.receiptName ?? null,
      receiptPhone: branch.receiptPhone ?? null,
      receiptAddress: branch.receiptAddress ?? null,
    };
  } catch {
    return null;
  }
}

/** Fetch hardware devices via the POS read-only endpoint. */
async function fetchHardwareDevices(): Promise<PosHardwareDeviceSummary[]> {
  try {
    const response = await posApi.pos.hardware.list();
    return response.data;
  } catch {
    return [];
  }
}

function assertCurrentTerminalDevice(
  settings: PosTerminalSettings,
  deviceId: string,
): void {
  if (settings.deviceId !== deviceId) {
    throw new Error(
      "当前设备标识与已登记终端不一致，请退出并重新完成终端登记。",
    );
  }
}

type SettingsViewProps = {
  section?: SettingsSection;
};

export function SettingsView({ section }: SettingsViewProps = {}) {
  const router = useRouter();
  const [pageState, setPageState] = useState<SettingsPageState>("loading");
  const [terminalSettings, setTerminalSettings] =
    useState<PosTerminalSettings | null>(null);
  const [formValues, setFormValues] = useState<TerminalSettingsFormValues>(
    TERMINAL_SETTINGS_DEFAULTS,
  );
  const [saving, setSaving] = useState(false);

  // Branch information displayed alongside the terminal settings.
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null);

  // Hardware devices
  const [hardwareDevices, setHardwareDevices] = useState<
    PosHardwareDeviceSummary[]
  >([]);
  const [hardwareLoading, setHardwareLoading] = useState(true);
  const [canManageSensitiveHardware, setCanManageSensitiveHardware] =
    useState(false);

  const handleHardwareDevicesUpdated = useCallback(
    (updated: PosHardwareDeviceSummary[]) => setHardwareDevices(updated),
    [],
  );

  // Load all data on mount.
  const loadData = useCallback(async () => {
    setPageState("loading");
    setHardwareLoading(true);

    try {
      // Native installations keep the authoritative id in Capacitor
      // Preferences. Never issue terminal requests with the synchronous
      // localStorage fallback while that value is still being resolved.
      const resolvedDeviceId = await getOrCreatePosDeviceId();

      const [branch, settings, devices, authContext] = await Promise.all([
        fetchMyBranch(),
        fetchTerminalSettings(),
        fetchHardwareDevices(),
        posApi.auth.me(),
      ]);
      assertCurrentTerminalDevice(settings, resolvedDeviceId);

      setBranchInfo(branch);
      setTerminalSettings(settings);
      setFormValues({
        label: settings.label ?? "",
        defaultPaymentMethod: settings.defaultPaymentMethod,
        paymentMethodsEnabled: settings.paymentMethodsEnabled,
        cashHandlingMode: settings.cashHandlingMode,
        roundingRule: settings.roundingRule,
        autoPrintReceipt: settings.autoPrintReceipt,
        printCopies: settings.printCopies,
        lockTimeoutSeconds: settings.lockTimeoutSeconds,
      });
      setHardwareDevices(devices);
      setCanManageSensitiveHardware(
        authContext.role === "owner" || authContext.role === "manager",
      );

      setPageState("ready");
    } catch (error) {
      setPageState("error");
      toast.error(
        error instanceof Error ? error.message : "加载设置失败，请重试。",
      );
    } finally {
      setHardwareLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial/dependent data fetch; setState happens in the async continuation, not synchronously in the effect body.
    void loadData();
  }, [loadData]);

  // Save terminal settings.
  async function handleSave(values: TerminalSettingsFormValues) {
    if (pageState !== "ready" || !terminalSettings) {
      toast.error("当前终端设置尚未加载完成，请刷新后重试。");
      return;
    }

    setSaving(true);
    try {
      // Always wait for the native authoritative id again before a mutation.
      // The resolver is memoized, while avoiding any synchronous fallback.
      const resolvedDeviceId = await getOrCreatePosDeviceId();
      assertCurrentTerminalDevice(terminalSettings, resolvedDeviceId);

      const result = await updateTerminalSettings({
        label: values.label || undefined,
        roundingRule: values.roundingRule,
        autoPrintReceipt: values.autoPrintReceipt,
        printCopies: values.printCopies,
        lockTimeoutSeconds: values.lockTimeoutSeconds,
      });
      assertCurrentTerminalDevice(result, resolvedDeviceId);

      setTerminalSettings(result);
      setFormValues({
        label: result.label ?? "",
        defaultPaymentMethod: result.defaultPaymentMethod,
        paymentMethodsEnabled: result.paymentMethodsEnabled,
        cashHandlingMode: result.cashHandlingMode,
        roundingRule: result.roundingRule,
        autoPrintReceipt: result.autoPrintReceipt,
        printCopies: result.printCopies,
        lockTimeoutSeconds: result.lockTimeoutSeconds,
      });
      toast.success("设置已保存");
      // The (pos) layout reads lockTimeoutSeconds on the server and feeds the
      // idle auto lock. Refresh server components so the new value applies
      // without a full reload.
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存失败，请重试。",
      );
    } finally {
      setSaving(false);
    }
  }

  const isLoading = pageState !== "ready";

  if (section) {
    const sectionTitle = SETTINGS_SECTION_TITLES[section];
    const sectionContent =
      section === "store" ? (
        <GeneralSettingsCard
          branchAddress={branchInfo?.address ?? null}
          branchName={branchInfo?.name ?? ""}
          branchPhone={branchInfo?.phone ?? null}
          receiptAddress={branchInfo?.receiptAddress ?? null}
          receiptName={branchInfo?.receiptName ?? null}
          receiptPhone={branchInfo?.receiptPhone ?? null}
        />
      ) : section === "hardware" ? (
        <HardwareSettingsCard
          canManageSensitiveHardware={canManageSensitiveHardware}
          devices={hardwareDevices}
          loading={hardwareLoading}
          onDevicesUpdated={handleHardwareDevicesUpdated}
        />
      ) : (
        <TerminalSettingsCard
          key={`terminal-${section}-${terminalSettings?.version ?? "new"}-${isLoading}`}
          initial={formValues}
          loading={isLoading}
          mode={section}
          saving={saving}
          onSave={handleSave}
        />
      );

    return (
      <section className="mx-auto w-full max-w-[720px] space-y-4 pb-8 lg:max-w-none">
        <Link
          className="inline-flex h-9 items-center gap-1.5 rounded-lg pr-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          href={posRoutes.settings}
        >
          <Icon className="size-4" name="arrow-left" />
          设置
        </Link>
        <h1 className="sr-only">{sectionTitle}</h1>
        {sectionContent}
      </section>
    );
  }

  // The index is a way in, not a form. It used to render every terminal field
  // on desktop, which repeated whole-for-whole what the four section routes
  // already edit -- two places to change the same setting, and no sign which
  // one had been saved. Mobile was always a list; desktop now matches.
  return (
    <SettingsIndex
      branchName={branchInfo?.name ?? ""}
      formValues={formValues}
      hardwareCount={hardwareDevices.length}
      loading={isLoading || hardwareLoading}
    />
  );
}

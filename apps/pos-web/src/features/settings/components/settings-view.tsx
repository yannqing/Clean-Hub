"use client";

import { useCallback, useEffect, useState } from "react";

import type { PosHardwareDeviceSummary } from "@cleanhub/api-client";
import {
  PosBreadcrumb,
  PosFormLayout,
  PosPageHeader,
} from "@/components/app-shell";
import { posToast as toast } from "@/lib/pos-toast";

import { posApi } from "@/lib/api-client";
import { getOrCreatePosDeviceId } from "@/features/auth/utils/device-id";

import {
  SETTINGS_PAGE_DESCRIPTION,
  SETTINGS_PAGE_TITLE,
  TERMINAL_SETTINGS_DEFAULTS,
} from "../constants";
import { fetchTerminalSettings, updateTerminalSettings } from "../queries";
import type {
  PosTerminalSettings,
  SettingsPageState,
  TerminalSettingsFormValues,
} from "../types";
import { GeneralSettingsCard } from "./general-settings-card";
import { HardwareSettingsCard } from "./hardware-settings-card";
import { TerminalSettingsCard } from "./terminal-settings-card";

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

export function SettingsView() {
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
        defaultPaymentMethod: values.defaultPaymentMethod,
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
        roundingRule: result.roundingRule,
        autoPrintReceipt: result.autoPrintReceipt,
        printCopies: result.printCopies,
        lockTimeoutSeconds: result.lockTimeoutSeconds,
      });
      toast.success("设置已保存");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存失败，请重试。",
      );
    } finally {
      setSaving(false);
    }
  }

  const isLoading = pageState !== "ready";

  return (
    <section className="mx-auto w-full max-w-[960px] space-y-7 pb-8">
      <PosBreadcrumb items={[{ label: SETTINGS_PAGE_TITLE }]} />
      <PosPageHeader
        description={SETTINGS_PAGE_DESCRIPTION}
        icon="settings"
        title={SETTINGS_PAGE_TITLE}
      />

      <PosFormLayout
        className="pb-0"
        aside={
          <div className="grid gap-5">
            <GeneralSettingsCard
              branchAddress={branchInfo?.address ?? null}
              branchName={branchInfo?.name ?? ""}
              branchPhone={branchInfo?.phone ?? null}
              receiptAddress={branchInfo?.receiptAddress ?? null}
              receiptName={branchInfo?.receiptName ?? null}
              receiptPhone={branchInfo?.receiptPhone ?? null}
            />
            <HardwareSettingsCard
              canManageSensitiveHardware={canManageSensitiveHardware}
              devices={hardwareDevices}
              loading={hardwareLoading}
            />
          </div>
        }
      >
        {/* key forces remount when server data arrives, so useState re-initializes. */}
        <TerminalSettingsCard
          key={`terminal-${terminalSettings?.version ?? "new"}-${isLoading}`}
          initial={formValues}
          loading={isLoading}
          saving={saving}
          onSave={handleSave}
        />
      </PosFormLayout>
    </section>
  );
}

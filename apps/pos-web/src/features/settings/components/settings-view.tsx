"use client";

import { useCallback, useEffect, useState } from "react";

import type { PosHardwareDeviceSummary } from "@cleanhub/api-client";
import { PosBreadcrumb } from "@/components/app-shell";
import { posToast as toast } from "@/lib/pos-toast";

import { posApi } from "@/lib/api-client";
import { getPosDeviceIdSync } from "@/features/auth/utils/device-id";

import { SETTINGS_PAGE_DESCRIPTION, SETTINGS_PAGE_TITLE, TERMINAL_SETTINGS_DEFAULTS } from "../constants";
import { fetchTerminalSettings, updateTerminalSettings } from "../queries";
import type { PosTerminalSettings, SettingsPageState, TerminalSettingsFormValues } from "../types";
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

export function SettingsView() {
  const deviceId = getPosDeviceIdSync();

  const [pageState, setPageState] = useState<SettingsPageState>("loading");
  const [terminalSettings, setTerminalSettings] =
    useState<PosTerminalSettings | null>(null);
  const [formValues, setFormValues] = useState<TerminalSettingsFormValues>(
    TERMINAL_SETTINGS_DEFAULTS,
  );
  const [saving, setSaving] = useState(false);

  // Branch info (cached to avoid re-fetch on save).
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null);

  // Hardware devices
  const [hardwareDevices, setHardwareDevices] = useState<PosHardwareDeviceSummary[]>([]);
  const [hardwareLoading, setHardwareLoading] = useState(true);
  const [canManageSensitiveHardware, setCanManageSensitiveHardware] =
    useState(false);

  // Load all data on mount.
  const loadData = useCallback(async () => {
    setPageState("loading");

    try {
      // Load branch info.
      const branch = await fetchMyBranch();
      setBranchInfo(branch);

      // Load terminal settings (may 404 if not registered yet).
      try {
        const settings = await fetchTerminalSettings(deviceId);
        setTerminalSettings(settings);
        setFormValues({
          label: settings.label ?? "",
          defaultPaymentMethod: settings.defaultPaymentMethod,
          roundingRule: settings.roundingRule,
          autoPrintReceipt: settings.autoPrintReceipt,
          printCopies: settings.printCopies,
          lockTimeoutSeconds: settings.lockTimeoutSeconds,
        });
      } catch {
        // Terminal not registered yet — use defaults.
        setTerminalSettings(null);
        setFormValues(TERMINAL_SETTINGS_DEFAULTS);
      }

      // Load hardware devices via POS read-only endpoint.
      const devices = await fetchHardwareDevices();
      setHardwareDevices(devices);

      const authContext = await posApi.auth.me();
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
  }, [deviceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial/dependent data fetch; setState happens in the async continuation, not synchronously in the effect body.
    void loadData();
  }, [loadData]);

  // Save terminal settings.
  async function handleSave(values: TerminalSettingsFormValues) {
    if (!branchInfo?.id) {
      toast.error("无法获取当前门店信息，请刷新重试。");
      return;
    }

    setSaving(true);
    try {
      let result: PosTerminalSettings;

      if (terminalSettings) {
        // Update existing.
        result = await updateTerminalSettings(deviceId, {
          label: values.label || undefined,
          defaultPaymentMethod: values.defaultPaymentMethod,
          roundingRule: values.roundingRule,
          autoPrintReceipt: values.autoPrintReceipt,
          printCopies: values.printCopies,
          lockTimeoutSeconds: values.lockTimeoutSeconds,
        });
      } else {
        // Create new.
        result = await posApi.pos.terminalSettings.create({
          branchId: branchInfo.id,
          deviceId,
          label: values.label || undefined,
          defaultPaymentMethod: values.defaultPaymentMethod,
          roundingRule: values.roundingRule,
          autoPrintReceipt: values.autoPrintReceipt,
          printCopies: values.printCopies,
          lockTimeoutSeconds: values.lockTimeoutSeconds,
        });
      }

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

  const isLoading = pageState === "loading";

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Page header */}
      <div>
        <PosBreadcrumb items={[{ label: SETTINGS_PAGE_TITLE }]} />
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          {SETTINGS_PAGE_TITLE}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{SETTINGS_PAGE_DESCRIPTION}</p>
      </div>

      {/* Terminal settings (editable) */}
      {/* key forces remount when server data arrives, so useState re-initializes. */}
      <TerminalSettingsCard
        key={`terminal-${terminalSettings?.version ?? "new"}-${isLoading}`}
        initial={formValues}
        loading={isLoading}
        saving={saving}
        onSave={handleSave}
      />

      {/* General info (read-only) */}
      <GeneralSettingsCard
        branchAddress={branchInfo?.address ?? null}
        branchName={branchInfo?.name ?? ""}
        branchPhone={branchInfo?.phone ?? null}
        receiptAddress={branchInfo?.receiptAddress ?? null}
        receiptName={branchInfo?.receiptName ?? null}
        receiptPhone={branchInfo?.receiptPhone ?? null}
      />

      {/* Hardware devices (read-only list via POS endpoint) */}
      <HardwareSettingsCard
        canManageSensitiveHardware={canManageSensitiveHardware}
        devices={hardwareDevices}
        loading={hardwareLoading}
      />
    </div>
  );
}

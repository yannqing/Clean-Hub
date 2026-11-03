"use client";

import { useEffect } from "react";

import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";

import { loadPosHardwareDevices } from "../lib/hardware-device-cache";

export function PosHardwareCacheWarmer() {
  const { tenantId, branchId, terminalId } = usePosRuntimeConfig();

  useEffect(() => {
    if (!tenantId || !branchId || !terminalId || !navigator.onLine) return;
    void loadPosHardwareDevices({ tenantId, branchId, terminalId });
  }, [branchId, tenantId, terminalId]);

  return null;
}

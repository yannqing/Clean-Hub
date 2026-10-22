"use client";

import { createScopedPrintJobQueue, type PersistentPrintJob } from "@cleanhub/offline";
import { useEffect, useRef } from "react";

import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";

import { getPosHardwareBridge, getPosOfflineStorage } from "./desktop-bridge";
import {
  executePosPrintJob,
  notifyPosPrintQueueUpdated,
  type PosPrintJobPayload,
} from "./pos-print-job";

const PRINT_RECOVERY_INTERVAL_MS = 15_000;
const INITIAL_HARDWARE_GRACE_MS = 2_500;

export function isAutoRecoverablePrintJob(
  job: PersistentPrintJob<PosPrintJobPayload>,
): boolean {
  // "printing" is deliberately excluded: after a sudden power loss its
  // physical outcome is uncertain and must be checked by a person.
  return job.status === "pending" && job.payload.autoPrint === true;
}

/** Resume only print requests that were queued but never started. */
export function usePrintJobRecovery(): void {
  const { tenantId, branchId, terminalId } = usePosRuntimeConfig();
  const running = useRef(false);

  useEffect(() => {
    if (!tenantId || !branchId || !terminalId) return;
    let disposed = false;
    const queue = createScopedPrintJobQueue<PosPrintJobPayload>({
      storage: getPosOfflineStorage(),
      scope: { tenantId, branchId, terminalId },
    });

    const recover = async () => {
      if (disposed || running.current) return;
      running.current = true;
      try {
        const hardware = getPosHardwareBridge();
        if (!hardware) return;
        const capabilities = await hardware.getCapabilities();
        if (!capabilities.printer) return;

        const pending = (await queue.list()).filter(isAutoRecoverablePrintJob);
        for (const job of pending) {
          if (disposed) return;
          const result = await queue.retry(job.id, (storedJob) =>
            executePosPrintJob(storedJob, hardware),
          );
          notifyPosPrintQueueUpdated();
          if (result.status !== "printed") return;
        }
      } catch {
        // The persisted job remains visible and retryable. Recovery must never
        // block the cashier UI or spin aggressively when hardware is absent.
      } finally {
        running.current = false;
      }
    };

    const handleRecovery = () => void recover();
    const initialTimer = window.setTimeout(
      handleRecovery,
      INITIAL_HARDWARE_GRACE_MS,
    );
    const interval = window.setInterval(
      handleRecovery,
      PRINT_RECOVERY_INTERVAL_MS,
    );
    window.addEventListener("focus", handleRecovery);
    window.addEventListener("online", handleRecovery);
    void recover();

    return () => {
      disposed = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleRecovery);
      window.removeEventListener("online", handleRecovery);
    };
  }, [branchId, tenantId, terminalId]);
}

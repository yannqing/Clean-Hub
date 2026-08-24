"use client";

import { createContext, useContext, useMemo } from "react";
import { resolveTimeZone } from "@cleanhub/domain/timezone";

import { DEFAULT_POS_CURRENCY, normalizeCurrencyCode } from "@/lib/money";

type PosRuntimeConfig = {
  tenantId: string | null;
  branchId: string | null;
  terminalId: string | null;
  userId: string | null;
  terminalCredentialVersion: number | null;
  currency: string;
  timeZone: string;
  role: string | null;
  autoPrintReceipt: boolean;
  printCopies: number;
};

const PosRuntimeConfigContext = createContext<PosRuntimeConfig>({
  tenantId: null,
  branchId: null,
  terminalId: null,
  userId: null,
  terminalCredentialVersion: null,
  currency: DEFAULT_POS_CURRENCY,
  timeZone: "UTC",
  role: null,
  autoPrintReceipt: true,
  printCopies: 1,
});

export function PosRuntimeConfigProvider({
  tenantId,
  branchId,
  terminalId,
  userId,
  terminalCredentialVersion,
  currency,
  timeZone,
  role,
  autoPrintReceipt,
  printCopies,
  children,
}: {
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  userId?: string | null;
  terminalCredentialVersion?: number | null;
  currency?: string | null;
  timeZone?: string | null;
  role?: string | null;
  autoPrintReceipt?: boolean | null;
  printCopies?: number | null;
  children: React.ReactNode;
}) {
  const value = useMemo<PosRuntimeConfig>(
    () => ({
      tenantId: tenantId ?? null,
      branchId: branchId ?? null,
      terminalId: terminalId ?? null,
      userId: userId ?? null,
      terminalCredentialVersion: terminalCredentialVersion ?? null,
      currency: normalizeCurrencyCode(currency),
      timeZone: resolveTimeZone(timeZone),
      role: role ?? null,
      autoPrintReceipt: autoPrintReceipt ?? true,
      printCopies: printCopies ?? 1,
    }),
    [
      branchId,
      currency,
      tenantId,
      terminalCredentialVersion,
      terminalId,
      timeZone,
      role,
      autoPrintReceipt,
      printCopies,
      userId,
    ],
  );

  return (
    <PosRuntimeConfigContext.Provider value={value}>
      {children}
    </PosRuntimeConfigContext.Provider>
  );
}

export function usePosRuntimeConfig(): PosRuntimeConfig {
  return useContext(PosRuntimeConfigContext);
}

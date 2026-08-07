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
};

const PosRuntimeConfigContext = createContext<PosRuntimeConfig>({
  tenantId: null,
  branchId: null,
  terminalId: null,
  userId: null,
  terminalCredentialVersion: null,
  currency: DEFAULT_POS_CURRENCY,
  timeZone: "UTC",
});

export function PosRuntimeConfigProvider({
  tenantId,
  branchId,
  terminalId,
  userId,
  terminalCredentialVersion,
  currency,
  timeZone,
  children,
}: {
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  userId?: string | null;
  terminalCredentialVersion?: number | null;
  currency?: string | null;
  timeZone?: string | null;
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
    }),
    [
      branchId,
      currency,
      tenantId,
      terminalCredentialVersion,
      terminalId,
      timeZone,
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

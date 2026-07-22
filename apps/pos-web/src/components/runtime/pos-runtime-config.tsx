"use client";

import { createContext, useContext, useMemo } from "react";

import {
  DEFAULT_POS_CURRENCY,
  normalizeCurrencyCode,
} from "@/lib/money";

type PosRuntimeConfig = {
  tenantId: string | null;
  branchId: string | null;
  terminalId: string | null;
  currency: string;
};

const PosRuntimeConfigContext = createContext<PosRuntimeConfig>({
  tenantId: null,
  branchId: null,
  terminalId: null,
  currency: DEFAULT_POS_CURRENCY,
});

export function PosRuntimeConfigProvider({
  tenantId,
  branchId,
  terminalId,
  currency,
  children,
}: {
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  currency?: string | null;
  children: React.ReactNode;
}) {
  const value = useMemo<PosRuntimeConfig>(
    () => ({
      tenantId: tenantId ?? null,
      branchId: branchId ?? null,
      terminalId: terminalId ?? null,
      currency: normalizeCurrencyCode(currency),
    }),
    [branchId, currency, tenantId, terminalId],
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

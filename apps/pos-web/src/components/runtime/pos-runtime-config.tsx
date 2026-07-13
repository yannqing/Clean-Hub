"use client";

import { createContext, useContext, useMemo } from "react";

import {
  DEFAULT_POS_CURRENCY,
  normalizeCurrencyCode,
} from "@/lib/money";

type PosRuntimeConfig = {
  branchId: string | null;
  currency: string;
};

const PosRuntimeConfigContext = createContext<PosRuntimeConfig>({
  branchId: null,
  currency: DEFAULT_POS_CURRENCY,
});

export function PosRuntimeConfigProvider({
  branchId,
  currency,
  children,
}: {
  branchId?: string | null;
  currency?: string | null;
  children: React.ReactNode;
}) {
  const value = useMemo<PosRuntimeConfig>(
    () => ({
      branchId: branchId ?? null,
      currency: normalizeCurrencyCode(currency),
    }),
    [branchId, currency],
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

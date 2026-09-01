"use client";

import { createContext, useContext, useMemo } from "react";
import { resolveTimeZone } from "@cleanhub/domain/timezone";

import { DEFAULT_POS_CURRENCY, normalizeCurrencyCode } from "@/lib/money";
import type { PosPaymentMethod, PosRoundingRule } from "@cleanhub/api-client";

type PosRuntimeConfig = {
  tenantId: string | null;
  branchId: string | null;
  terminalId: string | null;
  userId: string | null;
  terminalCredentialVersion: number | null;
  currency: string;
  timeZone: string;
  role: string | null;
  defaultPaymentMethod: PosPaymentMethod;
  paymentMethodsEnabled: PosPaymentMethod[];
  roundingRule: PosRoundingRule;
  taxEnabled: boolean;
  defaultTaxRate: string;
  pricesIncludeTax: boolean;
  taxRegistrationNumber: string | null;
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
  defaultPaymentMethod: "cash",
  paymentMethodsEnabled: ["cash", "app"],
  roundingRule: "none",
  taxEnabled: false,
  defaultTaxRate: "0.0000",
  pricesIncludeTax: true,
  taxRegistrationNumber: null,
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
  defaultPaymentMethod,
  paymentMethodsEnabled,
  roundingRule,
  taxEnabled,
  defaultTaxRate,
  pricesIncludeTax,
  taxRegistrationNumber,
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
  defaultPaymentMethod?: PosPaymentMethod | null;
  paymentMethodsEnabled?: PosPaymentMethod[] | null;
  roundingRule?: PosRoundingRule | null;
  taxEnabled?: boolean | null;
  defaultTaxRate?: string | null;
  pricesIncludeTax?: boolean | null;
  taxRegistrationNumber?: string | null;
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
      defaultPaymentMethod: defaultPaymentMethod ?? "cash",
      paymentMethodsEnabled:
        paymentMethodsEnabled && paymentMethodsEnabled.length > 0
          ? paymentMethodsEnabled
          : ["cash", "app"],
      roundingRule: roundingRule ?? "none",
      taxEnabled: taxEnabled ?? false,
      defaultTaxRate: defaultTaxRate ?? "0.0000",
      pricesIncludeTax: pricesIncludeTax ?? true,
      taxRegistrationNumber: taxRegistrationNumber ?? null,
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
      defaultPaymentMethod,
      paymentMethodsEnabled,
      roundingRule,
      taxEnabled,
      defaultTaxRate,
      pricesIncludeTax,
      taxRegistrationNumber,
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

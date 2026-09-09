"use client";

import { createContext, useContext, useMemo } from "react";
import { resolveTimeZone } from "@cleanhub/domain/timezone";
import {
  DEFAULT_POS_RECEIPT_FIELDS,
  DEFAULT_POS_TICKET_LABEL_FIELDS,
  type PosReceiptField,
  type PosTicketLabelField,
} from "@cleanhub/domain/receipt";

import { DEFAULT_POS_CURRENCY, normalizeCurrencyCode } from "@/lib/money";
import type {
  PosMobileMoneyProvider,
  PosPaymentMethod,
  PosRoundingRule,
} from "@cleanhub/api-client";

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
  mobileMoneyProvidersEnabled: PosMobileMoneyProvider[];
  roundingRule: PosRoundingRule;
  taxEnabled: boolean;
  defaultTaxRate: string;
  pricesIncludeTax: boolean;
  taxRegistrationNumber: string | null;
  merchantName: string;
  branchName: string;
  receiptName: string | null;
  receiptPhone: string | null;
  receiptAddress: string | null;
  receiptFields: PosReceiptField[];
  ticketLabelFields: PosTicketLabelField[];
  operatorName: string | null;
  terminalName: string | null;
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
  paymentMethodsEnabled: ["cash"],
  mobileMoneyProvidersEnabled: [],
  roundingRule: "none",
  taxEnabled: false,
  defaultTaxRate: "0.0000",
  pricesIncludeTax: true,
  taxRegistrationNumber: null,
  merchantName: "CleanHub",
  branchName: "",
  receiptName: null,
  receiptPhone: null,
  receiptAddress: null,
  receiptFields: [...DEFAULT_POS_RECEIPT_FIELDS],
  ticketLabelFields: [...DEFAULT_POS_TICKET_LABEL_FIELDS],
  operatorName: null,
  terminalName: null,
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
  mobileMoneyProvidersEnabled,
  roundingRule,
  taxEnabled,
  defaultTaxRate,
  pricesIncludeTax,
  taxRegistrationNumber,
  merchantName,
  branchName,
  receiptName,
  receiptPhone,
  receiptAddress,
  receiptFields,
  ticketLabelFields,
  operatorName,
  terminalName,
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
  mobileMoneyProvidersEnabled?: PosMobileMoneyProvider[] | null;
  roundingRule?: PosRoundingRule | null;
  taxEnabled?: boolean | null;
  defaultTaxRate?: string | null;
  pricesIncludeTax?: boolean | null;
  taxRegistrationNumber?: string | null;
  merchantName?: string | null;
  branchName?: string | null;
  receiptName?: string | null;
  receiptPhone?: string | null;
  receiptAddress?: string | null;
  receiptFields?: PosReceiptField[] | null;
  ticketLabelFields?: PosTicketLabelField[] | null;
  operatorName?: string | null;
  terminalName?: string | null;
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
      paymentMethodsEnabled: paymentMethodsEnabled ?? ["cash"],
      mobileMoneyProvidersEnabled: mobileMoneyProvidersEnabled ?? [],
      roundingRule: roundingRule ?? "none",
      taxEnabled: taxEnabled ?? false,
      defaultTaxRate: defaultTaxRate ?? "0.0000",
      pricesIncludeTax: pricesIncludeTax ?? true,
      taxRegistrationNumber: taxRegistrationNumber ?? null,
      merchantName: merchantName || "CleanHub",
      branchName: branchName ?? "",
      receiptName: receiptName ?? null,
      receiptPhone: receiptPhone ?? null,
      receiptAddress: receiptAddress ?? null,
      receiptFields: receiptFields ?? [...DEFAULT_POS_RECEIPT_FIELDS],
      ticketLabelFields:
        ticketLabelFields ?? [...DEFAULT_POS_TICKET_LABEL_FIELDS],
      operatorName: operatorName ?? null,
      terminalName: terminalName ?? null,
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
      mobileMoneyProvidersEnabled,
      roundingRule,
      taxEnabled,
      defaultTaxRate,
      pricesIncludeTax,
      taxRegistrationNumber,
      merchantName,
      branchName,
      receiptName,
      receiptPhone,
      receiptAddress,
      receiptFields,
      ticketLabelFields,
      operatorName,
      terminalName,
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

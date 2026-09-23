"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
import { getPosOfflineStorage } from "@/features/hardware/lib/desktop-bridge";

import {
  readPosOfflineRuntime,
  writePosOfflineRuntime,
} from "./pos-offline-runtime";

export type PosRuntimeConfig = {
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
  /**
   * Smallest note this branch's till stocks, in major units. The cashier may
   * offer to round a cash total down to it; 1 means no offer is made.
   */
  cashRoundingStep: number;
  taxEnabled: boolean;
  defaultTaxRate: string;
  pricesIncludeTax: boolean;
  taxRegistrationNumber: string | null;
  merchantName: string;
  branchName: string;
  receiptName: string | null;
  receiptPhone: string | null;
  receiptAddress: string | null;
  receiptThankYouMessage: string | null;
  receiptFields: PosReceiptField[];
  ticketLabelFields: PosTicketLabelField[];
  operatorName: string | null;
  terminalName: string | null;
  autoPrintReceipt: boolean;
  printCopies: number;
  /**
   * Whether an emailed receipt may be offered at checkout. Resolved by the API
   * from the platform SMTP configuration and this tenant's entitlement.
   */
  emailReceiptEnabled: boolean;
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
  cashRoundingStep: 1,
  taxEnabled: false,
  defaultTaxRate: "0.0000",
  pricesIncludeTax: true,
  taxRegistrationNumber: null,
  merchantName: "CleanHub",
  branchName: "",
  receiptName: null,
  receiptPhone: null,
  receiptAddress: null,
  receiptThankYouMessage: null,
  receiptFields: [...DEFAULT_POS_RECEIPT_FIELDS],
  ticketLabelFields: [...DEFAULT_POS_TICKET_LABEL_FIELDS],
  operatorName: null,
  terminalName: null,
  autoPrintReceipt: true,
  printCopies: 1,
  // Default off: a context with no provider must not offer a channel that may
  // not be configured.
  emailReceiptEnabled: false,
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
  cashRoundingStep,
  receiptAddress,
  receiptThankYouMessage,
  receiptFields,
  ticketLabelFields,
  operatorName,
  terminalName,
  autoPrintReceipt,
  printCopies,
  emailReceiptEnabled,
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
  cashRoundingStep?: number | null;
  taxEnabled?: boolean | null;
  defaultTaxRate?: string | null;
  pricesIncludeTax?: boolean | null;
  taxRegistrationNumber?: string | null;
  merchantName?: string | null;
  branchName?: string | null;
  receiptName?: string | null;
  receiptPhone?: string | null;
  receiptAddress?: string | null;
  receiptThankYouMessage?: string | null;
  receiptFields?: PosReceiptField[] | null;
  ticketLabelFields?: PosTicketLabelField[] | null;
  operatorName?: string | null;
  terminalName?: string | null;
  autoPrintReceipt?: boolean | null;
  printCopies?: number | null;
  emailReceiptEnabled?: boolean | null;
  children: React.ReactNode;
}) {
  const serverValue = useMemo<PosRuntimeConfig>(
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
      cashRoundingStep: cashRoundingStep ?? 1,
      taxEnabled: taxEnabled ?? false,
      defaultTaxRate: defaultTaxRate ?? "0.0000",
      pricesIncludeTax: pricesIncludeTax ?? true,
      taxRegistrationNumber: taxRegistrationNumber ?? null,
      merchantName: merchantName || "CleanHub",
      branchName: branchName ?? "",
      receiptName: receiptName ?? null,
      receiptPhone: receiptPhone ?? null,
      receiptAddress: receiptAddress ?? null,
      receiptThankYouMessage: receiptThankYouMessage ?? null,
      receiptFields: receiptFields ?? [...DEFAULT_POS_RECEIPT_FIELDS],
      ticketLabelFields: ticketLabelFields ?? [
        ...DEFAULT_POS_TICKET_LABEL_FIELDS,
      ],
      operatorName: operatorName ?? null,
      terminalName: terminalName ?? null,
      autoPrintReceipt: autoPrintReceipt ?? true,
      printCopies: printCopies ?? 1,
      emailReceiptEnabled: emailReceiptEnabled ?? false,
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
      cashRoundingStep,
      taxEnabled,
      defaultTaxRate,
      pricesIncludeTax,
      taxRegistrationNumber,
      merchantName,
      branchName,
      receiptName,
      receiptPhone,
      receiptAddress,
      receiptThankYouMessage,
      receiptFields,
      ticketLabelFields,
      operatorName,
      terminalName,
      autoPrintReceipt,
      printCopies,
      emailReceiptEnabled,
      userId,
    ],
  );
  const [offlineValue, setOfflineValue] = useState<PosRuntimeConfig | null>(
    null,
  );
  const serverScopeReady = Boolean(
    serverValue.tenantId &&
      serverValue.branchId &&
      serverValue.terminalId &&
      serverValue.userId &&
      serverValue.terminalCredentialVersion,
  );

  useEffect(() => {
    let active = true;
    if (serverScopeReady) {
      void writePosOfflineRuntime(getPosOfflineStorage(), serverValue).catch(
        () => undefined,
      );
    } else {
      void readPosOfflineRuntime(getPosOfflineStorage())
        .then((cached) => {
          if (active) setOfflineValue(cached);
        })
        .catch(() => {
          if (active) setOfflineValue(null);
        });
    }
    return () => {
      active = false;
    };
  }, [serverScopeReady, serverValue]);

  const value = serverScopeReady ? serverValue : offlineValue ?? serverValue;

  return (
    <PosRuntimeConfigContext.Provider value={value}>
      {children}
    </PosRuntimeConfigContext.Provider>
  );
}

export function usePosRuntimeConfig(): PosRuntimeConfig {
  return useContext(PosRuntimeConfigContext);
}

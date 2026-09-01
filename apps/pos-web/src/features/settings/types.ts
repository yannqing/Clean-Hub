/**
 * 设置 — local UI types.
 *
 * DTOs are re-exported from @cleanhub/api-client. Only UI-specific types
 * (form state, page state) are defined here.
 */

import type {
  PosPaymentMethod,
  PosRoundingRule,
  PosTerminalSettings,
} from "@cleanhub/api-client";

export type { PosTerminalSettings };

export type SettingsPageState = "idle" | "loading" | "ready" | "error";

/** Terminal settings form values (editable subset). */
export type TerminalSettingsFormValues = {
  label: string;
  defaultPaymentMethod: PosPaymentMethod;
  paymentMethodsEnabled: PosPaymentMethod[];
  roundingRule: PosRoundingRule;
  autoPrintReceipt: boolean;
  printCopies: number;
  lockTimeoutSeconds: number;
};

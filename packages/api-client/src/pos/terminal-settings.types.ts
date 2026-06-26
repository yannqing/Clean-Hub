export type PosPaymentMethod = "cash" | "card" | "app";
export type PosRoundingRule = "none" | "round_yuan" | "round_jiao";
export type PosTerminalSettingsStatus = "active" | "inactive";

export type PosTerminalSettings = {
  id: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  label: string | null;
  defaultPaymentMethod: PosPaymentMethod;
  roundingRule: PosRoundingRule;
  autoPrintReceipt: boolean;
  printCopies: number;
  lockTimeoutSeconds: number;
  status: PosTerminalSettingsStatus;
  lastSeenAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  version: number;
};

export type CreatePosTerminalSettingsRequest = {
  branchId: string;
  deviceId: string;
  label?: string;
  defaultPaymentMethod?: PosPaymentMethod;
  roundingRule?: PosRoundingRule;
  autoPrintReceipt?: boolean;
  printCopies?: number;
  lockTimeoutSeconds?: number;
};

export type UpdatePosTerminalSettingsRequest = {
  label?: string;
  defaultPaymentMethod?: PosPaymentMethod;
  roundingRule?: PosRoundingRule;
  autoPrintReceipt?: boolean;
  printCopies?: number;
  lockTimeoutSeconds?: number;
};

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import type {
  CreatePosCheckoutRequest,
  CreatePosCheckoutResponse,
  CreatePosPaymentRequest,
  CreatePosPaymentResponse,
} from "../orders/orders.types.js";

export type PosOfflineCashCommand =
  | { type: "checkout"; input: CreatePosCheckoutRequest }
  | { type: "payment"; orderId: string; input: CreatePosPaymentRequest };

export type ReportPosOfflineSaleExceptionRequest = {
  commandId: string;
  orderId: string;
  command: PosOfflineCashCommand;
  failureCode?: string;
  failureMessage: string;
};

export type PosOfflineSaleException = {
  id: string;
  commandId: string;
  orderId: string;
  branchId: string;
  terminalId: string;
  shiftId: string;
  staffId: string;
  operationType: "checkout" | "payment";
  expectedTotalAmount: string;
  tenderedAmount: string;
  currency: string;
  failureCode: string | null;
  failureMessage: string;
  failureCount: number;
  lastFailedAt: string;
  status: "open" | "resolved";
  resolution: "cash_refunded" | "recovered" | null;
  resolutionReason: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvePosOfflineSaleExceptionRequest = {
  action: "cash_refunded" | "retry_latest";
  reason: string;
};

export type ResolvePosOfflineSaleExceptionResponse = {
  exception: PosOfflineSaleException;
  result: CreatePosCheckoutResponse | CreatePosPaymentResponse | null;
};

export type PosOfflineSaleMutationInput<T> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: T;
};

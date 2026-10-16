import type { PosOrderPaymentStatus, PosOrderStatus } from "./orders.types.js";
import { moneyToMinor } from "../discounts/pricing-engine.js";

export type PosOrderPaymentProjectionInput = {
  current: {
    totalAmount: string;
    paidAmount: string;
    paymentStatus: PosOrderPaymentStatus;
    paidAt: Date | null;
    status: PosOrderStatus;
  };
  nextTotalAmount: string;
  nextPaidAmount: string;
  zeroTotalSettlement?: boolean;
  /** Product-only sales are handed over at the till when payment succeeds. */
  autoDeliverWhenPaid?: boolean;
  latestPaidTransactionAt?: Date | null;
  now?: Date;
};

export type PosOrderPaymentProjection = {
  paymentStatus: PosOrderPaymentStatus;
  paidAt: Date | null;
  status: PosOrderStatus;
};

/**
 * Projects the order's financial and workflow state without creating a
 * synthetic zero-value payment transaction.
 *
 * A zero-total order is financially settled immediately, but remains in its
 * current draft/received workflow state until an explicit zero-total
 * confirmation moves it to `paid`. This keeps a 100% discount reversible
 * before confirmation while preserving the existing paid -> delivered flow.
 */
export function projectPosOrderPaymentState(
  input: PosOrderPaymentProjectionInput,
): PosOrderPaymentProjection {
  const now = input.now ?? new Date();
  const totalMinor = moneyToMinor(input.nextTotalAmount);
  const paidMinor = moneyToMinor(input.nextPaidAmount);
  const zeroTotal = totalMinor === BigInt(0);
  const financiallySettledZeroTotal =
    zeroTotal && input.zeroTotalSettlement === true;
  const paymentStatus: PosOrderPaymentStatus = financiallySettledZeroTotal
    ? "paid"
    : paidMinor === BigInt(0)
      ? "unpaid"
      : paidMinor < totalMinor
        ? "partial"
        : "paid";

  let paidAt: Date | null = null;
  if (paymentStatus === "paid") {
    if (financiallySettledZeroTotal) {
      const wasAlreadyZeroSettled =
        moneyToMinor(input.current.totalAmount) === BigInt(0) &&
        input.current.paymentStatus === "paid";
      paidAt = (wasAlreadyZeroSettled ? input.current.paidAt : null) ?? now;
    } else {
      paidAt =
        input.latestPaidTransactionAt ??
        (input.current.paymentStatus === "paid"
          ? input.current.paidAt
          : null) ??
        now;
    }
  }

  let status = input.current.status;
  const finalized = status === "delivered" || status === "cancelled";
  if (!finalized && !financiallySettledZeroTotal && paymentStatus === "paid") {
    status = input.autoDeliverWhenPaid ? "delivered" : "paid";
  } else if (!finalized && paymentStatus !== "paid" && status === "paid") {
    status = "received";
  }

  return { paymentStatus, paidAt, status };
}

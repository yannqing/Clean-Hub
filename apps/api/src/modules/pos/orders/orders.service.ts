/**
 * POS order management — service layer (Scaffold).
 *
 * Every method throws PosNotImplementedError until the repository is wired up.
 */
import type {
  CreatePosOrderInput,
  PosOrderDetail,
  PosOrderDetailInput,
  PosOrderListInput,
  PosOrderSummary,
} from "./orders.types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";

export async function listPosOrders(
  _input: PosOrderListInput,
): Promise<PosOrderSummary[]> {
  throw new PosNotImplementedError("listPosOrders");
}

export async function getPosOrder(
  _input: PosOrderDetailInput,
): Promise<PosOrderDetail> {
  throw new PosNotImplementedError("getPosOrder");
}

export async function createPosOrder(
  _input: CreatePosOrderInput,
): Promise<PosOrderDetail> {
  throw new PosNotImplementedError("createPosOrder");
}

/**
 * POS customer management — service layer (Scaffold).
 *
 * Every method throws PosNotImplementedError. The repository implementation
 * will be filled in later; this skeleton exists so the routes are reachable
 * and the API client has a typed surface to call.
 */
import type {
  CreatePosCustomerInput,
  PosCustomerDetail,
  PosCustomerDetailInput,
  PosCustomerListInput,
  PosCustomerSummary,
} from "./customers.types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";

export async function listPosCustomers(
  _input: PosCustomerListInput,
): Promise<PosCustomerSummary[]> {
  throw new PosNotImplementedError("listPosCustomers");
}

export async function getPosCustomer(
  _input: PosCustomerDetailInput,
): Promise<PosCustomerDetail> {
  throw new PosNotImplementedError("getPosCustomer");
}

export async function createPosCustomer(
  _input: CreatePosCustomerInput,
): Promise<PosCustomerDetail> {
  throw new PosNotImplementedError("createPosCustomer");
}

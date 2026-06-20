/**
 * POS staff management — service layer (Scaffold).
 *
 * Covers clock-in/out, shift handover, and staff listing. Every method throws
 * PosNotImplementedError until the staff/shift/handover tables land.
 */
import type {
  ClockInput,
  CreateHandoverInput,
  HandoverRecord,
  PosStaffDetail,
  PosStaffDetailInput,
  PosStaffListInput,
  PosStaffSummary,
  ShiftRecord,
} from "./staff.types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";

export async function listPosStaff(
  _input: PosStaffListInput,
): Promise<PosStaffSummary[]> {
  throw new PosNotImplementedError("listPosStaff");
}

export async function getPosStaff(
  _input: PosStaffDetailInput,
): Promise<PosStaffDetail> {
  throw new PosNotImplementedError("getPosStaff");
}

export async function clockAction(_input: ClockInput): Promise<ShiftRecord> {
  throw new PosNotImplementedError("clockAction");
}

export async function createHandover(
  _input: CreateHandoverInput,
): Promise<HandoverRecord> {
  throw new PosNotImplementedError("createHandover");
}

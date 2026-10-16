/**
 * POS reception (front-desk) — service layer (Scaffold).
 */
import type {
  CreatePosReceptionEventInput,
  PosReceptionEvent,
  PosReceptionEventListInput,
  PosReceptionSummary,
  PosReceptionSummaryInput,
} from "./reception.types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";

export async function listPosReceptionEvents(
  _input: PosReceptionEventListInput,
): Promise<PosReceptionEvent[]> {
  throw new PosNotImplementedError("listPosReceptionEvents");
}

export async function createPosReceptionEvent(
  _input: CreatePosReceptionEventInput,
): Promise<PosReceptionEvent> {
  throw new PosNotImplementedError("createPosReceptionEvent");
}

export async function getPosReceptionSummary(
  _input: PosReceptionSummaryInput,
): Promise<PosReceptionSummary> {
  throw new PosNotImplementedError("getPosReceptionSummary");
}

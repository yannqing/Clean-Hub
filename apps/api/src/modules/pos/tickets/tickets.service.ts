/**
 * POS ticket (work order) management — service layer (Scaffold).
 *
 * Every method throws PosNotImplementedError until the repository and the
 * `tickets` table are introduced.
 */
import type {
  CreatePosTicketInput,
  PosTicketDetail,
  PosTicketDetailInput,
  PosTicketListInput,
  PosTicketSummary,
  UpdatePosTicketStatusInput,
} from "./tickets.types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";

export async function listPosTickets(
  _input: PosTicketListInput,
): Promise<PosTicketSummary[]> {
  throw new PosNotImplementedError("listPosTickets");
}

export async function getPosTicket(
  _input: PosTicketDetailInput,
): Promise<PosTicketDetail> {
  throw new PosNotImplementedError("getPosTicket");
}

export async function createPosTicket(
  _input: CreatePosTicketInput,
): Promise<PosTicketDetail> {
  throw new PosNotImplementedError("createPosTicket");
}

export async function updatePosTicketStatus(
  _input: UpdatePosTicketStatusInput,
): Promise<PosTicketDetail> {
  throw new PosNotImplementedError("updatePosTicketStatus");
}

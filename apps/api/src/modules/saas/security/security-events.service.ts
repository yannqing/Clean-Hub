import { getDb, type Database } from "@cleanhub/db";

import { requireSaasRole } from "../../auth/permission.helper.js";
import { SecurityEventError } from "./security-events.errors.js";
import {
  findSecurityEventById,
  findSecurityEvents,
} from "./security-events.repository.js";
import type {
  GetSecurityEventDetailInput,
  SecurityEventDetail,
  SecurityEventListInput,
  SecurityEventListItem,
} from "./security-events.types.js";

export async function listSecurityEvents(
  input: SecurityEventListInput,
  db: Database = getDb(),
): Promise<SecurityEventListItem[]> {
  return findSecurityEvents(db, input);
}

export async function getSecurityEventDetail(
  input: GetSecurityEventDetailInput,
  db: Database = getDb(),
): Promise<SecurityEventDetail> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  const event = await findSecurityEventById(db, input.eventId);

  if (!event) {
    throw new SecurityEventError(
      "SECURITY_EVENT_NOT_FOUND",
      "Security event was not found.",
      404,
    );
  }

  return event;
}
